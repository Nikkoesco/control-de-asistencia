"use client"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
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

const formatPeriodoSimple = (desde: string, hasta: string) => {
  try {
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

export default function ImportExcelPage() {
  // Estados principales
  const [colony, setColony] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [availablePeriods, setAvailablePeriods] = useState<any[]>([])
  const [selectedPeriod, setSelectedPeriod] = useState<any>(null)
  
  // Estados para el modal de crear período
  const [showCreatePeriodModal, setShowCreatePeriodModal] = useState(false)
  const [isCreatingPeriod, setIsCreatingPeriod] = useState(false)
  const [newPeriodData, setNewPeriodData] = useState({
    periodo_desde: '',
    periodo_hasta: '',
    season_desc: ''
  })

  // Estados para Excel (solo se usan después de tener período)
  const [excelData, setExcelData] = useState<ExcelRow[]>([])
  const [columns, setColumns] = useState<ExcelColumn[]>([])
  const [previewData, setPreviewData] = useState<ExcelRow[]>([])
  const [step, setStep] = useState<'period' | 'upload' | 'columns' | 'preview' | 'import'>('period')
  const [processing, setProcessing] = useState(false)

  // Hooks
  const supabase = createClient()
  const router = useRouter()
  const params = useParams()
  const colonyId = params.id as string
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Funciones
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
      console.error('Error loading colony:', error)
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

  const fetchAvailablePeriods = async () => {
    try {
      const { data, error } = await supabase
        .from('colony_periods')
        .select('*')
        .eq('colony_id', colonyId)
        .order('period_number', { ascending: true })

      if (error) throw error
      setAvailablePeriods(data || [])
    } catch (error) {
      console.error('Error loading periods:', error)
    }
  }

  // Función para abrir el modal de crear período
  const openCreatePeriodModal = () => {
    setShowCreatePeriodModal(true)
    // Limpiar formulario
    setNewPeriodData({
      periodo_desde: '',
      periodo_hasta: '',
      season_desc: ''
    })
  }

  // Función para crear el período
  const createPeriod = async () => {
    if (!newPeriodData.periodo_desde || !newPeriodData.periodo_hasta || !newPeriodData.season_desc) {
      toast({
        title: "Error",
        description: "Complete todos los campos obligatorios",
        variant: "destructive"
      })
      return
    }

    setIsCreatingPeriod(true)
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
          periodo_desde: newPeriodData.periodo_desde,
          periodo_hasta: newPeriodData.periodo_hasta,
          season_desc: newPeriodData.season_desc.trim(),
          created_by: user.id
        })
        .select()
        .single()

      if (error) throw error

      // Establecer el período creado como seleccionado
      setSelectedPeriod(data)
      setShowCreatePeriodModal(false)
      await fetchAvailablePeriods()
      
      // Ir directamente al paso de carga de Excel
      setStep('upload')
      
      toast({
        title: "¡Período creado!",
        description: `Período ${nextPeriodNumber} creado exitosamente. Ahora puedes cargar el Excel.`
      })
    } catch (error) {
      console.error('Error creating period:', error)
      toast({
        title: "Error",
        description: "No se pudo crear el período",
        variant: "destructive"
      })
    } finally {
      setIsCreatingPeriod(false)
    }
  }

  // Función para seleccionar período existente
  const selectExistingPeriod = (period: any) => {
    setSelectedPeriod(period)
    setStep('upload')
    toast({
      title: "Período seleccionado",
      description: `Período ${period.period_number} - ${period.season_desc}`
    })
  }

  // Resto de funciones de Excel (igual que antes)
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

    try {
      const data = await readExcelFile(file)
      
      if (data.length === 0) {
        toast({
          title: "Error",
          description: "El archivo no contiene datos válidos",
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
          
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { 
            header: 1,
            defval: '',
            blankrows: false
          })
          
          if (jsonData.length < 2) {
            reject(new Error('El archivo debe tener al menos una fila de encabezados y una fila de datos'))
            return
          }

          const headers = jsonData[0] as string[]
          
          const rows = jsonData.slice(1)
            .filter((row: unknown) => {
              if (!Array.isArray(row)) return false
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
      
      setPreviewData(mappedData.slice(0, 5))
      setStep('preview')
    } else if (step === 'preview') {
      setStep('import')
    }
  }

  const handleImport = async () => {
    setProcessing(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("Usuario no autenticado")

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

      const validData = mappedData.filter(row => row.name && row.name.toString().trim())

      if (validData.length === 0) {
        throw new Error("No hay datos válidos para importar")
      }

      const studentsToProcess = validData.map(row => ({
        name: row.name.toString().trim(),
        student_id: row.student_id?.toString().trim() || null,
        colony_id: colonyId,
        season: selectedPeriod.season_desc,
        period_number: selectedPeriod.period_number,
        created_by: user.id
      }))

      // Insertar estudiantes
      const { error: studentsError } = await supabase
        .from('students')
        .insert(studentsToProcess)

      if (studentsError) throw studentsError

      toast({
        title: "¡Éxito!",
        description: `${validData.length} estudiantes importados correctamente`
      })

      router.push(`/colonies/${colonyId}`)
    } catch (error) {
      console.error('Error importing data:', error)
      toast({
        title: "Error",
        description: "No se pudieron importar los datos",
        variant: "destructive"
      })
    } finally {
      setProcessing(false)
    }
  }

  useEffect(() => {
    fetchColony()
    fetchAvailablePeriods()
  }, [])

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

      <main className="container mx-auto px-4 py-8 max-w-4xl">
        {/* PASO 1: Seleccionar/Crear Período */}
        {step === 'period' && (
          <Card className="text-center">
            <CardHeader>
              <CardTitle className="flex items-center justify-center gap-2">
                <FileSpreadsheet className="h-6 w-6" />
                Importar Excel
              </CardTitle>
              <CardDescription>
                Para importar estudiantes desde Excel, necesitas seleccionar un período académico
              </CardDescription>
            </CardHeader>
            <CardContent className="py-8">
              <div className="space-y-6">
                <div className="mx-auto w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mb-6">
                  <Calendar className="h-10 w-10 text-blue-600" />
                </div>
                
                {availablePeriods.length > 0 ? (
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold">Períodos Disponibles</h3>
                    <div className="grid gap-3 max-w-md mx-auto">
                      {availablePeriods.map((period) => (
                        <div 
                          key={period.id}
                          className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50"
                        >
                          <div className="text-left">
                            <h4 className="font-medium">
                              Período {period.period_number} - {period.season_desc}
                            </h4>
                            <p className="text-sm text-gray-600">
                              {formatPeriodoSimple(period.periodo_desde, period.periodo_hasta)}
                            </p>
                          </div>
                          <Button 
                            onClick={() => selectExistingPeriod(period)}
                            size="sm"
                          >
                            Seleccionar
                          </Button>
                        </div>
                      ))}
                    </div>
                    
                    <div className="relative my-6">
                      <div className="absolute inset-0 flex items-center">
                        <span className="w-full border-t" />
                      </div>
                      <div className="relative flex justify-center text-xs uppercase">
                        <span className="bg-background px-2 text-muted-foreground">O</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div>
                    <h3 className="text-lg font-semibold mb-2">No hay períodos creados</h3>
                    <p className="text-gray-600 mb-6">
                      Crea el primer período académico para esta colonia
                    </p>
                  </div>
                )}

                <Button 
                  onClick={openCreatePeriodModal}
                  size="lg"
                  className="w-full sm:w-auto"
                >
                  <Plus className="h-5 w-5 mr-2" />
                  Crear Nuevo Período
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* PASOS DE EXCEL (solo se muestran después de seleccionar período) */}
        {step !== 'period' && (
          <div className="space-y-6">
            {/* Período seleccionado */}
            <Card className="border-green-200 bg-green-50">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <CheckCircle className="h-6 w-6 text-green-600" />
                  <div>
                    <h4 className="font-semibold text-green-900">
                      Período {selectedPeriod?.period_number} - {selectedPeriod?.season_desc}
                    </h4>
                    <p className="text-sm text-green-700">
                      {selectedPeriod && formatPeriodoSimple(selectedPeriod.periodo_desde, selectedPeriod.periodo_hasta)}
                    </p>
                  </div>
                  <Button 
                    onClick={() => setStep('period')}
                    variant="outline"
                    size="sm"
                    className="ml-auto"
                  >
                    Cambiar
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Indicador de pasos */}
            <div className="mb-8">
              <div className="flex items-center justify-center space-x-4">
                <div className={`flex items-center ${step === 'upload' ? 'text-primary' : step === 'period' ? 'text-muted-foreground' : 'text-green-600'}`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${
                    step === 'upload' ? 'border-primary bg-primary text-primary-foreground' : 
                    step === 'period' ? 'border-muted-foreground' : 
                    'border-green-600 bg-green-600 text-white'
                  }`}>
                    {step === 'upload' ? '1' : step === 'period' ? '1' : <CheckCircle className="h-4 w-4" />}
                  </div>
                  <span className="ml-2">Subir Excel</span>
                </div>
                <div className="w-16 h-0.5 bg-muted-foreground"></div>
                <div className={`flex items-center ${step === 'columns' ? 'text-primary' : ['preview', 'import'].includes(step) ? 'text-green-600' : 'text-muted-foreground'}`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${
                    step === 'columns' ? 'border-primary bg-primary text-primary-foreground' : 
                    ['preview', 'import'].includes(step) ? 'border-green-600 bg-green-600 text-white' : 
                    'border-muted-foreground'
                  }`}>
                    {step === 'columns' ? '2' : ['preview', 'import'].includes(step) ? <CheckCircle className="h-4 w-4" /> : '2'}
                  </div>
                  <span className="ml-2">Mapear Columnas</span>
                </div>
                <div className="w-16 h-0.5 bg-muted-foreground"></div>
                <div className={`flex items-center ${step === 'preview' ? 'text-primary' : step === 'import' ? 'text-green-600' : 'text-muted-foreground'}`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${
                    step === 'preview' ? 'border-primary bg-primary text-primary-foreground' : 
                    step === 'import' ? 'border-green-600 bg-green-600 text-white' : 
                    'border-muted-foreground'
                  }`}>
                    {step === 'preview' ? '3' : step === 'import' ? <CheckCircle className="h-4 w-4" /> : '3'}
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
                    <Button onClick={() => fileInputRef.current?.click()}>
                      Seleccionar Archivo
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
                    Confirma la importación de {excelData.length} estudiantes
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="p-4 bg-muted rounded-lg">
                      <h4 className="font-semibold mb-2">Resumen de la importación:</h4>
                      <ul className="space-y-1 text-sm">
                        <li>• Total de filas: {excelData.length}</li>
                        <li>• Columnas seleccionadas: {getRequiredColumns().length}</li>
                        <li>• Colonia: {colony?.name}</li>
                        <li>• Período: {selectedPeriod?.period_number} - {selectedPeriod?.season_desc}</li>
                      </ul>
                    </div>
                    
                    <div className="mt-6 flex justify-between">
                      <Button variant="outline" onClick={() => setStep('preview')}>
                        Atrás
                      </Button>
                      <Button onClick={handleImport} disabled={processing}>
                        {processing ? "Importando..." : "Importar Estudiantes"}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </main>

      {/* Modal para crear período */}
      <Dialog open={showCreatePeriodModal} onOpenChange={setShowCreatePeriodModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Crear Nuevo Período</DialogTitle>
            <DialogDescription>
              Define las fechas y temporada del período académico
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="periodo_desde">Fecha de Inicio *</Label>
                <Input
                  id="periodo_desde"
                  type="date"
                  value={newPeriodData.periodo_desde}
                  onChange={(e) => setNewPeriodData(prev => ({ ...prev, periodo_desde: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="periodo_hasta">Fecha de Fin *</Label>
                <Input
                  id="periodo_hasta"
                  type="date"
                  value={newPeriodData.periodo_hasta}
                  onChange={(e) => setNewPeriodData(prev => ({ ...prev, periodo_hasta: e.target.value }))}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="season_desc">Temporada *</Label>
              <Input
                id="season_desc"
                value={newPeriodData.season_desc}
                onChange={(e) => setNewPeriodData(prev => ({ ...prev, season_desc: e.target.value }))}
                placeholder="Ej: Verano 2024, Invierno 2025"
              />
            </div>
          </div>

          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setShowCreatePeriodModal(false)}
              disabled={isCreatingPeriod}
            >
              Cancelar
            </Button>
            <Button 
              onClick={createPeriod}
              disabled={isCreatingPeriod || !newPeriodData.periodo_desde || !newPeriodData.periodo_hasta || !newPeriodData.season_desc}
            >
              {isCreatingPeriod ? "Creando..." : "Crear y Continuar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
