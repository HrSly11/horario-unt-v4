import { describe, expect, it, vi } from 'vitest';
import { createCallerFactory } from '../init';
import { curriculaRouter } from './curricula';
import { UserRole } from '@/generated/prisma/client';

vi.mock('@/lib/prisma', () => ({ prisma: {} }));
vi.mock('@/lib/auth', () => ({ getSession: vi.fn() }));

function makeSession(role: UserRole = 'ADMIN') {
  return {
    id: 'test-user',
    email: 'test@example.edu',
    nombre: 'Test User',
    role,
  };
}

function makeCaller(prisma: any, role: UserRole = 'ADMIN') {
  const createCaller = createCallerFactory(curriculaRouter);

  if (prisma.user && prisma.user.findUnique) {
    prisma.user.findUnique = vi.fn().mockResolvedValue({ id: 'test-user', activo: true, role });
  }

  return createCaller(async () => ({
    prisma: prisma as any,
    headers: new Headers(),
    session: makeSession(role),
  }));
}

describe('curriculaRouter', () => {
  it('allows listing all curricula', async () => {
    const mockCurricula = [
      { id: 'curr-1', codigo: '2020-EPIS', escuelaId: 'esc-1', vigente: true, anio: 2020 },
    ];
    const prisma = {
      user: {
        findUnique: vi.fn().mockResolvedValue({ id: 'test-user', activo: true }),
      },
      curricula: {
        findMany: vi.fn().mockResolvedValue(mockCurricula),
      },
    };
    const caller = makeCaller(prisma);
    const result = await caller.list({});
    expect(result).toEqual(mockCurricula);
    expect(prisma.curricula.findMany).toHaveBeenCalled();
  });

  it('allows creating a curriculum for authorized roles', async () => {
    const newCurr = { codigo: '2025-EPIS', escuelaId: 'esc-1', vigente: true, anio: 2025 };
    const prisma = {
      user: {
        findUnique: vi.fn().mockResolvedValue({ id: 'test-user', activo: true }),
      },
      curricula: {
        create: vi.fn().mockResolvedValue({ id: 'curr-2', ...newCurr }),
      },
    };
    const caller = makeCaller(prisma, 'SECRETARIA_DEPARTAMENTO');
    const result = await caller.create(newCurr);
    expect(result.id).toBe('curr-2');
    expect(prisma.curricula.create).toHaveBeenCalledWith({ data: newCurr });
  });

  it('denies creating a curriculum for unauthorized roles', async () => {
    const newCurr = { codigo: '2025-EPIS', escuelaId: 'esc-1', vigente: true, anio: 2025 };
    const prisma = {
      user: {
        findUnique: vi.fn().mockResolvedValue({ id: 'test-user', activo: true }),
      },
    };
    const caller = makeCaller(prisma, 'DOCENTE');
    await expect(caller.create(newCurr)).rejects.toThrow();
  });

  it('allows updating a curriculum', async () => {
    const updateData = { id: 'curr-1', codigo: '2020-EPIS-REV', escuelaId: 'esc-1', vigente: false, anio: 2021 };
    const prisma = {
      user: {
        findUnique: vi.fn().mockResolvedValue({ id: 'test-user', activo: true }),
      },
      curricula: {
        update: vi.fn().mockResolvedValue(updateData),
      },
    };
    const caller = makeCaller(prisma, 'ADMIN');
    const result = await caller.update(updateData);
    expect(result.vigente).toBe(false);
    expect(prisma.curricula.update).toHaveBeenCalled();
  });

  it('allows linking a course to a curriculum', async () => {
    const linkData = { curriculaId: 'curr-1', cursoId: 'curso-1', ciclo: 5, esElectivo: false };
    const prisma = {
      user: {
        findUnique: vi.fn().mockResolvedValue({ id: 'test-user', activo: true }),
      },
      cursoCurricula: {
        create: vi.fn().mockResolvedValue({ id: 'cc-1', ...linkData }),
      },
    };
    const caller = makeCaller(prisma, 'ADMIN');
    const result = await caller.linkCourse(linkData);
    expect(result.id).toBe('cc-1');
    expect(prisma.cursoCurricula.create).toHaveBeenCalled();
  });

  it('allows unlinking a course from a curriculum', async () => {
    const unlinkData = { curriculaId: 'curr-1', cursoId: 'curso-1' };
    const prisma = {
      user: {
        findUnique: vi.fn().mockResolvedValue({ id: 'test-user', activo: true }),
      },
      cursoCurricula: {
        delete: vi.fn().mockResolvedValue({ id: 'cc-1' }),
      },
    };
    const caller = makeCaller(prisma, 'ADMIN');
    await caller.unlinkCourse(unlinkData);
    expect(prisma.cursoCurricula.delete).toHaveBeenCalled();
  });

  it('allows listing curricula with school and active status filters', async () => {
    const mockCurricula = [
      { id: 'curr-1', codigo: '2020-EPIS', escuelaId: 'esc-1', vigente: true, anio: 2020 },
    ];
    const prisma = {
      user: {
        findUnique: vi.fn().mockResolvedValue({ id: 'test-user', activo: true }),
      },
      curricula: {
        findMany: vi.fn().mockResolvedValue(mockCurricula),
      },
    };
    const caller = makeCaller(prisma);
    const result = await caller.list({ escuelaId: 'esc-1', vigente: true });
    expect(result).toEqual(mockCurricula);
    expect(prisma.curricula.findMany).toHaveBeenCalledWith({
      where: { escuelaId: 'esc-1', vigente: true },
      include: expect.any(Object),
      orderBy: { anio: 'desc' },
    });
  });

  it('allows deleting a curriculum', async () => {
    const prisma = {
      user: {
        findUnique: vi.fn().mockResolvedValue({ id: 'test-user', activo: true }),
      },
      curricula: {
        delete: vi.fn().mockResolvedValue({ id: 'curr-1' }),
      },
    };
    const caller = makeCaller(prisma, 'ADMIN');
    const result = await caller.delete({ id: 'curr-1' });
    expect(result.id).toBe('curr-1');
    expect(prisma.curricula.delete).toHaveBeenCalledWith({ where: { id: 'curr-1' } });
  });

  it('denies updating a curriculum for unauthorized roles', async () => {
    const updateData = { id: 'curr-1', codigo: '2020-EPIS-REV', escuelaId: 'esc-1', vigente: false, anio: 2021 };
    const prisma = {
      user: {
        findUnique: vi.fn().mockResolvedValue({ id: 'test-user', activo: true }),
      },
    };
    const caller = makeCaller(prisma, 'DOCENTE');
    await expect(caller.update(updateData)).rejects.toThrow();
  });
});
