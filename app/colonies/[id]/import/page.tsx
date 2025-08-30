"use client"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ArrowLeft, Upload, FileSpreadsheet, Users, CheckCircle, AlertCircle, Calendar, Plus, Edit } from "lucide-react"
import { useRouter, useParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { toast } from "@/hooks/use-toast"
import * as XLSX from 'xlsx'

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

export default function ImportExcelPage() {
  const [colony, setColony] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [excelData, setExcelData] = useState<ExcelRow[]>([])
  const [columns, setColumns] = useState<ExcelColumn[]>([])
  const [previewData, setPreviewData] = useState<ExcelRow[]>([])
  const [step, setStep] = useState<'upload' | 'columns' | 'preview' | 'import'>('upload')
  const [error, setError] = useState<string | null>(null)
  const [debugInfo, setDebugInfo] = useState<any>(null)
  
  const fileInputRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()
  const router = useRouter()
  const params = useParams()
  const colonyId = params.id as string
  const [currentPeriodNumber, setCurrentPeriodNumber] = useState<number>(1)  // ✅ NUEVO: número del período actual
  
  // ✅ NUEVO: Estado para período seleccionado
  const [selectedPeriod, setSelectedPeriod] = useState<number | null>(null)
  const [availablePeriods, setAvailablePeriods] = useState<any[]>([])
  const [isCreatingNewPeriod, setIsCreatingNewPeriod] = useState(false)
  
  // ✅ FUNCIÓN: Cargar períodos disponibles
  const fetchAvailablePeriods = async () => {
    try {
      const { data, error } = await supabase
        .from('colony_periods')
        .select('*')
        .eq('colony_id', colonyId)
        .order('period_number', { ascending: true })

      if (error) throw error
      setAvailablePeriods(data || [])
      
      // Si viene de URL con período específico
      const urlParams = new URLSearchParams(window.location.search)
      const periodParam = urlParams.get('period')
      if (periodParam) {
        setSelectedPeriod(parseInt(periodParam))
      } else if (data && data.length > 0) {
        // Seleccionar el período más reciente por defecto
        setSelectedPeriod(data[data.length - 1].period_number)
      }
    } catch (error) {
      console.error('Error loading periods:', error)
    }
  }

  // ✅ FUNCIÓN: Crear nuevo período rápido
  const createQuickPeriod = async () => {
    setIsCreatingNewPeriod(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("Usuario no autenticado")

      const nextPeriodNumber = availablePeriods.length > 0 
        ? Math.max(...availablePeriods.map(p => p.period_number)) + 1 
        : 1

      const { data, error } = await supabase
        .from('colony_periods')
        .insert({
          colony_id: colonyId,
          period_number: nextPeriodNumber,
          description: `Período ${nextPeriodNumber}`,
          periodo_desde: new Date().toISOString().split('T')[0],
          periodo_hasta: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          season_desc: new Date().getFullYear().toString(),
          created_by: user.id
        })
        .select()
        .single()

      if (error) throw error

      setSelectedPeriod(nextPeriodNumber)
      await fetchAvailablePeriods()
      
      toast({
        title: "Éxito",
        description: `Período ${nextPeriodNumber} creado. Ahora puedes cargar el Excel.`
      })
    } catch (error) {
      console.error('Error creating period:', error)
      toast({
        title: "Error",
        description: "No se pudo crear el nuevo período",
        variant: "destructive"
      })
    } finally {
      setIsCreatingNewPeriod(false)
    }
  }

  // ✅ Agregar al useEffect inicial
  useEffect(() => {
    fetchColony()
    fetchAvailablePeriods()
  }, [])

  const fetchColony = async () => {
    try {
      const { data, error } = await supabase
        .from('colonies')
        .select('*')
        .eq('id', colonyId)
        .single()

      if (error) throw error
      setColony(data)
    } catch (error) {
      console.error('Error fetching colony:', error)
      toast({
        title: "Error",
        description: "No se pudo cargar la colonia",
        variant: "destructive"
      })
      router.push('/colonies')
    } finally {
      setLoading(false)
    }
  }

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (!file.name.match(/\.(xlsx|xls)$/)) {
      toast({
        title: "Error",
        description: "Por favor selecciona un archivo Excel válido (.xlsx o .xls)",
        variant: "destructive"
      })
      return
    }

    setUploading(true)
    try {
      const data = await readExcelFile(file)
      
      // ✅ VALIDAR NÚMERO DE FILAS
      if (data.length > 1000) {
        toast({
          title: "Advertencia",
          description: `El archivo tiene ${data.length} filas. Esto puede tomar tiempo.`,
          variant: "default"
        })
      }
      
      if (data.length === 0) {
        toast({
          title: "Error",
          description: "El archivo no contiene datos válidos. Verifica que no esté vacío.",
          variant: "destructive"
        })
        return
      }
      
      setExcelData(data)
      
      if (data.length > 0) {
        const detectedColumns = detectColumns(data[0])
        setColumns(detectedColumns)
        setStep('columns')
      }
    } catch (error) {
      console.error('Error reading Excel file:', error)
      toast({
        title: "Error",
        description: "No se pudo leer el archivo Excel",
        variant: "destructive"
      })
    } finally {
      setUploading(false)
    }
  }

  const readExcelFile = (file: File): Promise<ExcelRow[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer)
          const workbook = XLSX.read(data, { type: 'array' })
          const sheetName = workbook.SheetNames[0]
          const worksheet = workbook.Sheets[sheetName]
          
          // ✅ FILTRAR FILAS VACÍAS antes de procesar
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { 
            header: 1,
            defval: '', // Valor por defecto para celdas vacías
            blankrows: false // ❌ NO incluir filas completamente vacías
          })
          
          if (jsonData.length < 2) {
            reject(new Error('El archivo debe tener al menos una fila de encabezados y una fila de datos'))
            return
          }

          const headers = jsonData[0] as string[]
          
          // ✅ FILTRAR FILAS QUE REALMENTE TIENEN DATOS
          const rows = jsonData.slice(1)
            .filter((row: unknown) => {
              if (!Array.isArray(row)) return false
              
              // Verificar si la fila tiene al menos un valor no vacío
              return row.some(cell => 
                cell !== null && 
                cell !== undefined && 
                cell.toString().trim() !== ''
              )
            })
            .map((row: unknown) => {
              const obj: ExcelRow = {}
              if (Array.isArray(row)) {
                headers.forEach((header, index) => {
                  if (header && row[index] !== undefined) {
                    obj[header] = row[index]
                  }
                })
              }
              return obj
            })

          console.log(`✅ Filas originales: ${jsonData.length}`)
          console.log(`✅ Filas con datos: ${rows.length}`)
          console.log(`✅ Filas filtradas: ${rows.length}`)

          resolve(rows)
        } catch (error) {
          reject(error)
        }
      }
      reader.onerror = reject
      reader.readAsArrayBuffer(file)
    })
  }

  const detectColumns = (firstRow: ExcelRow): ExcelColumn[] => {
    return Object.keys(firstRow).map((key, index) => ({
      name: key,
      index,
      selected: false,
      mappedTo: COLUMN_MAPPINGS[key.toLowerCase() as keyof typeof COLUMN_MAPPINGS] || ''
    }))
  }

  const toggleColumn = (columnName: string) => {
    setColumns(prev => prev.map(col => 
      col.name === columnName 
        ? { ...col, selected: !col.selected }
        : col
    ))
  }

  const updateColumnMapping = (columnName: string, mappedTo: string) => {
    setColumns(prev => prev.map(col => 
      col.name === columnName 
        ? { ...col, mappedTo }
        : col
    ))
  }

  const getRequiredColumns = () => {
    return columns.filter(col => col.selected && col.mappedTo)
  }

  const canProceed = () => {
    const required = getRequiredColumns()
    return required.length > 0 && required.some(col => col.mappedTo === 'name')
  }

  const handleNext = () => {
    if (step === 'columns') {
      if (!canProceed()) {
        toast({
          title: "Error",
          description: "Debes seleccionar al menos el nombre y mapear las columnas correctamente",
          variant: "destructive"
        })
        return
      }
      
      const selectedColumns = getRequiredColumns()
      const mappedData = excelData.map(row => {
        const mapped: ExcelRow = {}
        selectedColumns.forEach(col => {
          if (col.mappedTo && row[col.name] !== undefined) {
            mapped[col.mappedTo] = row[col.name]
          }
        })
        return mapped
      })
      
      setPreviewData(mappedData.slice(0, 5)) // Mostrar solo 5 filas de preview
      setStep('preview')
    } else if (step === 'preview') {
      setStep('import')
    }
  }

  // ✅ NUEVA FUNCIÓN: Obtener el número del próximo período
  const getNextPeriodNumber = async () => {
    try {
      const supabase = createClient()
      
      // ✅ VERIFICAR: Si ya hay estudiantes en esta colonia
      const { data: existingStudents, error: studentsError } = await supabase
        .from('students')
        .select('period_number')
        .eq('colony_id', colonyId)
        .order('period_number', { ascending: false })
        .limit(1)

      if (studentsError) {
        console.error('Error verificando períodos existentes:', studentsError)
        return 1
      }

      // ✅ SI hay estudiantes, obtener el número más alto y sumar 1
      if (existingStudents && existingStudents.length > 0) {
        const maxPeriodNumber = Math.max(...existingStudents.map(s => s.period_number || 1))
        const nextPeriodNumber = maxPeriodNumber + 1
        console.log('🔄 Próximo número de período:', nextPeriodNumber)
        return nextPeriodNumber
      }

      // ✅ SI no hay estudiantes, es el primer período
      console.log(' Primer período (1)')
      return 1
      
    } catch (error) {
      console.error('Error obteniendo número de período:', error)
      return 1
    }
  }

  // ✅ MODIFICADA FUNCIÓN: Importar con period_number
  const handleImport = async () => {
    if (!selectedPeriod) {
      toast({
        title: "Error",
        description: "Debes seleccionar un período antes de importar",
        variant: "destructive"
      })
      return
    }

    setProcessing(true)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("Usuario no autenticado")

      // ✅ OBTENER: Número del próximo período
      const periodNumber = await getNextPeriodNumber()
      setCurrentPeriodNumber(periodNumber)

      const selectedColumns = getRequiredColumns()
      const mappedData = excelData.map(row => {
        const mapped: ExcelRow = {}
        selectedColumns.forEach(col => {
          if (col.mappedTo && row[col.name] !== undefined) {
            mapped[col.mappedTo] = row[col.name]
          }
        })
        return mapped
      })

      // Filtrar datos válidos
      const validData = mappedData.filter(row => row.name && row.name.toString().trim())

      if (validData.length === 0) {
        throw new Error("No hay datos válidos para importar")
      }

      // ✅ PROCESAR: Estudiantes con period_number
      const studentsToProcess = validData.map(row => ({
        name: row.name.toString().trim(),
        student_id: row.student_id?.toString().trim() || null,
        colony_id: colonyId,
        season: row.season?.toString().trim() || '2024-2025',
        period_number: selectedPeriod,  // ✅ NUEVO: número del período
        created_by: user.id
      }))

      console.log(` Importando ${validData.length} estudiantes para período ${selectedPeriod}`)

      // ✅ Crear o actualizar estudiantes con period_number
      const processedStudents: any[] = []
      
      for (const student of studentsToProcess) {
        let studentRecord: any
        
        // ✅ BUSCAR: Estudiante existente por student_id en la misma colonia y período
        if (student.student_id) {
          const { data: existing } = await supabase
            .from('students')
            .select('*')
            .eq('student_id', student.student_id)
            .eq('colony_id', student.colony_id)
            .eq('period_number', student.period_number)  // ✅ BUSCAR por período específico
            .single()
          
          if (existing) {
            // ✅ ACTUALIZAR: Estudiante existente en el mismo período
            const { error: updateError } = await supabase
              .from('students')
              .update({
                name: student.name,
                updated_at: new Date().toISOString()
              })
              .eq('id', existing.id)
            
            if (updateError) throw updateError
            studentRecord = { ...existing, ...student }
          } else {
            // ✅ CREAR: Nuevo estudiante en el nuevo período
            const { data: newStudent, error: insertError } = await supabase
              .from('students')
              .insert(student)
              .select()
              .single()
            
            if (insertError) throw insertError
            studentRecord = newStudent
          }
        } else {
          // ✅ CREAR: Nuevo estudiante sin student_id en el nuevo período
          const { data: newStudent, error: insertError } = await supabase
            .from('students')
            .insert(student)
            .select()
            .single()
          
          if (insertError) throw insertError
          studentRecord = newStudent
        }
        
        processedStudents.push(studentRecord)
      }

      // ✅ REGISTRAR: La importación con información del período
      const { error: importError } = await supabase
        .from('excel_imports')
        .insert({
          colony_id: colonyId,
          filename: 'archivo_importado.xlsx',
          total_records: excelData.length,
          successful_imports: validData.length,
          failed_imports: excelData.length - validData.length,
          period_number: selectedPeriod,  // ✅ NUEVO: número del período
          column_mapping: selectedColumns.reduce((acc, col) => {
            acc[col.name] = col.mappedTo
            return acc
          }, {} as Record<string, string>),
          imported_by: user.id
        })

      if (importError) console.warn('Warning: Could not save import record:', importError)

      toast({
        title: "Éxito",
        description: `${validData.length} estudiantes importados correctamente en el período ${selectedPeriod} de la colonia ${colony.name}`
      })

      router.push(`/colonies/${colonyId}`)
    } catch (error) {
      console.error('Error importing data:', error)
      console.error('Error type:', typeof error)
      console.error('Error keys:', error ? Object.keys(error) : 'No error object')
      
      // Mostrar mensaje de error más específico
      let errorMessage = "No se pudieron importar los datos"
      
      // Capturar diferentes tipos de errores
      if (error && typeof error === 'object') {
        const errorObj = error as any
        
        // Intentar diferentes propiedades donde puede estar el mensaje
        const errorText = errorObj.message || errorObj.error?.message || errorObj.details || errorObj.hint || JSON.stringify(errorObj)
        
              console.error('Error text found:', errorText)
      
      // Guardar información de debug
      setDebugInfo({
        error,
        errorText,
        timestamp: new Date().toISOString()
      })
      
      if (errorText?.includes('duplicate key value')) {
          errorMessage = "Error: Hay estudiantes duplicados. Verifica que no existan estudiantes con el mismo ID o email."
        } else if (errorText?.includes('permission denied')) {
          errorMessage = "Error: No tienes permisos para importar datos. Verifica tu autenticación."
        } else if (errorText?.includes('relation "students" does not exist')) {
          errorMessage = "Error: La tabla students no existe. Ejecuta los scripts SQL primero."
        } else if (errorText?.includes('relation "colony_students" does not exist')) {
          errorMessage = "Error: La tabla colony_students no existe. Ejecuta los scripts SQL primero."
        } else if (errorText?.includes('relation "excel_imports" does not exist')) {
          errorMessage = "Error: La tabla excel_imports no existe. Ejecuta los scripts SQL primero."
        } else if (errorText?.includes('infinite recursion detected in policy')) {
          errorMessage = "Error: Recursión infinita en políticas RLS. Ejecuta el script de corrección."
        } else if (errorText?.includes('null value in column')) {
          errorMessage = "Error: Hay campos obligatorios vacíos. Verifica que todos los nombres estén completos."
        } else if (errorText?.includes('violates not-null constraint')) {
          errorMessage = "Error: Hay campos obligatorios vacíos. Verifica que todos los nombres estén completos."
        } else if (errorText) {
          errorMessage = `Error: ${errorText}`
        }
      }
      
      setError(errorMessage)
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive"
      })
    } finally {
      setProcessing(false)
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

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button 
              onClick={() => router.push(`/colonies/${colonyId}`)} 
              variant="outline" 
              size="sm"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Volver
            </Button>
            <h1 className="text-2xl font-bold">Importar Excel - {colony?.name}</h1>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* ✅ NUEVO: Selector de período en la importación */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Seleccionar Período para Importación</CardTitle>
            <CardDescription>
              Elige el período al que pertenecerán los estudiantes del Excel
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <Label>Período Destino</Label>
                <Select 
                  value={selectedPeriod?.toString() || ""} 
                  onValueChange={(value) => setSelectedPeriod(parseInt(value))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar período" />
                  </SelectTrigger>
                  <SelectContent>
                    {availablePeriods.map((period) => (
                      <SelectItem key={period.id} value={period.period_number.toString()}>
                        Período {period.period_number} - {period.season_desc || 'Sin temporada'}
                        <span className="text-xs text-muted-foreground ml-2">
                          ({formatPeriodoSimple(period.periodo_desde, period.periodo_hasta)})
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label className="invisible">Acción</Label>
                <Button 
                  onClick={createQuickPeriod}
                  disabled={isCreatingNewPeriod}
                  variant="outline"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  {isCreatingNewPeriod ? 'Creando...' : 'Nuevo Período'}
                </Button>
              </div>
            </div>
            
            {selectedPeriod && currentPeriodData && (
              <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                <h4 className="font-medium text-blue-900">
                  Período {selectedPeriod} - {currentPeriodData.season_desc}
                </h4>
                <p className="text-sm text-blue-700">
                  {formatPeriodoSimple(currentPeriodData.periodo_desde, currentPeriodData.periodo_hasta)}
                </p>
                <p className="text-xs text-blue-600 mt-1">
                  Los estudiantes del Excel se asignarán a este período
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="max-w-4xl mx-auto">
          {/* Step Indicator */}
          <div className="mb-8">
            <div className="flex items-center justify-center space-x-4">
              <div className={`flex items-center ${step === 'upload' ? 'text-primary' : 'text-muted-foreground'}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${step === 'upload' ? 'border-primary bg-primary text-primary-foreground' : 'border-muted-foreground'}`}>
                  1
                </div>
                <span className="ml-2">Subir Excel</span>
              </div>
              <div className="w-16 h-0.5 bg-muted-foreground"></div>
              <div className={`flex items-center ${step === 'columns' ? 'text-primary' : 'text-muted-foreground'}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${step === 'columns' ? 'border-primary bg-primary text-primary-foreground' : 'border-muted-foreground'}`}>
                  2
                </div>
                <span className="ml-2">Seleccionar Columnas</span>
              </div>
              <div className="w-16 h-0.5 bg-muted-foreground"></div>
              <div className={`flex items-center ${step === 'preview' ? 'text-primary' : 'text-muted-foreground'}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${step === 'preview' ? 'border-primary bg-primary text-primary-foreground' : 'border-muted-foreground'}`}>
                  3
                </div>
                <span className="ml-2">Vista Previa</span>
              </div>
              <div className="w-16 h-0.5 bg-muted-foreground"></div>
              <div className={`flex items-center ${step === 'import' ? 'text-primary' : 'text-muted-foreground'}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${step === 'import' ? 'border-primary bg-primary text-primary-foreground' : 'border-muted-foreground'}`}>
                  4
                </div>
                <span className="ml-2">Importar</span>
              </div>
            </div>
          </div>

          {/* Step 1: Upload */}
          {step === 'upload' && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Upload className="h-5 w-5" />
                  Subir Archivo Excel
                </CardTitle>
                <CardDescription>
                  Selecciona un archivo Excel (.xlsx o .xls) con los datos de los estudiantes
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center">
                  <FileSpreadsheet className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                  <p className="text-lg font-semibold mb-2">Arrastra tu archivo Excel aquí</p>
                  <p className="text-muted-foreground mb-4">
                    O haz clic para seleccionar un archivo
                  </p>
                  <Button 
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                  >
                    {uploading ? "Procesando..." : "Seleccionar Archivo"}
                  </Button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {/* Step 2: Column Selection */}
          {step === 'columns' && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileSpreadsheet className="h-5 w-5" />
                  Seleccionar y Mapear Columnas
                </CardTitle>
                <CardDescription>
                  Selecciona qué columnas usar y mapea cada una al campo correspondiente
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {columns.map((column) => (
                    <div key={column.name} className="flex items-center gap-4 p-4 border rounded-lg">
                      <Checkbox
                        checked={column.selected}
                        onCheckedChange={() => toggleColumn(column.name)}
                      />
                      <div className="flex-1">
                        <Label className="font-medium">{column.name}</Label>
                        <p className="text-sm text-muted-foreground">
                          Ejemplo: {excelData[0]?.[column.name] || 'N/A'}
                        </p>
                      </div>
                      <Select
                        value={column.mappedTo}
                        onValueChange={(value) => updateColumnMapping(column.name, value)}
                        disabled={!column.selected}
                      >
                        <SelectTrigger className="w-48">
                          <SelectValue placeholder="Seleccionar campo" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="name">Nombre</SelectItem>
                          <SelectItem value="student_id">ID del Estudiante</SelectItem>
                          <SelectItem value="colony_id">ID de la Colonia</SelectItem>
                          <SelectItem value="season">Temporada</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                </div>
                
                <div className="mt-6 flex justify-end">
                  <Button onClick={handleNext} disabled={!canProceed()}>
                    Continuar
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Step 3: Preview */}
          {step === 'preview' && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5" />
                  Vista Previa de Datos
                </CardTitle>
                <CardDescription>
                  Revisa cómo se verán los datos antes de importar
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse border border-muted">
                    <thead>
                      <tr className="bg-muted">
                        {Object.keys(previewData[0] || {}).map((key) => (
                          <th key={key} className="border border-muted p-2 text-left">
                            {key}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {previewData.map((row, index) => (
                        <tr key={index}>
                          {Object.values(row).map((value, cellIndex) => (
                            <td key={cellIndex} className="border border-muted p-2">
                              {value?.toString() || ''}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                
                <div className="mt-6 flex justify-between">
                  <Button variant="outline" onClick={() => setStep('columns')}>
                    Atrás
                  </Button>
                  <Button onClick={handleNext}>
                    Continuar
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Step 4: Import */}
          {step === 'import' && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Importar Estudiantes
                </CardTitle>
                <CardDescription>
                  Confirma la importación de {excelData.length} estudiantes a la colonia {colony?.name}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="p-4 bg-muted rounded-lg">
                    <h4 className="font-semibold mb-2">Resumen de la importación:</h4>
                    <ul className="space-y-1 text-sm">
                      <li>• Total de filas en el Excel: {excelData.length}</li>
                      <li>• Columnas seleccionadas: {getRequiredColumns().length}</li>
                      <li>• Colonia destino: {colony?.name}</li>
                    </ul>
                  </div>
                  
                  {error && (
                    <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                      <div className="flex items-center gap-2 text-red-800">
                        <AlertCircle className="h-4 w-4" />
                        <span className="font-medium">Error de Importación:</span>
                      </div>
                      <p className="text-red-700 text-sm mt-1 mb-3">
                        {error}
                      </p>
                      
                      {error.includes('tabla students no existe') && (
                        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-left">
                          <h5 className="font-semibold text-yellow-800 mb-2">Para resolver este problema:</h5>
                          <ol className="list-decimal list-inside text-sm text-yellow-700 space-y-1">
                            <li>Ve a tu base de datos Supabase</li>
                            <li>Ejecuta el script: <code className="bg-yellow-100 px-2 py-1 rounded">scripts/005_create_colonies_tables.sql</code></li>
                            <li>Ejecuta el script: <code className="bg-yellow-100 px-2 py-1 rounded">scripts/006_colonies_rls.sql</code></li>
                            <li>Ejecuta el script: <code className="bg-yellow-100 px-2 py-1 rounded">scripts/007_update_students_table.sql</code></li>
                            <li>Recarga esta página</li>
                          </ol>
                        </div>
                      )}

                                             {error.includes('recursión infinita en políticas RLS') && (
                         <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-left">
                           <h5 className="font-semibold text-red-800 mb-2">Error de Recursión Infinita:</h5>
                           <ol className="list-decimal list-inside text-sm text-red-700 space-y-1">
                             <li>Ve a tu base de datos Supabase</li>
                             <li>Ejecuta el script de corrección: <code className="bg-red-100 px-2 py-1 rounded">scripts/009_fix_rls_recursion.sql</code></li>
                             <li>Recarga esta página</li>
                           </ol>
                         </div>
                       )}

                       {/* Información de Debug */}
                       {debugInfo && (
                         <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-left">
                           <h5 className="font-semibold text-gray-800 mb-2">Información de Debug:</h5>
                           <details className="text-sm text-gray-700">
                             <summary className="cursor-pointer hover:text-gray-900">Ver detalles técnicos</summary>
                             <div className="mt-2 p-2 bg-gray-100 rounded text-xs font-mono">
                               <p><strong>Timestamp:</strong> {debugInfo.timestamp}</p>
                               <p><strong>Error Text:</strong> {debugInfo.errorText}</p>
                               <p><strong>Error Object:</strong> {JSON.stringify(debugInfo.error, null, 2)}</p>
                             </div>
                           </details>
                         </div>
                       )}
                     </div>
                   )}
                  
                                     <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                     <div className="flex items-center gap-2 text-blue-800">
                       <AlertCircle className="h-4 w-4" />
                       <span className="font-medium">Importante:</span>
                     </div>
                     <p className="text-blue-700 text-sm mt-1">
                       Esta acción importará todos los estudiantes válidos a la colonia para la temporada 2024-2025. 
                       Los estudiantes con el mismo ID pueden estar en diferentes colonias. 
                       Se evitan duplicados por colonia-temporada.
                     </p>
                   </div>
                </div>
                
                                  <div className="mt-6 flex justify-between">
                    <Button variant="outline" onClick={() => setStep('preview')}>
                      Atrás
                    </Button>
                    <div className="space-x-2">
                      {error && (
                        <Button 
                          variant="outline" 
                          onClick={() => {
                            setError(null)
                            setDebugInfo(null)
                          }}
                          className="text-red-600 border-red-200 hover:bg-red-50"
                        >
                          Limpiar Error
                        </Button>
                      )}
                      <Button onClick={handleImport} disabled={processing}>
                        {processing ? "Importando..." : "Importar Estudiantes"}
                      </Button>
                    </div>
                  </div>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  )
}
