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