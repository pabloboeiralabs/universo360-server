CREATE POLICY "Collaborators can create grades"
ON public.grades
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.commission_beneficiaries
    WHERE user_id = auth.uid()
  )
);