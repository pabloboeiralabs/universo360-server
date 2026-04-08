import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

interface ReceiptRequest {
  ticket_id: string;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

function generateReceiptHtml(ticket: any, event: any, franchise: any): string {
  const eventDate = formatDate(event.event_date);
  const purchaseDate = formatDate(ticket.created_at);
  const totalAmount = formatCurrency(ticket.amount);
  const unitPrice = formatCurrency(ticket.amount / ticket.quantity);

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Recibo de Compra - Universo 360</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #0a0a1a;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 600px; margin: 0 auto; background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f0f23 100%); border-radius: 16px; overflow: hidden; margin-top: 20px; margin-bottom: 20px;">
    <!-- Header -->
    <tr>
      <td style="padding: 40px 40px 20px; text-align: center; border-bottom: 1px solid rgba(255,255,255,0.1);">
        <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700; letter-spacing: 2px;">
          🌌 UNIVERSO 360
        </h1>
        <p style="margin: 10px 0 0; color: #a0a0c0; font-size: 14px;">
          Planetário Móvel - Experiência Imersiva
        </p>
      </td>
    </tr>

    <!-- Success Badge -->
    <tr>
      <td style="padding: 30px 40px 20px; text-align: center;">
        <div style="display: inline-block; background: linear-gradient(135deg, #10b981 0%, #059669 100%); border-radius: 50px; padding: 12px 30px;">
          <span style="color: #ffffff; font-size: 16px; font-weight: 600;">✓ Pagamento Confirmado</span>
        </div>
      </td>
    </tr>

    <!-- Greeting -->
    <tr>
      <td style="padding: 20px 40px;">
        <p style="margin: 0; color: #e0e0e0; font-size: 16px; line-height: 1.6;">
          Olá, <strong style="color: #ffffff;">${ticket.parent_name || ticket.customer_name}</strong>!
        </p>
        <p style="margin: 15px 0 0; color: #a0a0c0; font-size: 14px; line-height: 1.6;">
          Seu ingresso foi confirmado com sucesso! Abaixo estão os detalhes da sua compra:
        </p>
      </td>
    </tr>

    <!-- Ticket Details Card -->
    <tr>
      <td style="padding: 0 40px 20px;">
        <table width="100%" cellspacing="0" cellpadding="0" style="background: rgba(255,255,255,0.05); border-radius: 12px; border: 1px solid rgba(255,255,255,0.1);">
          <tr>
            <td style="padding: 25px;">
              <!-- Student Info -->
              <table width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td style="padding-bottom: 20px; border-bottom: 1px solid rgba(255,255,255,0.1);">
                    <p style="margin: 0; color: #8b8ba3; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Estudante</p>
                    <p style="margin: 5px 0 0; color: #ffffff; font-size: 20px; font-weight: 600;">
                      ${ticket.student_name}
                    </p>
                    ${ticket.class_grade ? `<p style="margin: 5px 0 0; color: #a0a0c0; font-size: 14px;">Turma: ${ticket.class_grade}</p>` : ''}
                  </td>
                </tr>

                <!-- Event Info -->
                <tr>
                  <td style="padding: 20px 0; border-bottom: 1px solid rgba(255,255,255,0.1);">
                    <p style="margin: 0; color: #8b8ba3; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Evento</p>
                    <p style="margin: 5px 0 0; color: #ffffff; font-size: 16px; font-weight: 500;">
                      ${event.school_name}
                    </p>
                    <p style="margin: 8px 0 0; color: #a0a0c0; font-size: 14px;">
                      📅 ${eventDate} às ${event.event_time}
                    </p>
                    <p style="margin: 5px 0 0; color: #a0a0c0; font-size: 14px;">
                      📍 ${event.location}
                    </p>
                  </td>
                </tr>

                <!-- Payment Info -->
                <tr>
                  <td style="padding-top: 20px;">
                    <table width="100%" cellspacing="0" cellpadding="0">
                      <tr>
                        <td style="color: #a0a0c0; font-size: 14px;">Quantidade</td>
                        <td style="text-align: right; color: #ffffff; font-size: 14px;">${ticket.quantity} ingresso(s)</td>
                      </tr>
                      <tr>
                        <td style="color: #a0a0c0; font-size: 14px; padding-top: 8px;">Valor unitário</td>
                        <td style="text-align: right; color: #ffffff; font-size: 14px; padding-top: 8px;">${unitPrice}</td>
                      </tr>
                      <tr>
                        <td colspan="2" style="padding-top: 15px; border-top: 1px solid rgba(255,255,255,0.1); margin-top: 15px;">
                          <table width="100%" cellspacing="0" cellpadding="0">
                            <tr>
                              <td style="color: #ffffff; font-size: 16px; font-weight: 600; padding-top: 15px;">Total Pago</td>
                              <td style="text-align: right; padding-top: 15px;">
                                <span style="background: linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%); color: #ffffff; font-size: 18px; font-weight: 700; padding: 8px 16px; border-radius: 8px;">${totalAmount}</span>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- Ticket ID -->
    <tr>
      <td style="padding: 0 40px 30px;">
        <table width="100%" cellspacing="0" cellpadding="0" style="background: rgba(139, 92, 246, 0.1); border-radius: 8px; border: 1px dashed rgba(139, 92, 246, 0.3);">
          <tr>
            <td style="padding: 15px; text-align: center;">
              <p style="margin: 0; color: #8b8ba3; font-size: 11px; text-transform: uppercase; letter-spacing: 1px;">Código do Ingresso</p>
              <p style="margin: 5px 0 0; color: #8b5cf6; font-size: 14px; font-family: monospace; font-weight: 600;">${ticket.id}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- Footer -->
    <tr>
      <td style="padding: 30px 40px; background: rgba(0,0,0,0.2); border-top: 1px solid rgba(255,255,255,0.1);">
        <p style="margin: 0; color: #a0a0c0; font-size: 13px; line-height: 1.6; text-align: center;">
          Apresente este email ou o código do ingresso na entrada do evento.
        </p>
        <p style="margin: 15px 0 0; color: #707080; font-size: 12px; text-align: center;">
          Data da compra: ${purchaseDate}
        </p>
        <p style="margin: 20px 0 0; color: #707080; font-size: 11px; text-align: center;">
          ${franchise.name} • ${franchise.city}/${franchise.state}
        </p>
        <p style="margin: 15px 0 0; color: #505060; font-size: 11px; text-align: center;">
          Este é um email automático. Em caso de dúvidas, entre em contato com a escola.
        </p>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { ticket_id }: ReceiptRequest = await req.json();

    if (!ticket_id) {
      console.error('Missing ticket_id');
      return new Response(
        JSON.stringify({ error: 'ticket_id é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Sending receipt for ticket:', ticket_id);

    // Fetch ticket with related data
    const { data: ticket, error: ticketError } = await supabase
      .from('tickets')
      .select(`
        *,
        events (
          school_name,
          event_date,
          event_time,
          location,
          description
        ),
        franchises (
          name,
          city,
          state
        )
      `)
      .eq('id', ticket_id)
      .single();

    if (ticketError || !ticket) {
      console.error('Ticket not found:', ticketError);
      return new Response(
        JSON.stringify({ error: 'Ticket não encontrado' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if customer email exists
    if (!ticket.customer_email) {
      console.error('No customer email for ticket:', ticket_id);
      return new Response(
        JSON.stringify({ error: 'Email do cliente não encontrado' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Skip sending to placeholder emails (free event registrations)
    if (ticket.customer_email.endsWith('@example.com')) {
      console.log('Skipping receipt for placeholder email:', ticket.customer_email);
      return new Response(
        JSON.stringify({ success: true, skipped: true, reason: 'placeholder_email' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const event = ticket.events;
    const franchise = ticket.franchises;

    // Generate HTML email
    const htmlContent = generateReceiptHtml(ticket, event, franchise);

    // Send email using Resend
    console.log('Sending email to:', ticket.customer_email);
    const emailSubject = `✓ Ingresso Confirmado - ${event.school_name}`;
    let emailStatus = 'sent';
    let emailErrorMsg: string | null = null;

    const emailResponse = await resend.emails.send({
      from: 'Universo 360 <universo360@zlabs.com.br>',
      to: [ticket.customer_email],
      subject: emailSubject,
      html: htmlContent,
    });

    if (emailResponse.error) {
      emailStatus = 'failed';
      emailErrorMsg = JSON.stringify(emailResponse.error);
      console.error('Email send error:', emailResponse.error);
    } else {
      console.log('Email sent successfully:', emailResponse);
    }

    // Log email to database
    try {
      await supabase.from('email_logs').insert({
        ticket_id,
        franchise_id: ticket.franchise_id,
        recipient_email: ticket.customer_email,
        email_type: 'receipt',
        subject: emailSubject,
        status: emailStatus,
        error_message: emailErrorMsg,
      });
    } catch (logErr) {
      console.error('Failed to log email (non-fatal):', logErr);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        email_id: emailResponse.data?.id,
        sent_to: ticket.customer_email 
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error sending receipt:', error);
    const message = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
