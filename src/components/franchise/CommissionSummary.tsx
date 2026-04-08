import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import MonthSelector from '@/components/admin/MonthSelector';
import YearTimeline from '@/components/admin/YearTimeline';
import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription';

interface CommissionSummaryProps {
  franchiseId: string;
}

interface EventCommission {
  id: string;
  school_name: string;
  event_date: string;
  totalSales: number;
  totalStudents: number;
  sellerCommission: number;
  presenterCommission: number;
  supervisorCommission: number;
  schoolCommission: number;
}

const categoryFieldMap: Record<string, keyof EventCommission> = {
  'Vendedores': 'sellerCommission',
  'Apresentadores': 'presenterCommission',
  'Supervisores': 'supervisorCommission',
  'Escolas': 'schoolCommission',
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

const CommissionSummary = ({ franchiseId }: CommissionSummaryProps) => {
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth();

  const [isOpen, setIsOpen] = useState(false);
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);

  useRealtimeSubscription('tickets', [['commission-summary', franchiseId, selectedYear, selectedMonth]], {
    column: 'franchise_id',
    value: franchiseId,
  });

  const { data } = useQuery({
    queryKey: ['commission-summary', franchiseId, selectedYear, selectedMonth],
    queryFn: async () => {
      const startDate = new Date(selectedYear, selectedMonth, 1);
      const endDate = new Date(selectedYear, selectedMonth + 1, 0, 23, 59, 59);

      const { data: tickets, error } = await supabase
        .from('tickets')
        .select(`
          id, amount, quantity, payment_status,
          event:events(
            id, school_name, event_date,
            seller_commission_pct, presenter_commission_pct,
            supervisor_commission_pct, school_commission_type, school_commission_value
          )
        `)
        .eq('franchise_id', franchiseId)
        .eq('payment_status', 'approved')
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString());

      if (error) throw error;

      const { data: paidData } = await supabase
        .from('commission_payouts')
        .select('payout_type, amount')
        .eq('franchise_id', franchiseId)
        .eq('is_paid', true)
        .gte('period_start', startDate.toISOString())
        .lte('period_end', endDate.toISOString());

      const paidByType = { seller: 0, presenter: 0, supervisor: 0, school: 0 };
      paidData?.forEach((p) => {
        const key = p.payout_type as keyof typeof paidByType;
        if (key in paidByType) paidByType[key] += Number(p.amount);
      });

      const eventMap = new Map<string, EventCommission>();

      tickets.forEach((ticket) => {
        const ev = ticket.event as any;
        const eventId = ev?.id || 'unknown';
        const amount = Number(ticket.amount);
        const quantity = ticket.quantity;

        const schoolType = ev?.school_commission_type ?? 'percentage';
        const schoolValue = ev?.school_commission_value ?? 10;
        const schoolComm = schoolType === 'percentage'
          ? amount * (schoolValue / 100)
          : schoolValue * quantity;

        const remaining = amount - schoolComm;
        const sellerComm = remaining * ((ev?.seller_commission_pct ?? 25) / 100);
        const presenterComm = remaining * ((ev?.presenter_commission_pct ?? 20) / 100);
        const supervisorComm = remaining * ((ev?.supervisor_commission_pct ?? 0) / 100);

        const existing = eventMap.get(eventId);
        if (existing) {
          existing.totalSales += amount;
          existing.totalStudents += quantity;
          existing.sellerCommission += sellerComm;
          existing.presenterCommission += presenterComm;
          existing.supervisorCommission += supervisorComm;
          existing.schoolCommission += schoolComm;
        } else {
          eventMap.set(eventId, {
            id: eventId,
            school_name: ev?.school_name || 'Evento desconhecido',
            event_date: ev?.event_date || '',
            totalSales: amount,
            totalStudents: quantity,
            sellerCommission: sellerComm,
            presenterCommission: presenterComm,
            supervisorCommission: supervisorComm,
            schoolCommission: schoolComm,
          });
        }
      });

      return {
        events: Array.from(eventMap.values()).sort((a, b) =>
          new Date(b.event_date).getTime() - new Date(a.event_date).getTime()
        ),
        paidByType,
      };
    },
    enabled: !!franchiseId,
  });

  const events = data?.events || [];
  const paidByType = data?.paidByType ?? { seller: 0, presenter: 0, supervisor: 0, school: 0 };

  const totals = useMemo(() => ({
    totalSales: events.reduce((a, e) => a + e.totalSales, 0),
    totalStudents: events.reduce((a, e) => a + e.totalStudents, 0),
    seller: events.reduce((a, e) => a + e.sellerCommission, 0),
    presenter: events.reduce((a, e) => a + e.presenterCommission, 0),
    supervisor: events.reduce((a, e) => a + e.supervisorCommission, 0),
    school: events.reduce((a, e) => a + e.schoolCommission, 0),
  }), [events]);

  const totalCommissions = totals.seller + totals.presenter + totals.supervisor + totals.school;
  const totalPaid = paidByType.seller + paidByType.presenter + paidByType.supervisor + paidByType.school;
  const totalPending = totalCommissions - totalPaid;

  const categories = [
    { label: 'Vendedores', due: totals.seller, paid: paidByType.seller },
    { label: 'Apresentadores', due: totals.presenter, paid: paidByType.presenter },
    { label: 'Supervisores', due: totals.supervisor, paid: paidByType.supervisor },
    { label: 'Escolas', due: totals.school, paid: paidByType.school },
  ];

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Detalhamento das Comissões</CardTitle>
              {isOpen ? <ChevronUp className="h-5 w-5 text-muted-foreground" /> : <ChevronDown className="h-5 w-5 text-muted-foreground" />}
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="space-y-4">
            <YearTimeline selectedYear={selectedYear} onYearChange={setSelectedYear} />
            <MonthSelector selectedMonth={selectedMonth} selectedYear={selectedYear} onMonthChange={setSelectedMonth} />

            {events.length > 0 ? (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
                  {categories.map((cat) => {
                    const pending = cat.due - cat.paid;
                    const isExpanded = expandedCategory === cat.label;
                    return (
                      <button
                        key={cat.label}
                        type="button"
                        onClick={() => setExpandedCategory(prev => prev === cat.label ? null : cat.label)}
                        className={`p-3 rounded-lg bg-muted/50 space-y-1.5 text-left transition-all hover:bg-muted/80 hover:ring-1 hover:ring-primary/30 cursor-pointer ${isExpanded ? 'ring-2 ring-primary/50 bg-muted/70' : ''}`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs md:text-sm font-medium text-foreground">{cat.label}</span>
                          {isExpanded ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
                        </div>
                        <div className="flex justify-between text-xs md:text-sm">
                          <span className="text-muted-foreground">Devido</span>
                          <span className="font-semibold text-destructive">-{formatCurrency(cat.due)}</span>
                        </div>
                        <div className="flex justify-between text-xs md:text-sm">
                          <span className="text-muted-foreground">Pago</span>
                          <span className="font-semibold text-green-600">{formatCurrency(cat.paid)}</span>
                        </div>
                        <div className="flex justify-between text-xs md:text-sm">
                          <span className="text-muted-foreground">Pendente</span>
                          <span className="font-semibold text-yellow-600">{formatCurrency(pending)}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {expandedCategory && (
                  <div className="mt-4 rounded-md border overflow-x-auto">
                    <div className="p-3 border-b bg-muted/30">
                      <span className="text-sm font-semibold">Detalhamento: {expandedCategory}</span>
                    </div>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Escola / Evento</TableHead>
                          <TableHead>Data</TableHead>
                          <TableHead className="text-center">Alunos</TableHead>
                          <TableHead className="text-right">Receita Bruta</TableHead>
                          <TableHead className="text-right">Comissão {expandedCategory}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {events.map((event) => {
                          const field = categoryFieldMap[expandedCategory!];
                          const commValue = field ? (event[field] as number) : 0;
                          return (
                            <TableRow key={event.id}>
                              <TableCell className="font-medium text-xs md:text-sm">{event.school_name}</TableCell>
                              <TableCell className="text-xs md:text-sm">
                                {event.event_date ? format(new Date(event.event_date), 'dd/MM/yyyy', { locale: ptBR }) : '-'}
                              </TableCell>
                              <TableCell className="text-center text-xs md:text-sm">{event.totalStudents}</TableCell>
                              <TableCell className="text-right text-xs md:text-sm">{formatCurrency(event.totalSales)}</TableCell>
                              <TableCell className="text-right text-xs md:text-sm text-destructive">-{formatCurrency(commValue)}</TableCell>
                            </TableRow>
                          );
                        })}
                        <TableRow className="bg-muted/50 font-medium">
                          <TableCell colSpan={2} className="text-xs md:text-sm">TOTAL</TableCell>
                          <TableCell className="text-center text-xs md:text-sm">{totals.totalStudents}</TableCell>
                          <TableCell className="text-right text-xs md:text-sm">{formatCurrency(totals.totalSales)}</TableCell>
                          <TableCell className="text-right text-xs md:text-sm text-destructive">
                            -{formatCurrency(events.reduce((acc, e) => acc + (e[categoryFieldMap[expandedCategory!]] as number), 0))}
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                )}

                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 p-3 rounded-lg bg-muted/30 border">
                  <span className="text-xs md:text-sm font-semibold">Resumo Geral</span>
                  <div className="flex flex-wrap gap-4 text-xs md:text-sm">
                    <span>Devido: <strong className="text-destructive">-{formatCurrency(totalCommissions)}</strong></span>
                    <span>Pago: <strong className="text-green-600">{formatCurrency(totalPaid)}</strong></span>
                    <span>Pendente: <strong className="text-yellow-600">{formatCurrency(totalPending)}</strong></span>
                  </div>
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhuma comissão no período selecionado.</p>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
};

export default CommissionSummary;
