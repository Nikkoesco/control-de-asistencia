-- Create colonies table for organizing students into groups
CREATE TABLE IF NOT EXISTS public.colonies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create colony_students table to link students to colonies
CREATE TABLE IF NOT EXISTS public.colony_students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  colony_id UUID REFERENCES public.colonies(id) ON DELETE CASCADE,
  student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,
  registration_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(colony_id, student_id)
);

-- Create colony_attendance table for tracking attendance by colony
CREATE TABLE IF NOT EXISTS public.colony_attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  colony_id UUID REFERENCES public.colonies(id) ON DELETE CASCADE,
  student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'present' CHECK (status IN ('present', 'absent', 'late')),
  notes TEXT,
  marked_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(colony_id, student_id, date)
);

-- Create excel_imports table to track colony-specific Excel imports
CREATE TABLE IF NOT EXISTS public.excel_imports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  colony_id UUID REFERENCES public.colonies(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  total_records INTEGER,
  successful_imports INTEGER,
  failed_imports INTEGER,
  column_mapping JSONB, -- Store which columns were selected and mapped
  imported_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_colony_students_colony_id ON public.colony_students(colony_id);
CREATE INDEX IF NOT EXISTS idx_colony_students_student_id ON public.colony_students(student_id);
CREATE INDEX IF NOT EXISTS idx_colony_attendance_colony_date ON public.colony_attendance(colony_id, date);
CREATE INDEX IF NOT EXISTS idx_colony_attendance_student_date ON public.colony_attendance(student_id, date);
