'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { createClient } from "@/lib/supabase/client";

interface Colony {
  id: string;
  name: string;
  colony_code: string;
}

interface User {
  id: string;
  email: string;
  full_name: string;
}

interface UserColonyAccess {
  id: string;
  user_id: string;
  colony_id: string;
  access_level: 'view' | 'edit' | 'admin';
  user?: User;
  colony?: Colony;
}

export default function ColonyAccessManagement() {
  const [colonies, setColonies] = useState<Colony[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [accessRecords, setAccessRecords] = useState<UserColonyAccess[]>([]);
  const [selectedUser, setSelectedUser] = useState<string>('');
  const [selectedColony, setSelectedColony] = useState<string>('');
  const [selectedAccessLevel, setSelectedAccessLevel] = useState<'view' | 'edit' | 'admin'>('view');
  
  const { toast } = useToast();
  const supabase = createClient();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const { data: coloniesData } = await supabase
        .from('colonies')
        .select('*')
        .order('name');
      setColonies(coloniesData || []);

      const { data: usersData } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'user')
        .order('full_name');
      setUsers(usersData || []);

      const { data: accessData } = await supabase
        .from('user_colony_access')
        .select(`
          *,
          user:profiles!user_colony_access_user_id_fkey(*),
          colony:colonies!user_colony_access_colony_id_fkey(*)
        `);
      setAccessRecords(accessData || []);
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const grantAccess = async () => {
    if (!selectedUser || !selectedColony) return;

    try {
      const { error } = await supabase
        .from('user_colony_access')
        .upsert({
          user_id: selectedUser,
          colony_id: selectedColony,
          access_level: selectedAccessLevel,
        });

      if (error) throw error;

      toast({
        title: 'Acceso concedido',
        description: 'El usuario ahora tiene acceso a la colonia',
      });

      setSelectedUser('');
      setSelectedColony('');
      fetchData();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudo conceder el acceso',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Gestión de Acceso a Colonias</CardTitle>
          <CardDescription>
            Asigna qué colonias puede ver cada usuario
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Usuario</Label>
              <Select value={selectedUser} onValueChange={setSelectedUser}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar usuario" />
                </SelectTrigger>
                <SelectContent>
                  {users.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.full_name || user.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Colonia</Label>
              <Select value={selectedColony} onValueChange={setSelectedColony}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar colonia" />
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

            <div className="space-y-2">
              <Label>Nivel de Acceso</Label>
              <Select value={selectedAccessLevel} onValueChange={(value: 'view' | 'edit' | 'admin') => setSelectedAccessLevel(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="view">Ver</SelectItem>
                  <SelectItem value="edit">Editar</SelectItem>
                  <SelectItem value="admin">Administrar</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button onClick={grantAccess} className="w-full md:w-auto">
            Conceder Acceso
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Accesos Actuales</CardTitle>
        </CardHeader>
        <CardContent>
          {accessRecords.map((record) => (
            <div key={record.id} className="flex items-center justify-between p-4 border rounded-lg mb-2">
              <div>
                <div className="font-medium">
                  {record.user?.full_name || record.user?.email}
                </div>
                <div className="text-sm text-muted-foreground">
                  {record.colony?.name} ({record.colony?.colony_code})
                </div>
              </div>
              <Badge>{record.access_level}</Badge>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
