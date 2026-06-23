import { describe, expect, it, vi } from 'vitest';
import { createCallerFactory } from '../init';
import { cursoRouter } from './curso';

vi.mock('@/lib/prisma', () => ({ prisma: {} }));
vi.mock('@/lib/auth', () => ({ getSession: vi.fn() }));

function makeCaller(prisma: any) {
  const transaction = vi.fn(async (operation: (tx: any) => unknown) => operation(prisma));
  prisma.$transaction = transaction;
  prisma.user.findUnique = vi.fn().mockResolvedValue({
    id: 'school-secretary-1', email: 'secretary@example.edu', nombre: 'Secretary',
    role: 'SECRETARIA_ACADEMICA', docenteId: null, activo: true,
  });
  const createCaller = createCallerFactory(cursoRouter);
  const caller = createCaller(async () => ({
    prisma,
    headers: new Headers(),
    session: {
      id: 'school-secretary-1', email: 'secretary@example.edu', nombre: 'Secretary', role: 'SECRETARIA_ACADEMICA',
    },
  }));
  return { caller, transaction };
}

describe('cursoRouter.startProcess reconciliation boundary', () => {
  it('blocks activation when unresolved blocking reconciliation rows exist', async () => {
    const prisma = {
      user: { findUnique: vi.fn().mockResolvedValue({ id: 'school-secretary-1', activo: true }) },
      periodoAcademico: {
        findFirst: vi.fn().mockResolvedValue({ id: 'period-1' }),
        update: vi.fn(),
      },
      migracionReconciliacion: {
        findMany: vi.fn().mockResolvedValue([
          { codigo: 'HORAS_NO_RECONCILIADAS', blocking: true, resueltaEn: null },
        ]),
      },
    };

    await expect(makeCaller(prisma).caller.startProcess()).rejects.toThrow('HORAS_NO_RECONCILIADAS');
    expect(prisma.periodoAcademico.update).not.toHaveBeenCalled();
  });

  it('activates transactionally when all reconciliation blockers are resolved', async () => {
    const prisma = {
      user: { findUnique: vi.fn().mockResolvedValue({ id: 'school-secretary-1', activo: true }) },
      periodoAcademico: {
        findFirst: vi.fn().mockResolvedValue({ id: 'period-1' }),
        update: vi.fn().mockResolvedValue({ id: 'period-1', estado: 'POSTULACION' }),
      },
      migracionReconciliacion: { findMany: vi.fn().mockResolvedValue([]) },
    };

    const { caller, transaction } = makeCaller(prisma);
    await expect(caller.startProcess()).resolves.toEqual({ id: 'period-1', estado: 'POSTULACION' });
    expect(transaction).toHaveBeenCalledOnce();
    expect(prisma.migracionReconciliacion.findMany).toHaveBeenCalledWith({
      where: { blocking: true, resueltaEn: null },
      select: { codigo: true, blocking: true, resueltaEn: true },
    });
  });
});

function makeCustomCaller(prisma: any, sessionData: { id: string; role: any; email?: string; nombre?: string }) {
  const transaction = vi.fn(async (operation: (tx: any) => unknown) => operation(prisma));
  prisma.$transaction = transaction;
  prisma.user.findUnique = vi.fn().mockResolvedValue({
    id: sessionData.id,
    email: sessionData.email || 'user@example.edu',
    nombre: sessionData.nombre || 'Test User',
    role: sessionData.role,
    docenteId: null,
    activo: true,
  });
  const createCaller = createCallerFactory(cursoRouter);
  const caller = createCaller(async () => ({
    prisma,
    headers: new Headers(),
    session: {
      id: sessionData.id,
      email: sessionData.email || 'user@example.edu',
      nombre: sessionData.nombre || 'Test User',
      role: sessionData.role,
    },
  }));
  return { caller, transaction };
}

describe('cursoRouter demand procedures', () => {
  it('allows getting the demand and available courses for a school and period', async () => {
    const mockDemand = { id: 'demand-1', escuelaId: 'esc-1', periodoId: 'period-1', estado: 'BORRADOR', lineas: [] };
    const mockCurricula = [
      {
        id: 'curr-1',
        codigo: '2020-EPIS',
        cursos: [
          {
            ciclo: 5,
            desasociadaEn: null,
            curso: { id: 'curso-1', codigo: 'INF-501', nombre: 'Soft Eng', horasTeoria: 2, horasPractica: 2, horasLaboratorio: 2, departamentoId: 'dept-1' }
          }
        ]
      }
    ];

    const prisma = {
      user: { findUnique: vi.fn().mockResolvedValue({ id: 'secretary-1', activo: true }) },
      escuela: { findUnique: vi.fn().mockResolvedValue({ id: 'esc-1', secretariaId: 'secretary-1' }) },
      demandaAcademica: {
        findUnique: vi.fn().mockResolvedValue(mockDemand)
      },
      curricula: {
        findMany: vi.fn().mockResolvedValue(mockCurricula)
      },
      curso: {
        findMany: vi.fn().mockResolvedValue([])
      }
    };

    const { caller } = makeCustomCaller(prisma, { id: 'secretary-1', role: 'SECRETARIA_ACADEMICA' });
    const result = await caller.getDemanda({ escuelaId: 'esc-1', periodoId: 'period-1' });

    expect(result.demanda).toEqual(mockDemand);
    expect(result.availableCourses).toHaveLength(1);
    expect(result.availableCourses[0]).toEqual({
      curso: mockCurricula[0].cursos[0].curso,
      curriculaId: 'curr-1',
      curriculaCodigo: '2020-EPIS',
      ciclo: 5
    });
  });

  it('consolidates duplicates, snapshots hours, checks department, and saves demand', async () => {
    const mockCourse = { id: 'curso-1', codigo: 'INF-501', nombre: 'Soft Eng', horasTeoria: 2, horasPractica: 2, horasLaboratorio: 2, departamentoId: 'dept-1' };
    const prisma = {
      user: { findUnique: vi.fn().mockResolvedValue({ id: 'secretary-1', activo: true }) },
      escuela: { findUnique: vi.fn().mockResolvedValue({ id: 'esc-1', secretariaId: 'secretary-1' }) },
      demandaAcademica: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({ id: 'demand-new', escuelaId: 'esc-1', periodoId: 'period-1', estado: 'BORRADOR', version: 1 })
      },
      curso: {
        findUniqueOrThrow: vi.fn().mockResolvedValue(mockCourse)
      },
      demandaLinea: {
        deleteMany: vi.fn(),
        create: vi.fn().mockResolvedValue({ id: 'line-1' })
      },
      demandaLineaCurricula: {
        create: vi.fn()
      },
      log: {
        create: vi.fn()
      }
    };

    const { caller } = makeCustomCaller(prisma, { id: 'secretary-1', role: 'SECRETARIA_ACADEMICA' });
    
    const input = {
      escuelaId: 'esc-1',
      periodoId: 'period-1',
      lineas: [
        {
          cursoId: 'curso-1',
          numGruposLaboratorio: 2,
          motivoAperturaExcepcional: 'Requerido',
          curriculas: [
            { curriculaId: 'curr-1', ciclo: 5 },
            { curriculaId: 'curr-2', ciclo: 5 } // Consolidated provenance
          ]
        }
      ]
    };

    const result = await caller.saveDemanda(input);
    expect(result.id).toBe('demand-new');
    expect(prisma.demandaLinea.create).toHaveBeenCalledWith({
      data: {
        demandaId: 'demand-new',
        cursoId: 'curso-1',
        departamentoId: 'dept-1',
        horasTeoria: 2,
        horasPractica: 2,
        horasLaboratorio: 2,
        numGruposLaboratorio: 2,
        motivoAperturaExcepcional: 'Requerido'
      }
    });
    expect(prisma.demandaLineaCurricula.create).toHaveBeenCalledTimes(2);
    expect(prisma.log.create).toHaveBeenCalled();
  });

  it('blocks saving demand if course has no department assigned', async () => {
    const mockCourse = { id: 'curso-1', codigo: 'INF-501', nombre: 'Soft Eng', horasTeoria: 2, horasPractica: 2, horasLaboratorio: 2, departamentoId: null };
    const prisma = {
      user: { findUnique: vi.fn().mockResolvedValue({ id: 'secretary-1', activo: true }) },
      escuela: { findUnique: vi.fn().mockResolvedValue({ id: 'esc-1', secretariaId: 'secretary-1' }) },
      demandaAcademica: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({ id: 'demand-new', escuelaId: 'esc-1', periodoId: 'period-1', estado: 'BORRADOR', version: 1 })
      },
      curso: {
        findUniqueOrThrow: vi.fn().mockResolvedValue(mockCourse)
      }
    };

    const { caller } = makeCustomCaller(prisma, { id: 'secretary-1', role: 'SECRETARIA_ACADEMICA' });
    
    await expect(caller.saveDemanda({
      escuelaId: 'esc-1',
      periodoId: 'period-1',
      lineas: [{ cursoId: 'curso-1', numGruposLaboratorio: 1, curriculas: [{ curriculaId: 'curr-1', ciclo: 3 }] }]
    })).rejects.toThrow('no tiene un departamento asignado');
  });

  it('submits demand, writes log, and notifies director', async () => {
    const mockDemand = { id: 'demand-1', escuelaId: 'esc-1', periodoId: 'period-1', estado: 'BORRADOR', escuela: { id: 'esc-1', secretariaId: 'secretary-1', directorId: 'director-1' } };
    const prisma = {
      user: { findUnique: vi.fn().mockResolvedValue({ id: 'secretary-1', activo: true }) },
      escuela: { findUnique: vi.fn().mockResolvedValue({ id: 'esc-1', secretariaId: 'secretary-1' }) },
      demandaAcademica: {
        findUniqueOrThrow: vi.fn().mockResolvedValue(mockDemand),
        update: vi.fn().mockResolvedValue({ ...mockDemand, estado: 'ENVIADA' })
      },
      log: { create: vi.fn() },
      notification: { create: vi.fn() }
    };

    const { caller } = makeCustomCaller(prisma, { id: 'secretary-1', role: 'SECRETARIA_ACADEMICA' });
    const result = await caller.submitDemanda({ id: 'demand-1' });

    expect(result.estado).toBe('ENVIADA');
    expect(prisma.log.create).toHaveBeenCalled();
    expect(prisma.notification.create).toHaveBeenCalledWith({
      data: {
        recipientUserId: 'director-1',
        titulo: 'Demanda Académica Enviada',
        mensaje: expect.any(String),
        tipo: 'DEMANDA_ENVIADA'
      }
    });
  });

  it('reviews demand with approval, transitions, logs, and notifies secretary and dept heads', async () => {
    const mockDemand = { id: 'demand-1', escuelaId: 'esc-1', periodoId: 'period-1', estado: 'ENVIADA', escuela: { id: 'esc-1', directorId: 'director-1', secretariaId: 'secretary-1', nombre: 'Sistemas' } };
    const prisma = {
      user: { findUnique: vi.fn().mockResolvedValue({ id: 'director-1', activo: true }) },
      escuela: { findUnique: vi.fn().mockResolvedValue({ id: 'esc-1', directorId: 'director-1' }) },
      demandaAcademica: {
        findUniqueOrThrow: vi.fn().mockResolvedValue(mockDemand),
        update: vi.fn().mockResolvedValue({ ...mockDemand, estado: 'APROBADA' })
      },
      demandaLinea: {
        findMany: vi.fn().mockResolvedValue([
          { id: 'line-1', departamento: { id: 'dept-1', directorId: 'dept-head-1' } }
        ])
      },
      log: { create: vi.fn() },
      notification: { create: vi.fn() }
    };

    const { caller } = makeCustomCaller(prisma, { id: 'director-1', role: 'DIRECTOR_ESCUELA' });
    const result = await caller.reviewDemanda({ id: 'demand-1', estado: 'APROBADA' });

    expect(result.estado).toBe('APROBADA');
    expect(prisma.log.create).toHaveBeenCalled();
    expect(prisma.notification.create).toHaveBeenCalledWith({
      data: {
        recipientUserId: 'secretary-1',
        titulo: 'Demanda Académica Aprobada',
        mensaje: expect.any(String),
        tipo: 'DEMANDA_APROBADA'
      }
    });
    expect(prisma.notification.create).toHaveBeenCalledWith({
      data: {
        recipientUserId: 'dept-head-1',
        titulo: 'Demanda Aprobada Asignada',
        mensaje: expect.any(String),
        tipo: 'DEMANDA_APROBADA_DEPARTAMENTO'
      }
    });
  });

  it('requires remarks for observations/rejections in demand review', async () => {
    const mockDemand = { id: 'demand-1', escuelaId: 'esc-1', periodoId: 'period-1', estado: 'ENVIADA', escuela: { id: 'esc-1', directorId: 'director-1' } };
    const prisma = {
      user: { findUnique: vi.fn().mockResolvedValue({ id: 'director-1', activo: true }) },
      escuela: { findUnique: vi.fn().mockResolvedValue({ id: 'esc-1', directorId: 'director-1' }) },
      demandaAcademica: {
        findUniqueOrThrow: vi.fn().mockResolvedValue(mockDemand)
      }
    };

    const { caller } = makeCustomCaller(prisma, { id: 'director-1', role: 'DIRECTOR_ESCUELA' });

    await expect(caller.reviewDemanda({ id: 'demand-1', estado: 'OBSERVADA', observacion: '' }))
      .rejects.toThrow('Debe especificar una observación');
    await expect(caller.reviewDemanda({ id: 'demand-1', estado: 'RECHAZADA' }))
      .rejects.toThrow('Debe especificar una observación');
  });
});

