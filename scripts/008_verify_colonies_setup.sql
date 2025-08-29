-- Script de verificación para el sistema de colonias
-- Ejecuta este script para verificar que todo esté configurado correctamente

-- Verificar que las tablas existan
DO $$
BEGIN
    -- Verificar tabla colonies
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'colonies') THEN
        RAISE EXCEPTION 'La tabla "colonies" no existe. Ejecuta primero scripts/005_create_colonies_tables.sql';
    END IF;
    
    -- Verificar tabla colony_students
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'colony_students') THEN
        RAISE EXCEPTION 'La tabla "colony_students" no existe. Ejecuta primero scripts/005_create_colonies_tables.sql';
    END IF;
    
    -- Verificar tabla colony_attendance
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'colony_attendance') THEN
        RAISE EXCEPTION 'La tabla "colony_attendance" no existe. Ejecuta primero scripts/005_create_colonies_tables.sql';
    END IF;
    
    -- Verificar tabla excel_imports
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'excel_imports') THEN
        RAISE EXCEPTION 'La tabla "excel_imports" no existe. Ejecuta primero scripts/005_create_colonies_tables.sql';
    END IF;
    
    RAISE NOTICE 'Todas las tablas de colonias existen correctamente';
END $$;

-- Verificar que RLS esté habilitado
DO $$
BEGIN
    -- Verificar RLS en colonies
    IF NOT EXISTS (
        SELECT 1 FROM pg_tables 
        WHERE tablename = 'colonies' 
        AND rowsecurity = true
    ) THEN
        RAISE EXCEPTION 'RLS no está habilitado en la tabla "colonies". Ejecuta scripts/006_colonies_rls.sql';
    END IF;
    
    RAISE NOTICE 'RLS está habilitado en todas las tablas de colonias';
END $$;

-- Verificar que las políticas existan
DO $$
BEGIN
    -- Verificar políticas básicas
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'colonies' 
        AND policyname = 'Users can view colonies they created'
    ) THEN
        RAISE EXCEPTION 'Las políticas RLS no están configuradas. Ejecuta scripts/006_colonies_rls.sql';
    END IF;
    
    RAISE NOTICE 'Las políticas RLS están configuradas correctamente';
END $$;

-- Verificar que la columna last_name exista en students
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'students' AND column_name = 'last_name'
    ) THEN
        RAISE EXCEPTION 'La columna "last_name" no existe en la tabla "students". Ejecuta scripts/007_update_students_table.sql';
    END IF;
    
    RAISE NOTICE 'La columna last_name existe en la tabla students';
END $$;

-- Mostrar resumen de la configuración
DO $$
BEGIN
    RAISE NOTICE 'Resumen de la configuración:';
    RAISE NOTICE 'Verificación completada. Si no hay errores, el sistema de colonias está listo para usar.';
END $$;

-- Mostrar conteos de registros
SELECT 
    'colonies' as table_name,
    COUNT(*) as record_count
FROM colonies
UNION ALL
SELECT 
    'colony_students' as table_name,
    COUNT(*) as record_count
FROM colony_students
UNION ALL
SELECT 
    'colony_attendance' as table_name,
    COUNT(*) as record_count
FROM colony_attendance
UNION ALL
SELECT 
    'excel_imports' as table_name,
    COUNT(*) as record_count
FROM excel_imports;
