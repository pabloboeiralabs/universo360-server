import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ArrowRight, CalendarDays, MapPin, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';

interface TicketInfo {
  id: string;
  student_name: string | null;
  customer_name: string;
  class_grade: string | null;
  amount: number;
  payment_status: string;
  spots_decremented: boolean;
  event: {
    id: string;
    school_name: string;
    event_date: string;
    franchise_id: string;
  } | null;
}

interface TransferTicketDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ticket: TicketInfo | null;
  franchiseId?: string | null;
}

const TransferTicketDialog = ({ open, onOpenChange, ticket, franchiseId }: TransferTicketDialogProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedEventId, setSelectedEventId] = useState<string>('');

  const { data: events, isLoading: eventsLoading } = useQuery({
    queryKey: ['transfer-events', franchiseId, ticket?.event?.id],
    queryFn: async () => {
      const targetFranchiseId = franchiseId || ticket?.event?.franchise_id;

      let query = supabase
        .from('events')
        .select('id, school_name, event_date, location, available_spots, total_capacity, franchise_id')
        .eq('is_active', true)
        .order('event_date', { ascending: true });

      if (targetFranchiseId) {
        query = query.eq('franchise_id', targetFranchiseId);
      }

      const { data, error } = await query;
      if (error) throw error;

      return (data || []).filter(e => e.id !== ticket?.event?.id);
    },
    enabled: open && !!ticket,
  });

  const selectedEvent = events?.find(e => e.id === selectedEventId);

  const transferMutation = useMutation({
    mutationFn: async () => {
      if (!ticket || !selectedEventId) throw new Error('Dados inválidos');
      const currentEventId = ticket.event?.id;
      if (!currentEventId) throw new Error('Evento original não encontrado');

      // 1. Update ticket to new event
      const { error: updateError } = await supabase
        .from('tickets')
        .update({ event_id: selectedEventId, updated_at: new Date().toISOString() })
        .eq('id', ticket.id);
      if (updateError) throw updateError;

      // 2. Adjust spots only if the ticket had spots decremented (i.e., was approved)
      if (ticket.spots_decremented) {
        // Restore +1 vaga no evento original
        const { data: oldEvent } = await supabase
          .from('events')
          .select('available_spots, total_capacity')
          .eq('id', currentEventId)
          .single();

        if (oldEvent) {
          await supabase
            .from('events')
            .update({
              available_spots: Math.min(
                oldEvent.available_spots + 1,
                oldEvent.total_capacity
              ),
            })
            .eq('id', currentEventId);
        }

        // Reset flag so decrement_spots can run on new event
        await supabase
          .from('tickets')
          .update({ spots_decremented: false })
          .eq('id', ticket.id);

        // Decrement -1 vaga no evento novo
        const { error: decrementError } = await supabase.rpc('decrement_spots', {
          p_ticket_id: ticket.id,
          p_event_id: selectedEventId,
          p_quantity: 1,
        });
        if (decrementError) {
          console.error('decrement_spots error on new event:', decrementError);
        }
      }

      return { success: true };
    },
    onSuccess: () => {
      toast({
        title: 'Transferência realizada!',
        description: `${ticket?.student_name || ticket?.customer_name} foi transferido com sucesso.`,
      });
      queryClient.invalidateQueries({ queryKey: ['admin-sales'] });
      queryClient.invalidateQueries({ queryKey: ['franchise-sales'] });
      queryClient.invalidateQueries({ queryKey: ['events'] });
      setSelectedEventId('');
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro na transferência',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handleClose = () => {
    if (!transferMutation.isPending) {
      setSelectedEventId('');
      onOpenChange(false);
    }
  };

  if (!ticket) return null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRight className="h-5 w-5 text-primary" />
            Transferir Aluno para Outro Evento
          </DialogTitle>
          <DialogDescription>
            Todos os dados financeiros e do aluno serão mantidos. As vagas serão ajustadas automaticamente.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Student Info */}
          <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-1">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Aluno</p>
            <p className="font-semibold text-foreground">{ticket.student_name || ticket.customer_name}</p>
            {ticket.class_grade && (
              <p className="text-sm text-muted-foreground">{ticket.class_grade}</p>
            )}
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="outline" className="text-xs">
                R$ {Number(ticket.amount).toFixed(2).replace('.', ',')}
              </Badge>
              <Badge className="bg-green-500/20 text-green-600 border-green-500/30 text-xs">
                {ticket.payment_status === 'approved' ? 'Pago' : ticket.payment_status}
              </Badge>
            </div>
          </div>

          {/* From → To */}
          <div className="flex items-center gap-2">
            <div className="flex-1 rounded-lg border border-border bg-muted/20 p-3">
              <p className="text-xs text-muted-foreground mb-1">De</p>
              <p className="font-medium text-sm text-foreground line-clamp-2">
                {ticket.event?.school_name || 'Evento atual'}
              </p>
              {ticket.event?.event_date && (
                <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                  <CalendarDays className="h-3 w-3" />
                  {format(new Date(ticket.event.event_date + 'T12:00:00'), 'dd/MM/yyyy', { locale: ptBR })}
                </p>
              )}
            </div>

            <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />

            <div className="flex-1 rounded-lg border border-border bg-primary/5 p-3">
              <p className="text-xs text-muted-foreground mb-1">Para</p>
              {selectedEvent ? (
                <>
                  <p className="font-medium text-sm text-foreground line-clamp-2">
                    {selectedEvent.school_name}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                    <CalendarDays className="h-3 w-3" />
                    {format(new Date(selectedEvent.event_date + 'T12:00:00'), 'dd/MM/yyyy', { locale: ptBR })}
                  </p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {selectedEvent.available_spots} vagas disponíveis
                  </p>
                </>
              ) : (
                <p className="text-sm text-muted-foreground italic">Selecione o evento</p>
              )}
            </div>
          </div>

          {/* Event Selector */}
          <div>
            <label className="text-sm font-medium text-foreground mb-2 block">
              Selecionar Evento de Destino
            </label>
            <Select
              value={selectedEventId}
              onValueChange={setSelectedEventId}
              disabled={eventsLoading}
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={eventsLoading ? 'Carregando eventos...' : 'Escolha o evento de destino'}
                />
              </SelectTrigger>
              <SelectContent>
                {events?.length === 0 ? (
                  <div className="px-3 py-2 text-sm text-muted-foreground">
                    Nenhum evento futuro disponível
                  </div>
                ) : (
                  events?.map(event => (
                    <SelectItem key={event.id} value={event.id}>
                      <span className="flex items-center gap-2">
                        <span>{event.school_name}</span>
                        <span className="text-muted-foreground text-xs">
                          {format(new Date(event.event_date + 'T12:00:00'), 'dd/MM/yy', { locale: ptBR })}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          ({event.available_spots} vagas)
                        </span>
                      </span>
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Warning: no spots */}
          {selectedEvent && selectedEvent.available_spots === 0 && (
            <div className="flex items-start gap-2 rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-3">
              <AlertTriangle className="h-4 w-4 text-yellow-500 shrink-0 mt-0.5" />
              <p className="text-sm text-yellow-700 dark:text-yellow-400">
                Este evento não possui vagas disponíveis. A transferência irá prosseguir mesmo assim.
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={transferMutation.isPending}>
            Cancelar
          </Button>
          <Button
            onClick={() => transferMutation.mutate()}
            disabled={!selectedEventId || transferMutation.isPending}
          >
            {transferMutation.isPending ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-primary-foreground mr-2" />
                Transferindo...
              </>
            ) : (
              <>
                <ArrowRight className="h-4 w-4 mr-2" />
                Confirmar Transferência
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default TransferTicketDialog;
