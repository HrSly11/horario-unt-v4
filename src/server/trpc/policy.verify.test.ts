import { describe, expect, it, vi } from 'vitest';
import { assertCanAccessDocenteDepartamento } from './policy';
import { UserRole } from '@/generated/prisma/client';

describe('Policy - assertCanAccessDocenteDepartamento with DIRECTOR_DEPARTAMENTO', () => {
  const mockPrisma = {
    docente: {
      findUniqueOrThrow: vi.fn(async () => ({
        id: 'docente-1',
        departamentoId: 'dept-1',
      })),
    },
    departamento: {
      findUnique: vi.fn(async () => ({
        id: 'dept-1',
      })),
    },
  } as any;

  it('allows DIRECTOR_DEPARTAMENTO to access any docente (now that they are in academicManagerRoles)', async () => {
    const session = {
      id: 'director-user',
      role: 'DIRECTOR_DEPARTAMENTO' as UserRole,
    };

    // This should NOT throw
    await expect(assertCanAccessDocenteDepartamento(mockPrisma, session, 'docente-1')).resolves.not.toThrow();
  });

  it('allows DIRECTOR_ESCUELA to access any docente (baseline)', async () => {
    const session = {
      id: 'escuela-user',
      role: 'DIRECTOR_ESCUELA' as UserRole,
    };

    await expect(assertCanAccessDocenteDepartamento(mockPrisma, session, 'docente-1')).resolves.not.toThrow();
  });

  it('restricts SECRETARIA_DEPARTAMENTO to their department', async () => {
    const session = {
      id: 'secretaria-user',
      role: 'SECRETARIA_DEPARTAMENTO' as UserRole,
    };

    // Case 1: Secretary manages the teacher's department
    mockPrisma.departamento.findUnique.mockResolvedValueOnce({ id: 'dept-1' });
    await expect(assertCanAccessDocenteDepartamento(mockPrisma, session, 'docente-1')).resolves.not.toThrow();

    // Case 2: Secretary does NOT manage the teacher's department
    mockPrisma.departamento.findUnique.mockResolvedValueOnce({ id: 'dept-other' });
    await expect(assertCanAccessDocenteDepartamento(mockPrisma, session, 'docente-1')).rejects.toThrow('No tiene permiso para acceder a este docente');
  });
});
