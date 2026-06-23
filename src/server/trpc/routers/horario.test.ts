import { describe, expect, it, vi } from 'vitest';
import { createCallerFactory } from '../init';
import { horarioRouter } from './horario';
import type { PrismaClient, UserRole } from '@/generated/prisma/client';

vi.mock('@/lib/prisma', () => ({ prisma: {} }));
vi.mock('@/lib/auth', () => ({ getSession: vi.fn() }));

function makeSession(role: UserRole = 'DIRECTOR_ESCUELA', id = 'director-1') {
  return {
    id,
    email: 'user@example.edu',
    nombre: 'User',
    role,
  };
}

function makeCaller(prisma: unknown, role?: UserRole, id?: string) {
  const createCaller = createCallerFactory(horarioRouter);
  return createCaller(async () => ({
    prisma: prisma as PrismaClient,
    headers: new Headers(),
    session: makeSession(role, id),
  }));
}

describe('horarioRouter preliminary scheduling and locks', () => {
  it('allows School Director to approve and publish preliminary schedule', async () => {
    const prisma = {
      user: {
        findUnique: vi.fn(async () => ({
          id: 'director-1',
          email: 'director@example.edu',
          nombre: 'Director',
          role: 'DIRECTOR_ESCUELA',
          activo: true,
        })),
      },
      procesoHorarioEscuela: {
        findUnique: vi.fn(async () => ({ id: 'proc-1', estado: 'APROBADO', escuelaId: 'esc-1' })),
        update: vi.fn(async (args: { data: Record<string, unknown> }) => ({ id: 'proc-1', ...args.data })),
        findUniqueOrThrow: vi.fn(async () => ({ id: 'proc-1', estado: 'APROBADO', escuelaId: 'esc-1' })),
      },
      escuela: {
        findUnique: vi.fn(async () => ({ id: 'esc-1', directorId: 'director-1' })),
      },
    };

    const caller = makeCaller(prisma, 'DIRECTOR_ESCUELA', 'director-1');
    const res = await caller.publishPreliminary({ escuelaId: 'esc-1', periodoId: 'period-1' });

    expect(res.estado).toBe('PUBLICADO_PRELIMINAR');
  });

  it('rejects schedule updates if preliminary schedule is already published', async () => {
    const prisma = {
      user: {
        findUnique: vi.fn(async () => ({
          id: 'secretary-1',
          email: 'sec@example.edu',
          nombre: 'Sec',
          role: 'SECRETARIA_ACADEMICA',
          activo: true,
        })),
      },
      procesoHorarioEscuela: {
        findFirst: vi.fn(async () => ({ id: 'proc-1', estado: 'PUBLICADO_PRELIMINAR' })),
      },
      grupo: {
        findUnique: vi.fn(async () => ({
          curso: {
            cursoCurriculas: [
              {
                curricula: { escuelaId: 'esc-1' },
              },
            ],
          },
        })),
      },
      availabilityService: {
        validateSlotSelection: vi.fn(async () => ({ valid: true, reasons: [] })),
      },
    };

    const caller = makeCaller(prisma, 'SECRETARIA_ACADEMICA', 'secretary-1');
    await expect(
      caller.create({
        docenteId: 'docente-1',
        aulaId: 'aula-1',
        grupoId: 'grupo-1',
        franjaHorariaId: 'franja-1',
        periodoId: 'period-1',
        tipo: 'TEORIA',
      })
    ).rejects.toMatchObject({
      code: 'BAD_REQUEST',
      message: /publicado|preliminar|bloqueado|lock/i,
    });
  });

  it('rejects Department Secretary from opening the school schedule programming workflow', async () => {
    const prisma = {
      user: {
        findUnique: vi.fn(async () => ({
          id: 'dept-secretary-1',
          email: 'dept-sec@example.edu',
          nombre: 'Dept Sec',
          role: 'SECRETARIA_DEPARTAMENTO',
          activo: true,
        })),
      },
      docente: {
        findMany: vi.fn(async () => []),
      },
    };

    const caller = makeCaller(prisma, 'SECRETARIA_DEPARTAMENTO', 'dept-secretary-1');

    await expect(
      caller.docentesByHierarchy({ periodoId: 'period-1' })
    ).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
    expect(prisma.docente.findMany).not.toHaveBeenCalled();
  });

  it('lists manual scheduling options from school-scoped teaching load with remaining blocks', async () => {
    const prisma = {
      user: {
        findUnique: vi.fn(async () => ({
          id: 'secretary-1',
          email: 'sec@example.edu',
          nombre: 'Sec',
          role: 'SECRETARIA_ACADEMICA',
          activo: true,
        })),
      },
      escuela: {
        findUnique: vi.fn(async () => ({ id: 'esc-1' })),
      },
      asignacionCargaLectiva: {
        findMany: vi.fn(async () => [
          {
            id: 'load-1',
            docenteId: 'docente-1',
            docenteCompartidoId: null,
            grupoId: 'grupo-1',
            periodoId: 'period-1',
            tipo: 'TEORIA',
            horasAsignadas: 2,
            grupoLaboratorio: null,
            rol: 'PRINCIPAL',
            docente: { id: 'docente-1', nombre: 'Ada Lovelace' },
            docenteCompartido: null,
            grupo: {
              id: 'grupo-1',
              nombre: 'A',
              curso: { id: 'curso-1', codigo: 'BD101', nombre: 'Base de Datos', ciclo: 5 },
              demandaLinea: {
                demanda: {
                  escuelaId: 'esc-1',
                  escuela: { id: 'esc-1', nombre: 'Ingeniería de Sistemas' },
                },
              },
            },
          },
        ]),
      },
      asignacion: {
        findMany: vi.fn(async () => [
          {
            grupoId: 'grupo-1',
            tipo: 'TEORIA',
          },
        ]),
      },
    };

    const caller = makeCaller(prisma, 'SECRETARIA_ACADEMICA', 'secretary-1');

    const options = await caller.manualOptions({ docenteId: 'docente-1', periodoId: 'period-1' });

    expect(options).toEqual([
      expect.objectContaining({
        cargaLectivaId: 'load-1',
        docenteId: 'docente-1',
        grupoId: 'grupo-1',
        tipo: 'TEORIA',
        horasAsignadas: 2,
        scheduledBlocks: 1,
        remainingBlocks: 1,
        curso: expect.objectContaining({
          codigo: 'BD101',
          nombre: 'Base de Datos',
        }),
        escuela: expect.objectContaining({
          id: 'esc-1',
          nombre: 'Ingeniería de Sistemas',
        }),
      }),
    ]);
    expect(prisma.asignacionCargaLectiva.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          periodoId: 'period-1',
          OR: [{ docenteId: 'docente-1' }, { docenteCompartidoId: 'docente-1' }],
        }),
      })
    );
  });
});
