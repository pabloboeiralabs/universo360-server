-- Allow franchise owners to create new grades
CREATE POLICY "Franchise owners can create grades"
ON public.grades
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'franchise_owner'::app_role));