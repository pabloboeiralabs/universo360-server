import { useState, useEffect, useCallback, useMemo } from 'react';
import { Plus, Edit, Trash2, Calendar, MapPin, Users, DollarSign, Copy, Send, Loader2, QrCode, Eye, Ticket } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import EventQRCodeDialog from '@/components/shared/EventQRCodeDialog';
import EventFinancialDialog from '@/components/admin/EventFinancialDialog';

interface Event {
  id: string;
  franchise_id: string;
  school_name: string;
  description: string | null;
  location: string;
  event_date: string;
  event_time: string;
  price: number;
  total_capacity: number;
  available_spots: number;
  is_active: boolean;
  created_at: string;
  customer_id: string | null;
  franchises?: { name: string };
}

const EventsManagement = () => {
  const { toast } = useToast();
  const [events, setEvents] = useState<Event[]>([]);
  const [ticketsByEvent, setTicketsByEvent] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isCloneOpen, setIsCloneOpen] = useState(false);
  const [cloneSourceEvent, setCloneSourceEvent] = useState<Event | null>(null);
  const [isCloneSubmitting, setIsCloneSubmitting] = useState(false);
  const [qrCodeEvent, setQrCodeEvent] = useState<Event | null>(null);
  const [financialEvent, setFinancialEvent] = useState<Event | null>(null);
  const [cloneForm, setCloneForm] = useState({
    school_name: '',
    location: '',
    event_date: '',
    event_time: '',
    price: '',
    total_capacity: '',
  });

  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('events')
        .select('*, franchises(name)')
        .order('event_date', { ascending: true });

      if (error) throw error;
      setEvents(data || []);

      // Fetch paid ticket counts per event
      if (data && data.length > 0) {
        const eventIds = data.map(e => e.id);
        const { data: tickets } = await supabase
          .from('tickets')
          .select('event_id, quantity')
          .in('event_id', eventIds)
          .eq('payment_status', 'approved');

        const counts: Record<string, number> = {};
        tickets?.forEach(t => {
          counts[t.event_id] = (counts[t.event_id] || 0) + t.quantity;
        });
        setTicketsByEvent(counts);
      }
    } catch (error) {
      console.error('Error fetching events:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar os eventos.',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (eventId: string) => {
    try {
      await supabase.from('commission_payouts').delete().eq('event_id', eventId);
      await supabase.from('tickets').delete().eq('event_id', eventId);
      await supabase.from('event_grades').delete().eq('event_id', eventId);
      const { error } = await supabase.from('events').delete().eq('id', eventId);

      if (error) throw error;

      toast({
        title: 'Evento excluído',
        description: 'O evento foi removido com sucesso.'
      });
      fetchEvents();
    } catch (error) {
      console.error('Error deleting event:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível excluir o evento.',
        variant: 'destructive'
      });
    }
  };

  const handleToggleActive = async (event: Event) => {
    try {
      const { error } = await supabase
        .from('events')
        .update({ is_active: !event.is_active })
        .eq('id', event.id);

      if (error) throw error;
      fetchEvents();
    } catch (error) {
      console.error('Error toggling event:', error);
    }
  };

  const handleCloneEvent = (event: Event) => {
    setCloneSourceEvent(event);
    setCloneForm({
      school_name: event.school_name,
      location: event.location,
      event_date: event.event_date,
      event_time: event.event_time.slice(0, 5),
      price: String(event.price),
      total_capacity: String(event.total_capacity),
    });
    setIsCloneOpen(true);
  };

  const handleCloneSubmit = async () => {
    if (!cloneSourceEvent) return;
    if (!cloneForm.event_date || !cloneForm.event_time) {
      toast({ title: 'Erro', description: 'Preencha a data e o horário do novo evento.', variant: 'destructive' });
      return;
    }
    setIsCloneSubmitting(true);
    try {
      const { data: eventGrades } = await supabase
        .from('event_grades')
        .select('grade_id, custom_grade_name')
        .eq('event_id', cloneSourceEvent.id);

      const capacity = Number(cloneForm.total_capacity);
      const { data: newEvent, error } = await supabase
        .from('events')
        .insert({
          franchise_id: cloneSourceEvent.franchise_id,
          school_name: cloneForm.school_name,
          description: cloneSourceEvent.description,
          location: cloneForm.location,
          event_date: cloneForm.event_date,
          event_time: cloneForm.event_time,
          price: Number(cloneForm.price),
          total_capacity: capacity,
          available_spots: capacity,
          is_active: false,
          customer_id: cloneSourceEvent.customer_id,
        })
        .select()
        .single();

      if (error) throw error;

      if (eventGrades && eventGrades.length > 0 && newEvent) {
        const { error: gradeCloneError } = await supabase.from('event_grades').insert(
          eventGrades.map((eg) => ({
            event_id: newEvent.id,
            grade_id: eg.grade_id,
            custom_grade_name: eg.custom_grade_name,
          }))
        );
        if (gradeCloneError) throw gradeCloneError;
      }

      toast({ title: 'Evento clonado', description: 'O evento foi duplicado com sucesso (inativo).' });
      setIsCloneOpen(false);
      fetchEvents();
    } catch (error) {
      console.error('Error cloning event:', error);
      toast({ title: 'Erro', description: 'Não foi possível clonar o evento.', variant: 'destructive' });
    } finally {
      setIsCloneSubmitting(false);
    }
  };

  const shareListViaWhatsApp = (event: Event) => {
    const listUrl = `${window.location.origin}/lista/${event.id}`;
    const purchaseUrl = `${window.location.origin}/comprar/${event.id}`;
    const dateFormatted = format(new Date(event.event_date + 'T00:00:00'), 'dd/MM', { locale: ptBR });
    const message = `Olá! Segue a lista de alunos confirmados para o evento *${event.school_name}* no dia *${dateFormatted}*: ${listUrl}\n\n🎟️ Link de compra: ${purchaseUrl}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  return (
    <div className="p-2 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg md:text-2xl font-bold text-foreground">Eventos</h1>
          <p className="text-muted-foreground">Gerenciar todos os eventos do sistema</p>
        </div>
      </div>

      {/* Events Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
        </div>
      ) : events.length === 0 ? (
        <Card className="p-12 text-center">
          <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-foreground mb-2">Nenhum evento cadastrado</h3>
          <p className="text-muted-foreground">Os eventos criados pelas franquias aparecerão aqui.</p>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {events.map((event) => (
            <Card key={event.id} className="p-4 bg-card border-border">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-foreground">{event.school_name}</h3>
                  <p className="text-xs text-muted-foreground">
                    {event.franchises?.name || 'Franquia'}
                  </p>
                </div>
                <Badge variant={event.is_active ? 'default' : 'secondary'}>
                  {event.is_active ? 'Ativo' : 'Inativo'}
                </Badge>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                   <Calendar className="h-4 w-4" />
                   <span>
                     {format(new Date(event.event_date + 'T00:00:00'), "dd 'de' MMMM", { locale: ptBR })}
                   </span>
                 </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <MapPin className="h-4 w-4" />
                  <span className="truncate">{event.location}</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Ticket className="h-4 w-4" />
                  <span>{ticketsByEvent[event.id] || 0} ingresso{(ticketsByEvent[event.id] || 0) !== 1 ? 's' : ''} pago{(ticketsByEvent[event.id] || 0) !== 1 ? 's' : ''}</span>
                </div>
                <div className="flex items-center gap-2 text-primary font-medium">
                  <DollarSign className="h-4 w-4" />
                  <span>{formatCurrency(Number(event.price))}</span>
                </div>
              </div>

              <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
                <div className="flex items-center gap-1">
                  <Switch
                    checked={event.is_active}
                    onCheckedChange={() => handleToggleActive(event)}
                  />
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" onClick={() => setQrCodeEvent(event)}>
                          <QrCode className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>QR Code de compra</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" onClick={() => setFinancialEvent(event)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Detalhamento financeiro</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" onClick={() => handleCloneEvent(event)}>
                          <Copy className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Clonar evento</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-green-600 hover:text-green-700 hover:bg-green-50"
                          onClick={() => shareListViaWhatsApp(event)}
                        >
                          <Send className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Compartilhar lista via WhatsApp</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Excluir evento?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Esta ação não pode ser desfeita. O evento será permanentemente removido.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={() => handleDelete(event.id)}>
                        Excluir
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Clone Dialog */}
      <Dialog open={isCloneOpen} onOpenChange={setIsCloneOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Clonar Evento</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Escola</Label>
              <Input value={cloneForm.school_name} readOnly className="opacity-70" />
            </div>
            <div className="space-y-2">
              <Label>Local</Label>
              <Input
                value={cloneForm.location}
                onChange={(e) => setCloneForm(prev => ({ ...prev, location: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Data *</Label>
                <Input
                  type="date"
                  value={cloneForm.event_date}
                  onChange={(e) => setCloneForm(prev => ({ ...prev, event_date: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Horário *</Label>
                <Input
                  type="time"
                  value={cloneForm.event_time}
                  onChange={(e) => setCloneForm(prev => ({ ...prev, event_time: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Preço (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={cloneForm.price}
                  onChange={(e) => setCloneForm(prev => ({ ...prev, price: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Capacidade</Label>
                <Input
                  type="number"
                  value={cloneForm.total_capacity}
                  onChange={(e) => setCloneForm(prev => ({ ...prev, total_capacity: e.target.value }))}
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">O evento será criado como <strong>inativo</strong>.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCloneOpen(false)}>Cancelar</Button>
            <Button onClick={handleCloneSubmit} disabled={isCloneSubmitting}>
              {isCloneSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Criar Clone
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* QR Code Dialog */}
      {qrCodeEvent && (
        <EventQRCodeDialog
          open={!!qrCodeEvent}
          onOpenChange={(open) => !open && setQrCodeEvent(null)}
          eventId={qrCodeEvent.id}
          schoolName={qrCodeEvent.school_name}
          eventDate={qrCodeEvent.event_date}
        />
      )}

      {/* Financial Dialog */}
      {financialEvent && (
        <EventFinancialDialog
          open={!!financialEvent}
          onOpenChange={(open) => !open && setFinancialEvent(null)}
          eventId={financialEvent.id}
          schoolName={financialEvent.school_name}
        />
      )}
    </div>
  );
};

export default EventsManagement;
