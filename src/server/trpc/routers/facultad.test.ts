import { describe, expect, it, vi } from 'vitest';
import { createCallerFactory } from '../init';
import { facultadRouter } from './facultad';

vi.mock('@/lib/prisma', () => ({ prisma: {} }));
vi.mock('@/lib/auth', () => ({ getSession: vi.fn() }));

function makeSession() {
  return {
    id: 'admin-user',
    email: 'admin@example.edu',
    nombre: 'Admin',
    role: 'ADMIN' as const,
  };
}

function makeCaller(prisma: ReturnType<typeof makePrisma>, session: ReturnType<typeof makeSession> | null = makeSession()) {
  const createCaller = createCallerFactory(facultadRouter);

  return createCaller(async () => ({
    prisma: prisma as any,
    headers: new Headers(),
    session,
  }));
}

function makePrisma(session = makeSession()) {
  return {
    user: {
      findUnique: vi.fn(async () => ({ ...session, docenteId: null, activo: true })),
    },
    facultad: {
      findMany: vi.fn(async () => []),
      findUniqueOrThrow: vi.fn(async () => ({ id: 'facultad-1' })),
    },
  };
}

describe('facultadRouter organization hardening', () => {
  it('requires authentication for list and byId because both expose organization structure', async () => {
    const prisma = makePrisma();
    const caller = makeCaller(prisma, null);

    await expect(caller.list()).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
    await expect(caller.byId({ id: 'facultad-1' })).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });

  it('allows authenticated users to read faculty structure through the protected procedure', async () => {
    const session = makeSession();
    const prisma = makePrisma(session);
    const caller = makeCaller(prisma, session);

    await caller.list();
    await caller.byId({ id: 'facultad-1' });

    expect(prisma.facultad.findMany).toHaveBeenCalled();
    expect(prisma.facultad.findUniqueOrThrow).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'facultad-1' } })
    );
  });
});
