'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTRPC } from '@/trpc/client';
import { useMutation } from '@tanstack/react-query';
import Link from 'next/link';
import { GraduationCap, Mail, Lock, Loader2, AlertCircle } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const trpc = useTRPC();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const loginMutation = useMutation(
    trpc.auth.login.mutationOptions({
      onSuccess: () => {
        router.push('/');
        router.refresh();
      },
      onError: (err) => {
        setError(err.message || 'Error al iniciar sesión');
      },
    })
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    loginMutation.mutate({ email, password });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-page p-4">
      <div className="w-full max-w-md space-y-8 rounded-2xl border border-border bg-white p-8 shadow-xl">
        <div className="text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary shadow-lg shadow-primary/20">
            <GraduationCap className="h-10 w-10 text-white" />
          </div>
          <h2 className="mt-6 text-3xl font-black tracking-tight text-text-main">Bienvenido</h2>
          <p className="mt-2 text-sm text-text-sub font-medium">Sistema de Horarios Académicos ISI-UNT</p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {error && (
            <div className="flex items-center gap-3 rounded-lg border border-danger/20 bg-danger/5 p-4 text-sm text-danger">
              <AlertCircle className="h-5 w-5 shrink-0" />
              <p className="font-bold">{error}</p>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="label-standard">Correo Institucional</label>
              <div className="mt-1 relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-text-sub/50" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input-standard pl-12"
                  placeholder="ejemplo@unt.edu.pe"
                />
              </div>
            </div>

            <div>
              <label className="label-standard">Contraseña</label>
              <div className="mt-1 relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-text-sub/50" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input-standard pl-12"
                  placeholder="••••••••"
                />
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={loginMutation.isPending}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3.5 text-sm font-black text-white transition-all hover:bg-primary-hover shadow-lg shadow-primary/25 disabled:opacity-50"
          >
            {loginMutation.isPending ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Iniciando sesión...
              </>
            ) : (
              'Entrar al sistema'
            )}
          </button>

          <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider">
            <Link href="/" className="text-text-sub hover:text-text-main transition-colors">
              Volver al inicio
            </Link>
            <Link href="/registro" className="text-primary hover:text-primary-hover transition-colors">
              Crear cuenta
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
