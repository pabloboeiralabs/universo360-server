import { useState, useEffect } from 'react';
import { Users, DollarSign, Rocket, RefreshCw, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';
import KPICard from './KPICard';
import YearTimeline from './YearTimeline';
import MonthSelector from './MonthSelector';
import TransactionsTable from './TransactionsTable';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';

interface Transaction {
  id: string;
  customer_name: string;
  customer_email: string;
  event_name: string;
  quantity: number;
  amount: number;
  payment_status: string;
  created_at: string;
}

interface KPIData {
  totalStudents: number;
  grossRevenue: number;
  matrizRevenue: number;
}

const DashboardOverview = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [kpiData, setKpiData] = useState<KPIData>({
    totalStudents: 0,
    grossRevenue: 0,
    matrizRevenue: 0
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isReconciling, setIsReconciling] = useState(false);
  const [isCleaning, setIsCleaning] = useState(false);

  const handleCleanupPending = async () => {
    setIsCleaning(true);
    try {
      const { data, error } = await supabase.functions.invoke('cleanup-pending-tickets', { body: {} });
      if (error) throw error;
      toast({
        title: 'Limpeza concluída',
        description: `${data.deleted} ingressos pendentes removidos de ${data.events_checked} eventos finalizados.`,
      });
      fetchData();
    } catch (err) {
      toast({ title: 'Erro na limpeza', description: String(err), variant: 'destructive' });
    } finally {
      setIsCleaning(false);
    }
  };


  const handleReconcile = async () => {
    setIsReconciling(true);
    try {
      const { data, error } = await supabase.functions.invoke('reconcile-pending-payments', { body: {} });
      if (error) throw error;
      toast({
        title: 'Reconciliação concluída',
        description: `${data.approved} pagamentos aprovados, ${data.rejected} rejeitados, ${data.still_pending} ainda pendentes.`,
      });
      fetchData();
    } catch (err) {
      toast({ title: 'Erro na reconciliação', description: String(err), variant: 'destructive' });
    } finally {
      setIsReconciling(false);
    }
  };

  const months = [
    'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
    'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'
  ];

  useEffect(() => {
    if (user?.id) {
      fetchData();
    }
  }, [selectedYear, selectedMonth, user?.id]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      // Calculate date range for selected month
      const startDate = new Date(selectedYear, selectedMonth, 1);
      const endDate = new Date(selectedYear, selectedMonth + 1, 0, 23, 59, 59);

      // Fetch the Matriz franchise (owned by the current admin)
      const { data: matrizFranchise } = await supabase
        .from('franchises')
        .select('id')
        .eq('owner_id', user?.id)
        .maybeSingle();

      const matrizFranchiseId = matrizFranchise?.id;

      // Fetch tickets with event info for the selected period
      const { data: ticketsData, error: ticketsError } = await supabase
        .from('tickets')
        .select(`
          id,
          customer_name,
          customer_email,
          quantity,
          amount,
          payment_status,
          created_at,
          franchise_id,
          events!inner(school_name)
        `)
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())
        .order('created_at', { ascending: false });

      if (ticketsError) throw ticketsError;

      // Transform data for the table
      const formattedTransactions: Transaction[] = (ticketsData || []).map(ticket => ({
        id: ticket.id,
        customer_name: ticket.customer_name,
        customer_email: ticket.customer_email,
        event_name: (ticket.events as { school_name: string })?.school_name || 'Evento',
        quantity: ticket.quantity,
        amount: Number(ticket.amount),
        payment_status: ticket.payment_status,
        created_at: ticket.created_at
      }));

      setTransactions(formattedTransactions);

      // Calculate KPIs from approved tickets
      const approvedTickets = (ticketsData || []).filter(t => t.payment_status === 'approved');
      const totalStudents = approvedTickets.reduce((sum, t) => sum + t.quantity, 0);
      const grossRevenue = approvedTickets.reduce((sum, t) => sum + Number(t.amount), 0);

      // Calculate Matriz revenue (sales from admin's own franchise)
      const matrizTickets = approvedTickets.filter(t => t.franchise_id === matrizFranchiseId);
      const matrizRevenue = matrizTickets.reduce((sum, t) => sum + Number(t.amount), 0);

      setKpiData({
        totalStudents,
        grossRevenue,
        matrizRevenue
      });

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      toast({
        title: 'Erro ao carregar dados',
        description: 'Não foi possível carregar os dados do dashboard.',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
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
      description: 'O relatório será gerado em breve.'
    });
  };

  const handleExportExcel = () => {
    // Create CSV content
    const headers = ['Data', 'Cliente', 'Email', 'Evento', 'Quantidade', 'Valor', 'Status'];
    const rows = transactions.map(t => [
      format(new Date(t.created_at), 'dd/MM/yyyy'),
      t.customer_name,
      t.customer_email,
      t.event_name,
      t.quantity.toString(),
      t.amount.toFixed(2),
      t.payment_status
    ]);

    const csvContent = [headers, ...rows]
      .map(row => row.join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `transacoes_${months[selectedMonth]}_${selectedYear}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast({
      title: 'Exportação concluída',
      description: 'O arquivo CSV foi baixado com sucesso.'
    });
  };

  return (
    <div className="p-2 md:p-6 space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-lg md:text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground">Visão geral do sistema</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleReconcile}
          disabled={isReconciling}
          className="flex items-center gap-2 shrink-0"
        >
          <RefreshCw className={`h-4 w-4 ${isReconciling ? 'animate-spin' : ''}`} />
          {isReconciling ? 'Reconciliando...' : 'Reconciliar PIX'}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleCleanupPending}
          disabled={isCleaning}
          className="flex items-center gap-2 shrink-0"
        >
          <Trash2 className={`h-4 w-4 ${isCleaning ? 'animate-spin' : ''}`} />
          {isCleaning ? 'Limpando...' : 'Limpar Pendentes'}
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 md:gap-4">
        <KPICard
          title="Total de Alunos"
          value={kpiData.totalStudents}
          subtitle="Ingressos confirmados"
          icon={Users}
          variant="success"
        />
        <KPICard
          title="Receita Meu Planetário"
          value={formatCurrency(kpiData.matrizRevenue)}
          subtitle="Vendas próprias"
          icon={Rocket}
          variant="success"
        />
        <KPICard
          title="Receita Total Rede"
          value={formatCurrency(kpiData.grossRevenue)}
          subtitle="Todas as franquias"
          icon={DollarSign}
          variant="default"
        />
      </div>

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

      {/* Transactions Table */}
      <TransactionsTable
        transactions={transactions}
        monthName={months[selectedMonth]}
        year={selectedYear}
        isLoading={isLoading}
        onExportPDF={handleExportPDF}
        onExportExcel={handleExportExcel}
      />
    </div>
  );
};

export default DashboardOverview;