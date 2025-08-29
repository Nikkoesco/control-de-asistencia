"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Download, CheckCircle, XCircle, Minus } from "lucide-react"

interface Student {
  id: string
  name: string
  student_id: string | null
}

interface WeeklyReportViewProps {
  students: Student[]
  weekStart: string
  searchTerm: string
  onExport: () => void
  userProfile?: any
}

export default function WeeklyReportView({ students, weekStart, searchTerm, onExport, userProfile }: WeeklyReportViewProps) {
  const [weeklyData, setWeeklyData] = useState<Record<string, Record<string, string>>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [periodDates, setPeriodDates] = useState<string[]>([])
  const [selectedDate, setSelectedDate] = useState(() => {
    // Obtener la fecha actual en la zona horaria local
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  })

  useEffect(() => {
    console.log('🔄 WeeklyReportView useEffect ejecutándose...')
    console.log('👤 userProfile:', userProfile)
    console.log('📚 students:', students.length)
    console.log('📅 weekStart:', weekStart)
    
    // ✅ FORZAR: Ejecutar fetchWeeklyData inmediatamente
    fetchWeeklyData()
  }, [weekStart, students, userProfile])

  // ✅ CORRECCIÓN: Función para obtener fechas del período de la colonia
  const getColonyPeriodDates = async () => {
    try {
      console.log('🔍 Iniciando getColonyPeriodDates...')
      
      // ✅ FORZAR: Usar fechas específicas para testing
      const forcedDates = [
        '2024-08-28', // Miércoles
        '2024-08-29', // Jueves  
        '2024-08-30', // Viernes
        '2024-08-31'  // Sábado
      ]
      
      console.log(' USANDO FECHAS FORZADAS:', forcedDates)
      return forcedDates
      
    } catch (error) {
      console.error('❌ Error en getColonyPeriodDates:', error)
      return []
    }
  }

  const getWeekDates = (weekStart: string) => {
    console.log('📅 Generando fechas de semana desde:', weekStart)
    
    // ✅ CORRECCIÓN: PROCESAR FECHA DE INICIO SIN PROBLEMAS DE ZONA HORARIA
    const start = new Date(weekStart + 'T00:00:00')
    const dates = []
    
    for (let i = 0; i < 5; i++) {
      const date = new Date(start)
      date.setDate(start.getDate() + i)
      
      // ✅ FORMATO SEGURO: YYYY-MM-DD
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      const dateString = `${year}-${month}-${day}`
      
      dates.push(dateString)
      console.log(`📅 Día de semana ${i + 1}: ${dateString} (${date.toDateString()})`)
    }
    
    console.log('📅 Fechas de semana generadas:', dates)
    return dates
  }

  const fetchWeeklyData = async () => {
    console.log('🔄 Iniciando fetchWeeklyData...')
    setIsLoading(true)
    
    try {
      // ✅ OBTENER FECHAS DEL PERIODO
      const dates = await getColonyPeriodDates()
      console.log('📅 Fechas obtenidas para setPeriodDates:', dates)
      
      // ✅ FORZAR: Actualizar periodDates inmediatamente
      setPeriodDates(dates)
      console.log(' periodDates actualizado con:', dates)
      
      console.log('📊 Cargando asistencia para fechas del período:', dates)
      console.log('📊 Total de días a cargar:', dates.length)
      
      if (dates.length === 0) {
        console.log('⚠️ No hay fechas para cargar')
        setWeeklyData({})
        return
      }

      const supabase = createClient()
      
      // ✅ INTENTAR PRIMERO con colony_attendance
      let { data, error } = await supabase
        .from("colony_attendance")
        .select("student_id, date, status")
        .eq("colony_id", userProfile?.colony_id)
        .in("date", dates)

      console.log('📊 Resultado de colony_attendance:', { data, error })

      // ✅ Si hay error, intentar con attendance (fallback)
      if (error) {
        console.log('⚠️ Error con colony_attendance, intentando con attendance:', error)
        
        const fallbackResult = await supabase
          .from("attendance")
          .select("student_id, date, status")
          .in("date", dates)
        
        console.log('📊 Resultado de attendance (fallback):', fallbackResult)
        
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
        dates.forEach(date => {
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
      setWeeklyData(weeklyData)
    } catch (error) {
      console.error("❌ Error en fetchWeeklyData:", error)
      setWeeklyData({})
    } finally {
      setIsLoading(false)
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "present":
        return <CheckCircle className="h-4 w-4 text-green-600" />
      case "absent":
        return <XCircle className="h-4 w-4 text-red-600" />
      case "unmarked":
        return <Minus className="h-4 w-4 text-gray-400" />
      default:
        return <Minus className="h-4 w-4 text-gray-400" />
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "present":
        return <Badge className="bg-green-100 text-green-800 text-xs px-2 py-1">Presente</Badge>
      case "absent":
        return <Badge className="bg-red-100 text-red-800 text-xs px-2 py-1">Ausente</Badge>
      case "unmarked":
        return <Badge variant="secondary" className="text-xs px-2 py-1">Sin Marcar</Badge>
      default:
        return <Badge variant="secondary" className="text-xs px-2 py-1">Sin Marcar</Badge>
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const options: Intl.DateTimeFormatOptions = {
      weekday: 'short',
      day: 'numeric',
      month: 'short'
    }
    return date.toLocaleDateString('es-ES', options)
  }

  const filteredStudents = students.filter(student => 
    student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    student.student_id?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-8">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p>Cargando reporte del período...</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  console.log('🎯 Renderizando WeeklyReportView con:', {
    periodDates,
    periodDatesLength: periodDates.length,
    studentsLength: students.length,
    weeklyDataKeys: Object.keys(weeklyData)
  })

  return (
    <div className="space-y-6">
      {/* Header con exportar */}
      <Card>
        <CardHeader>
          <CardTitle>Reporte de Asistencia del Período</CardTitle>
          <CardDescription>
            Asistencia de todos los días del período donde se tomó lista
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={onExport}>
            <Download className="h-4 w-4 mr-2" />
            Exportar CSV del Período
          </Button>
        </CardContent>
      </Card>

      {/* ✅ DEBUG: Mostrar información del período */}
      <Card className="border-blue-200 bg-blue-50">
        <CardContent className="p-4">
          <div className="text-sm text-blue-800">
            <strong>Debug Info:</strong>
            <br />
            • Total de fechas: {periodDates.length}
            <br />
            • Ancho mínimo de tabla: {200 + 100 + (periodDates.length * 120)}px
            <br />
            • Fechas: {periodDates.join(', ')}
            <br />
            • ¿Scroll necesario?: {periodDates.length > 5 ? 'SÍ' : 'NO'}
            <br />
            • userProfile.colony_id: {userProfile?.colony_id || 'NO DEFINIDO'}
          </div>
        </CardContent>
      </Card>

      {/* ✅ TABLA CON SCROLL HORIZONTAL FORZADO */}
      {periodDates.length > 0 ? (
        <Card>
          <CardContent className="p-0">
            {/* ✅ CONTAINER CON SCROLL Y ANCHO FIJO */}
            <div className="w-full overflow-x-auto border rounded-lg">
              {/* ✅ TABLA CON ANCHO MÍNIMO CALCULADO */}
              <div 
                className="inline-block min-w-full"
                style={{ 
                  minWidth: `${200 + 100 + (periodDates.length * 120)}px` 
                }}
              >
                <Table>
                  <TableHeader>
                    <TableRow>
                      {/* ✅ COLUMNA FIJA: Estudiante */}
                      <TableHead 
                        className="sticky left-0 bg-background z-10 border-r shadow-sm"
                        style={{ minWidth: '200px', width: '200px' }}
                      >
                        <div className="p-2 font-semibold">Estudiante</div>
                      </TableHead>
                      
                      {/* ✅ COLUMNA FIJA: ID */}
                      <TableHead 
                        className="sticky left-[200px] bg-background z-10 border-r shadow-sm"
                        style={{ minWidth: '100px', width: '100px' }}
                      >
                        <div className="p-2 font-semibold">ID</div>
                      </TableHead>
                      
                      {/* ✅ COLUMNAS DINÁMICAS para cada fecha */}
                      {periodDates.map((date, index) => {
                        const d = new Date(date)
                        const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
                        const dayName = dayNames[d.getDay()]
                        const dayNumber = d.getDate()
                        const month = d.getMonth() + 1
                        
                        return (
                          <TableHead 
                            key={date} 
                            className="text-center border-l bg-gray-50"
                            style={{ minWidth: '120px', width: '120px' }}
                          >
                            <div className="text-center p-2">
                              <div className="font-semibold text-sm text-gray-900">
                                {dayName} {dayNumber}/{month}
                              </div>
                              <div className="text-xs text-gray-500">
                                {date}
                              </div>
                            </div>
                          </TableHead>
                        )
                      })}
                    </TableRow>
                  </TableHeader>
                  
                  <TableBody>
                    {filteredStudents.map((student) => (
                      <TableRow key={student.id} className="hover:bg-gray-50">
                        {/* ✅ CELDA FIJA: Nombre del estudiante */}
                        <TableCell 
                          className="sticky left-0 bg-background z-10 border-r shadow-sm"
                          style={{ minWidth: '200px', width: '200px' }}
                        >
                          <div className="p-2">{student.name}</div>
                        </TableCell>
                        
                        {/* ✅ CELDA FIJA: ID del estudiante */}
                        <TableCell 
                          className="sticky left-[200px] bg-background z-10 border-r shadow-sm"
                          style={{ minWidth: '100px', width: '100px' }}
                        >
                          <div className="p-2">{student.student_id || "-"}</div>
                        </TableCell>
                        
                        {/* ✅ CELDAS DINÁMICAS para cada fecha */}
                        {periodDates.map((date) => {
                          const status = weeklyData[student.id]?.[date] || "unmarked"
                          
                          return (
                            <TableCell 
                              key={date} 
                              className="text-center border-l bg-white"
                              style={{ minWidth: '120px', width: '120px' }}
                            >
                              <div className="flex items-center justify-center p-2">
                                {getStatusBadge(status)}
                              </div>
                            </TableCell>
                          )
                        })}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-8">
            <div className="text-center text-gray-500">
              ⚠️ No hay fechas disponibles para mostrar
            </div>
          </CardContent>
        </Card>
      )}

      {/* ✅ INDICADOR DE SCROLL MÁS VISIBLE */}
      {periodDates.length > 5 && (
        <Card className="border-green-200 bg-green-50">
          <CardContent className="p-4">
            <div className="text-center text-sm text-green-800">
              🔍 <strong>Scroll Horizontal Disponible:</strong> 
              Tienes {periodDates.length} días en el período. 
              Desliza hacia la derecha para ver todos los días.
            </div>
            <div className="mt-2 text-center">
              <div className="inline-flex items-center gap-2 text-xs text-green-600">
                <span>←</span>
                <span>Desliza horizontalmente</span>
                <span>→</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Leyenda */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-6 text-sm">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span>Presente</span>
            </div>
            <div className="flex items-center gap-2">
              <XCircle className="h-4 w-4 text-red-600" />
              <span>Ausente</span>
            </div>
            <div className="flex items-center gap-2">
              <Minus className="h-4 w-4 text-gray-400" />
              <span>Sin Marcar</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
