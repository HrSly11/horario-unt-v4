import { describe, expect, it, vi } from 'vitest';
import { createCallerFactory } from '../init';
import { docenteRouter } from './docente';

vi.mock('@/lib/prisma', () => ({ prisma: {} }));
vi.mock('@/lib/auth', () => ({ getSession: vi.fn() }));

type SessionRole =
  | 'ADMIN'
  | 'DOCENTE'
  | 'ESTUDIANTE'
  | 'INVITADO'
  | 'SECRETARIA_ACADEMICA'
  | 'DIRECTOR_ESCUELA'
  | 'DIRECTOR_DEPARTAMENTO'
  | 'SECRETARIA_DEPARTAMENTO'
  | 'DECANO';

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
  const createCaller = createCallerFactory(docenteRouter);

  return createCaller(async () => ({
    prisma: prisma as any,
    headers: new Headers(),
    session,
  }));
}

function makePrisma({
  session = makeSession('ADMIN'),
  managedDepartamentoId = 'dept-1',
  periodEstado = 'POSTULACION',
}: {
  session?: ReturnType<typeof makeSession>;
  managedDepartamentoId?: string | null;
  periodEstado?: string;
} = {}) {
  const disponibilidadDocente = {
    findMany: vi.fn(async () => []),
    deleteMany: vi.fn(async () => ({ count: 0 })),
    createMany: vi.fn(async () => ({ count: 0 })),
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
    docente: {
      findMany: vi.fn(async (...args: any[]) => [] as any[]),
      findUniqueOrThrow: vi.fn(async () => ({
        id: session.docenteId ?? 'docente-1',
        tipo: 'NOMBRADO',
        docenteGrupos: [
          {
            grupo: {
              curso: {
                horasTeoria: 20,
                horasLaboratorio: 0,
              },
            },
          },
        ],
      })),
    },
    periodoAcademico: {
      findFirst: vi.fn(async () => ({ id: 'period-active', estado: periodEstado })),
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => ({ id: where.id, estado: periodEstado })),
    },
    disponibilidadDocente,
    asignacionCargaLectiva: {
      findMany: vi.fn(async () => [] as any[]),
    },
    asignacion: {
      findMany: vi.fn(async () => []),
    },
    $transaction: vi.fn(async (callback) => callback({ disponibilidadDocente })),
  };
}

describe('docenteRouter list scoping', () => {
  it('returns only the current docente and uses a safe explicit select for docente users', async () => {
    const session = makeSession('DOCENTE', 'docente-1');
    const prisma = makePrisma({ session });
    const caller = makeCaller(prisma, session);

    await caller.list({ search: 'Ada' });

    const call = prisma.docente.findMany.mock.calls[0]?.[0];
    expect(call).toEqual(
      expect.objectContaining({
        where: expect.objectContaining({
          AND: expect.arrayContaining([
            { id: 'docente-1' },
            {
              OR: [
                { nombre: { contains: 'Ada', mode: 'insensitive' } },
                { email: { contains: 'Ada', mode: 'insensitive' } },
              ],
            },
          ]),
        }),
      })
    );
    expect(call?.select).toEqual(
      expect.objectContaining({
        id: true,
        nombre: true,
        email: true,
        categoria: true,
        tipo: true,
      })
    );
    expect(call?.select).not.toHaveProperty('dni');
    expect(call?.select).not.toHaveProperty('codigoIBM');
    expect(call?.select).not.toHaveProperty('horasContrato');
  });

  it('scopes department secretary lists to the managed department', async () => {
    const session = makeSession('SECRETARIA_DEPARTAMENTO');
    const prisma = makePrisma({ session, managedDepartamentoId: 'dept-managed' });
    const caller = makeCaller(prisma, session);

    await caller.list({});

    expect(prisma.departamento.findUnique).toHaveBeenCalledWith({
      where: { secretariaId: session.id },
      select: { id: true },
    });
    expect(prisma.docente.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          AND: expect.arrayContaining([{ departamentoId: { in: ['dept-managed'] } }]),
        }),
      })
    );
  });

  it('allows institutional manager roles to query without a department filter', async () => {
    const session = makeSession('SECRETARIA_ACADEMICA');
    const prisma = makePrisma({ session });
    const caller = makeCaller(prisma, session);

    await caller.list({});

    expect(prisma.departamento.findUnique).not.toHaveBeenCalled();
    expect(prisma.docente.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: undefined,
      })
    );
  });

  it('forbids student and guest roles from reading docente lists', async () => {
    const session = makeSession('INVITADO');
    const prisma = makePrisma({ session });
    const caller = makeCaller(prisma, session);

    await expect(caller.list({})).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(prisma.docente.findMany).not.toHaveBeenCalled();
  });
});

describe('docenteRouter personalStats', () => {
  it('calculates workload from formal carga lectiva assignments instead of DocenteGrupo approximations', async () => {
    const session = makeSession('DOCENTE', 'docente-1');
    const prisma = makePrisma({ session });
    prisma.asignacionCargaLectiva.findMany.mockResolvedValueOnce([
      { id: 'acl-1', grupoId: 'grupo-1', horasAsignadas: 3, grupo: { curso: { codigo: 'IS-101', nombre: 'Programming' } } },
      { id: 'acl-2', grupoId: 'grupo-2', horasAsignadas: 2, grupo: { curso: { codigo: 'IS-102', nombre: 'Databases' } } },
    ]);
    const caller = makeCaller(prisma, session);

    const result = await caller.personalStats();

    expect(result.workload).toBe(5);
    expect(result.coursesCount).toBe(2);
    expect(prisma.asignacionCargaLectiva.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          docenteId: 'docente-1',
          periodoId: 'period-active',
        },
      })
    );
  });

  it('returns zero workload when the active period has no formal carga lectiva assignments', async () => {
    const session = makeSession('DOCENTE', 'docente-1');
    const prisma = makePrisma({ session });
    const caller = makeCaller(prisma, session);

    const result = await caller.personalStats();

    expect(result.workload).toBe(0);
    expect(result.coursesCount).toBe(0);
    expect(result.asignacionesCarga).toEqual([]);
  });
});

describe('docenteRouter availability', () => {
  it('reads availability from the active academic period only', async () => {
    const session = makeSession('DOCENTE', 'docente-1');
    const prisma = makePrisma({ session });
    const caller = makeCaller(prisma, session);

    await caller.getDisponibilidad();

    expect(prisma.periodoAcademico.findFirst).toHaveBeenCalledWith({
      where: { activo: true },
      select: { id: true, estado: true },
      orderBy: { createdAt: 'desc' },
    });
    expect(prisma.disponibilidadDocente.findMany).toHaveBeenCalledWith({
      where: { docenteId: 'docente-1', periodoId: 'period-active' },
      include: { franjaHoraria: true },
    });
  });

  it('saves availability scoped to the active period during postulation', async () => {
    const session = makeSession('DOCENTE', 'docente-1');
    const prisma = makePrisma({ session, periodEstado: 'POSTULACION' });
    const caller = makeCaller(prisma, session);

    await caller.saveAvailability({ franjaIds: ['franja-1', 'franja-1', 'franja-2'] });

    expect(prisma.disponibilidadDocente.deleteMany).toHaveBeenCalledWith({
      where: { docenteId: 'docente-1', periodoId: 'period-active' },
    });
    expect(prisma.disponibilidadDocente.createMany).toHaveBeenCalledWith({
      data: [
        { docenteId: 'docente-1', periodoId: 'period-active', franjaHorariaId: 'franja-1' },
        { docenteId: 'docente-1', periodoId: 'period-active', franjaHorariaId: 'franja-2' },
      ],
      skipDuplicates: true,
    });
  });

  it('blocks availability changes after the postulation phase', async () => {
    const session = makeSession('DOCENTE', 'docente-1');
    const prisma = makePrisma({ session, periodEstado: 'ASIGNACION' });
    const caller = makeCaller(prisma, session);

    await expect(caller.saveAvailability({ franjaIds: ['franja-1'] })).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    });
    expect(prisma.disponibilidadDocente.deleteMany).not.toHaveBeenCalled();
    expect(prisma.disponibilidadDocente.createMany).not.toHaveBeenCalled();
  });
});
