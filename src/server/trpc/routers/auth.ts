import { z } from 'zod';
import { baseProcedure, createTRPCRouter, protectedProcedure, adminProcedure } from '../init';
import { TRPCError } from '@trpc/server';
import bcrypt from 'bcryptjs';
import { encrypt } from '@/lib/auth';
import { cookies } from 'next/headers';
import { writeAuditLog } from '@/server/services/audit';

export const authRouter = createTRPCRouter({
  login: baseProcedure
    .input(z.object({
      email: z.string().email(),
      password: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const user = await ctx.prisma.user.findUnique({
        where: { email: input.email },
        include: { docente: true }
      });

      if (!user || !user.activo) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Credenciales inválidas o usuario inactivo',
        });
      }

      const isValid = await bcrypt.compare(input.password, user.password);
      if (!isValid) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Credenciales inválidas',
        });
      }

      const session = await encrypt({
        id: user.id,
        email: user.email,
        role: user.role,
        nombre: user.nombre,
        docenteId: user.docenteId,
      });

      (await cookies()).set('session', session, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24, // 1 day
      });

      await writeAuditLog(ctx.prisma, {
        session: { id: user.id },
        headers: ctx.headers,
        accion: 'LOGIN',
        entidad: 'User',
        entidadId: user.id,
        detalles: `Usuario ${user.email} inició sesión`,
      });

      return { success: true, user: { id: user.id, email: user.email, role: user.role, nombre: user.nombre } };
    }),

  registerDocente: baseProcedure
    .input(z.object({
      nombreCompleto: z.string(),
      email: z.string().email(),
      password: z.string().min(8),
    }))
    .mutation(async ({ ctx, input }) => {
      const docente = await ctx.prisma.docente.findUnique({
        where: { email: input.email },
      });

      if (!docente) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Docente no registrado en la base de datos, acercarse a las oficinas de registro o comunicarselo al administrador del sistema',
        });
      }

      if (docente.nombre.trim().toLowerCase() !== input.nombreCompleto.trim().toLowerCase()) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Los datos ingresados no coinciden con el registro docente',
        });
      }

      const existingUser = await ctx.prisma.user.findUnique({
        where: { email: input.email }
      });

      if (existingUser) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'Ya existe una cuenta con este correo electrónico',
        });
      }

      const docHasUser = await ctx.prisma.user.findUnique({
        where: { docenteId: docente.id }
      });

      if (docHasUser) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'Este docente ya tiene una cuenta asociada',
        });
      }

      const hashedPassword = await bcrypt.hash(input.password, 10);
      const user = await ctx.prisma.user.create({
        data: {
          email: input.email,
          password: hashedPassword,
          nombre: docente.nombre,
          role: 'DOCENTE',
          docenteId: docente.id,
        }
      });

      return { success: true, user: { id: user.id, email: user.email, nombre: user.nombre } };
    }),

  createUser: adminProcedure
    .input(z.object({
      nombre: z.string(),
      email: z.string().email(),
      password: z.string().min(8),
      role: z.enum(['ADMIN', 'DOCENTE', 'ESTUDIANTE', 'INVITADO', 'SECRETARIA_ACADEMICA', 'DIRECTOR_ESCUELA', 'DIRECTOR_DEPARTAMENTO', 'SECRETARIA_DEPARTAMENTO', 'DECANO']),
      docenteId: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const existingUser = await ctx.prisma.user.findUnique({
        where: { email: input.email }
      });

      if (existingUser) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'Ya existe una cuenta con este correo electrónico',
        });
      }

      const hashedPassword = await bcrypt.hash(input.password, 10);
      const user = await ctx.prisma.user.create({
        data: {
          email: input.email,
          password: hashedPassword,
          nombre: input.nombre,
          role: input.role,
          docenteId: input.docenteId,
          activo: true,
        }
      });

      await writeAuditLog(ctx.prisma, {
        session: ctx.session,
        headers: ctx.headers,
        accion: 'USER_CREATED',
        entidad: 'User',
        entidadId: user.id,
        detalles: `Administrador creó usuario ${user.email} con rol ${user.role}`,
      });

      return { success: true, user: { id: user.id, email: user.email, nombre: user.nombre } };
    }),

  logout: baseProcedure.mutation(async () => {
    (await cookies()).delete('session');
    return { success: true };
  }),

  me: baseProcedure.query(async ({ ctx }) => {
    if (!ctx.session) return null;

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

    if (!user?.activo) return null;
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      nombre: user.nombre,
      docenteId: user.docenteId,
    };
  }),

  getProfile: protectedProcedure.query(async ({ ctx }) => {
    const user = await ctx.prisma.user.findUnique({
      where: { id: ctx.session.id },
      select: {
        id: true,
        email: true,
        nombre: true,
        role: true,
        activo: true,
        docenteId: true,
        createdAt: true,
        updatedAt: true,
        docente: true,
      },
    });
    if (!user) throw new TRPCError({ code: 'NOT_FOUND' });
    return user;
  }),

  updateProfile: protectedProcedure
    .input(z.object({
      nombre: z.string().optional(),
      password: z.string().min(8).optional(),
      currentPassword: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const data: { nombre?: string; password?: string } = {};
      if (input.nombre) data.nombre = input.nombre;
      if (input.password) {
        if (!input.currentPassword) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Debe ingresar su contraseña actual' });
        }

        const user = await ctx.prisma.user.findUniqueOrThrow({
          where: { id: ctx.session.id },
          select: { password: true },
        });
        const validCurrentPassword = await bcrypt.compare(input.currentPassword, user.password);
        if (!validCurrentPassword) {
          throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Contraseña actual incorrecta' });
        }

        data.password = await bcrypt.hash(input.password, 10);
      }

      const user = await ctx.prisma.user.update({
        where: { id: ctx.session.id },
        data
      });

      return { success: true, user: { id: user.id, nombre: user.nombre } };
    }),

  listUsers: adminProcedure.query(async ({ ctx }) => {
    return ctx.prisma.user.findMany({
      select: {
        id: true,
        email: true,
        nombre: true,
        role: true,
        activo: true,
        docenteId: true,
        createdAt: true,
        updatedAt: true,
        docente: {
          select: { id: true, nombre: true, email: true, codigo: true },
        },
      },
      orderBy: { createdAt: 'desc' }
    });
  }),

  toggleUserStatus: adminProcedure
    .input(z.object({ userId: z.string(), activo: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.session.id === input.userId && !input.activo) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'No puede desactivar su propia cuenta' });
      }

      const target = await ctx.prisma.user.findUniqueOrThrow({
        where: { id: input.userId },
        select: { id: true, email: true, role: true, activo: true },
      });
      if (target.role === 'ADMIN' && ctx.session.id !== input.userId) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'No puede modificar otra cuenta administradora' });
      }

      const updated = await ctx.prisma.user.update({
        where: { id: input.userId },
        data: { activo: input.activo }
      });

      await writeAuditLog(ctx.prisma, {
        session: ctx.session,
        headers: ctx.headers,
        accion: 'USER_STATUS_CHANGED',
        entidad: 'User',
        entidadId: input.userId,
        antes: { activo: target.activo, role: target.role, email: target.email },
        despues: { activo: updated.activo, role: updated.role, email: updated.email },
        motivo: input.activo ? 'Cuenta activada' : 'Cuenta desactivada',
      });

      return updated;
    }),

  getLogs: adminProcedure.query(async ({ ctx }) => {
    return ctx.prisma.log.findMany({
      include: { user: { select: { nombre: true, email: true, role: true } } },
      orderBy: { createdAt: 'desc' },
      take: 100
    });
  })
});
