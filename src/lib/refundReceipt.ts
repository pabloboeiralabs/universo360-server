import jsPDF from 'jspdf';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export interface RefundReceiptData {
  ticketId: string;
  customerName: string;
  studentName?: string | null;
  classGrade?: string | null;
  eventName: string;
  eventDate?: string | null;
  franchiseName: string;
  amount: number;
  refundReason: string;
  refundedAt: string;
  paymentMethod?: string | null;
}

const paymentMethodLabel: Record<string, string> = {
  pix: 'PIX',
  credit_card: 'Cartão de Crédito',
  cash: 'Dinheiro',
  free: 'Gratuito',
  unknown: 'Outro',
};

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

function formatDateBR(dateStr: string): string {
  try {
    return format(new Date(dateStr), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
  } catch {
    return dateStr;
  }
}

export function generateRefundReceiptPDF(data: RefundReceiptData): void {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 20;
  const contentW = pageW - margin * 2;
  let y = 20;

  // ── Header background ──
  doc.setFillColor(15, 15, 35);
  doc.rect(0, 0, pageW, 50, 'F');

  // ── Title ──
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text('UNIVERSO 360', pageW / 2, y + 6, { align: 'center' });

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(180, 180, 210);
  doc.text('Planetário Móvel — Experiência Imersiva', pageW / 2, y + 14, { align: 'center' });

  // ── Red "ESTORNO" badge ──
  doc.setFillColor(220, 38, 38);
  doc.roundedRect(pageW / 2 - 28, y + 20, 56, 10, 3, 3, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('✗  COMPROVANTE DE ESTORNO', pageW / 2, y + 26.5, { align: 'center' });

  y = 60;

  // ── Section helper ──
  const drawSection = (title: string) => {
    doc.setFillColor(240, 240, 248);
    doc.rect(margin, y, contentW, 7, 'F');
    doc.setTextColor(80, 80, 120);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text(title.toUpperCase(), margin + 3, y + 5);
    y += 10;
  };

  const drawRow = (label: string, value: string, bold = false) => {
    doc.setTextColor(100, 100, 120);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(label, margin + 3, y);

    doc.setTextColor(30, 30, 50);
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.text(value, margin + contentW - 3, y, { align: 'right' });
    y += 7;
  };

  const drawDivider = () => {
    doc.setDrawColor(220, 220, 240);
    doc.line(margin, y, margin + contentW, y);
    y += 4;
  };

  // ── Cliente / Aluno ──
  drawSection('Dados do Cliente');
  drawRow('Nome do responsável', data.customerName);
  if (data.studentName) drawRow('Nome do aluno', data.studentName);
  if (data.classGrade) drawRow('Turma / Série', data.classGrade);

  y += 2;
  drawDivider();

  // ── Evento ──
  drawSection('Evento');
  drawRow('Escola / Evento', data.eventName);
  if (data.eventDate) {
    try {
      drawRow('Data do evento', format(new Date(data.eventDate), 'dd/MM/yyyy', { locale: ptBR }));
    } catch { /* ignore */ }
  }
  drawRow('Franquia', data.franchiseName);

  y += 2;
  drawDivider();

  // ── Pagamento original ──
  drawSection('Pagamento Original');
  const method = data.paymentMethod
    ? paymentMethodLabel[data.paymentMethod] ?? data.paymentMethod
    : 'Não informado';
  drawRow('Forma de pagamento', method);

  y += 2;
  drawDivider();

  // ── Estorno ──
  drawSection('Dados do Estorno');
  drawRow('Data/hora do estorno', formatDateBR(data.refundedAt));
  drawRow('Motivo', data.refundReason || 'Não informado');

  y += 2;
  drawDivider();

  // ── Valor em destaque ──
  doc.setFillColor(254, 242, 242);
  doc.setDrawColor(220, 38, 38);
  doc.roundedRect(margin, y, contentW, 18, 3, 3, 'FD');
  doc.setTextColor(100, 20, 20);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('Valor estornado', margin + 6, y + 7);
  doc.setTextColor(180, 10, 10);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(formatCurrency(data.amount), margin + contentW - 4, y + 12, { align: 'right' });

  y += 26;

  // ── Ticket ID ──
  doc.setFillColor(248, 246, 255);
  doc.setDrawColor(139, 92, 246);
  doc.setLineDashPattern([2, 2], 0);
  doc.roundedRect(margin, y, contentW, 12, 2, 2, 'FD');
  doc.setLineDashPattern([], 0);
  doc.setTextColor(100, 80, 160);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text('Código do ingresso', pageW / 2, y + 5, { align: 'center' });
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text(data.ticketId, pageW / 2, y + 10, { align: 'center' });

  y += 20;

  // ── Footer ──
  doc.setFillColor(245, 245, 250);
  doc.rect(0, y, pageW, 30, 'F');
  doc.setTextColor(140, 140, 170);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text(
    'Este documento comprova o estorno do ingresso. O valor será devolvido conforme prazo da operadora.',
    pageW / 2, y + 10, { align: 'center', maxWidth: contentW }
  );
  doc.setFontSize(7);
  doc.text(
    `Gerado em ${formatDateBR(new Date().toISOString())}`,
    pageW / 2, y + 20, { align: 'center' }
  );

  const fileName = `estorno_${data.ticketId.slice(0, 8)}_${format(new Date(data.refundedAt), 'yyyyMMdd')}.pdf`;
  doc.save(fileName);
}
