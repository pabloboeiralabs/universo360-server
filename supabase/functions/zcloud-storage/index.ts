import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const STORAGE_PROXY_URL = "https://ppxlbxomerjklwuhggny.supabase.co/functions/v1/storage-proxy";

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const token = Deno.env.get("ZLABS_API_KEY");
  if (!token) {
    return new Response(JSON.stringify({ error: "ZLABS_API_KEY não configurado" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  const contentType = req.headers.get("content-type") ?? "";
  const isFormData = contentType.includes("multipart/form-data");

  const proxyHeaders: Record<string, string> = { "x-zlabs-token": token };

  let body: BodyInit;
  if (isFormData) {
    body = await req.arrayBuffer();
    proxyHeaders["content-type"] = contentType;
  } else {
    body = await req.text();
    proxyHeaders["content-type"] = "application/json";
  }

  const res = await fetch(STORAGE_PROXY_URL, {
    method: "POST",
    headers: proxyHeaders,
    body,
  });

  const responseBody = await res.arrayBuffer();
  return new Response(responseBody, {
    status: res.status,
    headers: {
      ...corsHeaders,
      "Content-Type": res.headers.get("Content-Type") ?? "application/json",
    },
  });
});
