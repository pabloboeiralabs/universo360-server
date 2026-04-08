import { useState, useEffect } from 'react';
import { Banknote, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

interface EventOption {
  id: string;
  school_name: string;
  event_date: string;
  price: number;
  available_spots: number;
  franchise_id: string;
}

interface CashPaymentDialogProps {
  onSuccess: () => void;
  franchiseId?: string;
}

const CashPaymentDialog = ({ onSuccess, franchiseId }: CashPaymentDialogProps) => {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [events, setEvents] = useState<EventOption[]>([]);
  const [selectedEventId, setSelectedEventId] = useState('');
  
  const [quantity, setQuantity] = useState(0);
  const [amount, setAmount] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingEvents, setIsLoadingEvents] = useState(false);

  const selectedEvent = events.find(e => e.id === selectedEventId);

  useEffect(() => {
    if (open) {
      fetchEvents();
      resetForm();
    }
  }, [open]);

  useEffect(() => {
    if (selectedEvent && quantity > 0) {
      setAmount((selectedEvent.price * quantity).toFixed(2));
      return;
    }

    if (!selectedEvent || quantity <= 0) {
      setAmount('');
    }
  }, [selectedEvent, quantity]);

  const resetForm = () => {
    setSelectedEventId('');
    setQuantity(0);
    setAmount('');
  };

  const fetchEvents = async () => {
    setIsLoadingEvents(true);
    try {
      let query = supabase
        .from('events')
        .select('id, school_name, event_date, price, available_spots, franchise_id')
        .eq('is_active', true)
        .gt('available_spots', 0)
        .order('event_date', { ascending: false });

      if (franchiseId) {
        query = query.eq('franchise_id', franchiseId);
      }

      const { data, error } = await query;

      if (error) throw error;
      setEvents(data || []);
    } catch {
      toast({ title: 'Erro', description: 'Não foi possível carregar os eventos.', variant: 'destructive' });
    } finally {
      setIsLoadingEvents(false);
    }
  };

  const handleSubmit = async () => {
    const parsedAmount = parseFloat(amount);

    if (!selectedEventId || !selectedEvent) {
      toast({ title: 'Erro', description: 'Selecione um evento.', variant: 'destructive' });
      return;
    }
    if (quantity < 1) {
      toast({ title: 'Erro', description: 'Quantidade mínima é 1.', variant: 'destructive' });
      return;
    }
    if (!parsedAmount || parsedAmount <= 0) {
      toast({ title: 'Erro', description: 'Informe um valor válido.', variant: 'destructive' });
      return;
    }
    if (quantity > selectedEvent.available_spots) {
      toast({ title: 'Erro', description: `Apenas ${selectedEvent.available_spots} vagas disponíveis.`, variant: 'destructive' });
      return;
    }

    setIsSubmitting(true);
    try {
      const { data: ticket, error: insertError } = await supabase
        .from('tickets')
        .insert({
          event_id: selectedEventId,
          franchise_id: selectedEvent.franchise_id,
          customer_name: 'Pagamento em Dinheiro',
          customer_email: 'dinheiro@local',
          amount: parsedAmount,
          quantity,
          payment_status: 'approved',
          payment_id: `cash_${Date.now()}`,
        })
        .select('id')
        .single();

      if (insertError) throw insertError;

      await supabase.rpc('decrement_spots', {
        p_ticket_id: ticket.id,
        p_event_id: selectedEventId,
        p_quantity: quantity,
      });

      toast({ title: 'Sucesso', description: 'Pagamento em dinheiro registrado.' });
      setOpen(false);
      onSuccess();
    } catch (err) {
      console.error('Error registering cash payment:', err);
      toast({ title: 'Erro', description: 'Não foi possível registrar o pagamento.', variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Banknote className="h-4 w-4" />
          <span className="hidden sm:inline">Registrar Dinheiro</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Banknote className="h-5 w-5" />
            Registrar Pagamento em Dinheiro
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label>Evento *</Label>
            <Select value={selectedEventId} onValueChange={setSelectedEventId} disabled={isLoadingEvents}>
              <SelectTrigger>
                <SelectValue placeholder={isLoadingEvents ? 'Carregando...' : 'Selecione o evento'} />
              </SelectTrigger>
              <SelectContent>
                {events.map(ev => (
                  <SelectItem key={ev.id} value={ev.id}>
                    {ev.school_name} — {format(new Date(ev.event_date + 'T12:00:00'), 'dd/MM/yyyy')} ({ev.available_spots} vagas)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>


          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Quantidade de ingressos *</Label>
              <Input
                type="number"
                min={1}
                max={selectedEvent?.available_spots || 999}
                value={quantity === 0 ? '' : quantity}
                onChange={e => {
                  const val = e.target.value;
                  setQuantity(val === '' ? 0 : parseInt(val) || 0);
                }}
                onBlur={() => { if (!quantity || quantity < 1) setQuantity(1); }}
                onFocus={e => e.target.select()}
              />
            </div>
            <div className="space-y-2">
              <Label>Valor total (R$) *</Label>
              <Input
                type="number"
                step="0.01"
                min="0.01"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder="0,00"
              />
            </div>
          </div>

          <Button onClick={handleSubmit} disabled={isSubmitting} className="w-full">
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Banknote className="h-4 w-4 mr-2" />}
            Registrar Pagamento
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CashPaymentDialog;
