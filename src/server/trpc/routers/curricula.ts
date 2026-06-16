import { z } from 'zod';
import {
  createTRPCRouter,
  protectedProcedure,
  secretariaDepartamentoProcedure,
} from '../init';

const curriculaInput = z.object({
  codigo: z.string().min(2, 'El código debe tener al menos 2 caracteres'),
  anio: z.number().int().min(1900).max(2100),
  escuelaId: z.string(),
  vigente: z.boolean().optional().default(true),
});

const linkCourseInput = z.object({
  curriculaId: z.string(),
  cursoId: z.string(),
  ciclo: z.number().int().min(1).max(12),
  esElectivo: z.boolean().optional().default(false),
});

export const curriculaRouter = createTRPCRouter({
  list: protectedProcedure
    .input(
      z.object({
        escuelaId: z.string().optional(),
        vigente: z.boolean().optional(),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      const where: Record<string, any> = {};
      if (input?.escuelaId) where.escuelaId = input.escuelaId;
      if (input?.vigente !== undefined) where.vigente = input.vigente;

      return ctx.prisma.curricula.findMany({
        where,
        include: {
          escuela: { select: { id: true, nombre: true } },
          cursos: {
            include: {
              curso: { select: { id: true, codigo: true, nombre: true, creditos: true } }
            }
          }
        },
        orderBy: { anio: 'desc' },
      });
    }),

  byId: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.curricula.findUniqueOrThrow({
        where: { id: input.id },
        include: {
          escuela: { select: { id: true, nombre: true } },
          cursos: {
            include: {
              curso: { select: { id: true, codigo: true, nombre: true, creditos: true, horasTeoria: true, horasPractica: true, horasLaboratorio: true } }
            }
          }
        },
      });
    }),

  create: secretariaDepartamentoProcedure
    .input(curriculaInput)
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.curricula.create({
        data: input,
      });
    }),

  update: secretariaDepartamentoProcedure
    .input(z.object({ id: z.string() }).merge(curriculaInput))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.prisma.curricula.update({
        where: { id },
        data,
      });
    }),

  delete: secretariaDepartamentoProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.curricula.delete({
        where: { id: input.id },
      });
    }),

  linkCourse: secretariaDepartamentoProcedure
    .input(linkCourseInput)
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.cursoCurricula.create({
        data: input,
      });
    }),

  unlinkCourse: secretariaDepartamentoProcedure
    .input(z.object({ curriculaId: z.string(), cursoId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.cursoCurricula.delete({
        where: {
          cursoId_curriculaId: {
            cursoId: input.cursoId,
            curriculaId: input.curriculaId,
          },
        },
      });
    }),
});
