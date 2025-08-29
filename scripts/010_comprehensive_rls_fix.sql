-- Script COMPLETO para diagnosticar y corregir TODAS las políticas RLS problemáticas
-- Este script revisa y corrige la recursión infinita en todas las tablas relacionadas

-- ========================================
-- PASO 1: DIAGNÓSTICO
-- ========================================

DO $$
DECLARE
    r RECORD;
BEGIN
    RAISE NOTICE '=== DIAGNÓSTICO DE POLÍTICAS RLS ===';
    
    -- Verificar qué políticas existen
    RAISE NOTICE 'Políticas existentes en colonies:';
    FOR r IN SELECT policyname FROM pg_policies WHERE tablename = 'colonies' LOOP
        RAISE NOTICE '- %', r.policyname;
    END LOOP;
    
    RAISE NOTICE 'Políticas existentes en colony_students:';
    FOR r IN SELECT policyname FROM pg_policies WHERE tablename = 'colony_students' LOOP
        RAISE NOTICE '- %', r.policyname;
    END LOOP;
    
    RAISE NOTICE 'Políticas existentes en colony_attendance:';
    FOR r IN SELECT policyname FROM pg_policies WHERE tablename = 'colony_attendance' LOOP
        RAISE NOTICE '- %', r.policyname;
    END LOOP;
    
    RAISE NOTICE 'Políticas existentes en excel_imports:';
    FOR r IN SELECT policyname FROM pg_policies WHERE tablename = 'excel_imports' LOOP
        RAISE NOTICE '- %', r.policyname;
    END LOOP;
    
    RAISE NOTICE 'Políticas existentes en profiles:';
    FOR r IN SELECT policyname FROM pg_policies WHERE tablename = 'profiles' LOOP
        RAISE NOTICE '- %', r.policyname;
    END LOOP;
END $$;

-- ========================================
-- PASO 2: ELIMINAR TODAS LAS POLÍTICAS PROBLEMÁTICAS
-- ========================================

-- Eliminar TODAS las políticas de colonias (las recrearemos)
DROP POLICY IF EXISTS "Users can view colonies they created" ON public.colonies;
DROP POLICY IF EXISTS "Users can create colonies" ON public.colonies;
DROP POLICY IF EXISTS "Users can update colonies they created" ON public.colonies;
DROP POLICY IF EXISTS "Users can delete colonies they created" ON public.colonies;
DROP POLICY IF EXISTS "Admins can access all colonies" ON public.colonies;

-- Eliminar TODAS las políticas de colony_students
DROP POLICY IF EXISTS "Users can view students in colonies they created" ON public.colony_students;
DROP POLICY IF EXISTS "Users can add students to colonies they created" ON public.colony_students;
DROP POLICY IF EXISTS "Users can update students in colonies they created" ON public.colony_students;
DROP POLICY IF EXISTS "Users can delete students from colonies they created" ON public.colony_students;
DROP POLICY IF EXISTS "Admins can access all colony students" ON public.colony_students;

-- Eliminar TODAS las políticas de colony_attendance
DROP POLICY IF EXISTS "Users can view attendance in colonies they created" ON public.colony_attendance;
DROP POLICY IF EXISTS "Users can create attendance in colonies they created" ON public.colony_attendance;
DROP POLICY IF EXISTS "Users can update attendance in colonies they created" ON public.colony_attendance;
DROP POLICY IF EXISTS "Users can delete attendance from colonies they created" ON public.colony_attendance;
DROP POLICY IF EXISTS "Admins can access all colony attendance" ON public.colony_attendance;

-- Eliminar TODAS las políticas de excel_imports
DROP POLICY IF EXISTS "Users can view imports for colonies they created" ON public.excel_imports;
DROP POLICY IF EXISTS "Users can create imports for colonies they created" ON public.excel_imports;
DROP POLICY IF EXISTS "Admins can access all excel imports" ON public.excel_imports;

-- ========================================
-- PASO 3: CREAR POLÍTICAS CORREGIDAS SIN RECURSIÓN
-- ========================================

-- Políticas para colonies (usando auth.uid() directamente)
CREATE POLICY "Users can view colonies they created" ON public.colonies
  FOR SELECT USING (auth.uid() = created_by);

CREATE POLICY "Users can create colonies" ON public.colonies
  FOR INSERT WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update colonies they created" ON public.colonies
  FOR UPDATE USING (auth.uid() = created_by);

CREATE POLICY "Users can delete colonies they created" ON public.colonies
  FOR DELETE USING (auth.uid() = created_by);

-- Políticas para colony_students (usando JOIN directo sin subconsultas)
CREATE POLICY "Users can view students in colonies they created" ON public.colony_students
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.colonies 
      WHERE id = colony_students.colony_id 
      AND created_by = auth.uid()
    )
  );

CREATE POLICY "Users can add students to colonies they created" ON public.colony_students
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.colonies 
      WHERE id = colony_students.colony_id 
      AND created_by = auth.uid()
    )
  );

CREATE POLICY "Users can update students in colonies they created" ON public.colony_students
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.colonies 
      WHERE id = colony_students.colony_id 
      AND created_by = auth.uid()
    )
  );

CREATE POLICY "Users can delete students from colonies they created" ON public.colony_students
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.colonies 
      WHERE id = colony_students.colony_id 
      AND created_by = auth.uid()
    )
  );

-- Políticas para colony_attendance
CREATE POLICY "Users can view attendance in colonies they created" ON public.colony_attendance
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.colonies 
      WHERE id = colony_attendance.colony_id 
      AND created_by = auth.uid()
    )
  );

CREATE POLICY "Users can create attendance in colonies they created" ON public.colony_attendance
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.colonies 
      WHERE id = colony_attendance.colony_id 
      AND created_by = auth.uid()
    )
  );

CREATE POLICY "Users can update attendance in colonies they created" ON public.colony_attendance
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.colonies 
      WHERE id = colony_attendance.colony_id 
      AND created_by = auth.uid()
    )
  );

CREATE POLICY "Users can delete attendance from colonies they created" ON public.colony_attendance
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.colonies 
      WHERE id = colony_attendance.colony_id 
      AND created_by = auth.uid()
    )
  );

-- Políticas para excel_imports
CREATE POLICY "Users can view imports for colonies they created" ON public.excel_imports
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.colonies 
      WHERE id = excel_imports.colony_id 
      AND created_by = auth.uid()
    )
  );

CREATE POLICY "Users can create imports for colonies they created" ON public.excel_imports
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.colonies 
      WHERE id = excel_imports.colony_id 
      AND created_by = auth.uid()
    )
  );

-- ========================================
-- PASO 4: POLÍTICAS DE ADMINISTRADOR (SIN RECURSIÓN)
-- ========================================

-- Políticas de admin usando auth.jwt() directamente
CREATE POLICY "Admins can access all colonies" ON public.colonies
  FOR ALL USING (
    (auth.jwt() ->> 'role')::text = 'admin'
  );

CREATE POLICY "Admins can access all colony students" ON public.colony_students
  FOR ALL USING (
    (auth.jwt() ->> 'role')::text = 'admin'
  );

CREATE POLICY "Admins can access all colony attendance" ON public.colony_attendance
  FOR ALL USING (
    (auth.jwt() ->> 'role')::text = 'admin'
  );

CREATE POLICY "Admins can access all excel imports" ON public.excel_imports
  FOR ALL USING (
    (auth.jwt() ->> 'role')::text = 'admin'
  );

-- ========================================
-- PASO 5: VERIFICACIÓN FINAL
-- ========================================

DO $$
BEGIN
    RAISE NOTICE '=== VERIFICACIÓN FINAL ===';
    RAISE NOTICE 'Todas las políticas RLS han sido recreadas sin recursión';
    RAISE NOTICE 'Las políticas ahora usan auth.uid() y auth.jwt() directamente';
    RAISE NOTICE 'No hay consultas a la tabla profiles que puedan causar recursión';
    RAISE NOTICE 'El sistema debería funcionar correctamente ahora';
END $$;

-- Mostrar las políticas finales
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename IN ('colonies', 'colony_students', 'colony_attendance', 'excel_imports')
ORDER BY tablename, policyname;
