-- Adicionar campos de comissão configurável por franquia
ALTER TABLE public.franchises 
ADD COLUMN IF NOT EXISTS commission_type text DEFAULT 'fixed' CHECK (commission_type IN ('fixed', 'percentage')),
ADD COLUMN IF NOT EXISTS commission_value numeric DEFAULT 2.00;