
CREATE POLICY "Admins can delete tickets"
ON public.tickets FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Franchise owners can delete their franchise tickets"
ON public.tickets FOR DELETE
USING (franchise_id = get_user_franchise(auth.uid()));
