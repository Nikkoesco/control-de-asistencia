"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
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
import { Plus, Edit, Trash2, GraduationCap } from "lucide-react"

interface Class {
  id: string
  name: string
  description: string | null
  teacher_id: string | null
  created_at: string
  profiles?: {
    full_name: string | null
    email: string
  }
}

export default function ClassesManagement() {
  const [classes, setClasses] = useState<Class[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingClass, setEditingClass] = useState<Class | null>(null)
  const [formData, setFormData] = useState({
    name: "",
    description: "",
  })

  useEffect(() => {
    fetchClasses()
  }, [])

  const fetchClasses = async () => {
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from("classes")
        .select(`
          *,
          profiles (full_name, email)
        `)
        .order("created_at", { ascending: false })

      if (error) throw error
      setClasses(data || [])
    } catch (error) {
      console.error("Error al cargar clases:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.name.trim()) {
      alert("El nombre de la clase es requerido")
      return
    }

    try {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        alert("Debes estar autenticado")
        return
      }

      if (editingClass) {
        // Update existing class
        const { error } = await supabase
          .from("classes")
          .update({
            name: formData.name,
            description: formData.description || null,
          })
          .eq("id", editingClass.id)

        if (error) throw error
        alert("Clase actualizada exitosamente")
      } else {
        // Create new class
        const { error } = await supabase.from("classes").insert({
          name: formData.name,
          description: formData.description || null,
          teacher_id: user.id,
        })

        if (error) throw error
        alert("Clase creada exitosamente")
      }

      setIsDialogOpen(false)
      setEditingClass(null)
      setFormData({ name: "", description: "" })
      fetchClasses()
    } catch (error) {
      console.error("Error al guardar clase:", error)
      alert("Error al guardar la clase")
    }
  }

  const handleEdit = (classItem: Class) => {
    setEditingClass(classItem)
    setFormData({
      name: classItem.name,
      description: classItem.description || "",
    })
    setIsDialogOpen(true)
  }

  const handleDelete = async (classId: string) => {
    try {
      const supabase = createClient()
      const { error } = await supabase.from("classes").delete().eq("id", classId)

      if (error) throw error

      setClasses((prev) => prev.filter((c) => c.id !== classId))
      alert("Clase eliminada exitosamente")
    } catch (error) {
      console.error("Error al eliminar clase:", error)
      alert("Error al eliminar la clase")
    }
  }

  const resetForm = () => {
    setFormData({ name: "", description: "" })
    setEditingClass(null)
  }

  if (isLoading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
        <p>Cargando clases...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Gestión de Clases</CardTitle>
              <CardDescription>Administra las clases del sistema</CardDescription>
            </div>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={resetForm}>
                  <Plus className="h-4 w-4 mr-2" />
                  Nueva Clase
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{editingClass ? "Editar Clase" : "Nueva Clase"}</DialogTitle>
                  <DialogDescription>
                    {editingClass ? "Modifica los datos de la clase" : "Crea una nueva clase en el sistema"}
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit}>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Nombre de la Clase</Label>
                      <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        placeholder="Ej: Matemáticas 1A"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="description">Descripción</Label>
                      <Textarea
                        id="description"
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        placeholder="Descripción opcional de la clase"
                        rows={3}
                      />
                    </div>
                  </div>
                  <DialogFooter className="mt-6">
                    <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                      Cancelar
                    </Button>
                    <Button type="submit">{editingClass ? "Actualizar" : "Crear"} Clase</Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {classes.length === 0 ? (
            <div className="text-center py-8">
              <GraduationCap className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-lg font-medium mb-2">No hay clases registradas</p>
              <p className="text-muted-foreground mb-4">Crea tu primera clase para comenzar</p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Descripción</TableHead>
                    <TableHead>Profesor</TableHead>
                    <TableHead>Fecha Creación</TableHead>
                    <TableHead>Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {classes.map((classItem) => (
                    <TableRow key={classItem.id}>
                      <TableCell className="font-medium">{classItem.name}</TableCell>
                      <TableCell>{classItem.description || "-"}</TableCell>
                      <TableCell>
                        {classItem.profiles?.full_name || classItem.profiles?.email || "Sin asignar"}
                      </TableCell>
                      <TableCell>{new Date(classItem.created_at).toLocaleDateString("es-ES")}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button variant="outline" size="sm" onClick={() => handleEdit(classItem)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="outline" size="sm">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>¿Eliminar clase?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Esta acción eliminará la clase "{classItem.name}" y todos sus registros de asistencia.
                                  Esta acción no se puede deshacer.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDelete(classItem.id)}>
                                  Eliminar
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
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
