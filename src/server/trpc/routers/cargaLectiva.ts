import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import type { Prisma, PrismaClient, TipoAsignacion } from '@/generated/prisma/client';
import {
  createTRPCRouter,
  protectedProcedure,
  secretariaDepartamentoProcedure,
} from '../init';
import { validateAll, validatePeriodMutable } from '@/server/services/workload-validator';
import {
  assertCanAccessDepartamento,
  assertCanAccessDocenteDepartamento,
  getManagedDepartamentoIds,
} from '../policy';

const assignInput = z.object({
  docenteId: z.string().min(1),
  grupoId: z.string().min(1),
  periodoId: z.string().min(1),
  tipo: z.enum(['TEORIA', 'PRACTICA', 'LABORATORIO']),
  horasAsignadas: z.number().int().min(1).max(40),
  compartido: z.boolean().optional().default(false),
  docenteCompartidoId: z.string().optional(),
});

async function assertLectivePeriodMutable(prisma: PrismaClient, periodoId: string) {
  const periodo = await prisma.periodoAcademico.findUniqueOrThrow({
    where: { id: periodoId },
    select: { estado: true },
  });
  const result = validatePeriodMutable(periodo.estado, 'carga lectiva');
  if (!result.valid) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: result.message });
  }
}

async function assertGrupoBelongsToPeriodo(prisma: PrismaClient, grupoId: string, periodoId: string) {
  const grupo = await prisma.grupo.findUniqueOrThrow({
    where: { id: grupoId },
    select: { periodoAcademicoId: true },
  });

  if (grupo.periodoAcademicoId !== periodoId) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'El grupo no pertenece al periodo académico indicado',
    });
  }
}

async function assertUniqueGrupoPeriodoTipo(
  prisma: PrismaClient,
  input: { grupoId: string; periodoId: string; tipo: TipoAsignacion },
  excludeAsignacionId?: string
) {
  const existing = await prisma.asignacionCargaLectiva.findFirst({
    where: {
      grupoId: input.grupoId,
      periodoId: input.periodoId,
      tipo: input.tipo,
      ...(excludeAsignacionId ? { id: { not: excludeAsignacionId } } : {}),
    },
    select: {
      id: true,
      docente: { select: { nombre: true } },
    },
  });

  if (existing) {
    throw new TRPCError({
      code: 'CONFLICT',
      message: `El grupo ya tiene carga ${input.tipo} asignada para este periodo${existing.docente?.nombre ? ` a ${existing.docente.nombre}` : ''}`,
    });
  }
}

export const cargaLectivaRouter = createTRPCRouter({
  list: protectedProcedure
    .input(
      z.object({
        periodoId: z.string().optional(),
        departamentoId: z.string().optional(),
        docenteId: z.string().optional(),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      const where: Prisma.AsignacionCargaLectivaWhereInput = {};
      if (input?.periodoId) where.periodoId = input.periodoId;
      if (input?.docenteId) where.docenteId = input.docenteId;
      if (input?.departamentoId) {
        await assertCanAccessDepartamento(ctx.prisma, ctx.session, input.departamentoId);
        where.docente = { departamentoId: input.departamentoId };
      }

      if (ctx.session.role === 'DOCENTE') {
        if (!ctx.session.docenteId) {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'El usuario docente no tiene un ID de docente asociado.' });
        }
        where.docenteId = ctx.session.docenteId;
      } else if (!input?.departamentoId) {
        const managedDepartamentoIds = await getManagedDepartamentoIds(ctx.prisma, ctx.session);
        if (managedDepartamentoIds !== null) {
          where.docente = { departamentoId: { in: managedDepartamentoIds } };
        }
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
      if (ctx.session.role === 'DOCENTE' && ctx.session.docenteId !== input.docenteId) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'No tiene permiso para ver la carga lectiva de otro docente' });
      }
      if (ctx.session.role !== 'DOCENTE') {
        await assertCanAccessDocenteDepartamento(ctx.prisma, ctx.session, input.docenteId);
      }

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
      await assertCanAccessDocenteDepartamento(ctx.prisma, ctx.session, input.docenteId);
      await assertLectivePeriodMutable(ctx.prisma, input.periodoId);
      await assertGrupoBelongsToPeriodo(ctx.prisma, input.grupoId, input.periodoId);
      await assertUniqueGrupoPeriodoTipo(ctx.prisma, input);

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
          throw new TRPCError({ code: 'CONFLICT', message: 'Asignación duplicada: ya existe este grupo-periodo-tipo' });
        }
        throw error;
      }
    }),

  unassign: secretariaDepartamentoProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.prisma.asignacionCargaLectiva.findUniqueOrThrow({
        where: { id: input.id },
        select: { docenteId: true, periodoId: true },
      });
      await assertCanAccessDocenteDepartamento(ctx.prisma, ctx.session, existing.docenteId);
      await assertLectivePeriodMutable(ctx.prisma, existing.periodoId);

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
      await assertCanAccessDocenteDepartamento(ctx.prisma, ctx.session, existing.docenteId);
      await assertLectivePeriodMutable(ctx.prisma, existing.periodoId);
      await assertUniqueGrupoPeriodoTipo(
        ctx.prisma,
        {
          grupoId: existing.grupoId,
          periodoId: existing.periodoId,
          tipo: existing.tipo,
        },
        id
      );

      if (data.horasAsignadas !== undefined) {
        const validation = await validateAll(
          ctx.prisma,
          existing.docenteId,
          existing.periodoId,
          data.horasAsignadas,
          existing.tipo,
          { excludeAsignacionId: id }
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

  resumenPorDepartamento: protectedProcedure
    .input(z.object({ periodoId: z.string(), departamentoId: z.string() }))
    .query(async ({ ctx, input }) => {
      await assertCanAccessDepartamento(ctx.prisma, ctx.session, input.departamentoId);

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
