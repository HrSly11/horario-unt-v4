import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { decrypt } from './lib/auth';

type SessionUser = {
  role?: string;
};

const authRoutes = ['/login', '/registro'];
const dashboardRoutes = [
  '/',
  '/perfil',
  '/organizacion',
  '/docentes',
  '/cursos',
  '/aulas',
  '/periodos',
  '/carga-lectiva',
  '/carga-no-lectiva',
  '/declaraciones',
  '/formatos',
  '/horario-personal',
  '/horarios',
  '/disponibilidad',
  '/reportes',
  '/asignacion',
  '/usuarios',
  '/bitacora',
];

const routeRoles: Record<string, string[]> = {
  '/organizacion': ['ADMIN'],
  '/docentes': ['ADMIN', 'SECRETARIA_ACADEMICA', 'DIRECTOR_ESCUELA', 'DECANO', 'DIRECTOR_DEPARTAMENTO', 'SECRETARIA_DEPARTAMENTO'],
  '/usuarios': ['ADMIN'],
  '/bitacora': ['ADMIN'],
  '/asignacion': ['ADMIN', 'SECRETARIA_ACADEMICA', 'SECRETARIA_DEPARTAMENTO'],
  '/reportes': ['ADMIN', 'SECRETARIA_ACADEMICA', 'DIRECTOR_ESCUELA', 'DECANO', 'SECRETARIA_DEPARTAMENTO'],
  '/carga-lectiva': ['ADMIN', 'DIRECTOR_DEPARTAMENTO', 'SECRETARIA_DEPARTAMENTO', 'DOCENTE'],
  '/carga-no-lectiva': ['ADMIN', 'SECRETARIA_DEPARTAMENTO', 'DOCENTE'],
  '/declaraciones': ['ADMIN', 'DIRECTOR_DEPARTAMENTO', 'DIRECTOR_ESCUELA', 'DECANO', 'DOCENTE', 'SECRETARIA_DEPARTAMENTO'],
  '/formatos': ['ADMIN', 'DECANO', 'DOCENTE'],
  '/horario-personal': ['DOCENTE'],
  '/horarios': ['ADMIN', 'SECRETARIA_ACADEMICA', 'DIRECTOR_ESCUELA', 'DIRECTOR_DEPARTAMENTO', 'SECRETARIA_DEPARTAMENTO', 'DOCENTE', 'INVITADO'],
  '/disponibilidad': ['DOCENTE'],
};

function matchesRoute(path: string, route: string) {
  return path === route || (route !== '/' && path.startsWith(route));
}

export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;

  const session = request.cookies.get('session')?.value;
  let user: SessionUser | null = null;

  if (session) {
    try {
      user = await decrypt(session) as SessionUser;
    } catch {
      user = null;
    }
  }

  if (authRoutes.includes(path) && user) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  const isDashboardRoute = dashboardRoutes.some((route) => matchesRoute(path, route));
  if (isDashboardRoute && !user) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  const restrictedRoute = Object.keys(routeRoles)
    .sort((a, b) => b.length - a.length)
    .find((route) => matchesRoute(path, route));

  if (restrictedRoute && user) {
    const allowedRoles = routeRoles[restrictedRoute];
    if (!user.role || !allowedRoles.includes(user.role)) {
      return NextResponse.redirect(new URL('/', request.url));
    }
  }

  return NextResponse.next();
}

// Configurar en qué rutas se aplica el middleware
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
