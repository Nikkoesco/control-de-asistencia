# Configuración Local del Sistema de Asistencia

## 1. Obtener Credenciales de Supabase

Para obtener tus credenciales reales:

1. Ve a [supabase.com](https://supabase.com)
2. Inicia sesión en tu cuenta
3. Selecciona tu proyecto
4. Ve a **Settings** → **API**
5. Copia los siguientes valores:
   - **Project URL** → `SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public** → `SUPABASE_ANON_KEY` y `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role** → `SUPABASE_SERVICE_ROLE_KEY`

## 2. Configurar Variables de Entorno

1. Copia `.env.example` a `.env.local`
2. Reemplaza los valores con tus credenciales reales:

\`\`\`env
SUPABASE_URL=https://tu-proyecto-real.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...
SUPABASE_ANON_KEY=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto-real.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...
NEXT_PUBLIC_SITE_URL=http://localhost:3000
\`\`\`

## 3. Instalar Dependencias

\`\`\`bash
npm install
# o
yarn install
\`\`\`

## 4. Ejecutar el Proyecto

\`\`\`bash
npm run dev
# o
yarn dev
\`\`\`

## 5. Verificar Configuración

- Ve a `http://localhost:3000`
- Intenta registrarte con un email
- Verifica que puedas hacer login

## Estructura de la Base de Datos

Tu base de datos ya tiene estas tablas configuradas:
- `profiles` - Usuarios con roles
- `students` - Estudiantes importados
- `classes` - Clases/materias
- `attendance` - Registros de asistencia
- `import_sessions` - Historial de importaciones

¡Todo está listo para funcionar!
