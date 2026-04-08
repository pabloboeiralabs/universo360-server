
-- Add payment_gateway column to franchises (asaas, pagbank, mercadopago)
ALTER TABLE public.franchises 
ADD COLUMN IF NOT EXISTS payment_gateway text NOT NULL DEFAULT 'asaas';

-- Add pagbank_token column to franchises
ALTER TABLE public.franchises 
ADD COLUMN IF NOT EXISTS pagbank_token text;
