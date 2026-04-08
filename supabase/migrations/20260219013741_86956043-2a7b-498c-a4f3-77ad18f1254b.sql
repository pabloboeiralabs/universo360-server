
-- Create commission_beneficiaries table
CREATE TABLE public.commission_beneficiaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  franchise_id uuid NOT NULL REFERENCES public.franchises(id) ON DELETE CASCADE,
  name text NOT NULL,
  type text NOT NULL CHECK (type IN ('seller', 'presenter', 'supervisor')),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.commission_beneficiaries ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Admins can manage all beneficiaries"
ON public.commission_beneficiaries FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Franchise owners can manage their beneficiaries"
ON public.commission_beneficiaries FOR ALL
USING (franchise_id = public.get_user_franchise(auth.uid()));

CREATE POLICY "Anyone can view active beneficiaries"
ON public.commission_beneficiaries FOR SELECT
USING (is_active = true);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.commission_beneficiaries;

-- Add beneficiary columns to events
ALTER TABLE public.events
  ADD COLUMN seller_id uuid REFERENCES public.commission_beneficiaries(id),
  ADD COLUMN presenter_id uuid REFERENCES public.commission_beneficiaries(id),
  ADD COLUMN supervisor_id uuid REFERENCES public.commission_beneficiaries(id);
