"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Search, Users, Shield } from "lucide-react"
import Link from "next/link"

interface Student {
  id: string
  name: string
  last_name: string | null
  email: string | null
  student_id: string | null
  grade: string | null
  section: string | null
  created_at: string
  colony_name: string
  colony_code: string
}

interface Profile {
  id: string
  email: string
  full_name: string | null
  role: string
  colony_id: string | null
}

export default function StudentsPage() {
  const [students, setStudents] = useState<Student[]>([])
  const [filteredStudents, setFilteredStudents] = useState<Student[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [userProfile, setUserProfile] = useState<Profile | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    checkUserAndFetchStudents()
  }, [])

  useEffect(() => {
    const filtered = students.filter(
      (student) =>
        student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (student.last_name && student.last_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
        student.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        student.student_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        student.grade?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        student.section?.toLowerCase().includes(searchTerm.toLowerCase()),
    )
    setFilteredStudents(filtered)
  }, [students, searchTerm])

  const checkUserAndFetchStudents = async () => {
    try {
      const supabase = createClient()
      
      // Obtener el usuario actual
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (authError || !user) {
        window.location.href = '/auth/login'
        return
      }

      // Obtener el perfil del usuario
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      if (profileError || !profile) {
        window.location.href = '/dashboard'
        return
      }

      setUserProfile(profile)
      setIsAdmin(profile.role === 'admin')

      // Si es admin, mostrar todos los estudiantes
      // Si es usuario, mostrar solo los de su colonia
      if (profile.role === 'admin') {
        await fetchAllStudents()
      } else if (profile.colony_id) {
        await fetchStudentsByColony(profile.colony_id)
      } else {
        // Usuario sin colonia asignada
        setStudents([])
        setIsLoading(false)
      }
    } catch (error) {
      console.error('Error al verificar usuario:', error)
      window.location.href = '/dashboard'
    }
  }

  const fetchAllStudents = async () => {
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('students')
        .select(`
          *,
          colonies:colony_id(name, colony_code)
        `)
        .order('created_at', { ascending: false })

      if (error) throw error

      const formattedStudents = data?.map(student => ({
        ...student,
        colony_name: student.colonies?.name || 'Sin nombre',
        colony_code: student.colonies?.colony_code || 'Sin código'
      })) || []
      
      setStudents(formattedStudents)
    } catch (error) {
      console.error('Error fetching students:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const fetchStudentsByColony = async (colonyId: string) => {
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('students')
        .select(`
          *,
          colonies:colony_id(name, colony_code)
        `)
        .eq('colony_id', colonyId)
        .order('created_at', { ascending: false })

      if (error) throw error

      const formattedStudents = data?.map(student => ({
        ...student,
        colony_name: student.colonies?.name || 'Sin nombre',
        colony_code: student.colonies?.colony_code || 'Sin código'
      })) || []
      
      setStudents(formattedStudents)
    } catch (error) {
      console.error('Error fetching students by colony:', error)
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p>Cargando estudiantes...</p>
        </div>
      </div>
    )
  }

  // Si el usuario no es admin y no tiene colonia asignada
  if (!isAdmin && !userProfile?.colony_id) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <Shield className="h-16 w-16 text-yellow-600 mx-auto mb-4" />
            <CardTitle className="text-2xl">Sin Colonia Asignada</CardTitle>
            <CardDescription>
              No tienes una colonia asignada. Contacta a un administrador para que te asigne una colonia.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Button asChild>
              <Link href="/dashboard">Volver al Dashboard</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm" asChild>
                <Link href="/dashboard">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Volver al Dashboard
                </Link>
              </Button>
              <h1 className="text-2xl font-bold">Lista de Estudiantes</h1>
            </div>
            {!isAdmin && userProfile?.colony_id && (
              <Badge variant="secondary">
                Colonia: {students[0]?.colony_name || 'Cargando...'}
              </Badge>
            )}
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              {isAdmin ? 'Estudiantes Registrados' : 'Estudiantes de tu Colonia'}
            </CardTitle>
            <CardDescription>
              {isAdmin 
                ? 'Lista completa de estudiantes en el sistema'
                : 'Estudiantes asignados a tu colonia'
              }
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4 mb-6">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar estudiantes..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Badge variant="secondary">
                {filteredStudents.length} estudiante{filteredStudents.length !== 1 ? "s" : ""}
              </Badge>
            </div>

            {filteredStudents.length === 0 ? (
              <div className="text-center py-8">
                <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-lg font-medium mb-2">
                  {searchTerm ? "No se encontraron estudiantes" : "No hay estudiantes registrados"}
                </p>
                <p className="text-muted-foreground mb-4">
                  {searchTerm
                    ? "Intenta con otros términos de búsqueda"
                    : isAdmin 
                      ? "Importa estudiantes desde un archivo Excel para comenzar"
                      : "No hay estudiantes asignados a tu colonia"
                  }
                </p>
                {!searchTerm && isAdmin && (
                  <Button asChild>
                    <Link href="/import">Importar Estudiantes</Link>
                  </Button>
                )}
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nombre y Apellido</TableHead>
                      {isAdmin && <TableHead>Colonia</TableHead>}
                      <TableHead>Temporada</TableHead>
                      <TableHead>Fecha Registro</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredStudents.map((student) => (
                      <TableRow key={student.id}>
                        <TableCell className="font-medium">{student.name}</TableCell>
                        {isAdmin && (
                          <TableCell>
                            <div className="space-y-1">
                              <div className="font-medium">{student.colony_name}</div>
                              {student.colony_code && (
                                <div className="text-xs text-muted-foreground font-mono">
                                  {student.colony_code}
                                </div>
                              )}
                            </div>
                          </TableCell>
                        )}
                        <TableCell>
                          <Badge variant="secondary">
                            {student.season || '2024-2025'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {new Date(student.created_at).toLocaleDateString("es-ES")}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
