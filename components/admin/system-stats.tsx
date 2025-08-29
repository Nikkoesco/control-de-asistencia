"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Users, GraduationCap, Calendar, FileSpreadsheet, TrendingUp, Clock } from "lucide-react"

interface Stats {
  totalUsers: number
  totalStudents: number
  totalColonies: number
  totalAttendanceRecords: number
  totalImports: number
  recentAttendance: number
  adminUsers: number
  regularUsers: number
}

export default function SystemStats() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetchStats()
  }, [])

  const fetchStats = async () => {
    try {
      const supabase = createClient()

      console.log('🚀 Iniciando fetch de estadísticas...')

      // Fetch all stats in parallel
      const [
        { count: totalUsers },
        { count: totalStudents },
        { count: totalColonies },
        { count: totalAttendanceRecords },
        { count: totalImports },
        { data: profiles },
        { count: recentAttendance },
      ] = await Promise.all([
        supabase.from("profiles").select("*", { count: "exact", head: true }),
        supabase.from("students").select("*", { count: "exact", head: true }),
        supabase.from("colonies").select("*", { count: "exact", head: true }),
        supabase.from("attendance").select("*", { count: "exact", head: true }),
        supabase.from("import_sessions").select("*", { count: "exact", head: true }),
        supabase.from("profiles").select("role"),
        supabase
          .from("attendance")
          .select("*", { count: "exact", head: true })
          .gte("created_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),
      ])

      console.log('📊 Resultados de consultas:')
      console.log('Total Usuarios:', totalUsers)
      console.log('Total Estudiantes:', totalStudents)
      console.log('Total Colonias:', totalColonies)
      console.log('Total Asistencia:', totalAttendanceRecords)
      console.log('Total Importaciones:', totalImports)
      console.log('Asistencia Reciente:', recentAttendance)

      const adminUsers = profiles?.filter((p) => p.role === "admin").length || 0
      const regularUsers = profiles?.filter((p) => p.role === "user").length || 0

      console.log('👥 Usuarios Admin:', adminUsers)
      console.log('👤 Usuarios Regulares:', regularUsers)

      setStats({
        totalUsers: totalUsers || 0,
        totalStudents: totalStudents || 0,
        totalColonies: totalColonies || 0,
        totalAttendanceRecords: totalAttendanceRecords || 0,
        totalImports: totalImports || 0,
        recentAttendance: recentAttendance || 0,
        adminUsers,
        regularUsers,
      })

      console.log('✅ Estadísticas actualizadas:', {
        totalUsers: totalUsers || 0,
        totalStudents: totalStudents || 0,
        totalColonies: totalColonies || 0,
        totalAttendanceRecords: totalAttendanceRecords || 0,
        totalImports: totalImports || 0,
        recentAttendance: recentAttendance || 0,
        adminUsers,
        regularUsers,
      })

    } catch (error) {
      console.error("❌ Error al cargar estadísticas:", error)
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
        <p>Cargando estadísticas...</p>
      </div>
    )
  }

  if (!stats) {
    return (
      <div className="text-center py-8">
        <p>Error al cargar las estadísticas</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Estadísticas del Sistema</h2>
        <p className="text-muted-foreground">Resumen general del sistema de asistencia</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Usuarios</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalUsers}</div>
            <p className="text-xs text-muted-foreground">
              {stats.adminUsers} admin, {stats.regularUsers} usuarios
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Estudiantes</CardTitle>
            <GraduationCap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalStudents}</div>
            <p className="text-xs text-muted-foreground">Estudiantes registrados</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Colonias</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalColonies}</div>
            <p className="text-xs text-muted-foreground">Colonias configuradas</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Registros de Asistencia</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalAttendanceRecords}</div>
            <p className="text-xs text-muted-foreground">Total de registros</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Importaciones</CardTitle>
            <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalImports}</div>
            <p className="text-xs text-muted-foreground">Archivos importados</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Asistencia Reciente</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.recentAttendance}</div>
            <p className="text-xs text-muted-foreground">Últimos 7 días</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Distribución de Usuarios</CardTitle>
            <CardDescription>Roles de usuarios en el sistema</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span>Administradores</span>
                <div className="flex items-center gap-2">
                  <div className="w-20 bg-muted rounded-full h-2">
                    <div
                      className="bg-primary h-2 rounded-full"
                      style={{ width: `${(stats.adminUsers / stats.totalUsers) * 100}%` }}
                    ></div>
                  </div>
                  <span className="text-sm font-medium">{stats.adminUsers}</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span>Usuarios Regulares</span>
                <div className="flex items-center gap-2">
                  <div className="w-20 bg-muted rounded-full h-2">
                    <div
                      className="bg-secondary h-2 rounded-full"
                      style={{ width: `${(stats.regularUsers / stats.totalUsers) * 100}%` }}
                    ></div>
                  </div>
                  <span className="text-sm font-medium">{stats.regularUsers}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Actividad del Sistema</CardTitle>
            <CardDescription>Métricas de uso reciente</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span>Registros de Asistencia (7 días)</span>
                <span className="text-2xl font-bold text-green-600">{stats.recentAttendance}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Promedio por día</span>
                <span className="text-lg font-medium">{Math.round(stats.recentAttendance / 7)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Total de registros</span>
                <span className="text-lg font-medium">{stats.totalAttendanceRecords}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
