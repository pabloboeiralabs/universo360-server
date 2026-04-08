import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MIN_PAYMENT_AMOUNT = 1.0;

interface CheckoutRequest {
  franchise_id: string;
  event_id: string;
  quantity: number;
  student_name: string;
  class_grade: string;
  shift?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body: CheckoutRequest = await req.json();
    const { franchise_id, event_id, quantity, student_name, class_grade, shift } = body;

    if (!student_name || !class_grade) {
      return new Response(
        JSON.stringify({ error: "Nome do aluno e turma são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: franchise, error: franchiseError } = await supabase
      .from("franchises")
      .select("id, name, asaas_api_key")
      .eq("id", franchise_id)
      .single();

    if (franchiseError || !franchise) {
      return new Response(
        JSON.stringify({ error: "Franquia não encontrada" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    if (!franchise.asaas_api_key) {
      return new Response(
        JSON.stringify({ error: "Pagamento não disponível", message: "Esta franquia ainda não configurou o sistema de pagamentos." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: event, error: eventError } = await supabase
      .from("events")
      .select("*")
      .eq("id", event_id)
      .single();

    if (eventError || !event) {
      return new Response(
        JSON.stringify({ error: "Evento não encontrado" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (event.available_spots < quantity) {
      return new Response(
        JSON.stringify({ error: "Vagas insuficientes", available: event.available_spots }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const totalAmount = Number(event.price) * quantity;

    if (totalAmount < MIN_PAYMENT_AMOUNT) {
      return new Response(
        JSON.stringify({ error: "Valor mínimo não atingido" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create ticket
    const { data: ticket, error: ticketError } = await supabase
      .from("tickets")
      .insert({
        event_id,
        franchise_id: franchise.id,
        customer_name: student_name,
        customer_email: `${student_name.toLowerCase().replace(/\s+/g, '.')}@example.com`,
        quantity,
        amount: totalAmount,
        payment_status: "pending",
        student_name,
        class_grade,
        shift: shift || null,
      })
      .select()
      .single();

    if (ticketError) {
      return new Response(
        JSON.stringify({ error: "Erro ao criar reserva" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        ticket_id: ticket.id,
        amount: totalAmount,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: "Erro interno", message: error instanceof Error ? error.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
