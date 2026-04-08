import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const eventId = url.searchParams.get("eventId");

    if (!eventId) {
      return new Response(JSON.stringify({ error: "eventId is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Fetch event (only if active)
    const { data: event, error: eventError } = await supabase
      .from("events")
      .select("id, school_name, event_date, event_time, is_active")
      .eq("id", eventId)
      .eq("is_active", true)
      .single();

    if (eventError || !event) {
      return new Response(JSON.stringify({ error: "Evento não encontrado ou inativo" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch grade order defined by the franchise (created_at preserves insertion order)
    const { data: eventGrades } = await supabase
      .from("event_grades")
      .select("id, custom_grade_name, grade_id, grades(name)")
      .eq("event_id", eventId)
      .order("created_at", { ascending: true });

    // Build ordered grade name list, deduplicated
    const seenGrades = new Set<string>();
    const gradeOrder: string[] = [];
    for (const eg of eventGrades || []) {
      const name = eg.custom_grade_name || (eg as any).grades?.name || "Não informada";
      if (!seenGrades.has(name)) {
        seenGrades.add(name);
        gradeOrder.push(name);
      }
    }

    // Fetch approved tickets — order by student_name within each grade
    const { data: tickets, error: ticketsError } = await supabase
      .from("tickets")
      .select("student_name, class_grade, shift, payment_status, quantity")
      .eq("event_id", eventId)
      .eq("payment_status", "approved")
      .order("student_name", { ascending: true });

    if (ticketsError) {
      throw ticketsError;
    }

    const students = (tickets || []).map((t) => ({
      student_name: t.student_name || "Não informado",
      class_grade: t.class_grade || "Não informada",
      shift: t.shift || "-",
      quantity: t.quantity,
    }));

    return new Response(
      JSON.stringify({
        event: {
          school_name: event.school_name,
          event_date: event.event_date,
          event_time: event.event_time,
        },
        students,
        grade_order: gradeOrder,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: "Erro interno" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
