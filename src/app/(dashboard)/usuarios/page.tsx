'use client';

import { useTRPC } from '@/trpc/client';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { ShieldCheck, User as UserIcon, CheckCircle2, XCircle, Loader2, UserPlus, X } from 'lucide-react';
import { useState } from 'react';

export default function UsuariosPage() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { data: usersData, isLoading } = useQuery({ ...trpc.auth.listUsers.queryOptions() });
  const { data: docentes = [] } = useQuery({ ...trpc.docente.list.queryOptions({}) });
  const users = (usersData as any[]) || [];

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [formData, setFormData] = useState({
    nombre: '',
    email: '',
    password: '',
    role: 'DOCENTE' as any,
    docenteId: '',
  });

  const createUserMutation = useMutation(
    trpc.auth.createUser.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: trpc.auth.listUsers.queryKey() });
        setShowCreateModal(false);
        setFormData({ nombre: '', email: '', password: '', role: 'DOCENTE', docenteId: '' });
        alert('Usuario creado exitosamente');
      },
      onError: (err) => alert(err.message),
    })
  );

  const toggleStatusMutation = useMutation(
    trpc.auth.toggleUserStatus.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: trpc.auth.listUsers.queryKey() });
      },
    })
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-main">Gestión de Usuarios</h1>
          <p className="text-sm text-text-sub mt-1">Habilita o inhabilita cuentas de docentes y administradores</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setShowCreateModal(true)}
            className="btn-primary"
          >
            <UserPlus className="h-4 w-4" /> Crear Usuario
          </button>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white border border-border">
            <ShieldCheck className="h-5 w-5 text-text-sub" />
          </div>
        </div>
      </div>

      {showCreateModal && (
        <div className="modal-overlay">
          <div className="modal-content max-w-md">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-text-main">Nuevo Usuario</h2>
              <button onClick={() => setShowCreateModal(false)} className="rounded-lg p-1 text-text-sub hover:bg-slate-100 transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form className="space-y-4" onSubmit={(e) => {
              e.preventDefault();
              createUserMutation.mutate({
                ...formData,
                docenteId: formData.docenteId || undefined,
              });
            }}>
              <div>
                <label className="label-standard">Nombre Completo</label>
                <input
                  required
                  value={formData.nombre}
                  onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                  className="input-standard"
                  placeholder="Ej. Juan Pérez"
                />
              </div>

              <div>
                <label className="label-standard">Correo Electrónico</label>
                <input
                  required
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="input-standard"
                  placeholder="ejemplo@unt.edu.pe"
                />
              </div>

              <div>
                <label className="label-standard">Contraseña</label>
                <input
                  required
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="input-standard"
                  placeholder="Mínimo 8 caracteres"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label-standard">Rol</label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value as any })}
                    className="input-standard"
                  >
                    <option value="ADMIN">ADMIN</option>
                    <option value="DOCENTE">DOCENTE</option>
                    <option value="SECRETARIA_ACADEMICA">SECRETARIA ACADÉMICA</option>
                    <option value="DIRECTOR_ESCUELA">DIRECTOR ESCUELA</option>
                    <option value="DIRECTOR_DEPARTAMENTO">DIRECTOR DEPARTAMENTO</option>
                    <option value="SECRETARIA_DEPARTAMENTO">SECRETARIA DEPARTAMENTO</option>
                    <option value="DECANO">DECANO</option>
                  </select>
                </div>

                <div>
                  <label className="label-standard">Vincular Docente</label>
                  <select
                    value={formData.docenteId}
                    onChange={(e) => setFormData({ ...formData, docenteId: e.target.value })}
                    className="input-standard"
                  >
                    <option value="">Ninguno</option>
                    {docentes.map((d) => (
                      <option key={d.id} value={d.id}>{d.nombre}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="pt-4 flex gap-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="btn-secondary flex-1"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={createUserMutation.isPending}
                  className="btn-primary flex-1"
                >
                  {createUserMutation.isPending ? 'Creando...' : 'Crear Usuario'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="table-standard">
        <table className="w-full text-left border-separate border-spacing-0">
          <thead>
            <tr>
              <th>Usuario</th>
              <th>Rol</th>
              <th>Docente Vinculado</th>
              <th>Estado</th>
              <th className="text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="group transition-colors">
                <td>
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-full bg-slate-100 flex items-center justify-center border border-border group-hover:border-primary/30 group-hover:bg-primary-light transition-colors">
                      <UserIcon className="h-4 w-4 text-text-sub group-hover:text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-text-main group-hover:text-primary transition-colors">{user.nombre}</p>
                      <p className="text-[11px] text-text-sub font-medium">{user.email}</p>
                    </div>
                  </div>
                </td>
                <td>
                  <span className={`badge ${
                    user.role === 'ADMIN' ? 'badge-info' : 'badge-primary'
                  }`}>
                    {user.role.replace('_', ' ')}
                  </span>
                </td>
                <td>
                  {user.docente ? (
                    <div className="text-[11px]">
                      <p className="text-text-main font-bold uppercase tracking-tight">{user.docente.nombre}</p>
                      <p className="text-text-sub font-bold uppercase tracking-tighter">{user.docente.categoria}</p>
                    </div>
                  ) : (
                    <span className="text-[10px] text-text-sub/50 italic font-bold uppercase tracking-widest">No vinculado</span>
                  )}
                </td>
                <td>
                  <div className="flex items-center gap-2">
                    {user.activo ? (
                      <span className="badge badge-success">Activo</span>
                    ) : (
                      <span className="badge badge-danger">Inactivo</span>
                    )}
                  </div>
                </td>
                <td className="text-right">
                  <button
                    onClick={() => toggleStatusMutation.mutate({ userId: user.id, activo: !user.activo })}
                    disabled={toggleStatusMutation.isPending}
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all ${
                      user.activo 
                        ? 'bg-red-50 text-danger hover:bg-danger hover:text-white' 
                        : 'bg-green-50 text-success hover:bg-success hover:text-white'
                    }`}
                  >
                    {user.activo ? 'Inhabilitar' : 'Habilitar'}
                  </button>
                </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
  );
}
