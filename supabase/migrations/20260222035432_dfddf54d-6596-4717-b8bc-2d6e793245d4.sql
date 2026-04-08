
-- Add ASAAS API key column
ALTER TABLE public.franchises ADD COLUMN asaas_api_key text;

-- Remove PagSeguro columns
ALTER TABLE public.franchises DROP COLUMN IF EXISTS pagseguro_token;
ALTER TABLE public.franchises DROP COLUMN IF EXISTS pagseguro_email;
ALTER TABLE public.franchises DROP COLUMN IF EXISTS pagseguro_public_key;
