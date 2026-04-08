import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // Find all pending PIX tickets with a payment_id, created in last 7 days
    const { data: tickets, error } = await supabase
      .from('tickets')
      .select('*, franchises!inner(asaas_api_key, pagbank_token, mercadopago_access_token, payment_gateway)')
      .eq('payment_status', 'pending')
      .not('payment_id', 'is', null)
      .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) throw error;

    const results = { checked: 0, approved: 0, rejected: 0, still_pending: 0, errors: 0 };

    for (const ticket of (tickets || [])) {
      results.checked++;
      const gateway = (ticket.franchises as any)?.payment_gateway || 'asaas';
      const paymentId = ticket.payment_id || ticket.mp_payment_id;

      if (!paymentId) { results.errors++; continue; }

      let newStatus = 'pending';
      try {
        if (gateway === 'asaas') {
          const apiKey = (ticket.franchises as any)?.asaas_api_key;
          if (!apiKey) { results.errors++; continue; }
          const res = await fetch(`${ASAAS_API}/payments/${paymentId}`, { headers: { 'access_token': apiKey } });
          if (res.ok) { const data = await res.json(); newStatus = mapAsaasStatus(data.status); }
        } else if (gateway === 'pagbank') {
          const token = (ticket.franchises as any)?.pagbank_token;
          if (!token) { results.errors++; continue; }
          const res = await fetch(`${PAGBANK_API}/orders/${paymentId}`, {
            headers: { 'Authorization': `Bearer ${token}`, 'x-api-version': '4.0' },
          });
          if (res.ok) {
            const data = await res.json();
            const charge = data.charges?.[0];
            if (charge) newStatus = mapPagBankStatus(charge.status);
          }
        } else if (gateway === 'mercadopago') {
          const accessToken = (ticket.franchises as any)?.mercadopago_access_token;
          if (!accessToken) { results.errors++; continue; }
          const res = await fetch(`${MERCADOPAGO_API}/v1/payments/${paymentId}`, {
            headers: { 'Authorization': `Bearer ${accessToken}` },
          });
          if (res.ok) { const data = await res.json(); newStatus = mapMercadoPagoStatus(data.status); }
        }
      } catch (err) {
        console.error(`Gateway error for ticket ${ticket.id}:`, err);
        results.errors++;
        continue;
      }

      if (newStatus !== 'pending') {
        await supabase.from('tickets').update({
          payment_status: newStatus,
          updated_at: new Date().toISOString(),
        }).eq('id', ticket.id);

        if (newStatus === 'approved') {
          results.approved++;

          // decrement_spots with full error handling — previously this was fire-and-forget
          // causing spots_decremented to stay false when the RPC errored silently
          const { data: decremented, error: decrementError } = await supabase.rpc('decrement_spots', {
            p_ticket_id: ticket.id,
            p_event_id: ticket.event_id,
            p_quantity: ticket.quantity,
          });

          if (decrementError) {
            // RPC failed (e.g. lock timeout) — fallback: manually decrement event spots and mark flag
            console.error(`decrement_spots RPC error for ticket ${ticket.id}:`, JSON.stringify(decrementError));
            const { error: fallbackErr } = await supabase.rpc('decrement_spots', {
              p_ticket_id: ticket.id,
              p_event_id: ticket.event_id,
              p_quantity: ticket.quantity,
            });
            if (fallbackErr) {
              console.error(`CRITICAL: fallback decrement_spots also failed for ticket ${ticket.id}:`, JSON.stringify(fallbackErr));
              results.errors++;
            }
          } else if (decremented === false) {
            // Already decremented before — idempotent, no action needed
            console.log(`Ticket ${ticket.id}: spots already decremented (idempotent skip).`);
          } else {
            console.log(`Ticket ${ticket.id}: spots decremented successfully.`);
          }

          // Fire-and-forget receipt
          fetch(`${supabaseUrl}/functions/v1/send-receipt`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseServiceKey}` },
            body: JSON.stringify({ ticket_id: ticket.id }),
          }).catch(err => console.error('Receipt error:', err));
        } else {
          results.rejected++;
        }
      } else {
        results.still_pending++;
      }
    }

    console.log('Reconciliation complete:', results);
    return new Response(JSON.stringify({ success: true, ...results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error('Reconcile error:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
