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