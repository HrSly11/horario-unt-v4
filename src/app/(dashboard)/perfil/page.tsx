'use client';

import { useState } from 'react';
import { useTRPC } from '@/trpc/client';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { User, Mail, Lock, Shield, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';

export default function PerfilPage() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { data: user, isLoading } = useQuery({ ...trpc.auth.getProfile.queryOptions() });
  const [nombre, setNombre] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  // Initialize nombre once user is loaded
  const [isInitialized, setIsInitialized] = useState(false);
  if (user && !isInitialized) {
    setNombre(user.nombre);
    setIsInitialized(true);
  }

  const updateMutation = useMutation(
    trpc.auth.updateProfile.mutationOptions({
      onSuccess: () => {
        setSuccess(true);
        setPassword('');
        setConfirmPassword('');
        queryClient.invalidateQueries({ queryKey: trpc.auth.getProfile.queryKey() });
        queryClient.invalidateQueries({ queryKey: trpc.auth.me.queryKey() });
        setTimeout(() => setSuccess(false), 3000);
      },
      onError: (err) => {
        setError(err.message || 'Error al actualizar perfil');
      },
    })
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password && password !== confirmPassword) {
      setError('Las contraseñas no coinciden');
      return;
    }

    updateMutation.mutate({
      nombre: nombre !== user?.nombre ? nombre : undefined,
      password: password || undefined,
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-text-main tracking-tight">Mi Perfil</h1>
        <p className="text-sm text-text-sub mt-1">Administra tu información personal y seguridad de la cuenta</p>
      </div>

      <div className="card-standard overflow-hidden p-0">
        <div className="p-8 border-b border-border bg-slate-50/50">
          <div className="flex items-center gap-6">
            <div className="h-20 w-20 rounded-full bg-primary-light flex items-center justify-center border border-primary/20 shadow-sm">
              <User className="h-10 w-10 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-text-main">{user?.nombre}</h2>
              <div className="flex items-center gap-3 mt-1.5">
                <span className="badge badge-primary">
                  {user?.role.replace('_', ' ')}
                </span>
                <div className="flex items-center gap-1.5 text-sm text-text-sub font-medium">
                  <Mail className="h-4 w-4 opacity-70" />
                  {user?.email}
                </div>
              </div>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          {error && (
            <div className="flex items-center gap-3 rounded-xl bg-red-50 p-4 text-sm text-danger border border-red-100 animate-in fade-in duration-200">
              <AlertCircle className="h-5 w-5 shrink-0" />
              <p className="font-bold">{error}</p>
            </div>
          )}

          {success && (
            <div className="flex items-center gap-3 rounded-xl bg-green-50 p-4 text-sm text-success border border-green-100 animate-in fade-in duration-200">
              <CheckCircle2 className="h-5 w-5 shrink-0" />
              <p className="font-bold">Perfil actualizado correctamente</p>
            </div>
          )}

          <div className="grid grid-cols-1 gap-6">
            <div className="space-y-2">
              <label className="label-standard flex items-center gap-2">
                <User className="h-3 w-3" /> Nombre Completo
              </label>
              <input
                type="text"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                className="input-standard"
                placeholder="Tu nombre completo"
              />
            </div>

            <div className="space-y-2">
              <label className="label-standard flex items-center gap-2">
                <Mail className="h-3 w-3" /> Correo Electrónico
              </label>
              <input
                type="email"
                value={user?.email}
                disabled
                className="input-standard bg-slate-50 cursor-not-allowed opacity-70"
              />
              <p className="text-[10px] text-text-sub font-bold uppercase tracking-wider pl-1">El correo no puede ser modificado</p>
            </div>

            <div className="pt-4 border-t border-border">
              <h3 className="text-sm font-bold text-text-main flex items-center gap-2 mb-4 uppercase tracking-wider">
                <Lock className="h-4 w-4 text-primary" /> Seguridad
              </h3>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="label-standard">Nueva Contraseña</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="input-standard"
                    placeholder="••••••••"
                  />
                </div>
                <div className="space-y-2">
                  <label className="label-standard">Confirmar Contraseña</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="input-standard"
                    placeholder="••••••••"
                  />
                </div>
              </div>
              <p className="text-[10px] text-text-sub mt-2 font-bold uppercase tracking-wider pl-1">Dejar en blanco si no desea cambiar la contraseña</p>
            </div>
          </div>

          <div className="pt-4">
            <button
              type="submit"
              disabled={updateMutation.isPending}
              className="btn-primary w-full sm:w-auto px-8 py-3"
            >
              {updateMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Actualizando...
                </>
              ) : (
                'Guardar Cambios'
              )}
            </button>
          </div>
        </form>
      </div>

      <div className="mt-8 card-standard bg-slate-50/50 border-dashed">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-white rounded-xl border border-border shadow-sm">
            <Shield className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-text-main uppercase tracking-wider">Privacidad y Seguridad</h4>
            <p className="text-xs text-text-sub mt-1 leading-relaxed">
              Tu información está protegida. Los cambios en el nombre se reflejarán en todos los reportes y el sistema de horarios de forma inmediata.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
