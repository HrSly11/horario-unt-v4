import { describe, expect, it, vi } from 'vitest';
import { createCallerFactory } from '../init';
import { curriculaRouter } from './curricula';
import { UserRole } from '@/generated/prisma/client';
import {
  assertCurriculumCanClose,
  getCurriculumClosureBlockers,
} from '@/server/domain/workflow-foundation';

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

  prisma.$transaction ??= vi.fn(async (operation: (tx: any) => unknown) => operation(prisma));

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
  describe('curriculum closure guard', () => {
    it('blocks closure while students remain pending', () => {
      expect(() =>
        assertCurriculumCanClose({ estudiantesPendientes: 3, activeDemandLineCount: 0 })
      ).toThrow('La currícula mantiene 3 estudiante(s) pendiente(s)');
    });

    it('blocks closure while active demand openings reference the curriculum', () => {
      expect(() =>
        assertCurriculumCanClose({ estudiantesPendientes: 0, activeDemandLineCount: 2 })
      ).toThrow('La currícula mantiene 2 apertura(s) de demanda activa(s)');
    });

    it('allows closure only when both blockers are absent', () => {
      expect(
        getCurriculumClosureBlockers({
          estudiantesPendientes: 0,
          activeDemandLineCount: 0,
        })
      ).toEqual([]);
      expect(() =>
        assertCurriculumCanClose({ estudiantesPendientes: 0, activeDemandLineCount: 0 })
      ).not.toThrow();
    });
  });

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
      escuela: { findUnique: vi.fn().mockResolvedValue({ id: 'esc-1' }) },
    };
    const caller = makeCaller(prisma, 'SECRETARIA_ACADEMICA');
    const result = await caller.create(newCurr);
    expect(result.id).toBe('curr-2');
    expect(prisma.curricula.create).toHaveBeenCalledWith({
      data: { ...newCurr, estudiantesPendientes: 0, estado: 'ACTIVA' },
    });
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

  it('blocks curriculum closure while students remain pending', async () => {
    const updateData = { id: 'curr-1', codigo: '2020-EPIS-REV', escuelaId: 'esc-1', vigente: false, anio: 2021 };
    const prisma = {
      user: {
        findUnique: vi.fn().mockResolvedValue({ id: 'test-user', activo: true }),
      },
      curricula: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({
          id: 'curr-1', escuelaId: 'esc-1', estudiantesPendientes: 2,
        }),
        update: vi.fn(),
      },
      escuela: { findUnique: vi.fn().mockResolvedValue({ id: 'esc-1' }) },
      demandaLineaCurricula: { count: vi.fn().mockResolvedValue(0) },
    };
    const caller = makeCaller(prisma, 'SECRETARIA_ACADEMICA');
    await expect(caller.update(updateData)).rejects.toThrow('2 estudiante(s) pendiente(s)');
    expect(prisma.curricula.update).not.toHaveBeenCalled();
  });

  it('rejects creating a curriculum in another school', async () => {
    const prisma = {
      user: { findUnique: vi.fn().mockResolvedValue({ id: 'test-user', activo: true }) },
      escuela: { findUnique: vi.fn().mockResolvedValue({ id: 'esc-owned' }) },
      curricula: { create: vi.fn() },
    };
    const caller = makeCaller(prisma, 'SECRETARIA_ACADEMICA');

    await expect(
      caller.create({ codigo: '2026-OTHER', escuelaId: 'esc-other', vigente: true, anio: 2026 })
    ).rejects.toThrow('No tiene permiso para acceder a esta escuela');
    expect(prisma.curricula.create).not.toHaveBeenCalled();
  });

  it('allows linking a course to a curriculum', async () => {
    const linkData = { curriculaId: 'curr-1', cursoId: 'curso-1', ciclo: 5, esElectivo: false };
    const prisma = {
      user: {
        findUnique: vi.fn().mockResolvedValue({ id: 'test-user', activo: true }),
      },
      cursoCurricula: {
        upsert: vi.fn().mockResolvedValue({ id: 'cc-1', ...linkData }),
      },
      curricula: { findUniqueOrThrow: vi.fn().mockResolvedValue({ escuelaId: 'esc-1' }) },
      escuela: { findUnique: vi.fn().mockResolvedValue({ id: 'esc-1' }) },
    };
    const caller = makeCaller(prisma, 'ADMIN');
    const result = await caller.linkCourse(linkData);
    expect(result).toMatchObject({ id: 'cc-1' });
    expect(prisma.cursoCurricula.upsert).toHaveBeenCalledWith({
      where: { cursoId_curriculaId: { cursoId: 'curso-1', curriculaId: 'curr-1' } },
      create: { ...linkData, asociadaEn: expect.any(Date) },
      update: { ciclo: 5, esElectivo: false, asociadaEn: expect.any(Date), desasociadaEn: null },
    });
  });

  it('keeps historical membership when unlinking a course', async () => {
    const unlinkData = { curriculaId: 'curr-1', cursoId: 'curso-1' };
    const prisma = {
      user: {
        findUnique: vi.fn().mockResolvedValue({ id: 'test-user', activo: true }),
      },
      cursoCurricula: {
        update: vi.fn().mockResolvedValue({ id: 'cc-1', desasociadaEn: new Date('2026-06-22') }),
      },
      curricula: { findUniqueOrThrow: vi.fn().mockResolvedValue({ escuelaId: 'esc-1' }) },
      escuela: { findUnique: vi.fn().mockResolvedValue({ id: 'esc-1' }) },
    };
    const caller = makeCaller(prisma, 'ADMIN');
    await caller.unlinkCourse(unlinkData);
    expect(prisma.cursoCurricula.update).toHaveBeenCalledWith({
      where: { cursoId_curriculaId: unlinkData },
      data: { desasociadaEn: expect.any(Date) },
    });
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

  it('closes a curriculum non-destructively and records actor metadata', async () => {
    const prisma = {
      user: {
        findUnique: vi.fn().mockResolvedValue({ id: 'test-user', activo: true }),
      },
      curricula: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({
          id: 'curr-1', escuelaId: 'esc-1', estudiantesPendientes: 0,
        }),
        update: vi.fn().mockResolvedValue({ id: 'curr-1', estado: 'CERRADA', vigente: false }),
      },
      escuela: { findUnique: vi.fn().mockResolvedValue({ id: 'esc-1' }) },
      demandaLineaCurricula: { count: vi.fn().mockResolvedValue(0) },
    };
    const caller = makeCaller(prisma, 'SECRETARIA_ACADEMICA');
    const result = await caller.delete({ id: 'curr-1' });
    expect(result).toMatchObject({ id: 'curr-1', estado: 'CERRADA', vigente: false });
    expect(prisma.curricula.update).toHaveBeenCalledWith({
      where: { id: 'curr-1' },
      data: {
        estado: 'CERRADA',
        vigente: false,
        cerradaEn: expect.any(Date),
        cerradaPorId: 'test-user',
      },
    });
  });

  it('blocks closure while a non-final demand opening exists', async () => {
    const prisma = {
      user: { findUnique: vi.fn().mockResolvedValue({ id: 'test-user', activo: true }) },
      curricula: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({
          id: 'curr-1', escuelaId: 'esc-1', estudiantesPendientes: 0,
        }),
        update: vi.fn(),
      },
      escuela: { findUnique: vi.fn().mockResolvedValue({ id: 'esc-1' }) },
      demandaLineaCurricula: { count: vi.fn().mockResolvedValue(1) },
    };
    const caller = makeCaller(prisma, 'SECRETARIA_ACADEMICA');
    await expect(caller.delete({ id: 'curr-1' })).rejects.toThrow('1 apertura(s) de demanda activa(s)');
    expect(prisma.demandaLineaCurricula.count).toHaveBeenCalledWith({
      where: {
        curriculaId: 'curr-1',
        demandaLinea: { demanda: { estado: { notIn: ['RECHAZADA'] } } },
      },
    });
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
