import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import {
  createTRPCRouter,
  baseProcedure,
  protectedProcedure,
  secretariaDepartamentoProcedure,
  directorDepartamentoProcedure,
} from '../init';
import { validateAll } from '@/server/services/workload-validator';

const assignInput = z.object({
  docenteId: z.string().min(1),
  grupoId: z.string().min(1),
  periodoId: z.string().min(1),
  tipo: z.enum(['TEORIA', 'PRACTICA', 'LABORATORIO']),
  horasAsignadas: z.number().int().min(1).max(40),
  compartido: z.boolean().optional().default(false),
  docenteCompartidoId: z.string().optional(),
});

export const cargaLectivaRouter = createTRPCRouter({
  list: baseProcedure
    .input(
      z.object({
        periodoId: z.string().optional(),
        departamentoId: z.string().optional(),
        docenteId: z.string().optional(),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      const where: Record<string, unknown> = {};
      if (input?.periodoId) where.periodoId = input.periodoId;
      if (input?.docenteId) where.docenteId = input.docenteId;
      if (input?.departamentoId) {
        where.docente = { departamentoId: input.departamentoId };
      }

      return ctx.prisma.asignacionCargaLectiva.findMany({
        where,
        include: {
          docente: { select: { id: true, nombre: true, email: true, categoria: true, modalidad: true, horasContrato: true } },
          grupo: { include: { curso: { select: { id: true, codigo: true, nombre: true, creditos: true, horasTeoria: true, horasPractica: true, horasLaboratorio: true, ciclo: true } } } },
          periodo: { select: { id: true, nombre: true } },
          docenteCompartido: { select: { id: true, nombre: true } },
        },
        orderBy: { createdAt: 'desc' },
      });
    }),

  byDocente: protectedProcedure
    .input(z.object({ docenteId: z.string(), periodoId: z.string() }))
    .query(async ({ ctx, input }) => {
      const [asignaciones, cargaNoLectiva] = await Promise.all([
        ctx.prisma.asignacionCargaLectiva.findMany({
          where: { docenteId: input.docenteId, periodoId: input.periodoId },
          include: {
            grupo: { include: { curso: { select: { codigo: true, nombre: true } } } },
            docenteCompartido: { select: { id: true, nombre: true } },
          },
          orderBy: { createdAt: 'asc' },
        }),
        ctx.prisma.cargaNoLectiva.findMany({
          where: { docenteId: input.docenteId, periodoId: input.periodoId },
        }),
      ]);

      const totalLectivas = asignaciones.reduce((sum, a) => sum + a.horasAsignadas, 0);
      const totalNoLectivas = cargaNoLectiva.reduce((sum, c) => sum + c.horas, 0);

      return {
        asignaciones,
        cargaNoLectiva,
        totalLectivas,
        totalNoLectivas,
        totalGeneral: totalLectivas + totalNoLectivas,
      };
    }),

  assign: secretariaDepartamentoProcedure
    .input(assignInput)
    .mutation(async ({ ctx, input }) => {
      const validation = await validateAll(
        ctx.prisma,
        input.docenteId,
        input.periodoId,
        input.horasAsignadas,
        input.tipo
      );
      if (!validation.valid) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: validation.message });
      }

      try {
        return await ctx.prisma.asignacionCargaLectiva.create({
          data: input,
          include: {
            docente: { select: { id: true, nombre: true } },
            grupo: { include: { curso: { select: { codigo: true, nombre: true } } } },
            docenteCompartido: { select: { id: true, nombre: true } },
          },
        });
      } catch (error: unknown) {
        if (error && typeof error === 'object' && 'code' in error && (error as { code: string }).code === 'P2002') {
          throw new TRPCError({ code: 'CONFLICT', message: 'Asignación duplicada: ya existe este docente-grupo-tipo para el periodo' });
        }
        throw error;
      }
    }),

  unassign: secretariaDepartamentoProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.asignacionCargaLectiva.delete({ where: { id: input.id } });
    }),

  update: secretariaDepartamentoProcedure
    .input(
      z.object({
        id: z.string(),
        horasAsignadas: z.number().int().min(1).max(40).optional(),
        compartido: z.boolean().optional(),
        docenteCompartidoId: z.string().nullable().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const existing = await ctx.prisma.asignacionCargaLectiva.findUniqueOrThrow({ where: { id } });

      if (data.horasAsignadas !== undefined) {
        const validation = await validateAll(
          ctx.prisma,
          existing.docenteId,
          existing.periodoId,
          data.horasAsignadas - existing.horasAsignadas,
          existing.tipo
        );
        if (!validation.valid) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: validation.message });
        }
      }

      return ctx.prisma.asignacionCargaLectiva.update({
        where: { id },
        data,
        include: {
          docente: { select: { id: true, nombre: true } },
          grupo: { include: { curso: { select: { codigo: true, nombre: true } } } },
        },
      });
    }),

  resumenPorDepartamento: baseProcedure
    .input(z.object({ periodoId: z.string(), departamentoId: z.string() }))
    .query(async ({ ctx, input }) => {
      const docentes = await ctx.prisma.docente.findMany({
        where: { departamentoId: input.departamentoId, activo: true },
        select: {
          id: true,
          nombre: true,
          email: true,
          categoria: true,
          modalidad: true,
          horasContrato: true,
          asignacionesCarga: {
            where: { periodoId: input.periodoId },
            include: {
              grupo: { include: { curso: { select: { codigo: true, nombre: true } } } },
            },
          },
          cargasNoLectivas: {
            where: { periodoId: input.periodoId },
          },
        },
        orderBy: { nombre: 'asc' },
      });

      return docentes.map((d) => {
        const totalLectivas = d.asignacionesCarga.reduce((sum, a) => sum + a.horasAsignadas, 0);
        const totalNoLectivas = d.cargasNoLectivas.reduce((sum, c) => sum + c.horas, 0);
        return {
          docenteId: d.id,
          nombre: d.nombre,
          email: d.email,
          categoria: d.categoria,
          modalidad: d.modalidad,
          horasContrato: d.horasContrato,
          totalLectivas,
          totalNoLectivas,
          totalGeneral: totalLectivas + totalNoLectivas,
          porcentajeCubierto: d.horasContrato > 0 ? Math.round(((totalLectivas + totalNoLectivas) / d.horasContrato) * 100) : 0,
          asignaciones: d.asignacionesCarga,
          cargasNoLectivas: d.cargasNoLectivas,
        };
      });
    }),
});
