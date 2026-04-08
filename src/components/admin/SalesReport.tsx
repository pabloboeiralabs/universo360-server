import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import ExcelImportExport from '@/components/shared/ExcelImportExport';
import { ColumnDef } from '@/lib/excelUtils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Download, FileText, Users, DollarSign, Rocket, Building2, Undo2, ArrowRight } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import MonthSelector from './MonthSelector';
import YearTimeline from './YearTimeline';
import RefundConfirmDialog from './RefundConfirmDialog';
import TransferTicketDialog from '@/components/shared/TransferTicketDialog';
import { useToast } from '@/hooks/use-toast';

interface Sale {
  id: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string | null;
  student_name: string | null;
  class_grade: string | null;
  parent_name: string | null;
  quantity: number;
  amount: number;
  payment_status: string;
  created_at: string;
  mp_payment_id: string | null;
  spots_decremented: boolean;
  event: {
    id: string;
    school_name: string;
    event_date: string;
    location: string;
    franchise_id: string;
  } | null;
  franchise: {
    id: string;
    name: string;
    city: string;
    state: string;
    owner_id: string | null;
  } | null;
}

type OriginFilter = 'all' | 'matriz' | 'franchises';

interface SalesReportProps {
  franchiseId?: string | null;
}

const salesExcelColumns: ColumnDef[] = [
  { key: 'id', header: 'ID', width: 36 },
  { key: 'created_at', header: 'Data', width: 18, transform: (v: string) => v ? format(new Date(v), 'dd/MM/yyyy HH:mm') : '' },
  { key: 'customer_name', header: 'Responsável', width: 25 },
  { key: 'student_name', header: 'Aluno', width: 25 },
  { key: 'class_grade', header: 'Série', width: 15 },
  { key: 'quantity', header: 'Qtd', width: 6 },
  { key: 'amount', header: 'Valor', width: 12 },
  { key: 'payment_status', header: 'Status', width: 12 },
  { key: 'customer_email', header: 'E-mail', width: 25 },
  { key: 'customer_phone', header: 'Telefone', width: 16 },
];

const SalesReport = ({ franchiseId }: SalesReportProps = {}) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFranchise, setSelectedFranchise] = useState<string>('all');
  const [originFilter, setOriginFilter] = useState<OriginFilter>('all');
  
  // Refund state
  const [refundDialogOpen, setRefundDialogOpen] = useState(false);
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);

  // Transfer state
  const [transferDialogOpen, setTransferDialogOpen] = useState(false);
  const [transferSale, setTransferSale] = useState<Sale | null>(null);

  // Get the admin's Matriz franchise ID
  const { data: matrizFranchise } = useQuery({
    queryKey: ['admin-matriz-franchise', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from('franchises')
        .select('id')
        .eq('owner_id', user.id)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  const { data: franchises } = useQuery({
    queryKey: ['franchises-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('franchises')
        .select('id, name, owner_id')
        .eq('is_active', true)
        .order('name');
      
      if (error) throw error;
      return data;
    },
  });

  const isFiltered = !!franchiseId;

  const { data: sales, isLoading } = useQuery({
    queryKey: ['admin-sales', selectedYear, selectedMonth, franchiseId],
    queryFn: async () => {
      const startDate = new Date(selectedYear, selectedMonth - 1, 1);
      const endDate = new Date(selectedYear, selectedMonth, 0, 23, 59, 59);

      let query = supabase
        .from('tickets')
        .select(`
          id,
          customer_name,
          customer_email,
          customer_phone,
          student_name,
          class_grade,
          parent_name,
          quantity,
          amount,
          payment_status,
          created_at,
          mp_payment_id,
          spots_decremented,
          event:events(id, school_name, event_date, location, franchise_id),
          franchise:franchises(id, name, city, state, owner_id)
        `)
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())
        .order('created_at', { ascending: false });

      if (franchiseId) {
        query = query.eq('franchise_id', franchiseId);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as Sale[];
    },
  });

  // Refund mutation
  const refundMutation = useMutation({
    mutationFn: async ({ ticketId, reason }: { ticketId: string; reason: string }) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('Não autenticado');
      }

      const response = await supabase.functions.invoke('refund-payment', {
        body: { ticket_id: ticketId, reason },
      });

      if (response.error) {
        throw new Error(response.error.message || 'Erro ao processar estorno');
      }
    },
    onSuccess: () => {
      toast({
        title: 'Estorno realizado',
        description: 'O pagamento foi estornado com sucesso.',
      });
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      setRefundDialogOpen(false);
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro no estorno',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const filteredSales = useMemo(() => {
    if (!sales) return [];

    
    return sales.filter((sale) => {
      const matchesSearch = 
        sale.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        sale.student_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        sale.class_grade?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        sale.event?.school_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        sale.franchise?.name.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesFranchise = selectedFranchise === 'all' || sale.franchise?.id === selectedFranchise;
      
      // Origin filter
      let matchesOrigin = true;
      if (originFilter === 'matriz') {
        matchesOrigin = sale.franchise?.id === matrizFranchise?.id;
      } else if (originFilter === 'franchises') {
        matchesOrigin = sale.franchise?.id !== matrizFranchise?.id;
      }
      
      return matchesSearch && matchesFranchise && matchesOrigin;
    });
  }, [sales, searchTerm, selectedFranchise, originFilter, matrizFranchise?.id]);

  const stats = useMemo(() => {
    const approved = filteredSales.filter(s => s.payment_status === 'approved');
    const refunded = filteredSales.filter(s => s.payment_status === 'refunded');
    return {
      totalSales: filteredSales.length,
      approvedSales: approved.length,
      refundedSales: refunded.length,
      totalRevenue: approved.reduce((acc, s) => acc + Number(s.amount), 0),
      totalStudents: approved.reduce((acc, s) => acc + s.quantity, 0),
    };
  }, [filteredSales]);

  // Stats by origin
  const originStats = useMemo(() => {
    if (!sales || !matrizFranchise) return { matriz: 0, franchises: 0 };
    
    const approved = sales.filter(s => s.payment_status === 'approved');
    const matrizRevenue = approved
      .filter(s => s.franchise?.id === matrizFranchise.id)
      .reduce((acc, s) => acc + Number(s.amount), 0);
    const franchisesRevenue = approved
      .filter(s => s.franchise?.id !== matrizFranchise.id)
      .reduce((acc, s) => acc + Number(s.amount), 0);
    
    return { matriz: matrizRevenue, franchises: franchisesRevenue };
  }, [sales, matrizFranchise]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <Badge className="bg-green-500/20 text-green-500 hover:bg-green-500/30">Aprovado</Badge>;
      case 'pending':
        return <Badge className="bg-yellow-500/20 text-yellow-500 hover:bg-yellow-500/30">Pendente</Badge>;
      case 'rejected':
        return <Badge className="bg-red-500/20 text-red-500 hover:bg-red-500/30">Rejeitado</Badge>;
      case 'refunded':
        return <Badge className="bg-purple-500/20 text-purple-500 hover:bg-purple-500/30">Estornado</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const isMatrizSale = (sale: Sale) => sale.franchise?.id === matrizFranchise?.id;

  const handleRefundClick = (sale: Sale) => {
    setSelectedSale(sale);
    setRefundDialogOpen(true);
  };

  const handleTransferClick = (sale: Sale) => {
    setTransferSale(sale);
    setTransferDialogOpen(true);
  };

  const handleRefundConfirm = async (reason: string) => {
    if (!selectedSale) return;
    await refundMutation.mutateAsync({ ticketId: selectedSale.id, reason });
  };

  const handleExport = () => {
    const headers = [
      'Data',
      'Origem',
      'Responsável',
      'Aluno',
      'Série',
      'Escola',
      'Franquia',
      'Qtd',
      'Valor',
      'Status'
    ].join(',');

    const rows = filteredSales.map(sale => [
      format(new Date(sale.created_at), 'dd/MM/yyyy HH:mm'),
      isMatrizSale(sale) ? 'Matriz' : 'Franquia',
      `"${sale.customer_name}"`,
      `"${sale.student_name || '-'}"`,
      `"${sale.class_grade || '-'}"`,
      `"${sale.event?.school_name || '-'}"`,
      `"${sale.franchise?.name || '-'}"`,
      sale.quantity,
      sale.amount,
      sale.payment_status
    ].join(','));

    const csv = [headers, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `vendas_${selectedMonth}_${selectedYear}.csv`);
    link.click();
  };

  return (
    <div className="p-2 md:p-6 space-y-4 md:space-y-6">
      {/* Header with Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-4">
        <Card>
          <CardContent className="pt-4 md:pt-6 px-3 md:px-6">
            <div className="flex items-center gap-2 md:gap-3">
              <div className="p-1.5 md:p-2 bg-primary/10 rounded-lg">
                <FileText className="h-4 w-4 md:h-5 md:w-5 text-primary" />
              </div>
              <div>
                <p className="text-xs md:text-sm text-muted-foreground">Total de Vendas</p>
                <p className="text-sm md:text-2xl font-bold">{stats.totalSales}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 md:pt-6 px-3 md:px-6">
            <div className="flex items-center gap-2 md:gap-3">
              <div className="p-1.5 md:p-2 bg-green-500/10 rounded-lg">
                <FileText className="h-4 w-4 md:h-5 md:w-5 text-green-500" />
              </div>
              <div>
                <p className="text-xs md:text-sm text-muted-foreground">Vendas Aprovadas</p>
                <p className="text-sm md:text-2xl font-bold">{stats.approvedSales}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 md:pt-6 px-3 md:px-6">
            <div className="flex items-center gap-2 md:gap-3">
              <div className="p-1.5 md:p-2 bg-blue-500/10 rounded-lg">
                <Users className="h-4 w-4 md:h-5 md:w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-xs md:text-sm text-muted-foreground">Total de Alunos</p>
                <p className="text-sm md:text-2xl font-bold">{stats.totalStudents}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 md:pt-6 px-3 md:px-6">
            <div className="flex items-center gap-2 md:gap-3">
              <div className="p-1.5 md:p-2 bg-emerald-500/10 rounded-lg">
                <DollarSign className="h-4 w-4 md:h-5 md:w-5 text-emerald-500" />
              </div>
              <div>
                <p className="text-xs md:text-sm text-muted-foreground">Receita Total</p>
                <p className="text-sm md:text-2xl font-bold">{formatCurrency(stats.totalRevenue)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Origin Quick Filter Cards */}
      {!isFiltered && matrizFranchise && (
        <div className="grid grid-cols-3 gap-2 md:gap-4">
          <button
            onClick={() => setOriginFilter('all')}
            className={`p-3 md:p-4 rounded-lg border transition-all text-left ${
              originFilter === 'all'
                ? 'bg-primary/10 border-primary'
                : 'bg-card hover:bg-muted/50 border-border'
            }`}
          >
            <div className="flex items-center gap-1.5 md:gap-3">
              <div className="p-1.5 md:p-2 bg-primary/10 rounded-lg">
                <FileText className="h-4 w-4 md:h-5 md:w-5 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-xs md:text-sm font-medium">Todas as Vendas</p>
                <p className="text-xs sm:text-sm md:text-lg font-bold truncate">
                  {formatCurrency(originStats.matriz + originStats.franchises)}
                </p>
              </div>
            </div>
          </button>

          <button
            onClick={() => setOriginFilter('matriz')}
            className={`p-3 md:p-4 rounded-lg border transition-all text-left ${
              originFilter === 'matriz'
                ? 'bg-green-500/10 border-green-500'
                : 'bg-card hover:bg-muted/50 border-border'
            }`}
          >
            <div className="flex items-center gap-1.5 md:gap-3">
              <div className="p-1.5 md:p-2 bg-green-500/10 rounded-lg">
                <Rocket className="h-4 w-4 md:h-5 md:w-5 text-green-500" />
              </div>
              <div className="min-w-0">
                <p className="text-xs md:text-sm font-medium">Matriz</p>
                <p className="text-xs sm:text-sm md:text-lg font-bold text-green-600 truncate">
                  {formatCurrency(originStats.matriz)}
                </p>
              </div>
            </div>
          </button>

          <button
            onClick={() => setOriginFilter('franchises')}
            className={`p-3 md:p-4 rounded-lg border transition-all text-left ${
              originFilter === 'franchises'
                ? 'bg-blue-500/10 border-blue-500'
                : 'bg-card hover:bg-muted/50 border-border'
            }`}
          >
            <div className="flex items-center gap-1.5 md:gap-3">
              <div className="p-1.5 md:p-2 bg-blue-500/10 rounded-lg">
                <Building2 className="h-4 w-4 md:h-5 md:w-5 text-blue-500" />
              </div>
              <div className="min-w-0">
                <p className="text-xs md:text-sm font-medium">Franquias</p>
                <p className="text-xs sm:text-sm md:text-lg font-bold text-blue-600 truncate">
                  {formatCurrency(originStats.franchises)}
                </p>
              </div>
            </div>
          </button>
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Relatório de Vendas
            {originFilter !== 'all' && (
              <Badge variant="secondary" className="ml-2">
                {originFilter === 'matriz' ? '🚀 Matriz' : '🏢 Franquias'}
              </Badge>
            )}
          </CardTitle>
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

          {/* Search and Franchise Filter */}
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por responsável, aluno, série, escola ou franquia..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            {!isFiltered && (
              <Select value={selectedFranchise} onValueChange={setSelectedFranchise}>
                <SelectTrigger className="w-full md:w-[200px]">
                  <SelectValue placeholder="Todas as franquias" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as franquias</SelectItem>
                  {franchises?.map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.id === matrizFranchise?.id ? `🚀 ${f.name}` : f.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <ExcelImportExport
              data={filteredSales.map(s => ({ ...s, event_name: s.event?.school_name, franchise_name: s.franchise?.name }))}
              columns={salesExcelColumns}
              entityName="vendas"
              onImport={async () => { toast({ title: 'Vendas são geradas automaticamente pelo sistema e não podem ser importadas.' }); }}
            />
            <Button variant="outline" onClick={handleExport}>
              <Download className="h-4 w-4 mr-2" />
              Exportar CSV
            </Button>
          </div>

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
                    <TableHead>Data</TableHead>
                    {!isFiltered && <TableHead className="hidden md:table-cell">Origem</TableHead>}
                    <TableHead>Responsável</TableHead>
                    <TableHead className="hidden md:table-cell">Aluno</TableHead>
                    <TableHead className="hidden md:table-cell">Série</TableHead>
                    <TableHead className="hidden md:table-cell">Escola</TableHead>
                    {!isFiltered && <TableHead className="hidden md:table-cell">Franquia</TableHead>}
                    <TableHead className="text-center">Qtd</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead className="text-center">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSales.map((sale) => (
                    <TableRow 
                      key={sale.id}
                      className={isMatrizSale(sale) ? 'bg-green-500/5' : ''}
                    >
                      <TableCell className="whitespace-nowrap text-xs md:text-sm">
                        {format(new Date(sale.created_at), 'dd/MM/yyyy', { locale: ptBR })}
                      </TableCell>
                      {!isFiltered && (
                        <TableCell className="hidden md:table-cell">
                          {isMatrizSale(sale) ? (
                            <Badge className="bg-green-500/20 text-green-600 border-green-500/30">
                              <Rocket className="h-3 w-3 mr-1" />
                              Matriz
                            </Badge>
                          ) : (
                            <Badge variant="secondary">
                              <Building2 className="h-3 w-3 mr-1" />
                              Franquia
                            </Badge>
                          )}
                        </TableCell>
                      )}
                      <TableCell>
                        <div>
                          <p className="font-medium text-xs md:text-sm">{sale.customer_name}</p>
                          <p className="text-xs text-muted-foreground hidden md:block">{sale.customer_email}</p>
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">{sale.student_name || '-'}</TableCell>
                      <TableCell className="hidden md:table-cell">{sale.class_grade || '-'}</TableCell>
                      <TableCell className="hidden md:table-cell">{sale.event?.school_name || '-'}</TableCell>
                      {!isFiltered && (
                        <TableCell className="hidden md:table-cell">
                          <div>
                            <p className="font-medium">{sale.franchise?.name || '-'}</p>
                            {sale.franchise && (
                              <p className="text-xs text-muted-foreground">
                                {sale.franchise.city}/{sale.franchise.state}
                              </p>
                            )}
                          </div>
                        </TableCell>
                      )}
                      <TableCell className="text-center text-xs md:text-sm">{sale.quantity}</TableCell>
                      <TableCell className="text-right font-medium text-xs md:text-sm">
                        {formatCurrency(Number(sale.amount))}
                      </TableCell>
                      <TableCell className="text-center">{getStatusBadge(sale.payment_status)}</TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          {/* Transfer button — available for all approved tickets */}
                          {sale.payment_status === 'approved' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleTransferClick(sale)}
                              className="text-primary hover:text-primary hover:bg-primary/10"
                              title="Transferir aluno para outro evento"
                            >
                              <ArrowRight className="h-4 w-4" />
                            </Button>
                          )}
                          {sale.payment_status === 'approved' && sale.mp_payment_id && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRefundClick(sale)}
                              className="text-destructive hover:text-destructive hover:bg-destructive/10"
                              title="Estornar pagamento"
                            >
                              <Undo2 className="h-4 w-4" />
                            </Button>
                          )}
                          {sale.payment_status === 'approved' && !sale.mp_payment_id && (
                            <span className="text-xs text-muted-foreground" title="Ticket processado antes da atualização do sistema">
                              -
                            </span>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredSales.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={11} className="text-center py-8 text-muted-foreground">
                        Nenhuma venda encontrada para o período selecionado
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Refund Confirmation Dialog */}
      <RefundConfirmDialog
        open={refundDialogOpen}
        onOpenChange={setRefundDialogOpen}
        onConfirm={handleRefundConfirm}
        ticketInfo={selectedSale ? {
          customerName: selectedSale.customer_name,
          studentName: selectedSale.student_name || undefined,
          amount: Number(selectedSale.amount),
          eventName: selectedSale.event?.school_name,
        } : null}
        isLoading={refundMutation.isPending}
      />

      {/* Transfer Dialog */}
      <TransferTicketDialog
        open={transferDialogOpen}
        onOpenChange={setTransferDialogOpen}
        ticket={transferSale ? {
          id: transferSale.id,
          student_name: transferSale.student_name,
          customer_name: transferSale.customer_name,
          class_grade: transferSale.class_grade,
          amount: Number(transferSale.amount),
          payment_status: transferSale.payment_status,
          spots_decremented: transferSale.spots_decremented,
          event: transferSale.event ? {
            id: transferSale.event.id,
            school_name: transferSale.event.school_name,
            event_date: transferSale.event.event_date,
            franchise_id: transferSale.event.franchise_id,
          } : null,
        } : null}
        franchiseId={franchiseId}
      />
    </div>
  );
};

export default SalesReport;
