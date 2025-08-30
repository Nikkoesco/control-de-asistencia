"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { ArrowLeft, Calendar, Users, Save, Download, CheckCircle, XCircle, ChevronLeft, ChevronRight, Filter, X } from "lucide-react"
import Link from "next/link"

interface Student {
  id: string
  name: string
  student_id: string | null
  colony_id: string | null
  colony_name: string | null
  colony_code: string | null
}

interface AttendanceRecord {
  student_id: string
  status: "present" | "absent" | "unmarked" // Agregado "unmarked"
}

export default function AttendancePage() {
  const [students, setStudents] = useState<Student[]>([])
  const [selectedDate, setSelectedDate] = useState(() => {
    // ✅ CORRECCIÓN: Obtener fecha actual sin problemas de zona horaria
    const now = new Date()
    
    // ✅ CORRECCIÓN: Usar toLocaleDateString para evitar problemas UTC
    const localDate = now.toLocaleDateString('en-CA') // Formato YYYY-MM-DD
    
    console.log('📅 Fecha actual inicializada:', {
      now: now.toISOString(),
      nowLocal: now.toLocaleDateString(),
      localDate: localDate
    })
    
    return localDate
  })
  const [selectedWeek, setSelectedWeek] = useState("") // Nueva: selector de semana
  const [attendance, setAttendance] = useState<Record<string, AttendanceRecord>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isLoadingDate, setIsLoadingDate] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [userProfile, setUserProfile] = useState<any>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [colonyName, setColonyName] = useState<string>("") // ✅ NUEVO: estado para el nombre de la colonia
  const [existingAttendance, setExistingAttendance] = useState<Record<string, AttendanceRecord>>({})
  const [showWeeklyReport, setShowWeeklyReport] = useState(false) // Nueva: mostrar reporte semanal
  const [attendanceFilter, setAttendanceFilter] = useState<"all" | "present" | "absent">("all")
  const [showFilterOptions, setShowFilterOptions] = useState(false)
  const [showSuccessMessage, setShowSuccessMessage] = useState(false)
  const [isAttendanceSaved, setIsAttendanceSaved] = useState(false)
  const [colonyPeriod, setColonyPeriod] = useState<{ desde: string; hasta: string } | null>(null)
  const [colonyPeriods, setColonyPeriods] = useState<any[]>([])  // ✅ NUEVO: períodos de la colonia
  // ❌ ELIMINAR: Este estado ya no se necesita
  // const [selectedPeriodId, setSelectedPeriodId] = useState<string>('')
  
  // ✅ MANTENER: Solo estos estados para períodos
  const [selectedPeriod, setSelectedPeriod] = useState<number>(1)
  const [currentPeriodData, setCurrentPeriodData] = useState<any>(null)

  useEffect(() => {
    checkUserAndFetchData()
  }, [])

  // ✅ SOLUCIÓN NUEVA: Un solo useEffect para manejar cambios de fecha
  useEffect(() => {
    const loadAttendanceForDate = async () => {
      if (!selectedDate || !userProfile?.colony_id || students.length === 0 || isLoading) {
        return
      }

      console.log('📅 Cargando datos para fecha:', selectedDate)
      
      // Reiniciar estados INMEDIATAMENTE
      setIsAttendanceSaved(false)
      setShowSuccessMessage(false)
      setIsLoadingDate(true)
      
      // Inicializar attendance con estudiantes sin marcar
      const initialAttendance: Record<string, AttendanceRecord> = {}
      students.forEach((student) => {
        initialAttendance[student.id] = {
          student_id: student.id,
          status: "unmarked",
        }
      })
      setAttendance(initialAttendance)
      setExistingAttendance({})

      // Cargar asistencia existente
      try {
        const supabase = createClient()

        // ✅ INTENTAR PRIMERO con colony_attendance
        let { data: existingData, error: existingError } = await supabase
          .from('colony_attendance')
          .select('student_id, status, season_desc')
          .eq('colony_id', userProfile.colony_id)
          .eq('date', selectedDate)

        if (existingError) {
          console.log('⚠️ Error con colony_attendance, intentando con attendance:', existingError)
          
          // ✅ FALLBACK: Usar la tabla attendance
          const { data: fallbackData, error: fallbackError } = await supabase
            .from('attendance')
            .select('student_id, status')
            .eq('date', selectedDate)

          if (fallbackError) {
            console.log('❌ Error con ambas tablas:', fallbackError)
            setIsLoadingDate(false)
            return
          }

          existingData = fallbackData
          console.log('🔄 Usando datos de attendance (fallback)')
        } else {
          console.log('✅ Datos cargados de colony_attendance con temporada')
        }

        if (existingData && existingData.length > 0) {
          console.log('📊 Asistencia existente encontrada:', existingData.length, 'registros para fecha:', selectedDate)
          
          const existingAttendanceMap: Record<string, AttendanceRecord> = {}
          const updatedAttendance: Record<string, AttendanceRecord> = { ...initialAttendance }
          
          existingData.forEach((record) => {
            existingAttendanceMap[record.student_id] = {
              student_id: record.student_id,
              status: record.status as "present" | "absent" | "unmarked",
              ...(record.season_desc && { season: record.season_desc })
            }
            
            // Actualizar también el estado de attendance
            if (updatedAttendance[record.student_id]) {
              updatedAttendance[record.student_id] = {
                student_id: record.student_id,
                status: record.status as "present" | "absent" | "unmarked"
              }
            }
          })

          setExistingAttendance(existingAttendanceMap)
          setAttendance(updatedAttendance)

          // ✅ VERIFICAR: Si todos los estudiantes están marcados
          const allStudentsMarked = students.every(student => 
            existingAttendanceMap[student.id] && 
            existingAttendanceMap[student.id].status !== "unmarked"
          )
          
          if (allStudentsMarked) {
            console.log('✅ Todos los estudiantes están marcados para fecha:', selectedDate)
            setIsAttendanceSaved(true)
          } else {
            console.log('⚠️ Algunos estudiantes no están marcados para fecha:', selectedDate)
            setIsAttendanceSaved(false)
          }

          console.log('✅ Asistencia cargada para fecha:', selectedDate)
        } else {
          console.log('ℹ️ No hay asistencia existente para fecha:', selectedDate)
          setExistingAttendance({})
          setIsAttendanceSaved(false)
        }
      } catch (error) {
        console.error('Error cargando asistencia para fecha:', selectedDate, error)
        setIsAttendanceSaved(false)
      } finally {
        setIsLoadingDate(false)
      }
    }

    loadAttendanceForDate()
  }, [selectedDate, userProfile?.colony_id, students, isLoading])

  // ✅ ELIMINAR: Los otros useEffects que causan conflictos
  // Comentar o eliminar estos useEffects:
  /*
  useEffect(() => {
    if (students.length > 0 && selectedDate && !isLoading) {
      console.log('🔄 Students cargados, cargando asistencia existente...')
      fetchExistingAttendance()
    }
  }, [students, selectedDate, isLoading])

  useEffect(() => {
    if (students.length > 0 && Object.keys(attendance).length > 0) {
      const allMarked = students.every(student => 
        attendance[student.id] && 
        attendance[student.id].status !== "unmarked"
      )
      
      if (allMarked && Object.keys(existingAttendance).length > 0) {
        console.log('✅ Todos los estudiantes marcados detectados, actualizando estado')
        setIsAttendanceSaved(true)
      }
    }
  }, [attendance, students, existingAttendance])
  */

  // ✅ NUEVO: useEffect para cargar el período de la colonia
  useEffect(() => {
    if (userProfile?.colony_id && !isAdmin) {
      fetchColonyPeriod()
    }
  }, [userProfile?.colony_id, isAdmin])

  // ✅ LLAMAR: Cargar períodos de la colonia
  useEffect(() => {
    if (userProfile?.colony_id) {
      fetchColonyPeriods()
    }
  }, [userProfile?.colony_id])

  const checkUserAndFetchData = async () => {
    try {
      const supabase = createClient()
      
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (authError || !user) {
        window.location.href = '/auth/login'
        return
      }

      // ✅ CORRECCIÓN: Obtener perfil con información de la colonia
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select(`
          *,
          colonies:colony_id (
            id,
            name
          )
        `)
        .eq('id', user.id)
        .single()

      if (profileError || !profile) {
        window.location.href = '/dashboard'
        return
      }

      setUserProfile(profile)
      setIsAdmin(profile.role === 'admin')
      
      // ✅ NUEVO: Guardar el nombre de la colonia
      if (profile.colonies?.name) {
        setColonyName(profile.colonies.name)
      }

      if (profile.role === 'admin') {
        await fetchInitialData()
      } else if (profile.colony_id) {
        await fetchDataByColony(profile.colony_id)
      } else {
        setStudents([])
        setIsLoading(false)
      }
    } catch (error) {
      console.error('Error al verificar usuario:', error)
      window.location.href = '/dashboard'
    }
  }

  // ✅ FUNCIÓN MODIFICADA: Cargar estudiantes del período seleccionado
  const fetchStudentsByPeriod = async (colonyId: string, periodNumber: number) => {
    try {
      const supabase = createClient()

      console.log('🔍 Cargando estudiantes para colonia:', colonyId, 'período:', periodNumber)

      const { data: studentsData, error: studentsError } = await supabase
        .from('students')
        .select('*')
        .eq('colony_id', colonyId)
        .eq('period_number', periodNumber) // ✅ FILTRAR por período

      if (studentsError) {
        console.error('❌ Error al obtener estudiantes:', studentsError)
        throw studentsError
      }

      if (!studentsData || studentsData.length === 0) {
        console.log('⚠️ No se encontraron estudiantes para este período')
        setStudents([])
        return
      }

      console.log('✅ Estudiantes encontrados para el período:', studentsData.length)
      setStudents(studentsData)
      
    } catch (error) {
      console.error("Error al cargar estudiantes por período:", error)
      setStudents([])
    }
  }

  // ✅ FUNCIÓN MODIFICADA: Cargar datos del período seleccionado
  const fetchPeriodData = async (periodNumber: number) => {
    if (!userProfile?.colony_id) return

    try {
      const supabase = createClient()
      
      const { data: periodData, error: periodError } = await supabase
        .from('colony_periods')
        .select('*')
        .eq('colony_id', userProfile.colony_id)
        .eq('period_number', periodNumber)
        .single()

      if (periodError) {
        console.error('❌ Error al obtener datos del período:', periodError)
        return
      }

      if (periodData) {
        setCurrentPeriodData(periodData)
        setColonyPeriod({
          desde: periodData.periodo_desde,
          hasta: periodData.periodo_hasta
        })

        console.log('📅 Datos del período cargados:', periodData)

        // ✅ VERIFICAR que la fecha actual esté dentro del período
        const today = new Date().toISOString().split('T')[0]
        const startDate = periodData.periodo_desde
        const endDate = periodData.periodo_hasta

        if (today < startDate || today > endDate) {
          // Si la fecha actual está fuera del período, usar la fecha de inicio
          console.log('⚠️ Fecha actual fuera del período, usando fecha de inicio:', startDate)
          setSelectedDate(startDate)
        }

        // ✅ CARGAR estudiantes del período seleccionado
        await fetchStudentsByPeriod(userProfile.colony_id, periodNumber)
      }
    } catch (error) {
      console.error('Error al cargar datos del período:', error)
    }
  }

  // ✅ FUNCIÓN: Manejar cambio de período
  const handlePeriodChange = async (periodNumber: string) => {
    const periodNum = parseInt(periodNumber)
    setSelectedPeriod(periodNum)
    
    // Limpiar datos actuales
    setStudents([])
    setAttendance({})
    setExistingAttendance({})
    
    // Cargar datos del nuevo período
    await fetchPeriodData(periodNum)
  }

  // ✅ FUNCIÓN MODIFICADA: fetchDataByColony para usar período seleccionado
  const fetchDataByColony = async (colonyId: string) => {
    try {
      // Primero cargar los períodos disponibles
      await fetchColonyPeriods()
      
      // Luego cargar datos del período seleccionado (por defecto el más reciente)
      if (colonyPeriods.length > 0) {
        const latestPeriod = colonyPeriods[colonyPeriods.length - 1]
        setSelectedPeriod(latestPeriod.period_number)
        await fetchPeriodData(latestPeriod.period_number)
      } else {
        // Si no hay períodos, cargar todos los estudiantes (compatibilidad)
        const supabase = createClient()
        const { data: studentsData, error: studentsError } = await supabase
          .from('students')
          .select('*')
          .eq('colony_id', colonyId)

        if (studentsError) throw studentsError
        setStudents(studentsData || [])
      }
      
    } catch (error) {
      console.error("Error al cargar datos por colonia:", error)
      alert("Error al cargar los datos. Por favor, verifica tu conexión e intenta de nuevo.")
    } finally {
      setIsLoading(false)
    }
  }

  // ✅ FUNCIÓN MODIFICADA: fetchColonyPeriods para seleccionar período automáticamente
  const fetchColonyPeriods = async () => {
    if (!userProfile?.colony_id) return
    
    try {
      const supabase = createClient()
      
      console.log('🔍 Cargando períodos para colonia:', userProfile.colony_id)
      
      const { data: periodsData, error: periodsError } = await supabase
        .from('colony_periods')
        .select('*')
        .eq('colony_id', userProfile.colony_id)
        .order('period_number', { ascending: true })

      if (periodsError) {
        console.error('Error cargando períodos:', periodsError)
        return
      }

      console.log('📅 Períodos encontrados:', periodsData)
      setColonyPeriods(periodsData || [])
      
      // ✅ AUTO-SELECCIONAR el período más reciente si no hay uno seleccionado
      if (periodsData && periodsData.length > 0 && !selectedPeriod) {
        const latestPeriod = periodsData[periodsData.length - 1]
        setSelectedPeriod(latestPeriod.period_number)
        await fetchPeriodData(latestPeriod.period_number)
      }
      
    } catch (error) {
      console.error('Error cargando períodos:', error)
    }
  }

  // ✅ ELIMINAR: La función fetchExistingAttendance ya no se necesita
  // porque toda la lógica está en el useEffect

  const handleStatusChange = (studentId: string, status: "present" | "absent") => {
    setAttendance((prev) => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        status,
      },
    }))
  }

  const handleSaveAttendance = async () => {
    if (!selectedDate) {
      alert("Por favor selecciona una fecha")
      return
    }

    // Verificar que todos los estudiantes tengan un estado seleccionado
    const unmarkedStudents = Object.values(attendance).filter(record => record.status === "unmarked")
    if (unmarkedStudents.length > 0) {
      alert(`Tienes ${unmarkedStudents.length} estudiantes sin marcar. Por favor marca todos antes de guardar.`)
      return
    }

    setIsSaving(true)
    try {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        alert("Debes estar autenticado")
        return
      }

      // ✅ NUEVO: Obtener la temporada de la colonia actual
      let colonySeason = null
      if (userProfile?.colony_id) {
        const { data: colonyData } = await supabase
          .from('colonies')
          .select('season_desc')
          .eq('id', userProfile.colony_id)
          .single()
        
        colonySeason = colonyData?.season_desc
        console.log('🌞 Temporada de la colonia:', colonySeason)
      }

      console.log('💾 Guardando asistencia para fecha:', selectedDate)
      console.log('💾 Datos a guardar:', attendance)
      console.log('🏛️ ID de colonia:', userProfile?.colony_id)
      console.log('🌞 Temporada:', colonySeason)

      // ✅ MODIFICADO: Preparar registros con temporada
      const attendanceRecords = Object.values(attendance)
        .filter(record => record.status !== "unmarked")
        .map((record) => ({
          colony_id: userProfile?.colony_id,
          student_id: record.student_id,
          date: selectedDate,
          status: record.status,
          season_desc: colonySeason,  // ✅ NUEVO: Incluir temporada
          marked_by: user.id,
        }))

      console.log('📝 Registros preparados con temporada:', attendanceRecords)
      console.log('📝 Total de registros a guardar:', attendanceRecords.length)

      // ✅ INTENTAR PRIMERO con colony_attendance
      let deleteError = null
      let insertError = null
      let insertData = null

      try {
        console.log('💾 Intentando guardar en colony_attendance con temporada...')
        
        // Delete existing records for this date and colony
        const { error: deleteResult } = await supabase
          .from("colony_attendance")
          .delete()
          .eq("colony_id", userProfile?.colony_id)
          .eq("date", selectedDate)

        deleteError = deleteResult
        if (deleteError) {
          console.log('⚠️ Error al eliminar registros existentes:', deleteError)
        } else {
          console.log('🗑️ Registros existentes eliminados de colony_attendance')
        }

        // ✅ MODIFICADO: Insertar con temporada
        const { data: insertResult, error: insertResultError } = await supabase
          .from("colony_attendance")
          .insert(attendanceRecords)
          .select()

        insertData = insertResult
        insertError = insertResultError
        
        if (insertError) {
          console.log('❌ Error al insertar en colony_attendance:', insertError)
          throw insertError
        } else {
          console.log('✅ Registros insertados exitosamente en colony_attendance con temporada')
        }

      } catch (colonyAttendanceError) {
        console.log('⚠️ Error con colony_attendance, intentando con attendance:', colonyAttendanceError)
        
        // ✅ FALLBACK: Usar la tabla attendance (sin temporada)
        console.log('🔄 Usando fallback con attendance...')
        
        const { error: deleteResult } = await supabase
          .from("attendance")
          .delete()
          .eq("date", selectedDate)

        deleteError = deleteResult
        if (deleteError) {
          console.log('⚠️ Error al eliminar registros existentes de attendance:', deleteError)
        } else {
          console.log('🗑️ Registros existentes eliminados de attendance (fallback)')
        }

        // ✅ FALLBACK: Insertar en attendance (sin temporada)
        const { data: insertResult, error: insertResultError } = await supabase
          .from("attendance")
          .insert(attendanceRecords.map(record => ({
            student_id: record.student_id,
            date: record.date,
            status: record.status,
            marked_by: record.marked_by,
            // ❌ Sin temporada en el fallback
          })))
          .select()

        insertData = insertResult
        insertError = insertResultError
        
        if (insertError) {
          console.log('❌ Error al insertar en attendance (fallback):', insertError)
          throw insertError
        } else {
          console.log('✅ Registros insertados exitosamente en attendance (fallback)')
        }
      }

      if (deleteError) {
        console.error('❌ Error al eliminar registros existentes:', deleteError)
        throw deleteError
      }

      if (insertError) {
        console.error('❌ Error al insertar registros:', insertError)
        throw insertError
      }

      console.log('✅ Registros insertados exitosamente:', insertData)

      // Marcar que la asistencia está guardada
      setIsAttendanceSaved(true)
      
      // Mostrar mensaje de éxito
      setShowSuccessMessage(true)
      
      // Ocultar mensaje después de 8 segundos (más tiempo para que sea visible)
      setTimeout(() => {
        setShowSuccessMessage(false)
      }, 8000)

      // Recargar la asistencia para confirmar que se guardó
      // await fetchExistingAttendance() // Eliminado, ahora el useEffect se encarga
      
      console.log('🔄 Asistencia recargada después de guardar')
      
    } catch (error) {
      console.error("❌ Error al guardar asistencia:", error)
      console.error("❌ Detalles del error:", JSON.stringify(error, null, 2))
      
      // ✅ IMPORTANTE: En caso de error, NO marcar como guardada
      setIsAttendanceSaved(false)
      alert("Error al guardar la asistencia: " + (error as Error).message)
    } finally {
      setIsSaving(false)
    }
  }

  const handleDateChange = async (newDate: string) => {
    console.log('📅 Cambiando fecha de:', selectedDate, 'a:', newDate)
    
    // ✅ NUEVO: Limpiar estados al cambiar fecha
    setSelectedDate(newDate)
    setIsLoadingDate(true)
    setIsAttendanceSaved(false)  // ← REINICIAR estado de asistencia guardada
    setShowSuccessMessage(false)  // ← REINICIAR mensaje de éxito
    setAttendance({})  // ← REINICIAR estado de asistencia
    setExistingAttendance({})  // ← REINICIAR asistencia existente
    
    // Esperar un momento para que se actualice la UI
    await new Promise(resolve => setTimeout(resolve, 100))
    
    try {
      // Recargar estudiantes y asistencia para la nueva fecha
      await checkUserAndFetchData()
    } catch (error) {
      console.error('Error al cambiar fecha:', error)
    } finally {
      setIsLoadingDate(false)
    }
  }

  const exportAttendance = async () => {
    if (!selectedDate) {
      alert("Por favor selecciona una fecha")
      return
    }

    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from("attendance")
        .select(
          `
          *,
          students (name, student_id)
        `,
        )
        .eq("date", selectedDate)

      if (error) throw error

      // Create CSV content
      const csvContent = [
        ["Nombre", "ID Estudiante", "Estado"].join(","),
        ...data.map((record: any) => [
          record.students.name,
          record.students.student_id || "",
          record.status === "present" ? "Presente" : "Ausente"
        ].join(","))
      ].join("\n")

      // Download CSV
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
      const link = document.createElement("a")
      const url = URL.createObjectURL(blob)
      link.setAttribute("href", url)
      link.setAttribute("download", `asistencia_${selectedDate}.csv`)
      link.style.visibility = "hidden"
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    } catch (error) {
      console.error("Error al exportar:", error)
      alert("Error al exportar la asistencia")
    }
  }

  // ✅ CORRECCIÓN: Función para obtener el inicio de la semana de una fecha específica
  const getWeekStartFromDate = (dateString: string) => {
    const date = new Date(dateString)
    const dayOfWeek = date.getDay() // 0 = domingo, 1 = lunes, 2 = martes, etc.
    
    // ✅ CORRECCIÓN: Calcular correctamente el offset al lunes
    let mondayOffset = 0
    
    if (dayOfWeek === 0) {
      // Si es domingo, ir al lunes anterior (6 días atrás)
      mondayOffset = -6
    } else if (dayOfWeek === 1) {
      // Si es lunes, no hay offset
      mondayOffset = 0
    } else {
      // Para otros días, ir al lunes anterior
      mondayOffset = -(dayOfWeek - 1)
    }
    
    const monday = new Date(date)
    monday.setDate(date.getDate() + mondayOffset)
    
    console.log('📅 Cálculo de semana desde fecha específica:')
    console.log('  - Fecha seleccionada:', dateString)
    console.log('  - Día de la semana:', dayOfWeek, '(0=domingo, 1=lunes, etc.)')
    console.log('  - Offset al lunes:', mondayOffset)
    console.log('  - Lunes de la semana:', monday.toISOString().split('T')[0])
    
    return monday.toISOString().split('T')[0]
  }

  // ✅ CORRECCIÓN: Función para obtener el inicio de la semana actual
  const getCurrentWeekStart = () => {
    const today = new Date()
    return getWeekStartFromDate(today.toISOString().split('T')[0])
  }

  // ✅ CORRECCIÓN: Función para obtener las fechas de la semana
  const getWeekDates = (weekStart: string) => {
    const start = new Date(weekStart)
    const dates = []
    
    console.log('📅 Generando fechas de la semana:')
    console.log('  - Inicio de semana:', weekStart)
    
    for (let i = 0; i < 5; i++) { // Lunes a viernes
      const date = new Date(start)
      date.setDate(start.getDate() + i)
      const dateString = date.toISOString().split('T')[0]
      dates.push(dateString)
      
      const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
      console.log(`  - Día ${i + 1}: ${dateString} (${dayNames[date.getDay()]})`)
    }
    
    return dates
  }

  // ✅ NUEVA FUNCIÓN: Obtener fechas del período de la colonia
  const getColonyPeriodDates = async () => {
    try {
      const supabase = createClient()
      
      // ✅ OBTENER PERIODO DE LA COLONIA
      const { data: colonyData, error: colonyError } = await supabase
        .from('colonies')
        .select('periodo_desde, periodo_hasta')
        .eq('id', userProfile?.colony_id)
        .single()

      if (colonyError) {
        console.error('❌ Error al obtener período de la colonia:', colonyError)
        throw colonyError
      }

      if (!colonyData?.periodo_desde || !colonyData?.periodo_hasta) {
        console.log('⚠️ La colonia no tiene período definido')
        return []
      }

      console.log('📅 Período de la colonia (raw):', {
        desde: colonyData.periodo_desde,
        hasta: colonyData.periodo_hasta
      })

      // ✅ CORRECCIÓN: Manejar fechas sin zona horaria
      const startDate = new Date(colonyData.periodo_desde + 'T00:00:00')
      const endDate = new Date(colonyData.periodo_hasta + 'T00:00:00')
      
      console.log('📅 Fechas procesadas:', {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString()
      })
      
      const dates = []

      for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
        // Solo incluir días de lunes a viernes (1 = lunes, 5 = viernes)
        if (d.getDay() >= 1 && d.getDay() <= 5) {
          // ✅ CORRECCIÓN: Usar fecha local sin zona horaria
          const year = d.getFullYear()
          const month = String(d.getMonth() + 1).padStart(2, '0')
          const day = String(d.getDate()).padStart(2, '0')
          const dateString = `${year}-${month}-${day}`
          
          dates.push(dateString)
          
          console.log(`📅 Día procesado: ${dateString} (${d.toDateString()})`)
        }
      }

      console.log('📅 Fechas disponibles del período (lunes a viernes):', dates)
      return dates
    } catch (error) {
      console.error('Error al obtener fechas del período:', error)
      return []
    }
  }

  // ✅ NUEVA FUNCIÓN: Obtener fechas REALES con asistencia del período
  const getAttendanceDatesFromPeriod = async () => {
    if (!currentPeriodData) {
      console.log('❌ No hay datos del período actual')
      return []
    }

    try {
      // ✅ GENERAR fechas del período seleccionado
      const startDate = new Date(currentPeriodData.periodo_desde)
      const endDate = new Date(currentPeriodData.periodo_hasta)
      const dates: string[] = []
      
      const currentDate = new Date(startDate)
      while (currentDate <= endDate) {
        dates.push(currentDate.toISOString().split('T')[0])
        currentDate.setDate(currentDate.getDate() + 1)
      }
      
      console.log('📅 Fechas generadas del período:', dates)
      return dates
    } catch (error) {
      console.error('Error generando fechas del período:', error)
      return []
    }
  }

  // ✅ CORRECCIÓN: Función para cargar asistencia del período
  const fetchWeeklyAttendance = async (weekStart: string) => {
    try {
      const supabase = createClient()
      
      // ✅ OBTENER FECHAS REALES del período
      const periodDates = await getAttendanceDatesFromPeriod()
      
      if (periodDates.length === 0) {
        console.log('⚠️ No hay fechas con asistencia en el período')
        return {}
      }
      
      console.log('📊 Cargando asistencia para fechas del período:', periodDates)
      
      // ✅ INTENTAR PRIMERO con colony_attendance
      let { data, error } = await supabase
        .from("colony_attendance")
        .select("student_id, date, status")
        .eq("colony_id", userProfile?.colony_id)
        .in("date", periodDates)

      // ✅ Si hay error, intentar con attendance (fallback)
      if (error) {
        console.log('⚠️ Error con colony_attendance, intentando con attendance:', error)
        
        const fallbackResult = await supabase
          .from("attendance")
          .select("student_id, date, status")
          .in("date", periodDates)
        
        if (fallbackResult.error) {
          console.log('❌ Error también con attendance:', fallbackResult.error)
          throw fallbackResult.error
        }
        
        // Filtrar solo estudiantes de esta colonia
        const colonyStudents = students.map(s => s.id)
        data = fallbackResult.data?.filter(record => 
          colonyStudents.includes(record.student_id)
        ) || []
        
        console.log('✅ Usando fallback con attendance, datos filtrados por colonia:', data)
      }

      if (error) throw error

      // Organizar datos por estudiante y fecha
      const weeklyData: Record<string, Record<string, string>> = {}
      
      students.forEach(student => {
        weeklyData[student.id] = {}
        periodDates.forEach(date => {
          weeklyData[student.id][date] = "unmarked"
        })
      })

      // Llenar con datos existentes
      data?.forEach(record => {
        if (weeklyData[record.student_id]) {
          weeklyData[record.student_id][record.date] = record.status
          console.log(`📊 Asistencia encontrada: ${record.student_id} - ${record.date} - ${record.status}`)
        }
      })

      console.log('📊 Datos organizados por fechas del período:', weeklyData)
      return weeklyData
    } catch (error) {
      console.error("Error al cargar asistencia del período:", error)
      return {}
    }
  }

  // ✅ CORRECCIÓN: Función para exportar reporte del período
  const exportWeeklyReport = async () => {
    try {
      console.log(' Exportando reporte del período de la colonia')
      
      const weeklyData = await fetchWeeklyAttendance(selectedWeek || '')
      
      // ✅ OBTENER FECHAS REALES del período para el export
      const periodDates = await getAttendanceDatesFromPeriod()
      
      if (periodDates.length === 0) {
        alert('No hay fechas con asistencia para exportar')
        return
      }
      
      console.log('📅 Fechas del período para exportar:', periodDates)
      
      // Crear encabezados del CSV con fechas del período
      const headers = ["Estudiante", "ID", ...periodDates.map(date => {
        const d = new Date(date)
        const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
        return `${dayNames[d.getDay()]} ${d.getDate()}/${d.getMonth() + 1}`
      })]
      
      // Crear filas de datos
      const rows = students.map(student => {
        const studentData = [student.name, student.student_id || ""]
        periodDates.forEach(date => {
          const status = weeklyData[student.id]?.[date] || "unmarked"
          studentData.push(status === "present" ? "Presente" : status === "absent" ? "Ausente" : "Sin Marcar")
        })
        return studentData.join(",")
      })

      // Crear CSV
      const csvContent = [headers.join(","), ...rows].join("\n")
      
      // Descargar
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
      const link = document.createElement("a")
      const url = URL.createObjectURL(blob)
      link.setAttribute("href", url)
      link.setAttribute("download", `reporte_periodo_${userProfile?.colony_id}.csv`)
      link.style.visibility = "hidden"
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      
      console.log('✅ Reporte del período exportado exitosamente')
    } catch (error) {
      console.error("Error al exportar reporte del período:", error)
      alert("Error al exportar el reporte del período")
    }
  }

  // Filter students based on search and attendance status
  const filteredStudents = students.filter((student) => {
    const matchesSearch =
      student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      student.student_id?.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesFilter = attendanceFilter === "all" || 
      attendance[student.id]?.status === attendanceFilter
    
    return matchesSearch && matchesFilter
  })

  // Calculate statistics
  const stats = {
    present: filteredStudents.filter((s) => attendance[s.id]?.status === "present").length,
    absent: filteredStudents.filter((s) => attendance[s.id]?.status === "absent").length,
    unmarked: filteredStudents.filter((s) => attendance[s.id]?.status === "unmarked").length,
    total: filteredStudents.length,
  }

  const formatDate = (dateString: string) => {
    // Corregir el problema de zona horaria
    const date = new Date(dateString + 'T00:00:00')
    const options: Intl.DateTimeFormatOptions = {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }
    return date.toLocaleDateString('es-ES', options)
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "present":
        return <CheckCircle className="h-4 w-4 text-green-600" />
      case "absent":
        return <XCircle className="h-4 w-4 text-red-600" />
      case "unmarked":
        return <div className="h-4 w-4 rounded-full border-2 border-gray-300"></div>
      default:
        return null
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "present":
        return "bg-green-50 text-green-700 border-green-200"
      case "absent":
        return "bg-red-50 text-red-700 border-red-200"
      case "unmarked":
        return "bg-gray-50 text-gray-500 border-gray-200"
      default:
        return ""
    }
  }

  // ✅ CORRECCIÓN: Función para navegar fechas respetando el período
  const navigateDate = (direction: 'prev' | 'next') => {
    if (!currentPeriodData) return
    
    // ✅ CORRECCIÓN: Crear fechas sin zona horaria
    const [year, month, day] = selectedDate.split('-').map(Number)
    const currentDate = new Date(year, month - 1, day)
    
    const startDate = new Date(currentPeriodData.periodo_desde + 'T00:00:00')
    const endDate = new Date(currentPeriodData.periodo_hasta + 'T00:00:00')
    
    console.log('📅 Navegando fechas:', {
      fechaActual: selectedDate,
      fechaActualObj: currentDate.toISOString(),
      inicioPeriodo: startDate.toISOString(),
      finPeriodo: endDate.toISOString()
    })
    
    if (direction === 'prev') {
      // Permitir ir a días anteriores dentro del período
      const prevDate = new Date(currentDate)
      prevDate.setDate(currentDate.getDate() - 1)
      
      if (prevDate >= startDate) {
        const year = prevDate.getFullYear()
        const month = String(prevDate.getMonth() + 1).padStart(2, '0')
        const day = String(prevDate.getDate()).padStart(2, '0')
        const dateString = `${year}-${month}-${day}`
        
        console.log('📅 Navegando a fecha anterior:', dateString)
        setSelectedDate(dateString)
      } else {
        console.log('⚠️ No se puede ir antes del inicio del período:', currentPeriodData.periodo_desde)
      }
    } else if (direction === 'next') {
      // Permitir ir a días siguientes dentro del período
      const nextDate = new Date(currentDate)
      nextDate.setDate(currentDate.getDate() + 1)
      
      if (nextDate <= endDate) {
        const year = nextDate.getFullYear()
        const month = String(nextDate.getMonth() + 1).padStart(2, '0')
        const day = String(nextDate.getDate()).padStart(2, '0')
        const dateString = `${year}-${month}-${day}`
        
        console.log('📅 Navegando a fecha siguiente:', dateString)
        setSelectedDate(dateString)
      } else {
        console.log('⚠️ No se puede ir después del fin del período:', currentPeriodData.periodo_hasta)
      }
    }
  }

  // ✅ CORRECCIÓN: Función para verificar si una fecha está disponible
  const isDateAvailable = (dateString: string) => {
    if (!currentPeriodData) return true // Si no hay período, permitir todas las fechas
    
    // ✅ CORRECCIÓN: Crear fecha sin zona horaria
    const [year, month, day] = dateString.split('-').map(Number)
    const date = new Date(year, month - 1, day) // month - 1 porque getMonth() es 0-based
    
    const startDate = new Date(currentPeriodData.periodo_desde + 'T00:00:00')
    const endDate = new Date(currentPeriodData.periodo_hasta + 'T00:00:00')
    
    // Solo permitir lunes a viernes dentro del período
    const dayOfWeek = date.getDay()
    const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5 // 1 = lunes, 5 = viernes
    const isInPeriod = date >= startDate && date <= endDate
    
    console.log('🔍 Verificando fecha:', {
      fecha: dateString,
      fechaObj: date.toISOString(),
      diaSemana: dayOfWeek,
      esDiaLaboral: isWeekday,
      inicioPeriodo: startDate.toISOString(),
      finPeriodo: endDate.toISOString(),
      enPeriodo: isInPeriod,
      disponible: isWeekday && isInPeriod
    })
    
    return isWeekday && isInPeriod
  }

  // ✅ CORRECCIÓN: Función para obtener la fecha mínima y máxima
  const getMinMaxDates = () => {
    if (!currentPeriodData) return { min: null, max: null }
    
    return {
      min: currentPeriodData.periodo_desde,
      max: currentPeriodData.periodo_hasta
    }
  }

  // ✅ CORREGIDA FUNCIÓN: Obtener período de la colonia desde colony_periods
  const fetchColonyPeriod = async () => {
    if (!userProfile?.colony_id) {
      console.error('❌ No hay colony_id en userProfile:', userProfile)
      return
    }
    
    try {
      const supabase = createClient()
      
      console.log('🔍 Buscando período para colonia:', userProfile.colony_id)
      console.log('🔍 userProfile completo:', userProfile)
      
      // ✅ VERIFICAR: Primero qué colonias existen
      const { data: allColonies, error: coloniesError } = await supabase
        .from('colonies')
        .select('id, name')
      
      if (coloniesError) {
        console.error('❌ Error obteniendo colonias:', coloniesError)
        return
      }
      
      console.log('✅ Todas las colonias disponibles:', allColonies)
      
      // ✅ VERIFICAR: Qué períodos existen (con más logging)
      console.log(' Intentando obtener períodos...')
      const { data: allPeriods, error: periodsError } = await supabase
        .from('colony_periods')
        .select('colony_id, periodo_desde, periodo_hasta, period_number')

      console.log('🔍 Resultado de la consulta de períodos:')
      console.log('  - data:', allPeriods)
      console.log('  - error:', periodsError)
      console.log('  - count:', allPeriods?.length)

      if (periodsError) {
        console.error('❌ Error obteniendo todos los períodos:', periodsError)
        console.error('❌ Detalles del error:', {
          message: periodsError.message,
          details: periodsError.details,
          hint: periodsError.hint,
          code: periodsError.code
        })
        return
      }
      
      console.log('✅ Todos los períodos disponibles:', allPeriods)
      
      // ✅ CARGAR: Período específico para la colonia del usuario
      const { data: periodData, error: periodError } = await supabase
        .from('colony_periods')
        .select('periodo_desde, periodo_hasta, period_number')
        .eq('colony_id', userProfile?.colony_id)
        .order('period_number', { ascending: true })
        .limit(1)
        .single()

      if (periodError) {
        console.error('❌ Error al obtener período de la colonia:', periodError)
        console.error('❌ colony_id buscado:', userProfile?.colony_id)
        console.error('❌ colony_ids disponibles en períodos:', allPeriods?.map(p => p.colony_id))
        
        // ✅ INTENTAR: Obtener cualquier período disponible
        const { data: anyPeriodData, error: anyPeriodError } = await supabase
          .from('colony_periods')
          .select('periodo_desde, periodo_hasta, period_number')
          .eq('colony_id', userProfile?.colony_id)
          .limit(1)
          .maybeSingle()

        if (anyPeriodError) {
          console.error('❌ Error al obtener cualquier período:', anyPeriodError)
          return
        }

        if (anyPeriodData) {
          console.log('✅ Período encontrado como respaldo:', anyPeriodData)
          setColonyPeriod({
            desde: anyPeriodData.periodo_desde,
            hasta: anyPeriodData.periodo_hasta
          })
          return
        }

        // ✅ SI NO HAY PERÍODOS: Mostrar mensaje de error
        console.error('❌ No se encontraron períodos para la colonia')
        console.error('❌ colony_id del usuario:', userProfile?.colony_id)
        console.error('❌ colony_ids en períodos:', allPeriods?.map(p => p.colony_id))
        
        // Assuming toast is available globally or imported
        // toast({
        //   title: "Error",
        //   description: "No se encontraron períodos configurados para esta colonia",
        //   variant: "destructive"
        // })
        return
      }

      if (periodData?.periodo_desde && periodData?.periodo_hasta) {
        setColonyPeriod({
          desde: periodData.periodo_desde,
          hasta: periodData.periodo_hasta
        })
        
        console.log('📅 Período de la colonia cargado:', {
          desde: periodData.periodo_desde,
          hasta: periodData.periodo_hasta,
          period_number: periodData.period_number
        })
        
        // ✅ CORRECCIÓN: Verificar que la fecha actual esté dentro del período
        const today = new Date()
        const todayString = today.toISOString().split('T')[0]
        
        // ✅ CORRECCIÓN: Procesar fechas sin conversiones de zona horaria
        const startDate = new Date(periodData.periodo_desde + 'T12:00:00') // Usar mediodía para evitar problemas de zona horaria
        const endDate = new Date(periodData.periodo_hasta + 'T12:00:00')
        
        console.log('📅 Verificando fecha actual:', {
          hoy: todayString,
          inicioPeriodo: startDate.toISOString(),
          finPeriodo: endDate.toISOString(),
          enPeriodo: today >= startDate && today <= endDate
        })
        
        if (today < startDate || today > endDate) {
          // Si la fecha actual está fuera del período, usar la fecha de inicio
          console.log('⚠️ Fecha actual fuera del período, usando fecha de inicio:', periodData.periodo_desde)
          setSelectedDate(periodData.periodo_desde)
        }
      }
    } catch (error) {
      console.error('Error al obtener período de la colonia:', error)
    }
  }

  // ✅ LLAMAR: Cargar períodos cuando se monta el componente
  useEffect(() => {
    if (userProfile?.colony_id) {
      fetchColonyPeriods()
    }
  }, [userProfile?.colony_id])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p>Cargando datos...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between relative">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm" asChild>
                <Link href="/dashboard">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Volver al Dashboard
                </Link>
              </Button>
            </div>
            <h1 className="text-2xl font-bold absolute left-1/2 transform -translate-x-1/2">
              Registro de Asistencia de Colonias BNA
            </h1>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="space-y-6">
          {/* Título de la Colonia */}
          {!isAdmin && students.length > 0 && (
            <Card className="bg-gray-200/20 border border-gray-600/50 shadow-lg backdrop-blur-sm">
              <CardContent className="p-8">
                <h2 className="text-4xl font-bold text-center text-white tracking-wide">
                  {colonyName || 'Colonia'}
                </h2>
              </CardContent>
            </Card>
          )}

          {/* ✅ NUEVO: Selector de Período */}
          {colonyPeriods.length > 1 && (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg">Período Activo</CardTitle>
                    <CardDescription>
                      Selecciona el período para tomar asistencia
                    </CardDescription>
                  </div>
                  <Select value={selectedPeriod.toString()} onValueChange={handlePeriodChange}>
                    <SelectTrigger className="w-[300px]">
                      <SelectValue placeholder="Seleccionar período" />
                    </SelectTrigger>
                    <SelectContent>
                      {colonyPeriods.map((period) => (
                        <SelectItem key={period.id} value={period.period_number.toString()}>
                          <div className="flex flex-col items-start">
                            <span className="font-medium">
                              Período {period.period_number} - {period.season_desc || 'Sin temporada'}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {formatDate(period.periodo_desde)} - {formatDate(period.periodo_hasta)}
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              {currentPeriodData && (
                <CardContent className="pt-0">
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      <span>
                        {formatDate(currentPeriodData.periodo_desde)} - {formatDate(currentPeriodData.periodo_hasta)}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Users className="h-4 w-4" />
                      <span>{students.length} estudiantes</span>
                    </div>
                  </div>
                  
                  {/* ✅ INDICADOR del período activo */}
                  <div className="mt-3 inline-flex items-center gap-2 bg-blue-50 border border-blue-200 text-blue-800 px-3 py-1 rounded-md text-sm">
                    <CheckCircle className="h-4 w-4" />
                    <span>
                      Tomando asistencia para: {currentPeriodData.season_desc || `Período ${selectedPeriod}`}
                    </span>
                  </div>
                </CardContent>
              )}
            </Card>
          )}

          {/* ✅ MODIFICADO: Selector de Fecha con restricciones del período seleccionado */}
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-center gap-6">
                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => navigateDate('prev')}
                  className="h-12 w-12 p-0 hover:bg-gray-100"
                  disabled={(() => {
                    if (!currentPeriodData) return false
                    const currentDate = new Date(selectedDate)
                    const startDate = new Date(currentPeriodData.periodo_desde)
                    return currentDate <= startDate
                  })()}
                >
                  <ChevronLeft className="h-6 w-6" />
                </Button>
                
                <div className="text-center">
                  <div className="text-4xl font-bold text-primary">
                    {formatDate(selectedDate)}
                  </div>
                  {currentPeriodData && (
                    <div className="text-sm text-muted-foreground mt-2">
                      Período {selectedPeriod}: {formatDate(currentPeriodData.periodo_desde)} - {formatDate(currentPeriodData.periodo_hasta)}
                    </div>
                  )}
                </div>
                
                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => navigateDate('next')}
                  className="h-12 w-12 p-0 hover:bg-gray-100"
                  disabled={(() => {
                    if (!currentPeriodData) return false
                    const currentDate = new Date(selectedDate)
                    const endDate = new Date(currentPeriodData.periodo_hasta)
                    return currentDate >= endDate
                  })()}
                >
                  <ChevronRight className="h-6 w-6" />
                </Button>
              </div>
              
              {/* ✅ INDICADOR de período con información más específica */}
              {currentPeriodData && (
                <div className="mt-4 text-center">
                  <div className="inline-flex items-center gap-2 bg-blue-50 border border-blue-200 text-blue-800 px-4 py-2 rounded-md">
                    <Calendar className="h-4 w-4" />
                    <span className="text-sm font-medium">
                      Solo puedes tomar asistencia en fechas del {currentPeriodData.season_desc || `Período ${selectedPeriod}`}
                    </span>
                  </div>
                </div>
              )}
              
              {/* Mensaje de éxito o estado guardado - CORREGIDO */}
              {showSuccessMessage && (
                <div className="mt-4 flex justify-center">
                  <div className="bg-green-100 border border-green-300 text-green-800 px-6 py-3 rounded-md flex items-center gap-2 shadow-md">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    <span className="font-medium text-lg">
                      ¡Asistencia guardada exitosamente!
                    </span>
                  </div>
                </div>
              )}
              
              {/* Indicador de estado guardado - MEJORADO */}
              {isAttendanceSaved && !showSuccessMessage && (
                <div className="mt-4 flex justify-center">
                  <div className="bg-green-100 border border-green-300 text-green-800 px-4 py-2 rounded-md flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <span className="font-medium">Asistencia completa guardada</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* ✅ MENSAJE cuando no hay estudiantes en el período */}
          {!isLoading && students.length === 0 && currentPeriodData && (
            <Card>
              <CardContent className="p-8 text-center">
                <Users className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No hay estudiantes en este período</h3>
                <p className="text-muted-foreground mb-4">
                  El {currentPeriodData.season_desc || `Período ${selectedPeriod}`} no tiene estudiantes registrados.
                </p>
                <p className="text-sm text-muted-foreground">
                  Selecciona otro período o contacta al administrador para cargar estudiantes.
                </p>
              </CardContent>
            </Card>
          )}

          {/* Weekly Report View */}
          {showWeeklyReport && selectedWeek && (
            <WeeklyReportView 
              students={students}
              weekStart={selectedWeek}
              searchTerm={searchTerm}
              onExport={exportWeeklyReport}
              userProfile={userProfile}
              currentPeriod={currentPeriodData} // ✅ PASAR datos del período
            />
          )}

          {/* Daily Attendance View */}
          {!showWeeklyReport && selectedDate && (
            <>
              {/* Loading indicator for date change */}
              {isLoadingDate && (
                <Alert>
                  <AlertDescription className="flex items-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                    Cargando asistencia para {formatDate(selectedDate)}...
                  </AlertDescription>
                </Alert>
              )}

              {/* Statistics */}
              <div className="grid grid-cols-4 gap-4">
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-5 w-5 text-green-600" />
                      <div>
                        <div className="text-2xl font-bold text-green-600">{stats.present}</div>
                        <div className="text-sm text-muted-foreground">Presentes</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2">
                      <XCircle className="h-5 w-5 text-red-600" />
                      <div>
                        <div className="text-2xl font-bold text-red-600">{stats.absent}</div>
                        <div className="text-sm text-muted-foreground">Ausentes</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2">
                      <div className="h-5 w-5 rounded-full border-2 border-gray-400"></div>
                      <div>
                        <div className="text-2xl font-bold text-gray-600">{stats.unmarked}</div>
                        <div className="text-sm text-muted-foreground">Sin Marcar</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2">
                      <Users className="h-5 w-5 text-blue-600" />
                      <div>
                        <div className="text-2xl font-bold text-blue-600">{stats.total}</div>
                        <div className="text-sm text-muted-foreground">Total</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Filters and Actions */}
              <Card>
                <CardContent className="p-4">
                  <div className="flex flex-wrap items-center gap-4">
                    <Input
                      placeholder="Buscar estudiante..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="max-w-xs"
                    />
                    
                    {/* Filtro de Asistencia */}
                    <div className="relative">
                      {attendanceFilter === "all" ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setShowFilterOptions(true)}
                          className="flex items-center gap-2"
                        >
                          <Filter className="h-4 w-4" />
                          Filtrar
                        </Button>
                      ) : (
                        <div className="flex gap-2">
                          {attendanceFilter === "present" && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="border-green-200 text-green-700 hover:bg-green-50"
                            >
                              <CheckCircle className="h-4 w-4 mr-2" />
                              Presentes
                            </Button>
                          )}
                          {attendanceFilter === "absent" && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="border-red-200 text-red-700 hover:bg-red-50"
                            >
                              <XCircle className="h-4 w-4 mr-2" />
                              Ausentes
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setAttendanceFilter("all")}
                            className="text-gray-500 hover:text-gray-700"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                      
                      {/* Opciones del filtro cuando se hace clic en "Filtrar" */}
                      {showFilterOptions && attendanceFilter === "all" && (
                        <div className="absolute top-full left-0 mt-2 bg-white border rounded-md shadow-lg p-2 z-10">
                          <div className="flex flex-col gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setAttendanceFilter("present")
                                setShowFilterOptions(false)
                              }}
                              className="border-green-200 text-green-700 hover:bg-green-50 justify-start"
                            >
                              <CheckCircle className="h-4 w-4 mr-2" />
                              Presentes
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setAttendanceFilter("absent")
                                setShowFilterOptions(false)
                              }}
                              className="border-red-200 text-red-700 hover:bg-red-50 justify-start"
                            >
                              <XCircle className="h-4 w-4 mr-2" />
                              Ausentes
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* ❌ ELIMINADO: Selector de Período al lado de Filtrar */}
                    {/* Ya no necesitamos este dropdown porque usamos el selector de período principal arriba */}
                    
                    <div className="flex gap-2 ml-auto">
                      {/* ✅ CORRECCIÓN: Solo mostrar botón de exportar para administradores */}
                      {isAdmin && (
                        <Button variant="outline" size="sm" onClick={exportAttendance}>
                          <Download className="h-4 w-4 mr-2" />
                          Exportar
                        </Button>
                      )}
                      <Button onClick={handleSaveAttendance} disabled={isSaving || isLoadingDate}>
                        <Save className="h-4 w-4 mr-2" />
                        {isSaving ? "Guardando..." : "Guardar"}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Existing attendance alert - CORREGIDA */}
              {Object.keys(existingAttendance).length > 0 && 
               !isLoadingDate && 
               !isAttendanceSaved && 
               Object.values(attendance).some(record => record.status === "unmarked") && (
                <Alert>
                  <AlertDescription>
                    Hay algunos registros de asistencia para esta fecha, pero no todos los estudiantes están marcados. Puedes completar la lista y guardar.
                  </AlertDescription>
                </Alert>
              )}

              {/* Attendance Table - Mejorada */}
              <Card>
                <CardHeader>
                  <CardTitle>Lista de Asistencia</CardTitle>
                  <CardDescription>
                    Marca la asistencia para cada estudiante. Los cambios se guardarán al hacer clic en "Guardar".
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {isLoadingDate ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="text-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                        <p>Cargando lista de asistencia...</p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {/* Estudiantes sin marcar - Vista principal */}
                      <div>
                        <div className="rounded-md border bg-gray-50">
                          <Table>
                            <TableHeader>
                              <TableRow className="bg-gray-100">
                                <TableHead className="min-w-[300px] text-gray-800 font-semibold">Estudiante</TableHead>
                                <TableHead className="text-center text-gray-800 font-semibold">Acciones</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {filteredStudents
                                .filter(student => attendance[student.id]?.status === "unmarked")
                                .map((student) => (
                                  <TableRow key={student.id} className="bg-white hover:bg-blue-50 border-b border-gray-200">
                                    <TableCell>
                                      <div className="font-semibold text-lg text-gray-900">
                                        {student.name}
                                      </div>
                                    </TableCell>
                                    <TableCell>
                                      <div className="flex gap-3 justify-center">
                                        <Button
                                          size="lg"
                                          variant="outline"
                                          className="border-green-500 text-green-700 hover:bg-green-100 hover:border-green-600 px-6 font-medium"
                                          onClick={() => handleStatusChange(student.id, "present")}
                                          disabled={isLoadingDate}
                                        >
                                          <CheckCircle className="h-5 w-5 mr-2" />
                                          Presente
                                        </Button>
                                        <Button
                                          size="lg"
                                          variant="outline"
                                          className="border-red-500 text-red-700 hover:bg-red-100 hover:border-red-600 px-6 font-medium"
                                          onClick={() => handleStatusChange(student.id, "absent")}
                                          disabled={isLoadingDate}
                                        >
                                          <XCircle className="h-5 w-5 mr-2" />
                                          Ausente
                                        </Button>
                                      </div>
                                    </TableCell>
                                  </TableRow>
                                ))}
                            </TableBody>
                          </Table>
                        </div>
                      </div>

                      {/* Estudiantes ya marcados - Vista secundaria */}
                      {filteredStudents.filter(s => attendance[s.id]?.status !== "unmarked").length > 0 && (
                        <div>
                          <h3 className="text-lg font-semibold mb-4 text-gray-700">
                            Estudiantes Marcados ({filteredStudents.filter(s => attendance[s.id]?.status !== "unmarked").length})
                          </h3>
                          <div className="rounded-md border bg-gray-50">
                            <Table>
                              <TableHeader>
                                <TableRow className="bg-gray-100">
                                  <TableHead className="min-w-[300px] text-gray-800 font-semibold">Estudiante</TableHead>
                                  <TableHead className="text-center text-gray-800 font-semibold">Estado</TableHead>
                                  <TableHead className="text-center text-gray-800 font-semibold">Acciones</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {filteredStudents
                                  .filter(student => attendance[student.id]?.status !== "unmarked")
                                  .map((student) => (
                                    <TableRow key={student.id} className={`${getStatusColor(attendance[student.id]?.status)} border-b border-gray-200`}>
                                      <TableCell>
                                        <div className="font-semibold text-lg text-gray-900">
                                          {student.name}
                                        </div>
                                      </TableCell>
                                      <TableCell className="text-center">
                                        <div className="flex items-center justify-center gap-2">
                                          {getStatusIcon(attendance[student.id]?.status)}
                                          <span className="capitalize font-medium">
                                            {attendance[student.id]?.status === "present" ? "Presente" : "Ausente"}
                                          </span>
                                        </div>
                                      </TableCell>
                                      <TableCell>
                                        <div className="flex gap-2 justify-center">
                                          <Button
                                            size="sm"
                                            variant="outline"
                                            className="border-green-500 text-green-700 hover:bg-green-100 hover:border-green-600 font-medium"
                                            onClick={() => handleStatusChange(student.id, "present")}
                                            disabled={isLoadingDate}
                                          >
                                            <CheckCircle className="h-4 w-4 mr-2" />
                                            Presente
                                          </Button>
                                          <Button
                                            size="sm"
                                            variant="outline"
                                            className="border-red-500 text-red-700 hover:bg-red-100 hover:border-red-600 font-medium"
                                            onClick={() => handleStatusChange(student.id, "absent")}
                                            disabled={isLoadingDate}
                                          >
                                            <XCircle className="h-4 w-4 mr-2" />
                                            Ausente
                                          </Button>
                                          <Button
                                            size="sm"
                                            variant="ghost"
                                            className="text-gray-600 hover:text-gray-800 hover:bg-gray-100 font-medium"
                                            onClick={() => handleStatusChange(student.id, "unmarked")}
                                            disabled={isLoadingDate}
                                          >
                                            Desmarcar
                                          </Button>
                                        </div>
                                      </TableCell>
                                    </TableRow>
                                  ))}
                              </TableBody>
                            </Table>
                          </div>
                        </div>
                      )}

                      {/* Mensaje cuando no hay estudiantes sin marcar - MEJORADO */}
                      {filteredStudents.filter(s => attendance[s.id]?.status === "unmarked").length === 0 && (
                        <Alert className="border-green-200 bg-green-50">
                          <CheckCircle className="h-4 w-4 text-green-600" />
                          <AlertDescription className="text-green-800 font-medium">
                            ¡Excelente! Todos los estudiantes han sido marcados. Puedes guardar la asistencia o cambiar algún estado si es necesario.
                          </AlertDescription>
                        </Alert>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </main>
    </div>
  )
}
