-- Permite colaboradores verem event_grades dos seus próprios eventos (mesmo inativos)
CREATE POLICY "Collaborators can view event grades for their own events"
ON public.event_grades
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