import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import Link from "next/link"
import { Users, FileSpreadsheet, Calendar, Settings, Shield, User } from "lucide-react"

export default async function DashboardPage() {
  const supabase = await createClient()

  const { data, error } = await supabase.auth.getUser()
  if (error || !data?.user) {
    redirect("/auth/login")
  }

  // Get user profile with role
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", data.user.id).single()

  const isAdmin = profile?.role === "admin"

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold">Sistema de Asistencia de Colonias BNA</h1>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                {isAdmin ? (
                  <Shield className="h-4 w-4 text-blue-600" />
                ) : (
                  <User className="h-4 w-4 text-green-600" />
                )}
                <span className="text-sm text-muted-foreground">
                  Bienvenido, {profile?.full_name || data.user.email}
                </span>
              </div>
              <form action="/auth/logout" method="post">
                <Button variant="outline" size="sm">
                  Cerrar Sesión
                </Button>
              </form>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="mb-8 text-center">
          <h2 className="text-3xl font-bold mb-2">Panel de Control</h2>
          <p className="text-muted-foreground">
            {isAdmin
              ? "Como administrador, puedes gestionar estudiantes, importar datos y configurar el sistema."
              : "Como usuario, puedes marcar asistencia y ver los registros de los estudiantes."}
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {/* Tarjeta de Asistencia - Solo para usuarios regulares */}
          {!isAdmin && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Marcar Asistencia
                </CardTitle>
                <CardDescription>Registra la asistencia diaria de los estudiantes</CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild className="w-full">
                  <Link href="/attendance">Ir a Asistencia</Link>
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Solo mostrar estas tarjetas si es admin */}
          {isAdmin && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Ver Estudiantes
                  </CardTitle>
                  <CardDescription>Consulta la lista de estudiantes registrados</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button asChild variant="outline" className="w-full bg-transparent">
                    <Link href="/students">Ver Estudiantes</Link>
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="h-5 w-5" />
                    Gestionar Colonias
                  </CardTitle>
                  <CardDescription>Crea y gestiona colonias de estudiantes</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button asChild variant="outline" className="w-full bg-transparent">
                    <Link href="/colonies">Gestionar Colonias</Link>
                  </Button>
                </CardContent>
              </Card>

              {/* ❌ ELIMINADO: Tarjeta de Importar Excel */}
              
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Settings className="h-5 w-5" />
                    Administración
                  </CardTitle>
                  <CardDescription>Gestiona usuarios, clases y configuración</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button asChild variant="secondary" className="w-full">
                    <Link href="/admin">Panel Admin</Link>
                  </Button>
                </CardContent>
              </Card>
            </>
          )}
        </div>

        {/* Información del rol */}
        {profile?.role && (
          <div className="mt-8 p-4 bg-muted rounded-lg">
            <div className="flex items-center gap-2">
              {isAdmin ? (
                <Shield className="h-5 w-5 text-blue-600" />
              ) : (
                <User className="h-5 w-5 text-green-600" />
              )}
              <p className="text-sm">
                <strong>Rol actual:</strong> {profile.role === "admin" ? "Administrador" : "Usuario"}
              </p>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {isAdmin 
                ? "Tienes acceso completo a todas las funcionalidades del sistema."
                : "Solo puedes marcar asistencia y ver estudiantes. Contacta a un administrador para más permisos."
              }
            </p>
          </div>
        )}
      </main>
    </div>
  )
}
