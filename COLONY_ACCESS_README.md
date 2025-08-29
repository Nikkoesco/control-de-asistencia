# Sistema de Gestión de Acceso a Colonias

## Descripción

Este sistema permite a los administradores controlar qué colonias puede ver cada usuario del sistema. Cada colonia tiene un código único automático y los usuarios solo pueden acceder a las colonias que se les han asignado explícitamente.

## Características

### 1. Códigos Únicos de Colonia
- Puedes escribir manualmente el código de la colonia al crearla
- Si no escribes un código, se genera automáticamente uno único
- Formato automático: `COL-YYYYMMDD-UUID` (ejemplo: `COL-20241201-abc123`)
- Los códigos manuales deben ser únicos en todo el sistema

### 2. Niveles de Acceso
- **Ver (view)**: El usuario puede ver la colonia y su información
- **Editar (edit)**: El usuario puede ver y modificar la colonia
- **Administrar (admin)**: El usuario tiene control total sobre la colonia

### 3. Control de Acceso
- Los administradores pueden asignar acceso a cualquier usuario
- Los usuarios solo ven colonias a las que tienen acceso
- Los creadores de colonias mantienen acceso completo a sus colonias
- Los administradores tienen acceso a todas las colonias

## Implementación Técnica

### Base de Datos

#### Nueva Tabla: `user_colony_access`
```sql
CREATE TABLE public.user_colony_access (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    colony_id UUID REFERENCES public.colonies(id) ON DELETE CASCADE,
    access_level TEXT NOT NULL DEFAULT 'view' CHECK (access_level IN ('view', 'edit', 'admin')),
    granted_by UUID REFERENCES public.profiles(id),
    granted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, colony_id)
);
```

#### Campo Agregado a `colonies`
```sql
ALTER TABLE public.colonies ADD COLUMN colony_code TEXT UNIQUE;
```

### Funciones de PostgreSQL

#### `generate_colony_code()`
- Genera códigos únicos automáticamente
- Se ejecuta antes de cada inserción en la tabla `colonies`

#### `user_has_colony_access(user_uuid, target_colony_id, required_level)`
- Verifica si un usuario tiene acceso a una colonia específica
- Considera roles de administrador, acceso asignado y propiedad de la colonia

### Políticas RLS (Row Level Security)
- Todas las consultas están protegidas por políticas RLS
- Los usuarios solo ven datos de colonias a las que tienen acceso
- Los administradores pueden ver y gestionar todo

## Uso del Sistema

### Para Administradores

1. **Acceder al Panel de Administración**
   - Ir a `/admin` en la aplicación
   - Seleccionar la pestaña "Acceso a Colonias"

2. **Crear Nueva Colonia**
   - Hacer clic en "Nueva Colonia"
   - Escribir el nombre de la colonia (obligatorio)
   - Escribir el código de la colonia (opcional - se genera automáticamente si está vacío)
   - Escribir descripción (opcional)
   - Hacer clic en "Crear Colonia"

3. **Asignar Acceso a un Usuario**
   - Seleccionar el usuario del dropdown
   - Seleccionar la colonia del dropdown
   - Elegir el nivel de acceso (Ver, Editar, Administrar)
   - Hacer clic en "Conceder Acceso"

3. **Ver Accesos Actuales**
   - La lista muestra todos los usuarios y sus accesos
   - Se puede ver qué colonias puede acceder cada usuario

### Para Usuarios

- Los usuarios solo ven colonias a las que tienen acceso
- No pueden ver ni modificar colonias no asignadas
- Mantienen acceso completo a colonias que crearon

## Ejemplos de Uso

### Crear Nueva Colonia con Código Manual
```sql
INSERT INTO colonies (name, description, colony_code, created_by)
VALUES (
    'Colonia de Matemáticas',
    'Colonia para estudiantes avanzados en matemáticas',
    'MATH-2024',
    'uuid-del-usuario'
);
```

### Crear Nueva Colonia con Código Automático
```sql
INSERT INTO colonies (name, description, created_by)
VALUES (
    'Colonia de Ciencias',
    'Colonia para estudiantes de ciencias',
    'uuid-del-usuario'
);
-- El código se generará automáticamente
```

### Asignar Acceso a un Usuario
```sql
INSERT INTO user_colony_access (user_id, colony_id, access_level, granted_by)
VALUES (
    'uuid-del-usuario',
    'uuid-de-la-colonia',
    'view',
    'uuid-del-admin'
);
```

### Ver Colonias Accesibles por un Usuario
```sql
SELECT c.name, c.colony_code, uca.access_level
FROM user_colony_access uca
JOIN colonies c ON uca.colony_id = c.id
WHERE uca.user_id = 'uuid-del-usuario';
```

### Ver Usuarios con Acceso a una Colonia
```sql
SELECT p.full_name, p.email, uca.access_level
FROM user_colony_access uca
JOIN profiles p ON uca.user_id = p.id
WHERE uca.colony_id = 'uuid-de-la-colonia';
```

## Seguridad

### Políticas RLS Implementadas
- **colonies**: Solo usuarios con acceso pueden ver colonias
- **colony_students**: Solo usuarios con acceso pueden ver estudiantes
- **colony_attendance**: Solo usuarios con acceso pueden ver asistencia
- **excel_imports**: Solo usuarios con acceso pueden ver importaciones
- **user_colony_access**: Solo administradores pueden gestionar accesos

### Verificaciones de Seguridad
- Todas las consultas pasan por la función `user_has_colony_access()`
- Los usuarios no pueden escalar privilegios
- Los administradores mantienen control total

## Mantenimiento

### Scripts SQL
- `scripts/012_colony_access_management.sql`: Script principal de implementación
- Incluye creación de tablas, funciones, triggers y políticas RLS

### Verificación del Sistema
```sql
-- Verificar que todas las colonias tengan código
SELECT COUNT(*) as total_colonies, COUNT(colony_code) as colonies_with_code
FROM colonies;

-- Ver colonias con códigos manuales vs automáticos
SELECT 
    CASE 
        WHEN colony_code LIKE 'COL-%' THEN 'Automático'
        ELSE 'Manual'
    END as tipo_codigo,
    COUNT(*) as cantidad
FROM colonies 
GROUP BY tipo_codigo;

-- Verificar políticas RLS activas
SELECT tablename, rowsecurity, COUNT(policyname) as policy_count
FROM pg_tables t
LEFT JOIN pg_policies p ON t.tablename = p.tablename
WHERE t.tablename IN ('colonies', 'colony_students', 'colony_attendance', 'excel_imports', 'user_colony_access')
GROUP BY tablename, rowsecurity;
```

## Solución de Problemas

### Error: "No se pudo conceder el acceso"
- Verificar que el usuario y la colonia existan
- Verificar que el usuario sea administrador
- Revisar logs de la base de datos

### Usuario no puede ver colonias asignadas
- Verificar que las políticas RLS estén activas
- Verificar que el usuario tenga el rol correcto
- Verificar que el acceso esté correctamente configurado

### Códigos de colonia duplicados
- Ejecutar el script de limpieza: `scripts/012_colony_access_management.sql`
- Verificar que el trigger esté funcionando correctamente

## Futuras Mejoras

1. **Auditoría de Accesos**: Log de cambios en permisos
2. **Acceso Temporal**: Permisos con fecha de expiración
3. **Grupos de Usuarios**: Asignar acceso a múltiples usuarios a la vez
4. **Notificaciones**: Alertas cuando se asignan nuevos accesos
5. **Reportes**: Estadísticas de uso y acceso por colonia
