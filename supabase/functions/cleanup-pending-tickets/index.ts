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
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const now = new Date();
    const todayDate = now.toISOString().split("T")[0];
    const currentTime = now.toTimeString().slice(0, 8);

    // Find events that have already ended:
    // event_date < today OR (event_date = today AND event_end_time <= current_time)
    // If event_end_time is null, use event_time as fallback
    const { data: pastEvents, error: eventsError } = await supabase
      .from("events")
      .select("id, school_name, event_date, event_time, event_end_time")
      .or(`event_date.lt.${todayDate},and(event_date.eq.${todayDate},event_time.lte.${currentTime})`);

    if (eventsError) throw eventsError;

    if (!pastEvents || pastEvents.length === 0) {
      return new Response(
        JSON.stringify({ message: "Nenhum evento encerrado encontrado", deleted: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // For events with event_end_time on today, only include if end_time has passed
    const finishedEventIds = pastEvents
      .filter((e) => {
        if (e.event_date < todayDate) return true;
        // Same day: check end time (or event_time if no end time)
        const endTime = e.event_end_time || e.event_time;
        return endTime <= currentTime;
      })
      .map((e) => e.id);

    if (finishedEventIds.length === 0) {
      return new Response(
        JSON.stringify({ message: "Nenhum evento finalizado ainda", deleted: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Delete pending tickets for finished events
    const { data: deletedTickets, error: deleteError } = await supabase
      .from("tickets")
      .delete()
      .in("event_id", finishedEventIds)
      .eq("payment_status", "pending")
      .select("id, event_id");

    if (deleteError) throw deleteError;

    const deletedCount = deletedTickets?.length || 0;

    console.log(`Cleanup: ${deletedCount} pending tickets deleted from ${finishedEventIds.length} finished events`);

    return new Response(
      JSON.stringify({
        message: `${deletedCount} ingressos pendentes removidos`,
        deleted: deletedCount,
        events_checked: finishedEventIds.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Cleanup error:", error);
    return new Response(
      JSON.stringify({ error: "Erro interno", message: error instanceof Error ? error.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
