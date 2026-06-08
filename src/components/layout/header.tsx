'use client';

import Link from 'next/link';
import { useTRPC } from '@/trpc/client';
import { useQuery } from '@tanstack/react-query';
import { LogIn, User as UserIcon, Bell } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';

export function Header() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { data: user } = useQuery({ ...trpc.auth.me.queryOptions() });
  const [showNotifications, setShowNotifications] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const { data: unreadCount = 0 } = useQuery({ 
    ...trpc.notification.unreadCount.queryOptions(),
    enabled: !!user,
    refetchInterval: 10000,
  });

  const { data: notifications = [] } = useQuery({
    ...trpc.notification.list.queryOptions(),
    enabled: !!user && showNotifications,
  });

  const markAllRead = useMutation(
    trpc.notification.markAllAsRead.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: trpc.notification.unreadCount.queryKey() });
        queryClient.invalidateQueries({ queryKey: trpc.notification.list.queryKey() });
      },
    })
  );

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className="fixed top-0 right-0 left-64 z-40 h-16 border-b border-border bg-white/80 backdrop-blur-md flex items-center justify-end px-8">
      {!user && (
        <Link
          href="/login"
          className="btn-primary"
        >
          <LogIn className="h-4 w-4" />
          Iniciar Sesión
        </Link>
      )}
      {user && (
        <div className="flex items-center gap-6">
          {/* Notificaciones */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="relative rounded-full border border-border bg-white p-2 text-text-sub transition-all hover:border-primary/30 hover:bg-primary-light hover:text-primary focus:ring-4 focus:ring-primary/10 outline-none"
            >
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-danger ring-2 ring-white" />
              )}
            </button>

            {showNotifications && (
              <div className="absolute right-0 mt-3 w-80 overflow-hidden rounded-2xl border border-border bg-white shadow-2xl animate-slide-in-top">
                <div className="flex items-center justify-between border-b border-border bg-slate-50/50 p-4">
                  <h3 className="text-[11px] font-bold text-text-sub uppercase tracking-wider">Notificaciones</h3>
                  <button 
                    onClick={() => markAllRead.mutate()}
                    className="text-[10px] font-bold text-primary hover:text-primary-hover uppercase tracking-widest"
                  >
                    Marcar todo leído
                  </button>
                </div>
                <div className="max-h-80 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <div className="p-8 text-center">
                      <p className="text-xs font-medium text-text-sub">No hay notificaciones</p>
                    </div>
                  ) : (
                    notifications.map((n) => (
                      <Link
                        key={n.id}
                        href={n.link || '#'}
                        onClick={() => setShowNotifications(false)}
                        className="block border-b border-slate-50 p-4 transition-colors hover:bg-slate-50"
                      >
                        <div className="flex justify-between items-start gap-2">
                          <h4 className="text-xs font-bold text-text-main leading-tight">{n.titulo}</h4>
                          {!n.leida && <div className="h-1.5 w-1.5 rounded-full bg-primary shrink-0 mt-1" />}
                        </div>
                        <p className="mt-1 text-[11px] text-text-sub line-clamp-2">{n.mensaje}</p>
                        <span className="mt-2 block text-[9px] font-bold text-slate-400 uppercase tracking-tighter">
                          {new Date(n.createdAt).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </Link>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="h-6 w-px bg-border" />
          
          <Link href="/perfil" className="flex items-center gap-3 group">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-bold text-text-main group-hover:text-primary transition-colors leading-none">{user.nombre}</p>
              <p className="text-[10px] font-bold text-text-sub uppercase tracking-tighter mt-1">{user.role.replace('_', ' ')}</p>
            </div>
            <div className="h-9 w-9 rounded-full bg-slate-100 border border-border flex items-center justify-center text-text-sub font-bold group-hover:border-primary/30 group-hover:bg-primary-light group-hover:text-primary transition-all">
              {user.nombre.charAt(0)}
            </div>
          </Link>
        </div>
      )}
    </header>
  );
}
