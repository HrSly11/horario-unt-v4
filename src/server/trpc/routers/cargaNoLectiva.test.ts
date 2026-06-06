import { describe, expect, it, vi } from 'vitest';
import { createCallerFactory } from '../init';
import { cargaNoLectivaRouter } from './cargaNoLectiva';

vi.mock('@/lib/prisma', () => ({ prisma: {} }));
vi.mock('@/lib/auth', () => ({ getSession: vi.fn() }));

type SessionRole =
  | 'ADMIN'
  | 'DOCENTE'
  | 'INVITADO'
  | 'SECRETARIA_ACADEMICA'
  | 'DIRECTOR_DEPARTAMENTO'
  | 'SECRETARIA_DEPARTAMENTO';

function makeSession(role: SessionRole, docenteId?: string) {
  return {
    id: `${role.toLowerCase()}-user`,
    email: `${role.toLowerCase()}@example.edu`,
    nombre: role,
    role,
    docenteId,
  };
}

function makeCaller(prisma: ReturnType<typeof makePrisma>, session: ReturnType<typeof makeSession>) {
  const createCaller = createCallerFactory(cargaNoLectivaRouter);

  return createCaller(async () => ({
    prisma: prisma as any,
    headers: new Headers(),
    session,
  }));
}

function makePrisma({
  session = makeSession('ADMIN'),
  managedDepartamentoId = 'dept-1',
  periodEstado = 'ASIGNACION',
  lectiveAssignments = [],
  nonLectiveLoads = [],
}: {
  session?: ReturnType<typeof makeSession>;
  managedDepartamentoId?: string | null;
  periodEstado?: string;
  lectiveAssignments?: Array<{
    franjaHoraria: { dia: string; horaInicio: string; horaFin: string };
  }>;
  nonLectiveLoads?: Array<{
    id: string;
    horarios: Array<{ dia: string; horaInicio: string; horaFin: string }>;
  }>;
} = {}) {
  const transactionClient = {
    horarioCargaNoLectiva: {
      deleteMany: vi.fn(async () => ({ count: 0 })),
      createMany: vi.fn(async () => ({ count: 0 })),
    },
    cargaNoLectiva: {
      update: vi.fn(async (args) => args),
    },
  };

  return {
    user: {
      findUnique: vi.fn(async () => ({
        ...session,
        docenteId: session.docenteId ?? null,
        activo: true,
      })),
    },
    departamento: {
      findUnique: vi.fn(async () => (managedDepartamentoId ? { id: managedDepartamentoId } : null)),
    },
    periodoAcademico: {
      findUniqueOrThrow: vi.fn(async () => ({ id: 'period-1', estado: periodEstado })),
    },
    asignacion: {
      findMany: vi.fn(async () => lectiveAssignments),
    },
    asignacionCargaLectiva: {
      findMany: vi.fn(async () => []),
    },
    cargaNoLectiva: {
      findMany: vi.fn(async () => nonLectiveLoads),
      findUniqueOrThrow: vi.fn(async () => ({
        id: 'carga-1',
        docenteId: 'docente-1',
        periodoId: 'period-1',
        tipo: 'INVESTIGACION',
        horas: 2,
      })),
      create: vi.fn(async (args) => args),
      update: vi.fn(async (args) => args),
      delete: vi.fn(async (args) => args),
    },
    horarioCargaNoLectiva: {
      deleteMany: vi.fn(async () => ({ count: 0 })),
      createMany: vi.fn(async () => ({ count: 0 })),
    },
    $transaction: vi.fn(async (callback) => callback(transactionClient)),
  };
}

describe('cargaNoLectivaRouter schedule integrity', () => {
  it('rejects non-lective schedules that overlap existing lective assignments', async () => {
    const session = makeSession('DOCENTE', 'docente-1');
    const prisma = makePrisma({
      session,
      lectiveAssignments: [
        { franjaHoraria: { dia: 'LUNES', horaInicio: '08:00', horaFin: '10:00' } },
      ],
    });
    const caller = makeCaller(prisma, session);

    await expect(
      caller.create({
        docenteId: 'docente-1',
        periodoId: 'period-1',
        tipo: 'INVESTIGACION',
        horas: 2,
        horarios: [{ dia: 'LUNES', horaInicio: '09:00', horaFin: '11:00' }],
      })
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    expect(prisma.cargaNoLectiva.create).not.toHaveBeenCalled();
  });

  it('rejects non-lective schedules that push a docente above the daily workload limit', async () => {
    const session = makeSession('DOCENTE', 'docente-1');
    const prisma = makePrisma({
      session,
      nonLectiveLoads: [
        {
          id: 'existing-load',
          horarios: [{ dia: 'MARTES', horaInicio: '08:00', horaFin: '15:00' }],
        },
      ],
    });
    const caller = makeCaller(prisma, session);

    await expect(
      caller.create({
        docenteId: 'docente-1',
        periodoId: 'period-1',
        tipo: 'INVESTIGACION',
        horas: 2,
        horarios: [{ dia: 'MARTES', horaInicio: '15:00', horaFin: '17:00' }],
      })
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    expect(prisma.cargaNoLectiva.create).not.toHaveBeenCalled();
  });

  it('rejects non-lective create operations in immutable academic periods', async () => {
    const session = makeSession('DOCENTE', 'docente-1');
    const prisma = makePrisma({ session, periodEstado: 'FINALIZADO' });
    const caller = makeCaller(prisma, session);

    await expect(
      caller.create({
        docenteId: 'docente-1',
        periodoId: 'period-1',
        tipo: 'INVESTIGACION',
        horas: 2,
      })
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    expect(prisma.cargaNoLectiva.create).not.toHaveBeenCalled();
  });

  it('rejects non-lective update operations in immutable academic periods', async () => {
    const session = makeSession('DOCENTE', 'docente-1');
    const prisma = makePrisma({ session, periodEstado: 'APROBADO' });
    const caller = makeCaller(prisma, session);

    await expect(caller.update({ id: 'carga-1', horas: 3 })).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    });
  });
});

describe('cargaNoLectivaRouter list scoping', () => {
  it('forbids docente users from listing another docente non-teaching load', async () => {
    const session = makeSession('DOCENTE', 'docente-1');
    const prisma = makePrisma({ session });
    const caller = makeCaller(prisma, session);

    await expect(caller.list({ docenteId: 'docente-2', periodoId: 'period-1' })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
    expect(prisma.cargaNoLectiva.findMany).not.toHaveBeenCalled();
  });

  it('forces docente users to their own non-teaching load when no docenteId is supplied', async () => {
    const session = makeSession('DOCENTE', 'docente-1');
    const prisma = makePrisma({ session });
    const caller = makeCaller(prisma, session);

    await caller.list({ periodoId: 'period-1' });

    expect(prisma.cargaNoLectiva.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          docenteId: 'docente-1',
          periodoId: 'period-1',
        },
      })
    );
  });

  it('scopes department roles to docentes in their managed departments', async () => {
    const session = makeSession('SECRETARIA_DEPARTAMENTO');
    const prisma = makePrisma({ session, managedDepartamentoId: 'dept-managed' });
    const caller = makeCaller(prisma, session);

    await caller.list({ periodoId: 'period-1' });

    expect(prisma.cargaNoLectiva.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          periodoId: 'period-1',
          docente: { departamentoId: { in: ['dept-managed'] } },
        },
      })
    );
  });

  it('allows institutional managers to use explicit filters without adding department scope', async () => {
    const session = makeSession('SECRETARIA_ACADEMICA');
    const prisma = makePrisma({ session });
    const caller = makeCaller(prisma, session);

    await caller.list({ docenteId: 'docente-7', periodoId: 'period-1' });

    expect(prisma.departamento.findUnique).not.toHaveBeenCalled();
    expect(prisma.cargaNoLectiva.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          docenteId: 'docente-7',
          periodoId: 'period-1',
        },
      })
    );
  });

  it('forbids guest roles from listing non-teaching load', async () => {
    const session = makeSession('INVITADO');
    const prisma = makePrisma({ session });
    const caller = makeCaller(prisma, session);

    await expect(caller.list({ periodoId: 'period-1' })).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(prisma.cargaNoLectiva.findMany).not.toHaveBeenCalled();
  });
});
