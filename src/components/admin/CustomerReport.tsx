import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Calendar, DollarSign, Users, Building2, Download } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface Customer {
  id: string;
  name: string;
  cnpj: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  state: string | null;
  street: string | null;
  number: string | null;
  neighborhood: string | null;
}

interface CustomerReportProps {
  customer: Customer;
  onBack: () => void;
}

interface EventWithTickets {
  id: string;
  school_name: string;
  event_date: string;
  event_time: string;
  price: number;
  total_capacity: number;
  available_spots: number;
  tickets: { quantity: number; amount: number; payment_status: string }[];
}

const CustomerReport = ({ customer, onBack }: CustomerReportProps) => {
  const { data: events, isLoading } = useQuery({
    queryKey: ['customer-events', customer.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('events')
        .select(`
          id,
          school_name,
          event_date,
          event_time,
          price,
          total_capacity,
          available_spots,
          tickets (
            quantity,
            amount,
            payment_status
          )
        `)
        .eq('customer_id', customer.id)
        .order('event_date', { ascending: false });

      if (error) throw error;
      return data as EventWithTickets[];
    },
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  // Calculate totals
  const stats = events?.reduce(
    (acc, event) => {
      const approvedTickets = event.tickets.filter(t => t.payment_status === 'approved');
      const eventTickets = approvedTickets.reduce((sum, t) => sum + t.quantity, 0);
      const eventRevenue = approvedTickets.reduce((sum, t) => sum + Number(t.amount), 0);
      
      return {
        totalEvents: acc.totalEvents + 1,
        totalTickets: acc.totalTickets + eventTickets,
        totalRevenue: acc.totalRevenue + eventRevenue,
      };
    },
    { totalEvents: 0, totalTickets: 0, totalRevenue: 0 }
  ) || { totalEvents: 0, totalTickets: 0, totalRevenue: 0 };

  // Prepare chart data (last 6 months)
  const chartData = events
    ?.filter(e => e.tickets.some(t => t.payment_status === 'approved'))
    .slice(0, 12)
    .reverse()
    .map(event => ({
      date: format(new Date(event.event_date + 'T00:00:00'), 'dd/MM', { locale: ptBR }),
      ingressos: event.tickets
        .filter(t => t.payment_status === 'approved')
        .reduce((sum, t) => sum + t.quantity, 0),
    })) || [];

  const exportToCSV = () => {
    if (!events) return;

    const csvContent = [
      ['Data', 'Evento', 'Ingressos', 'Receita', 'Status'].join(','),
      ...events.map(event => {
        const approvedTickets = event.tickets.filter(t => t.payment_status === 'approved');
        const tickets = approvedTickets.reduce((sum, t) => sum + t.quantity, 0);
        const revenue = approvedTickets.reduce((sum, t) => sum + Number(t.amount), 0);
        return [
          format(new Date(event.event_date + 'T00:00:00'), 'dd/MM/yyyy'),
          `"${event.school_name}"`,
          tickets,
          revenue.toFixed(2),
          tickets > 0 ? 'Confirmado' : 'Sem vendas'
        ].join(',');
      })
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `relatorio-${customer.name.replace(/\s+/g, '-').toLowerCase()}.csv`;
    link.click();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h2 className="text-2xl font-bold">{customer.name}</h2>
            <p className="text-muted-foreground">
              {customer.cnpj && `CNPJ: ${customer.cnpj}`}
              {customer.city && customer.state && ` • ${customer.city}/${customer.state}`}
            </p>
          </div>
        </div>
        <Button variant="outline" onClick={exportToCSV}>
          <Download className="h-4 w-4 mr-2" />
          Exportar CSV
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Eventos</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalEvents}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ingressos Vendidos</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalTickets}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Receita Total</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats.totalRevenue)}</div>
          </CardContent>
        </Card>
      </div>

      {/* Chart */}
      {chartData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Histórico de Ingressos</CardTitle>
            <CardDescription>Ingressos vendidos por evento</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Line
                    type="monotone"
                    dataKey="ingressos"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Events Table */}
      <Card>
        <CardHeader>
          <CardTitle>Histórico de Eventos</CardTitle>
          <CardDescription>Todos os eventos realizados para este cliente</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary" />
            </div>
          ) : events?.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum evento encontrado para este cliente
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Evento</TableHead>
                    <TableHead>Ingressos</TableHead>
                    <TableHead>Receita</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {events?.map((event) => {
                    const approvedTickets = event.tickets.filter(t => t.payment_status === 'approved');
                    const tickets = approvedTickets.reduce((sum, t) => sum + t.quantity, 0);
                    const revenue = approvedTickets.reduce((sum, t) => sum + Number(t.amount), 0);
                    
                    return (
                      <TableRow key={event.id}>
                        <TableCell>
                          {format(new Date(event.event_date + 'T00:00:00'), 'dd/MM/yyyy', { locale: ptBR })}
                        </TableCell>
                        <TableCell className="font-medium">{event.school_name}</TableCell>
                        <TableCell>{tickets}</TableCell>
                        <TableCell>{formatCurrency(revenue)}</TableCell>
                        <TableCell>
                          <Badge variant={tickets > 0 ? 'default' : 'secondary'}>
                            {tickets > 0 ? 'Confirmado' : 'Sem vendas'}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default CustomerReport;
