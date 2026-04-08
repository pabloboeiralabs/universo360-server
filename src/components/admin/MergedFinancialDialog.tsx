import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, DollarSign } from 'lucide-react';

interface EventData {
  id: string;
  school_name: string;
  seller_commission_pct: number;
  presenter_commission_pct: number;
  supervisor_commission_pct: number;
  school_commission_type: string;
  school_commission_value: number;
  price: number;
}

interface MergedFinancialDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventIds: string[];
  events: EventData[];
}

interface CategoryData {
  label: string;
  due: number;
  paid: number;
  pending: number;
}

const MergedFinancialDialog = ({ open, onOpenChange, eventIds, events }: MergedFinancialDialogProps) => {
  const [isLoading, setIsLoading] = useState(true);
  const [data, setData] = useState<{
    grossRevenue: number;
    categories: CategoryData[];
    totalCommissions: number;
    totalPaid: number;
    totalPending: number;
    netProfit: number;
  } | null>(null);

  useEffect(() => {
    if (open && eventIds.length > 0) {
      fetchMergedFinancials();
    }
  }, [open, eventIds]);

  const fetchMergedFinancials = async () => {
    setIsLoading(true);
    try {
      const [ticketsRes, payoutsRes] = await Promise.all([
        supabase
          .from('tickets')
          .select('event_id, amount, quantity')
          .in('event_id', eventIds)
          .eq('payment_status', 'approved'),
        supabase
          .from('commission_payouts')
          .select('event_id, payout_type, amount, is_paid')
          .in('event_id', eventIds),
      ]);

      const tickets = ticketsRes.data || [];
      const payouts = payoutsRes.data || [];

      // Group tickets by event
      const ticketsByEvent: Record<string, { totalAmount: number; totalQty: number }> = {};
      tickets.forEach(t => {
        if (!ticketsByEvent[t.event_id]) ticketsByEvent[t.event_id] = { totalAmount: 0, totalQty: 0 };
        ticketsByEvent[t.event_id].totalAmount += Number(t.amount);
        ticketsByEvent[t.event_id].totalQty += t.quantity;
      });

      // Group payouts by type
      const paidByType: Record<string, number> = {};
      payouts.forEach(p => {
        if (p.is_paid) {
          paidByType[p.payout_type] = (paidByType[p.payout_type] || 0) + Number(p.amount);
        }
      });

      // Calculate commissions per event then aggregate
      let totalGross = 0;
      let totalSellerDue = 0;
      let totalPresenterDue = 0;
      let totalSupervisorDue = 0;
      let totalSchoolDue = 0;

      events.filter(e => eventIds.includes(e.id)).forEach(event => {
        const eventTickets = ticketsByEvent[event.id] || { totalAmount: 0, totalQty: 0 };
        const gross = eventTickets.totalAmount;
        totalGross += gross;

        // School commission
        let schoolDue = 0;
        if (event.school_commission_type === 'fixed') {
          schoolDue = (event.school_commission_value || 0) * eventTickets.totalQty;
        } else {
          schoolDue = gross * ((event.school_commission_value || 0) / 100);
        }
        totalSchoolDue += schoolDue;

        const base = gross - schoolDue;
        totalSellerDue += base * ((event.seller_commission_pct || 0) / 100);
        totalPresenterDue += base * ((event.presenter_commission_pct || 0) / 100);
        totalSupervisorDue += base * ((event.supervisor_commission_pct || 0) / 100);
      });

      const categories: CategoryData[] = [
        { label: 'Vendedor', due: totalSellerDue, paid: paidByType['seller'] || 0, pending: 0 },
        { label: 'Apresentador', due: totalPresenterDue, paid: paidByType['presenter'] || 0, pending: 0 },
        { label: 'Supervisor', due: totalSupervisorDue, paid: paidByType['supervisor'] || 0, pending: 0 },
        { label: 'Escola', due: totalSchoolDue, paid: paidByType['school'] || 0, pending: 0 },
      ].map(c => ({ ...c, pending: Math.max(c.due - c.paid, 0) }));

      const totalCommissions = categories.reduce((s, c) => s + c.due, 0);
      const totalPaid = categories.reduce((s, c) => s + c.paid, 0);
      const totalPending = categories.reduce((s, c) => s + c.pending, 0);

      setData({
        grossRevenue: totalGross,
        categories,
        totalCommissions,
        totalPaid,
        totalPending,
        netProfit: totalGross - totalCommissions,
      });
    } catch (error) {
      console.error('Error fetching merged financials:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fmt = (v: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

  const selectedEvents = events.filter(e => eventIds.includes(e.id));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Financeiro Consolidado ({eventIds.length} eventos)
          </DialogTitle>
        </DialogHeader>

        {/* List selected schools */}
        <div className="flex flex-wrap gap-1">
          {selectedEvents.map(e => (
            <Badge key={e.id} variant="outline" className="text-xs">
              {e.school_name}
            </Badge>
          ))}
        </div>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : !data ? (
          <p className="text-sm text-muted-foreground text-center py-4">Sem dados disponíveis.</p>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              {data.categories.map((cat) => (
                <Card key={cat.label} className="p-3 space-y-1">
                  <p className="text-xs font-semibold text-muted-foreground">{cat.label}</p>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-destructive">Devido</span>
                    <span className="font-medium">{fmt(cat.due)}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-green-600 dark:text-green-400">Pago</span>
                    <span className="font-medium">{fmt(cat.paid)}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-yellow-600 dark:text-yellow-400">Pendente</span>
                    <span className="font-medium">{fmt(cat.pending)}</span>
                  </div>
                </Card>
              ))}
            </div>

            <Card className="p-4 space-y-2 bg-muted/50">
              <p className="text-sm font-semibold">Resumo Geral</p>
              <div className="flex justify-between text-sm">
                <span>Receita Bruta</span>
                <span className="font-semibold">{fmt(data.grossRevenue)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Total Comissões</span>
                <span className="font-semibold text-destructive">{fmt(data.totalCommissions)}</span>
              </div>
              <div className="flex justify-between text-sm border-t pt-2">
                <span className="font-semibold">Lucro Líquido</span>
                <Badge variant="default" className="text-sm">{fmt(data.netProfit)}</Badge>
              </div>
            </Card>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default MergedFinancialDialog;
