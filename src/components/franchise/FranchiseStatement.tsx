import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Download, DollarSign, Users, TrendingDown, Wallet, Eye, X, FilterX, SlidersHorizontal } from 'lucide-react';
import CashPaymentDialog from '@/components/admin/CashPaymentDialog';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import MonthSelector from '@/components/admin/MonthSelector';
import YearTimeline from '@/components/admin/YearTimeline';
import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription';
import StudentReport from '@/components/franchise/StudentReport';

interface FranchiseStatementProps {
  franchiseId: string;
  commissionType?: string | null;
  commissionValue?: number | null;
}

interface EventSummary {
  id: string;
  school_name: string;
  event_date: string;
  totalSales: number;
  totalStudents: number;
  ticketCount: number;
  sellerCommission: number;
  presenterCommission: number;
  supervisorCommission: number;
  schoolCommission: number;
  netProfit: number;
  paymentMethodCounts: Record<string, number>;
}

const methodLabels: Record<string, string> = {
  pix: 'PIX',
  credit_card: 'Cartão',
  cash: 'Dinheiro',
  free: 'Gratuito',
  unknown: 'Outro',
};

const methodColors: Record<string, string> = {
  pix: 'border-cyan-500 text-cyan-600',
  credit_card: 'border-violet-500 text-violet-600',
  cash: 'border-green-500 text-green-600',
  free: 'border-gray-400 text-gray-500',
  unknown: 'border-muted-foreground text-muted-foreground',
};

function getPaymentMethod(payment_method?: string | null, payment_id?: string | null): string {
  if (payment_method) return payment_method;
  if (payment_id?.startsWith('cash_')) return 'cash';
  if (payment_id?.startsWith('free_')) return 'free';
  return 'unknown';
}

export const FranchiseStatement = ({ 
  franchiseId
}: FranchiseStatementProps) => {
  const queryClient = useQueryClient();
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth();
  
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [selectedEvent, setSelectedEvent] = useState<{
    id: string;
    name: string;
    date: string;
  } | null>(null);
  const [filterEventId, setFilterEventId] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterPaymentMethod, setFilterPaymentMethod] = useState('all');

  // Realtime subscription for auto-refresh
  useRealtimeSubscription('tickets', [['franchise-statement', franchiseId, selectedYear, selectedMonth]], {
    column: 'franchise_id',
    value: franchiseId
  });

  // Also refresh when event commissions are edited
  useRealtimeSubscription('events', [['franchise-statement', franchiseId, selectedYear, selectedMonth]], {
    column: 'franchise_id',
    value: franchiseId
  });

  // Fetch ALL events for the franchise (for filter dropdown — independent of month/sales)
  const { data: allFranchiseEvents } = useQuery({
    queryKey: ['franchise-all-events', franchiseId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('events')
        .select('id, school_name, event_date')
        .eq('franchise_id', franchiseId)
        .order('event_date', { ascending: false });
      if (error) throw error;
      return data as { id: string; school_name: string; event_date: string }[];
    },
    enabled: !!franchiseId,
  });

  const { data: statementData, isLoading } = useQuery({
    queryKey: ['franchise-statement', franchiseId, selectedYear, selectedMonth],
    queryFn: async () => {
      const startDate = new Date(selectedYear, selectedMonth, 1);
      const endDate = new Date(selectedYear, selectedMonth + 1, 0, 23, 59, 59);

      // Fetch tickets with event info including commission data
      const { data: tickets, error } = await supabase
        .from('tickets')
        .select(`
          id,
          amount,
          quantity,
          payment_status,
          payment_id,
          payment_method,
          created_at,
          event:events(
            id, 
            school_name, 
            event_date,
            seller_commission_pct,
            presenter_commission_pct,
            supervisor_commission_pct,
            school_commission_type,
            school_commission_value
          )
        `)
        .eq('franchise_id', franchiseId)
        .eq('payment_status', 'approved')
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString());

      if (error) throw error;

      // Fetch paid commissions
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

      // Group by event
      const eventMap = new Map<string, EventSummary>();
      
      tickets.forEach((ticket) => {
        const eventData = ticket.event as {
          id: string;
          school_name: string;
          event_date: string;
          seller_commission_pct: number | null;
          presenter_commission_pct: number | null;
          supervisor_commission_pct: number | null;
          school_commission_type: string | null;
          school_commission_value: number | null;
        } | null;

        const eventId = eventData?.id || 'unknown';
        const amount = Number(ticket.amount);
        const quantity = ticket.quantity;
        const pm = getPaymentMethod((ticket as any).payment_method, ticket.payment_id);
        const sellerPct = eventData?.seller_commission_pct ?? 25;
        const presenterPct = eventData?.presenter_commission_pct ?? 20;
        const supervisorPct = eventData?.supervisor_commission_pct ?? 0;
        const schoolType = eventData?.school_commission_type ?? 'percentage';
        const schoolValue = eventData?.school_commission_value ?? 10;

        const schoolComm = schoolType === 'percentage' 
          ? amount * (schoolValue / 100)
          : schoolValue * quantity;

        const remainingAfterSchool = amount - schoolComm;
        const sellerComm = remainingAfterSchool * (sellerPct / 100);
        const presenterComm = remainingAfterSchool * (presenterPct / 100);
        const supervisorComm = remainingAfterSchool * (supervisorPct / 100);
        const net = remainingAfterSchool - sellerComm - presenterComm - supervisorComm;

        const existing = eventMap.get(eventId);
        
        if (existing) {
          existing.totalSales += amount;
          existing.totalStudents += quantity;
          existing.ticketCount += 1;
          existing.sellerCommission += sellerComm;
          existing.presenterCommission += presenterComm;
          existing.supervisorCommission += supervisorComm;
          existing.schoolCommission += schoolComm;
          existing.netProfit += net;
          existing.paymentMethodCounts[pm] = (existing.paymentMethodCounts[pm] || 0) + 1;
        } else {
          eventMap.set(eventId, {
            id: eventId,
            school_name: eventData?.school_name || 'Evento desconhecido',
            event_date: eventData?.event_date || '',
            totalSales: amount,
            totalStudents: quantity,
            ticketCount: 1,
            sellerCommission: sellerComm,
            presenterCommission: presenterComm,
            supervisorCommission: supervisorComm,
            schoolCommission: schoolComm,
            netProfit: net,
            paymentMethodCounts: { [pm]: 1 },
          });
        }
      });

      const events = Array.from(eventMap.values()).sort((a, b) => 
        new Date(b.event_date).getTime() - new Date(a.event_date).getTime()
      );

      return { events, paidByType };
    },
    enabled: !!franchiseId,
  });

  const rawEventsList = statementData?.events;
  const paidByType = statementData?.paidByType ?? { seller: 0, presenter: 0, supervisor: 0, school: 0 };

  // Apply all filters combined (sequential — any combination works)
  const eventsList = useMemo(() => {
    if (!rawEventsList) return undefined;

    return rawEventsList
      .filter(e => filterEventId === 'all' || e.id === filterEventId)
      .filter(e => {
        if (filterStatus === 'with_sales') return e.totalStudents > 0;
        if (filterStatus === 'no_sales') return e.totalStudents === 0;
        return true;
      })
      .filter(e => filterPaymentMethod === 'all' || (e.paymentMethodCounts[filterPaymentMethod] || 0) > 0);
  }, [rawEventsList, filterEventId, filterStatus, filterPaymentMethod]);

  // Active filter chips
  const activeFilters = useMemo(() => {
    const chips: { key: string; label: string; onRemove: () => void }[] = [];
    if (filterEventId !== 'all') {
      const ev = rawEventsList?.find(e => e.id === filterEventId);
      chips.push({ key: 'event', label: `Evento: ${ev?.school_name ?? filterEventId}`, onRemove: () => setFilterEventId('all') });
    }
    if (filterStatus !== 'all') {
      const label = filterStatus === 'with_sales' ? 'Com vendas' : 'Sem vendas';
      chips.push({ key: 'status', label: `Status: ${label}`, onRemove: () => setFilterStatus('all') });
    }
    if (filterPaymentMethod !== 'all') {
      chips.push({ key: 'payment', label: `Pagamento: ${methodLabels[filterPaymentMethod] ?? filterPaymentMethod}`, onRemove: () => setFilterPaymentMethod('all') });
    }
    return chips;
  }, [filterEventId, filterStatus, filterPaymentMethod, rawEventsList]);

  const clearAllFilters = () => {
    setFilterEventId('all');
    setFilterStatus('all');
    setFilterPaymentMethod('all');
  };

  const totals = useMemo(() => {
    if (!eventsList) return { 
      totalSales: 0, 
      totalStudents: 0, 
      totalEvents: 0,
      sellerCommission: 0,
      presenterCommission: 0,
      supervisorCommission: 0,
      schoolCommission: 0,
      netProfit: 0,
    };
    
    return {
      totalSales: eventsList.reduce((acc, e) => acc + e.totalSales, 0),
      totalStudents: eventsList.reduce((acc, e) => acc + e.totalStudents, 0),
      totalEvents: eventsList.length,
      sellerCommission: eventsList.reduce((acc, e) => acc + e.sellerCommission, 0),
      presenterCommission: eventsList.reduce((acc, e) => acc + e.presenterCommission, 0),
      supervisorCommission: eventsList.reduce((acc, e) => acc + e.supervisorCommission, 0),
      schoolCommission: eventsList.reduce((acc, e) => acc + e.schoolCommission, 0),
      netProfit: eventsList.reduce((acc, e) => acc + e.netProfit, 0),
    };
  }, [eventsList]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const handleExport = () => {
    if (!eventsList) return;

    const headers = [
      'Escola',
      'Data do Evento',
      'Vendas',
      'Alunos',
      'Receita Bruta',
      'Vendedor',
      'Apresentador',
      'Supervisor',
      'Escola',
      'Lucro Líquido'
    ].join(',');

    const rows = eventsList.map(e => [
      `"${e.school_name}"`,
      e.event_date ? format(new Date(e.event_date), 'dd/MM/yyyy') : '-',
      e.ticketCount,
      e.totalStudents,
      e.totalSales.toFixed(2),
      e.sellerCommission.toFixed(2),
      e.presenterCommission.toFixed(2),
      e.supervisorCommission.toFixed(2),
      e.schoolCommission.toFixed(2),
      e.netProfit.toFixed(2)
    ].join(','));

    // Add totals row
    rows.push('');
    rows.push([
      '"TOTAL"',
      '',
      eventsList.reduce((acc, e) => acc + e.ticketCount, 0),
      totals.totalStudents,
      totals.totalSales.toFixed(2),
      totals.sellerCommission.toFixed(2),
      totals.presenterCommission.toFixed(2),
      totals.supervisorCommission.toFixed(2),
      totals.schoolCommission.toFixed(2),
      totals.netProfit.toFixed(2)
    ].join(','));

    const csv = [headers, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `extrato_${selectedMonth}_${selectedYear}.csv`);
    link.click();
  };

  const totalCommissions = totals.sellerCommission + totals.presenterCommission + totals.supervisorCommission + totals.schoolCommission;

  return (
    <div className="space-y-6">
      {/* Header Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-3 md:pt-6">
            <div className="flex items-center gap-2 md:gap-3">
              <div className="p-2 bg-blue-500/10 rounded-lg">
                <DollarSign className="h-4 w-4 md:h-5 md:w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-xs md:text-sm text-foreground">Receita Bruta</p>
                <p className="text-sm md:text-2xl font-bold truncate">{formatCurrency(totals.totalSales)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-3 md:pt-6">
            <div className="flex items-center gap-2 md:gap-3">
              <div className="p-2 bg-red-500/10 rounded-lg">
                <TrendingDown className="h-4 w-4 md:h-5 md:w-5 text-red-500" />
              </div>
              <div>
                <p className="text-xs md:text-sm text-foreground">Total Comissões</p>
                <p className="text-sm md:text-2xl font-bold text-destructive truncate">{formatCurrency(totalCommissions)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="pt-3 md:pt-6">
            <div className="flex items-center gap-2 md:gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Wallet className="h-4 w-4 md:h-5 md:w-5 text-primary" />
              </div>
              <div>
                <p className="text-xs md:text-sm text-foreground">Lucro Líquido</p>
                <p className="text-sm md:text-2xl font-bold text-primary truncate">{formatCurrency(totals.netProfit)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-3 md:pt-6">
            <div className="flex items-center gap-2 md:gap-3">
              <div className="p-2 bg-purple-500/10 rounded-lg">
                <Users className="h-4 w-4 md:h-5 md:w-5 text-purple-500" />
              </div>
              <div>
                <p className="text-xs md:text-sm text-foreground">Total de Alunos</p>
                <p className="text-sm md:text-2xl font-bold">{totals.totalStudents}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Card>
        <CardHeader className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between pb-3">
          <div>
            <CardTitle>Extrato de Vendas</CardTitle>
            <CardDescription className="text-foreground">
              Detalhamento das vendas por evento no período selecionado
            </CardDescription>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <CashPaymentDialog 
              franchiseId={franchiseId} 
              onSuccess={() => {
                queryClient.invalidateQueries({ queryKey: ['franchise-statement', franchiseId] });
              }} 
            />
            <Button variant="outline" size="sm" onClick={handleExport} disabled={!eventsList?.length}>
              <Download className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Exportar CSV</span>
              <span className="sm:hidden">CSV</span>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Year and Month */}
          <div className="space-y-4">
            <YearTimeline 
              selectedYear={selectedYear} 
              onYearChange={setSelectedYear} 
            />
            <MonthSelector 
              selectedMonth={selectedMonth}
              selectedYear={selectedYear}
              onMonthChange={setSelectedMonth} 
            />
          </div>

          {/* Filters — always visible */}
          <div className="rounded-lg border bg-muted/20 p-3 space-y-3">
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Filtros</span>
              {activeFilters.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearAllFilters}
                  className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground ml-auto"
                >
                  <FilterX className="h-3 w-3 mr-1" />
                  Limpar tudo
                </Button>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <Select value={filterEventId} onValueChange={setFilterEventId}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos os eventos" />
                </SelectTrigger>
                <SelectContent position="item-aligned">
                  <SelectItem value="all">Todos os eventos</SelectItem>
                  {allFranchiseEvents?.map(e => (
                    <SelectItem key={e.id} value={e.id}>{e.school_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="Status de vendas" />
                </SelectTrigger>
                <SelectContent position="item-aligned">
                  <SelectItem value="all">Todos os status</SelectItem>
                  <SelectItem value="with_sales">Com vendas</SelectItem>
                  <SelectItem value="no_sales">Sem vendas</SelectItem>
                </SelectContent>
              </Select>

              <Select value={filterPaymentMethod} onValueChange={setFilterPaymentMethod}>
                <SelectTrigger>
                  <SelectValue placeholder="Forma de pagamento" />
                </SelectTrigger>
                <SelectContent position="item-aligned">
                  <SelectItem value="all">Todos os pagamentos</SelectItem>
                  <SelectItem value="pix">PIX</SelectItem>
                  <SelectItem value="credit_card">Cartão</SelectItem>
                  <SelectItem value="cash">Dinheiro</SelectItem>
                  <SelectItem value="free">Gratuito</SelectItem>
                  <SelectItem value="unknown">Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {activeFilters.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {activeFilters.map(chip => (
                  <Badge
                    key={chip.key}
                    variant="secondary"
                    className="flex items-center gap-1 pr-1 text-xs"
                  >
                    <span className="max-w-[160px] truncate">{chip.label}</span>
                    <button
                      onClick={chip.onRemove}
                      className="ml-0.5 rounded-full hover:bg-muted p-0.5"
                      aria-label={`Remover filtro ${chip.label}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
            <p className="text-xs text-muted-foreground">{eventsList?.length ?? 0} evento(s) encontrado(s)</p>
          </div>

          {/* Filtered Summary — below filters */}
          {eventsList && eventsList.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 rounded-lg border bg-muted/30 p-3">
              <div className="flex flex-col">
                <span className="text-xs text-muted-foreground">Bruto</span>
                <span className="text-sm font-bold text-foreground">{formatCurrency(totals.totalSales)}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-xs text-muted-foreground">Comissões</span>
                <span className="text-sm font-bold text-destructive">-{formatCurrency(totalCommissions)}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-xs text-muted-foreground">Líquido</span>
                <span className="text-sm font-bold text-primary">{formatCurrency(totals.netProfit)}</span>
                {totals.totalSales > 0 && (
                  <span className="text-xs text-muted-foreground">{((totals.netProfit / totals.totalSales) * 100).toFixed(1)}% do bruto</span>
                )}
              </div>
              <div className="flex flex-col">
                <span className="text-xs text-muted-foreground">Alunos</span>
                <span className="text-sm font-bold text-foreground">{totals.totalStudents}</span>
              </div>
            </div>
          )}

          {/* Table */}
          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
            </div>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Escola / Evento</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead className="text-center">Alunos</TableHead>
                    <TableHead className="text-right">Bruto</TableHead>
                    <TableHead className="text-right">Comissões</TableHead>
                    <TableHead className="text-right">Líquido</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {eventsList?.map((event) => (
                    <TableRow key={event.id}>
                      <TableCell className="font-medium text-xs md:text-sm">
                        {event.school_name}
                        <div className="flex flex-wrap gap-1 mt-1">
                          {Object.entries(event.paymentMethodCounts).map(([method, count]) => (
                            <Badge key={method} variant="outline" className={`text-[10px] px-1.5 py-0 ${methodColors[method] || ''}`}>
                              {methodLabels[method] || method}: {count}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs md:text-sm">
                        {event.event_date 
                          ? format(new Date(event.event_date), 'dd/MM/yyyy', { locale: ptBR })
                          : '-'
                        }
                      </TableCell>
                      <TableCell className="text-center text-xs md:text-sm">{event.totalStudents}</TableCell>
                      <TableCell className="text-right text-xs md:text-sm">{formatCurrency(event.totalSales)}</TableCell>
                      <TableCell className="text-right text-xs md:text-sm text-destructive">
                        -{formatCurrency(event.sellerCommission + event.presenterCommission + event.supervisorCommission + event.schoolCommission)}
                      </TableCell>
                      <TableCell className="text-right font-medium text-xs md:text-sm text-primary">
                        {formatCurrency(event.netProfit)}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedEvent({
                            id: event.id,
                            name: event.school_name,
                            date: event.event_date
                          })}
                          title="Ver detalhes dos alunos"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {(!eventsList || eventsList.length === 0) && (
                    <TableRow>
                       <TableCell colSpan={7} className="text-center py-8 text-foreground">
                        Nenhuma venda encontrada para o período selecionado
                      </TableCell>
                    </TableRow>
                  )}
                  {eventsList && eventsList.length > 0 && (
                     <TableRow className="bg-muted/50 font-medium">
                      <TableCell colSpan={2} className="text-xs md:text-sm">TOTAL</TableCell>
                      <TableCell className="text-center text-xs md:text-sm">{totals.totalStudents}</TableCell>
                      <TableCell className="text-right text-xs md:text-sm">{formatCurrency(totals.totalSales)}</TableCell>
                      <TableCell className="text-right text-xs md:text-sm text-destructive">-{formatCurrency(totalCommissions)}</TableCell>
                      <TableCell className="text-right font-bold text-xs md:text-sm text-primary">{formatCurrency(totals.netProfit)}</TableCell>
                      <TableCell></TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Student Report Modal */}
      {selectedEvent && (
        <StudentReport
          eventId={selectedEvent.id}
          eventName={selectedEvent.name}
          eventDate={selectedEvent.date}
          isOpen={!!selectedEvent}
          onClose={() => setSelectedEvent(null)}
        />
      )}
    </div>
  );
};

export default FranchiseStatement;