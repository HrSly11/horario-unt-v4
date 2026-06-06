import { z } from 'zod';
import { createTRPCRouter, adminProcedure, decanoProcedure, protectedProcedure } from '../init';
import {
  assertActiveUserWithRole,
  assertCanAccessDepartamento,
  assertRole,
  buildDepartmentScopedUserWhere,
  getManagedDepartamentoIds,
} from '../policy';

const departamentoInput = z.object({
  nombre: z.string().min(3, 'El nombre debe tener al menos 3 caracteres'),
  facultadId: z.string().min(1, 'La facultad es obligatoria'),
});

export const departamentoRouter = createTRPCRouter({
  list: protectedProcedure
    .input(
      z.object({
        facultadId: z.string().optional(),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      const where: Record<string, unknown> = {};
      if (input?.facultadId) where.facultadId = input.facultadId;
      const managedDepartamentoIds = await getManagedDepartamentoIds(ctx.prisma, ctx.session);
      if (managedDepartamentoIds !== null) where.id = { in: managedDepartamentoIds };

      return ctx.prisma.departamento.findMany({
        where,
        include: {
          facultad: { select: { id: true, nombre: true, siglas: true } },
          director: { select: { id: true, nombre: true, email: true } },
          secretaria: { select: { id: true, nombre: true, email: true } },
          _count: { select: { docentes: true } },
        },
        orderBy: { nombre: 'asc' },
      });
    }),

  byId: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      await assertCanAccessDepartamento(ctx.prisma, ctx.session, input.id);

      return ctx.prisma.departamento.findUniqueOrThrow({
        where: { id: input.id },
        include: {
          facultad: { select: { id: true, nombre: true, siglas: true } },
          director: { select: { id: true, nombre: true, email: true } },
          secretaria: { select: { id: true, nombre: true, email: true } },
          designadoPor: { select: { id: true, nombre: true, email: true } },
          docentes: {
            select: {
              id: true,
              nombre: true,
              email: true,
              categoria: true,
              modalidad: true,
              horasContrato: true,
            },
            orderBy: { nombre: 'asc' },
          },
        },
      });
    }),

  create: adminProcedure.input(departamentoInput).mutation(({ ctx, input }) => {
    return ctx.prisma.departamento.create({ data: input });
  }),

  update: adminProcedure
    .input(z.object({ id: z.string() }).merge(departamentoInput))
    .mutation(({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.prisma.departamento.update({ where: { id }, data });
    }),

  delete: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(({ ctx, input }) => {
      return ctx.prisma.departamento.delete({ where: { id: input.id } });
    }),

  designarDirector: decanoProcedure
    .input(
      z.object({
        id: z.string(),
        directorId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await assertActiveUserWithRole(ctx.prisma, input.directorId, 'DIRECTOR_DEPARTAMENTO');

      return ctx.prisma.departamento.update({
        where: { id: input.id },
        data: {
          directorId: input.directorId,
          designadoPorId: ctx.session.id,
          fechaDesignacion: new Date(),
        },
      });
    }),

  designarSecretaria: decanoProcedure
    .input(
      z.object({
        id: z.string(),
        secretariaId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await assertActiveUserWithRole(ctx.prisma, input.secretariaId, 'SECRETARIA_DEPARTAMENTO');

      return ctx.prisma.departamento.update({
        where: { id: input.id },
        data: {
          secretariaId: input.secretariaId,
          designadoPorId: ctx.session.id,
          fechaDesignacion: new Date(),
        },
      });
    }),

  listUsersByRole: protectedProcedure
    .input(
      z.object({
        departamentoId: z.string(),
        role: z.enum(['DOCENTE', 'DIRECTOR_DEPARTAMENTO', 'SECRETARIA_DEPARTAMENTO']),
      })
    )
    .query(async ({ ctx, input }) => {
      assertRole(ctx.session, ['ADMIN', 'DECANO', 'DIRECTOR_DEPARTAMENTO', 'SECRETARIA_DEPARTAMENTO']);
      await assertCanAccessDepartamento(ctx.prisma, ctx.session, input.departamentoId);

      return ctx.prisma.user.findMany({
        where: buildDepartmentScopedUserWhere(input.role, input.departamentoId),
        select: { id: true, nombre: true, email: true, role: true },
        orderBy: { nombre: 'asc' },
      });
    }),
});
