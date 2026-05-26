import { initTRPC, TRPCError } from '@trpc/server';
import superjson from 'superjson';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { UserRole } from '@/generated/prisma/client';

export interface Session {
  id: string;
  email: string;
  role: UserRole;
  nombre: string;
  docenteId?: string;
}

export const createTRPCContext = async (opts: { headers: Headers }) => {
  const session = (await getSession()) as Session | null;
  return {
    prisma,
    headers: opts.headers,
    session,
  };
};

const t = initTRPC
  .context<Awaited<ReturnType<typeof createTRPCContext>>>()
  .create({
    transformer: superjson,
  });

export const createTRPCRouter = t.router;
export const createCallerFactory = t.createCallerFactory;
export const baseProcedure = t.procedure;

export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.session) {
    throw new TRPCError({ code: 'UNAUTHORIZED' });
  }
  return next({
    ctx: {
      session: ctx.session,
    },
  });
});

export const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.session.role !== 'ADMIN') {
    throw new TRPCError({ code: 'FORBIDDEN' });
  }
  return next();
});

export const secretariaProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.session.role !== 'SECRETARIA_ACADEMICA' && ctx.session.role !== 'ADMIN') {
    throw new TRPCError({ code: 'FORBIDDEN' });
  }
  return next();
});

export const directorProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.session.role !== 'DIRECTOR_ESCUELA' && ctx.session.role !== 'ADMIN') {
    throw new TRPCError({ code: 'FORBIDDEN' });
  }
  return next();
});

export const docenteProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.session.role !== 'DOCENTE' && ctx.session.role !== 'ADMIN') {
    throw new TRPCError({ code: 'FORBIDDEN' });
  }
  return next();
});
