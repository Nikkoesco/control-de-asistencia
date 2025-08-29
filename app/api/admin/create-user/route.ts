import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()
    const adminSupabase = createAdminClient()
    
    // Verificar que el usuario actual sea admin
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    // Verificar el rol del usuario
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profileError || !profile || profile.role !== 'admin') {
      return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 })
    }

    // Obtener los datos del usuario a crear
    const { email, password, full_name, role, colony_id } = await request.json()

    // Validar los datos
    if (!email || !password || !full_name || !role) {
      return NextResponse.json({ error: 'Datos incompletos' }, { status: 400 })
    }

    // Si es usuario, la colonia es obligatoria
    if (role === 'user' && !colony_id) {
      return NextResponse.json({ error: 'Los usuarios deben tener una colonia asignada' }, { status: 400 })
    }

    // Verificar si el email ya existe en profiles
    const { data: existingProfile, error: checkProfileError } = await adminSupabase
      .from('profiles')
      .select('id, email')
      .eq('email', email)
      .single()

    if (existingProfile) {
      return NextResponse.json({ error: 'El email ya está registrado en el sistema' }, { status: 400 })
    }

    // Crear el usuario usando el cliente admin
    const { data: authData, error: createError } = await adminSupabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name }
    })

    if (createError) {
      // Manejar errores específicos de Supabase Auth
      if (createError.message.includes('already been registered')) {
        return NextResponse.json({ error: 'El email ya está registrado en el sistema de autenticación' }, { status: 400 })
      }
      return NextResponse.json({ error: createError.message }, { status: 400 })
    }

    if (authData.user) {
      try {
        // Esperar un momento para que se cree el perfil automáticamente
        await new Promise(resolve => setTimeout(resolve, 1000))
        
        // Verificar si el perfil ya existe (creado automáticamente)
        const { data: existingProfile, error: checkError } = await adminSupabase
          .from('profiles')
          .select('*')
          .eq('id', authData.user.id)
          .single()

        if (existingProfile) {
          // El perfil ya existe, solo actualizarlo
          const { error: updateError } = await adminSupabase
            .from('profiles')
            .update({
              full_name,
              role,
              colony_id: role === 'admin' ? null : colony_id
            })
            .eq('id', authData.user.id)

          if (updateError) {
            // Si falla la actualización, eliminar el usuario de auth
            await adminSupabase.auth.admin.deleteUser(authData.user.id)
            return NextResponse.json({ error: 'Error al actualizar el perfil: ' + updateError.message }, { status: 500 })
          }
        } else {
          // El perfil no existe, crearlo manualmente
          const profileData = {
            id: authData.user.id,
            email: authData.user.email,
            full_name,
            role,
            colony_id: role === 'admin' ? null : colony_id
          }

          const { error: profileError } = await adminSupabase
            .from('profiles')
            .insert(profileData)

          if (profileError) {
            // Si falla la creación del perfil, eliminar el usuario de auth
            await adminSupabase.auth.admin.deleteUser(authData.user.id)
            return NextResponse.json({ error: 'Error al crear el perfil: ' + profileError.message }, { status: 500 })
          }
        }

        // Obtener el nombre de la colonia para la respuesta
        let colonyName = null
        if (colony_id) {
          const { data: colonyData } = await adminSupabase
            .from('colonies')
            .select('name')
            .eq('id', colony_id)
            .single()
          colonyName = colonyData?.name
        }

        return NextResponse.json({
          success: true,
          user: {
            id: authData.user.id,
            email: authData.user.email,
            full_name,
            role,
            colony_id: role === 'admin' ? null : colony_id,
            colony_name: colonyName,
            created_at: new Date().toISOString()
          }
        })
      } catch (error) {
        // Si hay cualquier error, eliminar el usuario de auth
        await adminSupabase.auth.admin.deleteUser(authData.user.id)
        throw error
      }
    }

    return NextResponse.json({ error: 'Error al crear el usuario' }, { status: 500 })

  } catch (error) {
    console.error('Error en create-user API:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
