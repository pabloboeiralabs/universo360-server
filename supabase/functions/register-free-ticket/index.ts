import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RegisterRequest {
  event_id: string;
  student_name: string;
  class_grade: string;
  shift?: string; // morning or afternoon
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body: RegisterRequest = await req.json();
    const { event_id, student_name, class_grade, shift } = body;

    console.log('Register free ticket request:', { event_id, student_name, class_grade, shift });

    // Validate required fields
    if (!event_id || !student_name || !class_grade) {
      return new Response(
        JSON.stringify({ error: 'Campos obrigatórios: event_id, student_name, class_grade' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch event details
    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('*, franchises(id, name)')
      .eq('id', event_id)
      .eq('is_active', true)
      .single();

    if (eventError || !event) {
      console.error('Event not found:', eventError);
      return new Response(
        JSON.stringify({ error: 'Evento não encontrado ou não está ativo' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate that the event is free
    if (event.price !== 0) {
      console.error('Event is not free:', event.price);
      return new Response(
        JSON.stringify({ error: 'Este evento não é gratuito. Use o checkout de pagamento.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check available spots
    if (event.available_spots <= 0) {
      console.error('No spots available:', event.available_spots);
      return new Response(
        JSON.stringify({ error: 'Não há vagas disponíveis para este evento' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate a simple email for the ticket record
    const sanitizedName = student_name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]/g, "")
      .substring(0, 20);
    const customerEmail = `${sanitizedName}.free@example.com`;

    // Create the ticket with "confirmed" status (no payment needed)
    const { data: ticket, error: ticketError } = await supabase
      .from('tickets')
      .insert({
        event_id: event_id,
        franchise_id: event.franchise_id,
        customer_id: event.customer_id,
        unit_id: event.unit_id,
        student_name: student_name,
        class_grade: class_grade,
        shift: shift || null,
        customer_name: student_name,
        customer_email: customerEmail,
        amount: 0,
        quantity: 1,
        payment_status: 'approved',
        payment_method: 'free',
        spots_decremented: true,
      })
      .select()
      .single();

    if (ticketError) {
      console.error('Error creating ticket:', ticketError);
      return new Response(
        JSON.stringify({ error: 'Erro ao registrar inscrição', details: ticketError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Ticket created successfully:', ticket.id);

    // Decrement available spots atomically
    const { error: updateError } = await supabase
      .from('events')
      .update({ available_spots: event.available_spots - 1 })
      .eq('id', event_id)
      .eq('available_spots', event.available_spots); // Optimistic concurrency control

    if (updateError) {
      console.error('Error updating spots:', updateError);
      // Rollback - delete the ticket
      await supabase.from('tickets').delete().eq('id', ticket.id);
      return new Response(
        JSON.stringify({ error: 'Erro ao atualizar vagas. Tente novamente.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Registration completed successfully for ticket:', ticket.id);

    return new Response(
      JSON.stringify({
        success: true,
        ticket_id: ticket.id,
        message: 'Inscrição realizada com sucesso!',
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    console.error('Unexpected error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: 'Erro interno do servidor', details: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
