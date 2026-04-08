
-- Drop restrictive policies and recreate as permissive for public checkout

-- events
DROP POLICY IF EXISTS "Anyone can view active events" ON public.events;
CREATE POLICY "Anyone can view active events"
  ON public.events FOR SELECT
  USING (is_active = true);

-- franchises
DROP POLICY IF EXISTS "Anyone can view active franchises" ON public.franchises;
CREATE POLICY "Anyone can view active franchises"
  ON public.franchises FOR SELECT
  USING (is_active = true);

-- event_grades
DROP POLICY IF EXISTS "Anyone can view event grades for active events" ON public.event_grades;
CREATE POLICY "Anyone can view event grades for active events"
  ON public.event_grades FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.events WHERE events.id = event_grades.event_id AND events.is_active = true));

-- grades
DROP POLICY IF EXISTS "Anyone can view active grades" ON public.grades;
CREATE POLICY "Anyone can view active grades"
  ON public.grades FOR SELECT
  USING (is_active = true);

-- customers
DROP POLICY IF EXISTS "Anyone can view active customers" ON public.customers;
CREATE POLICY "Anyone can view active customers"
  ON public.customers FOR SELECT
  USING (is_active = true);
