
-- Adicionar colunas PagSeguro na tabela franchises
ALTER TABLE public.franchises ADD COLUMN IF NOT EXISTS pagseguro_token text;
ALTER TABLE public.franchises ADD COLUMN IF NOT EXISTS pagseguro_email text;
