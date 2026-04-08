import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SETUP_SCHEMA_URL = "https://ppxlbxomerjklwuhggny.supabase.co/functions/v1/setup-schema";
const ZLABS_PROJECT_ID = "a3eeb0f0-949b-4569-9ca9-140e01c73e22";

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const token = Deno.env.get("ZLABS_API_KEY");
  if (!token) {
    return new Response(JSON.stringify({ error: "ZLABS_API_KEY não configurado" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  const { statements } = await req.json();
  const res = await fetch(SETUP_SCHEMA_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, project_id: ZLABS_PROJECT_ID, statements }),
  });

  const data = await res.json();
  return new Response(JSON.stringify(data), {
    status: res.status,
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
});
