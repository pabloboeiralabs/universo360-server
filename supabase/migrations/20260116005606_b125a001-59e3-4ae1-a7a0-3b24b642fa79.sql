-- Criar tabela units (planetários físicos)
CREATE TABLE public.units (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    franchise_id UUID REFERENCES public.franchises(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    address TEXT,
    city TEXT NOT NULL,
    state TEXT NOT NULL,
    capacity INTEGER DEFAULT 50,
    is_active BOOLEAN DEFAULT true NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Adicionar unit_id na tabela events
ALTER TABLE public.events ADD COLUMN unit_id UUID REFERENCES public.units(id) ON DELETE SET NULL;

-- Adicionar unit_id na tabela tickets para rastreamento
ALTER TABLE public.tickets ADD COLUMN unit_id UUID REFERENCES public.units(id) ON DELETE SET NULL;

-- Enable RLS
ALTER TABLE public.units ENABLE ROW LEVEL SECURITY;

-- Trigger para updated_at
CREATE TRIGGER update_units_updated_at 
    BEFORE UPDATE ON public.units 
    FOR EACH ROW 
    EXECUTE FUNCTION public.update_updated_at_column();

-- RLS Policies para units
-- Admins podem gerenciar todas as unidades
CREATE POLICY "Admins can manage all units"
    ON public.units FOR ALL
    USING (public.has_role(auth.uid(), 'admin'));

-- Donos de franquia podem ver suas próprias unidades
CREATE POLICY "Franchise owners can view their units"
    ON public.units FOR SELECT
    USING (franchise_id = public.get_user_franchise(auth.uid()));

-- Donos de franquia podem gerenciar suas próprias unidades
CREATE POLICY "Franchise owners can manage their units"
    ON public.units FOR ALL
    USING (franchise_id = public.get_user_franchise(auth.uid()));

-- Qualquer pessoa pode ver unidades ativas
CREATE POLICY "Anyone can view active units"
    ON public.units FOR SELECT
    USING (is_active = true);

-- Criar função para buscar credenciais MP por unit_id
CREATE OR REPLACE FUNCTION public.get_mp_credentials_by_unit(_unit_id UUID)
RETURNS TABLE(access_token TEXT, public_key TEXT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT f.mercadopago_access_token, f.mercadopago_public_key
    FROM public.units u
    JOIN public.franchises f ON u.franchise_id = f.id
    WHERE u.id = _unit_id
    LIMIT 1
$$;

-- Criar função para buscar dados consolidados para admin
CREATE OR REPLACE FUNCTION public.get_admin_dashboard_stats()
RETURNS TABLE(
    total_franchises BIGINT,
    total_units BIGINT,
    total_events BIGINT,
    total_tickets BIGINT,
    total_revenue NUMERIC,
    total_students BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT 
        (SELECT COUNT(*) FROM public.franchises WHERE is_active = true),
        (SELECT COUNT(*) FROM public.units WHERE is_active = true),
        (SELECT COUNT(*) FROM public.events WHERE is_active = true),
        (SELECT COUNT(*) FROM public.tickets WHERE payment_status = 'approved'),
        (SELECT COALESCE(SUM(amount), 0) FROM public.tickets WHERE payment_status = 'approved'),
        (SELECT COALESCE(SUM(quantity), 0) FROM public.tickets WHERE payment_status = 'approved')
$$;