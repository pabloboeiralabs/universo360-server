
-- Drop existing collaborator policies on events that only check seller_id
DROP POLICY IF EXISTS "Collaborators can view their own events" ON public.events;
DROP POLICY IF EXISTS "Collaborators can update their events" ON public.events;
DROP POLICY IF EXISTS "Collaborators can delete their own events" ON public.events;

-- Recreate with seller_id OR presenter_id OR supervisor_id
CREATE POLICY "Collaborators can view their own events"
ON public.events FOR SELECT
USING (
  seller_id IN (SELECT id FROM commission_beneficiaries WHERE user_id = auth.uid())
  OR presenter_id IN (SELECT id FROM commission_beneficiaries WHERE user_id = auth.uid())
  OR supervisor_id IN (SELECT id FROM commission_beneficiaries WHERE user_id = auth.uid())
);

CREATE POLICY "Collaborators can update their events"
ON public.events FOR UPDATE
USING (
  seller_id IN (SELECT id FROM commission_beneficiaries WHERE user_id = auth.uid())
  OR presenter_id IN (SELECT id FROM commission_beneficiaries WHERE user_id = auth.uid())
  OR supervisor_id IN (SELECT id FROM commission_beneficiaries WHERE user_id = auth.uid())
);

CREATE POLICY "Collaborators can delete their own events"
ON public.events FOR DELETE
USING (
  seller_id IN (SELECT id FROM commission_beneficiaries WHERE user_id = auth.uid())
);

-- Also update tickets policies so presenters/supervisors can view tickets from their events
DROP POLICY IF EXISTS "Collaborators can view tickets from their own events" ON public.tickets;
DROP POLICY IF EXISTS "Collaborators can delete tickets from their own events" ON public.tickets;

CREATE POLICY "Collaborators can view tickets from their own events"
ON public.tickets FOR SELECT
USING (
  event_id IN (
    SELECT id FROM events WHERE
      seller_id IN (SELECT id FROM commission_beneficiaries WHERE user_id = auth.uid())
      OR presenter_id IN (SELECT id FROM commission_beneficiaries WHERE user_id = auth.uid())
      OR supervisor_id IN (SELECT id FROM commission_beneficiaries WHERE user_id = auth.uid())
  )
);

CREATE POLICY "Collaborators can delete tickets from their own events"
ON public.tickets FOR DELETE
USING (
  event_id IN (
    SELECT id FROM events WHERE
      seller_id IN (SELECT id FROM commission_beneficiaries WHERE user_id = auth.uid())
  )
);
