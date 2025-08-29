-- SCRIPT: Corrección de Estructura para Estudiantes Duplicados

-- Eliminar la restricción única en student_id que causa problemas
ALTER TABLE public.students DROP CONSTRAINT IF EXISTS students_student_id_key;

-- Agregar campo temporada a colony_students
ALTER TABLE public.colony_students 
ADD COLUMN IF NOT EXISTS season TEXT DEFAULT '2024-2025';

-- Agregar campo para notas o información adicional
ALTER TABLE public.colony_students 
ADD COLUMN IF NOT EXISTS notes TEXT;

-- Crear índice compuesto para mejor rendimiento
CREATE INDEX IF NOT EXISTS idx_colony_students_colony_season 
ON public.colony_students(colony_id, season);

-- Crear tabla para gestionar temporadas académicas
CREATE TABLE IF NOT EXISTS public.seasons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insertar temporada por defecto
INSERT INTO public.seasons (name, start_date, end_date, is_active)
VALUES ('2024-2025', '2024-08-01', '2025-07-31', true)
ON CONFLICT (name) DO NOTHING;

-- Script para limpiar y modificar la tabla students según los nuevos requerimientos
-- Ejecuta esto en tu base de datos Supabase

-- 1. Eliminar campos que ya no se necesitan
ALTER TABLE public.students 
DROP COLUMN IF EXISTS email,
DROP COLUMN IF EXISTS grade,
DROP COLUMN IF EXISTS section,
DROP COLUMN IF EXISTS last_name;

-- 2. Agregar los campos necesarios si no existen
ALTER TABLE public.students 
ADD COLUMN IF NOT EXISTS colony_id UUID REFERENCES public.colonies(id),
ADD COLUMN IF NOT EXISTS season TEXT;

-- 3. Hacer el campo season obligatorio
ALTER TABLE public.students ALTER COLUMN season SET NOT NULL;

-- 4. Agregar un valor por defecto para season en registros existentes
UPDATE public.students SET season = '2024-2025' WHERE season IS NULL;

-- 5. Crear índices para mejor rendimiento
CREATE INDEX IF NOT EXISTS idx_students_colony_id ON public.students(colony_id);
CREATE INDEX IF NOT EXISTS idx_students_season ON public.students(season);
CREATE INDEX IF NOT EXISTS idx_students_colony_season ON public.students(colony_id, season);

-- 6. ELIMINAR la restricción existente antes de crearla nuevamente
ALTER TABLE public.students 
DROP CONSTRAINT IF EXISTS unique_student_colony_season;

-- 7. Crear la restricción única para evitar duplicados por colonia-temporada
ALTER TABLE public.students 
ADD CONSTRAINT unique_student_colony_season 
UNIQUE (student_id, colony_id, season);

-- 8. Verificar que la tabla tenga la estructura correcta
SELECT 
  column_name, 
  data_type, 
  is_nullable, 
  column_default
FROM information_schema.columns 
WHERE table_name = 'students' 
ORDER BY ordinal_position;
