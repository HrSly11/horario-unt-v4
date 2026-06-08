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
    <aside className="fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-border bg-white">
      {/* Logo */}
      <div className="flex h-16 items-center gap-3 px-6">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary shadow-lg shadow-primary/20">
          <GraduationCap className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="text-sm font-bold text-text-main tracking-tight leading-none">Horarios ISI</h1>
          <p className="text-[10px] text-text-sub uppercase tracking-widest font-bold mt-0.5">UNT</p>
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
                group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium
                transition-all duration-200
                ${isActive
                  ? 'bg-primary-light text-primary'
                  : 'text-text-sub hover:bg-slate-50 hover:text-text-main'
                }
              `}
            >
              <Icon className={`h-4.5 w-4.5 shrink-0 ${
                isActive ? 'text-primary' : 'text-slate-400 group-hover:text-text-sub'
              }`} />
              {item.name}
              {isActive && (
                <div className="ml-auto h-1.5 w-1.5 rounded-full bg-primary" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* User Footer */}
      {user && (
        <div className="mt-auto border-t border-border p-4">
          <div className="space-y-2">
            <Link
              href="/perfil"
              className="flex items-center gap-3 rounded-xl p-2 hover:bg-slate-50 transition-all group"
            >
              <div className="h-9 w-9 rounded-full bg-slate-100 flex items-center justify-center border border-border group-hover:border-primary/20 group-hover:bg-primary-light transition-colors">
                <UserIcon className="h-4.5 w-4.5 text-text-sub group-hover:text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-text-main truncate leading-tight">{user.nombre}</p>
                <p className="text-[9px] text-text-sub uppercase font-bold tracking-wider">{user.role.replace('_', ' ')}</p>
              </div>
            </Link>
            <button
              onClick={() => logoutMutation.mutate()}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-[11px] font-bold text-text-sub hover:text-danger hover:bg-red-50 transition-colors uppercase tracking-wider"
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
