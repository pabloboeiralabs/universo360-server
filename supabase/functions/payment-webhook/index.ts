import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ASAAS_API = "https://api.asaas.com/v3";

function mapAsaasStatus(status: string): string {
  switch (status) {
    case "CONFIRMED": case "RECEIVED": case "RECEIVED_IN_CASH": return "approved";
    case "OVERDUE": case "REFUNDED": case "DELETED": case "RESTORED": return "rejected";
    default: return "pending";
  }
}

function mapPagBankStatus(status: string): string {
  switch (status) {
    case "PAID": case "AUTHORIZED": return "approved";
    case "DECLINED": case "CANCELED": return "rejected";
    default: return "pending";
  }
}

function mapMercadoPagoStatus(status: string): string {
  switch (status) {
    case "approved": return "approved";
    case "rejected": case "cancelled": case "refunded": case "charged_back": return "rejected";
    default: return "pending";
  }
}

async function handleApproval(supabase: any, supabaseUrl: string, supabaseServiceKey: string, ticket: any) {
  await supabase.rpc('decrement_spots', {
    p_ticket_id: ticket.id,
    p_event_id: ticket.event_id,
    p_quantity: ticket.quantity,
  });
  fetch(`${supabaseUrl}/functions/v1/send-receipt`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseServiceKey}` },
    body: JSON.stringify({ ticket_id: ticket.id }),
  }).catch(err => console.error('Receipt error:', err));
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    console.log('=== PAYMENT WEBHOOK ===');
    console.log('Body:', JSON.stringify(body).substring(0, 500));

    // ── Detect gateway by payload format ──
    // ASAAS: body.event + body.payment
    // PagBank: body.charges or body.id starts with "ORDE_" or notification
    // Mercado Pago: body.action + body.data.id or body.type === "payment"

    let ticketId: string | null = null;
    let newStatus: string = "pending";
    let gatewayType: string = "unknown";
    let paymentExternalId: string | null = null;

    if (body.payment && body.event) {
      // ── ASAAS WEBHOOK ──
      gatewayType = "asaas";
      const payment = body.payment;
      if (!payment?.id) {
        return new Response(JSON.stringify({ received: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      ticketId = payment.externalReference;
      paymentExternalId = payment.id;

      if (!ticketId) {
        return new Response(JSON.stringify({ received: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // Fetch ticket and validate
      const { data: ticket, error: ticketError } = await supabase
        .from('tickets')
        .select('*, franchises!inner(asaas_api_key, asaas_webhook_token)')
        .eq('id', ticketId)
        .single();

      if (ticketError || !ticket) {
        console.error('Ticket not found:', ticketId);
        return new Response(JSON.stringify({ received: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // Validate webhook token — accept asaas_webhook_token OR franchise_id (legacy registrations)
      const webhookToken = req.headers.get('asaas-access-token');
      const franchiseToken = ticket.franchises?.asaas_webhook_token;
      const franchiseId = ticket.franchise_id;
      console.log('Webhook token received:', webhookToken, '| expected token:', franchiseToken, '| franchise_id:', franchiseId);
      if (franchiseToken && webhookToken !== franchiseToken && webhookToken !== franchiseId) {
        console.error('Webhook token mismatch — rejecting request');
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // Verify with ASAAS API
      const asaasApiKey = ticket.franchises?.asaas_api_key;
      if (asaasApiKey) {
        try {
          const verifyRes = await fetch(`${ASAAS_API}/payments/${paymentExternalId}`, { headers: { 'access_token': asaasApiKey } });
          if (verifyRes.ok) {
            const verifyData = await verifyRes.json();
            payment.status = verifyData.status;
          }
        } catch (err) { console.error('ASAAS verification error:', err); }
      }

      newStatus = mapAsaasStatus(payment.status);

      if (ticket.payment_status !== newStatus) {
        await supabase.from('tickets').update({ payment_status: newStatus, mp_payment_id: paymentExternalId, updated_at: new Date().toISOString() }).eq('id', ticket.id);
        if (newStatus === 'approved' && ticket.payment_status !== 'approved') {
          await handleApproval(supabase, supabaseUrl, supabaseServiceKey, ticket);
        }
      }

    } else if (body.charges || (body.id && typeof body.id === 'string' && body.id.startsWith('ORDE'))) {
      // ── PAGBANK WEBHOOK ──
      gatewayType = "pagbank";
      const referenceId = body.reference_id || body.charges?.[0]?.reference_id;
      ticketId = referenceId;

      if (!ticketId) {
        return new Response(JSON.stringify({ received: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const charge = body.charges?.[0];
      if (charge) {
        newStatus = mapPagBankStatus(charge.status);
        paymentExternalId = body.id;
      }

      const { data: ticket, error: ticketError } = await supabase
        .from('tickets')
        .select('*')
        .eq('id', ticketId)
        .single();

      if (ticketError || !ticket) {
        return new Response(JSON.stringify({ received: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      if (ticket.payment_status !== newStatus) {
        await supabase.from('tickets').update({ payment_status: newStatus, mp_payment_id: paymentExternalId, updated_at: new Date().toISOString() }).eq('id', ticket.id);
        if (newStatus === 'approved' && ticket.payment_status !== 'approved') {
          await handleApproval(supabase, supabaseUrl, supabaseServiceKey, ticket);
        }
      }

    } else if (body.action && body.data?.id || body.type === 'payment' || body.topic === 'payment') {
      // ── MERCADO PAGO WEBHOOK ── (supports both API notification and IPN formats)
      gatewayType = "mercadopago";
      const mpPaymentId = body.data?.id || (body.topic === 'payment' ? String(body.resource) : null);

      if (!mpPaymentId) {
        return new Response(JSON.stringify({ received: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // ── Step 1: Fetch payment details from MP API to get external_reference ──
      // We need this first because the ticket might not have mp_payment_id saved yet
      // (webhook can arrive before process-payment updates the ticket)
      let mpPaymentData: any = null;
      let ticketIdFromRef: string | null = null;

      // Try to find a franchise with mercadopago_access_token to verify the payment
      // Use the MP API to get external_reference (= ticket id)
      const { data: anyFranchise } = await supabase
        .from('franchises')
        .select('mercadopago_access_token')
        .not('mercadopago_access_token', 'is', null)
        .limit(1)
        .maybeSingle();

      const accessTokenForLookup = anyFranchise?.mercadopago_access_token;
      if (accessTokenForLookup) {
        try {
          const verifyRes = await fetch(`https://api.mercadopago.com/v1/payments/${mpPaymentId}`, {
            headers: { 'Authorization': `Bearer ${accessTokenForLookup}` },
          });
          if (verifyRes.ok) {
            mpPaymentData = await verifyRes.json();
            ticketIdFromRef = mpPaymentData?.external_reference || null;
            newStatus = mapMercadoPagoStatus(mpPaymentData.status);
            console.log('MP payment fetched — external_reference:', ticketIdFromRef, 'status:', mpPaymentData.status);
          }
        } catch (err) { console.error('MP payment lookup error:', err); }
      }

      // ── Step 2: Find ticket — try external_reference first, then mp_payment_id / payment_id ──
      let ticket: any = null;

      if (ticketIdFromRef) {
        const { data: t } = await supabase
          .from('tickets')
          .select('*, franchises!inner(mercadopago_access_token)')
          .eq('id', ticketIdFromRef)
          .maybeSingle();
        ticket = t;
      }

      if (!ticket) {
        const { data: t } = await supabase
          .from('tickets')
          .select('*, franchises!inner(mercadopago_access_token)')
          .eq('mp_payment_id', String(mpPaymentId))
          .maybeSingle();
        ticket = t;
      }

      if (!ticket) {
        const { data: t } = await supabase
          .from('tickets')
          .select('*, franchises!inner(mercadopago_access_token)')
          .eq('payment_id', String(mpPaymentId))
          .maybeSingle();
        ticket = t;
      }

      if (!ticket) {
        console.error('MP ticket not found for payment:', mpPaymentId, '/ ref:', ticketIdFromRef);
        return new Response(JSON.stringify({ received: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // ── Step 3: Verify status with the franchise's own access token (if different) ──
      const franchiseAccessToken = ticket.franchises?.mercadopago_access_token;
      if (franchiseAccessToken && franchiseAccessToken !== accessTokenForLookup) {
        try {
          const verifyRes = await fetch(`https://api.mercadopago.com/v1/payments/${mpPaymentId}`, {
            headers: { 'Authorization': `Bearer ${franchiseAccessToken}` },
          });
          if (verifyRes.ok) {
            const verifyData = await verifyRes.json();
            newStatus = mapMercadoPagoStatus(verifyData.status);
          }
        } catch (err) { console.error('MP re-verification error:', err); }
      }


      if (ticket.payment_status !== newStatus) {
        await supabase.from('tickets').update({ payment_status: newStatus, mp_payment_id: String(mpPaymentId), updated_at: new Date().toISOString() }).eq('id', ticket.id);
        if (newStatus === 'approved' && ticket.payment_status !== 'approved') {
          await handleApproval(supabase, supabaseUrl, supabaseServiceKey, ticket);
        }
      }
    }

    console.log('Gateway:', gatewayType, 'Ticket:', ticketId, 'Status:', newStatus);

    return new Response(JSON.stringify({ received: true, status: newStatus }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Webhook error:', error);
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
