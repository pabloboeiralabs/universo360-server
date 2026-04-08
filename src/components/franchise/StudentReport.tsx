import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { 
  Users, 
  GraduationCap, 
  CheckCircle2, 
  Clock, 
  XCircle, 
  Download,
  ChevronDown,
  ChevronRight,
  Loader2,
  FileText,
  FileDown
} from 'lucide-react';
import { generateRefundReceiptPDF } from '@/lib/refundReceipt';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import jsPDF from 'jspdf';

interface Ticket {
  id: string;
  student_name: string | null;
  class_grade: string | null;
  shift: string | null;
  customer_name: string;
  payment_status: string;
  quantity: number;
  amount: number;
  created_at: string;
  refunded_at: string | null;
  refund_reason: string | null;
  payment_method: string | null;
}

interface StudentReportProps {
  eventId: string;
  eventName: string;
  eventDate: string;
  isOpen: boolean;
  onClose: () => void;
}

const StudentReport = ({ eventId, eventName, eventDate, isOpen, onClose }: StudentReportProps) => {
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(['all']));

  const { data: tickets, isLoading } = useQuery({
    queryKey: ['event-tickets', eventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tickets')
        .select('id, student_name, class_grade, shift, customer_name, payment_status, quantity, amount, created_at, refunded_at, refund_reason, payment_method, franchises(name)')
        .eq('event_id', eventId)
        .order('class_grade', { ascending: true })
        .order('shift', { ascending: true })
        .order('student_name', { ascending: true });

      if (error) throw error;
      return (data || []).map(t => ({
        ...t,
        payment_method: (t as any).payment_method ?? null,
        refunded_at: (t as any).refunded_at ?? null,
        refund_reason: (t as any).refund_reason ?? null,
        franchise_name: ((t as any).franchises as { name: string } | null)?.name || '',
      })) as (Ticket & { franchise_name: string })[];
    },
    enabled: isOpen,
  });

  const filteredTickets = useMemo(() => {
    if (!tickets) return [];
    if (statusFilter === 'all') return tickets;
    return tickets.filter((t) => t.payment_status === statusFilter);
  }, [tickets, statusFilter]);

  const groupedByClass = useMemo(() => {
    const groups: Record<string, Ticket[]> = {};
    
    filteredTickets.forEach((ticket) => {
      const classKey = ticket.class_grade || 'Sem Turma';
      if (!groups[classKey]) {
        groups[classKey] = [];
      }
      groups[classKey].push(ticket);
    });

    // Sort groups alphabetically
    const sortedKeys = Object.keys(groups).sort((a, b) => a.localeCompare(b, 'pt-BR'));
    const sortedGroups: Record<string, Ticket[]> = {};
    sortedKeys.forEach((key) => {
      sortedGroups[key] = groups[key].sort((a, b) => 
        (a.student_name || a.customer_name).localeCompare(b.student_name || b.customer_name, 'pt-BR')
      );
    });

    return sortedGroups;
  }, [filteredTickets]);

  const stats = useMemo(() => {
    if (!tickets) return { paid: 0, pending: 0, cancelled: 0, totalStudents: 0 };
    
    const paid = tickets.filter((t) => t.payment_status === 'approved').length;
    const pending = tickets.filter((t) => t.payment_status === 'pending').length;
    const cancelled = tickets.filter((t) => t.payment_status === 'rejected' || t.payment_status === 'cancelled').length;
    
    return { 
      paid, 
      pending, 
      cancelled, 
      totalStudents: tickets.reduce((sum, t) => sum + t.quantity, 0) 
    };
  }, [tickets]);

  const toggleGroup = (group: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(group)) {
        next.delete(group);
      } else {
        next.add(group);
      }
      return next;
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <Badge className="bg-green-500/20 text-green-600 border-green-500/30">Pago</Badge>;
      case 'pending':
        return <Badge variant="outline" className="text-yellow-600 border-yellow-500/50">Pendente</Badge>;
      case 'rejected':
      case 'cancelled':
        return <Badge variant="destructive">Cancelado</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getShiftLabel = (shift: string | null) => {
    if (!shift) return '-';
    const labels: Record<string, string> = { morning: 'Manhã', afternoon: 'Tarde', full_time: 'Integral', night: 'Noite' };
    return labels[shift] || shift;
  };

  const exportToCSV = () => {
    if (!tickets) return;

    const headers = ['Turma', 'Turno', 'Nome do Aluno', 'Status', 'Valor'];
    const rows = filteredTickets.map((t) => [
      t.class_grade || 'Sem Turma',
      getShiftLabel(t.shift),
      t.student_name || t.customer_name,
      t.payment_status === 'approved' ? 'Pago' : t.payment_status === 'pending' ? 'Pendente' : 'Cancelado',
      t.amount.toFixed(2),
    ]);

    const csvContent = [headers, ...rows]
      .map((row) => row.map((cell) => `"${cell}"`).join(','))
      .join('\n');

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `alunos-${eventName.replace(/\s+/g, '-')}-${eventDate}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'approved': return 'Pago';
      case 'pending': return 'Pendente';
      case 'rejected':
      case 'cancelled': return 'Cancelado';
      default: return status;
    }
  };

  const exportToPDF = () => {
    if (!tickets) return;

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 20;
    const formattedDate = format(new Date(eventDate + 'T00:00:00'), "dd 'de' MMMM 'de' yyyy", { locale: ptBR });

    // Group tickets by shift first, then by class
    const morningTickets = filteredTickets.filter(t => t.shift === 'morning');
    const afternoonTickets = filteredTickets.filter(t => t.shift === 'afternoon');
    const fullTimeTickets = filteredTickets.filter(t => t.shift === 'full_time');
    const nightTickets = filteredTickets.filter(t => t.shift === 'night');
    const otherTickets = filteredTickets.filter(t => !['morning', 'afternoon', 'full_time', 'night'].includes(t.shift || ''));

    const groupByClass = (list: Ticket[]) => {
      return list.reduce((acc, t) => {
        const grade = t.class_grade || 'Sem Turma';
        if (!acc[grade]) acc[grade] = [];
        acc[grade].push(t);
        return acc;
      }, {} as Record<string, Ticket[]>);
    };

    const shiftSections: { label: string; classes: Record<string, Ticket[]>; count: number }[] = [];
    if (morningTickets.length > 0) shiftSections.push({ label: '☀️ TURMAS DA MANHÃ', classes: groupByClass(morningTickets), count: morningTickets.length });
    if (afternoonTickets.length > 0) shiftSections.push({ label: '🌙 TURMAS DA TARDE', classes: groupByClass(afternoonTickets), count: afternoonTickets.length });
    if (fullTimeTickets.length > 0) shiftSections.push({ label: '📚 TURMAS INTEGRAL', classes: groupByClass(fullTimeTickets), count: fullTimeTickets.length });
    if (nightTickets.length > 0) shiftSections.push({ label: '🌃 TURMAS DA NOITE', classes: groupByClass(nightTickets), count: nightTickets.length });
    if (otherTickets.length > 0) shiftSections.push({ label: 'OUTROS', classes: groupByClass(otherTickets), count: otherTickets.length });

    const drawHeader = (yStart: number) => {
      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.text('RELATÓRIO DE ALUNOS', pageWidth / 2, yStart, { align: 'center' });
      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      doc.text(`Escola: ${eventName}`, margin, yStart + 15);
      doc.text(`Data do Evento: ${formattedDate}`, margin, yStart + 23);
      doc.text(`Total de Alunos: ${stats.totalStudents}`, margin, yStart + 31);
      doc.setFontSize(9);
      doc.setTextColor(100);
      doc.text(`Pagos: ${stats.paid} | Pendentes: ${stats.pending} | Cancelados: ${stats.cancelled}`, margin, yStart + 39);
      doc.setTextColor(0);
      doc.setDrawColor(200);
      doc.line(margin, yStart + 45, pageWidth - margin, yStart + 45);
      return yStart + 57;
    };

    let yPosition = drawHeader(25);
    let isFirstShift = true;

    shiftSections.forEach((section) => {
      // Each shift section starts on a new page (except the first)
      if (!isFirstShift) {
        doc.addPage();
        yPosition = drawHeader(25);
      }
      isFirstShift = false;

      // Shift section header
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.setFillColor(220, 230, 245);
      doc.rect(margin, yPosition - 6, pageWidth - (margin * 2), 12, 'F');
      doc.text(`${section.label}  (${section.count} aluno${section.count !== 1 ? 's' : ''})`, margin + 3, yPosition + 2);
      yPosition += 16;

      Object.entries(section.classes).forEach(([classGrade, classTickets]) => {
        if (yPosition > pageHeight - 40) {
          doc.addPage();
          yPosition = 25;
        }

        // Class header
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.setFillColor(245, 245, 245);
        doc.rect(margin, yPosition - 5, pageWidth - (margin * 2), 10, 'F');
        doc.text(`Turma: ${classGrade}`, margin + 3, yPosition + 2);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.text(`(${classTickets.length} aluno${classTickets.length > 1 ? 's' : ''})`, margin + 50 + classGrade.length * 2, yPosition + 2);
        yPosition += 14;

        // Table header
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.text('#', margin + 3, yPosition);
        doc.text('Nome do Aluno', margin + 15, yPosition);
        doc.text('Status', pageWidth - margin - 25, yPosition);
        yPosition += 3;
        doc.setDrawColor(180);
        doc.line(margin, yPosition, pageWidth - margin, yPosition);
        yPosition += 6;

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);

        classTickets.forEach((ticket, index) => {
          if (yPosition > pageHeight - 25) {
            doc.addPage();
            yPosition = 25;
            doc.setFontSize(10);
            doc.setFont('helvetica', 'bold');
            doc.text(`Turma: ${classGrade} (continuação)`, margin, yPosition);
            yPosition += 10;
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(9);
          }

          const studentName = ticket.student_name || ticket.customer_name;
          const status = getStatusText(ticket.payment_status);

          if (index % 2 === 0) {
            doc.setFillColor(250, 250, 250);
            doc.rect(margin, yPosition - 4, pageWidth - (margin * 2), 7, 'F');
          }

          doc.text(`${index + 1}`, margin + 3, yPosition);
          const maxNameLength = 50;
          const displayName = studentName.length > maxNameLength
            ? studentName.substring(0, maxNameLength) + '...'
            : studentName;
          doc.text(displayName, margin + 15, yPosition);

          if (status === 'Pago') doc.setTextColor(34, 139, 34);
          else if (status === 'Pendente') doc.setTextColor(184, 134, 11);
          else doc.setTextColor(178, 34, 34);
          doc.text(status, pageWidth - margin - 25, yPosition);
          doc.setTextColor(0);

          yPosition += 7;
        });

        yPosition += 8;
      });
    });

    // Footer on all pages
    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(128);
      const generatedAt = format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
      doc.text(`Gerado em: ${generatedAt} — Página ${i}/${totalPages}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
      doc.setTextColor(0);
    }

    const safeEventName = eventName.replace(/[^a-zA-Z0-9]/g, '-').substring(0, 30);
    doc.save(`relatorio-${safeEventName}-${eventDate}.pdf`);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GraduationCap className="h-5 w-5" />
            Relatório de Alunos - {eventName}
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            {format(new Date(eventDate + 'T00:00:00'), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
          </p>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="flex-1 overflow-hidden flex flex-col gap-4">
            {/* Stats Cards */}
            <div className="grid grid-cols-4 gap-4">
              <Card className="p-3">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-primary" />
                  <div>
                    <p className="text-xs text-muted-foreground">Total Alunos</p>
                    <p className="text-xl font-bold">{stats.totalStudents}</p>
                  </div>
                </div>
              </Card>
              <Card className="p-3">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <div>
                    <p className="text-xs text-muted-foreground">Pagos</p>
                    <p className="text-xl font-bold text-green-600">{stats.paid}</p>
                  </div>
                </div>
              </Card>
              <Card className="p-3">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-yellow-500" />
                  <div>
                    <p className="text-xs text-muted-foreground">Pendentes</p>
                    <p className="text-xl font-bold text-yellow-600">{stats.pending}</p>
                  </div>
                </div>
              </Card>
              <Card className="p-3">
                <div className="flex items-center gap-2">
                  <XCircle className="h-4 w-4 text-destructive" />
                  <div>
                    <p className="text-xs text-muted-foreground">Cancelados</p>
                    <p className="text-xl font-bold text-destructive">{stats.cancelled}</p>
                  </div>
                </div>
              </Card>
            </div>

            {/* Filters and Actions */}
            <div className="flex items-center justify-between">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Filtrar por status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os status</SelectItem>
                  <SelectItem value="approved">Pagos</SelectItem>
                  <SelectItem value="pending">Pendentes</SelectItem>
                  <SelectItem value="rejected">Cancelados</SelectItem>
                </SelectContent>
              </Select>

              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={exportToCSV}>
                  <Download className="h-4 w-4 mr-2" />
                  CSV
                </Button>
                <Button size="sm" onClick={exportToPDF}>
                  <FileText className="h-4 w-4 mr-2" />
                  PDF
                </Button>
              </div>
            </div>

            {/* Grouped Table */}
            <div className="flex-1 overflow-auto rounded-md border">
              {Object.keys(groupedByClass).length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Nenhum ingresso encontrado</p>
                </div>
              ) : (
                <div className="divide-y">
                  {Object.entries(groupedByClass).map(([classGrade, classTickets]) => (
                    <div key={classGrade}>
                      <button
                        className="w-full flex items-center justify-between px-4 py-3 bg-muted/50 hover:bg-muted transition-colors"
                        onClick={() => toggleGroup(classGrade)}
                      >
                        <div className="flex items-center gap-2">
                          {expandedGroups.has(classGrade) ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                          <span className="font-semibold">Turma {classGrade}</span>
                          <Badge variant="secondary">{classTickets.length} aluno(s)</Badge>
                        </div>
                      </button>

                      {expandedGroups.has(classGrade) && (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-8">#</TableHead>
                              <TableHead>Aluno</TableHead>
                              <TableHead>Turno</TableHead>
                              <TableHead>Status</TableHead>
                              <TableHead className="w-8"></TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {classTickets.map((ticket, index) => (
                              <TableRow key={ticket.id}>
                                <TableCell className="text-muted-foreground">
                                  {index + 1}
                                </TableCell>
                                <TableCell className="font-medium">
                                  {ticket.student_name || ticket.customer_name}
                                </TableCell>
                                <TableCell>
                                  <Badge variant="outline" className="text-xs">
                                    {getShiftLabel(ticket.shift)}
                                  </Badge>
                                </TableCell>
                                <TableCell>
                                  {getStatusBadge(ticket.payment_status)}
                                </TableCell>
                                <TableCell>
                                  {ticket.payment_status === 'refunded' && ticket.refunded_at && (
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-6 w-6 text-purple-600 hover:bg-purple-500/10"
                                      title="Baixar comprovante de estorno"
                                      onClick={() => generateRefundReceiptPDF({
                                        ticketId: ticket.id,
                                        customerName: ticket.customer_name,
                                        studentName: ticket.student_name,
                                        classGrade: ticket.class_grade,
                                        eventName,
                                        eventDate,
                                        franchiseName: (ticket as any).franchise_name || '',
                                        amount: ticket.amount,
                                        refundReason: ticket.refund_reason || 'Não informado',
                                        refundedAt: ticket.refunded_at,
                                        paymentMethod: ticket.payment_method,
                                      })}
                                    >
                                      <FileDown className="h-3.5 w-3.5" />
                                    </Button>
                                  )}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default StudentReport;
