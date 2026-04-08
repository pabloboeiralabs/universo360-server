CREATE POLICY "Collaborators can view tickets from their own events"
ON public.tickets
FOR SELECT
USING (
  event_id IN (
    SELECT id FROM public.events
    WHERE seller_id IN (
      SELECT id FROM public.commission_beneficiaries
      WHERE user_id = auth.uid()
    )
  )
);