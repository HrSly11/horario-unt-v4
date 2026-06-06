import { TRPCError } from '@trpc/server';
import type { Prisma, PrismaClient, UserRole } from '@/generated/prisma/client';

export type SessionLike = {
  id: string;
  role: UserRole;
  docenteId?: string | null;
};

export const academicManagerRoles: UserRole[] = [
  'ADMIN',
  'SECRETARIA_ACADEMICA',
  'DIRECTOR_ESCUELA',
  'DECANO',
];

export const departmentManagerRoles: UserRole[] = [
  'ADMIN',
  'DIRECTOR_DEPARTAMENTO',
  'SECRETARIA_DEPARTAMENTO',
];

export const departmentScopedRoles: UserRole[] = [
  'DIRECTOR_DEPARTAMENTO',
  'SECRETARIA_DEPARTAMENTO',
];

export function hasRole(session: SessionLike, roles: UserRole[]) {
  return roles.includes(session.role);
}

export function assertRole(session: SessionLike, roles: UserRole[], message = 'No tiene permisos suficientes') {
  if (!hasRole(session, roles)) {
    throw new TRPCError({ code: 'FORBIDDEN', message });
  }
}

export async function assertActiveUserWithRole(
  prisma: PrismaClient,
  userId: string,
  expectedRole: UserRole
) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, activo: true },
  });

  if (!user) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Usuario no encontrado' });
  }

  if (!user.activo || user.role !== expectedRole) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: `El usuario debe estar activo y tener el rol ${expectedRole}`,
    });
  }

  return user;
}

export function buildDepartmentScopedUserWhere(
  role: 'DOCENTE' | 'DIRECTOR_DEPARTAMENTO' | 'SECRETARIA_DEPARTAMENTO',
  departamentoId: string
): Prisma.UserWhereInput {
  const where: Prisma.UserWhereInput = { role, activo: true };

  if (role === 'DOCENTE') {
    where.docente = { is: { departamentoId } };
  }

  if (role === 'DIRECTOR_DEPARTAMENTO') {
    where.OR = [
      { departamentoDirigido: { is: { id: departamentoId } } },
      { departamentoDirigido: { is: null } },
    ];
  }

  if (role === 'SECRETARIA_DEPARTAMENTO') {
    where.OR = [
      { departamentoSecretaria: { is: { id: departamentoId } } },
      { departamentoSecretaria: { is: null } },
    ];
  }

  return where;
}

export function assertDocenteSelfOrRole(
  session: SessionLike,
  docenteId: string,
  roles: UserRole[] = academicManagerRoles
) {
  if (session.role === 'DOCENTE' && session.docenteId === docenteId) return;
  if (hasRole(session, roles)) return;

  throw new TRPCError({ code: 'FORBIDDEN', message: 'No tiene permiso para acceder a otro docente' });
}

export async function getManagedDepartamentoIds(prisma: PrismaClient, session: SessionLike) {
  if (hasRole(session, academicManagerRoles)) return null;

  if (session.role === 'DIRECTOR_DEPARTAMENTO') {
    const departamento = await prisma.departamento.findUnique({
      where: { directorId: session.id },
      select: { id: true },
    });
    return departamento ? [departamento.id] : [];
  }

  if (session.role === 'SECRETARIA_DEPARTAMENTO') {
    const departamento = await prisma.departamento.findUnique({
      where: { secretariaId: session.id },
      select: { id: true },
    });
    return departamento ? [departamento.id] : [];
  }

  return [];
}

export async function assertCanAccessDepartamento(
  prisma: PrismaClient,
  session: SessionLike,
  departamentoId: string
) {
  const managedDepartamentoIds = await getManagedDepartamentoIds(prisma, session);
  if (managedDepartamentoIds === null) return;

  if (!managedDepartamentoIds.includes(departamentoId)) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'No tiene permiso para acceder a este departamento',
    });
  }
}

export async function assertCanAccessDocenteDepartamento(
  prisma: PrismaClient,
  session: SessionLike,
  docenteId: string
) {
  if (session.role === 'DOCENTE') {
    assertDocenteSelfOrRole(session, docenteId, []);
    return;
  }

  const managedDepartamentoIds = await getManagedDepartamentoIds(prisma, session);
  if (managedDepartamentoIds === null) return;

  const docente = await prisma.docente.findUniqueOrThrow({
    where: { id: docenteId },
    select: { departamentoId: true },
  });

  if (!docente.departamentoId || !managedDepartamentoIds.includes(docente.departamentoId)) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'No tiene permiso para acceder a este docente',
    });
  }
}
