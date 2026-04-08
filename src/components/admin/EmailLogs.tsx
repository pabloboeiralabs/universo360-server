import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Mail, RefreshCw, Search, CheckCircle2, XCircle, SkipForward, Filter } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface EmailLog {
  id: string;
  ticket_id: string | null;
  franchise_id: string | null;
  recipient_email: string;
  email_type: string;
  subject: string | null;
  status: string;
  error_message: string | null;
  sent_at: string;
  cc_email: string | null;
}

const EMAIL_TYPE_LABELS: Record<string, { label: string; color: string }> = {
  receipt: { label: 'Recibo de Compra',        color: 'bg-primary/10 text-primary border-primary/20' },
  refund:  { label: 'Comprovante de Estorno',  color: 'bg-destructive/10 text-destructive border-destructive/20' },
};

const STATUS_CONFIG: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  sent:    { label: 'Enviado',  icon: <CheckCircle2 className="h-3.5 w-3.5" />, color: 'bg-primary/10 text-primary border-primary/20' },
  failed:  { label: 'Falhou',   icon: <XCircle className="h-3.5 w-3.5" />,      color: 'bg-destructive/10 text-destructive border-destructive/20' },
  skipped: { label: 'Ignorado', icon: <SkipForward className="h-3.5 w-3.5" />,  color: 'bg-muted text-muted-foreground border-border' },
};

export default function EmailLogs() {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const { data: logs = [], isLoading, refetch } = useQuery({
    queryKey: ['email-logs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('email_logs')
        .select('*')
        .order('sent_at', { ascending: false })
        .limit(500);
      if (error) throw error;
      return data as EmailLog[];
    },
  });

  const filtered = logs.filter(log => {
    const matchSearch =
      !search ||
      log.recipient_email.toLowerCase().includes(search.toLowerCase()) ||
      (log.subject ?? '').toLowerCase().includes(search.toLowerCase());
    const matchType   = typeFilter === 'all'   || log.email_type === typeFilter;
    const matchStatus = statusFilter === 'all' || log.status === statusFilter;
    return matchSearch && matchType && matchStatus;
  });

  const sentCount    = logs.filter(l => l.status === 'sent').length;
  const failedCount  = logs.filter(l => l.status === 'failed').length;
  const refundCount  = logs.filter(l => l.email_type === 'refund').length;
  const receiptCount = logs.filter(l => l.email_type === 'receipt').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Mail className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Histórico de E-mails</h1>
            <p className="text-sm text-muted-foreground">Rastreamento de todas as comunicações enviadas</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-2">
          <RefreshCw className="h-4 w-4" />
          Atualizar
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total Enviados', value: sentCount,    icon: <CheckCircle2 className="h-4 w-4 text-primary" />,    color: 'text-primary' },
          { label: 'Com Falha',      value: failedCount,  icon: <XCircle className="h-4 w-4 text-destructive" />,     color: 'text-destructive' },
          { label: 'Recibos',        value: receiptCount, icon: <Mail className="h-4 w-4 text-primary" />,            color: 'text-foreground' },
          { label: 'Estornos',       value: refundCount,  icon: <Mail className="h-4 w-4 text-destructive" />,        color: 'text-foreground' },
        ].map(({ label, value, icon, color }) => (
          <Card key={label} className="border-border">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-muted">{icon}</div>
              <div>
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className={`text-xl font-bold ${color}`}>{value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <Card className="border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Filter className="h-4 w-4" /> Filtros
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por e-mail ou assunto..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os tipos</SelectItem>
                <SelectItem value="receipt">Recibo de Compra</SelectItem>
                <SelectItem value="refund">Comprovante de Estorno</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                <SelectItem value="sent">Enviado</SelectItem>
                <SelectItem value="failed">Falhou</SelectItem>
                <SelectItem value="skipped">Ignorado</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card className="border-border">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground">
              <RefreshCw className="h-5 w-5 animate-spin mr-2" /> Carregando...
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
              <Mail className="h-10 w-10 opacity-30" />
              <p className="text-sm">Nenhum e-mail encontrado</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead className="text-muted-foreground pl-6">Data/Hora</TableHead>
                    <TableHead className="text-muted-foreground">Destinatário</TableHead>
                    <TableHead className="text-muted-foreground">CC</TableHead>
                    <TableHead className="text-muted-foreground">Tipo</TableHead>
                    <TableHead className="text-muted-foreground">Assunto</TableHead>
                    <TableHead className="text-muted-foreground">Status</TableHead>
                    <TableHead className="text-muted-foreground pr-6">Ingresso</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(log => {
                    const typeConf   = EMAIL_TYPE_LABELS[log.email_type] ?? { label: log.email_type, color: 'bg-muted text-muted-foreground border-border' };
                    const statusConf = STATUS_CONFIG[log.status] ?? STATUS_CONFIG.sent;
                    return (
                      <TableRow key={log.id} className="border-border hover:bg-muted/30">
                        <TableCell className="pl-6 text-sm text-foreground whitespace-nowrap">
                          {format(new Date(log.sent_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                        </TableCell>
                        <TableCell className="text-sm text-foreground">
                          {log.recipient_email}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {log.cc_email ?? '—'}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`text-xs ${typeConf.color}`}>
                            {typeConf.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground max-w-[240px] truncate">
                          {log.subject ?? '—'}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`text-xs flex items-center gap-1 w-fit ${statusConf.color}`}>
                            {statusConf.icon}
                            {statusConf.label}
                          </Badge>
                          {log.status === 'failed' && log.error_message && (
                            <p className="text-xs text-destructive/70 mt-1 max-w-[180px] truncate" title={log.error_message}>
                              {log.error_message}
                            </p>
                          )}
                        </TableCell>
                        <TableCell className="pr-6 text-xs text-muted-foreground font-mono">
                          {log.ticket_id ? log.ticket_id.slice(0, 8) + '…' : '—'}
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
}
