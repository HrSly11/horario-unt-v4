import { describe, expect, it, vi } from 'vitest';
import { createCallerFactory } from '../init';
import { docenteRouter } from './docente';

vi.mock('@/lib/prisma', () => ({ prisma: {} }));
vi.mock('@/lib/auth', () => ({ getSession: vi.fn() }));

function makeCaller(prisma: any, role: 'ADMIN' | 'SECRETARIA_DEPARTAMENTO' | 'SECRETARIA_ACADEMICA', userId = 'user-1') {
  prisma.user = {
    findUnique: vi.fn().mockResolvedValue({ id: userId, activo: true, role, email: 'u@e.edu', nombre: 'U' }),
  };
  const createCaller = createCallerFactory(docenteRouter);
  return createCaller(async () => ({
    prisma,
    headers: new Headers(),
    session: { id: userId, email: 'u@e.edu', nombre: 'U', role },
  }));
}

const baseInput = {
  nombre: 'Docente Prueba',
  email: 'prueba@unt.edu.pe',
  categoria: 'AUXILIAR' as const,
  tipo: 'CONTRATADO' as const,
  antiguedad: new Date('2024-01-01'),
  activo: true,
  experienciaAnios: 0,
};

describe('docenteRouter.create con departamentoId', () => {
  it('asigna departamentoId explícito cuando el usuario lo provee (ADMIN)', async () => {
    const created: any = { id: 'doc-1' };
    const prisma: any = {
      docente: { create: vi.fn(async ({ data }: any) => ({ ...created, ...data })) },
    };
    const caller = makeCaller(prisma, 'ADMIN');

    const result = await caller.create({ ...baseInput, departamentoId: 'dept-1' });

    expect(prisma.docente.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ departamentoId: 'dept-1' }) })
    );
    expect(result.departamentoId).toBe('dept-1');
  });

  it('SECRETARIA_DEPARTAMENTO sin departamento gestionado lanza FORBIDDEN', async () => {
    const prisma: any = {
      departamento: { findUnique: vi.fn().mockResolvedValue(null) },
    };
    const caller = makeCaller(prisma, 'SECRETARIA_DEPARTAMENTO');

    await expect(caller.create({ ...baseInput })).rejects.toThrow(
      /No tiene un departamento asignado/
    );
  });

  it('SECRETARIA_DEPARTAMENTO asigna automáticamente su departamento gestionado', async () => {
    const prisma: any = {
      departamento: { findUnique: vi.fn().mockResolvedValue({ id: 'dept-1' }) },
      docente: { create: vi.fn(async ({ data }: any) => ({ id: 'doc-1', ...data })) },
    };
    const caller = makeCaller(prisma, 'SECRETARIA_DEPARTAMENTO');

    const result = await caller.create({ ...baseInput });

    expect(prisma.docente.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ departamentoId: 'dept-1' }) })
    );
    expect(result.departamentoId).toBe('dept-1');
  });

  it('SECRETARIA_DEPARTAMENTO no puede asignar un departamento fuera de su gestión', async () => {
    const prisma: any = {
      departamento: { findUnique: vi.fn().mockResolvedValue({ id: 'dept-1' }) },
    };
    const caller = makeCaller(prisma, 'SECRETARIA_DEPARTAMENTO');

    await expect(
      caller.create({ ...baseInput, departamentoId: 'dept-otro' })
    ).rejects.toThrow(/Solo puede crear docentes/);
  });
});
