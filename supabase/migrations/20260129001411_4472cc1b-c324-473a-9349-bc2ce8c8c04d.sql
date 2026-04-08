-- Add shift column to tickets table for morning/afternoon selection
ALTER TABLE public.tickets 
ADD COLUMN shift text NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.tickets.shift IS 'Student shift: morning (manhã) or afternoon (tarde)';