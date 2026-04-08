
-- Drop the overly permissive policy that shows ALL franchise events to collaborators
DROP POLICY IF EXISTS "Collaborators can view events from their franchise" ON public.events;

-- New policy: collaborators only see events where they are assigned as seller
CREATE POLICY "Collaborators can view their own events"
ON public.events
FOR SELECT
USING (
  seller_id IN (
    SELECT id FROM public.commission_beneficiaries
    WHERE user_id = auth.uid()
  )
);
