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
    $transaction: vi.fn(),
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
      findUniqueOrThrow: vi.fn(async () => ({
        periodoAcademicoId: groupPeriodId,
        curso: {
          horasTeoria: 6,
          horasPractica: 4,
          horasLaboratorio: 4,
          numGruposLaboratorio: 2,
        },
      })),
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
      deleteMany: vi.fn(async () => ({ count: 0 })),
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
      include: {
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

  describe('assignCursoCompleto', () => {
    it('successfully updates all load assignments in a transaction', async () => {
      const mockTx = {
        asignacionCargaLectiva: {
          deleteMany: vi.fn(),
          create: vi.fn(),
        },
      };
      const prisma = makePrisma();
      prisma.$transaction = vi.fn(async (cb: any) => cb(mockTx));

      const caller = makeCaller(prisma);

      await caller.assignCursoCompleto({
        docenteId: 'docente-1',
        grupoId: 'grupo-1',
        periodoId: 'period-1',
        teoria: { horas: 4, compartido: true, docenteCompartidoId: 'docente-2', horasCompartido: 2 },
        practica: { horas: 2, compartido: false },
        laboratorio: { horas: 2, compartido: true, docenteCompartidoId: 'docente-3', horasCompartido: 2, gruposLaboratorio: [1], gruposLaboratorioCompartido: [2] },
      });

      expect(mockTx.asignacionCargaLectiva.deleteMany).toHaveBeenCalledWith({
        where: { grupoId: 'grupo-1', periodoId: 'period-1' },
      });
      expect(mockTx.asignacionCargaLectiva.create).toHaveBeenCalledTimes(5); // Theory (prim + comp), Practice, Lab (prim + comp)
    });

    it('rejects if theory hours exceed course limit', async () => {
      const prisma = makePrisma();
      const caller = makeCaller(prisma);

      await expect(
        caller.assignCursoCompleto({
          docenteId: 'docente-1',
          grupoId: 'grupo-1',
          periodoId: 'period-1',
          teoria: { horas: 8, compartido: false }, // Limit is 6
          practica: { horas: 0, compartido: false },
          laboratorio: { horas: 0, compartido: false },
        })
      ).rejects.toMatchObject({ code: 'BAD_REQUEST', message: /TEORIA/ });
    });

    it('rejects if not all laboratory groups are selected', async () => {
      const prisma = makePrisma();
      const caller = makeCaller(prisma);

      await expect(
        caller.assignCursoCompleto({
          docenteId: 'docente-1',
          grupoId: 'grupo-1',
          periodoId: 'period-1',
          teoria: { horas: 0, compartido: false },
          practica: { horas: 0, compartido: false },
          laboratorio: {
            horas: 2,
            compartido: false,
            gruposLaboratorio: [1]
          },
        })
      ).rejects.toMatchObject({
        code: 'BAD_REQUEST',
        message: /Debe asignar todos los grupos de laboratorio/
      });
    });
  });

  describe('Lecture Hours (LECTIVAS) Calculation Formula', () => {
    const calculateLectivas = (
      horasTeoria: number,
      horasPractica: number,
      horasLaboratorio: number,
      numGruposLaboratorio: number
    ) => {
      return horasTeoria + horasPractica + numGruposLaboratorio * horasLaboratorio;
    };

    it('calculates correctly with theory=4, practice=2, lab=2 hours, and lab groups=3 (spec case)', () => {
      const result = calculateLectivas(4, 2, 2, 3);
      expect(result).toBe(12);
    });

    it('calculates correctly with default 1 lab group', () => {
      const result = calculateLectivas(2, 2, 2, 1);
      expect(result).toBe(6);
    });

    it('calculates correctly with 0 lab hours regardless of lab groups count', () => {
      const result = calculateLectivas(3, 1, 0, 5);
      expect(result).toBe(4);
    });
  });
});
