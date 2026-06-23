import { describe, expect, it, vi } from 'vitest';
import { createCallerFactory } from '../init';
import { demandaDepartamentoRouter } from './demandaDepartamento';

vi.mock('@/lib/prisma', () => ({ prisma: {} }));
vi.mock('@/lib/auth', () => ({ getSession: vi.fn() }));

function makeCaller(prisma: any, sessionData: { id: string; role: any; email?: string; nombre?: string }) {
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
  const createCaller = createCallerFactory(demandaDepartamentoRouter);
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

describe('demandaDepartamentoRouter listApproved', () => {
  it('allows department director to view only approved demand lines for their department', async () => {
    const mockLines = [
      {
        id: 'line-1',
        cursoId: 'curso-1',
        departamentoId: 'dept-1',
        horasTeoria: 4,
        horasPractica: 2,
        horasLaboratorio: 0,
        demanda: { estado: 'APROBADA', escuela: { nombre: 'Escuela de Sistemas' } },
        curso: { codigo: 'INF-101', nombre: 'Intro a la Progra' },
        curriculas: [{ ciclo: 1, curricula: { codigo: '2020-EPIS' } }],
      },
    ];

    const prisma = {
      user: { findUnique: vi.fn().mockResolvedValue({ id: 'director-1', activo: true }) },
      departamento: {
        findUnique: vi.fn().mockResolvedValue({ id: 'dept-1', directorId: 'director-1' }),
      },
      demandaLinea: {
        findMany: vi.fn().mockResolvedValue(mockLines),
      },
    };

    const { caller } = makeCaller(prisma, { id: 'director-1', role: 'DIRECTOR_DEPARTAMENTO' });
    const result = await caller.listApproved({ periodoId: 'period-1' });

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('line-1');
    expect(prisma.demandaLinea.findMany).toHaveBeenCalledWith({
      where: {
        departamentoId: { in: ['dept-1'] },
        demanda: {
          periodoId: 'period-1',
          estado: 'APROBADA',
        },
      },
      include: {
        curso: {
          select: {
            id: true,
            codigo: true,
            nombre: true,
            creditos: true,
            horasTeoria: true,
            horasPractica: true,
            horasLaboratorio: true,
          },
        },
        demanda: {
          include: {
            escuela: {
              select: {
                id: true,
                nombre: true,
              },
            },
          },
        },
        curriculas: {
          include: {
            curricula: {
              select: {
                id: true,
                codigo: true,
              },
            },
          },
        },
      },
    });
  });

  it('allows department secretary to query lines for their department', async () => {
    const prisma = {
      user: { findUnique: vi.fn().mockResolvedValue({ id: 'secretary-1', activo: true }) },
      departamento: {
        findUnique: vi.fn().mockResolvedValue({ id: 'dept-1', secretariaId: 'secretary-1' }),
      },
      demandaLinea: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    };

    const { caller } = makeCaller(prisma, { id: 'secretary-1', role: 'SECRETARIA_DEPARTAMENTO' });
    const result = await caller.listApproved({ periodoId: 'period-1' });
    expect(result).toEqual([]);
    expect(prisma.demandaLinea.findMany).toHaveBeenCalledWith({
      where: {
        departamentoId: { in: ['dept-1'] },
        demanda: {
          periodoId: 'period-1',
          estado: 'APROBADA',
        },
      },
      include: expect.any(Object),
    });
  });

  it('allows admins to view all approved demand lines across departments without scoping', async () => {
    const prisma = {
      user: { findUnique: vi.fn().mockResolvedValue({ id: 'admin-1', activo: true }) },
      demandaLinea: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    };

    const { caller } = makeCaller(prisma, { id: 'admin-1', role: 'ADMIN' });
    const result = await caller.listApproved({ periodoId: 'period-1' });
    expect(result).toEqual([]);
    expect(prisma.demandaLinea.findMany).toHaveBeenCalledWith({
      where: {
        demanda: {
          periodoId: 'period-1',
          estado: 'APROBADA',
        },
      },
      include: expect.any(Object),
    });
  });

  it('denies access to unauthorized roles', async () => {
    const prisma = {
      user: { findUnique: vi.fn().mockResolvedValue({ id: 'teacher-1', activo: true }) },
    };

    const { caller } = makeCaller(prisma, { id: 'teacher-1', role: 'DOCENTE' });
    await expect(caller.listApproved({ periodoId: 'period-1' })).rejects.toThrow();
  });
});
