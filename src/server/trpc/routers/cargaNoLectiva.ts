import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { createTRPCRouter, docenteProcedure, protectedProcedure } from '../init';
import type { Prisma, PrismaClient } from '@/generated/prisma/client';
import { academicManagerRoles, departmentScopedRoles, getManagedDepartamentoIds, hasRole, assertFacultyPeriodNotPublished } from '../policy';
import {
  calculateSlotHours,
  validateNonLectiveSchedule,
  validatePeriodMutable,
  type HorarioSlot,
} from '@/server/services/workload-validator';

const horarioInput = z.object({
  dia: z.enum(['LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO']),
  horaInicio: z.string(), // "07:00"
  horaFin: z.string(),    // "11:00"
  lugar: z.string().optional(),
  aula: z.string().optional(),
});

const cargaNoLectivaInput = z.object({
  tipo: z.enum([
    'PREPARACION_EVALUACION', 'CONSEJERIA', 'INVESTIGACION',
    'CAPACITACION', 'GOBIERNO', 'ADMINISTRACION',
    'ASESORIA_TESIS', 'RESPONSABILIDAD_SOCIAL', 'COMITES_COMISIONES',
    'JURADOS', 'AUTOEVALUACION_ACREDITACION', 'OTRAS_AUTORIZADAS'
  ]),
  horas: z.number().int().min(1),
  descripcion: z.string().optional(),
  codigoProyecto: z.string().optional(),
  nombreProyecto: z.string().optional(),
  numAlumnos: z.number().int().optional(),
  cicloConsejeria: z.string().optional(),
  horarios: z.array(horarioInput).optional(),
});

const includeHorarios = {
  docente: { select: { id: true, nombre: true, email: true } },
  periodo: { select: { id: true, nombre: true } },
  horarios: {
    orderBy: [{ dia: 'asc' as const }, { horaInicio: 'asc' as const }],
  },
};

type HorarioInput = z.infer<typeof horarioInput>;

function slotFromHorario(horario: Pick<HorarioSlot, 'dia' | 'horaInicio' | 'horaFin'>): HorarioSlot {
  return {
    dia: horario.dia,
    horaInicio: horario.horaInicio,
    horaFin: horario.horaFin,
    horas: calculateSlotHours(horario),
  };
}

function slotFromFranja(franja: { dia: string; horaInicio: string; horaFin: string }): HorarioSlot {
  return {
    dia: franja.dia,
    horaInicio: franja.horaInicio,
    horaFin: franja.horaFin,
    horas: calculateSlotHours(franja),
  };
}

async function assertPeriodoMutable(prisma: PrismaClient, periodoId: string) {
  const periodo = await prisma.periodoAcademico.findUniqueOrThrow({
    where: { id: periodoId },
    select: { estado: true },
  });
  const result = validatePeriodMutable(periodo.estado);
  if (!result.valid) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: result.message });
  }
}

async function assertNonLectiveScheduleIntegrity(
  prisma: PrismaClient,
  docenteId: string,
  periodoId: string,
  horarios: HorarioInput[] | undefined,
  excludeCargaNoLectivaId?: string
) {
  if (!horarios || horarios.length === 0) return;

  const [lectiveAssignments, preasignaciones, existingNonLectiveLoads] = await Promise.all([
    prisma.asignacion.findMany({
      where: { docenteId, periodoId },
      include: { franjaHoraria: true },
    }),
    prisma.preasignacion.findMany({
      where: { docenteId, periodoId },
      include: { franjaHoraria: true },
    }),
    prisma.cargaNoLectiva.findMany({
      where: {
        docenteId,
        periodoId,
        ...(excludeCargaNoLectivaId ? { id: { not: excludeCargaNoLectivaId } } : {}),
      },
      include: { horarios: true },
    }),
  ]);

  const existingSlots = [
    ...lectiveAssignments.map((assignment) => slotFromFranja(assignment.franjaHoraria)),
    ...preasignaciones.map((pre) => slotFromFranja(pre.franjaHoraria)),
    ...existingNonLectiveLoads.flatMap((load) => load.horarios.map(slotFromHorario)),
  ];
  const result = validateNonLectiveSchedule(existingSlots, horarios.map(slotFromHorario));

  if (!result.valid) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: result.message });
  }
}

export const cargaNoLectivaRouter = createTRPCRouter({
  list: protectedProcedure
    .input(
      z.object({
        docenteId: z.string().optional(),
        periodoId: z.string().optional(),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      const where: Prisma.CargaNoLectivaWhereInput = {};
      if (input?.docenteId) where.docenteId = input.docenteId;
      if (input?.periodoId) where.periodoId = input.periodoId;

      if (ctx.session.role === 'DOCENTE') {
        if (!ctx.session.docenteId) {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'El usuario docente no tiene un ID de docente asociado.' });
        }
        if (input?.docenteId && input.docenteId !== ctx.session.docenteId) {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'No tiene permiso para ver cargas no lectivas de otro docente' });
        }
        where.docenteId = ctx.session.docenteId;
      } else if (hasRole(ctx.session, departmentScopedRoles)) {
        const managedDepartamentoIds = await getManagedDepartamentoIds(ctx.prisma, ctx.session);
        where.docente = { departamentoId: { in: managedDepartamentoIds ?? [] } };
      } else if (!hasRole(ctx.session, academicManagerRoles)) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'No tiene permiso para listar cargas no lectivas' });
      }

      return ctx.prisma.cargaNoLectiva.findMany({
        where,
        include: includeHorarios,
        orderBy: { createdAt: 'desc' },
      });
    }),

  byDocente: docenteProcedure
    .input(z.object({ docenteId: z.string(), periodoId: z.string() }))
    .query(async ({ ctx, input }) => {
      if (ctx.session.role === 'DOCENTE' && ctx.session.docenteId !== input.docenteId) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'No tiene permiso para ver cargas no lectivas de otro docente' });
      }

      const [cargas, asignacionesLectivas] = await Promise.all([
        ctx.prisma.cargaNoLectiva.findMany({
          where: { docenteId: input.docenteId, periodoId: input.periodoId },
          include: { horarios: { orderBy: [{ dia: 'asc' }, { horaInicio: 'asc' }] } },
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
      if (ctx.session.role === 'DOCENTE' && ctx.session.docenteId !== input.docenteId) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'No tiene permiso para crear cargas no lectivas para otro docente' });
      }

      await assertFacultyPeriodNotPublished(ctx.prisma, { docenteId: input.docenteId, periodoId: input.periodoId });
      const { horarios, ...cargaData } = input;
      await assertPeriodoMutable(ctx.prisma, input.periodoId);
      await assertNonLectiveScheduleIntegrity(ctx.prisma, input.docenteId, input.periodoId, horarios);

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
        data: {
          ...cargaData,
          horarios: horarios && horarios.length > 0
            ? { create: horarios }
            : undefined,
        },
        include: includeHorarios,
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
      horarios: z.array(horarioInput).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, horarios, ...data } = input;
      const existing = await ctx.prisma.cargaNoLectiva.findUniqueOrThrow({ where: { id } });
      await assertFacultyPeriodNotPublished(ctx.prisma, { docenteId: existing.docenteId, periodoId: existing.periodoId });

      if (ctx.session.role === 'DOCENTE' && ctx.session.docenteId !== existing.docenteId) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'No tiene permiso para actualizar cargas no lectivas de otro docente' });
      }
      await assertPeriodoMutable(ctx.prisma, existing.periodoId);
      await assertNonLectiveScheduleIntegrity(ctx.prisma, existing.docenteId, existing.periodoId, horarios, id);

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

      // Transaction: update carga + replace horarios
      return ctx.prisma.$transaction(async (tx) => {
        // If horarios are provided, replace them (delete old → create new)
        if (horarios !== undefined) {
          await tx.horarioCargaNoLectiva.deleteMany({ where: { cargaNoLectivaId: id } });
          if (horarios.length > 0) {
            await tx.horarioCargaNoLectiva.createMany({
              data: horarios.map((h) => ({ ...h, cargaNoLectivaId: id })),
            });
          }
        }

        return tx.cargaNoLectiva.update({
          where: { id },
          data,
          include: includeHorarios,
        });
      });
    }),

  delete: docenteProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.prisma.cargaNoLectiva.findUniqueOrThrow({ where: { id: input.id } });
      await assertFacultyPeriodNotPublished(ctx.prisma, { docenteId: existing.docenteId, periodoId: existing.periodoId });
      if (ctx.session.role === 'DOCENTE' && ctx.session.docenteId !== existing.docenteId) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'No tiene permiso para eliminar cargas no lectivas de otro docente' });
      }
      await assertPeriodoMutable(ctx.prisma, existing.periodoId);
      return ctx.prisma.cargaNoLectiva.delete({ where: { id: input.id } });
    }),

  /**
   * Asigna (o reemplaza) las franjas horarias de una carga no lectiva. Pensado
   * para que el docente pueda, desde "Mi horario personal", asignar la franja
   * horaria de una actividad registrada sin horario (o editar las existentes).
   *
   * Si `horarios` está vacío, se eliminan todos los horarios de la actividad.
   * Si se pasan horarios, reemplazan a los anteriores (deleteMany + createMany).
   *
   * La validación de solapamientos y horas diarias se delega a
   * `assertNonLectiveScheduleIntegrity`, que ya considera carga lectiva,
   * preasignaciones y otras cargas no lectivas del mismo docente/período.
   */
  asignarHorario: docenteProcedure
    .input(z.object({
      cargaNoLectivaId: z.string(),
      horarios: z.array(horarioInput),
    }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.prisma.cargaNoLectiva.findUniqueOrThrow({
        where: { id: input.cargaNoLectivaId },
      });
      await assertFacultyPeriodNotPublished(ctx.prisma, {
        docenteId: existing.docenteId,
        periodoId: existing.periodoId,
      });

      if (ctx.session.role === 'DOCENTE' && ctx.session.docenteId !== existing.docenteId) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'No tiene permiso para asignar horario a una carga no lectiva de otro docente',
        });
      }
      await assertPeriodoMutable(ctx.prisma, existing.periodoId);
      await assertNonLectiveScheduleIntegrity(
        ctx.prisma,
        existing.docenteId,
        existing.periodoId,
        input.horarios.length > 0 ? input.horarios : undefined,
        existing.id // excluir la propia carga del chequeo de solapamientos
      );

      // Transaction: reemplazar horarios (delete old → create new)
      return ctx.prisma.$transaction(async (tx) => {
        await tx.horarioCargaNoLectiva.deleteMany({
          where: { cargaNoLectivaId: existing.id },
        });
        if (input.horarios.length > 0) {
          await tx.horarioCargaNoLectiva.createMany({
            data: input.horarios.map((h) => ({
              ...h,
              cargaNoLectivaId: existing.id,
            })),
          });
        }

        return tx.cargaNoLectiva.findUniqueOrThrow({
          where: { id: existing.id },
          include: includeHorarios,
        });
      });
    }),

  removeHorario: docenteProcedure
    .input(z.object({ horarioId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const horario = await ctx.prisma.horarioCargaNoLectiva.findUniqueOrThrow({
        where: { id: input.horarioId },
        include: { cargaNoLectiva: { select: { docenteId: true, periodoId: true } } },
      });

      await assertFacultyPeriodNotPublished(ctx.prisma, {
        docenteId: horario.cargaNoLectiva.docenteId,
        periodoId: horario.cargaNoLectiva.periodoId,
      });

      if (ctx.session.role === 'DOCENTE' && ctx.session.docenteId !== horario.cargaNoLectiva.docenteId) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'No tiene permiso para eliminar horarios de otro docente',
        });
      }
      await assertPeriodoMutable(ctx.prisma, horario.cargaNoLectiva.periodoId);

      return ctx.prisma.horarioCargaNoLectiva.delete({ where: { id: input.horarioId } });
    }),
});
