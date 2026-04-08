-- Add columns for OAuth tokens and user ID from Mercado Pago
ALTER TABLE public.franchises 
ADD COLUMN IF NOT EXISTS mercadopago_refresh_token TEXT,
ADD COLUMN IF NOT EXISTS mercadopago_user_id BIGINT;