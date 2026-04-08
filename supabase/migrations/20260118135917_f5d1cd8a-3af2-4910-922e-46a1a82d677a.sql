-- Add column to track last token refresh
ALTER TABLE public.franchises 
ADD COLUMN IF NOT EXISTS mp_token_refreshed_at TIMESTAMP WITH TIME ZONE;

-- Enable required extensions for cron jobs
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;