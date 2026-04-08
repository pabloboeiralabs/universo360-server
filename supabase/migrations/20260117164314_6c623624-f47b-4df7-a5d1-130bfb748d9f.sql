
-- 1. Adicionar campo CPF na tabela customers
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS cpf text;

-- 2. Criar tabela de séries/turmas globais
CREATE TABLE public.grades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  display_order integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.grades ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para grades
CREATE POLICY "Anyone can view active grades" ON public.grades
  FOR SELECT USING (is_active = true);

CREATE POLICY "Admins can manage all grades" ON public.grades
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Franchise owners can view grades" ON public.grades
  FOR SELECT USING (true);

-- Inserir séries padrão
INSERT INTO public.grades (name, display_order) VALUES
  ('Maternal', 1),
  ('Pré 1', 2),
  ('Pré 2', 3),
  ('1º ano', 4),
  ('2º ano', 5),
  ('3º ano', 6),
  ('4º ano', 7),
  ('5º ano', 8),
  ('6º ano', 9),
  ('7º ano', 10),
  ('8º ano', 11),
  ('9º ano', 12);

-- 3. Criar tabela de séries por evento
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

-- Políticas RLS para event_grades
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
