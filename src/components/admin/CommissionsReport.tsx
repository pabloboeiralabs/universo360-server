import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Download, DollarSign, Building2, TrendingUp, Percent, ChevronDown, ChevronRight } from 'lucide-react';
import MonthSelector from './MonthSelector';
import YearTimeline from './YearTimeline';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface TicketDetail {
  id: string;
  customer_name: string;
  created_at: string;
  amount: number;
  quantity: number;
  commission: number;
}

interface FranchiseWithCommission {
  id: string;
  name: string;
  city: string;
  state: string;
  commission_type: string | null;
  commission_value: number | null;
  totalSales: number;
  totalTickets: number;
  totalStudents: number;
  commissionDue: number;
  tickets: TicketDetail[];
}

const CommissionsReport = () => {
  const { user } = useAuth();
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [expandedFranchise, setExpandedFranchise] = useState<string | null>(null);

  const { data: franchisesWithSales, isLoading } = useQuery({
    queryKey: ['commissions-report', selectedYear, selectedMonth, user?.id],
    queryFn: async () => {
      const startDate = new Date(selectedYear, selectedMonth - 1, 1);
      const endDate = new Date(selectedYear, selectedMonth, 0, 23, 59, 59);

      const { data: franchises, error: franchisesError } = await supabase
        .from('franchises')
        .select('id, name, city, state, commission_type, commission_value, owner_id')
        .eq('is_active', true);

      if (franchisesError) throw franchisesError;

      const partnerFranchises = franchises.filter(f => f.owner_id !== user?.id);

      const { data: tickets, error: ticketsError } = await supabase
        .from('tickets')
        .select('id, franchise_id, amount, quantity, customer_name, created_at')
        .eq('payment_status', 'approved')
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString());

      if (ticketsError) throw ticketsError;

      const franchisesWithCommission: FranchiseWithCommission[] = partnerFranchises.map((franchise) => {
        const franchiseTickets = tickets.filter(t => t.franchise_id === franchise.id);
        const totalSales = franchiseTickets.reduce((acc, t) => acc + Number(t.amount), 0);
        const totalTickets = franchiseTickets.length;
        const totalStudents = franchiseTickets.reduce((acc, t) => acc + t.quantity, 0);
        
        const commissionType = franchise.commission_type || 'fixed';
        const commissionValue = Number(franchise.commission_value) || 2;

        const ticketDetails: TicketDetail[] = franchiseTickets.map(t => {
          let commission = 0;
          if (commissionType === 'fixed') {
            commission = t.quantity * commissionValue;
          } else if (commissionType === 'percentage') {
            commission = Number(t.amount) * (commissionValue / 100);
          }
          return {
            id: t.id,
            customer_name: t.customer_name,
            created_at: t.created_at,
            amount: Number(t.amount),
            quantity: t.quantity,
            commission,
          };
        });

        const commissionDue = ticketDetails.reduce((acc, t) => acc + t.commission, 0);

        return {
          id: franchise.id,
          name: franchise.name,
          city: franchise.city,
          state: franchise.state,
          commission_type: franchise.commission_type,
          commission_value: franchise.commission_value,
          totalSales,
          totalTickets,
          totalStudents,
          commissionDue,
          tickets: ticketDetails,
        };
      });

      return franchisesWithCommission.filter(f => f.totalTickets > 0 || f.totalSales > 0);
    },
    enabled: !!user?.id,
  });

  const totals = useMemo(() => {
    if (!franchisesWithSales) return { totalSales: 0, totalCommissions: 0, totalStudents: 0 };
    return {
      totalSales: franchisesWithSales.reduce((acc, f) => acc + f.totalSales, 0),
      totalCommissions: franchisesWithSales.reduce((acc, f) => acc + f.commissionDue, 0),
      totalStudents: franchisesWithSales.reduce((acc, f) => acc + f.totalStudents, 0),
    };
  }, [franchisesWithSales]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const handleExport = () => {
    if (!franchisesWithSales) return;

    const headers = ['Franquia', 'Cliente', 'Data', 'Alunos', 'Valor Venda', 'Comissão'].join(',');

    const rows: string[] = [];
    franchisesWithSales.forEach(f => {
      f.tickets.forEach(t => {
        rows.push([
          `"${f.name}"`,
          `"${t.customer_name}"`,
          format(new Date(t.created_at), 'dd/MM/yyyy'),
          t.quantity,
          formatCurrency(t.amount),
          formatCurrency(t.commission),
        ].join(','));
      });
    });

    const csv = [headers, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `comissoes_${selectedMonth}_${selectedYear}.csv`);
    link.click();
  };

  const toggleExpand = (franchiseId: string) => {
    setExpandedFranchise(prev => prev === franchiseId ? null : franchiseId);
  };

  return (
    <div className="space-y-6">
      {/* Header Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-3 md:pt-6">
            <div className="flex items-center gap-2 md:gap-3">
              <div className="p-2 bg-blue-500/10 rounded-lg">
                <DollarSign className="h-5 w-5 text-blue-500" />
              </div>
              <div className="min-w-0">
                <p className="text-xs md:text-sm text-muted-foreground">Vendas Totais (Franquias)</p>
                <p className="text-sm md:text-2xl font-bold truncate">{formatCurrency(totals.totalSales)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-3 md:pt-6">
            <div className="flex items-center gap-2 md:gap-3">
              <div className="p-2 bg-emerald-500/10 rounded-lg">
                <TrendingUp className="h-5 w-5 text-emerald-500" />
              </div>
              <div className="min-w-0">
                <p className="text-xs md:text-sm text-muted-foreground">Comissões a Receber</p>
                <p className="text-sm md:text-2xl font-bold text-emerald-500 truncate">{formatCurrency(totals.totalCommissions)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-3 md:pt-6">
            <div className="flex items-center gap-2 md:gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Building2 className="h-5 w-5 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-xs md:text-sm text-muted-foreground">Total de Alunos</p>
                <p className="text-sm md:text-2xl font-bold">{totals.totalStudents}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Card>
        <CardHeader className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
          <div>
            <CardTitle>Comissões a Receber</CardTitle>
            <CardDescription>
              Extrato de comissões devidas por cada franquia — clique para ver as vendas
            </CardDescription>
          </div>
          <Button variant="outline" onClick={handleExport} disabled={!franchisesWithSales?.length}>
            <Download className="h-4 w-4 mr-2" />
            Exportar CSV
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-4">
            <YearTimeline selectedYear={selectedYear} onYearChange={setSelectedYear} />
            <MonthSelector selectedMonth={selectedMonth} selectedYear={selectedYear} onMonthChange={setSelectedMonth} />
          </div>

          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
            </div>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8"></TableHead>
                    <TableHead>Franquia</TableHead>
                    <TableHead className="hidden md:table-cell">Localização</TableHead>
                    <TableHead className="hidden md:table-cell text-center">Tipo Comissão</TableHead>
                    <TableHead className="hidden md:table-cell text-center">Valor Config.</TableHead>
                    <TableHead className="text-right">Total Vendas</TableHead>
                    <TableHead className="text-center">Alunos</TableHead>
                    <TableHead className="text-right">Comissão Devida</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {franchisesWithSales?.map((franchise) => (
                    <>
                      <TableRow
                        key={franchise.id}
                        className="cursor-pointer"
                        onClick={() => toggleExpand(franchise.id)}
                      >
                        <TableCell className="w-8 px-2">
                          {expandedFranchise === franchise.id
                            ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
                            : <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          }
                        </TableCell>
                        <TableCell className="font-medium">{franchise.name}</TableCell>
                        <TableCell className="hidden md:table-cell">
                          {franchise.city}/{franchise.state}
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-center">
                          {franchise.commission_type === 'percentage' ? (
                            <Badge variant="outline" className="gap-1">
                              <Percent className="h-3 w-3" />
                              Percentual
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="gap-1">
                              <DollarSign className="h-3 w-3" />
                              Fixo
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-center">
                          {franchise.commission_type === 'percentage'
                            ? `${franchise.commission_value || 0}%`
                            : formatCurrency(franchise.commission_value || 2)
                          }
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(franchise.totalSales)}
                        </TableCell>
                        <TableCell className="text-center">{franchise.totalStudents}</TableCell>
                        <TableCell className="text-right font-bold text-emerald-500">
                          {formatCurrency(franchise.commissionDue)}
                        </TableCell>
                      </TableRow>
                      {expandedFranchise === franchise.id && (
                        <TableRow key={`${franchise.id}-details`}>
                          <TableCell colSpan={8} className="p-0">
                            <div className="bg-muted/30 p-4">
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead>Cliente</TableHead>
                                    <TableHead>Data</TableHead>
                                    <TableHead className="text-center">Alunos</TableHead>
                                    <TableHead className="text-right">Valor Venda</TableHead>
                                    <TableHead className="text-right">Comissão</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {franchise.tickets.map(ticket => (
                                    <TableRow key={ticket.id}>
                                      <TableCell>{ticket.customer_name}</TableCell>
                                      <TableCell>{format(new Date(ticket.created_at), 'dd/MM/yyyy', { locale: ptBR })}</TableCell>
                                      <TableCell className="text-center">{ticket.quantity}</TableCell>
                                      <TableCell className="text-right">{formatCurrency(ticket.amount)}</TableCell>
                                      <TableCell className="text-right font-semibold text-emerald-500">{formatCurrency(ticket.commission)}</TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  ))}
                  {(!franchisesWithSales || franchisesWithSales.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
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
    </div>
  );
};

export default CommissionsReport;
