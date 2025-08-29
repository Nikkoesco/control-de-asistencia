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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Search, Shield, User, Trash2, Plus, Loader2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface Profile {
  id: string
  email: string
  full_name: string | null
  role: string
  created_at: string
  colony_id?: string
  colony_name?: string
}

interface Colony {
  id: string
  name: string
  colony_code: string
}

interface CreateUserForm {
  email: string
  password: string
  full_name: string
  role: string
  colony_id: string
}

export default function UsersManagement() {
  const [users, setUsers] = useState<Profile[]>([])
  const [filteredUsers, setFilteredUsers] = useState<Profile[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [roleFilter, setRoleFilter] = useState<string>("all")
  const [isLoading, setIsLoading] = useState(true)
  const [isCreatingUser, setIsCreatingUser] = useState(false)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [colonies, setColonies] = useState<Colony[]>([])
  const [createForm, setCreateForm] = useState<CreateUserForm>({
    email: "",
    password: "",
    full_name: "",
    role: "user",
    colony_id: ""
  })
  const { toast } = useToast()

  useEffect(() => {
    fetchUsers()
    fetchColonies()
  }, [])

  useEffect(() => {
    let filtered = users.filter(
      (user) =>
        user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.full_name?.toLowerCase().includes(searchTerm.toLowerCase()),
    )

    if (roleFilter !== "all") {
      filtered = filtered.filter((user) => user.role === roleFilter)
    }

    setFilteredUsers(filtered)
  }, [users, searchTerm, roleFilter])

  const fetchUsers = async () => {
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from("profiles")
        .select(`
          *,
          colonies:colony_id(name, colony_code)
        `)
        .order("created_at", { ascending: false })

      if (error) throw error

      // Formatear los datos para incluir el nombre de la colonia
      const formattedUsers = data?.map(user => ({
        ...user,
        colony_name: user.colonies?.name || 'Sin colonia asignada'
      })) || []

      setUsers(formattedUsers)
    } catch (error) {
      console.error("Error al cargar usuarios:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const fetchColonies = async () => {
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from("colonies")
        .select("id, name, colony_code")
        .order("name", { ascending: true })

      if (error) throw error
      setColonies(data || [])
    } catch (error) {
      console.error("Error al cargar colonias:", error)
    }
  }

  const handleRoleChange = async (userId: string, newRole: string) => {
    try {
      const supabase = createClient()
      const { error } = await supabase.from("profiles").update({ role: newRole }).eq("id", userId)

      if (error) throw error

      setUsers((prev) => prev.map((user) => (user.id === userId ? { ...user, role: newRole } : user)))
      alert("Rol actualizado exitosamente")
    } catch (error) {
      console.error("Error al actualizar rol:", error)
      alert("Error al actualizar el rol")
    }
  }

  const handleDeleteUser = async (userId: string) => {
    try {
      const supabase = createClient()

      // Note: This will only delete the profile, not the auth user
      // In a real app, you'd need admin API access to delete auth users
      const { error } = await supabase.from("profiles").delete().eq("id", userId)

      if (error) throw error

      setUsers((prev) => prev.filter((user) => user.id !== userId))
      alert("Usuario eliminado exitosamente")
    } catch (error) {
      console.error("Error al eliminar usuario:", error)
      alert("Error al eliminar el usuario")
    }
  }

  const handleCreateUser = async () => {
    if (!createForm.email || !createForm.password || !createForm.full_name || !createForm.role) {
      toast({
        title: "Error",
        description: "Todos los campos son obligatorios",
        variant: "destructive"
      })
      return
    }

    // Si es usuario, la colonia es obligatoria
    if (createForm.role === "user" && !createForm.colony_id) {
      toast({
        title: "Error",
        description: "Los usuarios deben tener una colonia asignada",
        variant: "destructive"
      })
      return
    }

    setIsCreatingUser(true)
    try {
      const response = await fetch('/api/admin/create-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(createForm)
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Error al crear el usuario')
      }

      // Agregar el nuevo usuario a la lista
      setUsers(prev => [result.user, ...prev])
      
      // Limpiar el formulario y cerrar el diálogo
      setCreateForm({
        email: "",
        password: "",
        full_name: "",
        role: "user",
        colony_id: ""
      })
      setShowCreateDialog(false)

      toast({
        title: "Usuario creado",
        description: `El usuario ${createForm.email} ha sido creado exitosamente`,
      })
    } catch (error: any) {
      console.error("Error al crear usuario:", error)
      toast({
        title: "Error",
        description: error.message || "Error al crear el usuario",
        variant: "destructive"
      })
    } finally {
      setIsCreatingUser(false)
    }
  }

  const resetForm = () => {
    setCreateForm({
      email: "",
      password: "",
      full_name: "",
      role: "user",
      colony_id: ""
    })
  }

  if (isLoading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
        <p>Cargando usuarios...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Gestión de Usuarios</CardTitle>
              <CardDescription>Administra los usuarios del sistema y sus roles</CardDescription>
            </div>
            <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
              <DialogTrigger asChild>
                <Button onClick={() => setShowCreateDialog(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Crear Usuario
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle>Crear Nuevo Usuario</DialogTitle>
                  <DialogDescription>
                    Crea un nuevo usuario en el sistema. El usuario podrá iniciar sesión inmediatamente.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="email" className="text-right">
                      Email
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      value={createForm.email}
                      onChange={(e) => setCreateForm(prev => ({ ...prev, email: e.target.value }))}
                      className="col-span-3"
                      placeholder="usuario@ejemplo.com"
                    />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="password" className="text-right">
                      Contraseña
                    </Label>
                    <Input
                      id="password"
                      type="password"
                      value={createForm.password}
                      onChange={(e) => setCreateForm(prev => ({ ...prev, password: e.target.value }))}
                      className="col-span-3"
                      placeholder="Contraseña segura"
                    />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="full_name" className="text-right">
                      Nombre
                    </Label>
                    <Input
                      id="full_name"
                      value={createForm.full_name}
                      onChange={(e) => setCreateForm(prev => ({ ...prev, full_name: e.target.value }))}
                      className="col-span-3"
                      placeholder="Nombre completo"
                    />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="role" className="text-right">
                      Rol
                    </Label>
                    <Select 
                      value={createForm.role} 
                      onValueChange={(value) => setCreateForm(prev => ({ ...prev, role: value }))}
                    >
                      <SelectTrigger className="col-span-3">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="user">Usuario</SelectItem>
                        <SelectItem value="admin">Administrador</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="colony" className="text-right">
                      Colonia
                    </Label>
                    <Select 
                      value={createForm.colony_id} 
                      onValueChange={(value) => setCreateForm(prev => ({ ...prev, colony_id: value }))}
                      disabled={createForm.role === "admin"}
                    >
                      <SelectTrigger className="col-span-3">
                        <SelectValue placeholder={createForm.role === "admin" ? "No aplica para administradores" : "Seleccionar colonia"} />
                      </SelectTrigger>
                      <SelectContent>
                        {colonies.map((colony) => (
                          <SelectItem key={colony.id} value={colony.id}>
                            {colony.name} ({colony.colony_code})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      setShowCreateDialog(false)
                      resetForm()
                    }}
                  >
                    Cancelar
                  </Button>
                  <Button 
                    onClick={handleCreateUser} 
                    disabled={isCreatingUser}
                  >
                    {isCreatingUser ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Creando...
                      </>
                    ) : (
                      "Crear Usuario"
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 mb-6">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar usuarios..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Filtrar por rol" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los roles</SelectItem>
                <SelectItem value="admin">Administradores</SelectItem>
                <SelectItem value="user">Usuarios</SelectItem>
              </SelectContent>
            </Select>
            <Badge variant="secondary">{filteredUsers.length} usuarios</Badge>
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Usuario</TableHead>
                  <TableHead>Correo</TableHead>
                  <TableHead>Rol</TableHead>
                  <TableHead>Colonia</TableHead>
                  <TableHead>Fecha Registro</TableHead>
                  <TableHead>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {user.role === "admin" ? (
                          <Shield className="h-4 w-4 text-blue-600" />
                        ) : (
                          <User className="h-4 w-4 text-gray-600" />
                        )}
                        <span className="font-medium">{user.full_name || "Sin nombre"}</span>
                      </div>
                    </TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>
                      <Select value={user.role} onValueChange={(value) => handleRoleChange(user.id, value)}>
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="user">Usuario</SelectItem>
                          <SelectItem value="admin">Admin</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      {user.role === "admin" ? (
                        <Badge variant="secondary">No aplica</Badge>
                      ) : (
                        <span>{user.colony_name || "Sin colonia"}</span>
                      )}
                    </TableCell>
                    <TableCell>{new Date(user.created_at).toLocaleDateString("es-ES")}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="outline" size="sm">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>¿Eliminar usuario?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Esta acción eliminará el perfil del usuario {user.email}. Esta acción no se puede
                                deshacer.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDeleteUser(user.id)}>Eliminar</AlertDialogAction>
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
        </CardContent>
      </Card>
    </div>
  )
}
