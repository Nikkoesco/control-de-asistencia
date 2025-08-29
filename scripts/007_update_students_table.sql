-- Add last_name column to existing students table if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'students' AND column_name = 'last_name'
    ) THEN
        ALTER TABLE public.students ADD COLUMN last_name TEXT;
    END IF;
END $$;

-- Update existing students to have empty last_name if it's null
UPDATE public.students SET last_name = '' WHERE last_name IS NULL;

-- Make last_name NOT NULL with default empty string
ALTER TABLE public.students ALTER COLUMN last_name SET NOT NULL;
ALTER TABLE public.students ALTER COLUMN last_name SET DEFAULT '';

-- Add index for better performance on last_name searches
CREATE INDEX IF NOT EXISTS idx_students_last_name ON public.students(last_name);
