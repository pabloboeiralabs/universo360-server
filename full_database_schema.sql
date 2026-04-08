
-- Create enum for user roles
CREATE TYPE public.app_role AS ENUM ('admin', 'franchise_owner', 'customer');

-- Create profiles table
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT,
    phone TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Create user_roles table
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    UNIQUE (user_id, role)
);

-- Create franchises table
CREATE TABLE public.franchises (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    city TEXT NOT NULL,
    state TEXT NOT NULL,
    mercadopago_access_token TEXT,
    mercadopago_public_key TEXT,
    is_active BOOLEAN DEFAULT true NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Create events table
CREATE TABLE public.events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    franchise_id UUID REFERENCES public.franchises(id) ON DELETE CASCADE NOT NULL,
    school_name TEXT NOT NULL,
    location TEXT NOT NULL,
    event_date DATE NOT NULL,
    event_time TIME NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    total_capacity INTEGER NOT NULL,
    available_spots INTEGER NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Create tickets table
CREATE TABLE public.tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID REFERENCES public.events(id) ON DELETE CASCADE NOT NULL,
    customer_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    franchise_id UUID REFERENCES public.franchises(id) ON DELETE CASCADE NOT NULL,
    payment_id TEXT,
    payment_status TEXT DEFAULT 'pending' NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    customer_name TEXT NOT NULL,
    customer_email TEXT NOT NULL,
    customer_phone TEXT,
    quantity INTEGER DEFAULT 1 NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Create contact_messages table
CREATE TABLE public.contact_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT,
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT false NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.franchises ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_messages ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.user_roles
        WHERE user_id = _user_id
        AND role = _role
    )
$$;

-- Create function to get user's franchise
CREATE OR REPLACE FUNCTION public.get_user_franchise(_user_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT id FROM public.franchises WHERE owner_id = _user_id LIMIT 1
$$;

-- Create trigger function for updating timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create triggers for updated_at
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_franchises_updated_at BEFORE UPDATE ON public.franchises FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_events_updated_at BEFORE UPDATE ON public.events FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_tickets_updated_at BEFORE UPDATE ON public.tickets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to handle new user profile
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.profiles (id, full_name)
    VALUES (NEW.id, NEW.raw_user_meta_data ->> 'full_name');
    
    -- All new users get customer role by default
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'customer');
    
    RETURN NEW;
END;
$$;

-- Create trigger for new user
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- RLS Policies for profiles
CREATE POLICY "Users can view their own profile"
    ON public.profiles FOR SELECT
    USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
    ON public.profiles FOR UPDATE
    USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles"
    ON public.profiles FOR SELECT
    USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for user_roles
CREATE POLICY "Users can view their own roles"
    ON public.user_roles FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all roles"
    ON public.user_roles FOR ALL
    USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for franchises
CREATE POLICY "Anyone can view active franchises"
    ON public.franchises FOR SELECT
    USING (is_active = true);

CREATE POLICY "Admins can manage all franchises"
    ON public.franchises FOR ALL
    USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Franchise owners can view their franchise"
    ON public.franchises FOR SELECT
    USING (owner_id = auth.uid());

CREATE POLICY "Franchise owners can update their franchise"
    ON public.franchises FOR UPDATE
    USING (owner_id = auth.uid());

-- RLS Policies for events
CREATE POLICY "Anyone can view active events"
    ON public.events FOR SELECT
    USING (is_active = true);

CREATE POLICY "Admins can manage all events"
    ON public.events FOR ALL
    USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Franchise owners can manage their events"
    ON public.events FOR ALL
    USING (franchise_id = public.get_user_franchise(auth.uid()));

-- RLS Policies for tickets
CREATE POLICY "Customers can view their own tickets"
    ON public.tickets FOR SELECT
    USING (customer_id = auth.uid());

CREATE POLICY "Customers can create tickets"
    ON public.tickets FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Admins can view all tickets"
    ON public.tickets FOR SELECT
    USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Franchise owners can view their franchise tickets"
    ON public.tickets FOR SELECT
    USING (franchise_id = public.get_user_franchise(auth.uid()));

-- RLS Policies for contact_messages
CREATE POLICY "Anyone can create contact messages"
    ON public.contact_messages FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Admins can view all messages"
    ON public.contact_messages FOR SELECT
    USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update messages"
    ON public.contact_messages FOR UPDATE
    USING (public.has_role(auth.uid(), 'admin'));

-- Drop overly permissive policies
DROP POLICY IF EXISTS "Customers can create tickets" ON public.tickets;
DROP POLICY IF EXISTS "Anyone can create contact messages" ON public.contact_messages;

-- Create more restrictive policy for tickets - allows authenticated users to create tickets
CREATE POLICY "Authenticated users can create tickets"
    ON public.tickets FOR INSERT
    TO authenticated
    WITH CHECK (customer_id = auth.uid() OR customer_id IS NULL);

-- Create policy for contact messages - allows anyone (including anonymous) but with rate limiting consideration
CREATE POLICY "Public can create contact messages"
    ON public.contact_messages FOR INSERT
    TO anon, authenticated
    WITH CHECK (
        length(name) > 0 AND 
        length(email) > 0 AND 
        length(message) > 0
    );
-- Criar tabela units (planetÃ¡rios fÃ­sicos)
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

-- Donos de franquia podem ver suas prÃ³prias unidades
CREATE POLICY "Franchise owners can view their units"
    ON public.units FOR SELECT
    USING (franchise_id = public.get_user_franchise(auth.uid()));

-- Donos de franquia podem gerenciar suas prÃ³prias unidades
CREATE POLICY "Franchise owners can manage their units"
    ON public.units FOR ALL
    USING (franchise_id = public.get_user_franchise(auth.uid()));

-- Qualquer pessoa pode ver unidades ativas
CREATE POLICY "Anyone can view active units"
    ON public.units FOR SELECT
    USING (is_active = true);

-- Criar funÃ§Ã£o para buscar credenciais MP por unit_id
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

-- Criar funÃ§Ã£o para buscar dados consolidados para admin
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
-- Add school-specific columns to tickets table
ALTER TABLE public.tickets 
  ADD COLUMN IF NOT EXISTS student_name TEXT,
  ADD COLUMN IF NOT EXISTS class_grade TEXT,
  ADD COLUMN IF NOT EXISTS parent_name TEXT;
-- Create customers table for schools/clients
CREATE TABLE public.customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    franchise_id UUID REFERENCES public.franchises(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    cnpj TEXT,
    email TEXT,
    phone TEXT,
    whatsapp TEXT,
    cep TEXT,
    street TEXT,
    number TEXT,
    neighborhood TEXT,
    city TEXT,
    state TEXT,
    reference_point TEXT,
    is_active BOOLEAN DEFAULT true NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Enable RLS
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

-- RLS Policies for customers
CREATE POLICY "Admins can manage all customers"
ON public.customers
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Franchise owners can manage their customers"
ON public.customers
FOR ALL
USING (franchise_id = get_user_franchise(auth.uid()));

CREATE POLICY "Anyone can view active customers"
ON public.customers
FOR SELECT
USING (is_active = true);

-- Add customer_id to events table
ALTER TABLE public.events ADD COLUMN customer_id UUID REFERENCES public.customers(id);

-- Create trigger for updated_at
CREATE TRIGGER update_customers_updated_at
BEFORE UPDATE ON public.customers
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
-- Adicionar campos de comissÃ£o configurÃ¡vel por franquia
ALTER TABLE public.franchises 
ADD COLUMN IF NOT EXISTS commission_type text DEFAULT 'fixed' CHECK (commission_type IN ('fixed', 'percentage')),
ADD COLUMN IF NOT EXISTS commission_value numeric DEFAULT 2.00;

-- 1. Adicionar campo CPF na tabela customers
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS cpf text;

-- 2. Criar tabela de sÃ©ries/turmas globais
CREATE TABLE public.grades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  display_order integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.grades ENABLE ROW LEVEL SECURITY;

-- PolÃ­ticas RLS para grades
CREATE POLICY "Anyone can view active grades" ON public.grades
  FOR SELECT USING (is_active = true);

CREATE POLICY "Admins can manage all grades" ON public.grades
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Franchise owners can view grades" ON public.grades
  FOR SELECT USING (true);

-- Inserir sÃ©ries padrÃ£o
INSERT INTO public.grades (name, display_order) VALUES
  ('Maternal', 1),
  ('PrÃ© 1', 2),
  ('PrÃ© 2', 3),
  ('1Âº ano', 4),
  ('2Âº ano', 5),
  ('3Âº ano', 6),
  ('4Âº ano', 7),
  ('5Âº ano', 8),
  ('6Âº ano', 9),
  ('7Âº ano', 10),
  ('8Âº ano', 11),
  ('9Âº ano', 12);

-- 3. Criar tabela de sÃ©ries por evento
CREATE TABLE public.event_grades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  grade_id uuid REFERENCES public.grades(id) ON DELETE SET NULL,
  custom_grade_name text,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT grade_or_custom CHECK (grade_id IS NOT NULL OR custom_grade_name IS NOT NULL)
);

-- Habilitar RLS
ALTER TABLE public.event_grades ENABLE ROW LEVEL SECURITY;

-- PolÃ­ticas RLS para event_grades
CREATE POLICY "Anyone can view event grades for active events" ON public.event_grades
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.events WHERE id = event_id AND is_active = true)
  );

CREATE POLICY "Admins can manage all event grades" ON public.event_grades
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Franchise owners can manage their event grades" ON public.event_grades
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.events e 
      WHERE e.id = event_id 
      AND e.franchise_id = get_user_franchise(auth.uid())
    )
  );
-- Remover funÃ§Ã£o get_mp_credentials_by_unit (substituÃ­da por busca direta na franquia)
DROP FUNCTION IF EXISTS public.get_mp_credentials_by_unit;

-- Criar nova funÃ§Ã£o para buscar credenciais MP por franchise_id
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

-- Dropar e recriar funÃ§Ã£o get_admin_dashboard_stats sem total_units
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
-- Add columns for tracking Mercado Pago payment ID and refund information
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS mp_payment_id text;
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS refunded_at timestamp with time zone;
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS refund_reason text;

-- Add index for faster lookups by mp_payment_id
CREATE INDEX IF NOT EXISTS idx_tickets_mp_payment_id ON public.tickets(mp_payment_id);

-- Add comment explaining the columns
COMMENT ON COLUMN public.tickets.mp_payment_id IS 'Real Mercado Pago payment ID (different from preference ID stored in payment_id)';
COMMENT ON COLUMN public.tickets.refunded_at IS 'Timestamp when the refund was processed';
COMMENT ON COLUMN public.tickets.refund_reason IS 'Reason provided for the refund';
-- Adicionar campo username na tabela profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS username TEXT UNIQUE;

-- Criar Ã­ndice para busca rÃ¡pida por username
CREATE INDEX IF NOT EXISTS idx_profiles_username ON profiles(username);

-- Atualizar o admin existente com username 'admin'
UPDATE profiles 
SET username = 'admin' 
WHERE id = 'c9344362-6640-4136-a67c-45a981b05974';
-- Allow franchise owners to create new grades
CREATE POLICY "Franchise owners can create grades"
ON public.grades
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'franchise_owner'::app_role));
-- Add columns for OAuth tokens and user ID from Mercado Pago
ALTER TABLE public.franchises 
ADD COLUMN IF NOT EXISTS mercadopago_refresh_token TEXT,
ADD COLUMN IF NOT EXISTS mercadopago_user_id BIGINT;
-- Add column to track last token refresh
ALTER TABLE public.franchises 
ADD COLUMN IF NOT EXISTS mp_token_refreshed_at TIMESTAMP WITH TIME ZONE;

-- Enable required extensions for cron jobs
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
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
-- Tabela para rastrear pagamentos de comissÃµes a vendedores e apresentadores
CREATE TABLE public.commission_payouts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  franchise_id UUID NOT NULL REFERENCES public.franchises(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  payout_type TEXT NOT NULL CHECK (payout_type IN ('seller', 'presenter', 'school')),
  recipient_name TEXT,
  amount NUMERIC NOT NULL DEFAULT 0,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  is_paid BOOLEAN NOT NULL DEFAULT false,
  paid_at TIMESTAMP WITH TIME ZONE,
  paid_by UUID REFERENCES auth.users(id),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.commission_payouts ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Admins can manage all commission payouts"
ON public.commission_payouts
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Franchise owners can manage their commission payouts"
ON public.commission_payouts
FOR ALL
USING (franchise_id = get_user_franchise(auth.uid()));

-- Trigger for updated_at
CREATE TRIGGER update_commission_payouts_updated_at
BEFORE UPDATE ON public.commission_payouts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Index for faster queries
CREATE INDEX idx_commission_payouts_franchise_id ON public.commission_payouts(franchise_id);
CREATE INDEX idx_commission_payouts_event_id ON public.commission_payouts(event_id);
CREATE INDEX idx_commission_payouts_is_paid ON public.commission_payouts(is_paid);
-- Habilitar realtime para tabelas principais
ALTER PUBLICATION supabase_realtime ADD TABLE public.events;
ALTER PUBLICATION supabase_realtime ADD TABLE public.tickets;
ALTER PUBLICATION supabase_realtime ADD TABLE public.commission_payouts;
-- Add shift column to tickets table for morning/afternoon selection
ALTER TABLE public.tickets 
ADD COLUMN shift text NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.tickets.shift IS 'Student shift: morning (manhÃ£) or afternoon (tarde)';

-- Adicionar colunas PagSeguro na tabela franchises
ALTER TABLE public.franchises ADD COLUMN IF NOT EXISTS pagseguro_token text;
ALTER TABLE public.franchises ADD COLUMN IF NOT EXISTS pagseguro_email text;

-- Coluna de controle para evitar decremento duplo
ALTER TABLE public.tickets 
  ADD COLUMN spots_decremented boolean NOT NULL DEFAULT false;

-- Funcao atomica que decrementa vagas apenas 1 vez por ticket
CREATE OR REPLACE FUNCTION public.decrement_spots(
  p_ticket_id uuid, 
  p_event_id uuid, 
  p_quantity int
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  already_done boolean;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext(p_ticket_id::text));
  
  SELECT spots_decremented INTO already_done 
  FROM tickets WHERE id = p_ticket_id;
  
  IF already_done THEN
    RETURN false;
  END IF;
  
  UPDATE events 
  SET available_spots = GREATEST(available_spots - p_quantity, 0)
  WHERE id = p_event_id;
  
  UPDATE tickets 
  SET spots_decremented = true 
  WHERE id = p_ticket_id;
  
  RETURN true;
END;
$$;

-- Marcar tickets ja aprovados com spots ja decrementados
UPDATE tickets SET spots_decremented = true WHERE payment_status = 'approved';

-- Atualizar tickets 'confirmed' existentes para 'approved'
UPDATE tickets SET payment_status = 'approved', spots_decremented = true WHERE payment_status = 'confirmed';
ALTER TABLE public.franchises ADD COLUMN IF NOT EXISTS pagseguro_public_key text;

-- Drop restrictive policies and recreate as permissive for public checkout

-- events
DROP POLICY IF EXISTS "Anyone can view active events" ON public.events;
CREATE POLICY "Anyone can view active events"
  ON public.events FOR SELECT
  USING (is_active = true);

-- franchises
DROP POLICY IF EXISTS "Anyone can view active franchises" ON public.franchises;
CREATE POLICY "Anyone can view active franchises"
  ON public.franchises FOR SELECT
  USING (is_active = true);

-- event_grades
DROP POLICY IF EXISTS "Anyone can view event grades for active events" ON public.event_grades;
CREATE POLICY "Anyone can view event grades for active events"
  ON public.event_grades FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.events WHERE events.id = event_grades.event_id AND events.is_active = true));

-- grades
DROP POLICY IF EXISTS "Anyone can view active grades" ON public.grades;
CREATE POLICY "Anyone can view active grades"
  ON public.grades FOR SELECT
  USING (is_active = true);

-- customers
DROP POLICY IF EXISTS "Anyone can view active customers" ON public.customers;
CREATE POLICY "Anyone can view active customers"
  ON public.customers FOR SELECT
  USING (is_active = true);
ALTER TABLE events ADD COLUMN supervisor_commission_pct numeric DEFAULT 0;
ALTER TABLE events ADD COLUMN sales_deadline timestamp with time zone DEFAULT NULL;

-- Create commission_beneficiaries table
CREATE TABLE public.commission_beneficiaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  franchise_id uuid NOT NULL REFERENCES public.franchises(id) ON DELETE CASCADE,
  name text NOT NULL,
  type text NOT NULL CHECK (type IN ('seller', 'presenter', 'supervisor')),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.commission_beneficiaries ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Admins can manage all beneficiaries"
ON public.commission_beneficiaries FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Franchise owners can manage their beneficiaries"
ON public.commission_beneficiaries FOR ALL
USING (franchise_id = public.get_user_franchise(auth.uid()));

CREATE POLICY "Anyone can view active beneficiaries"
ON public.commission_beneficiaries FOR SELECT
USING (is_active = true);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.commission_beneficiaries;

-- Add beneficiary columns to events
ALTER TABLE public.events
  ADD COLUMN seller_id uuid REFERENCES public.commission_beneficiaries(id),
  ADD COLUMN presenter_id uuid REFERENCES public.commission_beneficiaries(id),
  ADD COLUMN supervisor_id uuid REFERENCES public.commission_beneficiaries(id);

-- Add ASAAS API key column
ALTER TABLE public.franchises ADD COLUMN asaas_api_key text;

-- Remove PagSeguro columns
ALTER TABLE public.franchises DROP COLUMN IF EXISTS pagseguro_token;
ALTER TABLE public.franchises DROP COLUMN IF EXISTS pagseguro_email;
ALTER TABLE public.franchises DROP COLUMN IF EXISTS pagseguro_public_key;
ALTER TABLE public.franchises ADD COLUMN asaas_webhook_token text;
ALTER TABLE public.events ADD COLUMN cash_password text DEFAULT NULL;

ALTER TABLE public.tickets ADD COLUMN payment_method text;

UPDATE public.tickets SET payment_method = 'cash' WHERE payment_id LIKE 'cash_%';
UPDATE public.tickets SET payment_method = 'free' WHERE payment_id LIKE 'free_%';
ALTER TABLE public.customers
  ADD COLUMN contact_name text,
  ADD COLUMN contact_whatsapp text;

-- Add payment_gateway column to franchises (asaas, pagbank, mercadopago)
ALTER TABLE public.franchises 
ADD COLUMN IF NOT EXISTS payment_gateway text NOT NULL DEFAULT 'asaas';

-- Add pagbank_token column to franchises
ALTER TABLE public.franchises 
ADD COLUMN IF NOT EXISTS pagbank_token text;
UPDATE public.franchises SET payment_gateway = 'asaas', updated_at = now() WHERE id = '29cef237-f25c-40e8-b6cb-cca50da6561b';

-- Allow service role (edge functions) to update tickets
-- This is needed for payment status updates from edge functions
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;

-- Policy to allow service role bypass (edge functions use service role key)
-- In Supabase, service role bypasses RLS by default, but we need to ensure
-- the tickets table allows updates via authenticated operations
CREATE POLICY "Service role can update tickets"
  ON public.tickets
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- Also allow franchise owners to update their tickets
CREATE POLICY "Franchise owners can update their franchise tickets"
  ON public.tickets
  FOR UPDATE
  USING (franchise_id = get_user_franchise(auth.uid()));
ALTER TABLE public.commission_beneficiaries ADD COLUMN pix_key text, ADD COLUMN pix_key_type text;
ALTER TABLE public.customers ADD COLUMN pix_key text, ADD COLUMN pix_key_type text;

-- Add collaborator role to app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'collaborator';

-- Add user_id to commission_beneficiaries to link to auth user
ALTER TABLE public.commission_beneficiaries ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- Add beneficiary_id to commission_payouts for RLS filtering
ALTER TABLE public.commission_payouts ADD COLUMN IF NOT EXISTS beneficiary_id uuid;

-- Add RLS policy: collaborators can view their own beneficiary record
CREATE POLICY "Collaborators can view their own beneficiary"
ON public.commission_beneficiaries
FOR SELECT
USING (user_id = auth.uid());

-- Add RLS policy: collaborators can update their own beneficiary (for PIX key)
CREATE POLICY "Collaborators can update their own beneficiary"
ON public.commission_beneficiaries
FOR UPDATE
USING (user_id = auth.uid());

-- Add RLS policy: collaborators can view their own commission payouts
CREATE POLICY "Collaborators can view their own payouts"
ON public.commission_payouts
FOR SELECT
USING (
  beneficiary_id IN (
    SELECT id FROM public.commission_beneficiaries WHERE user_id = auth.uid()
  )
);

-- Update has_role function to support collaborator role (already works since it uses the enum)
-- No changes needed to has_role function

-- Add a helper function to get the beneficiary_id for the current collaborator
CREATE OR REPLACE FUNCTION public.get_user_beneficiary(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.commission_beneficiaries WHERE user_id = _user_id LIMIT 1
$$;

-- Add seller_id column to customers table
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS seller_id uuid REFERENCES public.commission_beneficiaries(id) ON DELETE SET NULL;

-- RLS: Collaborators can view customers linked to them (via their beneficiary record)
CREATE POLICY "Collaborators can view their customers"
ON public.customers
FOR SELECT
USING (
  seller_id IN (
    SELECT id FROM public.commission_beneficiaries WHERE user_id = auth.uid()
  )
);

-- RLS: Collaborators can insert customers linked to their beneficiary
CREATE POLICY "Collaborators can create customers for their franchise"
ON public.customers
FOR INSERT
WITH CHECK (
  franchise_id IN (
    SELECT franchise_id FROM public.commission_beneficiaries WHERE user_id = auth.uid()
  )
);

-- RLS: Collaborators can update their own customers
CREATE POLICY "Collaborators can update their customers"
ON public.customers
FOR UPDATE
USING (
  seller_id IN (
    SELECT id FROM public.commission_beneficiaries WHERE user_id = auth.uid()
  )
);

-- Allow collaborators to INSERT events for their franchise (only via their linked beneficiary/franchise)
CREATE POLICY "Collaborators can create events for their franchise"
ON public.events
FOR INSERT
WITH CHECK (
  franchise_id IN (
    SELECT franchise_id FROM public.commission_beneficiaries
    WHERE user_id = auth.uid()
  )
);

-- Allow collaborators to view events from their franchise
CREATE POLICY "Collaborators can view events from their franchise"
ON public.events
FOR SELECT
USING (
  franchise_id IN (
    SELECT franchise_id FROM public.commission_beneficiaries
    WHERE user_id = auth.uid()
  )
);

-- Allow collaborators to update events where they are the seller
CREATE POLICY "Collaborators can update their events"
ON public.events
FOR UPDATE
USING (
  seller_id IN (
    SELECT id FROM public.commission_beneficiaries
    WHERE user_id = auth.uid()
  )
);

-- Allow collaborators to manage event_grades for events in their franchise
CREATE POLICY "Collaborators can manage event grades for their franchise events"
ON public.event_grades
FOR INSERT
WITH CHECK (
  event_id IN (
    SELECT e.id FROM public.events e
    JOIN public.commission_beneficiaries cb ON cb.franchise_id = e.franchise_id
    WHERE cb.user_id = auth.uid()
  )
);

CREATE POLICY "Admins can delete tickets"
ON public.tickets FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Franchise owners can delete their franchise tickets"
ON public.tickets FOR DELETE
USING (franchise_id = get_user_franchise(auth.uid()));

-- Drop the overly permissive policy that shows ALL franchise events to collaborators
DROP POLICY IF EXISTS "Collaborators can view events from their franchise" ON public.events;

-- New policy: collaborators only see events where they are assigned as seller
CREATE POLICY "Collaborators can view their own events"
ON public.events
FOR SELECT
USING (
  seller_id IN (
    SELECT id FROM public.commission_beneficiaries
    WHERE user_id = auth.uid()
  )
);
ALTER TABLE public.commission_beneficiaries ADD COLUMN IF NOT EXISTS whatsapp text;

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS must_change_password boolean NOT NULL DEFAULT false;
CREATE POLICY "Collaborators can delete their own events"
ON public.events
FOR DELETE
USING (
  seller_id IN (
    SELECT id FROM public.commission_beneficiaries
    WHERE user_id = auth.uid()
  )
);
CREATE POLICY "Collaborators can create grades"
ON public.grades
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.commission_beneficiaries
    WHERE user_id = auth.uid()
  )
);
CREATE POLICY "Collaborators can delete tickets from their own events"
ON public.tickets
FOR DELETE
USING (
  event_id IN (
    SELECT id FROM public.events
    WHERE seller_id IN (
      SELECT id FROM public.commission_beneficiaries
      WHERE user_id = auth.uid()
    )
  )
);
CREATE POLICY "Collaborators can view tickets from their own events"
ON public.tickets
FOR SELECT
USING (
  event_id IN (
    SELECT id FROM public.events
    WHERE seller_id IN (
      SELECT id FROM public.commission_beneficiaries
      WHERE user_id = auth.uid()
    )
  )
);
-- Permite colaboradores verem event_grades dos seus prÃ³prios eventos (mesmo inativos)
CREATE POLICY "Collaborators can view event grades for their own events"
ON public.event_grades
FOR SELECT
USING (
  event_id IN (
    SELECT id FROM public.events
    WHERE seller_id IN (
      SELECT id FROM public.commission_beneficiaries
      WHERE user_id = auth.uid()
    )
  )
);
DROP POLICY IF EXISTS "Anyone can view active customers" ON public.customers;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS event_end_time time without time zone;

-- Drop existing collaborator policies on events that only check seller_id
DROP POLICY IF EXISTS "Collaborators can view their own events" ON public.events;
DROP POLICY IF EXISTS "Collaborators can update their events" ON public.events;
DROP POLICY IF EXISTS "Collaborators can delete their own events" ON public.events;

-- Recreate with seller_id OR presenter_id OR supervisor_id
CREATE POLICY "Collaborators can view their own events"
ON public.events FOR SELECT
USING (
  seller_id IN (SELECT id FROM commission_beneficiaries WHERE user_id = auth.uid())
  OR presenter_id IN (SELECT id FROM commission_beneficiaries WHERE user_id = auth.uid())
  OR supervisor_id IN (SELECT id FROM commission_beneficiaries WHERE user_id = auth.uid())
);

CREATE POLICY "Collaborators can update their events"
ON public.events FOR UPDATE
USING (
  seller_id IN (SELECT id FROM commission_beneficiaries WHERE user_id = auth.uid())
  OR presenter_id IN (SELECT id FROM commission_beneficiaries WHERE user_id = auth.uid())
  OR supervisor_id IN (SELECT id FROM commission_beneficiaries WHERE user_id = auth.uid())
);

CREATE POLICY "Collaborators can delete their own events"
ON public.events FOR DELETE
USING (
  seller_id IN (SELECT id FROM commission_beneficiaries WHERE user_id = auth.uid())
);

-- Also update tickets policies so presenters/supervisors can view tickets from their events
DROP POLICY IF EXISTS "Collaborators can view tickets from their own events" ON public.tickets;
DROP POLICY IF EXISTS "Collaborators can delete tickets from their own events" ON public.tickets;

CREATE POLICY "Collaborators can view tickets from their own events"
ON public.tickets FOR SELECT
USING (
  event_id IN (
    SELECT id FROM events WHERE
      seller_id IN (SELECT id FROM commission_beneficiaries WHERE user_id = auth.uid())
      OR presenter_id IN (SELECT id FROM commission_beneficiaries WHERE user_id = auth.uid())
      OR supervisor_id IN (SELECT id FROM commission_beneficiaries WHERE user_id = auth.uid())
  )
);

CREATE POLICY "Collaborators can delete tickets from their own events"
ON public.tickets FOR DELETE
USING (
  event_id IN (
    SELECT id FROM events WHERE
      seller_id IN (SELECT id FROM commission_beneficiaries WHERE user_id = auth.uid())
  )
);

-- Create a cron job to cleanup pending tickets every hour
SELECT cron.schedule(
  'cleanup-pending-tickets',
  '0 * * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'supabase_url' LIMIT 1) || '/functions/v1/cleanup-pending-tickets',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'supabase_service_role_key' LIMIT 1)
    ),
    body := '{}'::jsonb
  );
  $$
);

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE TABLE public.email_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_id UUID REFERENCES public.tickets(id) ON DELETE SET NULL,
  franchise_id UUID REFERENCES public.franchises(id) ON DELETE SET NULL,
  recipient_email TEXT NOT NULL,
  email_type TEXT NOT NULL,
  subject TEXT,
  status TEXT NOT NULL DEFAULT 'sent',
  error_message TEXT,
  sent_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage all email logs"
  ON public.email_logs FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Franchise owners can view their email logs"
  ON public.email_logs FOR SELECT
  USING (franchise_id = get_user_franchise(auth.uid()));

CREATE INDEX idx_email_logs_franchise_id ON public.email_logs(franchise_id);
CREATE INDEX idx_email_logs_ticket_id ON public.email_logs(ticket_id);
CREATE INDEX idx_email_logs_sent_at ON public.email_logs(sent_at DESC);

INSERT INTO storage.buckets (id, name, public) VALUES ('email-assets', 'email-assets', true);
CREATE POLICY "Public read email-assets" ON storage.objects FOR SELECT USING (bucket_id = 'email-assets');
ALTER TABLE public.email_logs ADD COLUMN IF NOT EXISTS cc_email text;

-- Add new roles to app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'atendente';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'desenvolvedor';

-- Create exec_sql function (bridge for migrations/connectivity - service_role only)
CREATE OR REPLACE FUNCTION public.exec_sql(sql_query text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog', 'information_schema', 'auth', 'storage'
AS $$
DECLARE
  result json;
  caller_role text;
  clean_query text;
BEGIN
  caller_role := current_setting('request.jwt.claims', true)::json->>'role';

  IF caller_role IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Acesso negado: apenas service_role pode executar esta funÃ§Ã£o.';
  END IF;

  clean_query := rtrim(sql_query, '; ');

  EXECUTE 'SELECT json_agg(row_to_json(t)) FROM (' || clean_query || ') t' INTO result;

  RETURN COALESCE(result, '[]'::json);
END;
$$;
ALTER TABLE public.franchises
  ADD COLUMN IF NOT EXISTS default_seller_commission_pct numeric DEFAULT 25,
  ADD COLUMN IF NOT EXISTS default_presenter_commission_pct numeric DEFAULT 20,
  ADD COLUMN IF NOT EXISTS default_supervisor_commission_pct numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS default_school_commission_pct numeric DEFAULT 10;
-- Step 1: Remove duplicates, keeping oldest per (event_id, custom_grade_name)
DELETE FROM public.event_grades
WHERE id NOT IN (
  SELECT DISTINCT ON (event_id, COALESCE(custom_grade_name, ''), COALESCE(grade_id, '00000000-0000-0000-0000-000000000000'))
    id
  FROM public.event_grades
  ORDER BY event_id, COALESCE(custom_grade_name, ''), COALESCE(grade_id, '00000000-0000-0000-0000-000000000000'), created_at ASC
);

-- Step 2: Add unique constraint to prevent future duplicates
CREATE UNIQUE INDEX idx_event_grades_unique_custom 
ON public.event_grades (event_id, custom_grade_name) 
WHERE custom_grade_name IS NOT NULL;

CREATE UNIQUE INDEX idx_event_grades_unique_grade 
ON public.event_grades (event_id, grade_id) 
WHERE grade_id IS NOT NULL;
ALTER TABLE public.customers ADD COLUMN classification text DEFAULT NULL;

-- Add trigger function for new users to receive 'atendente' role
CREATE OR REPLACE FUNCTION public.handle_new_user_role()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'atendente')
  ON CONFLICT (user_id, role) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_role ON auth.users;
CREATE TRIGGER on_auth_user_created_role
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_role();
CREATE TABLE public.import_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  entity_name text NOT NULL,
  file_name text,
  total_rows integer NOT NULL DEFAULT 0,
  new_count integer NOT NULL DEFAULT 0,
  update_count integer NOT NULL DEFAULT 0,
  error_count integer NOT NULL DEFAULT 0,
  imported_by uuid,
  franchise_id uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.import_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage all import logs"
ON public.import_logs
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Franchise owners can view their import logs"
ON public.import_logs
FOR SELECT
USING (franchise_id = get_user_franchise(auth.uid()));

CREATE POLICY "Authenticated users can create import logs"
ON public.import_logs
FOR INSERT
TO authenticated
WITH CHECK (imported_by = auth.uid());
