import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DollarSign, Clock, CheckCircle, TrendingUp } from 'lucide-react';
import { format } from 'date-fns';

const months = [
  { value: '0', label: 'Todos os meses' },
  { value: '1', label: 'Janeiro' },
  { value: '2', label: 'Fevereiro' },
  { value: '3', label: 'Março' },
  { value: '4', label: 'Abril' },
  { value: '5', label: 'Maio' },
  { value: '6', label: 'Junho' },
  { value: '7', label: 'Julho' },
  { value: '8', label: 'Agosto' },
  { value: '9', label: 'Setembro' },
  { value: '10', label: 'Outubro' },
  { value: '11', label: 'Novembro' },
  { value: '12', label: 'Dezembro' },
];

const currentYear = new Date().getFullYear();
const years = Array.from({ length: 3 }, (_, i) => String(currentYear - i));

const formatCurrency = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

interface ComputedPayout {
  eventId: string;
  schoolName: string;
  eventDate: string;
  amount: number;
  isPaid: boolean;
  paidAt: string | null;
  notes: string | null;
}

const CollaboratorDashboard = () => {
  const { user } = useAuth();
  const [selectedMonth, setSelectedMonth] = useState('0');
  const [selectedYear, setSelectedYear] = useState(String(currentYear));

  // Get ALL beneficiary records for this user (seller, presenter, supervisor)
  const { data: beneficiaries = [] } = useQuery({
    queryKey: ['my-beneficiaries-all', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('commission_beneficiaries')
        .select('id, name, type, pix_key, pix_key_type, franchise_id')
        .eq('user_id', user!.id)
        .eq('is_active', true);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  const primaryBeneficiary = beneficiaries.find(b => b.type === 'seller') || beneficiaries[0];
  const beneficiaryIds = beneficiaries.map(b => b.id);

  // Calculate commissions from events + tickets
  const { data: computedPayouts = [], isLoading } = useQuery({
    queryKey: ['my-computed-payouts', beneficiaryIds, selectedMonth, selectedYear],
    queryFn: async () => {
      // Fetch events where this user is seller, presenter, or supervisor
      const { data: events, error: eventsError } = await supabase
        .from('events')
        .select(`
          id, event_date, school_name, franchise_id,
          seller_id, presenter_id, supervisor_id,
          seller_commission_pct, presenter_commission_pct, supervisor_commission_pct,
          school_commission_type, school_commission_value
        `)
        .eq('is_active', true);

      if (eventsError) throw eventsError;

      // Filter events where user is involved
      const myEvents = (events || []).filter(e =>
        beneficiaryIds.includes(e.seller_id!) ||
        beneficiaryIds.includes(e.presenter_id!) ||
        beneficiaryIds.includes(e.supervisor_id!)
      );

      // Apply date filter (use T12:00:00 to avoid timezone edge cases)
      const filteredEvents = myEvents.filter(e => {
        const parts = e.event_date.split('-');
        const year = parseInt(parts[0]);
        const month = parseInt(parts[1]);
        const filterYear = parseInt(selectedYear);
        if (year !== filterYear) return false;
        if (selectedMonth !== '0') {
          if (month !== parseInt(selectedMonth)) return false;
        }
        return true;
      });

      if (filteredEvents.length === 0) return [];

      const eventIds = filteredEvents.map(e => e.id);

      // Fetch approved tickets
      const { data: tickets } = await supabase
        .from('tickets')
        .select('event_id, amount, quantity')
        .in('event_id', eventIds)
        .eq('payment_status', 'approved');

      // Fetch existing payout records for these events
      const { data: existingPayouts } = await supabase
        .from('commission_payouts')
        .select('*')
        .in('event_id', eventIds);

      const results: ComputedPayout[] = [];

      filteredEvents.forEach(event => {
        const eventTickets = (tickets || []).filter(t => t.event_id === event.id);
        const grossRevenue = eventTickets.reduce((acc, t) => acc + Number(t.amount), 0);
        const totalStudents = eventTickets.reduce((acc, t) => acc + t.quantity, 0);

        const schoolType = event.school_commission_type || 'percentage';
        const schoolValue = Number(event.school_commission_value) || 10;
        const schoolComm = schoolType === 'percentage'
          ? grossRevenue * (schoolValue / 100)
          : schoolValue * totalStudents;
        const remaining = grossRevenue - schoolComm;

        // Check each role this user has in this event
        beneficiaries.forEach(ben => {
          let commAmount = 0;
          let payoutType = '';

          if (event.seller_id === ben.id) {
            commAmount = remaining * ((Number(event.seller_commission_pct) || 25) / 100);
            payoutType = 'seller';
          } else if (event.presenter_id === ben.id) {
            commAmount = remaining * ((Number(event.presenter_commission_pct) || 20) / 100);
            payoutType = 'presenter';
          } else if (event.supervisor_id === ben.id) {
            commAmount = remaining * ((Number(event.supervisor_commission_pct) || 0) / 100);
            payoutType = 'supervisor';
          }

          if (commAmount <= 0 || !payoutType) return;

          // Check if there's an existing payout record
          const existing = (existingPayouts || []).find(
            p => p.event_id === event.id && p.payout_type === payoutType
          );

          results.push({
            eventId: event.id,
            schoolName: event.school_name,
            eventDate: event.event_date,
            amount: commAmount,
            isPaid: existing?.is_paid || false,
            paidAt: existing?.paid_at || null,
            notes: existing?.notes || null,
          });
        });
      });

      return results.sort((a, b) => new Date(b.eventDate).getTime() - new Date(a.eventDate).getTime());
    },
    enabled: beneficiaryIds.length > 0,
  });

  const totalDue = computedPayouts.reduce((s, p) => s + p.amount, 0);
  const totalPaid = computedPayouts.filter(p => p.isPaid).reduce((s, p) => s + p.amount, 0);
  const totalPending = computedPayouts.filter(p => !p.isPaid).reduce((s, p) => s + p.amount, 0);
  const paidCount = computedPayouts.filter(p => p.isPaid).length;

  const typeLabel: Record<string, string> = {
    seller: 'Vendedor',
    presenter: 'Apresentador',
    supervisor: 'Supervisor',
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Meus Repasses</h1>
        {primaryBeneficiary && (
          <p className="text-muted-foreground">
            {primaryBeneficiary.name} · {typeLabel[primaryBeneficiary.type] || primaryBeneficiary.type}
            {!primaryBeneficiary.pix_key && (
              <span className="ml-2 text-yellow-600 dark:text-yellow-400 text-sm">
                ⚠ Cadastre sua chave PIX em Configurações
              </span>
            )}
          </p>
        )}
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <Select value={selectedMonth} onValueChange={setSelectedMonth}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {months.map(m => (
              <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={selectedYear} onValueChange={setSelectedYear}>
          <SelectTrigger className="w-28">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {years.map(y => (
              <SelectItem key={y} value={y}>{y}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <TrendingUp className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total Gerado</p>
                <p className="text-lg font-bold">{formatCurrency(totalDue)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/10">
                <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Recebido</p>
                <p className="text-lg font-bold text-green-600 dark:text-green-400">{formatCurrency(totalPaid)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-yellow-500/10">
                <Clock className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Pendente</p>
                <p className="text-lg font-bold text-yellow-600 dark:text-yellow-400">{formatCurrency(totalPending)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <DollarSign className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Pagamentos</p>
                <p className="text-lg font-bold">{paidCount} / {computedPayouts.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Payouts table */}
      <Card>
        <CardHeader>
          <CardTitle>Histórico de Repasses</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-10">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary" />
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Escola / Evento</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead>Pago em</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {computedPayouts.map((p, i) => (
                    <TableRow key={`${p.eventId}-${i}`}>
                      <TableCell className="font-medium">{p.schoolName}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {p.eventDate ? format(new Date(p.eventDate + 'T00:00:00'), 'dd/MM/yyyy') : ''}
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {formatCurrency(p.amount)}
                      </TableCell>
                      <TableCell className="text-center">
                        {p.isPaid ? (
                          <Badge className="bg-green-500/15 text-green-700 dark:text-green-400 border-0">Pago</Badge>
                        ) : (
                          <Badge variant="outline" className="text-yellow-700 dark:text-yellow-400 border-yellow-400/50">Pendente</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {p.paidAt ? format(new Date(p.paidAt), 'dd/MM/yyyy') : '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                  {computedPayouts.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-10 text-muted-foreground">
                        Nenhum repasse encontrado para o período selecionado
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

export default CollaboratorDashboard;
