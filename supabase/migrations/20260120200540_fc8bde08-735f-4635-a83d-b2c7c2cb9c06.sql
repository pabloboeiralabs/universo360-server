-- Tabela para rastrear pagamentos de comissões a vendedores e apresentadores
CREATE TABLE public.commission_payouts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  franchise_id UUID NOT NULL REFERENCES public.franchises(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  payout_type TEXT NOT NULL CHECK (payout_type IN ('seller', 'presenter', 'school')),
  recipient_name TEXT,
  amount NUMERIC NOT NULL DEFAULT 0,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  is_paid BOOLEAN NOT NULL DEFAULT false,
  paid_at TIMESTAMP WITH TIME ZONE,
  paid_by UUID REFERENCES auth.users(id),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.commission_payouts ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Admins can manage all commission payouts"
ON public.commission_payouts
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Franchise owners can manage their commission payouts"
ON public.commission_payouts
FOR ALL
USING (franchise_id = get_user_franchise(auth.uid()));

-- Trigger for updated_at
CREATE TRIGGER update_commission_payouts_updated_at
BEFORE UPDATE ON public.commission_payouts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Index for faster queries
CREATE INDEX idx_commission_payouts_franchise_id ON public.commission_payouts(franchise_id);
CREATE INDEX idx_commission_payouts_event_id ON public.commission_payouts(event_id);
CREATE INDEX idx_commission_payouts_is_paid ON public.commission_payouts(is_paid);