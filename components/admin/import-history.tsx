"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { FileSpreadsheet, CheckCircle, XCircle } from "lucide-react"

interface ImportSession {
  id: string
  filename: string
  total_records: number | null
  successful_imports: number | null
  failed_imports: number | null
  created_at: string
  profiles?: {
    full_name: string | null
    email: string
  }
}

export default function ImportHistory() {
  const [imports, setImports] = useState<ImportSession[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetchImports()
  }, [])

  const fetchImports = async () => {
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from("import_sessions")
        .select(`
          *,
          profiles (full_name, email)
        `)
        .order("created_at", { ascending: false })

      if (error) throw error
      setImports(data || [])
    } catch (error) {
      console.error("Error al cargar historial de importaciones:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const getSuccessRate = (session: ImportSession) => {
    if (!session.total_records || session.total_records === 0) return 0
    return Math.round(((session.successful_imports || 0) / session.total_records) * 100)
  }

  if (isLoading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
        <p>Cargando historial de importaciones...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Historial de Importaciones</CardTitle>
          <CardDescription>Registro de todas las importaciones de archivos Excel realizadas</CardDescription>
        </CardHeader>
        <CardContent>
          {imports.length === 0 ? (
            <div className="text-center py-8">
              <FileSpreadsheet className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-lg font-medium mb-2">No hay importaciones registradas</p>
              <p className="text-muted-foreground">Las importaciones de Excel aparecerán aquí</p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Archivo</TableHead>
                    <TableHead>Importado por</TableHead>
                    <TableHead>Total Registros</TableHead>
                    <TableHead>Exitosos</TableHead>
                    <TableHead>Errores</TableHead>
                    <TableHead>Tasa de Éxito</TableHead>
                    <TableHead>Fecha</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {imports.map((session) => (
                    <TableRow key={session.id}>
                      <TableCell className="font-medium">{session.filename}</TableCell>
                      <TableCell>
                        {session.profiles?.full_name || session.profiles?.email || "Usuario desconocido"}
                      </TableCell>
                      <TableCell>{session.total_records || 0}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <CheckCircle className="h-4 w-4 text-green-600" />
                          {session.successful_imports || 0}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <XCircle className="h-4 w-4 text-red-600" />
                          {session.failed_imports || 0}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            getSuccessRate(session) >= 90
                              ? "default"
                              : getSuccessRate(session) >= 70
                                ? "secondary"
                                : "destructive"
                          }
                        >
                          {getSuccessRate(session)}%
                        </Badge>
                      </TableCell>
                      <TableCell>{new Date(session.created_at).toLocaleDateString("es-ES")}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
