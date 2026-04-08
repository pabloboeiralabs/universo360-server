import { useState, useEffect, useMemo } from 'react';
import { Search, ShoppingCart, FileSpreadsheet, FileDown, Loader2, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import { generateRefundReceiptPDF } from '@/lib/refundReceipt';

interface Sale {
  id: string;
  customer_name: string;
  customer_email: string;
  student_name: string | null;
  class_grade: string | null;
  event_name: string;
  event_date: string | null;
  franchise_name: string;
  quantity: number;
  amount: number;
  payment_status: string;
  payment_method: string | null;
  created_at: string;
  refunded_at: string | null;
  refund_reason: string | null;
}

const SalesHistory = () => {
  const { toast } = useToast();
  const [sales, setSales] = useState<Sale[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [generatingPDF, setGeneratingPDF] = useState<string | null>(null);
  const [filterPaymentMethod, setFilterPaymentMethod] = useState<string>('all');
  const [filterEvent, setFilterEvent] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  useEffect(() => {
    fetchSales();
  }, []);

  const fetchSales = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('tickets')
        .select(`
          id,
          customer_name,
          customer_email,
          student_name,
          class_grade,
          quantity,
          amount,
          payment_status,
          payment_method,
          created_at,
          refunded_at,
          refund_reason,
          events(school_name, event_date),
          franchises(name)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const formattedSales: Sale[] = (data || []).map(sale => ({
        id: sale.id,
        customer_name: sale.customer_name,
        customer_email: sale.customer_email,
        student_name: sale.student_name,
        class_grade: sale.class_grade,
        event_name: (sale.events as { school_name: string; event_date: string } | null)?.school_name || 'Evento',
        event_date: (sale.events as { school_name: string; event_date: string } | null)?.event_date || null,
        franchise_name: (sale.franchises as { name: string } | null)?.name || 'Franquia',
        quantity: sale.quantity,
        amount: Number(sale.amount),
        payment_status: sale.payment_status,
        payment_method: sale.payment_method,
        created_at: sale.created_at,
        refunded_at: sale.refunded_at,
        refund_reason: sale.refund_reason,
      }));

      setSales(formattedSales);
    } catch (error) {
      console.error('Error fetching sales:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar as vendas.',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const uniqueEvents = useMemo(() => {
    const names = [...new Set(sales.map(s => s.event_name))];
    return names.sort();
  }, [sales]);

  const paymentMethodLabels: Record<string, string> = {
    pix: 'PIX',
    credit_card: 'Cartão de Crédito',
    cash: 'Dinheiro',
    free: 'Gratuito',
  };

  const uniquePaymentMethods = useMemo(() => {
    const methods = [...new Set(sales.map(s => s.payment_method).filter(Boolean))] as string[];
    return methods.sort();
  }, [sales]);

  const filteredSales = useMemo(() => {
    return sales.filter(s => {
      const matchesSearch =
        !searchTerm ||
        s.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.customer_email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.event_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.franchise_name.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesMethod = filterPaymentMethod === 'all' || s.payment_method === filterPaymentMethod;
      const matchesEvent = filterEvent === 'all' || s.event_name === filterEvent;
      const matchesStatus = filterStatus === 'all' || s.payment_status === filterStatus;

      return matchesSearch && matchesMethod && matchesEvent && matchesStatus;
    });
  }, [sales, searchTerm, filterPaymentMethod, filterEvent, filterStatus]);

  const hasActiveFilters = filterPaymentMethod !== 'all' || filterEvent !== 'all' || filterStatus !== 'all';

  const clearFilters = () => {
    setFilterPaymentMethod('all');
    setFilterEvent('all');
    setFilterStatus('all');
    setSearchTerm('');
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <Badge className="bg-primary/20 text-primary border-primary/30">Aprovado</Badge>;
      case 'pending':
        return <Badge className="bg-yellow-500/20 text-yellow-500 border-yellow-500/30">Pendente</Badge>;
      case 'rejected':
        return <Badge className="bg-destructive/20 text-destructive border-destructive/30">Rejeitado</Badge>;
      case 'refunded':
        return <Badge className="bg-purple-500/20 text-purple-500 border-purple-500/30">Estornado</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const handleDownloadRefundReceipt = async (sale: Sale) => {
    if (!sale.refunded_at) {
      toast({ title: 'Erro', description: 'Data do estorno não encontrada.', variant: 'destructive' });
      return;
    }
    setGeneratingPDF(sale.id);
    try {
      generateRefundReceiptPDF({
        ticketId: sale.id,
        customerName: sale.customer_name,
        studentName: sale.student_name,
        classGrade: sale.class_grade,
        eventName: sale.event_name,
        eventDate: sale.event_date,
        franchiseName: sale.franchise_name,
        amount: sale.amount,
        refundReason: sale.refund_reason || 'Não informado',
        refundedAt: sale.refunded_at,
        paymentMethod: sale.payment_method,
      });
      toast({ title: 'Comprovante gerado', description: 'O PDF foi baixado com sucesso.' });
    } catch (e) {
      console.error(e);
      toast({ title: 'Erro', description: 'Não foi possível gerar o PDF.', variant: 'destructive' });
    } finally {
      setGeneratingPDF(null);
    }
  };

  const handleExport = () => {
    const headers = ['Data', 'Cliente', 'Email', 'Evento', 'Franquia', 'Qtd', 'Valor', 'Status'];
    const rows = filteredSales.map(s => [
      format(new Date(s.created_at), 'dd/MM/yyyy HH:mm'),
      s.customer_name,
      s.customer_email,
      s.event_name,
      s.franchise_name,
      s.quantity.toString(),
      s.amount.toFixed(2),
      s.payment_status
    ]);

    const csvContent = [headers, ...rows]
      .map(row => row.join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `vendas_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast({
      title: 'Exportação concluída',
      description: 'O arquivo CSV foi baixado.'
    });
  };

  const totalApproved = filteredSales
    .filter(s => s.payment_status === 'approved')
    .reduce((sum, s) => sum + s.amount, 0);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Vendas</h1>
          <p className="text-muted-foreground">
            {filteredSales.length} vendas • Total aprovado: {formatCurrency(totalApproved)}
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleExport} className="gap-2">
            <FileSpreadsheet className="h-4 w-4" />
            Exportar
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="relative flex-1 min-w-[180px] max-w-[250px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 bg-card border-border"
          />
        </div>

        <Select value={filterEvent} onValueChange={setFilterEvent}>
          <SelectTrigger className="w-[200px] bg-card border-border">
            <SelectValue placeholder="Evento" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os Eventos</SelectItem>
            {uniqueEvents.map(name => (
              <SelectItem key={name} value={name}>{name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filterPaymentMethod} onValueChange={setFilterPaymentMethod}>
          <SelectTrigger className="w-[180px] bg-card border-border">
            <SelectValue placeholder="Pagamento" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os Métodos</SelectItem>
            {uniquePaymentMethods.map(method => (
              <SelectItem key={method} value={method}>
                {paymentMethodLabels[method] || method}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[160px] bg-card border-border">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os Status</SelectItem>
            <SelectItem value="approved">Aprovado</SelectItem>
            <SelectItem value="pending">Pendente</SelectItem>
            <SelectItem value="rejected">Rejeitado</SelectItem>
            <SelectItem value="refunded">Estornado</SelectItem>
          </SelectContent>
        </Select>

        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1 text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
            Limpar
          </Button>
        )}
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
        </div>
      ) : sales.length === 0 ? (
        <Card className="p-12 text-center">
          <ShoppingCart className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-foreground mb-2">Nenhuma venda</h3>
          <p className="text-muted-foreground">As vendas aparecerão aqui.</p>
        </Card>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-card hover:bg-card">
                <TableHead className="text-muted-foreground">Data</TableHead>
                <TableHead className="text-muted-foreground">Cliente</TableHead>
                <TableHead className="text-muted-foreground">Evento</TableHead>
                <TableHead className="text-muted-foreground">Franquia</TableHead>
                <TableHead className="text-muted-foreground text-center">Qtd</TableHead>
                <TableHead className="text-muted-foreground text-right">Valor</TableHead>
                <TableHead className="text-muted-foreground text-center">Status</TableHead>
                <TableHead className="text-muted-foreground text-center w-20">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredSales.map((sale) => (
                <TableRow key={sale.id} className={`hover:bg-muted/50 ${sale.payment_status === 'refunded' ? 'bg-purple-500/5' : ''}`}>
                  <TableCell className="text-foreground">
                    {format(new Date(sale.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                  </TableCell>
                  <TableCell>
                    <div>
                      <p className="font-medium text-foreground">{sale.customer_name}</p>
                      <p className="text-xs text-muted-foreground">{sale.customer_email}</p>
                    </div>
                  </TableCell>
                  <TableCell className="text-foreground">{sale.event_name}</TableCell>
                  <TableCell className="text-muted-foreground">{sale.franchise_name}</TableCell>
                  <TableCell className="text-center text-foreground">{sale.quantity}</TableCell>
                  <TableCell className="text-right font-medium text-foreground">
                    {formatCurrency(sale.amount)}
                  </TableCell>
                  <TableCell className="text-center">
                    {getStatusBadge(sale.payment_status)}
                  </TableCell>
                  <TableCell className="text-center">
                    {sale.payment_status === 'refunded' && sale.refunded_at && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-purple-600 hover:text-purple-700 hover:bg-purple-500/10"
                        title="Baixar comprovante de estorno"
                        disabled={generatingPDF === sale.id}
                        onClick={() => handleDownloadRefundReceipt(sale)}
                      >
                        {generatingPDF === sale.id
                          ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          : <FileDown className="h-3.5 w-3.5" />
                        }
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
};

export default SalesHistory;
