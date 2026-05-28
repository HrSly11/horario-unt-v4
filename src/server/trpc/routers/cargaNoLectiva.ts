import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { createTRPCRouter, baseProcedure, docenteProcedure, secretariaDepartamentoProcedure } from '../init';

const cargaNoLectivaInput = z.object({
  tipo: z.enum([
    'PREPARACION_EVALUACION', 'CONSEJERIA', 'INVESTIGACION',
    'CAPACITACION', 'GOBIERNO', 'ADMINISTRACION',
    'ASESORIA_TESIS', 'RESPONSABILIDAD_SOCIAL', 'COMITES_COMISIONES',
  ]),
  horas: z.number().int().min(1),
  descripcion: z.string().optional(),
  codigoProyecto: z.string().optional(),
  nombreProyecto: z.string().optional(),
  numAlumnos: z.number().int().optional(),
  cicloConsejeria: z.string().optional(),
});

export const cargaNoLectivaRouter = createTRPCRouter({
  list: baseProcedure
    .input(
      z.object({
        docenteId: z.string().optional(),
        periodoId: z.string().optional(),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      const where: Record<string, unknown> = {};
      if (input?.docenteId) where.docenteId = input.docenteId;
      if (input?.periodoId) where.periodoId = input.periodoId;

      return ctx.prisma.cargaNoLectiva.findMany({
        where,
        include: {
          docente: { select: { id: true, nombre: true, email: true } },
          periodo: { select: { id: true, nombre: true } },
        },
        orderBy: { createdAt: 'desc' },
      });
    }),

  byDocente: docenteProcedure
    .input(z.object({ docenteId: z.string(), periodoId: z.string() }))
    .query(async ({ ctx, input }) => {
      const [cargas, asignacionesLectivas] = await Promise.all([
        ctx.prisma.cargaNoLectiva.findMany({
          where: { docenteId: input.docenteId, periodoId: input.periodoId },
          orderBy: { tipo: 'asc' },
        }),
        ctx.prisma.asignacionCargaLectiva.findMany({
          where: { docenteId: input.docenteId, periodoId: input.periodoId },
        }),
      ]);

      const totalNoLectivas = cargas.reduce((sum, c) => sum + c.horas, 0);
      const totalLectivas = asignacionesLectivas.reduce((sum, a) => sum + a.horasAsignadas, 0);

      return { cargas, totalNoLectivas, totalLectivas, totalGeneral: totalLectivas + totalNoLectivas };
    }),

  create: docenteProcedure
    .input(z.object({ docenteId: z.string(), periodoId: z.string() }).merge(cargaNoLectivaInput))
    .mutation(async ({ ctx, input }) => {
      if (input.tipo === 'PREPARACION_EVALUACION') {
        const asignacionesLectivas = await ctx.prisma.asignacionCargaLectiva.findMany({
          where: { docenteId: input.docenteId, periodoId: input.periodoId },
        });
        const preparacionExistente = await ctx.prisma.cargaNoLectiva.findMany({
          where: { docenteId: input.docenteId, periodoId: input.periodoId, tipo: 'PREPARACION_EVALUACION' },
        });
        const totalLectivas = asignacionesLectivas.reduce((sum, a) => sum + a.horasAsignadas, 0);
        const totalPreparacion = preparacionExistente.reduce((sum, c) => sum + c.horas, 0) + input.horas;

        if (totalPreparacion > totalLectivas * 0.5) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: `Preparación y Evaluación excede 50% de horas lectivas (${totalPreparacion}h > ${Math.floor(totalLectivas * 0.5)}h)`,
          });
        }
      }

      return ctx.prisma.cargaNoLectiva.create({
        data: input,
        include: { docente: { select: { id: true, nombre: true } } },
      });
    }),

  update: docenteProcedure
    .input(z.object({
      id: z.string(),
      horas: z.number().int().min(1).optional(),
      descripcion: z.string().optional(),
      codigoProyecto: z.string().optional(),
      nombreProyecto: z.string().optional(),
      numAlumnos: z.number().int().optional(),
      cicloConsejeria: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const existing = await ctx.prisma.cargaNoLectiva.findUniqueOrThrow({ where: { id } });

      if (existing.tipo === 'PREPARACION_EVALUACION' && data.horas) {
        const asignacionesLectivas = await ctx.prisma.asignacionCargaLectiva.findMany({
          where: { docenteId: existing.docenteId, periodoId: existing.periodoId },
        });
        const otrasPreparacion = await ctx.prisma.cargaNoLectiva.findMany({
          where: { docenteId: existing.docenteId, periodoId: existing.periodoId, tipo: 'PREPARACION_EVALUACION', id: { not: id } },
        });
        const totalLectivas = asignacionesLectivas.reduce((sum, a) => sum + a.horasAsignadas, 0);
        const totalPreparacion = otrasPreparacion.reduce((sum, c) => sum + c.horas, 0) + data.horas;

        if (totalPreparacion > totalLectivas * 0.5) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: `Preparación y Evaluación excede 50% de horas lectivas`,
          });
        }
      }

      return ctx.prisma.cargaNoLectiva.update({
        where: { id },
        data,
        include: { docente: { select: { id: true, nombre: true } } },
      });
    }),

  delete: docenteProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.cargaNoLectiva.delete({ where: { id: input.id } });
    }),
});
