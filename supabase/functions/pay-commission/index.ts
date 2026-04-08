import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const ASAAS_API = "https://api.asaas.com/v3";

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return new Response(JSON.stringify({ error: 'Não autorizado' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    if (authError || !user) return new Response(JSON.stringify({ error: 'Não autorizado' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const { payout_id, event_id, payout_type, amount, franchise_id, beneficiary_id } = await req.json();

    if (!franchise_id || !amount || !payout_type) {
      return new Response(JSON.stringify({ error: 'Dados obrigatórios faltando' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Get franchise ASAAS key
    const { data: franchise, error: franchiseError } = await supabase
      .from('franchises')
      .select('asaas_api_key, payment_gateway')
      .eq('id', franchise_id)
      .single();

    if (franchiseError || !franchise?.asaas_api_key) {
      return new Response(JSON.stringify({ error: 'ASAAS não configurado para esta franquia' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (franchise.payment_gateway !== 'asaas') {
      return new Response(JSON.stringify({ error: 'Pagamento direto via PIX só disponível com gateway ASAAS' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Get beneficiary PIX key (from commission_beneficiaries or customers for school type)
    let pixKey: string | null = null;
    let pixKeyType: string | null = null;
    let recipientName: string | null = null;

    if (payout_type === 'school' && beneficiary_id) {
      // School: beneficiary_id is the customer id
      const { data: customer } = await supabase
        .from('customers')
        .select('pix_key, pix_key_type, name')
        .eq('id', beneficiary_id)
        .single();
      pixKey = (customer as any)?.pix_key || null;
      pixKeyType = (customer as any)?.pix_key_type || null;
      recipientName = (customer as any)?.name || null;
    } else if (beneficiary_id) {
      const { data: beneficiary } = await supabase
        .from('commission_beneficiaries')
        .select('pix_key, pix_key_type, name')
        .eq('id', beneficiary_id)
        .single();
      pixKey = (beneficiary as any)?.pix_key || null;
      pixKeyType = (beneficiary as any)?.pix_key_type || null;
      recipientName = (beneficiary as any)?.name || null;
    }

    if (!pixKey || !pixKeyType) {
      return new Response(JSON.stringify({ error: 'Chave PIX não cadastrada para este comissionado' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Send PIX transfer via ASAAS
    const transferPayload = {
      value: Number(amount),
      pixAddressKey: pixKey,
      pixAddressKeyType: pixKeyType.toUpperCase(),
      description: `Comissão ${payout_type} - ${recipientName || 'Comissionado'}`,
      scheduleDate: new Date().toISOString().split('T')[0],
    };

    const transferRes = await fetch(`${ASAAS_API}/transfers`, {
      method: 'POST',
      headers: { 'access_token': franchise.asaas_api_key, 'Content-Type': 'application/json' },
      body: JSON.stringify(transferPayload),
    });

    const transferData = await transferRes.json();
    console.log('ASAAS transfer response:', transferRes.status, JSON.stringify(transferData));

    if (!transferRes.ok) {
      const errorMsg = transferData.errors?.[0]?.description || 'Erro ao realizar transferência PIX';
      return new Response(JSON.stringify({ error: errorMsg, details: transferData }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Mark payout as paid
    const startDate = new Date(); startDate.setDate(1);
    const endDate = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0);

    if (payout_id) {
      await supabase.from('commission_payouts').update({
        is_paid: true,
        paid_at: new Date().toISOString(),
        paid_by: user.id,
        notes: `PIX enviado via ASAAS - ID: ${transferData.id}`,
      }).eq('id', payout_id);
    } else if (event_id) {
      const { data: existing } = await supabase.from('commission_payouts').select('id').eq('event_id', event_id).eq('payout_type', payout_type).single();
      if (existing) {
        await supabase.from('commission_payouts').update({
          is_paid: true, paid_at: new Date().toISOString(), paid_by: user.id,
          notes: `PIX enviado via ASAAS - ID: ${transferData.id}`,
        }).eq('id', existing.id);
      } else {
        await supabase.from('commission_payouts').insert({
          franchise_id, event_id, payout_type, amount: Number(amount),
          period_start: startDate.toISOString().split('T')[0],
          period_end: endDate.toISOString().split('T')[0],
          is_paid: true, paid_at: new Date().toISOString(), paid_by: user.id,
          recipient_name: recipientName,
          notes: `PIX enviado via ASAAS - ID: ${transferData.id}`,
        });
      }
    }

    return new Response(JSON.stringify({ success: true, transfer_id: transferData.id, status: transferData.status }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('pay-commission error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Erro desconhecido' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
