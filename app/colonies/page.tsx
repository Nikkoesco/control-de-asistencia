"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Plus, Users, Calendar, FileSpreadsheet, Eye, Trash2, Upload, Edit, Eraser } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { toast } from "@/hooks/use-toast"
import * as XLSX from 'xlsx'
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface Colony {
  id: string
  name: string
  description: string
  colony_code: string
  created_at: string
  student_count: number
  period_dates: Array<{
    periodo_desde: string
    periodo_hasta: string
    season_desc: string
    period_number: number
  }>
  // ❌ ELIMINADO: periodo_desde, periodo_hasta, season_desc
}

interface ExcelColumn {
  name: string
  index: number
  selected: boolean
  mappedTo: string
}

interface ExcelRow {
  [key: string]: any
}

const COLUMN_MAPPINGS = {
  'nombre': 'name',
  'name': 'name',
  'apellido': 'last_name',
  'last_name': 'last_name',
  'lastname': 'last_name',
  'id': 'student_id',
  'student_id': 'student_id',
  'identificacion': 'student_id',
  'identificacion_estudiante': 'student_id',
  'colonia': 'colony_id',
  'colony': 'colony_id',
  'id_colonia': 'colony_id',
  'temporada': 'season',
  'season': 'season',
  'periodo': 'season',
  'año': 'season',
  'email': 'email',
  'correo': 'email',
  'grado': 'grade',
  'grade': 'grade',
  'seccion': 'section',
  'section': 'section'
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
  const [newColonySeason, setNewColonySeason] = useState("")
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [colonyToDelete, setColonyToDelete] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  
  // ✅ NUEVOS ESTADOS: Para manejo de Excel en el modal
  const [excelFile, setExcelFile] = useState<File | null>(null)
  const [excelData, setExcelData] = useState<ExcelRow[]>([])
  const [excelColumns, setExcelColumns] = useState<ExcelColumn[]>([])
  const [excelPreview, setExcelPreview] = useState<ExcelRow[]>([])
  const [excelStep, setExcelStep] = useState<'upload' | 'columns' | 'preview'>('upload')
  const [processingExcel, setProcessingExcel] = useState(false)
  
  // ✅ NUEVOS ESTADOS: Para el modal de mapeo de columnas
  const [showColumnMappingModal, setShowColumnMappingModal] = useState(false)
  const [tempExcelColumns, setTempExcelColumns] = useState<ExcelColumn[]>([])

  // ✅ NUEVOS ESTADOS para editar colonia
  const [showEditColonyModal, setShowEditColonyModal] = useState(false)
  const [showDeleteDataModal, setShowDeleteDataModal] = useState(false)
  const [colonyToEdit, setColonyToEdit] = useState<Colony | null>(null)
  const [colonyToDeleteData, setColonyToDeleteData] = useState<Colony | null>(null)
  const [editColonyData, setEditColonyData] = useState({
    name: '',
    colony_code: '',
    description: '',
    season_desc: ''
  })
  const [isUpdatingColony, setIsUpdatingColony] = useState(false)
  const [isDeletingData, setIsDeletingData] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    fetchColonies()
  }, [])

  // ✅ MODIFICADA FUNCIÓN: Cargar colonias con períodos desde colony_periods
  const fetchColonies = async () => {
    try {
      setLoading(true)
      const supabase = createClient()
      
      const { data, error } = await supabase
        .from('colonies')
        .select(`
          *,
          student_count:students(count),
          period_dates:colony_periods(periodo_desde, periodo_hasta, season_desc, period_number)
        `)
        .order('created_at', { ascending: false })

      if (error) throw error

      // ✅ PROCESAR: Convertir contadores y obtener períodos
      const coloniesWithData = data?.map(colony => ({
        ...colony,
        student_count: colony.student_count?.[0]?.count || 0,
        period_dates: Array.isArray(colony.period_dates) ? colony.period_dates : []
      })) || []

      console.log('✅ Colonias procesadas:', coloniesWithData.map(c => ({
        name: c.name,
        student_count: c.student_count,
        period_dates: c.period_dates
      })))

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

  // ✅ FUNCIÓN MEJORADA: Crear colonia con mejor manejo de errores
  const createColony = async () => {
    if (!isFormValid()) {
      toast({
        title: "Error",
        description: "Complete todos los campos y cargue el archivo Excel",
        variant: "destructive"
      })
      return
    }

    try {
      setIsCreating(true)
      console.log('🔄 Iniciando creación de colonia...')

      // Validar autenticación
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (authError) {
        console.error('❌ Error de autenticación:', authError)
        throw new Error(`Error de autenticación: ${authError.message}`)
      }
      
      if (!user) {
        throw new Error("Usuario no autenticado")
      }

      console.log('✅ Usuario autenticado:', user.id)

      // PASO 1: Crear la colonia
      console.log('🔄 Creando colonia con datos:', {
        name: newColonyName.trim(),
        description: newColonyDescription.trim(),
        colony_code: newColonyCode.trim(),
        created_by: user.id
      })

      const { data: colony, error: colonyError } = await supabase
        .from('colonies')
        .insert({
          name: newColonyName.trim(),
          description: newColonyDescription.trim(),
          colony_code: newColonyCode.trim(),
          created_by: user.id
        })
        .select()
        .single()

      if (colonyError) {
        console.error('❌ Error creando colonia:', {
          message: colonyError.message,
          details: colonyError.details,
          hint: colonyError.hint,
          code: colonyError.code
        })
        throw new Error(`Error creando colonia: ${colonyError.message}`)
      }

      console.log('✅ Colonia creada:', colony)

      // PASO 2: Crear el período inicial
      console.log('🔄 Creando período inicial con datos:', {
        colony_id: colony.id,
        period_number: 1,
        description: newColonyDescription.trim() || 'Período inicial',
        periodo_desde: newColonyPeriodoDesde,
        periodo_hasta: newColonyPeriodoHasta,
        season_desc: newColonySeason.trim(),
        created_by: user.id
      })

      const { error: periodError } = await supabase
        .from('colony_periods')
        .insert({
          colony_id: colony.id,
          period_number: 1,
          description: newColonyDescription.trim() || 'Período inicial',
          periodo_desde: newColonyPeriodoDesde,
          periodo_hasta: newColonyPeriodoHasta,
          season_desc: newColonySeason.trim(),
          created_by: user.id
        })

      if (periodError) {
        console.error('❌ Error creando período:', {
          message: periodError.message,
          details: periodError.details,
          hint: periodError.hint,
          code: periodError.code
        })
        throw new Error(`Error creando período: ${periodError.message}`)
      }

      console.log('✅ Período creado exitosamente')

      // PASO 3: Preparar estudiantes para importar
      console.log('🔄 Procesando estudiantes del Excel...')
      console.log('📊 Datos Excel:', excelData.length, 'filas')
      console.log('📊 Columnas:', excelColumns.map(c => ({ name: c.name, selected: c.selected, mappedTo: c.mappedTo })))

      const studentsToImport = excelData.map((row, index) => {
        const student: any = {
          colony_id: colony.id,
          period_number: 1,
          created_by: user.id,
          season: newColonySeason.trim() || '2024-2025' // ✅ AGREGAR: Campo season obligatorio
        }

        // Mapear columnas seleccionadas
        excelColumns.forEach(col => {
          if (col.selected && col.mappedTo !== 'unmapped') {
            const value = row[col.name]
            if (value) {
              if (col.mappedTo === 'name') {
                // Combinar nombre y apellido si existen por separado
                const lastName = excelColumns.find(c => c.mappedTo === 'last_name')
                if (lastName && row[lastName.name]) {
                  student.name = `${row[lastName.name]}, ${value}`.trim()
                } else {
                  student.name = value.toString().trim()
                }
              } else if (col.mappedTo === 'season') {
                // ✅ Si el Excel tiene una columna de temporada, usarla
                student.season = value.toString().trim()
              } else if (col.mappedTo !== 'last_name') {
                student[col.mappedTo] = value.toString().trim()
              }
            }
          }
        })

        // Validar que tenga al menos nombre
        if (!student.name) {
          student.name = `Estudiante ${index + 1}`
        }

        // ✅ ASEGURAR: Que season siempre tenga un valor
        if (!student.season) {
          student.season = newColonySeason.trim() || '2024-2025'
        }

        console.log(`📝 Estudiante ${index + 1}:`, student)
        return student
      }).filter(student => student.name && student.name.trim() !== '')

      console.log('📊 Estudiantes a importar:', studentsToImport.length)
      console.log('📊 Ejemplo de estudiante:', studentsToImport[0]) // ✅ Ver estructura completa

      if (studentsToImport.length === 0) {
        throw new Error('No se encontraron estudiantes válidos en el Excel')
      }

      // PASO 4: Insertar estudiantes
      console.log('🔄 Insertando estudiantes en la base de datos...')
      
      const { data: insertedStudents, error: studentsError } = await supabase
        .from('students')
        .insert(studentsToImport)
        .select()

      if (studentsError) {
        console.error('❌ Error insertando estudiantes:', {
          message: studentsError.message,
          details: studentsError.details,
          hint: studentsError.hint,
          code: studentsError.code
        })
        throw new Error(`Error insertando estudiantes: ${studentsError.message}`)
      }

      console.log('✅ Estudiantes insertados:', insertedStudents?.length || 0)

      toast({
        title: "Éxito",
        description: `Colonia creada con ${insertedStudents?.length || studentsToImport.length} estudiantes importados`
      })

      // Limpiar formulario
      setNewColonyName("")
      setNewColonyDescription("")
      setNewColonyCode("")
      setNewColonyPeriodoDesde("")
      setNewColonyPeriodoHasta("")
      setNewColonySeason("")
      setExcelFile(null)
      setExcelData([])
      setExcelColumns([])
      setExcelPreview([])
      setExcelStep('upload')
      setIsCreateDialogOpen(false)
      
      fetchColonies()
      
    } catch (error) {
      console.error('❌ Error completo en createColony:', error)
      
      // Manejo de errores más específico
      let errorMessage = "No se pudo crear la colonia"
      
      if (error instanceof Error) {
        errorMessage = error.message
      } else if (typeof error === 'object' && error !== null) {
        // Si es un objeto, intentar extraer información útil
        const errorObj = error as any
        if (errorObj.message) {
          errorMessage = errorObj.message
        } else if (errorObj.details) {
          errorMessage = errorObj.details
        } else {
          errorMessage = JSON.stringify(error)
        }
      }
      
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive"
      })
    } finally {
      setIsCreating(false)
    }
  }

  // ✅ FUNCIÓN: Ajustar fechas para evitar problemas de zona horaria
  const adjustDateForTimezone = (dateString: string) => {
    try {
      // ✅ Crear fecha en la zona horaria local
      const [year, month, day] = dateString.split('-').map(Number)
      
      // ✅ Crear fecha usando el constructor local (evita conversiones UTC)
      const localDate = new Date(year, month - 1, day) // month - 1 porque JavaScript cuenta desde 0
      
      // ✅ Formatear como YYYY-MM-DD
      const yearStr = localDate.getFullYear()
      const monthStr = String(localDate.getMonth() + 1).padStart(2, '0')
      const dayStr = String(localDate.getDate()).padStart(2, '0')
      
      const result = `${yearStr}-${monthStr}-${dayStr}`
      
      console.log('🔄 Ajuste de fecha:', {
        original: dateString,
        localDate: localDate,
        resultado: result
      })
      
      return result
    } catch (error) {
      console.error('Error ajustando fecha:', error)
      return dateString // ✅ Retornar original si hay error
    }
  }

  // ✅ FUNCIÓN CORREGIDA: Manejar carga de archivo Excel
  const handleExcelUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setExcelFile(file)
    setProcessingExcel(true)

    try {
      const arrayBuffer = await file.arrayBuffer()
      const workbook = XLSX.read(arrayBuffer, { type: 'array' })
      const sheetName = workbook.SheetNames[0]
      const worksheet = workbook.Sheets[sheetName]
      
      // ✅ MEJORADO: Usar defval para evitar celdas undefined y range para limitar filas
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { 
        header: 1, 
        defval: '', // Valor por defecto para celdas vacías
        raw: false  // Convertir todo a string
      })

      console.log('📊 Datos brutos del Excel:', jsonData.length, 'filas')

      if (jsonData.length < 2) {
        throw new Error('El archivo debe tener al menos una fila de encabezados y una fila de datos')
      }

      const headers = jsonData[0] as string[]
      console.log('📋 Encabezados encontrados:', headers)

      // ✅ FILTRAR: Solo filas que tengan al menos un valor no vacío
      const allRows = jsonData.slice(1) as any[][]
      const validRows = allRows.filter(row => {
        // Una fila es válida si tiene al menos una celda con contenido
        return row && row.some(cell => cell && cell.toString().trim() !== '')
      })

      console.log('📊 Filas válidas encontradas:', validRows.length)
      console.log('📊 Ejemplo de filas válidas:', validRows.slice(0, 3))

      if (validRows.length === 0) {
        throw new Error('No se encontraron filas con datos válidos en el Excel')
      }

      // Crear estructura de columnas
      const columns: ExcelColumn[] = headers.map((header, index) => ({
        name: header,
        index,
        selected: true,
        mappedTo: COLUMN_MAPPINGS[header.toLowerCase()] || 'unmapped'
      }))

      // ✅ CONVERTIR: Solo las filas válidas a objetos
      const data: ExcelRow[] = validRows.map(row => {
        const obj: ExcelRow = {}
        headers.forEach((header, index) => {
          obj[header] = row[index] ? row[index].toString().trim() : ''
        })
        return obj
      })

      console.log('📊 Datos procesados:', data.length, 'estudiantes')
      console.log('📊 Ejemplo de datos:', data.slice(0, 2))

      setExcelData(data)
      setExcelPreview(data.slice(0, 5))
      setTempExcelColumns(columns)
      setShowColumnMappingModal(true)

    } catch (error) {
      console.error('Error processing Excel:', error)
      toast({
        title: "Error",
        description: "No se pudo procesar el archivo Excel",
        variant: "destructive"
      })
    } finally {
      setProcessingExcel(false)
    }
  }

  // ✅ NUEVA FUNCIÓN: Confirmar mapeo de columnas
  const confirmColumnMapping = () => {
    setExcelColumns(tempExcelColumns)
    setExcelStep('preview')
    setShowColumnMappingModal(false)
  }

  // ✅ NUEVA FUNCIÓN: Cancelar mapeo de columnas
  const cancelColumnMapping = () => {
    setShowColumnMappingModal(false)
    setExcelStep('upload')
    setExcelFile(null)
    setExcelData([])
    setTempExcelColumns([])
  }

  // ✅ NUEVA FUNCIÓN: Validar que los datos estén completos
  const isFormValid = () => {
    const basicInfoValid = newColonyName.trim() && 
                          newColonyCode.trim() && 
                          newColonyPeriodoDesde && 
                          newColonyPeriodoHasta && 
                          newColonySeason.trim()
    
    const excelValid = excelFile && excelData.length > 0 && excelStep === 'preview'
    
    return basicInfoValid && excelValid
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

  // ✅ NUEVA FUNCIÓN: Abrir modal para editar colonia
  const openEditColonyModal = (colony: Colony) => {
    setColonyToEdit(colony)
    setEditColonyData({
      name: colony.name || '',
      colony_code: colony.colony_code || '',
      description: colony.description || '',
      season_desc: colony.period_dates?.[0]?.season_desc || ''
    })
    setShowEditColonyModal(true)
  }

  // ✅ NUEVA FUNCIÓN: Actualizar colonia
  const updateColony = async () => {
    if (!colonyToEdit) return

    try {
      setIsUpdatingColony(true)

      // Validar campos obligatorios
      if (!editColonyData.name.trim() || !editColonyData.colony_code.trim()) {
        throw new Error("El nombre y código de la colonia son obligatorios")
      }

      // Actualizar colonia en la base de datos
      const { error: colonyError } = await supabase
        .from('colonies')
        .update({
          name: editColonyData.name.trim(),
          colony_code: editColonyData.colony_code.trim(),
          description: editColonyData.description.trim(),
          updated_at: new Date().toISOString()
        })
        .eq('id', colonyToEdit.id)

      if (colonyError) throw colonyError

      // ✅ CORREGIDO: Si hay descripción de temporada, actualizar el primer período Y los estudiantes
      if (editColonyData.season_desc.trim() && colonyToEdit.period_dates?.length > 0) {
        // Actualizar descripción del período (SIN updated_at porque no existe esa columna)
        const { error: periodError } = await supabase
          .from('colony_periods')
          .update({
            season_desc: editColonyData.season_desc.trim()
            // ❌ QUITAR: updated_at: new Date().toISOString()
          })
          .eq('colony_id', colonyToEdit.id)
          .eq('period_number', 1)

        if (periodError) {
          console.warn('Error actualizando descripción del período:', periodError)
          toast({
            title: "Error",
            description: `Error actualizando período: ${periodError.message}`,
            variant: "destructive"
          })
          return // ✅ Salir si hay error en el período principal
        }

        // ✅ NUEVO: Actualizar la temporada de todos los estudiantes de esta colonia
        const { error: studentsError } = await supabase
          .from('students')
          .update({
            season: editColonyData.season_desc.trim(),
            updated_at: new Date().toISOString() // ✅ Esta columna SÍ existe en students
          })
          .eq('colony_id', colonyToEdit.id)

        if (studentsError) {
          console.warn('Error actualizando temporada de estudiantes:', studentsError)
          toast({
            title: "Advertencia",
            description: "La colonia se actualizó pero no se pudo actualizar la temporada de los estudiantes",
            variant: "destructive"
          })
        } else {
          console.log('✅ Temporada de estudiantes actualizada correctamente')
        }
      }

      // Recargar colonias
      await fetchColonies()

      // Cerrar modal
      setShowEditColonyModal(false)
      setColonyToEdit(null)

      toast({
        title: "¡Colonia actualizada!",
        description: "Los cambios se guardaron correctamente",
      })

    } catch (error) {
      console.error('Error actualizando colonia:', error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "No se pudo actualizar la colonia",
        variant: "destructive"
      })
    } finally {
      setIsUpdatingColony(false)
    }
  }

  // ✅ NUEVA FUNCIÓN: Abrir modal para borrar datos de colonia
  const openDeleteDataModal = (colony: Colony) => {
    setColonyToDeleteData(colony)
    setShowDeleteDataModal(true)
  }

  // ✅ NUEVA FUNCIÓN: Borrar todos los datos de la colonia
  const deleteColonyData = async () => {
    if (!colonyToDeleteData) return

    try {
      setIsDeletingData(true)

      // Eliminar registros de asistencia
      const { error: attendanceError } = await supabase
        .from('colony_attendance')
        .delete()
        .eq('colony_id', colonyToDeleteData.id)

      if (attendanceError) {
        console.warn('Error eliminando asistencia:', attendanceError)
      }

      // Eliminar estudiantes
      const { error: studentsError } = await supabase
        .from('students')
        .delete()
        .eq('colony_id', colonyToDeleteData.id)

      if (studentsError) throw studentsError

      // Eliminar períodos
      const { error: periodsError } = await supabase
        .from('colony_periods')
        .delete()
        .eq('colony_id', colonyToDeleteData.id)

      if (periodsError) throw periodsError

      // Recargar colonias
      await fetchColonies()

      // Cerrar modal
      setShowDeleteDataModal(false)
      setColonyToDeleteData(null)

      toast({
        title: "¡Datos eliminados!",
        description: `Se eliminaron todos los datos de la colonia "${colonyToDeleteData.name}"`,
      })

    } catch (error) {
      console.error('Error eliminando datos de colonia:', error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "No se pudieron eliminar los datos",
        variant: "destructive"
      })
    } finally {
      setIsDeletingData(false)
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
    try {
      // ✅ CORRECCIÓN: Procesar fechas SIN conversiones de zona horaria
      const formatDate = (dateString: string) => {
        if (!dateString) return 'N/A'
        
        // ✅ Dividir la fecha directamente sin usar Date object
        const [year, month, day] = dateString.split('-')
        
        if (!year || !month || !day) return 'N/A'
        
        // ✅ Formatear como DD/MM sin conversiones
        return `${day}/${month}`
      }
      
      const desdeFormatted = formatDate(desde)
      const hastaFormatted = formatDate(hasta)
      
      return `${desdeFormatted} - ${hastaFormatted}`
    } catch (error) {
      console.error('Error en formatPeriodo:', error)
      return `${desde} - ${hasta}` // ✅ Fallback a formato original
    }
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
          
          {/* ✅ MODAL MEJORADO: Con carga de Excel integrada */}
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Nueva Colonia
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Crear Nueva Colonia</DialogTitle>
                <DialogDescription>
                  Configure la colonia y cargue el archivo Excel con los estudiantes
                </DialogDescription>
              </DialogHeader>
              
              <div className="grid gap-6 py-4">
                {/* SECCIÓN 1: Información básica */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Información de la Colonia</h3>
                  
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="grid gap-2">
                      <Label htmlFor="name">Nombre de la Colonia</Label>
                      <Input
                        id="name"
                        value={newColonyName}
                        onChange={(e) => setNewColonyName(e.target.value)}
                        placeholder="Ej: Colonia Gutierrez"
                        required
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="code">Código de la Colonia</Label>
                      <Input
                        id="code"
                        value={newColonyCode}
                        onChange={(e) => setNewColonyCode(e.target.value)}
                        placeholder="Ej: 2346"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="periodo">Período</Label>
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

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="grid gap-2">
                      <Label htmlFor="season">Temporada</Label>
                      <Input
                        id="season"
                        value={newColonySeason}
                        onChange={(e) => setNewColonySeason(e.target.value)}
                        placeholder="Ej: Verano 2024, Invierno 2025"
                        required
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="description">Descripción (Opcional)</Label>
                      <Input
                        id="description"
                        value={newColonyDescription}
                        onChange={(e) => setNewColonyDescription(e.target.value)}
                        placeholder="Descripción opcional"
                      />
                    </div>
                  </div>
                </div>

                {/* SECCIÓN 2: Carga de Excel - SIMPLIFICADA */}
                <div className="space-y-4 border-t pt-4">
                  <h3 className="text-lg font-semibold">Archivo de Estudiantes</h3>
                  
                  {excelStep === 'upload' && (
                    <div className="space-y-4">
                      <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center">
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept=".xlsx,.xls"
                          onChange={handleExcelUpload}
                          className="hidden"
                        />
                        <Upload className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                        <h3 className="text-lg font-semibold mb-2">Cargar archivo Excel *</h3>
                        <p className="text-muted-foreground mb-4">
                          Selecciona un archivo .xlsx o .xls con los datos de los estudiantes
                        </p>
                        <Button 
                          onClick={() => fileInputRef.current?.click()}
                          disabled={processingExcel}
                        >
                          {processingExcel ? 'Procesando...' : 'Seleccionar Archivo'}
                        </Button>
                      </div>
                    </div>
                  )}

                  {excelStep === 'preview' && excelPreview.length > 0 && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium">✅ Archivo cargado ({excelData.length} estudiantes válidos)</h4>
                        <div className="space-x-2">
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => setShowColumnMappingModal(true)}
                          >
                            Editar Mapeo
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => {
                              setExcelStep('upload')
                              setExcelFile(null)
                              setExcelData([])
                              setExcelColumns([])
                            }}
                          >
                            Cambiar Archivo
                          </Button>
                        </div>
                      </div>
                      
                      <div className="border rounded-lg overflow-hidden">
                        <div className="overflow-x-auto max-h-40">
                          <table className="w-full text-sm">
                            <thead className="bg-muted">
                              <tr>
                                {excelColumns.filter(col => col.selected).map((col, index) => (
                                  <th key={index} className="p-2 text-left font-medium">
                                    {col.name} → {col.mappedTo}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {excelPreview.map((row, rowIndex) => (
                                <tr key={rowIndex} className="border-t">
                                  {excelColumns.filter(col => col.selected).map((col, colIndex) => (
                                    <td key={colIndex} className="p-2">
                                      {row[col.name] || '-'}
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button 
                  onClick={createColony} 
                  disabled={isCreating || !isFormValid()}
                >
                  {isCreating ? "Creando..." : "Crear Colonia e Importar"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* ✅ NUEVO MODAL: Para mapeo de columnas (más grande) */}
        <Dialog open={showColumnMappingModal} onOpenChange={setShowColumnMappingModal}>
          <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Mapear Columnas del Excel</DialogTitle>
              <DialogDescription>
                Selecciona qué columnas importar y cómo mapearlas a los campos del sistema
              </DialogDescription>
            </DialogHeader>
            
            <div className="py-4">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium">Columnas encontradas: {tempExcelColumns.length}</h4>
                  <div className="space-x-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => {
                        const newColumns = tempExcelColumns.map(col => ({ ...col, selected: true }))
                        setTempExcelColumns(newColumns)
                      }}
                    >
                      Seleccionar Todas
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => {
                        const newColumns = tempExcelColumns.map(col => ({ ...col, selected: false }))
                        setTempExcelColumns(newColumns)
                      }}
                    >
                      Deseleccionar Todas
                    </Button>
                  </div>
                </div>
                
                <div className="border rounded-lg overflow-hidden">
                  <div className="max-h-96 overflow-y-auto">
                    <table className="w-full">
                      <thead className="bg-muted sticky top-0">
                        <tr>
                          <th className="p-3 text-left font-medium w-16">Usar</th>
                          <th className="p-3 text-left font-medium">Columna del Excel</th>
                          <th className="p-3 text-left font-medium">Datos de Ejemplo</th>
                          <th className="p-3 text-left font-medium w-48">Mapear a Campo</th>
                        </tr>
                      </thead>
                      <tbody>
                        {tempExcelColumns.map((column, index) => (
                          <tr key={index} className="border-t hover:bg-muted/50">
                            <td className="p-3">
                              <Checkbox
                                checked={column.selected}
                                onCheckedChange={(checked) => {
                                  const newColumns = [...tempExcelColumns]
                                  newColumns[index].selected = checked as boolean
                                  setTempExcelColumns(newColumns)
                                }}
                              />
                            </td>
                            <td className="p-3">
                              <span className="font-medium">{column.name}</span>
                            </td>
                            <td className="p-3 text-sm text-muted-foreground">
                              {excelPreview.slice(0, 3).map((row, rowIndex) => (
                                <div key={rowIndex} className="truncate max-w-32">
                                  {row[column.name] || '-'}
                                </div>
                              ))}
                            </td>
                            <td className="p-3">
                              <Select
                                value={column.mappedTo}
                                onValueChange={(value) => {
                                  const newColumns = [...tempExcelColumns]
                                  newColumns[index].mappedTo = value
                                  setTempExcelColumns(newColumns)
                                }}
                                disabled={!column.selected}
                              >
                                <SelectTrigger className="w-full">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="name">📝 Nombre Completo</SelectItem>
                                  <SelectItem value="last_name">👤 Apellido</SelectItem>
                                  <SelectItem value="student_id">🆔 ID/Cédula Estudiante</SelectItem>
                                  <SelectItem value="email">📧 Email</SelectItem>
                                  <SelectItem value="grade">🎓 Grado/Curso</SelectItem>
                                  <SelectItem value="section">📚 Sección</SelectItem>
                                  <SelectItem value="season">📅 Temporada/Año</SelectItem>
                                  <SelectItem value="unmapped">❌ No mapear</SelectItem>
                                </SelectContent>
                              </Select>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Vista previa de datos mapeados */}
                {tempExcelColumns.some(col => col.selected) && (
                  <div className="space-y-2">
                    <h5 className="font-medium">Vista Previa de Datos Mapeados:</h5>
                    <div className="border rounded-lg overflow-hidden">
                      <div className="overflow-x-auto max-h-32">
                        <table className="w-full text-sm">
                          <thead className="bg-muted">
                            <tr>
                              {tempExcelColumns.filter(col => col.selected && col.mappedTo !== 'unmapped').map((col, index) => (
                                <th key={index} className="p-2 text-left font-medium">
                                  {col.mappedTo}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {excelPreview.slice(0, 3).map((row, rowIndex) => (
                              <tr key={rowIndex} className="border-t">
                                {tempExcelColumns.filter(col => col.selected && col.mappedTo !== 'unmapped').map((col, colIndex) => (
                                  <td key={colIndex} className="p-2">
                                    {row[col.name] || '-'}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={cancelColumnMapping}>
                Cancelar
              </Button>
              <Button 
                onClick={confirmColumnMapping}
                disabled={!tempExcelColumns.some(col => col.selected)}
              >
                Confirmar Mapeo ({tempExcelColumns.filter(col => col.selected).length} columnas)
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

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
                  
                  {/* ✅ TEMPORADA ARRIBA */}
                  {colony.period_dates && colony.period_dates.length > 0 && colony.period_dates[0].season_desc && (
                    <div className="text-xs text-muted-foreground bg-green-50 px-2 py-1 rounded">
                      Temporada: {colony.period_dates[0].season_desc}
                    </div>
                  )}
                  
                  {/* ✅ PERÍODOS ABAJO */}
                  <div className="text-xs text-muted-foreground bg-blue-50 px-2 py-1 rounded">
                    {colony.period_dates && colony.period_dates.length > 0 ? (
                      <div className="space-y-1">
                        {colony.period_dates.map((period: any, index: number) => (
                          <div key={index} className="text-xs">
                            <span className="font-medium">
                              Período {period.period_number || (index + 1)}: 
                            </span>
                            {/* ✅ CORREGIDO: Fechas sin conversiones de zona horaria */}
                            {(() => {
                              const formatDate = (dateString: string) => {
                                if (!dateString) return 'N/A'
                                const [year, month, day] = dateString.split('-')
                                if (!year || !month || !day) return 'N/A'
                                return `${day}/${month}/${year}`
                              }
                              return `${formatDate(period.periodo_desde)} - ${formatDate(period.periodo_hasta)}`
                            })()}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="font-medium">
                        Período 1: {formatPeriodo(colony.periodo_desde, colony.periodo_hasta)}
                      </div>
                    )}
                  </div>
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
                    {/* ✅ CAMBIADO: Botón de Excel por Editar */}
                    <Button 
                      onClick={() => openEditColonyModal(colony)} 
                      size="sm"
                      variant="secondary"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    {/* ✅ NUEVO: Botón para borrar datos */}
                    <Button 
                      onClick={() => openDeleteDataModal(colony)} 
                      size="sm"
                      variant="secondary"
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <Eraser className="h-4 w-4" />
                    </Button>
                    {/* Botón de eliminación completa de colonia */}
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

      {/* ✅ NUEVO MODAL: Editar Colonia */}
      <Dialog open={showEditColonyModal} onOpenChange={setShowEditColonyModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Colonia</DialogTitle>
            <DialogDescription>
              Modifica los datos de la colonia seleccionada
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-name">Nombre de la colonia</Label>
              <Input
                id="edit-name"
                value={editColonyData.name}
                onChange={(e) => setEditColonyData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Nombre de la colonia"
                required
              />
            </div>
            
            <div>
              <Label htmlFor="edit-code">Código de la colonia</Label>
              <Input
                id="edit-code"
                value={editColonyData.colony_code}
                onChange={(e) => setEditColonyData(prev => ({ ...prev, colony_code: e.target.value }))}
                placeholder="Código único"
                required
              />
            </div>
            
            <div>
              <Label htmlFor="edit-season">Temporada</Label>
              <Input
                id="edit-season"
                value={editColonyData.season_desc}
                onChange={(e) => setEditColonyData(prev => ({ ...prev, season_desc: e.target.value }))}
                placeholder="Ej: Verano 2024"
              />
            </div>
            
            <div>
              <Label htmlFor="edit-description">Descripción (Opcional)</Label>
              <Textarea
                id="edit-description"
                value={editColonyData.description}
                onChange={(e) => setEditColonyData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Descripción opcional"
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setShowEditColonyModal(false)}
              disabled={isUpdatingColony}
            >
              Cancelar
            </Button>
            <Button 
              onClick={updateColony}
              disabled={isUpdatingColony}
            >
              {isUpdatingColony ? "Guardando..." : "Guardar Cambios"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ✅ NUEVO MODAL: Confirmar Borrado de Datos */}
      <Dialog open={showDeleteDataModal} onOpenChange={setShowDeleteDataModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-orange-600">Borrar Datos de la Colonia</DialogTitle>
            <DialogDescription>
              Esta acción eliminará todos los datos de la colonia, pero mantendrá la colonia creada.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-2 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Trash2 className="h-4 w-4 text-orange-500" />
              <span>Todos los estudiantes</span>
            </div>
            <div className="flex items-center gap-2">
              <Trash2 className="h-4 w-4 text-orange-500" />
              <span>Todos los períodos</span>
            </div>
            <div className="flex items-center gap-2">
              <Trash2 className="h-4 w-4 text-orange-500" />
              <span>Todos los registros de asistencia</span>
            </div>
          </div>

          <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
            <p className="text-sm text-orange-800 font-medium">
              ¿Estás seguro de que quieres borrar todos los datos de "{colonyToDeleteData?.name}"?
            </p>
            <p className="text-xs text-orange-700 mt-1">
              La colonia se mantendrá pero sin datos. Podrás volver a importar estudiantes.
            </p>
          </div>

          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setShowDeleteDataModal(false)}
              disabled={isDeletingData}
            >
              Cancelar
            </Button>
            <Button 
              variant="destructive"
              onClick={deleteColonyData}
              disabled={isDeletingData}
            >
              {isDeletingData ? "Borrando..." : "Borrar Datos"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
