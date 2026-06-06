import { z } from 'zod';
import { createTRPCRouter, adminProcedure, protectedProcedure } from '../init';

const facultadInput = z.object({
  nombre: z.string().min(3, 'El nombre debe tener al menos 3 caracteres'),
  siglas: z.string().min(1, 'Las siglas son obligatorias').max(10),
});

export const facultadRouter = createTRPCRouter({
  list: protectedProcedure.query(async ({ ctx }) => {
    return ctx.prisma.facultad.findMany({
      include: {
        _count: {
          select: { departamentos: true, escuelas: true },
        },
      },
      orderBy: { nombre: 'asc' },
    });
  }),

  byId: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.facultad.findUniqueOrThrow({
        where: { id: input.id },
        include: {
          departamentos: {
            include: {
              director: { select: { id: true, nombre: true, email: true } },
              secretaria: { select: { id: true, nombre: true, email: true } },
              _count: { select: { docentes: true } },
            },
            orderBy: { nombre: 'asc' },
          },
          escuelas: {
            include: {
              director: { select: { id: true, nombre: true, email: true } },
              _count: { select: { curriculas: true } },
            },
            orderBy: { nombre: 'asc' },
          },
        },
      });
    }),

  create: adminProcedure.input(facultadInput).mutation(({ ctx, input }) => {
    return ctx.prisma.facultad.create({ data: input });
  }),

  update: adminProcedure
    .input(z.object({ id: z.string() }).merge(facultadInput))
    .mutation(({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.prisma.facultad.update({ where: { id }, data });
    }),

  delete: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(({ ctx, input }) => {
      return ctx.prisma.facultad.delete({ where: { id: input.id } });
    }),
});
