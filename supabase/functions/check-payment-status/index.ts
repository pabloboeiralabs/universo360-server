import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ASAAS_API = "https://api.asaas.com/v3";
const PAGBANK_API = "https://api.pagseguro.com";
const MERCADOPAGO_API = "https://api.mercadopago.com";

function mapAsaasStatus(status: string): string {
  switch (status) {
    case "CONFIRMED": case "RECEIVED": case "RECEIVED_IN_CASH": return "approved";
    case "OVERDUE": case "REFUNDED": case "DELETED": return "rejected";
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
    case "rejected": case "cancelled": case "refunded": return "rejected";
    default: return "pending";
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { ticket_id } = await req.json();

    if (!ticket_id) {
      return new Response(JSON.stringify({ error: 'ticket_id é obrigatório' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: ticket, error: ticketError } = await supabase
      .from('tickets')
      .select('*, franchises!inner(asaas_api_key, pagbank_token, mercadopago_access_token, payment_gateway), events(school_name, event_date)')
      .eq('id', ticket_id)
      .single();

    if (ticketError || !ticket) {
      return new Response(JSON.stringify({ error: 'Ticket não encontrado' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (ticket.payment_status === 'approved') {
      return new Response(JSON.stringify({
        ticket_id: ticket.id, payment_status: 'approved',
        student_name: ticket.student_name, event_name: ticket.events?.school_name,
        event_date: ticket.events?.event_date, updated: false,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const gateway = (ticket.franchises as any)?.payment_gateway || 'asaas';
    const paymentId = ticket.payment_id || ticket.mp_payment_id;

    if (!paymentId) {
      return new Response(JSON.stringify({
        ticket_id: ticket.id, payment_status: ticket.payment_status, updated: false, reason: 'no_payment_id',
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    let newPaymentStatus = 'pending';

    try {
      if (gateway === 'asaas') {
        const apiKey = (ticket.franchises as any)?.asaas_api_key;
        if (!apiKey) throw new Error('no_credentials');
        const res = await fetch(`${ASAAS_API}/payments/${paymentId}`, { headers: { 'access_token': apiKey } });
        if (res.ok) { const data = await res.json(); newPaymentStatus = mapAsaasStatus(data.status); }
      } else if (gateway === 'pagbank') {
        const token = (ticket.franchises as any)?.pagbank_token;
        if (!token) throw new Error('no_credentials');
        const res = await fetch(`${PAGBANK_API}/orders/${paymentId}`, {
          headers: { 'Authorization': `Bearer ${token}`, 'x-api-version': '4.0' },
        });
        if (res.ok) {
          const data = await res.json();
          const charge = data.charges?.[0];
          if (charge) newPaymentStatus = mapPagBankStatus(charge.status);
        }
      } else if (gateway === 'mercadopago') {
        const accessToken = (ticket.franchises as any)?.mercadopago_access_token;
        if (!accessToken) throw new Error('no_credentials');
        const res = await fetch(`${MERCADOPAGO_API}/v1/payments/${paymentId}`, {
          headers: { 'Authorization': `Bearer ${accessToken}` },
        });
        if (res.ok) { const data = await res.json(); newPaymentStatus = mapMercadoPagoStatus(data.status); }
      }
    } catch (err) {
      console.error('Gateway query error:', err);
      return new Response(JSON.stringify({
        ticket_id: ticket.id, payment_status: ticket.payment_status, updated: false, error: 'gateway_query_error',
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    let updated = false;
    if (ticket.payment_status !== newPaymentStatus) {
      const { error: updateError } = await supabase
        .from('tickets')
        .update({ payment_status: newPaymentStatus, updated_at: new Date().toISOString() })
        .eq('id', ticket.id);

      if (!updateError) {
        updated = true;
        if (newPaymentStatus === 'approved') {
          await supabase.rpc('decrement_spots', { p_ticket_id: ticket.id, p_event_id: ticket.event_id, p_quantity: ticket.quantity });
          fetch(`${supabaseUrl}/functions/v1/send-receipt`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseServiceKey}` },
            body: JSON.stringify({ ticket_id: ticket.id }),
          }).catch(err => console.error('Receipt error:', err));
        }
      }
    }

    return new Response(JSON.stringify({
      ticket_id: ticket.id, payment_status: newPaymentStatus,
      student_name: ticket.student_name, event_name: ticket.events?.school_name,
      event_date: ticket.events?.event_date, updated,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('Check payment status error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Erro desconhecido' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
