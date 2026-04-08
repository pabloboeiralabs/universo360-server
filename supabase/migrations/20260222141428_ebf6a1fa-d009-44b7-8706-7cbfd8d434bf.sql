
ALTER TABLE public.tickets ADD COLUMN payment_method text;

UPDATE public.tickets SET payment_method = 'cash' WHERE payment_id LIKE 'cash_%';
UPDATE public.tickets SET payment_method = 'free' WHERE payment_id LIKE 'free_%';
