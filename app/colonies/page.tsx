"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Plus, Users, Calendar, FileSpreadsheet, Eye, Trash2 } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { toast } from "@/hooks/use-toast"

interface Colony {
  id: string
  name: string
  description: string
  colony_code: string
  periodo_desde: string
  periodo_hasta: string
  season_desc: string | null
  created_at: string
  student_count: number
  period_dates: string[]  // ✅ NUEVO: array de fechas de períodos
}

export default function ColoniesPage() {
  const [colonies, setColonies] = useState<Colony[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [newColonyName, setNewColonyName] = useState("")
  const [newColonyDescription, setNewColonyDescription] = useState("")
  const [newColonyCode, setNewColonyCode] = useState("")
  const [newColonyPeriodoDesde, setNewColonyPeriodoDesde] = useState("")
  const [newColonyPeriodoHasta, setNewColonyPeriodoHasta] = useState("")
  const [newColonySeason, setNewColonySeason] = useState("")  // ✅ NUEVO: estado para temporada
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  // Agregar estado para confirmación de eliminación
  const [colonyToDelete, setColonyToDelete] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  
  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    fetchColonies()
  }, [])

  // ✅ MODIFICADA FUNCIÓN: Cargar colonias con fechas de períodos
  const fetchColonies = async () => {
    try {
      setLoading(true)
      const supabase = createClient()
      
      const { data, error } = await supabase
        .from('colonies')
        .select(`
          *,
          student_count:students(count),
          period_dates:colony_periods(periodo_desde, periodo_hasta, season_desc)
        `)
        .order('created_at', { ascending: false })

      if (error) throw error

      // ✅ PROCESAR: Convertir contadores y fechas de períodos
      const coloniesWithData = data?.map(colony => ({
        ...colony,
        student_count: Array.isArray(colony.student_count) ? colony.student_count.length : 0,
        period_dates: Array.isArray(colony.period_dates) ? colony.period_dates : []
      })) || []

      setColonies(coloniesWithData)
    } catch (error) {
      console.error('Error fetching colonies:', error)
      toast({
        title: "Error",
        description: "No se pudieron cargar las colonias",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const createColony = async () => {
    if (!newColonyName.trim()) {
      toast({
        title: "Error",
        description: "El nombre de la colonia es obligatorio",
        variant: "destructive"
      })
      return
    }

    if (!newColonyPeriodoDesde || !newColonyPeriodoHasta) {
      toast({
        title: "Error",
        description: "El período es obligatorio",
        variant: "destructive"
      })
      return
    }

    if (new Date(newColonyPeriodoDesde) >= new Date(newColonyPeriodoHasta)) {
      toast({
        title: "Error",
        description: "La fecha de inicio debe ser anterior a la fecha de fin",
        variant: "destructive"
      })
      return
    }

    setIsCreating(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("Usuario no autenticado")

      const { data, error } = await supabase
        .from('colonies')
        .insert({
          name: newColonyName.trim(),
          description: newColonyDescription.trim(),
          colony_code: newColonyCode.trim() || null,
          periodo_desde: newColonyPeriodoDesde,
          periodo_hasta: newColonyPeriodoHasta,
          season_desc: newColonySeason.trim() || null,  // ✅ NUEVO: campo de temporada
          created_by: user.id
        })
        .select()
        .single()

      if (error) throw error

      toast({
        title: "Éxito",
        description: "Colonia creada correctamente"
      })

      setNewColonyName("")
      setNewColonyDescription("")
      setNewColonyCode("")
      setNewColonyPeriodoDesde("")
      setNewColonyPeriodoHasta("")
      setNewColonySeason("")  // ✅ NUEVO: limpiar campo de temporada
      setIsCreateDialogOpen(false)
      fetchColonies()
    } catch (error) {
      console.error('Error creating colony:', error)
      toast({
        title: "Error",
        description: "No se pudo crear la colonia",
        variant: "destructive"
      })
    } finally {
      setIsCreating(false)
    }
  }

  const openColony = (colonyId: string) => {
    router.push(`/colonies/${colonyId}`)
  }

  // Agregar función para eliminar colonia
  const handleDeleteColony = async (colonyId: string) => {
    setIsDeleting(true)
    try {
      console.log('=== INICIANDO ELIMINACIÓN DE COLONIA ===')
      
      // Primero verificar si el usuario actual puede eliminar esta colonia
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (authError) {
        console.error('Error de autenticación:', authError)
        throw new Error(`Error de autenticación: ${authError.message}`)
      }
      
      if (!user) {
        throw new Error("Usuario no autenticado")
      }

      console.log('Usuario autenticado:', { id: user.id, email: user.email })

      // Verificar si la colonia existe y obtener información del creador
      const { data: colonyData, error: fetchError } = await supabase
        .from('colonies')
        .select('created_by, name')
        .eq('id', colonyId)
        .single()

      if (fetchError) {
        console.error('Error al obtener colonia:', fetchError)
        throw new Error(`No se pudo obtener información de la colonia: ${fetchError.message}`)
      }

      if (!colonyData) {
        throw new Error("Colonia no encontrada")
      }

      console.log('Colonia encontrada:', colonyData)

      // Verificar si el usuario es el creador o es admin
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

      if (profileError) {
        console.error('Error al obtener perfil:', profileError)
        throw new Error(`No se pudo obtener el perfil del usuario: ${profileError.message}`)
      }

      const isAdmin = profileData?.role === 'admin'
      const isCreator = colonyData.created_by === user.id

      console.log('Verificación de permisos:', {
        userRole: profileData?.role,
        isAdmin,
        isCreator,
        colonyCreatedBy: colonyData.created_by,
        currentUserId: user.id
      })

      if (!isAdmin && !isCreator) {
        throw new Error("No tienes permisos para eliminar esta colonia. Solo el creador o administradores pueden eliminarla.")
      }

      console.log('Permisos verificados. Procediendo con eliminación...')

      // Intentar eliminar la colonia con logging seguro
      console.log('Ejecutando DELETE en Supabase...')
      
      const deleteResult = await supabase
        .from('colonies')
        .delete()
        .eq('id', colonyId)

      console.log('Resultado de DELETE recibido')
      console.log('¿Hay error?', !!deleteResult.error)
      console.log('¿Hay data?', !!deleteResult.data)

      // Manejo seguro del error
      if (deleteResult.error) {
        console.log('Error detectado, analizando...')
        
        // Logging seguro sin acceder a propiedades que puedan causar problemas
        try {
          const errorObj = deleteResult.error
          console.log('Tipo de error:', typeof errorObj)
          console.log('¿Es objeto?', errorObj instanceof Object)
          
          if (errorObj && typeof errorObj === 'object') {
            const keys = Object.keys(errorObj)
            console.log('Claves disponibles:', keys)
            
            // Intentar acceder a propiedades de manera segura
            if ('message' in errorObj) {
              console.log('Mensaje:', (errorObj as any).message)
            }
            if ('code' in errorObj) {
              console.log('Código:', (errorObj as any).code)
            }
            if ('details' in errorObj) {
              console.log('Detalles:', (errorObj as any).details)
            }
          }
        } catch (logError) {
          console.log('Error al analizar el error:', logError)
        }
        
        // Crear mensaje de error seguro
        let errorMessage = 'Error al eliminar colonia'
        
        try {
          if (deleteResult.error && typeof deleteResult.error === 'object') {
            const error = deleteResult.error as any
            if (error.message) {
              errorMessage = `Error: ${error.message}`
            } else if (error.details) {
              errorMessage = `Error: ${error.details}`
            } else if (error.code) {
              errorMessage = `Error código: ${error.code}`
            }
          }
        } catch (parseError) {
          console.log('Error al parsear mensaje:', parseError)
          errorMessage = 'Error desconocido al eliminar colonia'
        }
        
        throw new Error(errorMessage)
      }

      console.log('Colonia eliminada exitosamente')

      // Actualizar la lista de colonias
      setColonies(prev => prev.filter(colony => colony.id !== colonyId))
      
      toast({
        title: "Éxito",
        description: `Colonia "${colonyData.name}" eliminada correctamente`
      })
      
      // Cerrar el diálogo de confirmación
      setColonyToDelete(null)
    } catch (error) {
      console.log('=== ERROR CAPTURADO ===')
      console.log('Error capturado:', error)
      console.log('Tipo de error:', typeof error)
      
      // Mostrar mensaje de error más específico
      let errorMessage = "No se pudo eliminar la colonia"
      
      if (error instanceof Error) {
        errorMessage = error.message
        console.log('Error es instancia de Error:', true)
        console.log('Error.message:', error.message)
      } else {
        console.log('Error no es instancia de Error')
        console.log('Error como string:', String(error))
      }
      
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive"
      })
    } finally {
      setIsDeleting(false)
      console.log('=== FINALIZANDO ELIMINACIÓN ===')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Cargando colonias...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <h1 className="text-2xl font-bold">Gestión de Colonias</h1>
              <Button onClick={() => router.push("/dashboard")} variant="outline">
                Volver al Dashboard
              </Button>
            </div>
          </div>
        </header>

        <main className="container mx-auto px-4 py-8">
          <div className="max-w-2xl mx-auto">
            <Card className="text-center py-12">
              <CardContent>
                <div className="text-red-500 mb-4">
                  <svg className="h-16 w-16 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold mb-2 text-red-600">Error al cargar las colonias</h3>
                <p className="text-muted-foreground mb-6">{error}</p>
                
                                 {error.includes('tablas de colonias no están creadas') && (
                   <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6 text-left">
                     <h4 className="font-semibold text-yellow-800 mb-2">Para resolver este problema:</h4>
                     <ol className="list-decimal list-inside text-sm text-yellow-700 space-y-1">
                       <li>Ve a tu base de datos Supabase</li>
                       <li>Ejecuta el script: <code className="bg-yellow-100 px-2 py-1 rounded">scripts/005_create_colonies_tables.sql</code></li>
                       <li>Ejecuta el script: <code className="bg-yellow-100 px-2 py-1 rounded">scripts/006_colonies_rls.sql</code></li>
                       <li>Ejecuta el script: <code className="bg-yellow-100 px-2 py-1 rounded">scripts/007_update_students_table.sql</code></li>
                       <li>Recarga esta página</li>
                     </ol>
                   </div>
                 )}

                 {error.includes('recursión infinita en las políticas RLS') && (
                   <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 text-left">
                     <h4 className="font-semibold text-red-800 mb-2">Error de Recursión Infinita Detectado:</h4>
                     <p className="text-red-700 text-sm mb-3">
                       Las políticas RLS están causando un bucle infinito. Esto se debe a que las políticas están consultando la tabla profiles que también tiene RLS habilitado.
                     </p>
                     <h5 className="font-semibold text-red-800 mb-2">Para resolver este problema:</h5>
                     <ol className="list-decimal list-inside text-sm text-red-700 space-y-1">
                       <li>Ve a tu base de datos Supabase</li>
                       <li>Ejecuta el script de corrección: <code className="bg-red-100 px-2 py-1 rounded">scripts/009_fix_rls_recursion.sql</code></li>
                       <li>Recarga esta página</li>
                     </ol>
                     <p className="text-red-600 text-xs mt-2">
                       <strong>Nota:</strong> Este script corregirá las políticas problemáticas sin afectar la seguridad.
                     </p>
                   </div>
                 )}
                
                <div className="space-x-4">
                  <Button onClick={() => window.location.reload()}>
                    Recargar Página
                  </Button>
                  <Button onClick={() => router.push("/dashboard")} variant="outline">
                    Volver al Dashboard
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    )
  }

  const formatPeriodo = (desde: string, hasta: string) => {
    // Crear fechas y ajustar para evitar problemas de zona horaria
    const desdeDate = new Date(desde + 'T00:00:00')
    const hastaDate = new Date(hasta + 'T00:00:00')
    
    const desdeFormatted = desdeDate.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' })
    const hastaFormatted = hastaDate.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' })
    return `${desdeFormatted} - ${hastaFormatted}`
  }

  const calculateDays = (desde: string, hasta: string) => {
    // Crear fechas y ajustar para evitar problemas de zona horaria
    const desdeDate = new Date(desde + 'T00:00:00')
    const hastaDate = new Date(hasta + 'T00:00:00')
    
    // Calcular la diferencia en días incluyendo ambos días
    const diffTime = hastaDate.getTime() - desdeDate.getTime()
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1
    
    return diffDays
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold">Gestión de Colonias</h1>
            <Button onClick={() => router.push("/dashboard")} variant="outline">
              Volver al Dashboard
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold mb-2">Colonias</h2>
            <p className="text-muted-foreground">
              Gestiona las colonias y sus estudiantes
            </p>
          </div>
          
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Nueva Colonia
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Crear Nueva Colonia</DialogTitle>
                <DialogDescription>
                  Crea una nueva colonia para organizar estudiantes
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="name">Nombre de la Colonia *</Label>
                  <Input
                    id="name"
                    value={newColonyName}
                    onChange={(e) => setNewColonyName(e.target.value)}
                    placeholder="Ej: Colonia A"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="code">Código de la Colonia (Opcional)</Label>
                  <Input
                    id="code"
                    value={newColonyCode}
                    onChange={(e) => setNewColonyCode(e.target.value)}
                    placeholder="Ej: COL-001, A-2024, etc. (se genera automáticamente si está vacío)"
                  />
                  <p className="text-xs text-muted-foreground">
                    Si dejas este campo vacío, se generará un código único automáticamente
                  </p>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="periodo">Período *</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label htmlFor="periodo_desde" className="text-xs">Desde</Label>
                      <Input
                        id="periodo_desde"
                        type="date"
                        value={newColonyPeriodoDesde}
                        onChange={(e) => setNewColonyPeriodoDesde(e.target.value)}
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="periodo_hasta" className="text-xs">Hasta</Label>
                      <Input
                        id="periodo_hasta"
                        type="date"
                        value={newColonyPeriodoHasta}
                        onChange={(e) => setNewColonyPeriodoHasta(e.target.value)}
                        required
                      />
                    </div>
                  </div>
                  {newColonyPeriodoDesde && newColonyPeriodoHasta && (
                    <p className="text-xs text-muted-foreground">
                      Duración: {calculateDays(newColonyPeriodoDesde, newColonyPeriodoHasta)} días
                    </p>
                  )}
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="season">Temporada (Opcional)</Label>
                  <Input
                    id="season"
                    value={newColonySeason}
                    onChange={(e) => setNewColonySeason(e.target.value)}
                    placeholder="Ej: Verano 2024, Invierno 2025, etc."
                  />
                  <p className="text-xs text-muted-foreground">
                    Identifica la temporada o período específico de la colonia
                  </p>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="description">Descripción</Label>
                  <Textarea
                    id="description"
                    value={newColonyDescription}
                    onChange={(e) => setNewColonyDescription(e.target.value)}
                    placeholder="Descripción opcional de la colonia"
                    rows={3}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={createColony} disabled={isCreating}>
                  {isCreating ? "Creando..." : "Crear Colonia"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {colonies.length === 0 ? (
          <Card className="text-center py-12">
            <CardContent>
              <Users className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No hay colonias creadas</h3>
              <p className="text-muted-foreground mb-4">
                Crea tu primera colonia para comenzar a gestionar estudiantes
              </p>
              <Button onClick={() => setIsCreateDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Crear Primera Colonia
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {colonies.map((colony) => (
              <Card key={colony.id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span className="truncate">{colony.name}</span>
                  </CardTitle>
                  <CardDescription className="line-clamp-2">
                    {colony.description || "Sin descripción"}
                  </CardDescription>
                  {colony.colony_code && (
                    <div className="text-xs text-muted-foreground font-mono bg-muted px-2 py-1 rounded">
                      Código: {colony.colony_code}
                    </div>
                  )}
                  {/* ✅ MODIFICADO: Mostrar todos los períodos sin temporada */}
                  <div className="text-xs text-muted-foreground bg-blue-50 px-2 py-1 rounded">
                    <div className="font-medium mb-1">Período 1: {formatPeriodo(colony.periodo_desde, colony.periodo_hasta)}</div>
                    
                    {/* ✅ PERÍODOS ADICIONALES: Solo fecha, sin temporada */}
                    {colony.period_dates && colony.period_dates.length > 0 && (
                      <div className="space-y-1">
                        {colony.period_dates.map((period: any, index: number) => (
                          <div key={index} className="text-xs">
                            <span className="font-medium">
                              Período {index + 2}: {/* Solo número del período */}
                            </span>
                            {new Date(period.periodo_desde).toLocaleDateString()} - {new Date(period.periodo_hasta).toLocaleDateString()}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  
                  {colony.season_desc && (
                    <div className="text-xs text-muted-foreground bg-green-50 px-2 py-1 rounded">
                      Temporada: {colony.season_desc}
                    </div>
                  )}
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Users className="h-4 w-4" />
                      {colony.student_count || 0} estudiantes
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(colony.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  
                  <div className="flex gap-2">
                    <Button 
                      onClick={() => openColony(colony.id)} 
                      className="flex-1"
                      variant="outline"
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      Abrir
                    </Button>
                    <Button 
                      onClick={() => router.push(`/colonies/${colony.id}/import`)} 
                      size="sm"
                      variant="secondary"
                    >
                      <FileSpreadsheet className="h-4 w-4" />
                    </Button>
                    {/* Agregar botón de eliminación */}
                    <Button 
                      onClick={() => setColonyToDelete(colony.id)} 
                      size="sm"
                      variant="destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>

      {/* Agregar diálogo de confirmación de eliminación */}
      <Dialog open={!!colonyToDelete} onOpenChange={() => setColonyToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Eliminación</DialogTitle>
            <DialogDescription>
              ¿Estás seguro de que quieres eliminar esta colonia? Esta acción no se puede deshacer y eliminará:
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-4">
            <div className="text-sm text-muted-foreground space-y-2">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                <span>La colonia y toda su información</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                <span>Todos los estudiantes asociados</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                <span>Todo el historial de asistencia</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                <span>Todos los archivos de importación</span>
              </div>
            </div>
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-sm text-red-700 font-medium">
                ⚠️ Esta acción es irreversible
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setColonyToDelete(null)}
              disabled={isDeleting}
            >
              Cancelar
            </Button>
            <Button 
              variant="destructive" 
              onClick={() => colonyToDelete && handleDeleteColony(colonyToDelete)}
              disabled={isDeleting}
            >
              {isDeleting ? "Eliminando..." : "Eliminar Colonia"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
