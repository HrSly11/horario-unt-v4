import { describe, expect, it, vi } from 'vitest';
import { createCallerFactory } from '../init';
import { escuelaRouter } from './escuela';

vi.mock('@/lib/prisma', () => ({ prisma: {} }));
vi.mock('@/lib/auth', () => ({ getSession: vi.fn() }));

type SessionRole = 'ADMIN' | 'DIRECTOR_ESCUELA' | 'DECANO';

function makeSession(role: SessionRole = 'DECANO') {
  return {
    id: `${role.toLowerCase()}-user`,
    email: `${role.toLowerCase()}@example.edu`,
    nombre: role,
    role,
  };
}

function makeCaller(prisma: ReturnType<typeof makePrisma>, session: ReturnType<typeof makeSession> | null = makeSession()) {
  const createCaller = createCallerFactory(escuelaRouter);

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
    },
    escuela: {
      findMany: vi.fn(async () => []),
      findUniqueOrThrow: vi.fn(async () => ({ id: 'escuela-1' })),
      update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({
        id: 'escuela-1',
        ...data,
      })),
    },
  };
}

describe('escuelaRouter organization hardening', () => {
  it('requires authentication for list and byId because both expose organization assignments', async () => {
    const prisma = makePrisma();
    const caller = makeCaller(prisma, null);

    await expect(caller.list()).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
    await expect(caller.byId({ id: 'escuela-1' })).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });

  it('rejects school director assignment unless the target user has the exact active role', async () => {
    const prisma = makePrisma({
      targetUser: {
        id: 'target-user',
        role: 'DIRECTOR_DEPARTAMENTO',
        activo: true,
      },
    });
    const caller = makeCaller(prisma);

    await expect(caller.designarDirector({ id: 'escuela-1', directorId: 'target-user' })).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    });
    expect(prisma.escuela.update).not.toHaveBeenCalled();
  });

  it('records assigner and timestamp metadata when assigning a school director', async () => {
    const session = makeSession('DECANO');
    const prisma = makePrisma({
      session,
      targetUser: {
        id: 'target-user',
        role: 'DIRECTOR_ESCUELA',
        activo: true,
      },
    });
    const caller = makeCaller(prisma, session);

    await caller.designarDirector({ id: 'escuela-1', directorId: 'target-user' });

    expect(prisma.escuela.update).toHaveBeenCalledWith({
      where: { id: 'escuela-1' },
      data: {
        directorId: 'target-user',
        designadoPorId: session.id,
        fechaDesignacion: expect.any(Date),
      },
    });
  });
});
