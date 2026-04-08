import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2 } from 'lucide-react';

interface EventFinancialDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventId: string;
  schoolName: string;
}

interface FinancialData {
  grossRevenue: number;
  categories: {
    label: string;
    due: number;
    paid: number;
    pending: number;
  }[];
  totalCommissions: number;
  totalPaid: number;
  totalPending: number;
  netProfit: number;
}

const EventFinancialDialog = ({ open, onOpenChange, eventId, schoolName }: EventFinancialDialogProps) => {
  const [isLoading, setIsLoading] = useState(true);
  const [data, setData] = useState<FinancialData | null>(null);

  useEffect(() => {
    if (open && eventId) {
      fetchFinancials();
    }
  }, [open, eventId]);

  const fetchFinancials = async () => {
    setIsLoading(true);
    try {
      const [eventRes, ticketsRes, payoutsRes] = await Promise.all([
        supabase
          .from('events')
          .select('seller_commission_pct, presenter_commission_pct, supervisor_commission_pct, school_commission_type, school_commission_value, price')
          .eq('id', eventId)
          .single(),
        supabase
          .from('tickets')
          .select('amount, quantity')
          .eq('event_id', eventId)
          .eq('payment_status', 'approved'),
        supabase
          .from('commission_payouts')
          .select('payout_type, amount, is_paid')
          .eq('event_id', eventId),
      ]);

      const event = eventRes.data;
      const tickets = ticketsRes.data || [];
      const payouts = payoutsRes.data || [];

      if (!event) {
        setData(null);
        return;
      }

      const grossRevenue = tickets.reduce((sum, t) => sum + Number(t.amount), 0);
      const totalStudents = tickets.reduce((sum, t) => sum + t.quantity, 0);

      // Calculate school commission
      let schoolDue = 0;
      if (event.school_commission_type === 'fixed') {
        schoolDue = (event.school_commission_value || 0) * totalStudents;
      } else {
        schoolDue = grossRevenue * ((event.school_commission_value || 0) / 100);
      }

      // Base for other commissions = gross - school
      const base = grossRevenue - schoolDue;

      const sellerDue = base * ((event.seller_commission_pct || 0) / 100);
      const presenterDue = base * ((event.presenter_commission_pct || 0) / 100);
      const supervisorDue = base * ((event.supervisor_commission_pct || 0) / 100);

      const paidByType = (type: string) =>
        payouts.filter(p => p.payout_type === type && p.is_paid).reduce((s, p) => s + Number(p.amount), 0);

      const categories = [
        { label: 'Vendedor', due: sellerDue, paid: paidByType('seller'), pending: 0 },
        { label: 'Apresentador', due: presenterDue, paid: paidByType('presenter'), pending: 0 },
        { label: 'Supervisor', due: supervisorDue, paid: paidByType('supervisor'), pending: 0 },
        { label: 'Escola', due: schoolDue, paid: paidByType('school'), pending: 0 },
      ].map(c => ({ ...c, pending: Math.max(c.due - c.paid, 0) }));

      const totalCommissions = categories.reduce((s, c) => s + c.due, 0);
      const totalPaid = categories.reduce((s, c) => s + c.paid, 0);
      const totalPending = categories.reduce((s, c) => s + c.pending, 0);

      setData({
        grossRevenue,
        categories,
        totalCommissions,
        totalPaid,
        totalPending,
        netProfit: grossRevenue - totalCommissions,
      });
    } catch (error) {
      console.error('Error fetching financials:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fmt = (v: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Comissões - {schoolName}</DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : !data ? (
          <p className="text-sm text-muted-foreground text-center py-4">Sem dados disponíveis.</p>
        ) : (
          <div className="space-y-4">
            {/* Category cards */}
            <div className="grid grid-cols-2 gap-3">
              {data.categories.map((cat) => (
                <Card key={cat.label} className="p-3 space-y-1">
                  <p className="text-xs font-semibold text-muted-foreground">{cat.label}</p>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-destructive">Devido</span>
                    <span className="font-medium">{fmt(cat.due)}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-green-600">Pago</span>
                    <span className="font-medium">{fmt(cat.paid)}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-yellow-600">Pendente</span>
                    <span className="font-medium">{fmt(cat.pending)}</span>
                  </div>
                </Card>
              ))}
            </div>

            {/* Summary */}
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

export default EventFinancialDialog;
