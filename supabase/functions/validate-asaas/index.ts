import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const ASAAS_API = "https://api.asaas.com/v3";

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { api_key } = await req.json();

    if (!api_key) {
      return new Response(
        JSON.stringify({ valid: false, error: 'API Key é obrigatória' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const response = await fetch(`${ASAAS_API}/finance/balance`, {
      headers: { 'access_token': api_key },
    });

    if (response.ok) {
      return new Response(
        JSON.stringify({ valid: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.error('ASAAS validation failed:', response.status);
    const errorText = await response.text();
    console.error('Error body:', errorText);

    return new Response(
      JSON.stringify({ valid: false, error: 'API Key inválida' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Validation error:', error);
    return new Response(
      JSON.stringify({ valid: false, error: 'Erro ao validar credenciais' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
