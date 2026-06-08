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

export const protectedProcedure = t.procedure.use(async ({ ctx, next }) => {
  if (!ctx.session) {
    throw new TRPCError({ code: 'UNAUTHORIZED' });
  }

  const user = await ctx.prisma.user.findUnique({
    where: { id: ctx.session.id },
    select: {
      id: true,
      email: true,
      role: true,
      nombre: true,
      docenteId: true,
      activo: true,
    },
  });

  if (!user || !user.activo) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Sesión inválida o usuario inactivo' });
  }

  const session: Session = {
    id: user.id,
    email: user.email,
    role: user.role,
    nombre: user.nombre,
    docenteId: user.docenteId ?? undefined,
  };

  return next({
    ctx: {
      ...ctx,
      session,
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

export const academicManagerProcedure = protectedProcedure.use(({ ctx, next }) => {
  const academicRoles: UserRole[] = ['ADMIN', 'SECRETARIA_ACADEMICA', 'DIRECTOR_ESCUELA'];
  if (!academicRoles.includes(ctx.session.role)) {
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

export const directorDepartamentoProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.session.role !== 'DIRECTOR_DEPARTAMENTO' && ctx.session.role !== 'ADMIN') {
    throw new TRPCError({ code: 'FORBIDDEN' });
  }
  return next();
});

export const secretariaDepartamentoProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.session.role !== 'SECRETARIA_DEPARTAMENTO' && ctx.session.role !== 'ADMIN') {
    throw new TRPCError({ code: 'FORBIDDEN' });
  }
  return next();
});

export const decanoProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.session.role !== 'DECANO' && ctx.session.role !== 'ADMIN') {
    throw new TRPCError({ code: 'FORBIDDEN' });
  }
  return next();
});
