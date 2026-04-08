import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import ExcelImportExport from '@/components/shared/ExcelImportExport';
import { ColumnDef } from '@/lib/excelUtils';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

import { Plus, Pencil, Trash2, Users, Calendar, GraduationCap, Link2, DollarSign, Download, ChevronLeft, ChevronRight, Copy, Send, QrCode, Eye, MoreHorizontal } from 'lucide-react';
import { toast } from 'sonner';
import { format, getMonth, getYear, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import StudentReport from './StudentReport';
import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription';
import { cn } from '@/lib/utils';
import EventQRCodeDialog from '@/components/shared/EventQRCodeDialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import MergedFinancialDialog from '@/components/admin/MergedFinancialDialog';
import GradesSortableSelector, { GradeItem } from './GradesSortableSelector';

interface Event {
  id: string;
  school_name: string;
  description: string | null;
  location: string;
  event_date: string;
  event_time: string;
  event_end_time: string | null;
  price: number;
  total_capacity: number;
  available_spots: number;
  is_active: boolean;
  franchise_id: string;
  customer_id: string | null;
  seller_commission_pct: number;
  presenter_commission_pct: number;
  supervisor_commission_pct: number;
  school_commission_type: string;
  school_commission_value: number;
  sales_deadline: string | null;
  seller_id: string | null;
}

interface Customer {
  id: string;
  name: string;
  city: string | null;
  state: string | null;
  seller_id: string | null;
}

interface Grade {
  id: string;
  name: string;
  display_order: number;
  is_active: boolean;
}

interface EventGrade {
  id: string;
  event_id: string;
  grade_id: string | null;
  custom_grade_name: string | null;
}

interface EventForm {
  customer_id: string;
  school_name: string;
  event_date: string;
  event_time: string;
  event_end_time: string;
  price: string;
  total_capacity: string;
  ordered_grade_items: GradeItem[]; // unified ordered list for drag-and-drop
  custom_grade: string;
  seller_commission_pct: string;
  presenter_commission_pct: string;
  supervisor_commission_pct: string;
  school_commission_type: 'percentage' | 'fixed';
  school_commission_value: string;
  sales_deadline_date: string;
  sales_deadline_time: string;
  seller_id: string;
  presenter_id: string;
  supervisor_id: string;
  cash_password: string;
}

interface EventManagementProps {
  franchiseId: string;
  sellerBeneficiaryId?: string; // When set, filters events to only those sold by this beneficiary
}

const months = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

const eventExcelColumns: ColumnDef[] = [
  { key: 'id', header: 'ID', width: 36 },
  { key: 'school_name', header: 'Escola', width: 25, required: true },
  { key: 'event_date', header: 'Data', width: 12, required: true },
  { key: 'event_time', header: 'Hora Início', width: 10, required: true },
  { key: 'event_end_time', header: 'Hora Fim', width: 10 },
  { key: 'price', header: 'Preço', width: 10, parse: (v: any) => parseFloat(v) || 0 },
  { key: 'total_capacity', header: 'Capacidade', width: 12, parse: (v: any) => parseInt(v) || 0 },
  { key: 'available_spots', header: 'Vagas Disponíveis', width: 15, parse: (v: any) => parseInt(v) || 0 },
  { key: 'seller_commission_pct', header: 'Com. Vendedor %', width: 15, parse: (v: any) => parseFloat(v) || 0 },
  { key: 'presenter_commission_pct', header: 'Com. Apresentador %', width: 18, parse: (v: any) => parseFloat(v) || 0 },
  { key: 'supervisor_commission_pct', header: 'Com. Supervisor %', width: 16, parse: (v: any) => parseFloat(v) || 0 },
  { key: 'school_commission_value', header: 'Com. Escola', width: 12, parse: (v: any) => parseFloat(v) || 0 },
  { key: 'is_active', header: 'Ativo', width: 6, transform: (v: boolean) => v ? 'Sim' : 'Não', parse: (v: any) => String(v).toLowerCase() === 'sim' || v === true },
];

const EventManagement = ({ franchiseId, sellerBeneficiaryId }: EventManagementProps) => {
  const isCollaborator = !!sellerBeneficiaryId;
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);

  // Fetch franchise commission defaults
  const { data: franchiseDefaults } = useQuery({
    queryKey: ['franchise-defaults', franchiseId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('franchises')
        .select('default_seller_commission_pct, default_presenter_commission_pct, default_supervisor_commission_pct, default_school_commission_pct')
        .eq('id', franchiseId)
        .single();
      if (error) throw error;
      return data as {
        default_seller_commission_pct: number | null;
        default_presenter_commission_pct: number | null;
        default_supervisor_commission_pct: number | null;
        default_school_commission_pct: number | null;
      };
    },
  });

  // Auto-fill seller when opening create form as collaborator
  const openCreate = () => {
    resetForm();
    if (sellerBeneficiaryId) {
      setForm(prev => ({ ...prev, seller_id: sellerBeneficiaryId }));
    }
    setIsCreateOpen(true);
  };
  const [reportEvent, setReportEvent] = useState<Event | null>(null);
  const [detailEvent, setDetailEvent] = useState<Event | null>(null);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [form, setForm] = useState<EventForm>({
    customer_id: '',
    school_name: '',
    event_date: '',
    event_time: '',
    event_end_time: '',
    price: '',
    total_capacity: '',
    ordered_grade_items: [],
    custom_grade: '',
    seller_commission_pct: String(franchiseDefaults?.default_seller_commission_pct ?? 25),
    presenter_commission_pct: String(franchiseDefaults?.default_presenter_commission_pct ?? 20),
    supervisor_commission_pct: String(franchiseDefaults?.default_supervisor_commission_pct ?? 0),
    school_commission_type: 'percentage',
    school_commission_value: String(franchiseDefaults?.default_school_commission_pct ?? 10),
    sales_deadline_date: '',
    sales_deadline_time: '',
    seller_id: '',
    presenter_id: '',
    supervisor_id: '',
    cash_password: '',
  });
  const [isCreatingGrade] = useState(false);
  const [qrCodeEvent, setQrCodeEvent] = useState<Event | null>(null);
  const [selectedEventIds, setSelectedEventIds] = useState<Set<string>>(new Set());
  const [isMergedOpen, setIsMergedOpen] = useState(false);

  // Navegar entre meses
  const handleMonthChange = (month: number) => {
    if (month < 0) {
      setSelectedMonth(11);
      setSelectedYear(prev => prev - 1);
    } else if (month > 11) {
      setSelectedMonth(0);
      setSelectedYear(prev => prev + 1);
    } else {
      setSelectedMonth(month);
    }
  };

  // Realtime subscriptions for auto-refresh
  useRealtimeSubscription('events', [['franchise-events', franchiseId]], {
    column: 'franchise_id',
    value: franchiseId
  });
  useRealtimeSubscription('tickets', [['franchise-events', franchiseId], ['event-tickets-summary', franchiseId]], {
    column: 'franchise_id',
    value: franchiseId
  });
  useRealtimeSubscription('commission_payouts', [['event-payouts', franchiseId]], {
    column: 'franchise_id',
    value: franchiseId
  });

  const { data: events, isLoading } = useQuery({
    queryKey: ['franchise-events', franchiseId, sellerBeneficiaryId],
    queryFn: async () => {
      let query = supabase
        .from('events')
        .select('*')
        .eq('franchise_id', franchiseId)
        .order('event_date', { ascending: true });

      if (sellerBeneficiaryId) {
        query = query.eq('seller_id', sellerBeneficiaryId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Event[];
    },
  });

  const { data: customers } = useQuery({
    queryKey: ['franchise-customers', franchiseId, sellerBeneficiaryId],
    queryFn: async () => {
      let query = supabase
        .from('customers')
        .select('id, name, city, state, seller_id')
        .eq('franchise_id', franchiseId)
        .eq('is_active', true)
        .order('name', { ascending: true });

      if (sellerBeneficiaryId) {
        query = query.eq('seller_id', sellerBeneficiaryId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Customer[];
    },
  });

  const { data: grades } = useQuery({
    queryKey: ['grades'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('grades')
        .select('*')
        .eq('is_active', true)
        .order('display_order', { ascending: true });

      if (error) throw error;
      return data as Grade[];
    },
  });

  const { data: eventGrades } = useQuery({
    queryKey: ['event-grades', franchiseId],
    queryFn: async () => {
      const eventIds = events?.map(e => e.id) || [];
      if (eventIds.length === 0) return [];
      
      const { data, error } = await supabase
        .from('event_grades')
        .select('*')
        .in('event_id', eventIds);

      if (error) throw error;
      return data as EventGrade[];
    },
    enabled: !!events && events.length > 0,
  });

  // Query para buscar beneficiários de comissões
  const { data: beneficiaries } = useQuery({
    queryKey: ['beneficiaries', franchiseId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('commission_beneficiaries')
        .select('*')
        .eq('franchise_id', franchiseId)
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data as { id: string; name: string; type: string; is_active: boolean }[];
    },
  });

  // Query para buscar tickets pagos por evento
  const { data: ticketsByEvent } = useQuery({
    queryKey: ['event-tickets-summary', franchiseId],
    queryFn: async () => {
      const eventIds = events?.map(e => e.id) || [];
      if (eventIds.length === 0) return {};
      
      const { data, error } = await supabase
        .from('tickets')
        .select('event_id, amount, quantity')
        .in('event_id', eventIds)
        .eq('payment_status', 'approved');

      if (error) throw error;

      // Agrupa por evento
      const summary: Record<string, { totalSales: number; totalStudents: number }> = {};
      data.forEach(ticket => {
        if (!summary[ticket.event_id]) {
          summary[ticket.event_id] = { totalSales: 0, totalStudents: 0 };
        }
        summary[ticket.event_id].totalSales += Number(ticket.amount);
        summary[ticket.event_id].totalStudents += ticket.quantity;
      });
      return summary;
    },
    enabled: !!events && events.length > 0,
  });

  // Query para buscar pagamentos de comissões por evento
  const { data: payoutsByEvent } = useQuery({
    queryKey: ['event-payouts', franchiseId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('commission_payouts')
        .select('event_id, payout_type, amount, is_paid')
        .eq('franchise_id', franchiseId);

      if (error) throw error;

      const map: Record<string, Record<string, { paid: number; total: number }>> = {};
      data?.forEach(p => {
        if (!map[p.event_id]) map[p.event_id] = {};
        if (!map[p.event_id][p.payout_type]) map[p.event_id][p.payout_type] = { paid: 0, total: 0 };
        const amount = Number(p.amount);
        map[p.event_id][p.payout_type].total += amount;
        if (p.is_paid) {
          map[p.event_id][p.payout_type].paid += amount;
        }
      });
      return map;
    },
    enabled: !!events && events.length > 0,
  });

  // Calcula dados financeiros de um evento
  const getEventFinancials = (event: Event) => {
    const summary = ticketsByEvent?.[event.id] || { totalSales: 0, totalStudents: 0 };
    const grossRevenue = summary.totalSales;
    const totalStudents = summary.totalStudents;

    // 1. Escola sobre o bruto
    const schoolComm = event.school_commission_type === 'percentage'
      ? grossRevenue * ((event.school_commission_value ?? 10) / 100)
      : (event.school_commission_value ?? 0) * totalStudents;

    // 2. Base restante
    const remainingAfterSchool = grossRevenue - schoolComm;

    // 3. Vendedor, apresentador e supervisor sobre o restante
    const sellerComm = remainingAfterSchool * ((event.seller_commission_pct ?? 25) / 100);
    const presenterComm = remainingAfterSchool * ((event.presenter_commission_pct ?? 20) / 100);
    const supervisorComm = remainingAfterSchool * ((event.supervisor_commission_pct ?? 0) / 100);

    // 4. Líquido
    const netProfit = remainingAfterSchool - sellerComm - presenterComm - supervisorComm;

    return {
      grossRevenue,
      totalStudents,
      schoolComm,
      sellerComm,
      presenterComm,
      supervisorComm,
      netProfit,
      totalComm: schoolComm + sellerComm + presenterComm + supervisorComm
    };
  };

  // Filtra eventos pelo mês/ano selecionado
  const filteredEvents = useMemo(() => {
    if (!events) return [];
    return events.filter(event => {
      const eventDate = parseISO(event.event_date);
      return getMonth(eventDate) === selectedMonth && getYear(eventDate) === selectedYear;
    });
  }, [events, selectedMonth, selectedYear]);

  // Calcula totais dos eventos filtrados
  const totals = useMemo(() => {
    let totalGross = 0;
    let totalComm = 0;
    let totalNet = 0;
    
    filteredEvents.forEach(event => {
      const financials = getEventFinancials(event);
      totalGross += financials.grossRevenue;
      totalComm += financials.totalComm;
      totalNet += financials.netProfit;
    });

    return { totalGross, totalComm, totalNet };
  }, [filteredEvents, ticketsByEvent]);

  // Exportar CSV
  const exportCSV = () => {
    if (filteredEvents.length === 0) {
      toast.error('Nenhum evento para exportar neste período.');
      return;
    }

    const headers = isCollaborator
      ? ['Escola', 'Data', 'Preço', 'Alunos Pagos', 'Minha Comissão']
      : ['Escola', 'Data', 'Preço', 'Ingressos Pagos', 'Alunos Pagos', 'Bruto', 'Comissão Vendedor', 'Comissão Apresentador', 'Comissão Supervisor', 'Comissão Escola', 'Total Comissões', 'Líquido'];
    const rows = filteredEvents.map(event => {
      const financials = getEventFinancials(event);
      const summary = ticketsByEvent?.[event.id] || { totalSales: 0, totalStudents: 0 };
      if (isCollaborator) {
        return [
          event.school_name,
          format(parseISO(event.event_date), 'dd/MM/yyyy'),
          event.price.toFixed(2).replace('.', ','),
          summary.totalStudents,
          financials.sellerComm.toFixed(2).replace('.', ','),
        ];
      }
      return [
        event.school_name,
        format(parseISO(event.event_date), 'dd/MM/yyyy'),
        event.price.toFixed(2).replace('.', ','),
        summary.totalStudents,
        summary.totalStudents,
        financials.grossRevenue.toFixed(2).replace('.', ','),
        financials.sellerComm.toFixed(2).replace('.', ','),
        financials.presenterComm.toFixed(2).replace('.', ','),
        financials.supervisorComm.toFixed(2).replace('.', ','),
        financials.schoolComm.toFixed(2).replace('.', ','),
        financials.totalComm.toFixed(2).replace('.', ','),
        financials.netProfit.toFixed(2).replace('.', ','),
      ];
    });

    // Linha de totais
    rows.push([
      'TOTAL',
      '',
      '',
      '',
      '',
      totals.totalGross.toFixed(2).replace('.', ','),
      '',
      '',
      '',
      totals.totalComm.toFixed(2).replace('.', ','),
      totals.totalNet.toFixed(2).replace('.', ','),
    ]);

    const csvContent = [headers.join(';'), ...rows.map(row => row.join(';'))].join('\n');
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `extrato-eventos-${months[selectedMonth]}-${selectedYear}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success('Extrato exportado com sucesso!');
  };

  const createEvent = useMutation({
    mutationFn: async (data: EventForm) => {
      const capacity = parseInt(data.total_capacity);
      // Store with Brasília timezone offset (-03:00) so the server interprets it correctly
      const salesDeadline = data.sales_deadline_date && data.sales_deadline_time
        ? `${data.sales_deadline_date}T${data.sales_deadline_time}:00-03:00`
        : data.sales_deadline_date ? `${data.sales_deadline_date}T23:59:00-03:00` : null;
      
      // Create the event
      const { data: newEvent, error } = await supabase
        .from('events')
        .insert({
          franchise_id: franchiseId,
          customer_id: data.customer_id || null,
          school_name: data.school_name,
          description: null,
          location: '',
          event_date: data.event_date,
          event_time: data.event_time,
          event_end_time: data.event_end_time || null,
          price: parseFloat(data.price),
          total_capacity: capacity,
          available_spots: capacity,
          seller_commission_pct: parseFloat(data.seller_commission_pct) || 25,
          presenter_commission_pct: parseFloat(data.presenter_commission_pct) || 20,
          supervisor_commission_pct: parseFloat(data.supervisor_commission_pct) || 0,
          school_commission_type: data.school_commission_type,
          school_commission_value: parseFloat(data.school_commission_value) || 10,
          sales_deadline: salesDeadline,
          seller_id: data.seller_id || null,
          presenter_id: data.presenter_id || null,
          supervisor_id: data.supervisor_id || null,
          cash_password: data.cash_password || null,
        } as any)
        .select()
        .single();

      if (error) throw error;

      // Insert grades in the ordered sequence
      if (data.ordered_grade_items.length > 0) {
        const gradeInserts = data.ordered_grade_items.map(item =>
          item.type === 'global'
            ? { event_id: newEvent.id, grade_id: item.gradeId! }
            : { event_id: newEvent.id, custom_grade_name: item.name }
        );
        const { error: gradeError } = await supabase.from('event_grades').insert(gradeInserts);
        if (gradeError) throw gradeError;
      }

      // Add NEW custom grade typed in the text field (if not yet added via button)
      if (data.custom_grade.trim()) {
        const { error: customError } = await supabase
          .from('event_grades')
          .insert({ event_id: newEvent.id, custom_grade_name: data.custom_grade.trim() });
        if (customError) throw customError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['franchise-events'] });
      queryClient.invalidateQueries({ queryKey: ['event-grades'] });
      queryClient.invalidateQueries({ queryKey: ['grades'] });
      setIsCreateOpen(false);
      resetForm();
      toast.success('Evento criado com sucesso!');
    },
    onError: (error) => {
      toast.error('Erro ao criar evento: ' + error.message);
    },
  });

  const updateEvent = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: EventForm }) => {
      const salesDeadline = data.sales_deadline_date && data.sales_deadline_time
        ? `${data.sales_deadline_date}T${data.sales_deadline_time}:00-03:00`
        : data.sales_deadline_date ? `${data.sales_deadline_date}T23:59:00-03:00` : null;

      const { error } = await supabase
        .from('events')
        .update({
          customer_id: data.customer_id || null,
          school_name: data.school_name,
          event_date: data.event_date,
          event_time: data.event_time,
          event_end_time: data.event_end_time || null,
          price: parseFloat(data.price),
          total_capacity: parseInt(data.total_capacity),
          seller_commission_pct: parseFloat(data.seller_commission_pct) || 25,
          presenter_commission_pct: parseFloat(data.presenter_commission_pct) || 20,
          supervisor_commission_pct: parseFloat(data.supervisor_commission_pct) || 0,
          school_commission_type: data.school_commission_type,
          school_commission_value: parseFloat(data.school_commission_value) || 10,
          sales_deadline: salesDeadline,
          seller_id: data.seller_id || null,
          presenter_id: data.presenter_id || null,
          supervisor_id: data.supervisor_id || null,
          cash_password: data.cash_password || null,
        } as any)
        .eq('id', id);

      if (error) throw error;

      // Delete existing grades for this event
      const { error: deleteGradesError } = await supabase.from('event_grades').delete().eq('event_id', id);
      if (deleteGradesError) throw deleteGradesError;

      // Re-insert grades in ordered sequence (ON CONFLICT DO NOTHING via unique index)
      if (data.ordered_grade_items.length > 0) {
        const gradeInserts = data.ordered_grade_items.map(item =>
          item.type === 'global'
            ? { event_id: id, grade_id: item.gradeId! }
            : { event_id: id, custom_grade_name: item.name }
        );
        const { error: insertGradesError } = await supabase.from('event_grades').insert(gradeInserts);
        if (insertGradesError) throw insertGradesError;
      }

      // Add NEW custom grade typed in the text field
      if (data.custom_grade.trim()) {
        const { error: customGradeError } = await supabase.from('event_grades').insert({
          event_id: id,
          custom_grade_name: data.custom_grade.trim(),
        });
        if (customGradeError && !customGradeError.message.includes('duplicate')) throw customGradeError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['franchise-events'] });
      queryClient.invalidateQueries({ queryKey: ['event-grades'] });
      queryClient.invalidateQueries({ queryKey: ['grades'] });
      setEditingEvent(null);
      resetForm();
      toast.success('Evento atualizado com sucesso!');
    },
    onError: (error) => {
      toast.error('Erro ao atualizar evento: ' + error.message);
    },
  });

  const deleteEvent = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from('commission_payouts').delete().eq('event_id', id);
      await supabase.from('tickets').delete().eq('event_id', id);
      await supabase.from('event_grades').delete().eq('event_id', id);
      const { error } = await supabase.from('events').delete().eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['franchise-events'] });
      queryClient.invalidateQueries({ queryKey: ['event-grades'] });
      toast.success('Evento excluído com sucesso!');
    },
    onError: (error) => {
      toast.error('Erro ao excluir evento: ' + error.message);
    },
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const { error } = await supabase
        .from('events')
        .update({ is_active: isActive })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['franchise-events'] });
      toast.success('Status atualizado!');
    },
    onError: (error) => {
      toast.error('Erro ao atualizar status: ' + error.message);
    },
  });

  const resetForm = () => {
    setForm({
      customer_id: '',
      school_name: '',
      event_date: '',
      event_time: '',
      event_end_time: '',
      price: '',
      total_capacity: '',
      ordered_grade_items: [],
      custom_grade: '',
      seller_commission_pct: String(franchiseDefaults?.default_seller_commission_pct ?? 25),
      presenter_commission_pct: String(franchiseDefaults?.default_presenter_commission_pct ?? 20),
      supervisor_commission_pct: String(franchiseDefaults?.default_supervisor_commission_pct ?? 0),
      school_commission_type: 'percentage',
      school_commission_value: String(franchiseDefaults?.default_school_commission_pct ?? 10),
      sales_deadline_date: '',
      sales_deadline_time: '',
      seller_id: '',
      presenter_id: '',
      supervisor_id: '',
      cash_password: '',
    });
  };

  const handleAddGrade = () => {
    const gradeName = form.custom_grade.trim();
    if (!gradeName) return;

    // Check for duplicate name already in the list
    const alreadyAdded = form.ordered_grade_items.some(
      item => item.name.toLowerCase() === gradeName.toLowerCase()
    );
    if (alreadyAdded) {
      toast.error(`A turma "${gradeName}" já está na lista.`);
      return;
    }

    const newItem: GradeItem = {
      uid: `custom-${gradeName}-${Date.now()}`,
      type: 'custom',
      name: gradeName,
    };
    setForm(prev => ({
      ...prev,
      ordered_grade_items: [...prev.ordered_grade_items, newItem],
      custom_grade: '',
    }));
  };

  // Valor mínimo para pagamentos no Mercado Pago
  const MIN_PAYMENT_AMOUNT = 5.0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!form.customer_id) {
      toast.error('Selecione uma escola antes de criar o evento.');
      return;
    }

    const priceValue = parseFloat(form.price);
    if (priceValue > 0 && priceValue < MIN_PAYMENT_AMOUNT) {
      toast.error(`O valor mínimo para pagamentos online é R$ ${MIN_PAYMENT_AMOUNT.toFixed(2).replace('.', ',')}. Ajuste o preço ou defina como R$ 0,00 para eventos gratuitos.`);
      return;
    }
    
    if (editingEvent) {
      updateEvent.mutate({ id: editingEvent.id, data: form });
    } else {
      createEvent.mutate(form);
    }
  };

  const handleCustomerSelect = (customerId: string) => {
    const selectedCustomer = customers?.find(c => c.id === customerId);
    setForm({
      ...form,
      customer_id: customerId,
      school_name: selectedCustomer?.name || '',
      seller_id: selectedCustomer?.seller_id || form.seller_id,
    });
  };




  const openEdit = async (event: Event) => {
    const { data: eventGradeData } = await supabase
      .from('event_grades')
      .select('*')
      .eq('event_id', event.id)
      .order('created_at', { ascending: true });

    // Build unified ordered list from saved event grades (preserving insertion order)
    const orderedItems: GradeItem[] = (eventGradeData || []).map(eg => {
      if (eg.grade_id) {
        const grade = grades?.find(g => g.id === eg.grade_id);
        return {
          uid: `global-${eg.grade_id}`,
          type: 'global' as const,
          gradeId: eg.grade_id,
          name: grade?.name || eg.grade_id,
        };
      } else {
        return {
          uid: `custom-${eg.custom_grade_name}-${eg.id}`,
          type: 'custom' as const,
          name: eg.custom_grade_name!,
        };
      }
    });

    setEditingEvent(event);
    let dlDate = '';
    let dlTime = '';
    if (event.sales_deadline) {
      // Convert UTC timestamp from DB to Brasília time (UTC-3) for display
      const dlUTC = new Date(event.sales_deadline);
      const dlBrasilia = new Date(dlUTC.getTime());
      // Format as local Brasília time
      const brDate = dlBrasilia.toLocaleString('sv-SE', { timeZone: 'America/Sao_Paulo' });
      dlDate = brDate.slice(0, 10);
      dlTime = brDate.slice(11, 16);
    }
    setForm({
      customer_id: event.customer_id || '',
      school_name: event.school_name,
      event_date: event.event_date,
      event_time: event.event_time,
      event_end_time: (event as any).event_end_time || '',
      price: event.price.toString(),
      total_capacity: event.total_capacity.toString(),
      ordered_grade_items: orderedItems,
      custom_grade: '',
      seller_commission_pct: (event.seller_commission_pct ?? 25).toString(),
      presenter_commission_pct: (event.presenter_commission_pct ?? 20).toString(),
      supervisor_commission_pct: (event.supervisor_commission_pct ?? 0).toString(),
      school_commission_type: (event.school_commission_type as 'percentage' | 'fixed') || 'percentage',
      school_commission_value: (event.school_commission_value ?? 10).toString(),
      sales_deadline_date: dlDate,
      sales_deadline_time: dlTime,
      seller_id: (event as any).seller_id || '',
      presenter_id: (event as any).presenter_id || '',
      supervisor_id: (event as any).supervisor_id || '',
      cash_password: (event as any).cash_password || '',
    });
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const copyPurchaseLink = (eventId: string) => {
    const url = `${window.location.origin}/comprar/${eventId}`;
    navigator.clipboard.writeText(url);
    toast.success('Link de compra copiado!');
  };

  const handleCloneEvent = async (event: Event) => {
    const { data: eventGradeData } = await supabase
      .from('event_grades')
      .select('*')
      .eq('event_id', event.id)
      .order('created_at', { ascending: true });

    const orderedItems: GradeItem[] = (eventGradeData || []).map(eg => {
      if (eg.grade_id) {
        const grade = grades?.find(g => g.id === eg.grade_id);
        return {
          uid: `global-${eg.grade_id}`,
          type: 'global' as const,
          gradeId: eg.grade_id,
          name: grade?.name || eg.grade_id,
        };
      } else {
        return {
          uid: `custom-${eg.custom_grade_name}-${eg.id}`,
          type: 'custom' as const,
          name: eg.custom_grade_name!,
        };
      }
    });

    setEditingEvent(null);
    setForm({
      customer_id: event.customer_id || '',
      school_name: event.school_name,
      event_date: event.event_date,
      event_time: event.event_time.slice(0, 5),
      event_end_time: (event as any).event_end_time?.slice(0, 5) || '',
      price: event.price.toString(),
      total_capacity: event.total_capacity.toString(),
      ordered_grade_items: orderedItems,
      custom_grade: '',
      seller_commission_pct: (event.seller_commission_pct ?? 25).toString(),
      presenter_commission_pct: (event.presenter_commission_pct ?? 20).toString(),
      supervisor_commission_pct: (event.supervisor_commission_pct ?? 0).toString(),
      school_commission_type: (event.school_commission_type as 'percentage' | 'fixed') || 'percentage',
      school_commission_value: (event.school_commission_value ?? 10).toString(),
      sales_deadline_date: '',
      sales_deadline_time: '',
      seller_id: (event as any).seller_id || '',
      presenter_id: (event as any).presenter_id || '',
      supervisor_id: (event as any).supervisor_id || '',
      cash_password: (event as any).cash_password || '',
    });
    setIsCreateOpen(true);
    toast.info('Preencha a data e horário do novo evento.');
  };

  const shareListViaWhatsApp = (event: Event) => {
    const listUrl = `${window.location.origin}/lista/${event.id}`;
    const purchaseUrl = `${window.location.origin}/comprar/${event.id}`;
    const dateFormatted = format(new Date(event.event_date + 'T00:00:00'), "dd/MM", { locale: ptBR });
    const message = `Olá! Segue a lista de alunos confirmados para o evento *${event.school_name}* no dia *${dateFormatted}*: ${listUrl}\n\n🎟️ Link de compra: ${purchaseUrl}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
  };

  const getEventGrades = (eventId: string) => {
    const eventGradeList = eventGrades?.filter(eg => eg.event_id === eventId) || [];
    const gradeNames: string[] = [];
    
    eventGradeList.forEach(eg => {
      if (eg.grade_id) {
        const grade = grades?.find(g => g.id === eg.grade_id);
        if (grade) gradeNames.push(grade.name);
      } else if (eg.custom_grade_name) {
        gradeNames.push(eg.custom_grade_name);
      }
    });
    
    return gradeNames;
  };

  // Grades selector JSX - inline to prevent focus loss
  const gradesSelectorJSX = (
    <GradesSortableSelector
      orderedItems={form.ordered_grade_items}
      onOrderedItemsChange={(items) => setForm(prev => ({ ...prev, ordered_grade_items: items }))}
      customGradeInput={form.custom_grade}
      onCustomGradeInputChange={(v) => setForm(prev => ({ ...prev, custom_grade: v }))}
      onAddCustomGrade={handleAddGrade}
      isCreatingGrade={isCreatingGrade}
    />
  );

  // Event form fields JSX - inline to prevent focus loss
  const eventFormFieldsJSX = (
    <>
      <div className="space-y-2">
        <Label htmlFor="customer_id">Escola *</Label>
        <Select
          value={form.customer_id}
          onValueChange={handleCustomerSelect}
        >
          <SelectTrigger>
            <SelectValue placeholder="Selecione uma escola..." />
          </SelectTrigger>
          <SelectContent>
            {customers?.map((customer) => (
              <SelectItem key={customer.id} value={customer.id}>
                {customer.name}
                {customer.city && customer.state && (
                  <span className="text-muted-foreground ml-2">
                    ({customer.city}/{customer.state})
                  </span>
                )}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {customers?.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Nenhuma escola cadastrada. Cadastre uma escola primeiro na aba "Escolas".
          </p>
        )}
      </div>

      {gradesSelectorJSX}

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="event_date">Data</Label>
          <Input
            id="event_date"
            type="date"
            value={form.event_date}
            onChange={(e) => setForm({ ...form, event_date: e.target.value })}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="event_time">Horário de Início</Label>
          <Input
            id="event_time"
            type="time"
            value={form.event_time}
            onChange={(e) => setForm({ ...form, event_time: e.target.value })}
            required
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="event_end_time">Horário de Término (opcional)</Label>
        <Input
          id="event_end_time"
          type="time"
          value={form.event_end_time}
          onChange={(e) => setForm({ ...form, event_end_time: e.target.value })}
        />
        <p className="text-xs text-muted-foreground">
          Exibido para os pais no momento da compra.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="price">Preço (R$)</Label>
          <Input
            id="price"
            type="number"
            step="0.01"
            min="0"
            value={form.price}
            onChange={(e) => setForm({ ...form, price: e.target.value })}
            required
            className={parseFloat(form.price) > 0 && parseFloat(form.price) < MIN_PAYMENT_AMOUNT ? 'border-destructive' : ''}
          />
          {parseFloat(form.price) > 0 && parseFloat(form.price) < MIN_PAYMENT_AMOUNT && (
            <p className="text-xs text-destructive">
              Mínimo R$ 5,00 para pagamentos online
            </p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="total_capacity">Capacidade</Label>
          <Input
            id="total_capacity"
            type="number"
            min="1"
            value={form.total_capacity}
            onChange={(e) => setForm({ ...form, total_capacity: e.target.value })}
            required
          />
        </div>
      </div>

      {/* Sales Deadline */}
      <div className="space-y-2">
        <Label>Prazo limite para compra (opcional)</Label>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label htmlFor="sales_deadline_date" className="text-xs text-muted-foreground">Data limite</Label>
            <Input
              id="sales_deadline_date"
              type="date"
              value={form.sales_deadline_date}
              onChange={(e) => setForm({ ...form, sales_deadline_date: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="sales_deadline_time" className="text-xs text-muted-foreground">Horário limite</Label>
            <Input
              id="sales_deadline_time"
              type="time"
              value={form.sales_deadline_time}
              onChange={(e) => setForm({ ...form, sales_deadline_time: e.target.value })}
            />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Se definido, o evento não aceitará compras após essa data e horário.
        </p>
      </div>

      {/* Cash Password */}
      <div className="space-y-2">
        <Label htmlFor="cash_password">Senha para Dinheiro (opcional)</Label>
        <Input
          id="cash_password"
          type="text"
          placeholder="Deixe vazio para desabilitar dinheiro"
          value={form.cash_password}
          onChange={(e) => setForm({ ...form, cash_password: e.target.value })}
        />
        <p className="text-xs text-muted-foreground">
          Se definida, a opção de pagamento em dinheiro será exibida no checkout e exigirá essa senha.
        </p>
      </div>

      {/* Commissions Section */}
      <div className="space-y-4 pt-4 border-t">
        <Label className="text-base font-semibold">Comissões do Evento</Label>
        
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="seller_commission">Vendedor (%)</Label>
            <Input
              id="seller_commission"
              type="number"
              step="0.1"
              min="0"
              max="100"
              value={form.seller_commission_pct}
              onChange={(e) => setForm({ ...form, seller_commission_pct: e.target.value })}
            />
            <Select value={form.seller_id} onValueChange={(v) => setForm({ ...form, seller_id: v === '_none' ? '' : v })}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Selecionar vendedor" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_none">Nenhum</SelectItem>
                {beneficiaries?.filter(b => b.type === 'seller').map(b => (
                  <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="presenter_commission">Apresentador (%)</Label>
            <Input
              id="presenter_commission"
              type="number"
              step="0.1"
              min="0"
              max="100"
              value={form.presenter_commission_pct}
              onChange={(e) => setForm({ ...form, presenter_commission_pct: e.target.value })}
            />
            <Select value={form.presenter_id} onValueChange={(v) => setForm({ ...form, presenter_id: v === '_none' ? '' : v })}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Selecionar apresentador" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_none">Nenhum</SelectItem>
                {beneficiaries?.filter(b => b.type === 'presenter').map(b => (
                  <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="supervisor_commission">Supervisor (%)</Label>
            <Input
              id="supervisor_commission"
              type="number"
              step="0.1"
              min="0"
              max="100"
              value={form.supervisor_commission_pct}
              onChange={(e) => setForm({ ...form, supervisor_commission_pct: e.target.value })}
            />
            <Select value={form.supervisor_id} onValueChange={(v) => setForm({ ...form, supervisor_id: v === '_none' ? '' : v })}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Selecionar supervisor" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_none">Nenhum</SelectItem>
                {beneficiaries?.filter(b => b.type === 'supervisor').map(b => (
                  <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Comissão da Escola</Label>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="school_commission_type"
                checked={form.school_commission_type === 'percentage'}
                onChange={() => setForm({ ...form, school_commission_type: 'percentage' })}
                className="w-4 h-4"
              />
              <span className="text-sm">Percentual (%)</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="school_commission_type"
                checked={form.school_commission_type === 'fixed'}
                onChange={() => setForm({ ...form, school_commission_type: 'fixed' })}
                className="w-4 h-4"
              />
              <span className="text-sm">Valor Fixo (R$)</span>
            </label>
          </div>
          <Input
            type="number"
            step="0.01"
            min="0"
            value={form.school_commission_value}
            onChange={(e) => setForm({ ...form, school_commission_value: e.target.value })}
            placeholder={form.school_commission_type === 'percentage' ? 'Ex: 10' : 'Ex: 2.00'}
          />
          <p className="text-xs text-muted-foreground">
            {form.school_commission_type === 'percentage' 
              ? 'Percentual sobre o valor bruto de cada venda'
              : 'Valor fixo por aluno vendido'
            }
          </p>
        </div>
      </div>
    </>
  );

  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();
  const yearSuffix = String(selectedYear).slice(-2);

  return (
    <Card>
      <CardHeader className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
          <CardTitle>Gerenciamento de Eventos</CardTitle>
          <div className="flex gap-2">
            <ExcelImportExport
              data={filteredEvents || []}
              columns={eventExcelColumns}
              entityName="eventos"
              onImport={async (rows) => {
                for (const row of rows) {
                  const payload = {
                    school_name: row.school_name || '',
                    event_date: row.event_date || '',
                    event_time: row.event_time || '',
                    event_end_time: row.event_end_time || null,
                    price: row.price || 0,
                    total_capacity: row.total_capacity || 0,
                    available_spots: row.available_spots ?? row.total_capacity ?? 0,
                    seller_commission_pct: row.seller_commission_pct ?? 25,
                    presenter_commission_pct: row.presenter_commission_pct ?? 20,
                    supervisor_commission_pct: row.supervisor_commission_pct ?? 0,
                    school_commission_value: row.school_commission_value ?? 10,
                    is_active: row.is_active !== undefined ? row.is_active : true,
                    franchise_id: franchiseId,
                    location: '',
                  };
                  if (row.id && row.id !== '(não preencher para novo)') {
                    await supabase.from('events').update(payload as any).eq('id', row.id);
                  } else {
                    await supabase.from('events').insert(payload as any);
                  }
                }
                queryClient.invalidateQueries({ queryKey: ['franchise-events', franchiseId] });
              }}
            />
            <Button variant="outline" size="sm" onClick={exportCSV}>
              <Download className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Exportar CSV</span>
            </Button>
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => { setEditingEvent(null); openCreate(); }}>
                  <Plus className="h-4 w-4 mr-2" />
                  Novo Evento
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Criar Novo Evento</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  {eventFormFieldsJSX}
                  <Button type="submit" className="w-full" disabled={createEvent.isPending}>
                    {createEvent.isPending ? 'Criando...' : 'Criar Evento'}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>
        
        {/* Seletor de Mês */}
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => handleMonthChange(selectedMonth - 1)}
            className="text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          
          <div className="flex items-center gap-1 overflow-x-auto max-w-full px-2">
            {months.map((month, index) => (
              <button
                key={month}
                onClick={() => setSelectedMonth(index)}
                className={cn(
                  "px-2 py-1 sm:px-3 sm:py-1.5 text-xs sm:text-sm font-medium transition-all whitespace-nowrap",
                  selectedMonth === index
                    ? "bg-primary text-primary-foreground shadow-[0_0_10px_hsl(var(--primary)/0.5)]"
                    : index === currentMonth && selectedYear === currentYear
                    ? "bg-primary/20 text-primary hover:bg-primary/30"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
              >
                {month}/{yearSuffix}
              </button>
            ))}
          </div>
          
          <Button
            variant="ghost"
            size="icon"
            onClick={() => handleMonthChange(selectedMonth + 1)}
            className="text-muted-foreground hover:text-foreground"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
          </div>
        ) : (
          <div className="rounded-md border overflow-x-auto">
            <Table className="text-xs [&_th]:px-2 [&_th]:py-2 [&_td]:px-2 [&_td]:py-2">
               <TableHeader>
                <TableRow>
                  <TableHead className="w-8">
                    <Checkbox
                      checked={filteredEvents.length > 0 && filteredEvents.every(e => selectedEventIds.has(e.id))}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setSelectedEventIds(new Set(filteredEvents.map(e => e.id)));
                        } else {
                          setSelectedEventIds(new Set());
                        }
                      }}
                    />
                  </TableHead>
                  <TableHead>Escola</TableHead>
                  <TableHead className="hidden xl:table-cell">Séries</TableHead>
                  <TableHead className="whitespace-nowrap">Data</TableHead>
                  <TableHead>Preço</TableHead>
                  <TableHead>Vagas</TableHead>
                  {!isCollaborator && <TableHead className="hidden xl:table-cell text-right">Bruto</TableHead>}
                  {!isCollaborator && <TableHead className="hidden xl:table-cell text-right">Comiss.</TableHead>}
                  {!isCollaborator && <TableHead className="hidden xl:table-cell text-right">Líquido</TableHead>}
                  <TableHead className="w-10">Ativo</TableHead>
                  <TableHead className="text-right w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEvents.map((event) => {
                  const eventGradeNames = getEventGrades(event.id);
                  const financials = getEventFinancials(event);
                  return (
                    <TableRow key={event.id}>
                      <TableCell>
                        <Checkbox
                          checked={selectedEventIds.has(event.id)}
                          onCheckedChange={(checked) => {
                            const next = new Set(selectedEventIds);
                            if (checked) next.add(event.id);
                            else next.delete(event.id);
                            setSelectedEventIds(next);
                          }}
                        />
                      </TableCell>
                      <TableCell className="font-medium text-xs md:text-sm">
                        <div className="flex flex-col gap-1">
                          <span>{event.school_name}</span>
                          {event.seller_id && (() => {
                            const seller = beneficiaries?.find(b => b.id === event.seller_id);
                            return seller ? (
                              <Badge variant="outline" className="w-fit text-xs flex items-center gap-1">
                                👤 {seller.name}
                              </Badge>
                            ) : null;
                          })()}
                        </div>
                      </TableCell>
                      <TableCell className="hidden xl:table-cell">
                        <div className="flex flex-wrap gap-1 max-w-[120px]">
                          {eventGradeNames.length > 0 ? (
                            eventGradeNames.slice(0, 2).map((name, i) => (
                              <Badge key={i} variant="outline" className="text-[10px] px-1.5 py-0">
                                {name}
                              </Badge>
                            ))
                          ) : (
                            <span className="text-muted-foreground text-xs">-</span>
                          )}
                          {eventGradeNames.length > 2 && (
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                              +{eventGradeNames.length - 2}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs whitespace-nowrap">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3 text-muted-foreground shrink-0" />
                          <span>{format(new Date(event.event_date + 'T00:00:00'), "dd/MM/yy", { locale: ptBR })}</span>
                          <span className="text-muted-foreground">{event.event_time.slice(0, 5)}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs md:text-sm">
                        {event.price === 0 ? (
                          <Badge className="bg-green-500 hover:bg-green-600 text-white text-xs">
                            Gratuito
                          </Badge>
                        ) : (
                          formatCurrency(event.price)
                        )}
                      </TableCell>
                      <TableCell className="text-xs md:text-sm">
                        <div className="flex items-center gap-1">
                          <Users className="h-3.5 w-3.5 md:h-4 md:w-4 text-muted-foreground" />
                          <Badge variant={financials.totalStudents > 0 ? 'default' : 'secondary'} className="text-xs">
                            {financials.totalStudents} pago{financials.totalStudents !== 1 ? 's' : ''}
                          </Badge>
                        </div>
                      </TableCell>
                      
                      {!isCollaborator && (
                        <>
                          <TableCell className="hidden xl:table-cell text-right font-medium text-xs">
                            {financials.grossRevenue > 0 ? formatCurrency(financials.grossRevenue) : '-'}
                          </TableCell>
                          <TableCell className="hidden xl:table-cell text-right text-xs">
                            {financials.totalComm > 0 ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-destructive hover:text-destructive h-auto py-1 px-2"
                                onClick={() => setDetailEvent(event)}
                              >
                                -{formatCurrency(financials.totalComm)}
                                <Eye className="h-3 w-3 ml-1" />
                              </Button>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell className="hidden xl:table-cell text-right font-medium text-xs text-primary">
                            {financials.netProfit > 0 ? formatCurrency(financials.netProfit) : '-'}
                          </TableCell>
                        </>
                      )}

                      <TableCell>
                        <Switch
                          checked={event.is_active}
                          onCheckedChange={(checked) =>
                            toggleActive.mutate({ id: event.id, isActive: checked })
                          }
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end items-center gap-1">
                          <Dialog open={editingEvent?.id === event.id} onOpenChange={(open) => !open && setEditingEvent(null)}>
                            <DialogTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(event)}>
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                              <DialogHeader>
                                <DialogTitle>Editar Evento</DialogTitle>
                              </DialogHeader>
                              <form onSubmit={handleSubmit} className="space-y-4">
                                {eventFormFieldsJSX}
                                <Button type="submit" className="w-full" disabled={updateEvent.isPending}>
                                  {updateEvent.isPending ? 'Salvando...' : 'Salvar Alterações'}
                                </Button>
                              </form>
                            </DialogContent>
                          </Dialog>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-7 w-7">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {!isCollaborator && (
                                <DropdownMenuItem onClick={() => setDetailEvent(event)}>
                                  <DollarSign className="h-4 w-4 mr-2" />
                                  Financeiro
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem onClick={() => setReportEvent(event)}>
                                <GraduationCap className="h-4 w-4 mr-2" />
                                Ver Alunos
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => copyPurchaseLink(event.id)}>
                                <Link2 className="h-4 w-4 mr-2" />
                                Copiar Link
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => setQrCodeEvent(event)}>
                                <QrCode className="h-4 w-4 mr-2" />
                                QR Code
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleCloneEvent(event)}>
                                <Copy className="h-4 w-4 mr-2" />
                                Clonar
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => shareListViaWhatsApp(event)}>
                                <Send className="h-4 w-4 mr-2" />
                                WhatsApp
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={() => {
                                  if (confirm('Tem certeza que deseja excluir este evento?')) {
                                    deleteEvent.mutate(event.id);
                                  }
                                }}
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Excluir
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {filteredEvents.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={11} className="text-center py-8 text-muted-foreground">
                      Nenhum evento neste período
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
              {filteredEvents.length > 0 && (
              <TableFooter>
                  <TableRow className="bg-muted/50 font-semibold">
                    <TableCell colSpan={6} className="text-right text-xs">Totais:</TableCell>
                    <TableCell className="hidden xl:table-cell text-right text-xs">{formatCurrency(totals.totalGross)}</TableCell>
                    <TableCell className="hidden xl:table-cell text-right text-destructive text-xs">-{formatCurrency(totals.totalComm)}</TableCell>
                    <TableCell className="hidden xl:table-cell text-right text-primary text-xs">{formatCurrency(totals.totalNet)}</TableCell>
                    <TableCell colSpan={2}></TableCell>
                  </TableRow>
                </TableFooter>
              )}
            </Table>
          </div>
        )}
      </CardContent>

      {/* Student Report Modal */}
      {reportEvent && (
        <StudentReport
          eventId={reportEvent.id}
          eventName={reportEvent.school_name}
          eventDate={reportEvent.event_date}
          isOpen={!!reportEvent}
          onClose={() => setReportEvent(null)}
        />
      )}

      {/* QR Code Dialog */}
      {qrCodeEvent && (
        <EventQRCodeDialog
          open={!!qrCodeEvent}
          onOpenChange={(open) => !open && setQrCodeEvent(null)}
          eventId={qrCodeEvent.id}
          schoolName={qrCodeEvent.school_name}
          eventDate={qrCodeEvent.event_date}
        />
      )}

      {/* Commission Detail Dialog - only for franchise owners/admin */}
      {!isCollaborator && detailEvent && (() => {
        const fin = getEventFinancials(detailEvent);
        const payouts = payoutsByEvent?.[detailEvent.id] || {};
        
        const categories = [
          { key: 'seller', label: 'Vendedor', due: fin.sellerComm },
          { key: 'presenter', label: 'Apresentador', due: fin.presenterComm },
          { key: 'supervisor', label: 'Supervisor', due: fin.supervisorComm },
          { key: 'school', label: 'Escola', due: fin.schoolComm },
        ];

        const totalDue = fin.totalComm;
        const totalPaid = categories.reduce((sum, c) => sum + (payouts[c.key]?.paid || 0), 0);
        const totalPending = totalDue - totalPaid;

        return (
          <Dialog open={!!detailEvent} onOpenChange={(open) => !open && setDetailEvent(null)}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5" />
                  Comissões - {detailEvent.school_name}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                {categories.map(cat => {
                  const paid = payouts[cat.key]?.paid || 0;
                  const pending = cat.due - paid;
                  if (cat.due === 0) return null;
                  return (
                    <div key={cat.key} className="rounded-lg border p-3 space-y-1.5">
                      <p className="font-medium text-sm">{cat.label}</p>
                      <div className="grid grid-cols-3 gap-2 text-xs">
                        <div>
                          <span className="text-muted-foreground">Devido</span>
                          <p className="font-semibold text-destructive">{formatCurrency(cat.due)}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Pago</span>
                          <p className="font-semibold text-green-600 dark:text-green-400">{formatCurrency(paid)}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Pendente</span>
                          <p className="font-semibold text-yellow-600 dark:text-yellow-400">{formatCurrency(pending > 0 ? pending : 0)}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {/* Resumo Geral */}
                <div className="rounded-lg border-2 border-primary/30 p-3 space-y-1.5 bg-muted/30">
                  <p className="font-semibold text-sm">Resumo Geral</p>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <span className="text-muted-foreground">Total Devido</span>
                      <p className="font-bold text-destructive">{formatCurrency(totalDue)}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Total Pago</span>
                      <p className="font-bold text-green-600 dark:text-green-400">{formatCurrency(totalPaid)}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Total Pendente</span>
                      <p className="font-bold text-yellow-600 dark:text-yellow-400">{formatCurrency(totalPending > 0 ? totalPending : 0)}</p>
                    </div>
                  </div>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        );
      })()}

      {/* Floating selection bar */}
      {!isCollaborator && selectedEventIds.size >= 2 && (
        <div className="sticky bottom-0 left-0 right-0 bg-card border-t p-3 flex items-center justify-between gap-2 shadow-lg z-10">
          <span className="text-sm font-medium">{selectedEventIds.size} eventos selecionados</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setSelectedEventIds(new Set())}>
              Limpar
            </Button>
            <Button size="sm" onClick={() => setIsMergedOpen(true)}>
              <DollarSign className="h-4 w-4 mr-1" />
              Mesclar Financeiro
            </Button>
          </div>
        </div>
      )}

      {/* Merged Financial Dialog */}
      <MergedFinancialDialog
        open={isMergedOpen}
        onOpenChange={setIsMergedOpen}
        eventIds={Array.from(selectedEventIds)}
        events={(events || []) as any}
      />
    </Card>
  );
};

export default EventManagement;
