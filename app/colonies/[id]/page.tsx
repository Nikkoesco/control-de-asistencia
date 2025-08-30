"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Calendar, Users, FileSpreadsheet, ArrowLeft, Plus, CheckCircle, XCircle, Clock, FileText, Loader2, Edit, Trash2, FileDown } from "lucide-react"
import { useRouter, useParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { toast } from "@/hooks/use-toast"
import { use } from 'react'
// ✅ REMOVIDO: Import de ExcelJS
// import * as ExcelJS from 'exceljs'
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface Student {
  id: string
  name: string                    // ✅ Nombre completo (nombre + apellido)
  student_id: string | null      // ✅ ID del estudiante
  colony_id: string              // ✅ ID de la colonia
  season: string                 // ✅ Temporada
  created_at: string             // ✅ Fecha de creación
  updated_at: string             // ✅ Fecha de actualización
  created_by: string             // ✅ Usuario que lo creó
}

interface AttendanceRecord {
  id: string
  student_id: string
  date: string
  status: 'present' | 'absent' | 'late'
  notes: string | null
}

interface Colony {
  id: string
  name: string
  description: string
  colony_code: string
  created_at: string
  student_count: number
  period_count: number  // ✅ NUEVO: contador de períodos desde colony_periods
}

export default function ColonyPage({ params }: { params: Promise<{ id: string }> }) {
  // ✅ DESENVOLVER params con React.use() (NO async)
  const { id: colonyId } = use(params)
  
  const [colony, setColony] = useState<Colony | null>(null)
  const [students, setStudents] = useState<Student[]>([])
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  const [savingAttendance, setSavingAttendance] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [showReport, setShowReport] = useState(false)
  const [reportData, setReportData] = useState<any[]>([])
  
  // ✅ AGREGAR: Estado para las fechas del período
  const [periodDates, setPeriodDates] = useState<string[]>([])
  const [showNewPeriodModal, setShowNewPeriodModal] = useState(false)  // ✅ NUEVO: estado para modal
  const [newPeriodData, setNewPeriodData] = useState({
    name: '',
    description: '',
    colony_code: '',
    periodo_desde: '',
    periodo_hasta: '',
    season_desc: ''
  })
  const [isCreatingPeriod, setIsCreatingPeriod] = useState(false)
  const [userProfile, setUserProfile] = useState<any>(null)  // ✅ NUEVO: estado para perfil del usuario
  
  // ✅ NUEVOS ESTADOS: Para manejar períodos
  const [colonyPeriods, setColonyPeriods] = useState<any[]>([])
  const [loadingPeriods, setLoadingPeriods] = useState(false)

  // ✅ NUEVOS ESTADOS para manejo de períodos múltiples
  const [selectedPeriod, setSelectedPeriod] = useState<number>(1)
  const [periods, setPeriods] = useState<any[]>([])
  const [currentPeriodData, setCurrentPeriodData] = useState<any>(null)

  const supabase = createClient()
  const router = useRouter()

  // ✅ useEffect para cargar datos automáticamente
  useEffect(() => {
    if (colonyId) {
      checkUserRole()
      fetchColonyData()
    }
  }, [colonyId])

  // ✅ useEffect para generar reporte automáticamente cuando cambien los datos
  useEffect(() => {
    if (colony && students.length > 0) {
      // ✅ GENERAR REPORTE AUTOMÁTICAMENTE
      generateReport()
    }
  }, [colony, students])

  const checkUserRole = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

      setIsAdmin(profile?.role === 'admin')
    } catch (error) {
      console.error('Error al verificar rol:', error)
      setIsAdmin(false)
    }
  }

  const fetchColonyData = async () => {
    try {
      setLoading(true)

      // ✅ Obtener la información de la colonia
      const { data: colonyData, error: colonyError } = await supabase
        .from('colonies')
        .select('*')
        .eq('id', colonyId)
        .single()

      if (colonyError) throw colonyError
      setColony(colonyData)

      // ✅ Obtener estudiantes del período actual
      const { data: studentsData, error: studentsError } = await supabase
        .from('students')
        .select('*')
        .eq('colony_id', colonyId)
        .eq('period_number', 1) // ✅ Filtrar por período 1
        .order('created_at', { ascending: false })

      if (studentsError) throw studentsError

      const formattedStudents = studentsData.map(student => ({
        ...student,
        registration_date: student.created_at
      }))

      setStudents(formattedStudents)
    } catch (error) {
      console.error('Error fetching colony data:', error)
      toast({
        title: "Error",
        description: "No se pudo cargar la información de la colonia",
        variant: "destructive"
      })
      router.push('/colonies')
    } finally {
      setLoading(false)
    }
  }

  const fetchAttendanceForDate = async () => {
    try {
      // ✅ Obtener asistencia directamente desde colony_attendance
      const { data, error } = await supabase
        .from('colony_attendance')
        .select('*')
        .eq('colony_id', colonyId)
        .eq('date', selectedDate)

      if (error) throw error
      setAttendanceRecords(data || [])
    } catch (error) {
      console.error('Error fetching attendance:', error)
    }
  }

  const getAttendanceStatus = (studentId: string) => {
    const record = attendanceRecords.find(r => r.student_id === studentId)
    return record?.status || null
  }

  const updateAttendance = async (studentId: string, status: 'present' | 'absent' | 'late') => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("Usuario no autenticado")

      // Check if attendance record already exists
      const existingRecord = attendanceRecords.find(r => r.student_id === studentId)

      if (existingRecord) {
        // Update existing record
        const { error } = await supabase
          .from('colony_attendance')
          .update({
            status,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingRecord.id)

        if (error) throw error
      } else {
        // Create new record
        const { error } = await supabase
          .from('colony_attendance')
          .insert({
            colony_id: colonyId,
            student_id: studentId,
            date: selectedDate,
            status,
            marked_by: user.id
          })

        if (error) throw error
      }

      // Update local state
      await fetchAttendanceForDate()
      
      toast({
        title: "Éxito",
        description: "Asistencia actualizada correctamente"
      })
    } catch (error) {
      console.error('Error updating attendance:', error)
      toast({
        title: "Error",
        description: "No se pudo actualizar la asistencia",
        variant: "destructive"
      })
    }
  }

  const saveAllAttendance = async () => {
    setSavingAttendance(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("Usuario no autenticado")

      // Get all students who don't have attendance records for this date
      const studentsWithoutAttendance = students.filter(student => 
        !attendanceRecords.find(r => r.student_id === student.id)
      )

      if (studentsWithoutAttendance.length > 0) {
        // Mark all remaining students as absent by default
        const defaultAttendance = studentsWithoutAttendance.map(student => ({
          colony_id: colonyId,
          student_id: student.id,
          date: selectedDate,
          status: 'absent' as const,
          marked_by: user.id
        }))

        const { error } = await supabase
          .from('colony_attendance')
          .insert(defaultAttendance)

        if (error) throw error
      }

      await fetchAttendanceForDate()
      
      toast({
        title: "Éxito",
        description: "Asistencia guardada para todos los estudiantes"
      })
    } catch (error) {
      console.error('Error saving attendance:', error)
      toast({
        title: "Error",
        description: "No se pudo guardar la asistencia",
        variant: "destructive"
      })
    } finally {
      setSavingAttendance(false)
    }
  }

  // ✅ FUNCIÓN: Generar reporte automáticamente (CORREGIDA)
  const generateReport = async () => {
    try {
      console.log('🔍 Generando reporte automáticamente para colonia:', colonyId)
      
      if (!colony) {
        throw new Error('No hay información de la colonia')
      }

      // ✅ CORRECCIÓN: Obtener el período desde colony_periods
      const { data: periodData, error: periodError } = await supabase
        .from('colony_periods')
        .select('periodo_desde, periodo_hasta')
        .eq('colony_id', colonyId)
        .eq('period_number', 1) // ✅ Obtener el período inicial
        .single()

      if (periodError) {
        console.error('Error obteniendo período desde colony_periods:', periodError)
        throw new Error('No se pudo obtener el período de la colonia')
      }

      if (!periodData?.periodo_desde || !periodData?.periodo_hasta) {
        throw new Error('La colonia no tiene período configurado')
      }

      console.log('📅 Período de la colonia:', periodData.periodo_desde, 'a', periodData.periodo_hasta)

      // ✅ GENERAR: Todas las fechas del período
      const dates = generateDateRange(periodData.periodo_desde, periodData.periodo_hasta)
      console.log('📊 Fechas generadas:', dates)
      
      // ✅ GUARDAR: Las fechas del período en el estado
      setPeriodDates(dates)

      // ✅ GENERAR: Reporte con las fechas específicas
      await generateReportWithDates(dates)

    } catch (error) {
      console.error('Error generando reporte automático:', error)
      // ✅ NO mostrar toast de error para reporte automático
    }
  }

  // ✅ FUNCIÓN: Generar reporte COMPLETO (período + asistencia real) - CORREGIDA
  const generateReportWithDates = async (dates: string[]) => {
    try {
      console.log('📊 Generando reporte COMPLETO para colonia:', colonyId)
      
      // ✅ PASO 1: Obtener el período de la colonia desde colony_periods
      const { data: periodData, error: periodError } = await supabase
        .from('colony_periods')
        .select('periodo_desde, periodo_hasta')
        .eq('colony_id', colonyId)
        .eq('period_number', 1)
        .single()

      if (periodError) {
        console.error('❌ Error obteniendo período desde colony_periods:', periodError)
        throw new Error('No se pudo obtener el período de la colonia')
      }

      if (!periodData?.periodo_desde || !periodData?.periodo_hasta) {
        throw new Error('La colonia no tiene período configurado')
      }

      console.log('📅 PERÍODO DE LA COLONIA:')
      console.log('  - Desde:', periodData.periodo_desde)
      console.log('  - Hasta:', periodData.periodo_hasta)

      // ✅ PASO 2: Generar TODAS las fechas del período
      const allPeriodDates = generateDateRange(periodData.periodo_desde, periodData.periodo_hasta)
      console.log('📅 FECHAS DEL PERÍODO COMPLETO:', allPeriodDates)
      console.log('  - Total días:', allPeriodDates.length)
      
      // ✅ PASO 3: Obtener TODA la asistencia de la colonia
      const { data: allAttendance, error: attendanceError } = await supabase
        .from('colony_attendance')
        .select('date, student_id, status')
        .eq('colony_id', colonyId)
        .order('date', { ascending: true })

      if (attendanceError) {
        console.error('❌ Error obteniendo asistencia:', attendanceError)
        throw new Error(`Error consultando colony_attendance: ${attendanceError.message}`)
      }

      console.log('📊 ASISTENCIA OBTENIDA:')
      console.log('  - Total registros:', allAttendance?.length || 0)
      if (allAttendance && allAttendance.length > 0) {
        allAttendance.slice(0, 3).forEach((record, index) => {
          console.log(`  Registro ${index + 1}:`, {
            date: record.date,
            student_id: record.student_id,
            status: record.status
          })
        })
      }

      // ✅ PASO 4: ACTUALIZAR el estado con TODAS las fechas del período
      setPeriodDates(allPeriodDates)

      // ✅ PASO 5: Generar reporte con TODAS las fechas del período
      const reportData = students.map(student => {
        const attendance: { [key: string]: string } = {}
        
        // ✅ INICIALIZAR: TODAS las fechas del período con "Sin Marcar"
        allPeriodDates.forEach(date => {
          attendance[date] = 'Sin Marcar'
        })
        
        console.log(`👤 PROCESANDO ESTUDIANTE: ${student.name}`)
        console.log(`  - Fechas inicializadas:`, Object.keys(attendance).length)
        
        // ✅ LLENAR: Con la asistencia real de colony_attendance
        if (allAttendance && allAttendance.length > 0) {
          allAttendance.forEach(record => {
            if (record.student_id === student.id) {
              // ✅ CONVERTIR: Fecha de YYYY-MM-DD a DD/MM/YYYY para mostrar
              const recordDate = convertDateFormat(record.date)
              
              if (attendance.hasOwnProperty(recordDate)) {
                attendance[recordDate] = record.status
                console.log(`✅ Asistencia para ${recordDate}: ${record.status}`)
              } else {
                console.log(`❌ Fecha ${recordDate} no está en el período configurado`)
              }
            }
          })
        }
        
        return {
          id: student.id,
          name: student.name,
          attendance
        }
      })

      console.log('📊 REPORTE FINAL GENERADO:')
      console.log('  - Estudiantes:', reportData.length)
      console.log('  - Fechas del período:', allPeriodDates.length)
      console.log('  - Fechas:', allPeriodDates)
      
      setReportData(reportData)

    } catch (error) {
      console.error('❌ Error generando reporte:', error)
      throw error
    }
  }

  // ✅ FUNCIÓN: Convertir formato de fecha (SIMPLE)
  const convertDateFormat = (dateString: string) => {
    try {
      // ✅ CONVERTIR: De YYYY-MM-DD a DD/MM/YYYY
      if (dateString.includes('-')) {
        const [year, month, day] = dateString.split('-')
        return `${day}/${month}/${year}`
      }
      return dateString
    } catch (error) {
      console.error('❌ Error convirtiendo fecha:', dateString, error)
      return dateString
    }
  }

  // ✅ FUNCIÓN: Generar rango de fechas del período
  const generateDateRange = (startDate: string, endDate: string) => {
    const dates: string[] = []
    
    console.log(' Generando rango de fechas del período:')
    console.log('  - Desde:', startDate)
    console.log('  - Hasta:', endDate)
    
    // ✅ CREAR: Fechas usando el formato exacto
    const start = new Date(startDate + 'T00:00:00')
    const end = new Date(endDate + 'T00:00:00')
    
    console.log('  - Desde (Date):', start)
    console.log('  - Hasta (Date):', end)
    
    // ✅ INCLUIR: El día final también
    end.setDate(end.getDate() + 1)
    console.log('  - Hasta (ajustado):', end)
    
    const current = new Date(start)
    while (current < end) {
      // ✅ FORMATO: DD/MM/YYYY para mostrar
      const day = String(current.getDate()).padStart(2, '0')
      const month = String(current.getMonth() + 1).padStart(2, '0')
      const year = current.getFullYear()
      const formattedDate = `${day}/${month}/${year}`
      
      dates.push(formattedDate)
      
      console.log(`  - Fecha generada: ${current.toISOString()} -> ${formattedDate}`)
      
      current.setDate(current.getDate() + 1)
    }
    
    console.log('📅 Fechas del período generadas:', dates)
    return dates
  }

  const getStatusIcon = (status: string | null) => {
    switch (status) {
      case 'present':
        return <CheckCircle className="h-4 w-4 text-green-600" />
      case 'absent':
        return <XCircle className="h-4 w-4 text-red-600" />
      case 'late':
        return <Clock className="h-4 w-4 text-yellow-600" />
      default:
        return null
    }
  }

  const formatWeekday = (dateString: string) => {
    try {
      console.log('📅 formatWeekday recibió:', dateString)
      
      // ✅ CORRECCIÓN: Procesar fechas sin conversiones de zona horaria
      if (dateString.includes('/')) {
        // ✅ FECHA EN FORMATO DD/MM/YYYY
        const [day, month, year] = dateString.split('/')
        const dayNum = parseInt(day, 10)
        const monthNum = parseInt(month, 10)
        const yearNum = parseInt(year, 10)
        
        // ✅ USAR: Función manual para evitar problemas de zona horaria
        return getDayOfWeek(dayNum, monthNum, yearNum)
      }
      
      // ✅ FECHA EN FORMATO YYYY-MM-DD
      if (dateString.includes('-')) {
        const [year, month, day] = dateString.split('-')
        const dayNum = parseInt(day, 10)
        const monthNum = parseInt(month, 10)
        const yearNum = parseInt(year, 10)
        
        // ✅ USAR: Función manual para evitar problemas de zona horaria
        return getDayOfWeek(dayNum, monthNum, yearNum)
      }
      
      return dateString
    } catch (error) {
      console.error('❌ Error en formatWeekday:', error)
      return dateString
    }
  }

  const formatDate = (dateString: string) => {
    // ✅ CORRECCIÓN: NO usar Date object, procesar directamente
    console.log(' formatDate recibió:', dateString)
    
    // ✅ FORZAR: Procesar la fecha sin conversiones
    if (dateString.includes('/')) {
      // ✅ FECHA EN FORMATO DD/MM/YYYY
      const [day, month, year] = dateString.split('/')
      console.log('📅 Procesando DD/MM/YYYY:', { day, month, year })
      
      // ✅ RETORNAR: Formato DD/MM sin conversiones
      return `${day}/${month}`
    } else {
      // ✅ FECHA EN FORMATO YYYY-MM-DD
      const [year, month, day] = dateString.split('-')
      console.log(' Procesando YYYY-MM-DD:', { year, month, day })
      
      // ✅ RETORNAR: Formato DD/MM sin conversiones
      return `${day}/${month}`
    }
  }

  // ✅ CORREGIDA FUNCIÓN: Calcular día de la semana manualmente
  const getDayOfWeek = (day: number, month: number, year: number): string => {
    try {
      // ✅ ALGORITMO: Zeller's congruence para calcular día de la semana
      let monthNum = month
      let yearNum = year
      
      if (monthNum < 3) {
        monthNum += 12
        yearNum -= 1
      }
      
      const k = yearNum % 100
      const j = Math.floor(yearNum / 100)
      
      const h = (day + Math.floor((13 * (monthNum + 1)) / 5) + k + Math.floor(k / 4) + Math.floor(j / 4) - 2 * j) % 7
      
      // ✅ MAPPING: 0 = Sábado, 1 = Domingo, 2 = Lunes, etc.
      const days = ['sáb', 'dom', 'lun', 'mar', 'mié', 'jue', 'vie']
      const dayOfWeek = days[h]
      
      console.log('📅 Cálculo manual:', { day, month: monthNum, year: yearNum, h, dayOfWeek })
      
      return dayOfWeek
    } catch (error) {
      console.error('❌ Error en getDayOfWeek:', error)
      return 'err'
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'present':
        return <Badge className="bg-green-100 text-green-800">P</Badge>
      case 'absent':
        return <Badge className="bg-red-100 text-red-800">A</Badge>
      default:
        return <Badge variant="outline">-</Badge>
    }
  }

  // ✅ FUNCIÓN: Exportar a CSV (sin dependencias externas)
  const exportToCSV = async (student: any) => {
    try {
      // ✅ OBTENER: Datos del estudiante para el CSV
      const studentData = reportData.find(s => s.id === student.id)
      if (!studentData) {
        toast({
          title: "Error",
          description: "No hay datos del estudiante para exportar",
          variant: "destructive"
        })
        return
      }

      // ✅ CREAR: Datos para el CSV
      const csvData = [
        // ✅ INFORMACIÓN DEL ESTUDIANTE
        ['INFORMACIÓN DEL ESTUDIANTE'],
        ['Nombre', student.name],
        ['Colonia', colony?.name || 'N/A'],
        ['Período', `${colony?.periodo_desde || 'N/A'} a ${colony?.periodo_hasta || 'N/A'}`],
        ['Días Asistidos', Object.values(studentData.attendance).filter(status => status === 'present').length],
        ['Total Días', periodDates.length],
        ['Porcentaje', `${Math.round((Object.values(studentData.attendance).filter(status => status === 'present').length / periodDates.length) * 100)}%`],
        [], // ✅ LÍNEA EN BLANCO
        // ✅ ENCABEZADOS DE ASISTENCIA
        ['FECHA', 'DÍA', 'ESTADO'],
        // ✅ DATOS DE ASISTENCIA
        ...periodDates.map(date => [
          date,
          formatWeekday(date),
          studentData.attendance[date] || 'Sin Marcar'
        ])
      ]

      // ✅ CONVERTIR: Array a CSV string
      const csvContent = csvData.map(row => row.join(',')).join('\n')

      // ✅ EXPORTAR: Descargar el archivo CSV
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `Reporte_Asistencia_${student.name.replace(/[^a-zA-Z0-9]/g, '_')}.csv`
      link.click()
      window.URL.revokeObjectURL(url)

      toast({
        title: "Éxito",
        description: `Reporte exportado para ${student.name}`,
      })

    } catch (error) {
      console.error('Error exportando a CSV:', error)
      toast({
        title: "Error",
        description: "No se pudo exportar el reporte",
        variant: "destructive"
      })
    }
  }

  // ✅ FUNCIÓN: Exportar reporte completo con formato corregido
  const exportFullReport = async () => {
    try {
      if (!reportData.length || !periodDates.length) {
        toast({
          title: "Error",
          description: "No hay datos del reporte para exportar",
          variant: "destructive"
        })
        return
      }

      // ✅ FUNCIÓN: Escapar campos CSV para evitar separación
      const escapeCSV = (field: string) => {
        // ✅ Si el campo contiene comas, comillas o saltos de línea, lo envolvemos en comillas
        if (field.includes(',') || field.includes('"') || field.includes('\n')) {
          // ✅ Escapar comillas dobles duplicándolas
          const escapedField = field.replace(/"/g, '""')
          return `"${escapedField}"`
        }
        return field
      }

      // ✅ CREAR: Datos para el CSV con formato corregido
      const csvData = [
        // ✅ ENCABEZADOS: Solo Apellido y Nombre + Fechas + Resumen
        ['Apellido y Nombre', ...periodDates.map(date => `${formatWeekday(date)} ${date}`), 'Días Asistidos', 'Total de Días', 'Porcentaje'],
        
        // ✅ DATOS DE CADA ESTUDIANTE
        ...reportData.map(student => {
          const diasAsistidos = Object.values(student.attendance).filter(status => status === 'present').length
          const totalDias = periodDates.length
          const porcentaje = totalDias > 0 ? Math.round((diasAsistidos / totalDias) * 100) : 0
          
          // ✅ FORMATO: Apellido y Nombre + Asistencia por fecha + Resumen
          return [
            escapeCSV(student.name), // ✅ Nombre completo escapado para CSV
            ...periodDates.map(date => {
              const status = student.attendance[date] || 'Sin Marcar'
              // ✅ CONVERTIR: present -> Presente, absent -> Ausente
              if (status === 'present') return 'Presente'
              if (status === 'absent') return 'Ausente'
              return status
            }),
            diasAsistidos, // ✅ Días Asistidos
            totalDias,     // ✅ Total de Días
            `${porcentaje}%` // ✅ Porcentaje
          ]
        })
      ]

      // ✅ CONVERTIR: Array a CSV string con codificación UTF-8
      const csvContent = csvData.map(row => 
        row.map(field => escapeCSV(String(field))).join(',')
      ).join('\n')

      // ✅ AGREGAR: BOM (Byte Order Mark) para UTF-8
      const BOM = '\uFEFF'
      const csvWithBOM = BOM + csvContent

      // ✅ EXPORTAR: Descargar el archivo CSV con codificación correcta
      const blob = new Blob([csvWithBOM], { 
        type: 'text/csv;charset=utf-8;' 
      })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `Reporte_Asistencia_${colony?.name?.replace(/[^a-zA-Z0-9]/g, '_') || 'Colonia'}.csv`
      link.click()
      window.URL.revokeObjectURL(url)

      toast({
        title: "Éxito",
        description: "Reporte completo exportado correctamente",
      })

    } catch (error) {
      console.error('Error exportando reporte completo:', error)
      toast({
        title: "Error",
        description: "No se pudo exportar el reporte completo",
        variant: "destructive"
      })
    }
  }

  // ✅ NUEVA FUNCIÓN: Abrir modal para nuevo período
  const openNewPeriodModal = () => {
    setNewPeriodData({
      name: colony?.name || '',  // ✅ Pre-llenar con nombre actual
      description: '',
      colony_code: colony?.colony_code || '',
      periodo_desde: '',
      periodo_hasta: '',
      season_desc: ''
    })
    setShowNewPeriodModal(true)
  }

  // ✅ MODIFICADA FUNCIÓN: Crear nuevo período (CORREGIDA)
  const createNewPeriod = async () => {
    if (!newPeriodData.periodo_desde || !newPeriodData.periodo_hasta) {
      toast({
        title: "Error",
        description: "El período es obligatorio",
        variant: "destructive"
      })
      return
    }

    if (!userProfile?.id) {
      toast({
        title: "Error",
        description: "No se pudo obtener el perfil del usuario",
        variant: "destructive"
      })
      return
    }

    try {
      setIsCreatingPeriod(true)
      
      // ✅ CORRECCIÓN: Obtener el próximo número de período correctamente
      let nextPeriodNumber = 1
      
      if (colonyPeriods && colonyPeriods.length > 0) {
        // ✅ Obtener el número más alto de período existente
        const maxPeriodNumber = Math.max(...colonyPeriods.map(p => p.period_number))
        nextPeriodNumber = maxPeriodNumber + 1
      }
      
      console.log(`🔄 Creando período número ${nextPeriodNumber}`)
      console.log(`🔄 Períodos existentes:`, colonyPeriods?.map(p => p.period_number))
      
      // ✅ CREAR: Nuevo período
      const { data, error } = await supabase
        .from('colony_periods')
        .insert({
          colony_id: colonyId,
          period_number: nextPeriodNumber,
          periodo_desde: newPeriodData.periodo_desde,
          periodo_hasta: newPeriodData.periodo_hasta,
          season_desc: newPeriodData.season_desc,
          description: newPeriodData.description,
          created_by: userProfile.id
        })
        .select()
        .single()

      if (error) throw error

      toast({
        title: "Éxito",
        description: `Nuevo período ${nextPeriodNumber} creado correctamente`,
      })

      setShowNewPeriodModal(false)
      setNewPeriodData({
        name: '',
        description: '',
        colony_code: '',
        periodo_desde: '',
        periodo_hasta: '',
        season_desc: ''
      })

      // ✅ ACTUALIZAR: Lista de períodos y redirigir
      await fetchColonyPeriods()
      router.push(`/colonies/${colonyId}/import`)
      
    } catch (error) {
      console.error('Error creating new period:', error)
      toast({
        title: "Error",
        description: "No se pudo crear el nuevo período",
        variant: "destructive"
      })
    } finally {
      setIsCreatingPeriod(false)
    }
  }

  // ✅ NUEVA FUNCIÓN: Calcular días entre fechas (igual que en colonies/page.tsx)
  const calculateDays = (desde: string, hasta: string) => {
    if (!desde || !hasta) return 0
    
    // Crear fechas y ajustar para evitar problemas de zona horaria
    const desdeDate = new Date(desde + 'T00:00:00')
    const hastaDate = new Date(hasta + 'T00:00:00')
    
    // Calcular la diferencia en días incluyendo ambos días
    const diffTime = hastaDate.getTime() - desdeDate.getTime()
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1
    
    return diffDays
  }

  // ✅ SIMPLIFICAR: Solo cargar períodos, no crear automáticamente
  const fetchColonyPeriods = async () => {
    try {
      console.log('🔄 fetchColonyPeriods ejecutándose para colonyId:', colonyId);
      setLoadingPeriods(true)
      const supabase = createClient()
      
      console.log('🔄 Cargando períodos para colonia:', colonyId)
      
      const { data, error } = await supabase
        .from('colony_periods')
        .select('*')
        .eq('colony_id', colonyId)
        .order('period_number', { ascending: true })

      if (error) throw error
      
      console.log('✅ Períodos cargados:', data);
      console.log('✅ Cantidad de períodos:', data?.length || 0);
      setColonyPeriods(data || [])
    } catch (error) {
      console.error('❌ Error en fetchColonyPeriods:', error)
    } finally {
      setLoadingPeriods(false)
    }
  }

  // ✅ AGREGAR: Función fetchUserProfile que está faltante
  const fetchUserProfile = async () => {
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (authError || !user) {
        console.error('Error de autenticación:', authError)
        return
      }

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      if (profileError) {
        console.error('Error obteniendo perfil:', profileError)
        return
      }

      setUserProfile(profile)
      console.log('✅ Perfil del usuario cargado:', profile)
      
    } catch (error) {
      console.error('Error en fetchUserProfile:', error)
    }
  }

  // ✅ SIMPLIFICAR: Solo cargar períodos al montar el componente
  useEffect(() => {
    console.log('🔄 useEffect [colonyId] ejecutándose con colonyId:', colonyId);
    if (colonyId) {
      fetchColonyPeriods()
    }
  }, [colonyId])

  // ✅ LLAMAR: Obtener perfil cuando se monta el componente
  useEffect(() => {
    fetchUserProfile()
  }, [])

  // ✅ AGREGAR: Función helper para formatear fechas sin zona horaria
  const formatPeriodoSimple = (desde: string, hasta: string) => {
    try {
      // ✅ Procesar fechas directamente sin Date object
      const formatDate = (dateString: string) => {
        if (!dateString) return 'N/A'
        
        const [year, month, day] = dateString.split('-')
        if (!year || !month || !day) return 'N/A'
        
        return `${day}/${month}/${year}`
      }
      
      const desdeFormatted = formatDate(desde)
      const hastaFormatted = formatDate(hasta)
      
      return `${desdeFormatted} - ${hastaFormatted}`
    } catch (error) {
      console.error('Error en formatPeriodoSimple:', error)
      return `${desde} - ${hasta}`
    }
  }

  // ✅ NUEVA FUNCIÓN: Cargar períodos disponibles
  const fetchPeriods = async () => {
    try {
      const { data, error } = await supabase
        .from('colony_periods')
        .select('*')
        .eq('colony_id', colonyId)
        .order('period_number', { ascending: true })

      if (error) throw error
      
      setPeriods(data || [])
      
      // Si hay períodos, seleccionar el más reciente por defecto
      if (data && data.length > 0) {
        const latestPeriod = data[data.length - 1]
        setSelectedPeriod(latestPeriod.period_number)
        setCurrentPeriodData(latestPeriod)
      }
    } catch (error) {
      console.error('Error loading periods:', error)
    }
  }

  // ✅ FUNCIÓN MODIFICADA: Cargar estudiantes del período seleccionado
  const fetchStudentsByPeriod = async (periodNumber: number) => {
    try {
      const { data: studentsData, error: studentsError } = await supabase
        .from('students')
        .select('*')
        .eq('colony_id', colonyId)
        .eq('period_number', periodNumber)
        .order('created_at', { ascending: false })

      if (studentsError) throw studentsError

      const formattedStudents = studentsData.map(student => ({
        ...student,
        registration_date: student.created_at
      }))

      setStudents(formattedStudents)
    } catch (error) {
      console.error('Error loading students for period:', error)
      setStudents([])
    }
  }

  // ✅ FUNCIÓN: Manejar cambio de período
  const handlePeriodChange = async (periodNumber: string) => {
    const periodNum = parseInt(periodNumber)
    setSelectedPeriod(periodNum)
    
    // Buscar datos del período seleccionado
    const periodData = periods.find(p => p.period_number === periodNum)
    setCurrentPeriodData(periodData)
    
    // Cargar estudiantes del período seleccionado
    await fetchStudentsByPeriod(periodNum)
    
    // Regenerar fechas del período y reporte
    if (periodData) {
      const dates = generateDateRange(periodData.periodo_desde, periodData.periodo_hasta)
      setPeriodDates(dates)
    }
  }

  // ✅ FUNCIÓN MEJORADA: Abrir modal de nuevo período que lleve a importación
  const openNewPeriodImport = async () => {
    if (!periods.length) {
      // Si no hay períodos, ir directo a importación
      router.push(`/colonies/${colonyId}/import`)
      return
    }

    // Crear nuevo período automáticamente y luego ir a importación
    const nextPeriodNumber = Math.max(...periods.map(p => p.period_number)) + 1
    
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("Usuario no autenticado")

      const { data, error } = await supabase
        .from('colony_periods')
        .insert({
          colony_id: colonyId,
          period_number: nextPeriodNumber,
          description: `Período ${nextPeriodNumber}`,
          periodo_desde: new Date().toISOString().split('T')[0], // Fecha temporal
          periodo_hasta: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // +30 días
          season_desc: new Date().getFullYear().toString(),
          created_by: user.id
        })
        .select()
        .single()

      if (error) throw error

      // Ir a la página de importación con el nuevo período
      router.push(`/colonies/${colonyId}/import?period=${nextPeriodNumber}`)
      
    } catch (error) {
      console.error('Error creating period:', error)
      toast({
        title: "Error",
        description: "No se pudo crear el nuevo período",
        variant: "destructive"
      })
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Cargando colonia...</p>
        </div>
      </div>
    )
  }

  if (!colony) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground">Colonia no encontrada</p>
          <Button onClick={() => router.push('/colonies')} className="mt-4">
            Volver a Colonias
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button 
              onClick={() => router.push('/colonies')} 
              variant="outline" 
              size="sm"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Volver a Colonias
            </Button>
            <div>
              <h1 className="text-2xl font-bold">{colony.name}</h1>
              {colony.description && (
                <p className="text-muted-foreground">{colony.description}</p>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* ✅ NUEVO: Selector de período */}
        {periods.length > 1 && (
          <Card className="mb-6">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">Período Activo</CardTitle>
                  <CardDescription>
                    Selecciona el período que deseas visualizar
                  </CardDescription>
                </div>
                <Select value={selectedPeriod.toString()} onValueChange={handlePeriodChange}>
                  <SelectTrigger className="w-[300px]">
                    <SelectValue placeholder="Seleccionar período" />
                  </SelectTrigger>
                  <SelectContent>
                    {periods.map((period) => (
                      <SelectItem key={period.id} value={period.period_number.toString()}>
                        <div className="flex flex-col items-start">
                          <span className="font-medium">
                            Período {period.period_number} - {period.season_desc || 'Sin temporada'}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {formatPeriodoSimple(period.periodo_desde, period.periodo_hasta)}
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
                      {formatPeriodoSimple(currentPeriodData.periodo_desde, currentPeriodData.periodo_hasta)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Users className="h-4 w-4" />
                    <span>{students.length} estudiantes</span>
                  </div>
                </div>
              </CardContent>
            )}
          </Card>
        )}

        {/* Colony Stats */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Estudiantes</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{students.length}</div>
              <p className="text-xs text-muted-foreground">
                Registrados en la colonia
              </p>
            </CardContent>
          </Card>
          
          {/* ✅ MODIFICAR: Cuadro de acciones mejorado */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Acciones</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {/* ✅ BOTÓN MEJORADO: Cargar Nuevo Período */}
              <Button 
                onClick={openNewPeriodImport}
                variant="outline"
                className="w-full bg-white text-gray-900 border border-gray-300 hover:bg-gray-50"
              >
                <Plus className="h-4 w-4 mr-2" />
                {periods.length === 0 ? 'Cargar Excel (Primer Período)' : 'Cargar Nuevo Período'}
              </Button>
              
              {/* ✅ BOTÓN: Editar período actual (opcional) */}
              {currentPeriodData && (
                <Button 
                  onClick={() => setShowNewPeriodModal(true)}
                  variant="outline"
                  className="w-full"
                >
                  <Edit className="h-4 w-4 mr-2" />
                  Editar Período Actual
                </Button>
              )}
              
              {/* ✅ BOTÓN EXPORTAR: Siempre visible pero grisado si no hay estudiantes */}
              <Button 
                onClick={exportFullReport} 
                className="w-full"
                disabled={students.length === 0 || !reportData.length || !periodDates.length}
              >
                <FileDown className="h-4 w-4 mr-2" />
                Exportar Reporte
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Tabs */}
        <Tabs defaultValue="students" className="w-full">
          <TabsList className="grid w-full grid-cols-2 h-16 mb-6">
            <TabsTrigger 
              value="students" 
              className="text-lg font-semibold px-8 py-4 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg"
            >
              Estudiantes
            </TabsTrigger>
            <TabsTrigger 
              value="report" 
              className="text-lg font-semibold px-8 py-4 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg"
            >
              Reporte
            </TabsTrigger>
          </TabsList>

          <TabsContent value="students" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Estudiantes registrados en la colonia</CardTitle>
                <CardDescription>
                  Gestiona los estudiantes de la {colony.name}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex items-center justify-center p-8">
                    <Loader2 className="h-8 w-8 animate-spin" />
                    <span className="ml-2">Cargando estudiantes...</span>
                  </div>
                ) : students.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b bg-muted/50">
                          <th className="p-3 text-left font-medium">Nombre</th>
                          <th className="p-3 text-center font-medium">Días Asistidos</th>
                          <th className="p-3 text-center font-medium">Total de Días del Período</th>
                          <th className="p-3 text-center font-medium">Porcentaje Asistido</th>
                        </tr>
                      </thead>
                      <tbody>
                        {students.map((student) => {
                          // ✅ CALCULAR: Días asistidos para este estudiante
                          const diasAsistidos = reportData.find(s => s.id === student.id)?.attendance 
                            ? Object.values(reportData.find(s => s.id === student.id)!.attendance).filter(status => status === 'present').length
                            : 0
                          
                          const totalDias = periodDates.length || 0
                          const porcentaje = totalDias > 0 ? Math.round((diasAsistidos / totalDias) * 100) : 0
                          
                          return (
                            <tr key={student.id} className="border-b hover:bg-muted/30">
                              <td className="p-3 font-medium">{student.name}</td>
                              <td className="p-3 text-center">
                                <span className="text-muted-foreground">
                                  {diasAsistidos}
                                </span>
                              </td>
                              <td className="p-3 text-center">
                                <span className="text-muted-foreground">
                                  {totalDias}
                                </span>
                              </td>
                              <td className="p-3 text-center">
                                <div className="flex items-center justify-center">
                                  <span className={`text-sm font-medium ${
                                    porcentaje >= 80 ? 'text-green-600' :
                                    porcentaje >= 60 ? 'text-yellow-600' :
                                    'text-red-600'
                                  }`}>
                                    {porcentaje}%
                                  </span>
                                </div>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center p-8 text-muted-foreground">
                    No hay estudiantes registrados en esta colonia
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {!isAdmin && (
            <TabsContent value="attendance" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Control de Asistencia</CardTitle>
                  <CardDescription>
                    Marca la asistencia de los estudiantes para el {new Date(selectedDate).toLocaleDateString()}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {students.length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-muted-foreground">No hay estudiantes para marcar asistencia</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {students.map((student) => {
                        const currentStatus = getAttendanceStatus(student.id)
                        
                        return (
                          <div key={student.id} className="flex items-center justify-between p-4 border rounded-lg">
                            <div className="flex items-center gap-4">
                              {getStatusIcon(currentStatus)}
                              <div>
                                <p className="font-medium">
                                  {student.name}
                                </p>
                                <p className="text-sm text-muted-foreground">
                                  ID: {student.student_id || 'N/A'}
                                </p>
                              </div>
                            </div>
                            
                            <div className="flex items-center gap-2">
                              {getStatusBadge(currentStatus)}
                              <div className="flex gap-1">
                                <Button
                                  size="sm"
                                  variant={currentStatus === 'present' ? 'default' : 'outline'}
                                  onClick={() => updateAttendance(student.id, 'present')}
                                  className="h-8 px-2"
                                >
                                  ✓
                                </Button>
                                <Button
                                  size="sm"
                                  variant={currentStatus === 'late' ? 'default' : 'outline'}
                                  onClick={() => updateAttendance(student.id, 'late')}
                                  className="h-8 px-2"
                                >
                                  ⏰
                                </Button>
                                <Button
                                  size="sm"
                                  variant={currentStatus === 'absent' ? 'default' : 'outline'}
                                  onClick={() => updateAttendance(student.id, 'absent')}
                                  className="h-8 px-2"
                                >
                                  ✗
                                </Button>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          )}

          <TabsContent value="report" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Reporte de Asistencia del Período</CardTitle>
                <CardDescription>
                  Asistencia de todos los días del período para la colonia {colony.name}
                </CardDescription>
                {/* ✅ BOTÓN REMOVIDO: Ya no aparece "Generar Reporte" */}
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex items-center justify-center p-8">
                    <Loader2 className="h-8 w-8 animate-spin" />
                    <span className="ml-2">Generando reporte automáticamente...</span>
                  </div>
                ) : reportData.length > 0 && periodDates.length > 0 ? (
                  // ✅ SCROLL HORIZONTAL FORZADO: Contenedor con scroll y ancho mínimo
                  <div className="overflow-x-auto border rounded-lg">
                    <table className="w-full" style={{ minWidth: `${Math.max(periodDates.length * 120, 800)}px` }}>
                      <thead>
                        <tr className="border-b">
                          <th 
                            className="p-3 text-left font-medium sticky left-0 z-20 text-white" 
                            style={{ 
                              minWidth: '210px',
                              backgroundColor: '#374151'
                            }}
                          >
                            Estudiante
                          </th>
                          {periodDates.map((date, index) => (
                            <th 
                              key={index} 
                              className="p-3 text-center font-medium text-white" 
                              style={{ 
                                minWidth: '120px',
                                backgroundColor: '#374151'
                              }}
                            >
                              <div className="flex flex-col items-center">
                                <span className="text-sm font-semibold">
                                  {formatWeekday(date)}
                                </span>
                                <span className="text-xs text-gray-300">
                                  {formatDate(date)}
                                </span>
                              </div>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {reportData.map((student, studentIndex) => (
                          <tr key={studentIndex} className="border-b hover:bg-muted/30">
                            <td className="p-3 font-medium sticky left-0 bg-background z-20 border-r" style={{ minWidth: '200px' }}>
                              {student.name}
                            </td>
                            {periodDates.map((date, dateIndex) => {
                              const attendance = student.attendance[date] || 'Sin Marcar'
                              
                              // ✅ ESTILOS MEJORADOS: Verde para P, Rojo para A
                              let circleStyles = ''
                              let textContent = ''
                              
                              if (attendance === 'present') {
                                circleStyles = 'bg-green-500 text-white border-green-600 shadow-lg'
                                textContent = 'P'
                              } else if (attendance === 'absent') {
                                circleStyles = 'bg-red-500 text-white border-red-600 shadow-lg'
                                textContent = 'A'
                              } else if (attendance === 'Sin Marcar') {
                                circleStyles = 'bg-slate-300 text-slate-600 border-slate-400'
                                textContent = '−'
                              } else {
                                // ✅ Para otros estados que puedan existir
                                circleStyles = 'bg-blue-500 text-white border-blue-600 shadow-lg'
                                textContent = attendance.charAt(0).toUpperCase()
                              }
                              
                              return (
                                <td key={dateIndex} className="p-3 text-center">
                                  <div className={`
                                    inline-flex items-center justify-center w-12 h-12 rounded-full 
                                    text-lg font-bold border-2 transition-all duration-200 hover:scale-110
                                    ${circleStyles}
                                  `}>
                                    {textContent}
                                  </div>
                                </td>
                              )
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center p-8 text-muted-foreground">
                    Generando reporte automáticamente...
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      {/* ✅ NUEVO: Modal para crear nuevo período con el mismo estilo */}
      <Dialog open={showNewPeriodModal} onOpenChange={setShowNewPeriodModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Crear Nuevo Período</DialogTitle>
            <DialogDescription>
              Crea un nuevo período para la {colony?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Nombre de la Colonia *</Label>
              <Input
                id="name"
                value={newPeriodData.name}
                disabled
                className="bg-gray-100 text-gray-500"
                placeholder="Ej: Colonia A"
              />
              <p className="text-xs text-muted-foreground">
                El nombre no se puede cambiar
              </p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="code">Código de la Colonia (Opcional)</Label>
              <Input
                id="code"
                value={newPeriodData.colony_code}
                disabled
                className="bg-gray-100 text-gray-500"
                placeholder="Ej: COL-001, A-2024, etc."
              />
              <p className="text-xs text-muted-foreground">
                El código no se puede cambiar
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
                    value={newPeriodData.periodo_desde}
                    onChange={(e) => setNewPeriodData({...newPeriodData, periodo_desde: e.target.value})}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="periodo_hasta" className="text-xs">Hasta</Label>
                  <Input
                    id="periodo_hasta"
                    type="date"
                    value={newPeriodData.periodo_hasta}
                    onChange={(e) => setNewPeriodData({...newPeriodData, periodo_hasta: e.target.value})}
                    required
                  />
                </div>
              </div>
              {newPeriodData.periodo_desde && newPeriodData.periodo_hasta && (
                <p className="text-xs text-muted-foreground">
                  Duración: {calculateDays(newPeriodData.periodo_desde, newPeriodData.periodo_hasta)} días
                </p>
              )}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="season">Temporada (Opcional)</Label>
              <Input
                id="season"
                value={newPeriodData.season_desc}
                onChange={(e) => setNewPeriodData({...newPeriodData, season_desc: e.target.value})}
                placeholder="Ej: Verano 2025, Invierno 2026, etc."
              />
              <p className="text-xs text-muted-foreground">
                Identifica la temporada o período específico de la colonia
              </p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="description">Descripción</Label>
              <Textarea
                id="description"
                value={newPeriodData.description}
                onChange={(e) => setNewPeriodData({...newPeriodData, description: e.target.value})}
                placeholder="Descripción opcional de la colonia"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewPeriodModal(false)}>
              Cancelar
            </Button>
            <Button onClick={createNewPeriod}>
              Crear Nuevo Período
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ✅ NUEVO: Mostrar períodos existentes */}
      {colonyPeriods.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Períodos Existentes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {colonyPeriods.map((period) => (
                <div key={period.id} className="flex items-center justify-between p-2 bg-muted rounded">
                  <div>
                    <p className="text-sm font-medium">
                      {period.season_desc || 'Sin temporada'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {/* ✅ CORREGIDO: Mostrar fechas sin conversiones de zona horaria */}
                      {formatPeriodoSimple(period.periodo_desde, period.periodo_hasta)}
                    </p>
                  </div>
                  <Badge variant="outline">
                    {period.description || 'Sin descripción'}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

