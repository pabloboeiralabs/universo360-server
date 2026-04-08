import { useState, useEffect, useMemo } from 'react';
import { Clock, DollarSign, FileText, FileSpreadsheet, TrendingDown, Wallet, Users, CreditCard, SlidersHorizontal, X, FilterX } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import YearTimeline from './YearTimeline';
import MonthSelector from './MonthSelector';
import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription';
import CashPaymentDialog from './CashPaymentDialog';

interface CashFlowEntry {
  id: string;
  type: 'income';
  description: string;
  amount: number;
  quantity: number;
  date: string;
  franchise_name: string;
  seller_name: string;
  sellerCommission: number;
  presenterCommission: number;
  supervisorCommission: number;
  schoolCommission: number;
  netProfit: number;
  paymentId: string | null;
  paymentMethod: string;
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

interface FinancialSummary {
  gross: number;
  sellerCommission: number;
  presenterCommission: number;
  supervisorCommission: number;
  schoolCommission: number;
  netProfit: number;
  totalStudents: number;
  sellerPaid: number;
  presenterPaid: number;
  supervisorPaid: number;
  schoolPaid: number;
}

const CashFlow = () => {
  const { toast } = useToast();
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [entries, setEntries] = useState<CashFlowEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterPaymentMethod, setFilterPaymentMethod] = useState('all');
  const [filterFranchise, setFilterFranchise] = useState('all');
  const [filterSchool, setFilterSchool] = useState('all');
  const [filterSeller, setFilterSeller] = useState('all');
  const [summary, setSummary] = useState<FinancialSummary>({ 
    gross: 0, 
    sellerCommission: 0, 
    presenterCommission: 0, 
    supervisorCommission: 0,
    schoolCommission: 0,
    netProfit: 0,
    totalStudents: 0,
    sellerPaid: 0,
    presenterPaid: 0,
    supervisorPaid: 0,
    schoolPaid: 0,
  });

  // Realtime subscription for auto-refresh
  useRealtimeSubscription('tickets', [['cashflow', selectedYear, selectedMonth]]);

  const months = [
    'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
    'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'
  ];

  useEffect(() => {
    fetchCashFlow();
  }, [selectedYear, selectedMonth]);

  const fetchCashFlow = async () => {
    setIsLoading(true);
    try {
      const startDate = new Date(selectedYear, selectedMonth, 1);
      const endDate = new Date(selectedYear, selectedMonth + 1, 0, 23, 59, 59);

      const { data, error } = await supabase
        .from('tickets')
        .select(`
          id,
          amount,
          quantity,
          created_at,
          customer_name,
          payment_id,
          payment_method,
          event_id,
          events(
            school_name,
            seller_commission_pct,
            presenter_commission_pct,
            supervisor_commission_pct,
            school_commission_type,
            school_commission_value,
            seller_id
          ),
          franchises(name)
        `)
        .eq('payment_status', 'approved')
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch seller names from beneficiaries
      const sellerIds = [...new Set((data || []).map(t => (t.events as any)?.seller_id).filter(Boolean))];
      const sellerMap: Record<string, string> = {};
      if (sellerIds.length > 0) {
        const { data: sellers } = await supabase
          .from('commission_beneficiaries')
          .select('id, name')
          .in('id', sellerIds);
        (sellers || []).forEach(s => { sellerMap[s.id] = s.name; });
      }

      // Fetch paid commission amounts
      const { data: paidData } = await supabase
        .from('commission_payouts')
        .select('payout_type, amount')
        .eq('is_paid', true)
        .gte('period_start', startDate.toISOString())
        .lte('period_end', endDate.toISOString());

      const paidByType: Record<string, number> = { seller: 0, presenter: 0, supervisor: 0, school: 0 };
      (paidData || []).forEach(row => {
        if (paidByType[row.payout_type] !== undefined) {
          paidByType[row.payout_type] += Number(row.amount);
        }
      });

      // Create cash flow entries with commission calculations
      const flowEntries: CashFlowEntry[] = [];
      let totalGross = 0;
      let totalSellerComm = 0;
      let totalPresenterComm = 0;
      let totalSupervisorComm = 0;
      let totalSchoolComm = 0;
      let totalStudents = 0;

      (data || []).forEach(ticket => {
        const amount = Number(ticket.amount);
        const quantity = ticket.quantity;
        totalGross += amount;
        totalStudents += quantity;

        const eventData = ticket.events as unknown as {
          school_name: string;
          seller_commission_pct: number | null;
          presenter_commission_pct: number | null;
          supervisor_commission_pct: number | null;
          school_commission_type: string | null;
          school_commission_value: number | null;
          seller_id: string | null;
        } | null;

        const sellerName = (eventData?.seller_id && sellerMap[eventData.seller_id]) || 'Sem vendedor';
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

        totalSellerComm += sellerComm;
        totalPresenterComm += presenterComm;
        totalSupervisorComm += supervisorComm;
        totalSchoolComm += schoolComm;

        flowEntries.push({
          id: `${ticket.id}-income`,
          type: 'income',
          description: `${eventData?.school_name || 'Evento'} - ${ticket.customer_name}`,
          amount: amount,
          quantity: quantity,
          date: ticket.created_at,
          franchise_name: (ticket.franchises as { name: string })?.name || 'Franquia',
          seller_name: sellerName,
          sellerCommission: sellerComm,
          presenterCommission: presenterComm,
          supervisorCommission: supervisorComm,
          schoolCommission: schoolComm,
          netProfit: net,
          paymentId: ticket.payment_id,
          paymentMethod: getPaymentMethod((ticket as any).payment_method, ticket.payment_id),
        });
      });

      setEntries(flowEntries);
      setSummary({
        gross: totalGross,
        sellerCommission: totalSellerComm,
        presenterCommission: totalPresenterComm,
        supervisorCommission: totalSupervisorComm,
        schoolCommission: totalSchoolComm,
        netProfit: totalGross - totalSellerComm - totalPresenterComm - totalSupervisorComm - totalSchoolComm,
        totalStudents,
        sellerPaid: paidByType.seller,
        presenterPaid: paidByType.presenter,
        supervisorPaid: paidByType.supervisor,
        schoolPaid: paidByType.school,
      });
    } catch (error) {
      console.error('Error fetching cash flow:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar o fluxo de caixa.',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const uniqueFranchises = useMemo(() => [...new Set(entries.map(e => e.franchise_name))].sort(), [entries]);
  const uniqueSellers = useMemo(() => [...new Set(entries.map(e => e.seller_name))].sort(), [entries]);

  const [allSchools, setAllSchools] = useState<string[]>([]);

  useEffect(() => {
    const fetchAllSchools = async () => {
      const { data } = await supabase
        .from('events')
        .select('school_name')
        .order('school_name');
      if (data) {
        const names = [...new Set(data.map(e => e.school_name))].sort();
        setAllSchools(names);
      }
    };
    fetchAllSchools();
  }, []);

  const filteredEntries = useMemo(() => {
    return entries.filter(e => {
      if (filterPaymentMethod !== 'all' && e.paymentMethod !== filterPaymentMethod) return false;
      if (filterFranchise !== 'all' && e.franchise_name !== filterFranchise) return false;
      if (filterSchool !== 'all' && !e.description.startsWith(filterSchool)) return false;
      if (filterSeller !== 'all' && e.seller_name !== filterSeller) return false;
      return true;
    });
  }, [entries, filterPaymentMethod, filterFranchise, filterSchool, filterSeller]);

  const activeFilterCount = [filterPaymentMethod, filterFranchise, filterSchool, filterSeller].filter(v => v !== 'all').length;

  const clearAllFilters = () => {
    setFilterPaymentMethod('all');
    setFilterFranchise('all');
    setFilterSchool('all');
    setFilterSeller('all');
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const handleExportPDF = () => {
    toast({
      title: 'Exportando PDF...',
      description: 'O extrato será gerado em breve.'
    });
  };

  const handleExportExcel = () => {
    const headers = ['Data', 'Descrição', 'Franquia', 'Alunos', 'Bruto', 'Vendedor', 'Apresentador', 'Supervisor', 'Escola', 'Líquido'];
    const rows = entries.map(e => [
      format(new Date(e.date), 'dd/MM/yyyy HH:mm'),
      e.description,
      e.franchise_name,
      e.quantity,
      e.amount.toFixed(2),
      e.sellerCommission.toFixed(2),
      e.presenterCommission.toFixed(2),
      e.supervisorCommission.toFixed(2),
      e.schoolCommission.toFixed(2),
      e.netProfit.toFixed(2)
    ]);

    // Add totals row
    rows.push([]);
    rows.push([
      'TOTAL',
      '',
      '',
      summary.totalStudents.toString(),
      summary.gross.toFixed(2),
      summary.sellerCommission.toFixed(2),
      summary.presenterCommission.toFixed(2),
      summary.schoolCommission.toFixed(2),
      summary.netProfit.toFixed(2)
    ]);

    const csvContent = [headers, ...rows]
      .map(row => row.join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `fluxo_caixa_${months[selectedMonth]}_${selectedYear}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast({
      title: 'Exportação concluída',
      description: 'O arquivo CSV foi baixado.'
    });
  };

  const totalCommissions = summary.sellerCommission + summary.presenterCommission + summary.schoolCommission;

  return (
    <div className="p-2 md:p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-lg md:text-2xl font-bold text-foreground">Extrato Financeiro</h1>
        <p className="text-muted-foreground">Movimentações financeiras com detalhamento de comissões</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 md:gap-4">
        <Card>
          <CardContent className="pt-3 md:pt-6">
            <div className="flex items-center gap-2 md:gap-3">
              <div className="p-1.5 md:p-2 bg-blue-500/10 rounded-lg">
                <DollarSign className="h-4 w-4 md:h-5 md:w-5 text-blue-500" />
              </div>
              <div className="min-w-0">
                <p className="text-xs md:text-sm text-muted-foreground">Receita Bruta</p>
                <p className="text-sm md:text-2xl font-bold truncate">{formatCurrency(summary.gross)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-3 md:pt-6">
            <div className="flex items-center gap-2 md:gap-3">
              <div className="p-1.5 md:p-2 bg-red-500/10 rounded-lg">
                <TrendingDown className="h-4 w-4 md:h-5 md:w-5 text-red-500" />
              </div>
              <div className="min-w-0">
                <p className="text-xs md:text-sm text-muted-foreground">Total Comissões</p>
                <p className="text-sm md:text-2xl font-bold text-red-600 truncate">{formatCurrency(totalCommissions)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="pt-3 md:pt-6">
            <div className="flex items-center gap-2 md:gap-3">
              <div className="p-1.5 md:p-2 bg-primary/10 rounded-lg">
                <Wallet className="h-4 w-4 md:h-5 md:w-5 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-xs md:text-sm text-muted-foreground">Lucro Líquido</p>
                <p className="text-sm md:text-2xl font-bold text-primary truncate">{formatCurrency(summary.netProfit)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-3 md:pt-6">
            <div className="flex items-center gap-2 md:gap-3">
              <div className="p-1.5 md:p-2 bg-purple-500/10 rounded-lg">
                <Users className="h-4 w-4 md:h-5 md:w-5 text-purple-500" />
              </div>
              <div className="min-w-0">
                <p className="text-xs md:text-sm text-muted-foreground">Total de Alunos</p>
                <p className="text-sm md:text-2xl font-bold">{summary.totalStudents}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Commission Breakdown */}
      {entries.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Detalhamento das Comissões</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 md:gap-4">
              {[
                { label: 'Vendedores', due: summary.sellerCommission, paid: summary.sellerPaid },
                { label: 'Apresentadores', due: summary.presenterCommission, paid: summary.presenterPaid },
                { label: 'Supervisores', due: summary.supervisorCommission, paid: summary.supervisorPaid },
                { label: 'Escolas', due: summary.schoolCommission, paid: summary.schoolPaid },
              ].map(item => {
                const pending = Math.max(item.due - item.paid, 0);
                return (
                  <div key={item.label} className="p-2 md:p-3 rounded-lg bg-muted/50 space-y-1">
                    <span className="text-xs md:text-sm font-medium text-foreground">{item.label}</span>
                    <div className="flex justify-between text-xs md:text-sm">
                      <span className="text-muted-foreground">Devido:</span>
                      <span className="font-semibold text-destructive">-{formatCurrency(item.due)}</span>
                    </div>
                    <div className="flex justify-between text-xs md:text-sm">
                      <span className="text-muted-foreground">Pago:</span>
                      <span className="font-semibold text-green-600">{formatCurrency(item.paid)}</span>
                    </div>
                    <div className="flex justify-between text-xs md:text-sm">
                      <span className="text-muted-foreground">Pendente:</span>
                      <span className="font-semibold text-yellow-600">{formatCurrency(pending)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
            {/* Totals row */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2 md:p-3 rounded-lg bg-muted border border-border">
              <span className="text-xs md:text-sm font-semibold text-foreground">Resumo Geral</span>
              <div className="flex flex-wrap gap-3 md:gap-6 text-xs md:text-sm">
                <div className="flex gap-1">
                  <span className="text-muted-foreground">Devido:</span>
                  <span className="font-semibold text-destructive">-{formatCurrency(totalCommissions)}</span>
                </div>
                <div className="flex gap-1">
                  <span className="text-muted-foreground">Pago:</span>
                  <span className="font-semibold text-green-600">{formatCurrency(summary.sellerPaid + summary.presenterPaid + summary.supervisorPaid + summary.schoolPaid)}</span>
                </div>
                <div className="flex gap-1">
                  <span className="text-muted-foreground">Pendente:</span>
                  <span className="font-semibold text-yellow-600">{formatCurrency(Math.max(totalCommissions - (summary.sellerPaid + summary.presenterPaid + summary.supervisorPaid + summary.schoolPaid), 0))}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Year Timeline */}
      <YearTimeline 
        selectedYear={selectedYear} 
        onYearChange={setSelectedYear} 
      />

      {/* Month Selector */}
      <MonthSelector
        selectedMonth={selectedMonth}
        selectedYear={selectedYear}
        onMonthChange={setSelectedMonth}
      />

      {/* Month title + actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-foreground capitalize">
            {months[selectedMonth]} de {selectedYear}
          </h3>
          <p className="text-sm text-muted-foreground">{filteredEntries.length} vendas</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <CashPaymentDialog onSuccess={fetchCashFlow} />
          <Button variant="outline" size="sm" onClick={handleExportPDF} className="gap-2">
            <FileText className="h-4 w-4" />
            <span className="hidden sm:inline">Extrato PDF</span>
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportExcel} className="gap-2">
            <FileSpreadsheet className="h-4 w-4" />
            <span className="hidden sm:inline">Exportar CSV</span>
          </Button>
        </div>
      </div>

      {/* Filters — always visible, combinable */}
      <div className="rounded-lg border bg-muted/20 p-3 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Filtros</span>
            {activeFilterCount > 0 && (
              <Badge variant="secondary" className="text-xs px-1.5 py-0 h-5">{activeFilterCount}</Badge>
            )}
          </div>
          {activeFilterCount > 0 && (
            <Button variant="ghost" size="sm" onClick={clearAllFilters} className="h-6 px-2 text-xs text-muted-foreground">
              <FilterX className="h-3 w-3 mr-1" />
              Limpar tudo
            </Button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
          {/* Franquia */}
          <Select value={filterFranchise} onValueChange={setFilterFranchise}>
            <SelectTrigger>
              <SelectValue placeholder="Franquia" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as franquias</SelectItem>
              {uniqueFranchises.map(f => (
                <SelectItem key={f} value={f}>{f}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Escola */}
          <Select value={filterSchool} onValueChange={setFilterSchool}>
            <SelectTrigger>
              <SelectValue placeholder="Escola / Evento" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as escolas</SelectItem>
              {allSchools.map(s => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Vendedor */}
          <Select value={filterSeller} onValueChange={setFilterSeller}>
            <SelectTrigger>
              <SelectValue placeholder="Vendedor" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os vendedores</SelectItem>
              {uniqueSellers.map(s => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Pagamento */}
          <Select value={filterPaymentMethod} onValueChange={setFilterPaymentMethod}>
            <SelectTrigger>
              <SelectValue placeholder="Forma de pagamento" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os pagamentos</SelectItem>
              <SelectItem value="pix">PIX</SelectItem>
              <SelectItem value="credit_card">Cartão de Crédito</SelectItem>
              <SelectItem value="cash">Dinheiro</SelectItem>
              <SelectItem value="free">Gratuito</SelectItem>
              <SelectItem value="unknown">Outro</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Active filter chips */}
        {activeFilterCount > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {filterFranchise !== 'all' && (
              <Badge variant="secondary" className="flex items-center gap-1 pr-1 text-xs">
                <span>Franquia: {filterFranchise}</span>
                <button onClick={() => setFilterFranchise('all')} className="ml-0.5 rounded-full hover:bg-muted p-0.5">
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )}
            {filterSchool !== 'all' && (
              <Badge variant="secondary" className="flex items-center gap-1 pr-1 text-xs">
                <span className="max-w-[150px] truncate">Escola: {filterSchool}</span>
                <button onClick={() => setFilterSchool('all')} className="ml-0.5 rounded-full hover:bg-muted p-0.5">
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )}
            {filterSeller !== 'all' && (
              <Badge variant="secondary" className="flex items-center gap-1 pr-1 text-xs">
                <span>Vendedor: {filterSeller}</span>
                <button onClick={() => setFilterSeller('all')} className="ml-0.5 rounded-full hover:bg-muted p-0.5">
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )}
            {filterPaymentMethod !== 'all' && (
              <Badge variant="secondary" className="flex items-center gap-1 pr-1 text-xs">
                <span>Pagamento: {methodLabels[filterPaymentMethod]}</span>
                <button onClick={() => setFilterPaymentMethod('all')} className="ml-0.5 rounded-full hover:bg-muted p-0.5">
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )}
          </div>
        )}

        <p className="text-xs text-muted-foreground">{filteredEntries.length} resultado(s)</p>
      </div>

      {/* Filtered Summary — shown right below filters */}
      {filteredEntries.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 rounded-lg border bg-muted/30 p-3">
          {(() => {
            const fGross = filteredEntries.reduce((s, e) => s + e.amount, 0);
            const fSeller = filteredEntries.reduce((s, e) => s + e.sellerCommission, 0);
            const fPresenter = filteredEntries.reduce((s, e) => s + e.presenterCommission, 0);
            const fSupervisor = filteredEntries.reduce((s, e) => s + e.supervisorCommission, 0);
            const fSchool = filteredEntries.reduce((s, e) => s + e.schoolCommission, 0);
            const fNet = filteredEntries.reduce((s, e) => s + e.netProfit, 0);
            const fStudents = filteredEntries.reduce((s, e) => s + e.quantity, 0);
            const fComm = fSeller + fPresenter + fSupervisor + fSchool;
            return (
              <>
                <div className="flex flex-col">
                  <span className="text-xs text-muted-foreground">Bruto</span>
                  <span className="text-sm font-bold text-foreground">{formatCurrency(fGross)}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-xs text-muted-foreground">Comissões</span>
                  <span className="text-sm font-bold text-destructive">-{formatCurrency(fComm)}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-xs text-muted-foreground">Líquido</span>
                  <span className="text-sm font-bold text-primary">{formatCurrency(fNet)}</span>
                  {fGross > 0 && (
                    <span className="text-xs text-muted-foreground">{((fNet / fGross) * 100).toFixed(1)}% do bruto</span>
                  )}
                </div>
                <div className="flex flex-col">
                  <span className="text-xs text-muted-foreground">Alunos</span>
                  <span className="text-sm font-bold text-foreground">{fStudents}</span>
                </div>
              </>
            );
          })()}
        </div>
      )}

      {/* Table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
        </div>
      ) : filteredEntries.length === 0 ? (
        <Card className="p-12 text-center">
          <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-foreground mb-2">Sem vendas</h3>
          <p className="text-muted-foreground">Nenhuma venda neste período.</p>
        </Card>
      ) : (
        <div className="rounded-lg border border-border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-card hover:bg-card">
                <TableHead className="text-muted-foreground">Data</TableHead>
                <TableHead className="text-muted-foreground hidden md:table-cell">Descrição</TableHead>
                <TableHead className="text-muted-foreground hidden md:table-cell">Pagamento</TableHead>
                <TableHead className="text-muted-foreground hidden md:table-cell">Franquia</TableHead>
                <TableHead className="text-muted-foreground text-center">Alunos</TableHead>
                <TableHead className="text-muted-foreground text-right">Bruto</TableHead>
                <TableHead className="text-muted-foreground text-right hidden md:table-cell">Vendedor</TableHead>
                <TableHead className="text-muted-foreground text-right hidden md:table-cell">Apresent.</TableHead>
                <TableHead className="text-muted-foreground text-right hidden md:table-cell">Superv.</TableHead>
                <TableHead className="text-muted-foreground text-right hidden md:table-cell">Escola</TableHead>
                <TableHead className="text-muted-foreground text-right">Líquido</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredEntries.map((entry) => (
                <TableRow key={entry.id} className="hover:bg-muted/50">
                  <TableCell className="text-foreground">
                    {format(new Date(entry.date), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                  </TableCell>
                  <TableCell className="text-foreground max-w-[200px] truncate hidden md:table-cell">
                    {entry.description}
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <Badge variant="outline" className={`text-xs ${methodColors[entry.paymentMethod] || ''}`}>
                      {methodLabels[entry.paymentMethod] || entry.paymentMethod}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground hidden md:table-cell">{entry.franchise_name}</TableCell>
                  <TableCell className="text-center">{entry.quantity}</TableCell>
                  <TableCell className="text-right">{formatCurrency(entry.amount)}</TableCell>
                  <TableCell className="text-right text-red-600 hidden md:table-cell">-{formatCurrency(entry.sellerCommission)}</TableCell>
                  <TableCell className="text-right text-red-600 hidden md:table-cell">-{formatCurrency(entry.presenterCommission)}</TableCell>
                  <TableCell className="text-right text-red-600 hidden md:table-cell">-{formatCurrency(entry.supervisorCommission)}</TableCell>
                  <TableCell className="text-right text-red-600 hidden md:table-cell">-{formatCurrency(entry.schoolCommission)}</TableCell>
                  <TableCell className="text-right font-medium text-primary">
                    {formatCurrency(entry.netProfit)}
                  </TableCell>
                </TableRow>
              ))}
              {/* Totals Row */}
              <TableRow className="bg-muted/50 font-medium">
                <TableCell>TOTAL</TableCell>
                <TableCell className="hidden md:table-cell"></TableCell>
                <TableCell className="hidden md:table-cell"></TableCell>
                <TableCell className="hidden md:table-cell"></TableCell>
                <TableCell className="text-center">{summary.totalStudents}</TableCell>
                <TableCell className="text-right">{formatCurrency(summary.gross)}</TableCell>
                <TableCell className="text-right text-red-600 hidden md:table-cell">-{formatCurrency(summary.sellerCommission)}</TableCell>
                <TableCell className="text-right text-red-600 hidden md:table-cell">-{formatCurrency(summary.presenterCommission)}</TableCell>
                <TableCell className="text-right text-red-600 hidden md:table-cell">-{formatCurrency(summary.supervisorCommission)}</TableCell>
                <TableCell className="text-right text-red-600 hidden md:table-cell">-{formatCurrency(summary.schoolCommission)}</TableCell>
                <TableCell className="text-right font-bold text-primary">{formatCurrency(summary.netProfit)}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
};

export default CashFlow;