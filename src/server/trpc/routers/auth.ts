import { z } from 'zod';
import { baseProcedure, createTRPCRouter, protectedProcedure, adminProcedure, secretariaProcedure } from '../init';
import { TRPCError } from '@trpc/server';
import bcrypt from 'bcryptjs';
import { encrypt } from '@/lib/auth';
import { cookies } from 'next/headers';

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

      // Log login
      await ctx.prisma.log.create({
        data: {
          userId: user.id,
          accion: 'LOGIN',
          detalles: `Usuario ${user.email} inició sesión`,
        }
      });

      return { success: true, user: { id: user.id, email: user.email, role: user.role, nombre: user.nombre } };
    }),

  registerDocente: baseProcedure
    .input(z.object({
      nombreCompleto: z.string(),
      email: z.string().email(),
      password: z.string().min(6),
    }))
    .mutation(async ({ ctx, input }) => {
      // 1. Verify if docente exists by email or name
      const docente = await ctx.prisma.docente.findFirst({
        where: {
          OR: [
            { email: input.email },
            { nombre: { contains: input.nombreCompleto, mode: 'insensitive' } }
          ]
        }
      });

      if (!docente) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Docente no registrado en la base de datos, acercarse a las oficinas de registro o comunicarselo al administrador del sistema',
        });
      }

      // 2. Check if user already exists
      const existingUser = await ctx.prisma.user.findUnique({
        where: { email: input.email }
      });

      if (existingUser) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'Ya existe una cuenta con este correo electrónico',
        });
      }

      // 3. Check if docente already has a user
      const docHasUser = await ctx.prisma.user.findUnique({
        where: { docenteId: docente.id }
      });

      if (docHasUser) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'Este docente ya tiene una cuenta asociada',
        });
      }

      // 4. Create user
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

  logout: baseProcedure.mutation(async () => {
    (await cookies()).delete('session');
    return { success: true };
  }),

  me: baseProcedure.query(async ({ ctx }) => {
    return ctx.session;
  }),

  getProfile: protectedProcedure.query(async ({ ctx }) => {
    const user = await ctx.prisma.user.findUnique({
      where: { id: ctx.session.id },
      include: { docente: true }
    });
    if (!user) throw new TRPCError({ code: 'NOT_FOUND' });
    return user;
  }),

  updateProfile: protectedProcedure
    .input(z.object({
      nombre: z.string().optional(),
      password: z.string().min(6).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const data: { nombre?: string; password?: string } = {};
      if (input.nombre) data.nombre = input.nombre;
      if (input.password) {
        data.password = await bcrypt.hash(input.password, 10);
      }

      const user = await ctx.prisma.user.update({
        where: { id: ctx.session.id },
        data
      });

      return { success: true, user: { id: user.id, nombre: user.nombre } };
    }),

  // Admin only: Users management
  listUsers: secretariaProcedure.query(async ({ ctx }) => {
    return ctx.prisma.user.findMany({
      include: { docente: true },
      orderBy: { createdAt: 'desc' }
    });
  }),

  toggleUserStatus: secretariaProcedure
    .input(z.object({ userId: z.string(), activo: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.user.update({
        where: { id: input.userId },
        data: { activo: input.activo }
      });
    }),

  // Admin only: Bitacora
  getLogs: secretariaProcedure.query(async ({ ctx }) => {
    return ctx.prisma.log.findMany({
      include: { user: { select: { nombre: true, email: true, role: true } } },
      orderBy: { createdAt: 'desc' },
      take: 100
    });
  })
});
