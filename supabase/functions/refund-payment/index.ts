import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ASAAS_API = "https://api.asaas.com/v3";
const PAGBANK_API = "https://api.pagseguro.com";
const MERCADOPAGO_API = "https://api.mercadopago.com";

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Não autorizado' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Usuário não autenticado' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: userRole } = await supabase.from('user_roles').select('role').eq('user_id', user.id).eq('role', 'admin').single();
    const isAdmin = !!userRole;

    const { ticket_id, reason } = await req.json();
    if (!ticket_id) {
      return new Response(JSON.stringify({ error: 'ticket_id é obrigatório' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: ticket, error: ticketError } = await supabase
      .from('tickets')
      .select('*, franchises!inner(id, asaas_api_key, pagbank_token, mercadopago_access_token, payment_gateway, owner_id)')
      .eq('id', ticket_id)
      .single();

    if (ticketError || !ticket) {
      return new Response(JSON.stringify({ error: 'Ticket não encontrado' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const isFranchiseOwner = (ticket.franchises as any)?.owner_id === user.id;
    if (!isAdmin && !isFranchiseOwner) {
      return new Response(JSON.stringify({ error: 'Sem permissão para realizar estorno' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (ticket.payment_status === 'refunded') {
      return new Response(JSON.stringify({ error: 'Este ticket já foi estornado' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (ticket.payment_status !== 'approved') {
      return new Response(JSON.stringify({ error: 'Apenas tickets aprovados podem ser estornados' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const paymentId = ticket.mp_payment_id || ticket.payment_id;
    if (!paymentId) {
      return new Response(JSON.stringify({ error: 'ID da cobrança não encontrado' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const gateway = (ticket.franchises as any)?.payment_gateway || 'asaas';
    console.log('Processing refund via', gateway, 'for payment:', paymentId);

    // ── Execute refund on correct gateway ──
    if (gateway === 'asaas') {
      const apiKey = (ticket.franchises as any)?.asaas_api_key;
      if (!apiKey) return new Response(JSON.stringify({ error: 'Credenciais do ASAAS não configuradas' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

      const refundRes = await fetch(`${ASAAS_API}/payments/${paymentId}/refund`, {
        method: 'POST', headers: { 'access_token': apiKey, 'Content-Type': 'application/json' },
      });
      const refundResult = await refundRes.json();
      if (!refundRes.ok) {
        return new Response(JSON.stringify({ error: refundResult.errors?.[0]?.description || 'Erro ao processar estorno', details: refundResult }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    } else if (gateway === 'pagbank') {
      const token = (ticket.franchises as any)?.pagbank_token;
      if (!token) return new Response(JSON.stringify({ error: 'Credenciais do PagBank não configuradas' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

      // PagBank: cancel/refund charge
      const refundRes = await fetch(`${PAGBANK_API}/charges/${paymentId}/cancel`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json', 'x-api-version': '4.0' },
        body: JSON.stringify({ amount: { value: Math.round(Number(ticket.amount) * 100) } }),
      });
      if (!refundRes.ok) {
        const refundResult = await refundRes.json();
        return new Response(JSON.stringify({ error: refundResult.error_messages?.[0]?.description || 'Erro ao processar estorno PagBank', details: refundResult }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    } else if (gateway === 'mercadopago') {
      const accessToken = (ticket.franchises as any)?.mercadopago_access_token;
      if (!accessToken) return new Response(JSON.stringify({ error: 'Credenciais do Mercado Pago não configuradas' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

      const refundRes = await fetch(`${MERCADOPAGO_API}/v1/payments/${paymentId}/refunds`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      });
      if (!refundRes.ok) {
        const refundResult = await refundRes.json();
        return new Response(JSON.stringify({ error: refundResult.message || 'Erro ao processar estorno Mercado Pago', details: refundResult }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    const refundedAt = new Date().toISOString();

    // Update ticket
    await supabase.from('tickets').update({
      payment_status: 'refunded',
      refunded_at: refundedAt,
      refund_reason: reason || 'Sem motivo informado',
      updated_at: refundedAt,
    }).eq('id', ticket_id);

    // Restore spots
    const { data: eventData } = await supabase.from('events').select('available_spots, school_name, event_date').eq('id', ticket.event_id).single();
    if (eventData) {
      await supabase.from('events').update({ available_spots: eventData.available_spots + ticket.quantity }).eq('id', ticket.event_id);
    }

    // Send refund receipt email
    try {
      const franchise = ticket.franchises as any;
      const resendApiKey = Deno.env.get('RESEND_API_KEY');
      if (resendApiKey && ticket.customer_email && !ticket.customer_email.endsWith('@example.com')) {
        const paymentMethodLabel: Record<string, string> = {
          pix: 'PIX', credit_card: 'Cartão de Crédito', cash: 'Dinheiro', free: 'Gratuito', unknown: 'Outro',
        };
        const formatCurrency = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
        const formatDateBR = (d: string) => new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
        const formatDateTimeBR = (d: string) => new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });
        const methodLabel = ticket.payment_method ? (paymentMethodLabel[ticket.payment_method] ?? ticket.payment_method) : 'Não informado';
        const eventDate = eventData?.event_date ? formatDateBR(eventData.event_date) : '';
        const eventName = eventData?.school_name ?? 'Evento';

        const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;background-color:#08060f;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
    <tr><td style="padding:24px 16px;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;margin:0 auto;background:#13102a;border:1px solid #2a2050;overflow:hidden;">
        <tr><td style="background:linear-gradient(135deg,#1a0e3a 0%,#0d1a3a 100%);padding:32px 40px;text-align:center;border-bottom:2px solid #dc2626;">
          <img src="https://zreuqsfwgbhrvqprxoyg.supabase.co/storage/v1/object/public/email-assets/logo-universo360.png"
               alt="Universo 360" width="80" height="80" style="display:inline-block;margin-bottom:12px;" />
          <p style="margin:0;color:#c4b5fd;font-size:11px;letter-spacing:3px;text-transform:uppercase;">Planetário Móvel — Experiência Imersiva</p>
        </td></tr>
        <tr><td style="padding:28px 40px 16px;text-align:center;">
          <table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 auto;">
            <tr><td style="background:#dc2626;padding:10px 28px;">
              <span style="color:#fff;font-size:15px;font-weight:700;letter-spacing:1px;">✗ COMPROVANTE DE ESTORNO</span>
            </td></tr>
          </table>
        </td></tr>
        <tr><td style="padding:8px 40px 24px;">
          <p style="margin:0;color:#e2e0f0;font-size:16px;line-height:1.7;">Olá, <strong style="color:#fff;">${ticket.parent_name || ticket.customer_name}</strong>!</p>
          <p style="margin:10px 0 0;color:#9590b8;font-size:14px;line-height:1.7;">O estorno do seu ingresso foi processado com sucesso. Confira os detalhes abaixo.</p>
        </td></tr>
        <tr><td style="padding:0 40px 24px;">
          <table width="100%" cellspacing="0" cellpadding="0" style="background:#1e1840;border:1px solid #dc2626;">
            <tr><td style="padding:6px 16px;background:#dc2626;">
              <span style="color:#fff;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;">Dados do Estorno</span>
            </td></tr>
            <tr><td style="padding:20px 16px;">
              <table width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td style="color:#9590b8;font-size:13px;padding-bottom:10px;">Data e hora</td>
                  <td style="text-align:right;color:#fff;font-size:13px;font-weight:600;padding-bottom:10px;">${formatDateTimeBR(refundedAt)}</td>
                </tr>
                <tr>
                  <td style="color:#9590b8;font-size:13px;border-top:1px solid #2a2050;padding-top:10px;padding-bottom:10px;">Motivo</td>
                  <td style="text-align:right;color:#fff;font-size:13px;border-top:1px solid #2a2050;padding-top:10px;padding-bottom:10px;">${reason || 'Não informado'}</td>
                </tr>
                <tr>
                  <td style="color:#9590b8;font-size:13px;border-top:1px solid #2a2050;padding-top:10px;">Forma de pgto. original</td>
                  <td style="text-align:right;color:#fff;font-size:13px;border-top:1px solid #2a2050;padding-top:10px;">${methodLabel}</td>
                </tr>
              </table>
            </td></tr>
          </table>
        </td></tr>
        <tr><td style="padding:0 40px 24px;">
          <table width="100%" cellspacing="0" cellpadding="0" style="background:#1a1535;border:1px solid #2a2050;">
            <tr><td style="padding:6px 16px;background:#3b2f7a;">
              <span style="color:#c4b5fd;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;">Ingresso</span>
            </td></tr>
            <tr><td style="padding:20px 16px;">
              <table width="100%" cellspacing="0" cellpadding="0">
                ${ticket.student_name ? `<tr>
                  <td style="color:#9590b8;font-size:13px;padding-bottom:10px;">Aluno</td>
                  <td style="text-align:right;color:#fff;font-size:13px;font-weight:600;padding-bottom:10px;">${ticket.student_name}</td>
                </tr>
                ${ticket.class_grade ? `<tr>
                  <td style="color:#9590b8;font-size:13px;border-top:1px solid #2a2050;padding-top:10px;padding-bottom:10px;">Turma</td>
                  <td style="text-align:right;color:#fff;font-size:13px;border-top:1px solid #2a2050;padding-top:10px;padding-bottom:10px;">${ticket.class_grade}</td>
                </tr>` : ''}` : ''}
                <tr>
                  <td style="color:#9590b8;font-size:13px;${ticket.student_name ? 'border-top:1px solid #2a2050;padding-top:10px;' : ''}padding-bottom:10px;">Escola / Evento</td>
                  <td style="text-align:right;color:#fff;font-size:13px;${ticket.student_name ? 'border-top:1px solid #2a2050;padding-top:10px;' : ''}padding-bottom:10px;">${eventName}</td>
                </tr>
                ${eventDate ? `<tr>
                  <td style="color:#9590b8;font-size:13px;border-top:1px solid #2a2050;padding-top:10px;padding-bottom:10px;">Data do evento</td>
                  <td style="text-align:right;color:#fff;font-size:13px;border-top:1px solid #2a2050;padding-top:10px;padding-bottom:10px;">📅 ${eventDate}</td>
                </tr>` : ''}
                <tr>
                  <td style="color:#9590b8;font-size:13px;border-top:1px solid #2a2050;padding-top:10px;">Responsável</td>
                  <td style="text-align:right;color:#fff;font-size:13px;border-top:1px solid #2a2050;padding-top:10px;">${ticket.customer_name}</td>
                </tr>
              </table>
            </td></tr>
          </table>
        </td></tr>
        <tr><td style="padding:0 40px 28px;">
          <table width="100%" cellspacing="0" cellpadding="0" style="background:#2d0a0a;border:1px solid #dc2626;">
            <tr><td style="padding:20px 24px;">
              <table width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td style="color:#fca5a5;font-size:15px;font-weight:600;">Valor Estornado</td>
                  <td style="text-align:right;"><span style="color:#fff;font-size:24px;font-weight:800;">${formatCurrency(Number(ticket.amount))}</span></td>
                </tr>
                <tr><td colspan="2" style="padding-top:6px;">
                  <p style="margin:0;color:#f87171;font-size:11px;">O valor será devolvido conforme o prazo da operadora.</p>
                </td></tr>
              </table>
            </td></tr>
          </table>
        </td></tr>
        <tr><td style="padding:0 40px 32px;">
          <table width="100%" cellspacing="0" cellpadding="0" style="background:#110d2a;border:1px dashed #6d28d9;">
            <tr><td style="padding:14px;text-align:center;">
              <p style="margin:0;color:#7c6fb0;font-size:10px;text-transform:uppercase;letter-spacing:2px;">Código do Ingresso</p>
              <p style="margin:6px 0 0;color:#a78bfa;font-size:13px;font-family:monospace;font-weight:700;word-break:break-all;">${ticket_id}</p>
            </td></tr>
          </table>
        </td></tr>
        <tr><td style="padding:20px 40px;background:#0d0a1e;border-top:1px solid #1e1840;text-align:center;">
          <img src="https://zreuqsfwgbhrvqprxoyg.supabase.co/storage/v1/object/public/email-assets/logo-universo360.png"
               alt="" width="36" height="36" style="display:inline-block;opacity:0.4;margin-bottom:8px;" />
          <p style="margin:0;color:#504878;font-size:11px;">${franchise?.name ?? 'Universo 360'} • ${franchise?.city ?? ''}${franchise?.state ? '/' + franchise.state : ''}</p>
          <p style="margin:6px 0 0;color:#403660;font-size:10px;">Este é um e-mail automático. Em caso de dúvidas, entre em contato com a escola.</p>
          <p style="margin:6px 0 0;color:#302850;font-size:10px;">universo360@zlabs.com.br</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

        const emailSubject = `✗ Comprovante de Estorno — ${eventName}`;
        let emailStatus = 'sent';
        let emailError: string | null = null;

        const emailRes = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${resendApiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from: 'Universo 360 <universo360@zlabs.com.br>',
            to: [ticket.customer_email],
            cc: ['pablo.boeira.pb@gmail.com'],
            subject: emailSubject,
            html,
          }),
        });

        if (!emailRes.ok) {
          const errBody = await emailRes.text();
          emailStatus = 'failed';
          emailError = errBody;
          console.error('Failed to send refund email:', errBody);
        } else {
          console.log('Refund receipt email sent to:', ticket.customer_email);
        }

        // Log email to database
        await supabase.from('email_logs').insert({
          ticket_id,
          franchise_id: ticket.franchise_id,
          recipient_email: ticket.customer_email,
          email_type: 'refund',
          subject: emailSubject,
          status: emailStatus,
          error_message: emailError,
        });
      }
    } catch (emailError) {
      console.error('Failed to send refund email (non-fatal):', emailError);
    }

    return new Response(JSON.stringify({
      success: true, message: 'Estorno processado com sucesso',
      ticket_id, amount_refunded: ticket.amount,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('Refund error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Erro desconhecido' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
