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
    <header className="fixed top-0 right-0 left-64 z-40 h-16 border-b border-slate-200 bg-white/85 backdrop-blur-md flex items-center justify-end px-8 shadow-sm">
      {!user && (
        <Link
          href="/login"
          className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition-all hover:bg-indigo-500 shadow-sm"
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
              className="relative rounded-full border border-slate-200 bg-white p-2 text-slate-500 shadow-sm transition-all hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700"
            >
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 h-4 w-4 rounded-full bg-red-500 text-[10px] font-bold text-white flex items-center justify-center border-2 border-white">
                  {unreadCount}
                </span>
              )}
            </button>

            {showNotifications && (
              <div className="absolute right-0 mt-3 w-80 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl animate-in fade-in slide-in-from-top-2">
                <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 p-4">
                  <h3 className="text-sm font-bold text-slate-950">Notificaciones</h3>
                  <button 
                    onClick={() => markAllRead.mutate()}
                    className="text-[10px] font-bold text-indigo-600 hover:text-indigo-700 uppercase tracking-wider"
                  >
                    Marcar todo como leído
                  </button>
                </div>
                <div className="max-h-96 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <div className="p-8 text-center">
                      <p className="text-xs text-slate-500">No hay notificaciones nuevas</p>
                    </div>
                  ) : (
                    notifications.map((n) => (
                      <Link
                        key={n.id}
                        href={n.link || '#'}
                        onClick={() => setShowNotifications(false)}
                        className={`block border-b border-slate-100 p-4 transition-colors hover:bg-slate-50 ${!n.leida ? 'bg-indigo-50' : ''}`}
                      >
                        <div className="flex justify-between items-start gap-2">
                          <h4 className="text-xs font-bold text-slate-900">{n.titulo}</h4>
                          {!n.leida && <div className="h-1.5 w-1.5 rounded-full bg-indigo-500 shrink-0" />}
                        </div>
                        <p className="text-[11px] text-slate-500 mt-1 line-clamp-2">{n.mensaje}</p>
                        <p className="text-[9px] text-slate-400 mt-2 font-medium">
                          {new Date(n.createdAt).toLocaleString()}
                        </p>
                      </Link>
                    ))
                  )}
                </div>
                <div className="border-t border-slate-100 bg-slate-50 p-3 text-center">
                  <Link href="/notificaciones" className="text-[10px] font-bold text-slate-500 hover:text-indigo-600 uppercase tracking-widest">
                    Ver todo el historial
                  </Link>
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-medium text-slate-950">{user.nombre}</p>
              <p className="text-[10px] text-slate-500 uppercase tracking-wider">{user.role}</p>
            </div>
            <Link href="/perfil" className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-slate-50 transition-colors hover:border-indigo-200 hover:bg-indigo-50">
              <UserIcon className="h-5 w-5 text-slate-500" />
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
