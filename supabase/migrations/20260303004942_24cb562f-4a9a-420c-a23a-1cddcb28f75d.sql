
-- Allow collaborators to INSERT events for their franchise (only via their linked beneficiary/franchise)
CREATE POLICY "Collaborators can create events for their franchise"
ON public.events
FOR INSERT
WITH CHECK (
  franchise_id IN (
    SELECT franchise_id FROM public.commission_beneficiaries
    WHERE user_id = auth.uid()
  )
);

-- Allow collaborators to view events from their franchise
CREATE POLICY "Collaborators can view events from their franchise"
ON public.events
FOR SELECT
USING (
  franchise_id IN (
    SELECT franchise_id FROM public.commission_beneficiaries
    WHERE user_id = auth.uid()
  )
);

-- Allow collaborators to update events where they are the seller
CREATE POLICY "Collaborators can update their events"
ON public.events
FOR UPDATE
USING (
  seller_id IN (
    SELECT id FROM public.commission_beneficiaries
    WHERE user_id = auth.uid()
  )
);

-- Allow collaborators to manage event_grades for events in their franchise
CREATE POLICY "Collaborators can manage event grades for their franchise events"
ON public.event_grades
FOR INSERT
WITH CHECK (
  event_id IN (
    SELECT e.id FROM public.events e
    JOIN public.commission_beneficiaries cb ON cb.franchise_id = e.franchise_id
    WHERE cb.user_id = auth.uid()
  )
);
