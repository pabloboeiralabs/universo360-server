CREATE POLICY "Collaborators can delete their own events"
ON public.events
FOR DELETE
USING (
  seller_id IN (
    SELECT id FROM public.commission_beneficiaries
    WHERE user_id = auth.uid()
  )
);