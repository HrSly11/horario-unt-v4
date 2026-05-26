import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { decrypt } from './lib/auth';

// Rutas que requieren autenticación
const protectedRoutes = ['/perfil', '/asignacion', '/disponibilidad'];
// Rutas que requieren ser Admin o Secretaria (Asignación)
const assignmentRoutes = ['/asignacion'];
// Rutas que requieren ser Admin, Secretaria o Director (Admin tools)
const adminRoutes = ['/usuarios', '/bitacora'];
// Rutas públicas que no deberían verse si ya estás logueado (ej: login, registro)
const authRoutes = ['/login', '/registro'];

export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;

  // 1. Obtener sesión de la cookie
  const session = request.cookies.get('session')?.value;
  let user = null;

  if (session) {
    try {
      user = await decrypt(session);
    } catch (e) {
      // Token inválido o expirado
    }
  }

  // 2. Redirección si intenta ir a login/registro ya logueado
  if (authRoutes.includes(path) && user) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  // 3. Redirección si intenta ir a ruta protegida sin estar logueado
  if (protectedRoutes.some(route => path.startsWith(route)) && !user) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // 4. Redirección si intenta ir a ruta de asignación (Solo Admin y Secretaria)
  if (assignmentRoutes.some(route => path.startsWith(route))) {
    if (!user || (user.role !== 'ADMIN' && user.role !== 'SECRETARIA_ACADEMICA')) {
      return NextResponse.redirect(new URL('/', request.url));
    }
  }

  // 5. Redirección si intenta ir a ruta de admin (Admin, Secretaria, Director)
  if (adminRoutes.some(route => path.startsWith(route))) {
    if (!user || (user.role !== 'ADMIN' && user.role !== 'SECRETARIA_ACADEMICA' && user.role !== 'DIRECTOR_ESCUELA')) {
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
