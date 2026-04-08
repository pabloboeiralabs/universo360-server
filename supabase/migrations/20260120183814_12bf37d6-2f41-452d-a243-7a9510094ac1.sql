-- Add commission columns to events table
ALTER TABLE public.events
ADD COLUMN IF NOT EXISTS seller_commission_pct numeric DEFAULT 25,
ADD COLUMN IF NOT EXISTS presenter_commission_pct numeric DEFAULT 20,
ADD COLUMN IF NOT EXISTS school_commission_type text DEFAULT 'percentage',
ADD COLUMN IF NOT EXISTS school_commission_value numeric DEFAULT 10;

-- Add comments for documentation
COMMENT ON COLUMN public.events.seller_commission_pct IS 'Seller commission percentage';
COMMENT ON COLUMN public.events.presenter_commission_pct IS 'Presenter commission percentage';
COMMENT ON COLUMN public.events.school_commission_type IS 'School commission type: percentage or fixed';
COMMENT ON COLUMN public.events.school_commission_value IS 'School commission value (% or R$)';