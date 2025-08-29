"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Users, FileText, BarChart3, Shield } from "lucide-react"
import Link from "next/link"
import { redirect } from "next/navigation"
import UsersManagement from "@/components/admin/users-management"
import StudentsManagement from "@/components/admin/students-management"
import ImportHistory from "@/components/admin/import-history"
import SystemStats from "@/components/admin/system-stats"
import ColonyAccessManagement from "@/components/admin/colony-access-management"

interface Profile {
  id: string
  email: string
  full_name: string | null
  role: string
}

export default function AdminPage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    checkAdminAccess()
  }, [])

  const checkAdminAccess = async () => {
    try {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        redirect("/auth/login")
        return
      }

      const { data: profileData, error } = await supabase.from("profiles").select("*").eq("id", user.id).single()

      if (error || !profileData || profileData.role !== "admin") {
        redirect("/dashboard")
        return
      }

      setProfile(profileData)
    } catch (error) {
      console.error("Error al verificar acceso de admin:", error)
      redirect("/dashboard")
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p>Verificando permisos de administrador...</p>
        </div>
      </div>
    )
  }

  if (!profile) {
    return null
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
              <h1 className="text-2xl font-bold">Panel de Administración</h1>
            </div>
            <Badge variant="secondary">Administrador: {profile.full_name || profile.email}</Badge>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <Tabs defaultValue="stats" className="space-y-6">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="stats" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Estadísticas
            </TabsTrigger>
            <TabsTrigger value="users" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Usuarios
            </TabsTrigger>
            <TabsTrigger value="students" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Estudiantes
            </TabsTrigger>
            <TabsTrigger value="imports" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Importaciones
            </TabsTrigger>
            <TabsTrigger value="colony-access" className="flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Acceso a Colonias
            </TabsTrigger>
          </TabsList>

          <TabsContent value="stats">
            <SystemStats />
          </TabsContent>

          <TabsContent value="users">
            <UsersManagement />
          </TabsContent>

          <TabsContent value="students">
            <StudentsManagement />
          </TabsContent>

          <TabsContent value="imports">
            <ImportHistory />
          </TabsContent>
          <TabsContent value="colony-access">
            <ColonyAccessManagement />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}
