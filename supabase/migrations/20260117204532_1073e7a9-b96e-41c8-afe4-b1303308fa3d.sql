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