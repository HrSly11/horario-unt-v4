import { z } from 'zod';
import { createTRPCRouter, adminProcedure, decanoProcedure, protectedProcedure } from '../init';
import { assertActiveUserWithRole } from '../policy';

const escuelaInput = z.object({
  nombre: z.string().min(3, 'El nombre debe tener al menos 3 caracteres'),
  facultadId: z.string().min(1, 'La facultad es obligatoria'),
});

export const escuelaRouter = createTRPCRouter({
  list: protectedProcedure
    .input(
      z.object({
        facultadId: z.string().optional(),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      const where: Record<string, unknown> = {};
      if (input?.facultadId) where.facultadId = input.facultadId;

      return ctx.prisma.escuela.findMany({
        where,
        include: {
          facultad: { select: { id: true, nombre: true, siglas: true } },
          director: { select: { id: true, nombre: true, email: true } },
          _count: { select: { curriculas: true } },
        },
        orderBy: { nombre: 'asc' },
      });
    }),

  byId: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.escuela.findUniqueOrThrow({
        where: { id: input.id },
        include: {
          facultad: { select: { id: true, nombre: true, siglas: true } },
          director: { select: { id: true, nombre: true, email: true } },
          designadoPor: { select: { id: true, nombre: true, email: true } },
          curriculas: {
            include: {
              _count: { select: { cursos: true } },
            },
            orderBy: { anio: 'desc' },
          },
        },
      });
    }),

  create: adminProcedure.input(escuelaInput).mutation(({ ctx, input }) => {
    return ctx.prisma.escuela.create({ data: input });
  }),

  update: adminProcedure
    .input(z.object({ id: z.string() }).merge(escuelaInput))
    .mutation(({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.prisma.escuela.update({ where: { id }, data });
    }),

  delete: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(({ ctx, input }) => {
      return ctx.prisma.escuela.delete({ where: { id: input.id } });
    }),

  designarDirector: decanoProcedure
    .input(
      z.object({
        id: z.string(),
        directorId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await assertActiveUserWithRole(ctx.prisma, input.directorId, 'DIRECTOR_ESCUELA');

      return ctx.prisma.escuela.update({
        where: { id: input.id },
        data: {
          directorId: input.directorId,
          designadoPorId: ctx.session.id,
          fechaDesignacion: new Date(),
        },
      });
    }),
});
