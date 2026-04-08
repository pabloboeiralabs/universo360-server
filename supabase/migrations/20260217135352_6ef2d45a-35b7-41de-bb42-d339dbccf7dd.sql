
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
