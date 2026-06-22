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
