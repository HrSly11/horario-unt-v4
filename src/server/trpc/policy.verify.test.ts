import { describe, expect, it, vi } from 'vitest';
import {
  assertCanAccessEscuela,
  assertCanAccessFacultad,
  assertCanAccessDepartamento,
  assertCanAccessDocenteDepartamento,
  getManagedEscuelaIds,
  getManagedFacultadIds,
} from './policy';
import { UserRole } from '@/generated/prisma/client';

function session(id: string, role: UserRole) {
  return { id, role };
}

describe('scoped role policy', () => {
  it('allows a department head to access teachers from the managed department', async () => {
    const prisma = {
      departamento: { findUnique: vi.fn().mockResolvedValue({ id: 'dept-1' }) },
      docente: { findUniqueOrThrow: vi.fn().mockResolvedValue({ departamentoId: 'dept-1' }) },
    } as any;

    await expect(
      assertCanAccessDocenteDepartamento(
        prisma,
        session('head-1', 'DIRECTOR_DEPARTAMENTO'),
        'teacher-1'
      )
    ).resolves.toBeUndefined();
  });

  it('rejects a department head targeting another department', async () => {
    const prisma = {
      departamento: { findUnique: vi.fn().mockResolvedValue({ id: 'dept-1' }) },
      docente: { findUniqueOrThrow: vi.fn().mockResolvedValue({ departamentoId: 'dept-2' }) },
    } as any;

    await expect(
      assertCanAccessDocenteDepartamento(
        prisma,
        session('head-1', 'DIRECTOR_DEPARTAMENTO'),
        'teacher-2'
      )
    ).rejects.toThrow('No tiene permiso para acceder a este docente');
  });

  it('does not grant a school director a global department bypass', async () => {
    const prisma = { departamento: { findUnique: vi.fn() } } as any;

    await expect(
      assertCanAccessDepartamento(
        prisma,
        session('school-director-1', 'DIRECTOR_ESCUELA'),
        'dept-1'
      )
    ).rejects.toThrow('No tiene permiso para acceder a este departamento');
  });

  it.each([
    ['DIRECTOR_ESCUELA', 'escuelaDirigida'],
    ['SECRETARIA_ACADEMICA', 'escuelaSecretaria'],
  ] as const)('scopes %s to the owned school', async (role, relation) => {
    const prisma = {
      escuela: { findUnique: vi.fn().mockResolvedValue({ id: 'school-1' }) },
    } as any;

    await expect(
      getManagedEscuelaIds(prisma, session('school-user', role))
    ).resolves.toEqual(['school-1']);
    expect(prisma.escuela.findUnique).toHaveBeenCalledWith({
      where: { [relation === 'escuelaDirigida' ? 'directorId' : 'secretariaId']: 'school-user' },
      select: { id: true },
    });
  });

  it('scopes a dean to the owned faculty while ADMIN remains unscoped', async () => {
    const prisma = {
      facultad: { findUnique: vi.fn().mockResolvedValue({ id: 'faculty-1' }) },
    } as any;

    await expect(
      getManagedFacultadIds(prisma, session('dean-1', 'DECANO'))
    ).resolves.toEqual(['faculty-1']);
    await expect(
      getManagedFacultadIds(prisma, session('admin-1', 'ADMIN'))
    ).resolves.toBeNull();
  });

  it('rejects cross-school and cross-faculty access', async () => {
    const prisma = {
      escuela: { findUnique: vi.fn().mockResolvedValue({ id: 'school-1' }) },
      facultad: { findUnique: vi.fn().mockResolvedValue({ id: 'faculty-1' }) },
    } as any;

    await expect(
      assertCanAccessEscuela(prisma, session('secretary-1', 'SECRETARIA_ACADEMICA'), 'school-2')
    ).rejects.toThrow('No tiene permiso para acceder a esta escuela');
    await expect(
      assertCanAccessFacultad(prisma, session('dean-1', 'DECANO'), 'faculty-2')
    ).rejects.toThrow('No tiene permiso para acceder a esta facultad');
  });

  it('allows a teacher to access only their own identity', async () => {
    const prisma = {} as any;
    const teacher = { id: 'teacher-user', role: 'DOCENTE' as UserRole, docenteId: 'teacher-1' };

    await expect(
      assertCanAccessDocenteDepartamento(prisma, teacher, 'teacher-1')
    ).resolves.toBeUndefined();
    await expect(
      assertCanAccessDocenteDepartamento(prisma, teacher, 'teacher-2')
    ).rejects.toThrow('No tiene permiso para acceder a otro docente');
  });
});
