
-- Drop overly permissive policies
DROP POLICY IF EXISTS "Customers can create tickets" ON public.tickets;
DROP POLICY IF EXISTS "Anyone can create contact messages" ON public.contact_messages;

-- Create more restrictive policy for tickets - allows authenticated users to create tickets
CREATE POLICY "Authenticated users can create tickets"
    ON public.tickets FOR INSERT
    TO authenticated
    WITH CHECK (customer_id = auth.uid() OR customer_id IS NULL);

-- Create policy for contact messages - allows anyone (including anonymous) but with rate limiting consideration
CREATE POLICY "Public can create contact messages"
    ON public.contact_messages FOR INSERT
    TO anon, authenticated
    WITH CHECK (
        length(name) > 0 AND 
        length(email) > 0 AND 
        length(message) > 0
    );
