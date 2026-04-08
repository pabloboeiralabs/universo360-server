-- Remover função get_mp_credentials_by_unit (substituída por busca direta na franquia)
DROP FUNCTION IF EXISTS public.get_mp_credentials_by_unit;

-- Criar nova função para buscar credenciais MP por franchise_id
CREATE OR REPLACE FUNCTION public.get_mp_credentials_by_franchise(_franchise_id UUID)
RETURNS TABLE(access_token TEXT, public_key TEXT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT mercadopago_access_token, mercadopago_public_key
    FROM public.franchises
    WHERE id = _franchise_id
    LIMIT 1
$$;

-- Dropar e recriar função get_admin_dashboard_stats sem total_units
DROP FUNCTION IF EXISTS public.get_admin_dashboard_stats;

CREATE FUNCTION public.get_admin_dashboard_stats()
RETURNS TABLE(total_franchises BIGINT, total_events BIGINT, total_tickets BIGINT, total_revenue NUMERIC, total_students BIGINT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT 
        (SELECT COUNT(*) FROM public.franchises WHERE is_active = true),
        (SELECT COUNT(*) FROM public.events WHERE is_active = true),
        (SELECT COUNT(*) FROM public.tickets WHERE payment_status = 'approved'),
        (SELECT COALESCE(SUM(amount), 0) FROM public.tickets WHERE payment_status = 'approved'),
        (SELECT COALESCE(SUM(quantity), 0) FROM public.tickets WHERE payment_status = 'approved')
$$;