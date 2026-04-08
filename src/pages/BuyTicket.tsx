import { useState, Component, ReactNode } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Calendar, MapPin, Clock, Users, Ticket, Loader2,
  AlertCircle, CheckCircle2, ArrowLeft, CreditCard, Banknote,
} from 'lucide-react';

import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { z } from 'zod';
import { masks } from '@/lib/masks';
import PaymentMethodSelector, { type PaymentMethod } from '@/components/checkout/PaymentMethodSelector';
import PixQRCode from '@/components/checkout/PixQRCode';
import { useMercadoPago } from '@/hooks/useMercadoPago';

class BuyTicketErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; error: string }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: '' };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error: error.message };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="dark min-h-screen flex items-center justify-center bg-background p-4">
          <Card className="max-w-md w-full">
            <CardContent className="pt-6 text-center">
              <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
              <h2 className="text-xl font-semibold mb-2">Erro ao carregar</h2>
              <p className="text-muted-foreground mb-4">Ocorreu um erro inesperado. Tente recarregar a página.</p>
              <Button onClick={() => window.location.reload()}>Recarregar</Button>
            </CardContent>
          </Card>
        </div>
      );
    }
    return this.props.children;
  }
}

const ticketFormSchema = z.object({
  student_name: z.string().min(3, 'Nome do aluno deve ter pelo menos 3 caracteres').max(100),
  class_grade: z.string().min(1, 'Selecione a turma/série'),
  shift: z.string().min(1, 'Selecione o turno'),
  payer_name: z.string().min(3, 'Nome do responsável obrigatório'),
  payer_email: z.string().email('Email inválido'),
  payer_cpf: z.string().min(14, 'CPF inválido'),
  payer_phone: z.string().min(15, 'Telefone inválido'),
});

type TicketForm = z.infer<typeof ticketFormSchema>;

interface CardForm {
  holderName: string;
  cardNumber: string;
  expMonth: string;
  expYear: string;
  cvv: string;
  postalCode: string;
  addressNumber: string;
}

interface PixData {
  qr_code: string;
  qr_code_base64: string;
  expiration_date: string;
  ticket_id: string;
}

// Maps Mercado Pago status_detail codes to friendly Portuguese messages
function mapMpRejectionReason(code: string | null | undefined): string {
  const map: Record<string, string> = {
    cc_rejected_bad_filled_card_number: 'Número do cartão inválido. Verifique e tente novamente.',
    cc_rejected_bad_filled_date: 'Data de vencimento inválida. Verifique e tente novamente.',
    cc_rejected_bad_filled_other: 'Dados do cartão incorretos. Verifique e tente novamente.',
    cc_rejected_bad_filled_security_code: 'Código de segurança (CVV) inválido.',
    cc_rejected_blacklist: 'Cartão bloqueado pela operadora. Entre em contato com o banco.',
    cc_rejected_call_for_authorize: 'Transação não autorizada. Ligue para o banco para liberar.',
    cc_rejected_card_disabled: 'Cartão desativado. Entre em contato com o banco.',
    cc_rejected_card_error: 'Não foi possível processar o cartão. Tente outro cartão.',
    cc_rejected_duplicated_payment: 'Pagamento duplicado detectado. Aguarde antes de tentar novamente.',
    cc_rejected_high_risk: 'Pagamento recusado por risco. Use outro cartão ou pague via PIX.',
    cc_rejected_insufficient_amount: 'Saldo insuficiente no cartão.',
    cc_rejected_invalid_installments: 'Número de parcelas inválido.',
    cc_rejected_max_attempts: 'Número máximo de tentativas atingido. Tente com outro cartão.',
    cc_rejected_other_reason: 'Pagamento recusado pela operadora. Tente outro cartão ou pague via PIX.',
    pending_review_manual: 'Pagamento em análise manual.',
    pending_contingency: 'Processamento temporariamente indisponível. Tente novamente.',
  };
  if (!code) return 'Pagamento recusado. Verifique os dados do cartão ou tente com PIX.';
  return map[code] ?? `Pagamento recusado: ${code.replace(/_/g, ' ')}.`;
}

const BuyTicket = () => {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof TicketForm, string>>>({});
  const [form, setForm] = useState<TicketForm>({
    student_name: '',
    class_grade: '',
    shift: '',
    payer_name: '',
    payer_email: '',
    payer_cpf: '',
    payer_phone: '',
  });

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('pix');

  const handleSelectPaymentMethod = (method: PaymentMethod) => {
    setPaymentMethod(method);
    // Scroll to top on mobile so the form is visible
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const [cashPassword, setCashPassword] = useState('');
  const [cardForm, setCardForm] = useState<CardForm>({
    holderName: '', cardNumber: '', expMonth: '', expYear: '', cvv: '', postalCode: '', addressNumber: '',
  });
  const [cardErrors, setCardErrors] = useState<Partial<Record<keyof CardForm, string>>>({});
  const [pixData, setPixData] = useState<PixData | null>(null);
  const [paymentResult, setPaymentResult] = useState<{ status: string; reason?: string } | null>(null);
  const [mpPublicKey, setMpPublicKey] = useState<string | null>(null);
  const [isMpGateway, setIsMpGateway] = useState(false);

  // MercadoPago SDK — only initialized when the franchise uses MercadoPago
  const { tokenizeCard } = useMercadoPago(isMpGateway ? mpPublicKey : null);

  // Queries
  const { data: event, isLoading, error } = useQuery({
    queryKey: ['event-details', eventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('id', eventId)
        .eq('is_active', true)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!eventId,
  });

  const { data: franchiseConfig } = useQuery({
    queryKey: ['franchise-gateway', event?.franchise_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('franchises')
        .select('asaas_api_key, pagbank_token, mercadopago_access_token, mercadopago_public_key, payment_gateway')
        .eq('id', event!.franchise_id)
        .single();
      if (error) throw error;
      const gw = (data as any)?.payment_gateway || 'asaas';
      let hasKey = false;
      if (gw === 'asaas') hasKey = !!(data as any)?.asaas_api_key;
      else if (gw === 'pagbank') hasKey = !!(data as any)?.pagbank_token;
      else if (gw === 'mercadopago') hasKey = !!(data as any)?.mercadopago_access_token;
      const pk = (data as any)?.mercadopago_public_key || null;
      if (gw === 'mercadopago' && pk) {
        setMpPublicKey(pk);
        setIsMpGateway(true);
      }
      return {
        hasKey,
        gateway: gw,
        mpPublicKey: pk,
      };
    },
    enabled: !!event?.franchise_id,
  });

  const { data: eventGrades, isLoading: gradesLoading } = useQuery({
    queryKey: ['event-grades', eventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('event_grades')
        .select(`id, custom_grade_name, grade_id, grades (id, name)`)
        .eq('event_id', eventId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      // Deduplicate by name, keeping the first occurrence (preserves order)
      const seen = new Set<string>();
      return data
        .map((eg) => ({
          id: eg.id,
          name: eg.custom_grade_name || eg.grades?.name || 'Série desconhecida',
        }))
        .filter((g) => {
          if (seen.has(g.name)) return false;
          seen.add(g.name);
          return true;
        });
    },
    enabled: !!eventId,
  });

  const isFreeEvent = event?.price === 0;

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

  const formatCardNumber = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 16);
    return digits.replace(/(\d{4})(?=\d)/g, '$1 ');
  };

  // ── Validation ──────────────────────────────────────────────
  const validateForm = (): boolean => {
    try {
      if (isFreeEvent || paymentMethod === 'cash') {
        z.object({
          student_name: ticketFormSchema.shape.student_name,
          class_grade: ticketFormSchema.shape.class_grade,
          shift: ticketFormSchema.shape.shift,
        }).parse({ student_name: form.student_name, class_grade: form.class_grade, shift: form.shift });
      } else {
        ticketFormSchema.parse(form);
      }
      setErrors({});
      return true;
    } catch (err) {
      if (err instanceof z.ZodError) {
        const newErrors: Partial<Record<keyof TicketForm, string>> = {};
        err.errors.forEach((e) => { newErrors[e.path[0] as keyof TicketForm] = e.message; });
        setErrors(newErrors);
      }
      return false;
    }
  };

  const validateCardForm = (): boolean => {
    const errs: Partial<Record<keyof CardForm, string>> = {};
    const clean = cardForm.cardNumber.replace(/\s/g, '');
    if (clean.length < 13) errs.cardNumber = 'Número do cartão inválido';
    if (cardForm.holderName.length < 3) errs.holderName = 'Nome obrigatório';
    if (!/^\d{2}$/.test(cardForm.expMonth) || +cardForm.expMonth < 1 || +cardForm.expMonth > 12) errs.expMonth = 'Mês inválido';
    if (!/^\d{4}$/.test(cardForm.expYear) || +cardForm.expYear < new Date().getFullYear()) errs.expYear = 'Ano inválido';
    if (cardForm.cvv.length < 3) errs.cvv = 'CVV inválido';
    if (cardForm.postalCode && cardForm.postalCode.replace(/\D/g, '').length > 0 && cardForm.postalCode.replace(/\D/g, '').length < 8) errs.postalCode = 'CEP inválido';
    setCardErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleChange = (field: keyof TicketForm, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const handleCardChange = (field: keyof CardForm, value: string) => {
    setCardForm((prev) => ({ ...prev, [field]: value }));
    if (cardErrors[field]) setCardErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  // ── Submit handlers ─────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) {
      toast.error('Por favor, preencha todos os campos corretamente');
      return;
    }
    if (!event?.franchise_id) {
      toast.error('Evento sem franquia configurada.');
      return;
    }
    if (isFreeEvent) {
      await handleFreeEventSubmit();
      return;
    }
    if (paymentMethod === 'cash') {
      setIsSubmitting(true);
      try {
        const { data, error: fnError } = await supabase.functions.invoke('register-cash-ticket', {
          body: { event_id: eventId, student_name: form.student_name, class_grade: form.class_grade, shift: form.shift, password: cashPassword },
        });
        if (fnError) throw new Error(fnError.message);
        if (data?.error) { toast.error(data.error); return; }
        navigate(`/payment-status?status=approved&ticket_id=${data.ticket_id}&type=cash`);
      } catch (error) {
        console.error('Cash payment error:', error);
        toast.error('Erro ao registrar pagamento em dinheiro.');
      } finally {
        setIsSubmitting(false);
      }
      return;
    }
    if (!franchiseConfig?.hasKey) {
      toast.error('Credenciais de pagamento não configuradas. Entre em contato com o administrador.');
      return;
    }

    if (paymentMethod === 'card' && !validateCardForm()) {
      toast.error('Preencha os dados do cartão corretamente');
      return;
    }

    await handlePaidSubmit();
  };

  const handleFreeEventSubmit = async () => {
    setIsSubmitting(true);
    try {
      const response = await supabase.functions.invoke('register-free-ticket', {
        body: {
          event_id: eventId,
          student_name: form.student_name,
          class_grade: form.class_grade,
          shift: form.shift,
        },
      });
      if (response.error) throw new Error(response.error.message);
      const data = response.data;
      if (data.error) { toast.error(data.message || data.error); return; }
      navigate(`/payment-status?status=approved&ticket_id=${data.ticket_id}&type=free`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao processar');
    } finally {
      setIsSubmitting(false);
    }
  };

  // handleCashSubmit removed — logic moved to register-cash-ticket edge function

  const handlePaidSubmit = async () => {
    setIsSubmitting(true);
    try {
      const gateway = franchiseConfig?.gateway || 'asaas';

      const payload: Record<string, unknown> = {
        event_id: eventId,
        student_name: form.student_name,
        class_grade: form.class_grade,
        shift: form.shift,
        payment_method: paymentMethod === 'card' ? 'credit_card' : 'pix',
        payer: {
          email: form.payer_email,
          name: form.payer_name,
          cpf: form.payer_cpf,
          phone: form.payer_phone,
        },
      };

      if (paymentMethod === 'card') {
        if (gateway === 'mercadopago') {
          // ── Tokenize card via MercadoPago.js SDK ──
          const cpfClean = form.payer_cpf.replace(/\D/g, '');
          const { token: cardToken, paymentMethodId } = await tokenizeCard({
            cardNumber: cardForm.cardNumber,
            cardholderName: cardForm.holderName,
            cardExpirationMonth: cardForm.expMonth,
            cardExpirationYear: cardForm.expYear,
            securityCode: cardForm.cvv,
            identificationType: 'CPF',
            identificationNumber: cpfClean,
          });
          payload.mp_card_token = cardToken;
          payload.mp_payment_method_id = paymentMethodId;
        } else {
          // ASAAS / PagBank: send raw card data
          payload.credit_card = {
            holderName: cardForm.holderName,
            number: cardForm.cardNumber.replace(/\s/g, ''),
            expiryMonth: cardForm.expMonth,
            expiryYear: cardForm.expYear,
            ccv: cardForm.cvv,
          };
          payload.credit_card_holder_info = {
            postalCode: cardForm.postalCode,
            addressNumber: cardForm.addressNumber,
          };
        }
      }

      const response = await supabase.functions.invoke('process-payment', { body: payload });

      if (response.error) throw new Error(response.error.message);
      const result = response.data;
      if (result.error) {
        toast.error(result.details?.errors?.[0]?.description || result.error);
        return;
      }

      if (result.payment_method === 'pix' && result.pix) {
        setPixData({
          qr_code: result.pix.qr_code,
          qr_code_base64: result.pix.qr_code_base64,
          expiration_date: result.pix.expiration_date,
          ticket_id: result.ticket_id,
        });
      } else if (result.payment_method === 'credit_card') {
        if (result.payment_status === 'approved') {
          navigate(`/payment-status?status=approved&ticket_id=${result.ticket_id}`);
        } else if (result.payment_status === 'rejected') {
          const reason = mapMpRejectionReason(result.rejection_reason);
          setPaymentResult({ status: 'rejected', reason });
        } else {
          navigate(`/payment-status?status=pending&ticket_id=${result.ticket_id}`);
        }
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao processar pagamento');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Form valid check ────────────────────────────────────────
  const isBaseFormValid =
    form.student_name.length >= 3 && form.class_grade.length >= 1 && form.shift.length >= 1;

  const isPayerFormValid =
    form.payer_name.length >= 3 &&
    form.payer_email.length >= 3 &&
    form.payer_cpf.length >= 14 &&
    form.payer_phone.length >= 15;

  const isFormValid = isFreeEvent || paymentMethod === 'cash' ? isBaseFormValid : isBaseFormValid && isPayerFormValid;

  // ── PIX QR Code view ───────────────────────────────────────
  if (pixData) {
    return (
      <div className="dark min-h-screen bg-gradient-to-b from-background to-muted/30 py-8 px-4">
        <div className="max-w-md mx-auto">
          <PixQRCode
            qrCode={pixData.qr_code}
            qrCodeBase64={pixData.qr_code_base64}
            ticketId={pixData.ticket_id}
            expirationDate={pixData.expiration_date}
            onPaymentConfirmed={() => {
              navigate(`/payment-status?status=approved&ticket_id=${pixData.ticket_id}`);
            }}
          />
        </div>
      </div>
    );
  }

  // ── Loading / error states ──────────────────────────────────
  if (isLoading || gradesLoading) {
    return (
      <div className="dark min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="dark min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Evento não encontrado</h2>
            <p className="text-muted-foreground mb-4">Este evento não existe ou não está mais disponível.</p>
            <Button onClick={() => navigate('/')}>Voltar ao início</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!eventGrades || eventGrades.length === 0) {
    return (
      <div className="dark min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Turmas não configuradas</h2>
            <p className="text-muted-foreground mb-4">Este evento ainda não possui turmas configuradas.</p>
            <Button onClick={() => navigate('/')}>Voltar ao início</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (event.available_spots === 0) {
    return (
      <div className="dark min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Vagas Esgotadas</h2>
            <p className="text-muted-foreground mb-4">Todas as vagas foram preenchidas.</p>
            <Button onClick={() => navigate('/')}>Ver outros eventos</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const salesDeadline = (event as any).sales_deadline;
  // Compare in local time: treat deadline as Brasília time (UTC-3) if stored without timezone
  const isSalesDeadlinePassed = (() => {
    if (!salesDeadline) return false;
    const deadlineDate = new Date(salesDeadline);
    // If the stored string has no timezone info (no 'Z', no '+', no '-' after the time part),
    // it was stored as local Brasília time — append -03:00 offset
    const hasTimezone = /[Z+\-]\d{2}:?\d{2}$/.test(salesDeadline) || salesDeadline.endsWith('Z');
    if (!hasTimezone) {
      // Parse as Brasília time (UTC-3)
      const localDeadline = new Date(salesDeadline + '-03:00');
      return localDeadline < new Date();
    }
    return deadlineDate < new Date();
  })();
  if (isSalesDeadlinePassed) {
    return (
      <div className="dark min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Vendas Encerradas</h2>
            <p className="text-muted-foreground mb-4">O prazo para compra de ingressos deste evento já encerrou.</p>
            <Button onClick={() => navigate('/')}>Ver outros eventos</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Main form ───────────────────────────────────────────────
  return (
    <div className="dark min-h-screen bg-gradient-to-b from-background to-muted/30 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <Button
          variant="ghost"
          className="mb-4 text-muted-foreground hover:text-foreground"
          onClick={() => navigate('/ingressos')}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar aos eventos
        </Button>

        {/* Event Details */}
        <Card className="mb-6">
          <CardHeader className="pb-4">
            <div className="flex items-start justify-between">
<div>
                <CardTitle className="text-2xl">{event.school_name}</CardTitle>
              </div>
              <Badge
                variant={isFreeEvent ? 'default' : 'secondary'}
                className={`text-lg px-3 py-1 ${isFreeEvent ? 'bg-green-500 hover:bg-green-600' : ''}`}
              >
                {isFreeEvent ? 'Gratuito' : formatCurrency(event.price)}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-primary" />
                <span>{format(new Date(event.event_date + 'T00:00:00'), "EEEE, dd 'de' MMMM", { locale: ptBR })}</span>
              </div>
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-primary" />
                <span>{event.location}</span>
              </div>
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" />
                <span>{event.available_spots} vagas disponíveis</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Ticket className="h-5 w-5" /> {isFreeEvent ? 'Dados do Aluno' : 'Dados para Compra'}
            </CardTitle>
            <CardDescription>
              {isFreeEvent
                ? 'Preencha os dados abaixo para se inscrever'
                : 'Preencha os dados abaixo e escolha a forma de pagamento.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Student fields */}
              <div className="space-y-2">
                <Label htmlFor="student_name">Nome do Aluno <span className="text-destructive">*</span></Label>
                <Input
                  id="student_name"
                  placeholder="Nome completo do aluno"
                  value={form.student_name}
                  onChange={(e) => handleChange('student_name', e.target.value)}
                  className={errors.student_name ? 'border-destructive' : ''}
                />
                {errors.student_name && <p className="text-sm text-destructive">{errors.student_name}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="class_grade">Turma/Série <span className="text-destructive">*</span></Label>
                <Select
                  value={eventGrades?.find(g => g.name === form.class_grade)?.id ?? ''}
                  onValueChange={(id) => {
                    const grade = eventGrades?.find(g => g.id === id);
                    if (grade) handleChange('class_grade', grade.name);
                  }}
                >
                  <SelectTrigger className={errors.class_grade ? 'border-destructive' : ''}>
                    <SelectValue placeholder="Selecione a turma" />
                  </SelectTrigger>
                  <SelectContent position="item-aligned" className="z-[200]">
                    {eventGrades.map((grade) => (
                      <SelectItem key={grade.id} value={grade.id}>{grade.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.class_grade && <p className="text-sm text-destructive">{errors.class_grade}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="shift">Turno <span className="text-destructive">*</span></Label>
                <Select value={form.shift} onValueChange={(value) => handleChange('shift', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o turno" />
                  </SelectTrigger>
                  <SelectContent position="item-aligned" className="z-[200]">
                    <SelectItem value="morning">Manhã</SelectItem>
                    <SelectItem value="afternoon">Tarde</SelectItem>
                    <SelectItem value="full_time">Integral</SelectItem>
                    <SelectItem value="night">Noite</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Payment Method Selection - for paid events */}
              {!isFreeEvent && (
                <div className="pt-4 border-t">
                  <PaymentMethodSelector
                    selectedMethod={paymentMethod}
                    onSelectMethod={handleSelectPaymentMethod}
                    showCash={!!(event as any).cash_password}
                  />

                  {paymentMethod === 'cash' && (
                    <div className="space-y-2 mt-4">
                      <Label htmlFor="cash_password">Senha para Dinheiro <span className="text-destructive">*</span></Label>
                      <Input
                        id="cash_password"
                        type="password"
                        placeholder="Digite a senha de autorização"
                        value={cashPassword}
                        onChange={(e) => setCashPassword(e.target.value)}
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Payer fields - only for paid events with card/pix */}
              {!isFreeEvent && paymentMethod !== 'cash' && (
                <>
                  <div className="pt-4 border-t">
                    <p className="text-sm font-medium text-muted-foreground mb-3">Dados do Responsável pelo Pagamento</p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="payer_name">Nome Completo <span className="text-destructive">*</span></Label>
                    <Input
                      id="payer_name"
                      placeholder="Nome do responsável"
                      value={form.payer_name}
                      onChange={(e) => handleChange('payer_name', e.target.value)}
                      className={errors.payer_name ? 'border-destructive' : ''}
                    />
                    {errors.payer_name && <p className="text-sm text-destructive">{errors.payer_name}</p>}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="payer_email">Email <span className="text-destructive">*</span></Label>
                    <Input
                      id="payer_email"
                      type="email"
                      placeholder="seu@email.com"
                      value={form.payer_email}
                      onChange={(e) => handleChange('payer_email', e.target.value)}
                      className={errors.payer_email ? 'border-destructive' : ''}
                    />
                    {errors.payer_email && <p className="text-sm text-destructive">{errors.payer_email}</p>}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="payer_cpf">CPF <span className="text-destructive">*</span></Label>
                    <Input
                      id="payer_cpf"
                      placeholder="000.000.000-00"
                      value={form.payer_cpf}
                      maxLength={14}
                      onChange={(e) => handleChange('payer_cpf', masks.cpf(e.target.value))}
                      className={errors.payer_cpf ? 'border-destructive' : ''}
                    />
                    {errors.payer_cpf && <p className="text-sm text-destructive">{errors.payer_cpf}</p>}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="payer_phone">Celular <span className="text-destructive">*</span></Label>
                    <Input
                      id="payer_phone"
                      placeholder="(00) 00000-0000"
                      value={form.payer_phone}
                      maxLength={15}
                      onChange={(e) => handleChange('payer_phone', masks.cellphone(e.target.value))}
                      className={errors.payer_phone ? 'border-destructive' : ''}
                    />
                    {errors.payer_phone && <p className="text-sm text-destructive">{errors.payer_phone}</p>}
                  </div>

                  {/* Credit Card Form */}
                  {paymentMethod === 'card' && (
                    <div className="space-y-4 pt-2">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <CreditCard className="h-5 w-5" />
                        <span className="text-sm">Dados do Cartão de Crédito</span>
                      </div>

                      <div className="space-y-2">
                        <Label>Nome no cartão <span className="text-destructive">*</span></Label>
                        <Input
                          placeholder="Nome como está no cartão"
                          value={cardForm.holderName}
                          onChange={(e) => handleCardChange('holderName', e.target.value.toUpperCase())}
                          className={cardErrors.holderName ? 'border-destructive' : ''}
                        />
                        {cardErrors.holderName && <p className="text-sm text-destructive">{cardErrors.holderName}</p>}
                      </div>

                      <div className="space-y-2">
                        <Label>Número do cartão <span className="text-destructive">*</span></Label>
                        <Input
                          placeholder="0000 0000 0000 0000"
                          value={cardForm.cardNumber}
                          onChange={(e) => handleCardChange('cardNumber', formatCardNumber(e.target.value))}
                          maxLength={19}
                          className={cardErrors.cardNumber ? 'border-destructive' : ''}
                        />
                        {cardErrors.cardNumber && <p className="text-sm text-destructive">{cardErrors.cardNumber}</p>}
                      </div>

                      <div className="grid grid-cols-3 gap-3">
                        <div className="space-y-2">
                          <Label>Mês <span className="text-destructive">*</span></Label>
                          <Input placeholder="MM" value={cardForm.expMonth} maxLength={2}
                            onChange={(e) => handleCardChange('expMonth', e.target.value.replace(/\D/g, ''))}
                            className={cardErrors.expMonth ? 'border-destructive' : ''} />
                          {cardErrors.expMonth && <p className="text-sm text-destructive">{cardErrors.expMonth}</p>}
                        </div>
                        <div className="space-y-2">
                          <Label>Ano <span className="text-destructive">*</span></Label>
                          <Input placeholder="AAAA" value={cardForm.expYear} maxLength={4}
                            onChange={(e) => handleCardChange('expYear', e.target.value.replace(/\D/g, ''))}
                            className={cardErrors.expYear ? 'border-destructive' : ''} />
                          {cardErrors.expYear && <p className="text-sm text-destructive">{cardErrors.expYear}</p>}
                        </div>
                        <div className="space-y-2">
                          <Label>CVV <span className="text-destructive">*</span></Label>
                          <Input placeholder="123" value={cardForm.cvv} maxLength={4} type="password"
                            onChange={(e) => handleCardChange('cvv', e.target.value.replace(/\D/g, ''))}
                            className={cardErrors.cvv ? 'border-destructive' : ''} />
                          {cardErrors.cvv && <p className="text-sm text-destructive">{cardErrors.cvv}</p>}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                          <Label>CEP <span className="text-muted-foreground text-xs">(opcional)</span></Label>
                          <Input placeholder="00000-000" value={cardForm.postalCode} maxLength={9}
                            onChange={(e) => handleCardChange('postalCode', masks.cep ? masks.cep(e.target.value) : e.target.value.replace(/\D/g, '').replace(/^(\d{5})(\d)/, '$1-$2').slice(0, 9))}
                            className={cardErrors.postalCode ? 'border-destructive' : ''} />
                          {cardErrors.postalCode && <p className="text-sm text-destructive">{cardErrors.postalCode}</p>}
                        </div>
                        <div className="space-y-2">
                          <Label>Número <span className="text-muted-foreground text-xs">(opcional)</span></Label>
                          <Input placeholder="Nº do endereço" value={cardForm.addressNumber}
                            onChange={(e) => handleCardChange('addressNumber', e.target.value)} />
                          
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* Payment result error */}
              {paymentResult?.status === 'rejected' && (
                <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4 space-y-1">
                  <div className="flex items-center gap-2 text-destructive font-semibold text-sm">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    Pagamento recusado
                  </div>
                  <p className="text-sm text-destructive/90 pl-6">
                    {paymentResult.reason ?? 'Verifique os dados do cartão ou tente com PIX.'}
                  </p>
                </div>
              )}

              {/* Total + Submit */}
              <div className="pt-4 border-t">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-muted-foreground">{isFreeEvent ? 'Valor:' : 'Total a pagar:'}</span>
                  <span className={`text-2xl font-bold ${isFreeEvent ? 'text-green-500' : 'text-primary'}`}>
                    {isFreeEvent ? 'Gratuito' : formatCurrency(event.price)}
                  </span>
                </div>

                <Button
                  type="submit"
                  className={`w-full ${isFreeEvent ? 'bg-green-500 hover:bg-green-600' : ''}`}
                  size="lg"
                  disabled={!isFormValid || isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Processando pagamento...
                    </>
                  ) : (
                    <>
                      {isFreeEvent ? (
                        <>
                          <CheckCircle2 className="mr-2 h-4 w-4" />
                          Confirmar Inscrição
                        </>
                      ) : paymentMethod === 'cash' ? (
                        <>
                          <Banknote className="mr-2 h-4 w-4" />
                          Confirmar Pagamento em Dinheiro
                        </>
                      ) : paymentMethod === 'pix' ? (
                        <>
                          <CheckCircle2 className="mr-2 h-4 w-4" />
                          Gerar QR Code PIX
                        </>
                      ) : (
                        <>
                          <CreditCard className="mr-2 h-4 w-4" />
                          Pagar com Cartão
                        </>
                      )}
                    </>
                  )}
                </Button>

                {!isFreeEvent && (
                  <p className="text-xs text-muted-foreground text-center mt-3">
                    Pagamento processado com segurança
                  </p>
                )}
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

const BuyTicketWithBoundary = () => (
  <BuyTicketErrorBoundary>
    <BuyTicket />
  </BuyTicketErrorBoundary>
);

export default BuyTicketWithBoundary;
