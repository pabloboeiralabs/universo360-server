
-- Add collaborator role to app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'collaborator';

-- Add user_id to commission_beneficiaries to link to auth user
ALTER TABLE public.commission_beneficiaries ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- Add beneficiary_id to commission_payouts for RLS filtering
ALTER TABLE public.commission_payouts ADD COLUMN IF NOT EXISTS beneficiary_id uuid;

-- Add RLS policy: collaborators can view their own beneficiary record
CREATE POLICY "Collaborators can view their own beneficiary"
ON public.commission_beneficiaries
FOR SELECT
USING (user_id = auth.uid());

-- Add RLS policy: collaborators can update their own beneficiary (for PIX key)
CREATE POLICY "Collaborators can update their own beneficiary"
ON public.commission_beneficiaries
FOR UPDATE
USING (user_id = auth.uid());

-- Add RLS policy: collaborators can view their own commission payouts
CREATE POLICY "Collaborators can view their own payouts"
ON public.commission_payouts
FOR SELECT
USING (
  beneficiary_id IN (
    SELECT id FROM public.commission_beneficiaries WHERE user_id = auth.uid()
  )
);

-- Update has_role function to support collaborator role (already works since it uses the enum)
-- No changes needed to has_role function

-- Add a helper function to get the beneficiary_id for the current collaborator
CREATE OR REPLACE FUNCTION public.get_user_beneficiary(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.commission_beneficiaries WHERE user_id = _user_id LIMIT 1
$$;
