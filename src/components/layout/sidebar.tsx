'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  BookOpen,
  Building2,
  CalendarDays,
  Calendar,
  FileText,
  GraduationCap,
  History,
  ShieldCheck,
  User as UserIcon,
  LogOut,
  ChevronRight,
  Clock,
} from 'lucide-react';
import { useTRPC } from '@/trpc/client';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation } from '@tanstack/react-query';

export function Sidebar() {
  const pathname = usePathname();
  const trpc = useTRPC();
  const router = useRouter();

  const { data: user } = useQuery({ ...trpc.auth.me.queryOptions() });
  const logoutMutation = useMutation(
    trpc.auth.logout.mutationOptions({
      onSuccess: () => {
        router.push('/login');
        router.refresh();
      },
    })
  );

  const role = user?.role;

  const ROLE_NAV_MAP: Record<string, { name: string; href: string; icon: React.ElementType }[]> = {
    ADMIN: [
      { name: 'Dashboard', href: '/', icon: LayoutDashboard },
      { name: 'Organización', href: '/organizacion', icon: Building2 },
      { name: 'Docentes', href: '/docentes', icon: Users },
      { name: 'Cursos', href: '/cursos', icon: BookOpen },
      { name: 'Aulas', href: '/aulas', icon: Building2 },
      { name: 'Periodos', href: '/periodos', icon: CalendarDays },
      { name: 'Carga Lectiva', href: '/carga-lectiva', icon: BookOpen },
      { name: 'Declaraciones', href: '/declaraciones', icon: FileText },
      { name: 'Horarios', href: '/horarios', icon: Calendar },
      { name: 'Reportes', href: '/reportes', icon: FileText },
      { name: 'Asignación', href: '/asignacion', icon: Calendar },
      { name: 'Gestión Usuarios', href: '/usuarios', icon: ShieldCheck },
      { name: 'Bitácora', href: '/bitacora', icon: History },
    ],
    DECANO: [
      { name: 'Dashboard', href: '/', icon: LayoutDashboard },
      { name: 'Declaraciones', href: '/declaraciones', icon: FileText },
      { name: 'Formatos', href: '/formatos', icon: FileText },
      { name: 'Reportes', href: '/reportes', icon: FileText },
      { name: 'Docentes', href: '/docentes', icon: Users },
    ],
    DIRECTOR_DEPARTAMENTO: [
      { name: 'Dashboard', href: '/', icon: LayoutDashboard },
      { name: 'Carga Lectiva', href: '/carga-lectiva', icon: BookOpen },
      { name: 'Declaraciones', href: '/declaraciones', icon: FileText },
      { name: 'Docentes', href: '/docentes', icon: Users },
      { name: 'Horarios', href: '/horarios', icon: Calendar },
    ],
    SECRETARIA_DEPARTAMENTO: [
      { name: 'Dashboard', href: '/', icon: LayoutDashboard },
      { name: 'Carga Lectiva', href: '/carga-lectiva', icon: BookOpen },
      { name: 'Carga No Lectiva', href: '/carga-no-lectiva', icon: Clock },
      { name: 'Declaraciones', href: '/declaraciones', icon: FileText },
      { name: 'Docentes', href: '/docentes', icon: Users },
      { name: 'Horarios', href: '/horarios', icon: Calendar },
      { name: 'Reportes', href: '/reportes', icon: FileText },
      { name: 'Asignación', href: '/asignacion', icon: Calendar },
    ],
    SECRETARIA_ACADEMICA: [
      { name: 'Dashboard', href: '/', icon: LayoutDashboard },
      { name: 'Docentes', href: '/docentes', icon: Users },
      { name: 'Cursos', href: '/cursos', icon: BookOpen },
      { name: 'Aulas', href: '/aulas', icon: Building2 },
      { name: 'Periodos', href: '/periodos', icon: CalendarDays },
      { name: 'Horarios', href: '/horarios', icon: Calendar },
      { name: 'Reportes', href: '/reportes', icon: FileText },
      { name: 'Asignación', href: '/asignacion', icon: Calendar },
    ],
    DIRECTOR_ESCUELA: [
      { name: 'Dashboard', href: '/', icon: LayoutDashboard },
      { name: 'Docentes', href: '/docentes', icon: Users },
      { name: 'Cursos', href: '/cursos', icon: BookOpen },
      { name: 'Aulas', href: '/aulas', icon: Building2 },
      { name: 'Periodos', href: '/periodos', icon: CalendarDays },
      { name: 'Horarios', href: '/horarios', icon: Calendar },
      { name: 'Reportes', href: '/reportes', icon: FileText },
    ],
    DOCENTE: [
      { name: 'Dashboard', href: '/', icon: LayoutDashboard },
      { name: 'Horario Personal', href: '/horario-personal', icon: Calendar },
      { name: 'Carga No Lectiva', href: '/carga-no-lectiva', icon: Clock },
      { name: 'Declaraciones', href: '/declaraciones', icon: FileText },
      { name: 'Formatos', href: '/formatos', icon: FileText },
      { name: 'Cursos', href: '/cursos', icon: BookOpen },
      { name: 'Horarios', href: '/horarios', icon: Calendar },
      { name: 'Mi Disponibilidad', href: '/disponibilidad', icon: Calendar },
    ],
    INVITADO: [
      { name: 'Dashboard', href: '/', icon: LayoutDashboard },
      { name: 'Docentes', href: '/docentes', icon: Users },
      { name: 'Cursos', href: '/cursos', icon: BookOpen },
      { name: 'Aulas', href: '/aulas', icon: Building2 },
      { name: 'Periodos', href: '/periodos', icon: CalendarDays },
      { name: 'Horarios', href: '/horarios', icon: Calendar },
    ],
  };

  const navigation = role ? (ROLE_NAV_MAP[role] || ROLE_NAV_MAP.INVITADO!) : ROLE_NAV_MAP.INVITADO!;

  return (
    <aside className="fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-slate-200 bg-white shadow-sm">
      {/* Logo */}
      <div className="flex h-16 items-center gap-3 border-b border-slate-200 px-6">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600 shadow-sm">
          <GraduationCap className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="text-sm font-bold text-slate-950 tracking-tight">Horarios ISI</h1>
          <p className="text-[10px] text-slate-500 uppercase tracking-widest">UNT</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-3 py-4 overflow-y-auto">
        {navigation.map((item) => {
          const isActive = pathname === item.href ||
            (item.href !== '/' && pathname.startsWith(item.href));
          const Icon = item.icon;

          return (
            <Link
              key={item.name}
              href={item.href}
              className={`
                group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium
                transition-all duration-200
                ${isActive
                  ? 'bg-indigo-50 text-indigo-700 shadow-sm ring-1 ring-indigo-100'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950'
                }
              `}
            >
              <Icon className={`h-4.5 w-4.5 shrink-0 ${
                isActive ? 'text-indigo-600' : 'text-slate-400 group-hover:text-slate-600'
              }`} />
              {item.name}
              {isActive && (
                <span className="ml-auto h-1.5 w-1.5 rounded-full bg-indigo-600" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* User Footer (Sólo si está logueado) */}
      {user && (
        <div className="border-t border-slate-200 p-4">
          <div className="space-y-3">
            <Link
              href="/perfil"
              className="flex items-center gap-3 rounded-lg p-2 hover:bg-slate-100 transition-colors group"
            >
              <div className="h-8 w-8 rounded-full bg-indigo-50 flex items-center justify-center border border-indigo-100">
                <UserIcon className="h-4 w-4 text-indigo-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-950 truncate">{user.nombre}</p>
                <p className="text-[10px] text-slate-500 uppercase">{user.role}</p>
              </div>
              <ChevronRight className="h-4 w-4 text-slate-400 group-hover:text-slate-600" />
            </Link>
            <button
              onClick={() => logoutMutation.mutate()}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
            >
              <LogOut className="h-4 w-4" />
              Cerrar Sesión
            </button>
          </div>
        </div>
      )}
    </aside>
  );
}
