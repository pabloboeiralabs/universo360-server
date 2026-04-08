import { useState } from 'react';
import { Search, FileText, FileSpreadsheet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

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

interface TransactionsTableProps {
  transactions: Transaction[];
  monthName: string;
  year: number;
  isLoading?: boolean;
  onExportPDF: () => void;
  onExportExcel: () => void;
}

const TransactionsTable = ({ 
  transactions, 
  monthName, 
  year, 
  isLoading,
  onExportPDF,
  onExportExcel 
}: TransactionsTableProps) => {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredTransactions = transactions.filter(t => 
    t.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.customer_email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.event_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

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

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-foreground capitalize">
            {monthName} De {year}
          </h3>
          <p className="text-sm text-muted-foreground">
            {filteredTransactions.length} transações - Todas
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 w-48 bg-card border-border"
            />
          </div>
          
          <Button 
            variant="outline" 
            size="sm" 
            onClick={onExportPDF}
            className="gap-2"
          >
            <FileText className="h-4 w-4" />
            <span className="hidden sm:inline">Extrato PDF</span>
          </Button>
          
          <Button 
            variant="outline" 
            size="sm" 
            onClick={onExportExcel}
            className="gap-2"
          >
            <FileSpreadsheet className="h-4 w-4" />
            <span className="hidden sm:inline">Exportar Excel</span>
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-card hover:bg-card">
              <TableHead className="text-muted-foreground">Data</TableHead>
              <TableHead className="text-muted-foreground">Cliente</TableHead>
              <TableHead className="text-muted-foreground hidden md:table-cell">Evento</TableHead>
              <TableHead className="text-muted-foreground text-center">Qtd</TableHead>
              <TableHead className="text-muted-foreground text-right">Valor</TableHead>
              <TableHead className="text-muted-foreground text-center">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary mx-auto"></div>
                </TableCell>
              </TableRow>
            ) : filteredTransactions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  Nenhuma transação encontrada
                </TableCell>
              </TableRow>
            ) : (
              filteredTransactions.map((transaction) => (
                <TableRow key={transaction.id} className="hover:bg-muted/50">
                  <TableCell className="text-foreground text-xs md:text-sm">
                    {format(new Date(transaction.created_at), 'dd/MM/yyyy', { locale: ptBR })}
                  </TableCell>
                  <TableCell>
                    <div>
                      <p className="font-medium text-foreground text-xs md:text-sm">{transaction.customer_name}</p>
                      <p className="text-xs text-muted-foreground hidden md:block">{transaction.customer_email}</p>
                    </div>
                  </TableCell>
                  <TableCell className="text-foreground hidden md:table-cell">{transaction.event_name}</TableCell>
                  <TableCell className="text-center text-foreground text-xs md:text-sm">{transaction.quantity}</TableCell>
                  <TableCell className="text-right font-medium text-foreground text-xs md:text-sm">
                    {formatCurrency(transaction.amount)}
                  </TableCell>
                  <TableCell className="text-center">
                    {getStatusBadge(transaction.payment_status)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default TransactionsTable;
