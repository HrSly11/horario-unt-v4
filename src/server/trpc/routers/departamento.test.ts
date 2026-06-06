import { describe, expect, it, vi } from 'vitest';
import { createCallerFactory } from '../init';
import { departamentoRouter } from './departamento';

vi.mock('@/lib/prisma', () => ({ prisma: {} }));
vi.mock('@/lib/auth', () => ({ getSession: vi.fn() }));

type SessionRole =
  | 'ADMIN'
  | 'DOCENTE'
  | 'DIRECTOR_DEPARTAMENTO'
  | 'DIRECTOR_ESCUELA'
  | 'SECRETARIA_DEPARTAMENTO'
  | 'DECANO';

function makeSession(role: SessionRole = 'DECANO') {
  return {
    id: `${role.toLowerCase()}-user`,
    email: `${role.toLowerCase()}@example.edu`,
    nombre: role,
    role,
  };
}

function makeCaller(prisma: ReturnType<typeof makePrisma>, session: ReturnType<typeof makeSession> | null = makeSession()) {
  const createCaller = createCallerFactory(departamentoRouter);

  return createCaller(async () => ({
    prisma: prisma as any,
    headers: new Headers(),
    session,
  }));
}

function makePrisma({
  session = makeSession(),
  targetUser,
}: {
  session?: ReturnType<typeof makeSession>;
  targetUser?: Record<string, unknown> | null;
} = {}) {
  return {
    user: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => {
        if (where.id === session.id) {
          return { ...session, docenteId: null, activo: true };
        }

        return targetUser ?? null;
      }),
      findMany: vi.fn(async () => []),
    },
    departamento: {
      findMany: vi.fn(async () => []),
      findUnique: vi.fn(async () => ({ id: 'dept-1' })),
      findUniqueOrThrow: vi.fn(async () => ({ id: 'dept-1' })),
      update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({
        id: 'dept-1',
        ...data,
      })),
    },
  };
}

describe('departamentoRouter organization hardening', () => {
  it('requires authentication for list and byId because both expose organization assignments', async () => {
    const prisma = makePrisma();
    const caller = makeCaller(prisma, null);

    await expect(caller.list()).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
    await expect(caller.byId({ id: 'dept-1' })).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });

  it('rejects department director assignment unless the target user is active and has the exact role', async () => {
    const prisma = makePrisma({
      targetUser: {
        id: 'target-user',
        role: 'DOCENTE',
        activo: true,
      },
    });
    const caller = makeCaller(prisma);

    await expect(caller.designarDirector({ id: 'dept-1', directorId: 'target-user' })).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    });
    expect(prisma.departamento.update).not.toHaveBeenCalled();
  });

  it('rejects department secretary assignment when the target user is inactive', async () => {
    const prisma = makePrisma({
      targetUser: {
        id: 'target-user',
        role: 'SECRETARIA_DEPARTAMENTO',
        activo: false,
      },
    });
    const caller = makeCaller(prisma);

    await expect(caller.designarSecretaria({ id: 'dept-1', secretariaId: 'target-user' })).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    });
    expect(prisma.departamento.update).not.toHaveBeenCalled();
  });

  it('records assigner and timestamp metadata when assigning a department secretary', async () => {
    const session = makeSession('DECANO');
    const prisma = makePrisma({
      session,
      targetUser: {
        id: 'target-user',
        role: 'SECRETARIA_DEPARTAMENTO',
        activo: true,
      },
    });
    const caller = makeCaller(prisma, session);

    await caller.designarSecretaria({ id: 'dept-1', secretariaId: 'target-user' });

    expect(prisma.departamento.update).toHaveBeenCalledWith({
      where: { id: 'dept-1' },
      data: {
        secretariaId: 'target-user',
        designadoPorId: session.id,
        fechaDesignacion: expect.any(Date),
      },
    });
  });

  it('scopes listed docente users to the requested department', async () => {
    const session = makeSession('DIRECTOR_DEPARTAMENTO');
    const prisma = makePrisma({ session });
    const caller = makeCaller(prisma, session);

    await caller.listUsersByRole({ departamentoId: 'dept-1', role: 'DOCENTE' });

    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          role: 'DOCENTE',
          activo: true,
          docente: { is: { departamentoId: 'dept-1' } },
        },
      })
    );
  });

  it('does not return a global list of departmental directors assigned elsewhere', async () => {
    const session = makeSession('DIRECTOR_DEPARTAMENTO');
    const prisma = makePrisma({ session });
    const caller = makeCaller(prisma, session);

    await caller.listUsersByRole({ departamentoId: 'dept-1', role: 'DIRECTOR_DEPARTAMENTO' });

    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          role: 'DIRECTOR_DEPARTAMENTO',
          activo: true,
          OR: [
            { departamentoDirigido: { is: { id: 'dept-1' } } },
            { departamentoDirigido: { is: null } },
          ],
        },
      })
    );
  });
});
