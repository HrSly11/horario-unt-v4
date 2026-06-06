import { describe, expect, it, vi } from 'vitest';
import { createCallerFactory } from '../init';
import { cargaLectivaRouter } from './cargaLectiva';
import { ModalidadDocente } from '@/generated/prisma/client';

vi.mock('@/lib/prisma', () => ({ prisma: {} }));
vi.mock('@/lib/auth', () => ({ getSession: vi.fn() }));

function makeSession() {
  return {
    id: 'admin-user',
    email: 'admin@example.edu',
    nombre: 'Admin',
    role: 'ADMIN' as const,
  };
}

function makeCaller(prisma: ReturnType<typeof makePrisma>) {
  const createCaller = createCallerFactory(cargaLectivaRouter);

  return createCaller(async () => ({
    prisma: prisma as any,
    headers: new Headers(),
    session: makeSession(),
  }));
}

function makePrisma({
  periodEstado = 'ASIGNACION',
  groupPeriodId = 'period-1',
  duplicateAssignment = null,
}: {
  periodEstado?: string;
  groupPeriodId?: string;
  duplicateAssignment?: { id: string; docente?: { nombre: string } | null } | null;
} = {}) {
  return {
    user: {
      findUnique: vi.fn(async () => ({
        ...makeSession(),
        docenteId: null,
        activo: true,
      })),
    },
    periodoAcademico: {
      findUniqueOrThrow: vi.fn(async () => ({ estado: periodEstado })),
    },
    grupo: {
      findUniqueOrThrow: vi.fn(async () => ({ periodoAcademicoId: groupPeriodId })),
    },
    docente: {
      findUniqueOrThrow: vi.fn(async () => ({
        modalidad: ModalidadDocente.TIEMPO_PARCIAL,
        horasContrato: 40,
        dictaOtraUniversidad: false,
      })),
    },
    asignacionCargaLectiva: {
      findFirst: vi.fn(async () => duplicateAssignment),
      findMany: vi.fn(async () => []),
      create: vi.fn(async (args) => args),
      findUniqueOrThrow: vi.fn(async () => ({
        id: 'acl-1',
        docenteId: 'docente-1',
        grupoId: 'grupo-1',
        periodoId: 'period-1',
        tipo: 'TEORIA',
        horasAsignadas: 5,
      })),
      delete: vi.fn(async (args) => args),
      update: vi.fn(async (args) => args),
    },
    cargaNoLectiva: {
      findMany: vi.fn(async () => []),
    },
  };
}

const validAssignment = {
  docenteId: 'docente-1',
  grupoId: 'grupo-1',
  periodoId: 'period-1',
  tipo: 'TEORIA' as const,
  horasAsignadas: 5,
};

describe('cargaLectivaRouter assignment rules', () => {
  it('creates lective load only after validating period, group period and group-period-type uniqueness', async () => {
    const prisma = makePrisma();
    const caller = makeCaller(prisma);

    await caller.assign(validAssignment);

    expect(prisma.periodoAcademico.findUniqueOrThrow).toHaveBeenCalledWith({
      where: { id: 'period-1' },
      select: { estado: true },
    });
    expect(prisma.grupo.findUniqueOrThrow).toHaveBeenCalledWith({
      where: { id: 'grupo-1' },
      select: { periodoAcademicoId: true },
    });
    expect(prisma.asignacionCargaLectiva.findFirst).toHaveBeenCalledWith({
      where: {
        grupoId: 'grupo-1',
        periodoId: 'period-1',
        tipo: 'TEORIA',
      },
      select: {
        id: true,
        docente: { select: { nombre: true } },
      },
    });
    expect(prisma.asignacionCargaLectiva.create).toHaveBeenCalled();
  });

  it('rejects duplicate lective load for the same group, period and type', async () => {
    const prisma = makePrisma({
      duplicateAssignment: { id: 'acl-existing', docente: { nombre: 'Ada Lovelace' } },
    });
    const caller = makeCaller(prisma);

    await expect(caller.assign(validAssignment)).rejects.toMatchObject({ code: 'CONFLICT' });
    expect(prisma.asignacionCargaLectiva.create).not.toHaveBeenCalled();
  });

  it('rejects lective load changes in immutable academic periods', async () => {
    const prisma = makePrisma({ periodEstado: 'APROBADO' });
    const caller = makeCaller(prisma);

    await expect(caller.assign(validAssignment)).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    expect(prisma.grupo.findUniqueOrThrow).not.toHaveBeenCalled();
    expect(prisma.asignacionCargaLectiva.create).not.toHaveBeenCalled();
  });

  it('rejects lective load when the group belongs to another academic period', async () => {
    const prisma = makePrisma({ groupPeriodId: 'period-other' });
    const caller = makeCaller(prisma);

    await expect(caller.assign(validAssignment)).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    expect(prisma.asignacionCargaLectiva.findFirst).not.toHaveBeenCalled();
    expect(prisma.asignacionCargaLectiva.create).not.toHaveBeenCalled();
  });

  it('rejects unassign in immutable academic periods', async () => {
    const prisma = makePrisma({ periodEstado: 'FINALIZADO' });
    const caller = makeCaller(prisma);

    await expect(caller.unassign({ id: 'acl-1' })).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    expect(prisma.asignacionCargaLectiva.delete).not.toHaveBeenCalled();
  });
});
