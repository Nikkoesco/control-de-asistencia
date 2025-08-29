"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Search, Trash2, Users } from "lucide-react"

interface Student {
  id: string
  name: string
  email: string | null
  student_id: string | null
  grade: string | null
  section: string | null
  created_at: string
}

export default function StudentsManagement() {
  const [students, setStudents] = useState<Student[]>([])
  const [filteredStudents, setFilteredStudents] = useState<Student[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [gradeFilter, setGradeFilter] = useState<string>("all")
  const [sectionFilter, setSectionFilter] = useState<string>("all")
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetchStudents()
  }, [])

  useEffect(() => {
    let filtered = students.filter(
      (student) =>
        student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        student.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        student.student_id?.toLowerCase().includes(searchTerm.toLowerCase()),
    )

    if (gradeFilter !== "all") {
      filtered = filtered.filter((student) => student.grade === gradeFilter)
    }

    if (sectionFilter !== "all") {
      filtered = filtered.filter((student) => student.section === sectionFilter)
    }

    setFilteredStudents(filtered)
  }, [students, searchTerm, gradeFilter, sectionFilter])

  const fetchStudents = async () => {
    try {
      const supabase = createClient()
      const { data, error } = await supabase.from("students").select("*").order("name", { ascending: true })

      if (error) throw error
      setStudents(data || [])
    } catch (error) {
      console.error("Error al cargar estudiantes:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleDeleteStudent = async (studentId: string) => {
    try {
      const supabase = createClient()
      const { error } = await supabase.from("students").delete().eq("id", studentId)

      if (error) throw error

      setStudents((prev) => prev.filter((student) => student.id !== studentId))
      alert("Estudiante eliminado exitosamente")
    } catch (error) {
      console.error("Error al eliminar estudiante:", error)
      alert("Error al eliminar el estudiante")
    }
  }

  const uniqueGrades = Array.from(new Set(students.map((s) => s.grade).filter(Boolean)))
  const uniqueSections = Array.from(new Set(students.map((s) => s.section).filter(Boolean)))

  if (isLoading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
        <p>Cargando estudiantes...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Gestión de Estudiantes</CardTitle>
          <CardDescription>Administra los estudiantes registrados en el sistema</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-4 mb-6">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar estudiantes..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={gradeFilter} onValueChange={setGradeFilter}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Grado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {uniqueGrades.map((grade) => (
                  <SelectItem key={grade} value={grade!}>
                    {grade}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={sectionFilter} onValueChange={setSectionFilter}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Sección" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {uniqueSections.map((section) => (
                  <SelectItem key={section} value={section!}>
                    {section}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Badge variant="secondary">{filteredStudents.length} estudiantes</Badge>
          </div>

          {filteredStudents.length === 0 ? (
            <div className="text-center py-8">
              <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-lg font-medium mb-2">
                {searchTerm || gradeFilter !== "all" || sectionFilter !== "all"
                  ? "No se encontraron estudiantes"
                  : "No hay estudiantes registrados"}
              </p>
              <p className="text-muted-foreground">
                {searchTerm || gradeFilter !== "all" || sectionFilter !== "all"
                  ? "Intenta con otros filtros de búsqueda"
                  : "Importa estudiantes desde un archivo Excel para comenzar"}
              </p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead>ID Estudiante</TableHead>
                    <TableHead>Correo</TableHead>
                    <TableHead>Grado</TableHead>
                    <TableHead>Sección</TableHead>
                    <TableHead>Fecha Registro</TableHead>
                    <TableHead>Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredStudents.map((student) => (
                    <TableRow key={student.id}>
                      <TableCell className="font-medium">{student.name}</TableCell>
                      <TableCell>{student.student_id || "-"}</TableCell>
                      <TableCell>{student.email || "-"}</TableCell>
                      <TableCell>{student.grade || "-"}</TableCell>
                      <TableCell>{student.section || "-"}</TableCell>
                      <TableCell>{new Date(student.created_at).toLocaleDateString("es-ES")}</TableCell>
                      <TableCell>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="outline" size="sm">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>¿Eliminar estudiante?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Esta acción eliminará al estudiante "{student.name}" y todos sus registros de
                                asistencia. Esta acción no se puede deshacer.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDeleteStudent(student.id)}>
                                Eliminar
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </TableCell>
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
