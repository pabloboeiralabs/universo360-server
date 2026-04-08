
-- Allow service role (edge functions) to update tickets
-- This is needed for payment status updates from edge functions
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;

-- Policy to allow service role bypass (edge functions use service role key)
-- In Supabase, service role bypasses RLS by default, but we need to ensure
-- the tickets table allows updates via authenticated operations
CREATE POLICY "Service role can update tickets"
  ON public.tickets
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- Also allow franchise owners to update their tickets
CREATE POLICY "Franchise owners can update their franchise tickets"
  ON public.tickets
  FOR UPDATE
  USING (franchise_id = get_user_franchise(auth.uid()));
