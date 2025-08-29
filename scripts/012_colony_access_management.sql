-- SCRIPT: Gestión de Acceso a Colonias con Códigos Únicos

-- Agregar campo colony_code único a la tabla colonies
ALTER TABLE public.colonies 
ADD COLUMN IF NOT EXISTS colony_code TEXT UNIQUE;

-- Crear tabla para controlar qué colonias puede ver cada usuario
CREATE TABLE IF NOT EXISTS public.user_colony_access (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    colony_id UUID REFERENCES public.colonies(id) ON DELETE CASCADE,
    access_level TEXT NOT NULL DEFAULT 'view' CHECK (access_level IN ('view', 'edit', 'admin')),
    granted_by UUID REFERENCES public.profiles(id),
    granted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, colony_id)
);

-- Crear índices para mejor rendimiento
CREATE INDEX IF NOT EXISTS idx_user_colony_access_user_id ON public.user_colony_access(user_id);
CREATE INDEX IF NOT EXISTS idx_user_colony_access_colony_id ON public.user_colony_access(colony_id);

-- Función para verificar que el código de colonia sea único
CREATE OR REPLACE FUNCTION validate_colony_code()
RETURNS TRIGGER AS $$
BEGIN
    -- Si no se proporciona código, generar uno automático
    IF NEW.colony_code IS NULL OR NEW.colony_code = '' THEN
        NEW.colony_code := 'COL-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || gen_random_uuid()::TEXT;
    END IF;
    
    -- Verificar que el código sea único
    IF EXISTS (SELECT 1 FROM public.colonies WHERE colony_code = NEW.colony_code AND id != NEW.id) THEN
        RAISE EXCEPTION 'El código de colonia "%" ya existe. Por favor, elige otro código.', NEW.colony_code;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Crear trigger para validar código único
DROP TRIGGER IF EXISTS trigger_validate_colony_code ON public.colonies;
CREATE TRIGGER trigger_validate_colony_code
    BEFORE INSERT OR UPDATE ON public.colonies
    FOR EACH ROW
    EXECUTE FUNCTION validate_colony_code();

-- Función para verificar si un usuario tiene acceso a una colonia
CREATE OR REPLACE FUNCTION user_has_colony_access(user_uuid UUID, target_colony_id UUID, required_level TEXT DEFAULT 'view')
RETURNS BOOLEAN AS $$
BEGIN
    -- Los admins tienen acceso a todo
    IF EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = user_uuid AND role = 'admin'
    ) THEN
        RETURN TRUE;
    END IF;
    
    -- Verificar acceso específico a la colonia
    IF EXISTS (
        SELECT 1 FROM public.user_colony_access uca
        WHERE uca.user_id = user_uuid 
        AND uca.colony_id = target_colony_id
        AND (
            (required_level = 'view' AND uca.access_level IN ('view', 'edit', 'admin')) OR
            (required_level = 'edit' AND uca.access_level IN ('edit', 'admin')) OR
            (required_level = 'admin' AND uca.access_level = 'admin')
        )
    ) THEN
        RETURN TRUE;
    END IF;
    
    -- Usuarios pueden ver colonias que crearon
    IF EXISTS (
        SELECT 1 FROM public.colonies 
        WHERE id = target_colony_id AND created_by = user_uuid
    ) THEN
        RETURN TRUE;
    END IF;
    
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Actualizar políticas RLS para el nuevo sistema
-- Deshabilitar RLS temporalmente para actualizar políticas
ALTER TABLE public.colonies DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.colony_students DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.colony_attendance DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.excel_imports DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_colony_access DISABLE ROW LEVEL SECURITY;

-- Eliminar políticas existentes
DROP POLICY IF EXISTS "Users can view colonies they created" ON public.colonies;
DROP POLICY IF EXISTS "Users can create colonies" ON public.colonies;
DROP POLICY IF EXISTS "Users can update colonies they created" ON public.colonies;
DROP POLICY IF EXISTS "Users can delete colonies they created" ON public.colonies;

-- Crear nuevas políticas para colonies
CREATE POLICY "Users can view accessible colonies" ON public.colonies
    FOR SELECT USING (
        user_has_colony_access(auth.uid(), id, 'view')
    );

CREATE POLICY "Users can create colonies" ON public.colonies
    FOR INSERT WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update accessible colonies" ON public.colonies
    FOR UPDATE USING (
        user_has_colony_access(auth.uid(), id, 'edit') OR
        created_by = auth.uid()
    );

CREATE POLICY "Users can delete colonies they created" ON public.colonies
    FOR DELETE USING (created_by = auth.uid());

-- Políticas para colony_students
CREATE POLICY "Users can view students in accessible colonies" ON public.colony_students
    FOR SELECT USING (
        user_has_colony_access(auth.uid(), colony_id, 'view')
    );

CREATE POLICY "Users can manage students in accessible colonies" ON public.colony_students
    FOR ALL USING (
        user_has_colony_access(auth.uid(), colony_id, 'edit') OR
        EXISTS (
            SELECT 1 FROM public.colonies 
            WHERE id = colony_id AND created_by = auth.uid()
        )
    );

-- Políticas para colony_attendance
CREATE POLICY "Users can view attendance in accessible colonies" ON public.colony_attendance
    FOR SELECT USING (
        user_has_colony_access(auth.uid(), colony_id, 'view')
    );

CREATE POLICY "Users can manage attendance in accessible colonies" ON public.colony_attendance
    FOR ALL USING (
        user_has_colony_access(auth.uid(), colony_id, 'edit') OR
        EXISTS (
            SELECT 1 FROM public.colonies 
            WHERE id = colony_id AND created_by = auth.uid()
        )
    );

-- Políticas para excel_imports
CREATE POLICY "Users can view imports for accessible colonies" ON public.excel_imports
    FOR SELECT USING (
        user_has_colony_access(auth.uid(), colony_id, 'view')
    );

CREATE POLICY "Users can create imports for accessible colonies" ON public.excel_imports
    FOR INSERT WITH CHECK (
        user_has_colony_access(auth.uid(), colony_id, 'edit') OR
        EXISTS (
            SELECT 1 FROM public.colonies 
            WHERE id = colony_id AND created_by = auth.uid()
        )
    );

-- Políticas para user_colony_access
CREATE POLICY "Admins can manage all colony access" ON public.user_colony_access
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

CREATE POLICY "Users can view their own colony access" ON public.user_colony_access
    FOR SELECT USING (user_id = auth.uid());

-- Habilitar RLS nuevamente
ALTER TABLE public.colonies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.colony_students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.colony_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.excel_imports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_colony_access ENABLE ROW LEVEL SECURITY;

-- Actualizar colonias existentes que no tengan código con códigos únicos
UPDATE public.colonies 
SET colony_code = 'COL-' || TO_CHAR(created_at, 'YYYYMMDD') || '-' || gen_random_uuid()::TEXT
WHERE colony_code IS NULL OR colony_code = '';

-- ========================================
-- VERIFICACIÓN FINAL
-- ========================================

DO $$
BEGIN
    RAISE NOTICE '=== VERIFICACIÓN DE IMPLEMENTACIÓN ===';
    RAISE NOTICE '✅ Campo colony_code agregado a la tabla colonies';
    RAISE NOTICE '✅ Tabla user_colony_access creada';
    RAISE NOTICE '✅ Función validate_colony_code creada';
    RAISE NOTICE '✅ Función user_has_colony_access creada';
    RAISE NOTICE '✅ Políticas RLS actualizadas';
    RAISE NOTICE '✅ Sistema de gestión de acceso implementado';
    RAISE NOTICE '';
    RAISE NOTICE 'Para usar el sistema:';
    RAISE NOTICE '1. Los admins pueden asignar acceso a colonias usando:';
    RAISE NOTICE '   INSERT INTO user_colony_access (user_id, colony_id, access_level, granted_by) VALUES (...);';
    RAISE NOTICE '2. Los usuarios solo verán colonias a las que tienen acceso';
    RAISE NOTICE '3. Puedes escribir manualmente el código de colonia o dejar que se genere automáticamente';
    RAISE NOTICE '4. Los niveles de acceso son: view, edit, admin';
END $$;

-- Mostrar estado final
SELECT 
    'colonies' as table_name,
    COUNT(*) as total_colonies,
    COUNT(colony_code) as colonies_with_code
FROM public.colonies

UNION ALL

SELECT 
    'user_colony_access' as table_name,
    COUNT(*) as total_access_records,
    0 as colonies_with_code
FROM public.user_colony_access;
