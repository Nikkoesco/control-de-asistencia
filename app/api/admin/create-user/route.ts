import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    console.log('🔄 Iniciando creación de usuario...')
    
    // ✅ CORREGIR: Esperar las funciones async
    const supabase = await createClient()
    const adminSupabase = await createAdminClient()
    
    // ✅ VERIFICAR: Que los clientes se hayan creado correctamente
    if (!supabase || !supabase.auth) {
      console.error('❌ Error inicializando cliente Supabase')
      return NextResponse.json({ error: 'Error de configuración del servidor' }, { status: 500 })
    }
    
    if (!adminSupabase || !adminSupabase.auth) {
      console.error('❌ Error inicializando cliente admin Supabase')
      return NextResponse.json({ error: 'Error de configuración del servidor admin' }, { status: 500 })
    }
    
    // ✅ VERIFICAR: Variables de entorno
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error('❌ SUPABASE_SERVICE_ROLE_KEY no está configurada')
      return NextResponse.json({ error: 'Configuración del servidor incompleta' }, { status: 500 })
    }
    
    console.log('✅ Clientes Supabase inicializados correctamente')
    
    // Verificar que el usuario actual sea admin
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      console.error('❌ Error de autenticación:', authError)
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    console.log('✅ Usuario autenticado:', user.id)

    // Verificar el rol del usuario
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profileError || !profile || profile.role !== 'admin') {
      console.error('❌ Error de permisos:', { profileError, profile })
      return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 })
    }

    console.log('✅ Usuario es admin')

    // Obtener los datos del usuario a crear
    const requestData = await request.json()
    const { email, password, full_name, role, colony_id } = requestData
    
    console.log('📝 Datos recibidos:', { email, full_name, role, colony_id, hasPassword: !!password })

    // Validar los datos
    if (!email || !password || !full_name || !role) {
      console.error('❌ Datos incompletos:', { email: !!email, password: !!password, full_name: !!full_name, role: !!role })
      return NextResponse.json({ error: 'Datos incompletos' }, { status: 400 })
    }

    // Si es usuario, la colonia es obligatoria
    if (role === 'user' && !colony_id) {
      console.error('❌ Usuario sin colonia asignada')
      return NextResponse.json({ error: 'Los usuarios deben tener una colonia asignada' }, { status: 400 })
    }

    // Verificar si el email ya existe en profiles
    console.log('🔍 Verificando si el email ya existe...')
    const { data: existingProfile, error: checkProfileError } = await adminSupabase
      .from('profiles')
      .select('id, email')
      .eq('email', email)
      .single()

    if (checkProfileError && checkProfileError.code !== 'PGRST116') {
      console.error('❌ Error verificando email existente:', checkProfileError)
      return NextResponse.json({ error: 'Error verificando email: ' + checkProfileError.message }, { status: 500 })
    }

    if (existingProfile) {
      console.error('❌ Email ya existe en profiles')
      return NextResponse.json({ error: 'El email ya está registrado en el sistema' }, { status: 400 })
    }

    console.log('✅ Email disponible')

    // Crear el usuario usando el cliente admin
    console.log('🔄 Creando usuario en Supabase Auth...')
    const { data: authData, error: createError } = await adminSupabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name }
    })

    if (createError) {
      console.error('❌ Error creando usuario en Auth:', createError)
      // Manejar errores específicos de Supabase Auth
      if (createError.message.includes('already been registered')) {
        return NextResponse.json({ error: 'El email ya está registrado en el sistema de autenticación' }, { status: 400 })
      }
      return NextResponse.json({ error: 'Error de autenticación: ' + createError.message }, { status: 400 })
    }

    if (!authData.user) {
      console.error('❌ No se pudo crear el usuario en Auth')
      return NextResponse.json({ error: 'Error al crear el usuario en el sistema de autenticación' }, { status: 500 })
    }

    console.log('✅ Usuario creado en Auth:', authData.user.id)

    try {
      // Esperar un momento para que se cree el perfil automáticamente
      console.log('⏳ Esperando creación automática del perfil...')
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      // Verificar si el perfil ya existe (creado automáticamente)
      const { data: existingProfile, error: checkError } = await adminSupabase
        .from('profiles')
        .select('*')
        .eq('id', authData.user.id)
        .single()

      if (checkError && checkError.code !== 'PGRST116') {
        console.error('❌ Error verificando perfil existente:', checkError)
        throw new Error('Error verificando perfil: ' + checkError.message)
      }

      if (existingProfile) {
        console.log('✅ Perfil existe, actualizando...')
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
          console.error('❌ Error actualizando perfil:', updateError)
          throw new Error('Error al actualizar el perfil: ' + updateError.message)
        }
        console.log('✅ Perfil actualizado')
      } else {
        console.log('🔄 Creando perfil manualmente...')
        // El perfil no existe, crearlo manualmente
        const profileData = {
          id: authData.user.id,
          email: authData.user.email,
          full_name,
          role,
          colony_id: role === 'admin' ? null : colony_id
        }

        console.log('📝 Datos del perfil a crear:', profileData)

        const { error: profileError } = await adminSupabase
          .from('profiles')
          .insert(profileData)

        if (profileError) {
          console.error('❌ Error creando perfil:', profileError)
          throw new Error('Error al crear el perfil: ' + profileError.message)
        }
        console.log('✅ Perfil creado')
      }

      // Obtener el nombre de la colonia para la respuesta
      let colonyName = null
      if (colony_id) {
        console.log('🔍 Obteniendo nombre de colonia...')
        const { data: colonyData, error: colonyError } = await adminSupabase
          .from('colonies')
          .select('name')
          .eq('id', colony_id)
          .single()
        
        if (colonyError) {
          console.warn('⚠️ Error obteniendo nombre de colonia:', colonyError)
        } else {
          colonyName = colonyData?.name
          console.log('✅ Nombre de colonia obtenido:', colonyName)
        }
      }

      console.log('✅ Usuario creado exitosamente')
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
      console.error('❌ Error en el proceso, eliminando usuario de Auth:', error)
      // Si hay cualquier error, eliminar el usuario de auth
      try {
        await adminSupabase.auth.admin.deleteUser(authData.user.id)
        console.log('✅ Usuario eliminado de Auth por error')
      } catch (deleteError) {
        console.error('❌ Error eliminando usuario de Auth:', deleteError)
      }
      throw error
    }

  } catch (error) {
    console.error('❌ Error completo en create-user API:', error)
    
    // Proporcionar error más específico
    let errorMessage = 'Error interno del servidor'
    if (error instanceof Error) {
      errorMessage = error.message
    }
    
    return NextResponse.json({ 
      error: errorMessage,
      details: process.env.NODE_ENV === 'development' ? error : undefined
    }, { status: 500 })
  }
}
