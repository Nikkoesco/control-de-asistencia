-- Copia y pega este script completo en el SQL Editor
-- Script para corregir la recursión infinita en las políticas RLS

-- Primero, eliminar las políticas problemáticas que causan recursión
DROP POLICY IF EXISTS "Admins can access all colonies" ON public.colonies;
DROP POLICY IF EXISTS "Admins can access all colony students" ON public.colony_students;
DROP POLICY IF EXISTS "Admins can access all colony attendance" ON public.colony_attendance;
DROP POLICY IF EXISTS "Admins can access all excel imports" ON public.excel_imports;

-- Crear políticas corregidas que eviten la recursión
-- Usar auth.jwt() en lugar de consultar la tabla profiles

-- Admin policies para colonies
CREATE POLICY "Admins can access all colonies" ON public.colonies
  FOR ALL USING (
    (auth.jwt() ->> 'role')::text = 'admin'
  );

-- Admin policies para colony_students
CREATE POLICY "Admins can access all colony students" ON public.colony_students
  FOR ALL USING (
    (auth.jwt() ->> 'role')::text = 'admin'
  );

-- Admin policies para colony_attendance
CREATE POLICY "Admins can access all colony attendance" ON public.colony_attendance
  FOR ALL USING (
    (auth.jwt() ->> 'role')::text = 'admin'
  );

-- Admin policies para excel_imports
CREATE POLICY "Admins can access all excel imports" ON public.excel_imports
  FOR ALL USING (
    (auth.jwt() ->> 'role')::text = 'admin'
  );

-- Verificar que las políticas se crearon correctamente
DO $$
BEGIN
    RAISE NOTICE 'Políticas RLS corregidas para evitar recursión infinita';
    RAISE NOTICE 'Las políticas ahora usan auth.jwt() en lugar de consultar la tabla profiles';
END $$;
