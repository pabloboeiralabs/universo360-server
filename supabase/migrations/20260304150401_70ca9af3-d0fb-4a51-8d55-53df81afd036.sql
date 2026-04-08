CREATE POLICY "Collaborators can delete tickets from their own events"
ON public.tickets
FOR DELETE
USING (
  event_id IN (
    SELECT id FROM public.events
    WHERE seller_id IN (
      SELECT id FROM public.commission_beneficiaries
      WHERE user_id = auth.uid()
    )
  )
);