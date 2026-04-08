
-- Add seller_id column to customers table
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS seller_id uuid REFERENCES public.commission_beneficiaries(id) ON DELETE SET NULL;

-- RLS: Collaborators can view customers linked to them (via their beneficiary record)
CREATE POLICY "Collaborators can view their customers"
ON public.customers
FOR SELECT
USING (
  seller_id IN (
    SELECT id FROM public.commission_beneficiaries WHERE user_id = auth.uid()
  )
);

-- RLS: Collaborators can insert customers linked to their beneficiary
CREATE POLICY "Collaborators can create customers for their franchise"
ON public.customers
FOR INSERT
WITH CHECK (
  franchise_id IN (
    SELECT franchise_id FROM public.commission_beneficiaries WHERE user_id = auth.uid()
  )
);

-- RLS: Collaborators can update their own customers
CREATE POLICY "Collaborators can update their customers"
ON public.customers
FOR UPDATE
USING (
  seller_id IN (
    SELECT id FROM public.commission_beneficiaries WHERE user_id = auth.uid()
  )
);
