-- Add school-specific columns to tickets table
ALTER TABLE public.tickets 
  ADD COLUMN IF NOT EXISTS student_name TEXT,
  ADD COLUMN IF NOT EXISTS class_grade TEXT,
  ADD COLUMN IF NOT EXISTS parent_name TEXT;