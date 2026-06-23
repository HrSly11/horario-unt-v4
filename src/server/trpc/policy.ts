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

const unscopedRoles: UserRole[] = ['ADMIN'];

export function hasRole(session: SessionLike, roles: UserRole[]) {
  return roles.includes(session.role);
}

function isUnscoped(session: SessionLike) {
  return hasRole(session, unscopedRoles);
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
  roles: UserRole[] = ['ADMIN']
) {
  if (session.docenteId && session.docenteId === docenteId) return;
  if (hasRole(session, roles)) return;

  throw new TRPCError({ code: 'FORBIDDEN', message: 'No tiene permiso para acceder a otro docente' });
}

export async function getManagedDepartamentoIds(prisma: PrismaClient, session: SessionLike) {
  if (isUnscoped(session)) return null;

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

  if (session.role === 'DECANO') {
    const facultad = await (prisma.facultad as any).findUnique({
      where: { decanoId: session.id },
      select: { departamentos: { select: { id: true } } },
    });
    return facultad?.departamentos.map(({ id }: { id: string }) => id) ?? [];
  }

  return [];
}

export async function getManagedEscuelaIds(prisma: PrismaClient, session: SessionLike) {
  if (isUnscoped(session)) return null;

  const ownerField =
    session.role === 'DIRECTOR_ESCUELA'
      ? 'directorId'
      : session.role === 'SECRETARIA_ACADEMICA'
        ? 'secretariaId'
        : null;

  if (!ownerField) return [];
  const escuela = await (prisma.escuela as any).findUnique({
    where: { [ownerField]: session.id },
    select: { id: true },
  });
  return escuela ? [escuela.id] : [];
}

export async function getManagedFacultadIds(prisma: PrismaClient, session: SessionLike) {
  if (isUnscoped(session)) return null;
  if (session.role !== 'DECANO') return [];

  const facultad = await (prisma.facultad as any).findUnique({
    where: { decanoId: session.id },
    select: { id: true },
  });
  return facultad ? [facultad.id] : [];
}

async function assertManagedScope(
  ids: string[] | null,
  targetId: string,
  scopeLabel: 'departamento' | 'escuela' | 'facultad'
) {
  if (ids === null || ids.includes(targetId)) return;
  throw new TRPCError({
    code: 'FORBIDDEN',
    message: `No tiene permiso para acceder a ${scopeLabel === 'departamento' ? 'este' : 'esta'} ${scopeLabel}`,
  });
}

export async function assertCanAccessDepartamento(
  prisma: PrismaClient,
  session: SessionLike,
  departamentoId: string
) {
  const managedDepartamentoIds = await getManagedDepartamentoIds(prisma, session);
  await assertManagedScope(managedDepartamentoIds, departamentoId, 'departamento');
}

export async function assertCanAccessEscuela(
  prisma: PrismaClient,
  session: SessionLike,
  escuelaId: string
) {
  await assertManagedScope(await getManagedEscuelaIds(prisma, session), escuelaId, 'escuela');
}

export async function assertCanAccessFacultad(
  prisma: PrismaClient,
  session: SessionLike,
  facultadId: string
) {
  await assertManagedScope(await getManagedFacultadIds(prisma, session), facultadId, 'facultad');
}

export async function assertCanAccessDocenteDepartamento(
  prisma: PrismaClient,
  session: SessionLike,
  docenteId: string
) {
  if (session.docenteId && session.docenteId === docenteId) return;

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

export async function assertFacultyPeriodNotPublished(
  prisma: any,
  params: {
    periodoId?: string;
    docenteId?: string;
    departamentoId?: string;
    escuelaId?: string;
    declaracionId?: string;
    grupoId?: string;
    facultadId?: string;
  }
) {
  let facultadId = params.facultadId;
  let periodoId = params.periodoId;

  if (!facultadId) {
    if (params.docenteId && prisma?.docente?.findUnique) {
      const docente = await prisma.docente.findUnique({
        where: { id: params.docenteId },
        select: { departamento: { select: { facultadId: true } } },
      });
      facultadId = docente?.departamento?.facultadId;
    } else if (params.departamentoId && prisma?.departamento?.findUnique) {
      const dept = await prisma.departamento.findUnique({
        where: { id: params.departamentoId },
        select: { facultadId: true },
      });
      facultadId = dept?.facultadId;
    } else if (params.escuelaId && prisma?.escuela?.findUnique) {
      const escuela = await prisma.escuela.findUnique({
        where: { id: params.escuelaId },
        select: { facultadId: true },
      });
      facultadId = escuela?.facultadId;
    } else if (params.declaracionId && prisma?.declaracionCarga?.findUnique) {
      const decl = await prisma.declaracionCarga.findUnique({
        where: { id: params.declaracionId },
        select: {
          periodoId: true,
          docente: { select: { departamento: { select: { facultadId: true } } } },
        },
      });
      if (decl) {
        facultadId = decl.docente?.departamento?.facultadId;
        if (!periodoId) {
          periodoId = decl.periodoId;
        }
      }
    } else if (params.grupoId && prisma?.grupo?.findUnique) {
      const grupo = await prisma.grupo.findUnique({
        where: { id: params.grupoId },
        select: {
          curso: { select: { departamentoOwner: { select: { facultadId: true } } } },
        },
      });
      facultadId = grupo?.curso?.departamentoOwner?.facultadId;
    }
  }

  if (facultadId && periodoId && prisma?.publicacionAcademica?.findUnique) {
    const pub = await prisma.publicacionAcademica.findUnique({
      where: {
        facultadId_periodoId: {
          facultadId,
          periodoId,
        },
      },
    });
    if (pub) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'El periodo académico está congelado por publicación oficial final en esta facultad.',
      });
    }
  }
}
