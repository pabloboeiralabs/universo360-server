ALTER TABLE public.franchises
  ADD COLUMN IF NOT EXISTS default_seller_commission_pct numeric DEFAULT 25,
  ADD COLUMN IF NOT EXISTS default_presenter_commission_pct numeric DEFAULT 20,
  ADD COLUMN IF NOT EXISTS default_supervisor_commission_pct numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS default_school_commission_pct numeric DEFAULT 10;