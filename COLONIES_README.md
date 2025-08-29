# Sistema de Gestión de Colonias

Este sistema permite crear y gestionar colonias de estudiantes con funcionalidades de importación de Excel y control de asistencia.

## Características Principales

### 🏘️ Gestión de Colonias
- Crear nuevas colonias con nombre y descripción
- Ver lista de colonias existentes
- Acceder a cada colonia individualmente

### 📊 Importación de Excel
- Subir archivos Excel (.xlsx, .xls)
- Detección automática de columnas
- Selección y mapeo de columnas a campos del sistema
- Vista previa de datos antes de importar
- Importación masiva de estudiantes

### 👥 Gestión de Estudiantes
- Lista completa de estudiantes por colonia
- Información detallada: nombre, apellido, ID, email, grado, sección
- Fecha de registro automática

### ✅ Control de Asistencia
- Marcar asistencia por fecha
- Estados: Presente, Ausente, Tardanza
- Interfaz intuitiva con botones de acción
- Guardado automático de registros

## Instalación

### 1. Ejecutar Scripts SQL

Ejecuta los siguientes scripts en tu base de datos Supabase en este orden:

```sql
-- Crear tablas de colonias
\i scripts/005_create_colonies_tables.sql

-- Configurar políticas RLS
\i scripts/006_colonies_rls.sql
```

### 2. Dependencias

El sistema ya incluye todas las dependencias necesarias:
- `xlsx` para lectura de archivos Excel
- Componentes UI de shadcn/ui
- Supabase para base de datos

## Uso

### Crear una Colonia

1. Ve al Dashboard
2. Haz clic en "Gestionar Colonias"
3. Haz clic en "Nueva Colonia"
4. Completa el nombre y descripción
5. Haz clic en "Crear Colonia"

### Importar Estudiantes desde Excel

1. Abre la colonia deseada
2. Haz clic en el botón de Excel (📊)
3. Sigue los 4 pasos:
   - **Paso 1**: Subir archivo Excel
   - **Paso 2**: Seleccionar y mapear columnas
   - **Paso 3**: Vista previa de datos
   - **Paso 4**: Confirmar e importar

### Mapeo de Columnas

El sistema reconoce automáticamente estas columnas comunes:

| Columna Excel | Campo Sistema | Descripción |
|---------------|---------------|-------------|
| `nombre`, `name` | `name` | Nombre del estudiante (obligatorio) |
| `apellido`, `last_name`, `lastname` | `last_name` | Apellido del estudiante |
| `id`, `student_id`, `identificacion` | `student_id` | ID único del estudiante |
| `email`, `correo` | `email` | Correo electrónico |
| `grado`, `grade` | `grade` | Grado académico |
| `seccion`, `section` | `section` | Sección del grado |

### Gestionar Asistencia

1. Abre la colonia
2. Ve a la pestaña "Asistencia"
3. Selecciona la fecha deseada
4. Marca la asistencia de cada estudiante:
   - ✓ Presente
   - ⏰ Tardanza
   - ✗ Ausente
5. Usa "Guardar Todo" para marcar automáticamente como ausentes a los estudiantes sin marcar

## Estructura de la Base de Datos

### Tablas Principales

- **`colonies`**: Información de las colonias
- **`colony_students`**: Relación entre colonias y estudiantes
- **`colony_attendance`**: Registros de asistencia por colonia
- **`excel_imports`**: Historial de importaciones

### Relaciones

```
colonies (1) ←→ (N) colony_students (N) ←→ (1) students
colonies (1) ←→ (N) colony_attendance
colonies (1) ←→ (N) excel_imports
```

## Seguridad

- **Row Level Security (RLS)** habilitado en todas las tablas
- Los usuarios solo pueden acceder a colonias que crearon
- Los administradores tienen acceso completo a todas las colonias
- Validación de datos en el frontend y backend

## Formato de Excel Recomendado

Para mejores resultados, usa un Excel con esta estructura:

| nombre | apellido | id | email | grado | seccion |
|--------|----------|----|-------|-------|---------|
| Juan | Pérez | 001 | juan@email.com | 5to | A |
| María | García | 002 | maria@email.com | 5to | A |

## Solución de Problemas

### Error de Importación
- Verifica que el archivo sea Excel válido (.xlsx o .xls)
- Asegúrate de que al menos la columna "nombre" esté presente
- Revisa que los datos no estén vacíos

### Problemas de Permisos
- Verifica que estés logueado
- Confirma que seas el creador de la colonia o administrador
- Ejecuta los scripts RLS si no se han aplicado

### Estudiantes No Aparecen
- Verifica que la importación se haya completado exitosamente
- Revisa los logs de importación en la base de datos
- Confirma que los estudiantes estén vinculados a la colonia

## Soporte

Para problemas técnicos o preguntas:
1. Revisa los logs de la consola del navegador
2. Verifica los logs de Supabase
3. Confirma que todos los scripts SQL se hayan ejecutado correctamente
