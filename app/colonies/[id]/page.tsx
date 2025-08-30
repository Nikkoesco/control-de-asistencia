"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Calendar, Users, FileSpreadsheet, ArrowLeft, Plus, CheckCircle, XCircle, Clock, FileText, Loader2, Edit, Trash2, FileDown, Upload } from "lucide-react"
import { useRouter, useParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { toast } from "@/hooks/use-toast"
import { use } from 'react'
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import * as XLSX from 'xlsx'

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

interface ExcelRow {
  [key: string]: any
}

interface ExcelColumn {
  name: string
  index: number
  selected: boolean
  mappedTo: string
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
  'section': 'section'
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

  // ✅ RESTAURAR ESTADOS: Para manejo de Excel en el modal de período
  const [periodExcelFile, setPeriodExcelFile] = useState<File | null>(null)
  const [periodExcelData, setPeriodExcelData] = useState<ExcelRow[]>([])
  const [periodExcelColumns, setPeriodExcelColumns] = useState<ExcelColumn[]>([])
  const [periodExcelPreview, setPeriodExcelPreview] = useState<ExcelRow[]>([])
  const [periodExcelStep, setPeriodExcelStep] = useState<'upload' | 'columns' | 'preview'>('upload')
  const [processingPeriodExcel, setProcessingPeriodExcel] = useState(false)
  const [showPeriodColumnMappingModal, setShowPeriodColumnMappingModal] = useState(false)
  const [tempPeriodExcelColumns, setTempPeriodExcelColumns] = useState<ExcelColumn[]>([])

  // ✅ NUEVOS ESTADOS para editar y eliminar períodos
  const [showEditPeriodModal, setShowEditPeriodModal] = useState(false)
  const [showDeletePeriodModal, setShowDeletePeriodModal] = useState(false)
  const [periodToEdit, setPeriodToEdit] = useState<any>(null)
  const [periodToDelete, setPeriodToDelete] = useState<any>(null)
  const [editPeriodData, setEditPeriodData] = useState({
    season_desc: '',
    periodo_desde: '',
    periodo_hasta: ''
  })
  const [isUpdatingPeriod, setIsUpdatingPeriod] = useState(false)
  const [isDeletingPeriod, setIsDeletingPeriod] = useState(false)

  const periodFileInputRef = useRef<HTMLInputElement>(null)

  const supabase = createClient()
  const router = useRouter()

  // ✅ useEffect para cargar datos automáticamente
  useEffect(() => {
    if (colonyId) {
      checkUserRole()
      fetchColonyData()
      fetchPeriods() // ✅ AGREGAR: Cargar períodos disponibles
    }
  }, [colonyId])

  // ✅ CORREGIDO: useEffect para generar reporte automáticamente
  useEffect(() => {
    if (colony && currentPeriodData) {
      // ✅ GENERAR REPORTE AUTOMÁTICAMENTE - incluso si no hay estudiantes
      generateReportForSelectedPeriod()
    }
  }, [colony, students, currentPeriodData]) // ✅ AGREGAR currentPeriodData como dependencia

  // ✅ NUEVA FUNCIÓN: Generar reporte para el período seleccionado
  const generateReportForSelectedPeriod = async () => {
    try {
      console.log('🔍 Generando reporte para período seleccionado:', selectedPeriod)
      
      if (!colony || !currentPeriodData) {
        console.log('❌ No hay colonia o período seleccionado')
        return
      }

      console.log('📅 Período seleccionado:', currentPeriodData.periodo_desde, 'a', currentPeriodData.periodo_hasta)

      // ✅ GENERAR: Todas las fechas del período seleccionado
      const dates = generateDateRange(currentPeriodData.periodo_desde, currentPeriodData.periodo_hasta)
      console.log('📊 Fechas generadas para período', selectedPeriod, ':', dates)
      
      // ✅ GUARDAR: Las fechas del período en el estado
      setPeriodDates(dates)

      // ✅ GENERAR: Reporte con las fechas específicas del período seleccionado
      await generateReportWithDatesForPeriod(dates, selectedPeriod)

    } catch (error) {
      console.error('Error generando reporte para período seleccionado:', error)
    }
  }

  // ✅ NUEVA FUNCIÓN: Generar reporte para un período específico
  const generateReportWithDatesForPeriod = async (dates: string[], periodNumber: number) => {
    try {
      console.log('📊 Generando reporte COMPLETO para período:', periodNumber)
      
      if (!currentPeriodData) {
        throw new Error('No hay datos del período seleccionado')
      }

      console.log('📅 PERÍODO SELECCIONADO:')
      console.log('  - Desde:', currentPeriodData.periodo_desde)
      console.log('  - Hasta:', currentPeriodData.periodo_hasta)
      console.log('  - Número:', periodNumber)

      // ✅ PASO 1: Generar TODAS las fechas del período seleccionado
      const allPeriodDates = generateDateRange(currentPeriodData.periodo_desde, currentPeriodData.periodo_hasta)
      console.log('📅 FECHAS DEL PERÍODO SELECCIONADO:', allPeriodDates)
      console.log('  - Total días:', allPeriodDates.length)
      
      // ✅ PASO 2: Obtener TODA la asistencia de la colonia para este período
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

      // ✅ PASO 3: ACTUALIZAR el estado con TODAS las fechas del período seleccionado
      setPeriodDates(allPeriodDates)

      // ✅ PASO 4: Generar reporte con TODAS las fechas del período seleccionado
      const reportData = students.map(student => {
        const attendance: { [key: string]: string } = {}
        
        // ✅ INICIALIZAR: TODAS las fechas del período seleccionado con "Sin Marcar"
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
                console.log(`❌ Fecha ${recordDate} no está en el período seleccionado`)
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

  // ✅ AGREGAR: Función helper para calcular días entre fechas
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
        
        // Cargar estudiantes del período más reciente
        await fetchStudentsByPeriod(latestPeriod.period_number)
      }
    } catch (error) {
      console.error('Error loading periods:', error)
    }
  }

  // ✅ FUNCIÓN MEJORADA: Cargar estudiantes del período seleccionado
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

  // ✅ FUNCIÓN MEJORADA: Manejar cambio de período
  const handlePeriodChange = async (periodNumber: string) => {
    const periodNum = parseInt(periodNumber)
    setSelectedPeriod(periodNum)
    
    // Buscar datos del período seleccionado
    const periodData = periods.find(p => p.period_number === periodNum)
    setCurrentPeriodData(periodData)
    
    // Cargar estudiantes del período seleccionado
    await fetchStudentsByPeriod(periodNum)
    
    // ✅ IMPORTANTE: Generar fechas y reporte inmediatamente, incluso si no hay estudiantes
    if (periodData) {
      const dates = generateDateRange(periodData.periodo_desde, periodData.periodo_hasta)
      setPeriodDates(dates)
      
      // ✅ GENERAR REPORTE: Incluso si students está vacío
      console.log('🔄 Generando reporte para período vacío o con estudiantes')
      await generateReportWithDatesForPeriod(dates, periodNum)
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
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (authError) {
        console.error('Error de autenticación:', authError)
        throw new Error(`Error de autenticación: ${authError.message}`)
      }
      
      if (!user) {
        throw new Error("Usuario no autenticado")
      }

      console.log('🔄 Creando nuevo período:', {
        colony_id: colonyId,
        period_number: nextPeriodNumber,
        user_id: user.id
      })

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

      if (error) {
        console.error('Error detallado de Supabase:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        })
        throw error
      }

      console.log('✅ Período creado exitosamente:', data)

      toast({
        title: "Éxito",
        description: `Nuevo período ${nextPeriodNumber} creado correctamente`,
      })

      // Ir a la página de importación con el nuevo período
      router.push(`/colonies/${colonyId}/import?period=${nextPeriodNumber}`)
      
    } catch (error) {
      console.error('Error creating period:', error)
      
      // Mostrar error más específico
      let errorMessage = "No se pudo crear el nuevo período"
      if (error instanceof Error) {
        errorMessage = error.message
      } else if (typeof error === 'object' && error !== null) {
        errorMessage = JSON.stringify(error)
      }
      
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive"
      })
    }
  }

  // ✅ FUNCIÓN CORREGIDA: Manejar importación según el estado de la colonia
  const handleImportAction = () => {
    if (!periods.length) {
      // Si no hay períodos, ir directo a importación para crear el primer período
      router.push(`/colonies/${colonyId}/import`)
    } else {
      // Si ya hay períodos, mostrar modal para configurar nuevo período
      setShowNewPeriodModal(true)
    }
  }

  // ✅ RESTAURAR FUNCIÓN: Validar formulario de nuevo período
  const isPeriodFormValid = () => {
    return (
      newPeriodData.periodo_desde.trim() !== "" &&
      newPeriodData.periodo_hasta.trim() !== "" &&
      periodExcelData.length > 0
    )
  }

  // ✅ RESTAURAR FUNCIÓN: Manejar carga de archivo Excel para período
  const handlePeriodExcelUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setPeriodExcelFile(file)
    setProcessingPeriodExcel(true)

    try {
      const arrayBuffer = await file.arrayBuffer()
      const workbook = XLSX.read(arrayBuffer, { type: 'array' })
      const sheetName = workbook.SheetNames[0]
      const worksheet = workbook.Sheets[sheetName]
      
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { 
        header: 1, 
        defval: '',
        raw: false
      })

      if (jsonData.length < 2) {
        throw new Error('El archivo debe tener al menos una fila de encabezados y una fila de datos')
      }

      const headers = jsonData[0] as string[]
      const allRows = jsonData.slice(1) as any[][]
      const validRows = allRows.filter(row => {
        return row && row.some(cell => cell && cell.toString().trim() !== '')
      })

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

      // Convertir filas válidas a objetos
      const data: ExcelRow[] = validRows.map(row => {
        const obj: ExcelRow = {}
        headers.forEach((header, index) => {
          obj[header] = row[index] || ''
        })
        return obj
      })

      setPeriodExcelData(data)
      setPeriodExcelColumns(columns)
      setPeriodExcelPreview(data.slice(0, 5))
      setTempPeriodExcelColumns([...columns])
      setPeriodExcelStep('preview')

      toast({
        title: "Archivo cargado",
        description: `Se encontraron ${data.length} estudiantes válidos`,
      })

    } catch (error) {
      console.error('Error reading Excel file:', error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "No se pudo leer el archivo Excel",
        variant: "destructive"
      })
    } finally {
      setProcessingPeriodExcel(false)
    }
  }

  // ✅ RESTAURAR FUNCIÓN: Aplicar mapeo de columnas para período
  const applyPeriodColumnMapping = () => {
    setPeriodExcelColumns([...tempPeriodExcelColumns])
    setShowPeriodColumnMappingModal(false)
    
    // Actualizar preview con las columnas seleccionadas
    const selectedColumns = tempPeriodExcelColumns.filter(col => col.selected)
    if (selectedColumns.length > 0) {
      setPeriodExcelPreview(periodExcelData.slice(0, 5))
    }
  }

  // ✅ FUNCIÓN MODIFICADA: Crear nuevo período con estudiantes de Excel
  const createNewPeriod = async () => {
    if (!isPeriodFormValid()) {
      toast({
        title: "Error",
        description: "Complete las fechas del período y cargue el archivo Excel",
        variant: "destructive"
      })
      return
    }

    try {
      setIsCreatingPeriod(true)

      // Validar autenticación
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (authError || !user) {
        throw new Error("Usuario no autenticado")
      }

      // Obtener el siguiente número de período
      const nextPeriodNumber = periods.length > 0 
        ? Math.max(...periods.map(p => p.period_number)) + 1 
        : 1

      console.log(`🔄 Creando período número ${nextPeriodNumber}`)

      // PASO 1: Crear el período
      const { data: periodData, error: periodError } = await supabase
        .from('colony_periods')
        .insert({
          colony_id: colonyId,
          period_number: nextPeriodNumber,
          periodo_desde: newPeriodData.periodo_desde,
          periodo_hasta: newPeriodData.periodo_hasta,
          season_desc: newPeriodData.season_desc.trim() || `Período ${nextPeriodNumber}`,
          description: newPeriodData.description.trim(),
          created_by: user.id
        })
        .select()
        .single()

      if (periodError) {
        throw new Error(`Error creando período: ${periodError.message}`)
      }

      // PASO 2: Procesar y crear estudiantes
      const selectedColumns = periodExcelColumns.filter(col => col.selected)
      const studentsToInsert = periodExcelData.map(row => {
        const student: any = {
          colony_id: colonyId,
          period_number: nextPeriodNumber,
          created_by: user.id,
          // ✅ AGREGAR: Campo season obligatorio
          season: newPeriodData.season_desc.trim() || `Período ${nextPeriodNumber}`
        }

        selectedColumns.forEach(col => {
          const value = row[col.name]
          if (value && col.mappedTo !== 'unmapped') {
            student[col.mappedTo] = value.toString().trim()
          }
        })

        // Validaciones básicas
        if (!student.name) {
          student.name = 'Sin nombre'
        }
        if (!student.student_id) {
          student.student_id = `AUTO_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        }

        return student
      })

      // Insertar estudiantes en lotes
      const batchSize = 100
      for (let i = 0; i < studentsToInsert.length; i += batchSize) {
        const batch = studentsToInsert.slice(i, i + batchSize)
        const { error: studentsError } = await supabase
          .from('students')
          .insert(batch)

        if (studentsError) {
          throw new Error(`Error insertando estudiantes (lote ${Math.floor(i/batchSize) + 1}): ${studentsError.message}`)
        }
      }

      // PASO 3: Limpiar formulario y cerrar modal
      setNewPeriodData({
        name: '',
        description: '',
        colony_code: '',
        periodo_desde: '',
        periodo_hasta: '',
        season_desc: ''
      })
      setPeriodExcelFile(null)
      setPeriodExcelData([])
      setPeriodExcelColumns([])
      setPeriodExcelPreview([])
      setPeriodExcelStep('upload')
      setShowNewPeriodModal(false)

      // PASO 4: Recargar datos
      await fetchPeriods()

      toast({
        title: "¡Período creado exitosamente!",
        description: `Se creó el período ${nextPeriodNumber} con ${studentsToInsert.length} estudiantes`,
      })

    } catch (error) {
      console.error('Error creando período:', error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "No se pudo crear el período",
        variant: "destructive"
      })
    } finally {
      setIsCreatingPeriod(false)
    }
  }

  // ✅ NUEVA FUNCIÓN: Abrir modal para editar período
  const openEditPeriodModal = (period: any) => {
    setPeriodToEdit(period)
    setEditPeriodData({
      season_desc: period.season_desc || '',
      periodo_desde: period.periodo_desde || '',
      periodo_hasta: period.periodo_hasta || ''
    })
    setShowEditPeriodModal(true)
  }

  // ✅ NUEVA FUNCIÓN: Actualizar período
  const updatePeriod = async () => {
    if (!periodToEdit) return

    try {
      setIsUpdatingPeriod(true)

      // Validar fechas
      if (!editPeriodData.periodo_desde || !editPeriodData.periodo_hasta) {
        throw new Error("Las fechas de inicio y fin son obligatorias")
      }

      const fechaDesde = new Date(editPeriodData.periodo_desde)
      const fechaHasta = new Date(editPeriodData.periodo_hasta)

      if (fechaDesde >= fechaHasta) {
        throw new Error("La fecha de inicio debe ser anterior a la fecha de fin")
      }

      // Actualizar período en la base de datos
      const { error } = await supabase
        .from('colony_periods')
        .update({
          season_desc: editPeriodData.season_desc.trim(),
          periodo_desde: editPeriodData.periodo_desde,
          periodo_hasta: editPeriodData.periodo_hasta,
          updated_at: new Date().toISOString()
        })
        .eq('id', periodToEdit.id)

      if (error) throw error

      // Recargar períodos
      await fetchPeriods()

      // Cerrar modal
      setShowEditPeriodModal(false)
      setPeriodToEdit(null)

      toast({
        title: "¡Período actualizado!",
        description: "Los cambios se guardaron correctamente",
      })

    } catch (error) {
      console.error('Error actualizando período:', error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "No se pudo actualizar el período",
        variant: "destructive"
      })
    } finally {
      setIsUpdatingPeriod(false)
    }
  }

  // ✅ NUEVA FUNCIÓN: Abrir modal para eliminar período
  const openDeletePeriodModal = (period: any) => {
    setPeriodToDelete(period)
    setShowDeletePeriodModal(true)
  }

  // ✅ NUEVA FUNCIÓN: Eliminar período
  const deletePeriod = async () => {
    if (!periodToDelete) return

    try {
      setIsDeletingPeriod(true)

      // Verificar si hay estudiantes en este período
      const { data: studentsInPeriod, error: studentsError } = await supabase
        .from('students')
        .select('id')
        .eq('colony_id', colonyId)
        .eq('period_number', periodToDelete.period_number)

      if (studentsError) throw studentsError

      if (studentsInPeriod && studentsInPeriod.length > 0) {
        // Si hay estudiantes, eliminarlos primero
        const { error: deleteStudentsError } = await supabase
          .from('students')
          .delete()
          .eq('colony_id', colonyId)
          .eq('period_number', periodToDelete.period_number)

        if (deleteStudentsError) throw deleteStudentsError

        // También eliminar registros de asistencia
        const { error: deleteAttendanceError } = await supabase
          .from('colony_attendance')
          .delete()
          .eq('colony_id', colonyId)
          .eq('period_number', periodToDelete.period_number)

        if (deleteAttendanceError) {
          console.warn('Error eliminando asistencia:', deleteAttendanceError)
        }
      }

      // Eliminar el período
      const { error: deletePeriodError } = await supabase
        .from('colony_periods')
        .delete()
        .eq('id', periodToDelete.id)

      if (deletePeriodError) throw deletePeriodError

      // Recargar períodos
      await fetchPeriods()

      // Si el período eliminado era el seleccionado, seleccionar otro
      if (selectedPeriod === periodToDelete.period_number) {
        const remainingPeriods = periods.filter(p => p.id !== periodToDelete.id)
        if (remainingPeriods.length > 0) {
          setSelectedPeriod(remainingPeriods[0].period_number)
        }
      }

      // Cerrar modal
      setShowDeletePeriodModal(false)
      setPeriodToDelete(null)

      toast({
        title: "¡Período eliminado!",
        description: `Se eliminó el período ${periodToDelete.period_number} y todos sus datos asociados`,
      })

    } catch (error) {
      console.error('Error eliminando período:', error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "No se pudo eliminar el período",
        variant: "destructive"
      })
    } finally {
      setIsDeletingPeriod(false)
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
        {/* Colony Stats - REORGANIZADO */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 mb-8">
          {/* Card 1: Total Estudiantes */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Estudiantes</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{students.length}</div>
              <p className="text-xs text-muted-foreground">
                {currentPeriodData ? `Período ${selectedPeriod}` : 'Registrados en la colonia'}
              </p>
            </CardContent>
          </Card>

          {/* Card 2: MODIFICADA - Selector de Período con botones de editar/eliminar */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Período Activo</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {periods.length > 0 ? (
                <div className="space-y-3">
                  <Select value={selectedPeriod.toString()} onValueChange={handlePeriodChange}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Seleccionar período" />
                    </SelectTrigger>
                    <SelectContent>
                      {periods.map((period) => (
                        <SelectItem key={period.id} value={period.period_number.toString()}>
                          <div className="flex flex-col items-start">
                            <span className="font-medium">
                              Período {period.period_number}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {period.season_desc 
                                ? `${period.season_desc} - ${formatPeriodoSimple(period.periodo_desde, period.periodo_hasta)}`
                                : formatPeriodoSimple(period.periodo_desde, period.periodo_hasta)
                              }
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  
                  {/* ✅ NUEVOS BOTONES: Editar y Eliminar período (solo para admin) */}
                  {isAdmin && (
                   <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const currentPeriod = periods.find(p => p.period_number === selectedPeriod)
                          if (currentPeriod) openDeletePeriodModal(currentPeriod)
                        }}
                        className="w-full text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4 mr-1" />
                        Eliminar Período
                      </Button>
                  )}
                </div>
              ) : (
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">Sin períodos</p>
                  <p className="text-xs text-muted-foreground">Carga el primer período</p>
                </div>
              )}
            </CardContent>
          </Card>
          
          {/* Card 3: Acciones */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Acciones</CardTitle>
              <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="space-y-2">
              {/* Botón: Importar Excel / Nuevo Período */}
              <Button 
                onClick={handleImportAction}
                variant="outline"
                size="sm"
                className="w-full"
              >
                <Plus className="h-4 w-4 mr-2" />
                {periods.length === 0 ? 'Importar Excel' : 'Nuevo Período'}
              </Button>
              
              {/* Botón: Exportar Reporte - Solo si hay datos */}
              {periods.length > 0 && (
                <Button 
                  onClick={exportFullReport} 
                  size="sm"
                  className="w-full"
                  disabled={students.length === 0 || !reportData.length || !periodDates.length}
                >
                  <FileDown className="h-4 w-4 mr-2" />
                  Exportar Reporte
                </Button>
              )}
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

      {/* ✅ MODAL RESTAURADO: Crear nuevo período con Excel */}
      <Dialog open={showNewPeriodModal} onOpenChange={setShowNewPeriodModal}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Configurar Nuevo Período</DialogTitle>
            <DialogDescription>
              Define las fechas del nuevo período y carga el archivo Excel con los estudiantes
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-6 py-4">
            {/* SECCIÓN 1: Información del período */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Información del Período</h3>
              
              <div className="grid gap-2">
                <Label htmlFor="periodo">Fechas del Período</Label>
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

              <div className="grid gap-4 md:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="season">Temporada</Label>
                  <Input
                    id="season"
                    value={newPeriodData.season_desc}
                    onChange={(e) => setNewPeriodData({...newPeriodData, season_desc: e.target.value})}
                    placeholder="Ej: Verano 2025, Invierno 2026, etc."
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="description">Descripción (Opcional)</Label>
                  <Input
                    id="description"
                    value={newPeriodData.description}
                    onChange={(e) => setNewPeriodData({...newPeriodData, description: e.target.value})}
                    placeholder="Descripción del período"
                  />
                </div>
              </div>
            </div>

            {/* SECCIÓN 2: Carga de Excel */}
            <div className="space-y-4 border-t pt-4">
              <h3 className="text-lg font-semibold">Archivo de Estudiantes</h3>
              
              {periodExcelStep === 'upload' && (
                <div className="space-y-4">
                  <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center">
                    <input
                      ref={periodFileInputRef}
                      type="file"
                      accept=".xlsx,.xls"
                      onChange={handlePeriodExcelUpload}
                      className="hidden"
                    />
                    <Upload className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-semibold mb-2">Cargar archivo Excel</h3>
                    <p className="text-muted-foreground mb-4">
                      Selecciona un archivo .xlsx o .xls con los datos de los estudiantes
                    </p>
                    <Button 
                      onClick={() => periodFileInputRef.current?.click()}
                      disabled={processingPeriodExcel}
                    >
                      {processingPeriodExcel ? 'Procesando...' : 'Seleccionar Archivo'}
                    </Button>
                  </div>
                </div>
              )}

              {periodExcelStep === 'preview' && periodExcelPreview.length > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium">✅ Archivo cargado ({periodExcelData.length} estudiantes válidos)</h4>
                    <div className="space-x-2">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => setShowPeriodColumnMappingModal(true)}
                      >
                        Editar Mapeo
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => {
                          setPeriodExcelStep('upload')
                          setPeriodExcelFile(null)
                          setPeriodExcelData([])
                          setPeriodExcelColumns([])
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
                            {periodExcelColumns.filter(col => col.selected).map((col, index) => (
                              <th key={index} className="p-2 text-left font-medium">
                                {col.name} → {col.mappedTo}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {periodExcelPreview.map((row, rowIndex) => (
                            <tr key={rowIndex} className="border-t">
                              {periodExcelColumns.filter(col => col.selected).map((col, colIndex) => (
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
            <Button variant="outline" onClick={() => setShowNewPeriodModal(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={createNewPeriod}
              disabled={isCreatingPeriod || !isPeriodFormValid()}
            >
              {isCreatingPeriod ? 'Creando...' : 'Crear Período e Importar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ✅ MODAL RESTAURADO: Para mapeo de columnas del período */}
      <Dialog open={showPeriodColumnMappingModal} onOpenChange={setShowPeriodColumnMappingModal}>
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
                <h4 className="font-medium">Columnas encontradas: {tempPeriodExcelColumns.length}</h4>
                <div className="space-x-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => {
                      const newColumns = tempPeriodExcelColumns.map(col => ({ ...col, selected: true }))
                      setTempPeriodExcelColumns(newColumns)
                    }}
                  >
                    Seleccionar Todas
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => {
                      const newColumns = tempPeriodExcelColumns.map(col => ({ ...col, selected: false }))
                      setTempPeriodExcelColumns(newColumns)
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
                      {tempPeriodExcelColumns.map((column, index) => (
                        <tr key={index} className="border-t hover:bg-muted/50">
                          <td className="p-3">
                            <Checkbox
                              checked={column.selected}
                              onCheckedChange={(checked) => {
                                const newColumns = [...tempPeriodExcelColumns]
                                newColumns[index].selected = checked as boolean
                                setTempPeriodExcelColumns(newColumns)
                              }}
                            />
                          </td>
                          <td className="p-3">
                            <span className="font-medium">{column.name}</span>
                          </td>
                          <td className="p-3 text-sm text-muted-foreground">
                            {periodExcelPreview.slice(0, 3).map((row, rowIndex) => (
                              <div key={rowIndex} className="truncate max-w-32">
                                {row[column.name] || '-'}
                              </div>
                            ))}
                          </td>
                          <td className="p-3">
                            <Select
                              value={column.mappedTo}
                              onValueChange={(value) => {
                                const newColumns = [...tempPeriodExcelColumns]
                                newColumns[index].mappedTo = value
                                setTempPeriodExcelColumns(newColumns)
                              }}
                            >
                              <SelectTrigger className="w-full">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="unmapped">No mapear</SelectItem>
                                <SelectItem value="name">Nombre</SelectItem>
                                <SelectItem value="last_name">Apellido</SelectItem>
                                <SelectItem value="student_id">ID Estudiante</SelectItem>
                                <SelectItem value="email">Email</SelectItem>
                                <SelectItem value="grade">Grado</SelectItem>
                                <SelectItem value="section">Sección</SelectItem>
                              </SelectContent>
                            </Select>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPeriodColumnMappingModal(false)}>
              Cancelar
            </Button>
            <Button onClick={applyPeriodColumnMapping}>
              Aplicar Mapeo
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

      {/* ✅ NUEVO MODAL: Editar Período */}
      <Dialog open={showEditPeriodModal} onOpenChange={setShowEditPeriodModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Período {periodToEdit?.period_number}</DialogTitle>
            <DialogDescription>
              Modifica los datos del período seleccionado
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-season-desc">Descripción del período</Label>
              <Input
                id="edit-season-desc"
                value={editPeriodData.season_desc}
                onChange={(e) => setEditPeriodData(prev => ({ ...prev, season_desc: e.target.value }))}
                placeholder="Ej: Primer Semestre 2024"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit-periodo-desde">Fecha de inicio</Label>
                <Input
                  id="edit-periodo-desde"
                  type="date"
                  value={editPeriodData.periodo_desde}
                  onChange={(e) => setEditPeriodData(prev => ({ ...prev, periodo_desde: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="edit-periodo-hasta">Fecha de fin</Label>
                <Input
                  id="edit-periodo-hasta"
                  type="date"
                  value={editPeriodData.periodo_hasta}
                  onChange={(e) => setEditPeriodData(prev => ({ ...prev, periodo_hasta: e.target.value }))}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setShowEditPeriodModal(false)}
              disabled={isUpdatingPeriod}
            >
              Cancelar
            </Button>
            <Button 
              onClick={updatePeriod}
              disabled={isUpdatingPeriod}
            >
              {isUpdatingPeriod ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Guardando...
                </>
              ) : (
                'Guardar Cambios'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ✅ NUEVO MODAL: Confirmar Eliminación de Período */}
      <Dialog open={showDeletePeriodModal} onOpenChange={setShowDeletePeriodModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-red-600">Eliminar Período {periodToDelete?.period_number}</DialogTitle>
            <DialogDescription>
              Esta acción no se puede deshacer. Se eliminarán:
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-2 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <XCircle className="h-4 w-4 text-red-500" />
              <span>El período y sus fechas</span>
            </div>
            <div className="flex items-center gap-2">
              <XCircle className="h-4 w-4 text-red-500" />
              <span>Todos los estudiantes del período</span>
            </div>
            <div className="flex items-center gap-2">
              <XCircle className="h-4 w-4 text-red-500" />
              <span>Todos los registros de asistencia</span>
            </div>
          </div>

          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
            <p className="text-sm text-red-800 font-medium">
              ¿Estás seguro de que quieres eliminar el período "{periodToDelete?.season_desc || `Período ${periodToDelete?.period_number}`}"?
            </p>
          </div>

          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setShowDeletePeriodModal(false)}
              disabled={isDeletingPeriod}
            >
              Cancelar
            </Button>
            <Button 
              variant="destructive"
              onClick={deletePeriod}
              disabled={isDeletingPeriod}
            >
              {isDeletingPeriod ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Eliminando...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Eliminar Período
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

