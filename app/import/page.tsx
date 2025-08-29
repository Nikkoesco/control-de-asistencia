"use client"

import type React from "react"

import { useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Upload, FileSpreadsheet, CheckCircle, AlertCircle, ArrowLeft } from "lucide-react"
import Link from "next/link"
import * as XLSX from "xlsx"

interface ExcelColumn {
  key: string
  name: string
  selected: boolean
  mappedTo: string
  sampleData: string[]
}

interface ImportResult {
  success: number
  errors: number
  total: number
  errorMessages: string[]
}

export default function ImportPage() {
  const [file, setFile] = useState<File | null>(null)
  const [columns, setColumns] = useState<ExcelColumn[]>([])
  const [rawData, setRawData] = useState<any[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const [step, setStep] = useState<"upload" | "mapping" | "processing" | "complete">("upload")
  const [dragActive, setDragActive] = useState(false)
  const router = useRouter()

  const fieldOptions = [
    { value: "name", label: "Nombre del Estudiante" },
    { value: "email", label: "Correo Electrónico" },
    { value: "student_id", label: "ID del Estudiante" },
    { value: "grade", label: "Grado" },
    { value: "section", label: "Sección" },
    { value: "ignore", label: "Ignorar esta columna" },
  ]

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true)
    } else if (e.type === "dragleave") {
      setDragActive(false)
    }
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0])
    }
  }, [])

  const handleFileSelect = async (selectedFile: File) => {
    if (!selectedFile.name.match(/\.(xlsx|xls)$/)) {
      alert("Por favor selecciona un archivo Excel válido (.xlsx o .xls)")
      return
    }

    setFile(selectedFile)
    setIsProcessing(true)

    try {
      const arrayBuffer = await selectedFile.arrayBuffer()
      const workbook = XLSX.read(arrayBuffer, { type: "array" })
      const sheetName = workbook.SheetNames[0]
      const worksheet = workbook.Sheets[sheetName]
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 })

      if (jsonData.length < 2) {
        alert("El archivo debe tener al menos una fila de encabezados y una fila de datos")
        return
      }

      const headers = jsonData[0] as string[]
      const dataRows = jsonData.slice(1) as any[][]

      const processedColumns: ExcelColumn[] = headers.map((header, index) => ({
        key: `col_${index}`,
        name: header || `Columna ${index + 1}`,
        selected: true,
        mappedTo: "",
        sampleData: dataRows.slice(0, 3).map((row) => row[index]?.toString() || ""),
      }))

      setColumns(processedColumns)
      setRawData(dataRows)
      setStep("mapping")
    } catch (error) {
      console.error("Error al procesar el archivo:", error)
      alert("Error al procesar el archivo Excel")
    } finally {
      setIsProcessing(false)
    }
  }

  const handleColumnToggle = (columnKey: string, checked: boolean) => {
    setColumns((prev) => prev.map((col) => (col.key === columnKey ? { ...col, selected: checked } : col)))
  }

  const handleMappingChange = (columnKey: string, mappedTo: string) => {
    setColumns((prev) => prev.map((col) => (col.key === columnKey ? { ...col, mappedTo } : col)))
  }

  const handleImport = async () => {
    const selectedColumns = columns.filter((col) => col.selected && col.mappedTo !== "ignore")

    if (selectedColumns.length === 0) {
      alert("Debes seleccionar al menos una columna para importar")
      return
    }

    const nameColumn = selectedColumns.find((col) => col.mappedTo === "name")
    if (!nameColumn) {
      alert("Debes mapear al menos una columna como 'Nombre del Estudiante'")
      return
    }

    setStep("processing")
    setIsProcessing(true)

    try {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        alert("Debes estar autenticado para importar datos")
        return
      }

      // Create import session
      const { data: importSession } = await supabase
        .from("import_sessions")
        .insert({
          filename: file?.name || "unknown",
          total_records: rawData.length,
          imported_by: user.id,
        })
        .select()
        .single()

      let successCount = 0
      let errorCount = 0
      const errorMessages: string[] = []

      // Process each row
      for (let i = 0; i < rawData.length; i++) {
        const row = rawData[i]
        const studentData: any = {}

        // Map selected columns to student fields
        selectedColumns.forEach((col) => {
          const columnIndex = Number.parseInt(col.key.split("_")[1])
          const value = row[columnIndex]?.toString()?.trim()

          if (value && col.mappedTo !== "ignore") {
            studentData[col.mappedTo] = value
          }
        })

        // Validate required fields
        if (!studentData.name) {
          errorMessages.push(`Fila ${i + 2}: Nombre requerido`)
          errorCount++
          continue
        }

        try {
          const { error } = await supabase.from("students").insert({
            ...studentData,
            created_by: user.id,
          })

          if (error) {
            errorMessages.push(`Fila ${i + 2}: ${error.message}`)
            errorCount++
          } else {
            successCount++
          }
        } catch (error) {
          errorMessages.push(`Fila ${i + 2}: Error inesperado`)
          errorCount++
        }
      }

      // Update import session
      await supabase
        .from("import_sessions")
        .update({
          successful_imports: successCount,
          failed_imports: errorCount,
        })
        .eq("id", importSession?.id)

      setImportResult({
        success: successCount,
        errors: errorCount,
        total: rawData.length,
        errorMessages: errorMessages.slice(0, 10), // Show only first 10 errors
      })

      setStep("complete")
    } catch (error) {
      console.error("Error durante la importación:", error)
      alert("Error durante la importación")
    } finally {
      setIsProcessing(false)
    }
  }

  const resetImport = () => {
    setFile(null)
    setColumns([])
    setRawData([])
    setImportResult(null)
    setStep("upload")
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/dashboard">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Volver al Dashboard
              </Link>
            </Button>
            <h1 className="text-2xl font-bold">Importar Estudiantes desde Excel</h1>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {step === "upload" && (
          <Card className="max-w-2xl mx-auto">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileSpreadsheet className="h-5 w-5" />
                Subir Archivo Excel
              </CardTitle>
              <CardDescription>
                Selecciona un archivo Excel (.xlsx o .xls) que contenga la información de los estudiantes
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div
                className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                  dragActive ? "border-primary bg-primary/5" : "border-muted-foreground/25"
                }`}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
              >
                <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-lg font-medium mb-2">Arrastra tu archivo Excel aquí o haz clic para seleccionar</p>
                <p className="text-sm text-muted-foreground mb-4">Formatos soportados: .xlsx, .xls</p>
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
                  className="hidden"
                  id="file-input"
                />
                <Button asChild>
                  <label htmlFor="file-input" className="cursor-pointer">
                    Seleccionar Archivo
                  </label>
                </Button>
              </div>
              {isProcessing && (
                <div className="mt-4">
                  <Progress value={50} className="w-full" />
                  <p className="text-sm text-center mt-2">Procesando archivo...</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {step === "mapping" && (
          <div className="max-w-6xl mx-auto">
            <Card>
              <CardHeader>
                <CardTitle>Mapear Columnas</CardTitle>
                <CardDescription>
                  Selecciona las columnas que deseas importar y asígnalas a los campos correspondientes
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-16">Importar</TableHead>
                        <TableHead>Columna del Excel</TableHead>
                        <TableHead>Mapear a Campo</TableHead>
                        <TableHead>Datos de Ejemplo</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {columns.map((column) => (
                        <TableRow key={column.key}>
                          <TableCell>
                            <Checkbox
                              checked={column.selected}
                              onCheckedChange={(checked) => handleColumnToggle(column.key, checked as boolean)}
                            />
                          </TableCell>
                          <TableCell className="font-medium">{column.name}</TableCell>
                          <TableCell>
                            <Select
                              value={column.mappedTo}
                              onValueChange={(value) => handleMappingChange(column.key, value)}
                              disabled={!column.selected}
                            >
                              <SelectTrigger className="w-48">
                                <SelectValue placeholder="Seleccionar campo" />
                              </SelectTrigger>
                              <SelectContent>
                                {fieldOptions.map((option) => (
                                  <SelectItem key={option.value} value={option.value}>
                                    {option.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm text-muted-foreground">
                              {column.sampleData.slice(0, 2).map((sample, idx) => (
                                <div key={idx}>{sample || "(vacío)"}</div>
                              ))}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <div className="flex gap-4 mt-6">
                  <Button variant="outline" onClick={resetImport}>
                    Cancelar
                  </Button>
                  <Button onClick={handleImport}>
                    Importar {columns.filter((col) => col.selected && col.mappedTo !== "ignore").length} Estudiantes
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {step === "processing" && (
          <Card className="max-w-2xl mx-auto">
            <CardHeader>
              <CardTitle>Procesando Importación</CardTitle>
              <CardDescription>Por favor espera mientras importamos los datos...</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
                <p>Importando estudiantes...</p>
              </div>
            </CardContent>
          </Card>
        )}

        {step === "complete" && importResult && (
          <Card className="max-w-2xl mx-auto">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                Importación Completada
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div className="p-4 bg-green-50 rounded-lg">
                    <div className="text-2xl font-bold text-green-600">{importResult.success}</div>
                    <div className="text-sm text-green-700">Exitosos</div>
                  </div>
                  <div className="p-4 bg-red-50 rounded-lg">
                    <div className="text-2xl font-bold text-red-600">{importResult.errors}</div>
                    <div className="text-sm text-red-700">Errores</div>
                  </div>
                  <div className="p-4 bg-blue-50 rounded-lg">
                    <div className="text-2xl font-bold text-blue-600">{importResult.total}</div>
                    <div className="text-sm text-blue-700">Total</div>
                  </div>
                </div>

                {importResult.errorMessages.length > 0 && (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      <div className="font-medium mb-2">Errores encontrados:</div>
                      <ul className="text-sm space-y-1">
                        {importResult.errorMessages.map((error, idx) => (
                          <li key={idx}>• {error}</li>
                        ))}
                      </ul>
                    </AlertDescription>
                  </Alert>
                )}

                <div className="flex gap-4">
                  <Button onClick={resetImport} variant="outline">
                    Importar Otro Archivo
                  </Button>
                  <Button asChild>
                    <Link href="/students">Ver Estudiantes</Link>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  )
}
