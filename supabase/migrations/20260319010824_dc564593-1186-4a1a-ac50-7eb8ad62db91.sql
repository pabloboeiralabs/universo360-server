
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
