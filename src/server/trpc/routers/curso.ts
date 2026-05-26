import { z } from 'zod';
import { createTRPCRouter, baseProcedure, adminProcedure, protectedProcedure, secretariaProcedure } from '../init';
import { TRPCError } from '@trpc/server';

const cursoInput = z.object({
  codigo: z.string().min(2, 'El código es obligatorio'),
  nombre: z.string().min(3, 'El nombre debe tener al menos 3 caracteres'),
  creditos: z.number().int().min(1).max(10),
  horasTeoria: z.number().int().min(0),
  horasLaboratorio: z.number().int().min(0),
  ciclo: z.number().int().min(1).max(12),
  requiereLaboratorio: z.boolean().optional().default(false),
  perfilRequerido: z.string().optional(),
  gradoRequerido: z.string().optional(),
  experienciaMinima: z.number().int().min(0).optional(),
  especialidadRequerida: z.string().optional(),
  aperturado: z.boolean().optional().default(false),
});

const grupoInput = z.object({
  nombre: z.string().min(1, 'El nombre del grupo es obligatorio'),
  cursoId: z.string(),
  periodoAcademicoId: z.string(),
});

export const cursoRouter = createTRPCRouter({
  list: baseProcedure
    .input(
      z.object({
        ciclo: z.number().int().optional(),
        search: z.string().optional(),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      const where: Record<string, unknown> = {};

      if (input?.ciclo) where.ciclo = input.ciclo;
      if (input?.search) {
        where.OR = [
          { nombre: { contains: input.search, mode: 'insensitive' } },
          { codigo: { contains: input.search, mode: 'insensitive' } },
        ];
      }

      return ctx.prisma.curso.findMany({
        where,
        include: {
          grupos: {
            include: { periodoAcademico: true },
            orderBy: { nombre: 'asc' },
          },
        },
        orderBy: [{ ciclo: 'asc' }, { codigo: 'asc' }],
      });
    }),

  byId: baseProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.curso.findUniqueOrThrow({
        where: { id: input.id },
        include: {
          grupos: {
            include: {
              periodoAcademico: true,
              asignaciones: {
                include: { docente: true, aula: true, franjaHoraria: true },
              },
            },
          },
        },
      });
    }),

  create: secretariaProcedure.input(cursoInput).mutation(({ ctx, input }) => {
    return ctx.prisma.curso.create({ data: input });
  }),

  update: secretariaProcedure
    .input(z.object({ id: z.string() }).merge(cursoInput))
    .mutation(({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.prisma.curso.update({ where: { id }, data });
    }),

  delete: adminProcedure.input(z.object({ id: z.string() })).mutation(({ ctx, input }) => {
    return ctx.prisma.curso.delete({ where: { id: input.id } });
  }),

  // Grupos
  createGrupo: secretariaProcedure.input(grupoInput).mutation(({ ctx, input }) => {
    return ctx.prisma.grupo.create({ data: input });
  }),

  deleteGrupo: adminProcedure.input(z.object({ id: z.string() })).mutation(({ ctx, input }) => {
    return ctx.prisma.grupo.delete({ where: { id: input.id } });
  }),

  // Get all unique ciclos (for filters)
  ciclos: baseProcedure.query(async ({ ctx }) => {
    const cursos = await ctx.prisma.curso.findMany({
      select: { ciclo: true },
      distinct: ['ciclo'],
      orderBy: { ciclo: 'asc' },
    });
    return cursos.map((c) => c.ciclo);
  }),

  /** Aperture courses for the semester (Representative only) */
  toggleApertura: secretariaProcedure
    .input(z.object({ id: z.string(), aperturado: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.curso.update({
        where: { id: input.id },
        data: { aperturado: input.aperturado },
      });
    }),

  /** Start scheduling process (Representative only) */
  startProcess: secretariaProcedure.mutation(async ({ ctx }) => {
    const periodo = await ctx.prisma.periodoAcademico.findFirst({ where: { activo: true } });
    if (!periodo) throw new TRPCError({ code: 'NOT_FOUND' });

    return ctx.prisma.periodoAcademico.update({
      where: { id: periodo.id },
      data: { estado: 'POSTULACION' },
    });
  }),
});
