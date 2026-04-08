import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { event_id, student_name, class_grade, shift, password } = await req.json();

    if (!event_id || !student_name || !class_grade) {
      return new Response(
        JSON.stringify({ error: "Campos obrigatórios: event_id, student_name, class_grade" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Fetch event
    const { data: event, error: eventError } = await supabase
      .from("events")
      .select("id, franchise_id, customer_id, unit_id, price, cash_password, available_spots")
      .eq("id", event_id)
      .eq("is_active", true)
      .maybeSingle();

    if (eventError || !event) {
      return new Response(
        JSON.stringify({ error: "Evento não encontrado ou não está ativo" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate cash password
    if (!event.cash_password) {
      return new Response(
        JSON.stringify({ error: "Pagamento em dinheiro não habilitado para este evento" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (password !== event.cash_password) {
      return new Response(
        JSON.stringify({ error: "Senha incorreta" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check spots
    if (event.available_spots <= 0) {
      return new Response(
        JSON.stringify({ error: "Não há vagas disponíveis" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create ticket
    const { data: ticket, error: ticketError } = await supabase
      .from("tickets")
      .insert({
        event_id: event.id,
        franchise_id: event.franchise_id,
        customer_id: null,
        unit_id: event.unit_id,
        student_name,
        class_grade,
        shift: shift || null,
        customer_name: student_name,
        customer_email: "dinheiro@local",
        amount: event.price,
        quantity: 1,
        payment_status: "approved",
        payment_id: `cash_${Date.now()}`,
        payment_method: 'cash',
        spots_decremented: false,
      })
      .select("id")
      .single();

    if (ticketError) {
      console.error("Error creating ticket:", ticketError);
      return new Response(
        JSON.stringify({ error: "Erro ao registrar ingresso", details: ticketError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Decrement spots using RPC
    const { error: rpcError } = await supabase.rpc("decrement_spots", {
      p_ticket_id: ticket.id,
      p_event_id: event.id,
      p_quantity: 1,
    });

    if (rpcError) {
      console.error("Error decrementing spots:", rpcError);
      // Rollback ticket
      await supabase.from("tickets").delete().eq("id", ticket.id);
      return new Response(
        JSON.stringify({ error: "Erro ao atualizar vagas. Tente novamente." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, ticket_id: ticket.id }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Unexpected error:", err);
    return new Response(
      JSON.stringify({ error: "Erro interno do servidor" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
