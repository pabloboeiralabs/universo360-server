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