import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { 
  Download, 
  DollarSign, 
  Users, 
  CheckCircle2, 
  Clock, 
  Filter,
  User,
  Presentation,
  School,
  Check,
  CalendarIcon
} from 'lucide-react';
import MonthSelector from './MonthSelector';
import YearTimeline from './YearTimeline';
import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription';

interface PayoutItem {
  eventId: string;
  eventDate: string;
  schoolName: string;
  franchiseId: string;
  franchiseName: string;
  beneficiaryName: string;
  payoutType: 'seller' | 'presenter' | 'supervisor' | 'school';
  amount: number;
  totalStudents: number;
  grossRevenue: number;
  isPaid: boolean;
  paidAt: string | null;
  notes: string | null;
}

interface CommissionPayoutsReportProps {
  franchiseId?: string | null;
}

const CommissionPayoutsReport = ({ franchiseId }: CommissionPayoutsReportProps = {}) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [filterType, setFilterType] = useState<'all' | 'seller' | 'presenter' | 'supervisor' | 'school'>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'paid'>('all');
  const [filterBeneficiary, setFilterBeneficiary] = useState<string>('all');
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [markPaidDialog, setMarkPaidDialog] = useState(false);
  const [paymentNotes, setPaymentNotes] = useState('');
  const [paymentDate, setPaymentDate] = useState<Date>(new Date());

  // Realtime subscriptions for auto-refresh
  useRealtimeSubscription('events', [['commission-payouts', selectedYear, selectedMonth, user?.id]]);
  useRealtimeSubscription('tickets', [['commission-payouts', selectedYear, selectedMonth, user?.id]]);
  useRealtimeSubscription('commission_payouts', [['commission-payouts', selectedYear, selectedMonth, user?.id]]);

  // Fetch events with tickets for the period
  const { data: payoutData, isLoading } = useQuery({
    queryKey: ['commission-payouts', selectedYear, selectedMonth, user?.id],
    queryFn: async () => {
      const startDate = new Date(selectedYear, selectedMonth - 1, 1);
      const endDate = new Date(selectedYear, selectedMonth, 0, 23, 59, 59);

      // Fetch events with their tickets
      let eventsQuery = supabase
        .from('events')
        .select(`
          id,
          event_date,
          school_name,
          franchise_id,
          seller_id,
          presenter_id,
          supervisor_id,
          seller_commission_pct,
          presenter_commission_pct,
          supervisor_commission_pct,
          school_commission_type,
          school_commission_value,
          franchises!inner(id, name)
        `)
        .gte('event_date', startDate.toISOString().split('T')[0])
        .lte('event_date', endDate.toISOString().split('T')[0])
        .eq('is_active', true);

      if (franchiseId) {
        eventsQuery = eventsQuery.eq('franchise_id', franchiseId);
      }

      const { data: events, error: eventsError } = await eventsQuery;

      if (eventsError) throw eventsError;

      // Fetch beneficiary names
      const beneficiaryIds = new Set<string>();
      events?.forEach(e => {
        if ((e as any).seller_id) beneficiaryIds.add((e as any).seller_id);
        if ((e as any).presenter_id) beneficiaryIds.add((e as any).presenter_id);
        if ((e as any).supervisor_id) beneficiaryIds.add((e as any).supervisor_id);
      });
      
      const beneficiaryMap = new Map<string, string>();
      if (beneficiaryIds.size > 0) {
        const { data: bens } = await supabase
          .from('commission_beneficiaries')
          .select('id, name')
          .in('id', Array.from(beneficiaryIds));
        bens?.forEach(b => beneficiaryMap.set(b.id, b.name));
      }

      // Fetch approved tickets for these events
      const eventIds = events?.map(e => e.id) || [];
      if (eventIds.length === 0) return [];

      const { data: tickets, error: ticketsError } = await supabase
        .from('tickets')
        .select('event_id, amount, quantity')
        .in('event_id', eventIds)
        .eq('payment_status', 'approved');

      if (ticketsError) throw ticketsError;

      // Fetch existing payout records
      const { data: existingPayouts, error: payoutsError } = await supabase
        .from('commission_payouts')
        .select('*')
        .in('event_id', eventIds);

      if (payoutsError) throw payoutsError;

      // Build payout items
      const payoutItems: PayoutItem[] = [];

      events?.forEach(event => {
        const eventTickets = tickets?.filter(t => t.event_id === event.id) || [];
        const grossRevenue = eventTickets.reduce((acc, t) => acc + Number(t.amount), 0);
        const totalStudents = eventTickets.reduce((acc, t) => acc + t.quantity, 0);

        if (grossRevenue === 0) return;

        const sellerPct = Number(event.seller_commission_pct) || 25;
        const presenterPct = Number(event.presenter_commission_pct) || 20;
        const supervisorPct = Number((event as any).supervisor_commission_pct) || 0;
        const schoolType = event.school_commission_type || 'percentage';
        const schoolValue = Number(event.school_commission_value) || 10;

        // 1. Primeiro calcula comissão da escola sobre o bruto
        const schoolAmount = schoolType === 'percentage' 
          ? grossRevenue * (schoolValue / 100) 
          : schoolValue * totalStudents;

        // 2. Base restante após deduzir escola
        const remainingAfterSchool = grossRevenue - schoolAmount;

        // 3. Vendedor, apresentador e supervisor são calculados sobre o RESTANTE
        const sellerAmount = remainingAfterSchool * (sellerPct / 100);
        const presenterAmount = remainingAfterSchool * (presenterPct / 100);
        const supervisorAmount = remainingAfterSchool * (supervisorPct / 100);

        const franchiseData = event.franchises as unknown as { id: string; name: string };

        // Seller payout
        const sellerPayout = existingPayouts?.find(
          p => p.event_id === event.id && p.payout_type === 'seller'
        );
        payoutItems.push({
          eventId: event.id,
          eventDate: event.event_date,
          schoolName: event.school_name,
          franchiseId: event.franchise_id,
          franchiseName: franchiseData?.name || 'N/A',
          beneficiaryName: beneficiaryMap.get((event as any).seller_id) || '—',
          payoutType: 'seller',
          amount: sellerAmount,
          totalStudents,
          grossRevenue,
          isPaid: sellerPayout?.is_paid || false,
          paidAt: sellerPayout?.paid_at || null,
          notes: sellerPayout?.notes || null,
        });

        // Presenter payout
        const presenterPayout = existingPayouts?.find(
          p => p.event_id === event.id && p.payout_type === 'presenter'
        );
        payoutItems.push({
          eventId: event.id,
          eventDate: event.event_date,
          schoolName: event.school_name,
          franchiseId: event.franchise_id,
          franchiseName: franchiseData?.name || 'N/A',
          beneficiaryName: beneficiaryMap.get((event as any).presenter_id) || '—',
          payoutType: 'presenter',
          amount: presenterAmount,
          totalStudents,
          grossRevenue,
          isPaid: presenterPayout?.is_paid || false,
          paidAt: presenterPayout?.paid_at || null,
          notes: presenterPayout?.notes || null,
        });

        // Supervisor payout
        if (supervisorAmount > 0) {
          const supervisorPayout = existingPayouts?.find(
            p => p.event_id === event.id && p.payout_type === 'supervisor'
          );
          payoutItems.push({
            eventId: event.id,
            eventDate: event.event_date,
            schoolName: event.school_name,
            franchiseId: event.franchise_id,
            franchiseName: franchiseData?.name || 'N/A',
            beneficiaryName: beneficiaryMap.get((event as any).supervisor_id) || '—',
            payoutType: 'supervisor',
            amount: supervisorAmount,
            totalStudents,
            grossRevenue,
            isPaid: supervisorPayout?.is_paid || false,
            paidAt: supervisorPayout?.paid_at || null,
            notes: supervisorPayout?.notes || null,
          });
        }

        // School payout
        const schoolPayout = existingPayouts?.find(
          p => p.event_id === event.id && p.payout_type === 'school'
        );
        payoutItems.push({
          eventId: event.id,
          eventDate: event.event_date,
          schoolName: event.school_name,
          franchiseId: event.franchise_id,
          franchiseName: franchiseData?.name || 'N/A',
          beneficiaryName: event.school_name,
          payoutType: 'school',
          amount: schoolAmount,
          totalStudents,
          grossRevenue,
          isPaid: schoolPayout?.is_paid || false,
          paidAt: schoolPayout?.paid_at || null,
          notes: schoolPayout?.notes || null,
        });
      });

      return payoutItems;
    },
    enabled: !!user?.id,
  });

  // Mark as paid mutation
  const markAsPaidMutation = useMutation({
    mutationFn: async (items: PayoutItem[]) => {
      const startDate = new Date(selectedYear, selectedMonth - 1, 1);
      const endDate = new Date(selectedYear, selectedMonth, 0);

      for (const item of items) {
        // Check if record exists
        const { data: existing } = await supabase
          .from('commission_payouts')
          .select('id')
          .eq('event_id', item.eventId)
          .eq('payout_type', item.payoutType)
          .single();

        if (existing) {
          // Update existing
          await supabase
            .from('commission_payouts')
            .update({
              is_paid: true,
              paid_at: paymentDate.toISOString(),
              paid_by: user?.id,
              notes: paymentNotes || null,
            })
            .eq('id', existing.id);
        } else {
          // Insert new
          await supabase
            .from('commission_payouts')
            .insert({
              franchise_id: item.franchiseId,
              event_id: item.eventId,
              payout_type: item.payoutType,
              amount: item.amount,
              period_start: startDate.toISOString().split('T')[0],
              period_end: endDate.toISOString().split('T')[0],
              is_paid: true,
              paid_at: paymentDate.toISOString(),
              paid_by: user?.id,
              notes: paymentNotes || null,
            });
        }
      }
    },
    onSuccess: () => {
      toast.success('Pagamentos marcados como realizados!');
      queryClient.invalidateQueries({ queryKey: ['commission-payouts'] });
      setSelectedItems(new Set());
      setMarkPaidDialog(false);
      setPaymentNotes('');
    },
    onError: () => {
      toast.error('Erro ao marcar pagamentos');
    },
  });

  const filteredData = useMemo(() => {
    if (!payoutData) return [];
    
    return payoutData.filter(item => {
      if (filterType !== 'all' && item.payoutType !== filterType) return false;
      if (filterStatus === 'pending' && item.isPaid) return false;
      if (filterStatus === 'paid' && !item.isPaid) return false;
      if (filterBeneficiary !== 'all' && item.beneficiaryName !== filterBeneficiary) return false;
      return true;
    });
  }, [payoutData, filterType, filterStatus, filterBeneficiary]);

  const beneficiaryNames = useMemo(() => {
    if (!payoutData) return [];
    const names = new Set(payoutData.map(p => p.beneficiaryName).filter(n => n && n !== '—'));
    return Array.from(names).sort();
  }, [payoutData]);

  const stats = useMemo(() => {
    if (!payoutData) return { totalPending: 0, totalPaid: 0, sellerPending: 0, presenterPending: 0, supervisorPending: 0, schoolPending: 0 };
    
    const pending = payoutData.filter(p => !p.isPaid);
    const paid = payoutData.filter(p => p.isPaid);
    
    return {
      totalPending: pending.reduce((acc, p) => acc + p.amount, 0),
      totalPaid: paid.reduce((acc, p) => acc + p.amount, 0),
      sellerPending: pending.filter(p => p.payoutType === 'seller').reduce((acc, p) => acc + p.amount, 0),
      presenterPending: pending.filter(p => p.payoutType === 'presenter').reduce((acc, p) => acc + p.amount, 0),
      supervisorPending: pending.filter(p => p.payoutType === 'supervisor').reduce((acc, p) => acc + p.amount, 0),
      schoolPending: pending.filter(p => p.payoutType === 'school').reduce((acc, p) => acc + p.amount, 0),
    };
  }, [payoutData]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('pt-BR');
  };

  const getPayoutTypeLabel = (type: string) => {
    switch (type) {
      case 'seller': return 'Vendedor';
      case 'presenter': return 'Apresentador';
      case 'supervisor': return 'Supervisor';
      case 'school': return 'Escola';
      default: return type;
    }
  };

  const getPayoutTypeIcon = (type: string) => {
    switch (type) {
      case 'seller': return <User className="h-4 w-4" />;
      case 'presenter': return <Presentation className="h-4 w-4" />;
      case 'supervisor': return <Users className="h-4 w-4" />;
      case 'school': return <School className="h-4 w-4" />;
      default: return <DollarSign className="h-4 w-4" />;
    }
  };

  const handleSelectItem = (key: string, checked: boolean) => {
    const newSelected = new Set(selectedItems);
    if (checked) {
      newSelected.add(key);
    } else {
      newSelected.delete(key);
    }
    setSelectedItems(newSelected);
  };

  const handleSelectAllPending = () => {
    const pendingKeys = filteredData
      .filter(item => !item.isPaid)
      .map(item => `${item.eventId}-${item.payoutType}`);
    setSelectedItems(new Set(pendingKeys));
  };

  const handleMarkAsPaid = () => {
    const itemsToMark = filteredData.filter(
      item => selectedItems.has(`${item.eventId}-${item.payoutType}`) && !item.isPaid
    );
    if (itemsToMark.length > 0) {
      markAsPaidMutation.mutate(itemsToMark);
    }
  };

  const handleExport = () => {
    if (!filteredData.length) return;

    const headers = [
      'Data',
      'Escola',
      'Franquia',
      'Tipo',
      'Receita Bruta',
      'Alunos',
      'Valor',
      'Status',
      'Pago em',
      'Observações'
    ].join(',');

    const rows = filteredData.map(item => [
      formatDate(item.eventDate),
      `"${item.schoolName}"`,
      `"${item.franchiseName}"`,
      getPayoutTypeLabel(item.payoutType),
      formatCurrency(item.grossRevenue),
      item.totalStudents,
      formatCurrency(item.amount),
      item.isPaid ? 'Pago' : 'Pendente',
      item.paidAt ? new Date(item.paidAt).toLocaleDateString('pt-BR') : '',
      `"${item.notes || ''}"`
    ].join(','));

    const csv = [headers, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `pagamentos_comissoes_${selectedMonth}_${selectedYear}.csv`);
    link.click();
  };

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 md:gap-4">
        <Card>
          <CardContent className="pt-3 md:pt-6">
            <div className="flex items-center gap-2 md:gap-3">
              <div className="p-1.5 md:p-2 bg-amber-500/10 rounded-lg">
                <Clock className="h-4 w-4 md:h-5 md:w-5 text-amber-500" />
              </div>
              <div className="min-w-0">
                <p className="text-xs md:text-sm text-muted-foreground">Total Pendente</p>
                <p className="text-sm md:text-xl font-bold text-amber-500 truncate">{formatCurrency(stats.totalPending)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-3 md:pt-6">
            <div className="flex items-center gap-2 md:gap-3">
              <div className="p-1.5 md:p-2 bg-emerald-500/10 rounded-lg">
                <CheckCircle2 className="h-4 w-4 md:h-5 md:w-5 text-emerald-500" />
              </div>
              <div className="min-w-0">
                <p className="text-xs md:text-sm text-muted-foreground">Total Pago</p>
                <p className="text-sm md:text-xl font-bold text-emerald-500 truncate">{formatCurrency(stats.totalPaid)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-3 md:pt-6">
            <div className="flex items-center gap-2 md:gap-3">
              <div className="p-1.5 md:p-2 bg-blue-500/10 rounded-lg">
                <User className="h-4 w-4 md:h-5 md:w-5 text-blue-500" />
              </div>
              <div className="min-w-0">
                <p className="text-xs md:text-sm text-muted-foreground">Vendedores</p>
                <p className="text-sm md:text-xl font-bold truncate">{formatCurrency(stats.sellerPending)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-3 md:pt-6">
            <div className="flex items-center gap-2 md:gap-3">
              <div className="p-1.5 md:p-2 bg-purple-500/10 rounded-lg">
                <Presentation className="h-4 w-4 md:h-5 md:w-5 text-purple-500" />
              </div>
              <div className="min-w-0">
                <p className="text-xs md:text-sm text-muted-foreground">Apresentadores</p>
                <p className="text-sm md:text-xl font-bold truncate">{formatCurrency(stats.presenterPending)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-3 md:pt-6">
            <div className="flex items-center gap-2 md:gap-3">
              <div className="p-1.5 md:p-2 bg-teal-500/10 rounded-lg">
                <Users className="h-4 w-4 md:h-5 md:w-5 text-teal-500" />
              </div>
              <div className="min-w-0">
                <p className="text-xs md:text-sm text-muted-foreground">Supervisores</p>
                <p className="text-sm md:text-xl font-bold truncate">{formatCurrency(stats.supervisorPending)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-3 md:pt-6">
            <div className="flex items-center gap-2 md:gap-3">
              <div className="p-1.5 md:p-2 bg-orange-500/10 rounded-lg">
                <School className="h-4 w-4 md:h-5 md:w-5 text-orange-500" />
              </div>
              <div className="min-w-0">
                <p className="text-xs md:text-sm text-muted-foreground">Escolas</p>
                <p className="text-sm md:text-xl font-bold truncate">{formatCurrency(stats.schoolPending)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Card>
        <CardHeader className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
          <div>
            <CardTitle>Pagamentos a Realizar</CardTitle>
            <CardDescription>
              Gerencie os pagamentos de comissões para vendedores, apresentadores, supervisores e escolas
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            {selectedItems.size > 0 && (
              <Button onClick={() => setMarkPaidDialog(true)} className="gap-2">
                <Check className="h-4 w-4" />
                Marcar como Pago ({selectedItems.size})
              </Button>
            )}
            <Button variant="outline" onClick={handleExport} disabled={!filteredData?.length}>
              <Download className="h-4 w-4 mr-2" />
              Exportar
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filters */}
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
            
            <div className="flex flex-wrap gap-4 items-center">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <Select value={filterType} onValueChange={(v) => setFilterType(v as typeof filterType)}>
                  <SelectTrigger className="w-full sm:w-[160px]">
                    <SelectValue placeholder="Tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os Tipos</SelectItem>
                    <SelectItem value="seller">Vendedores</SelectItem>
                    <SelectItem value="presenter">Apresentadores</SelectItem>
                    <SelectItem value="supervisor">Supervisores</SelectItem>
                    <SelectItem value="school">Escolas</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as typeof filterStatus)}>
                <SelectTrigger className="w-full sm:w-[160px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="pending">Pendentes</SelectItem>
                  <SelectItem value="paid">Pagos</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterBeneficiary} onValueChange={setFilterBeneficiary}>
                <SelectTrigger className="w-full sm:w-[200px]">
                  <SelectValue placeholder="Comissionado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os Comissionados</SelectItem>
                  {beneficiaryNames.map(name => (
                    <SelectItem key={name} value={name}>{name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" onClick={handleSelectAllPending}>
                Selecionar Pendentes
              </Button>
            </div>
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
                    <TableHead className="w-[50px]"></TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Escola</TableHead>
                    <TableHead>Comissionado</TableHead>
                    {!franchiseId && <TableHead className="hidden md:table-cell">Franquia</TableHead>}
                    <TableHead>Tipo</TableHead>
                    <TableHead className="hidden md:table-cell text-right">Receita</TableHead>
                    <TableHead className="hidden md:table-cell text-center">Alunos</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead className="hidden md:table-cell">Pago em</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredData.map((item) => {
                    const key = `${item.eventId}-${item.payoutType}`;
                    return (
                      <TableRow key={key}>
                        <TableCell>
                          {!item.isPaid && (
                            <Checkbox
                              checked={selectedItems.has(key)}
                              onCheckedChange={(checked) => handleSelectItem(key, !!checked)}
                            />
                          )}
                        </TableCell>
                        <TableCell>{formatDate(item.eventDate)}</TableCell>
                        <TableCell className="font-medium">{item.schoolName}</TableCell>
                        <TableCell className="text-sm">{item.beneficiaryName}</TableCell>
                        {!franchiseId && <TableCell className="hidden md:table-cell">{item.franchiseName}</TableCell>}
                        <TableCell>
                          <Badge variant="outline" className="gap-1">
                            {getPayoutTypeIcon(item.payoutType)}
                            {getPayoutTypeLabel(item.payoutType)}
                          </Badge>
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-right">{formatCurrency(item.grossRevenue)}</TableCell>
                        <TableCell className="hidden md:table-cell text-center">{item.totalStudents}</TableCell>
                        <TableCell className="text-right font-semibold">{formatCurrency(item.amount)}</TableCell>
                        <TableCell className="text-center">
                          {item.isPaid ? (
                            <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20">
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                              Pago
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="bg-amber-500/10 text-amber-600 border-amber-500/20">
                              <Clock className="h-3 w-3 mr-1" />
                              Pendente
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                          {item.paidAt ? new Date(item.paidAt).toLocaleDateString('pt-BR') : '—'}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {filteredData.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                        Nenhum pagamento encontrado para o período selecionado
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Mark as Paid Dialog */}
      <Dialog open={markPaidDialog} onOpenChange={setMarkPaidDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Pagamento</DialogTitle>
            <DialogDescription>
              Você está prestes a marcar {selectedItems.size} pagamento(s) como realizado(s).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Data do Pagamento</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal mt-1.5", !paymentDate && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {paymentDate ? format(paymentDate, "dd/MM/yyyy", { locale: ptBR }) : 'Selecione a data'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={paymentDate}
                    onSelect={(d) => d && setPaymentDate(d)}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div>
              <Label>Observações (opcional)</Label>
              <Textarea
                placeholder="Ex: Pago via PIX em 20/01/2026"
                value={paymentNotes}
                onChange={(e) => setPaymentNotes(e.target.value)}
                className="mt-1.5"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMarkPaidDialog(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleMarkAsPaid}
              disabled={markAsPaidMutation.isPending}
            >
              {markAsPaidMutation.isPending ? 'Salvando...' : 'Confirmar Pagamento'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CommissionPayoutsReport;
