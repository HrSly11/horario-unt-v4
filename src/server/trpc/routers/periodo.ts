import { z } from 'zod';
import { createTRPCRouter, baseProcedure, adminProcedure, directorProcedure, academicManagerProcedure } from '../init';

const periodoInput = z.object({
  nombre: z.string().min(3, 'El nombre es obligatorio (ej: 2026-I)'),
  fechaInicio: z.coerce.date(),
  fechaFin: z.coerce.date(),
  activo: z.boolean().optional().default(false),
  estado: z.enum(['PLANIFICACION', 'POSTULACION', 'ASIGNACION', 'REVISION', 'APROBADO', 'FINALIZADO']).optional(),
});

export const periodoRouter = createTRPCRouter({
  list: baseProcedure.query(async ({ ctx }) => {
    return ctx.prisma.periodoAcademico.findMany({
      include: {
        _count: { select: { grupos: true, asignaciones: true } },
      },
      orderBy: { fechaInicio: 'desc' },
    });
  }),

  active: baseProcedure.query(async ({ ctx }) => {
    return ctx.prisma.periodoAcademico.findFirst({
      where: { activo: true },
    });
  }),

  byId: baseProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.periodoAcademico.findUniqueOrThrow({
        where: { id: input.id },
        include: {
          grupos: {
            include: { curso: true },
            orderBy: { curso: { ciclo: 'asc' } },
          },
        },
      });
    }),

  create: academicManagerProcedure.input(periodoInput).mutation(async ({ ctx, input }) => {
    if (input.activo) {
      // Finalizar el periodo activo actual
      await ctx.prisma.periodoAcademico.updateMany({
        where: { activo: true },
        data: { activo: false, estado: 'FINALIZADO' },
      });
    }
    return ctx.prisma.periodoAcademico.create({ data: input });
  }),

  update: academicManagerProcedure
    .input(z.object({ id: z.string() }).merge(periodoInput))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      
      if (data.activo) {
        // Finalizar otros periodos activos
        await ctx.prisma.periodoAcademico.updateMany({
          where: { activo: true, id: { not: id } },
          data: { activo: false, estado: 'FINALIZADO' },
        });
      }

      return ctx.prisma.periodoAcademico.update({ where: { id }, data });
    }),

  delete: academicManagerProcedure.input(z.object({ id: z.string() })).mutation(({ ctx, input }) => {
    return ctx.prisma.periodoAcademico.delete({ where: { id: input.id } });
  }),

  toggleActive: academicManagerProcedure
    .input(z.object({ id: z.string(), activo: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      if (input.activo) {
        // Finalizar el periodo activo actual
        await ctx.prisma.periodoAcademico.updateMany({
          where: { activo: true },
          data: { activo: false, estado: 'FINALIZADO' },
        });
      }
      return ctx.prisma.periodoAcademico.update({
        where: { id: input.id },
        data: { activo: input.activo },
      });
    }),

  /** Director starts the process: Planificación -> Postulación (Disponibilidad) */
  startAssignmentProcess: directorProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const periodo = await ctx.prisma.periodoAcademico.update({
        where: { id: input.id },
        data: { estado: 'POSTULACION' } // Use POSTULACION as the availability entry phase
      });

      // 1. Notify all active teachers to enter availability
      const docentes = await ctx.prisma.docente.findMany({ where: { activo: true } });
      await ctx.prisma.notification.createMany({
        data: docentes.map(d => ({
          docenteId: d.id,
          titulo: 'Ingreso de Disponibilidad',
          mensaje: `Se ha iniciado el proceso para el periodo ${periodo.nombre}. Por favor, registre su disponibilidad horaria.`,
          tipo: 'INFO',
          link: '/disponibilidad'
        }))
      });

      // 2. Notify secretary to prepare for assignment
      // (Optional: search for secretary user and create log/notification if secretary model exists, 
      // but usually secretary is just a role in User model. We'll use logs for now)
      await ctx.prisma.log.create({
        data: {
          userId: ctx.session?.id || 'SYSTEM',
          accion: 'START_PROCESS',
          detalles: `Proceso de asignación iniciado para el periodo ${periodo.nombre}`
        }
      });

      return periodo;
    }),

  getWorkflowProgress: baseProcedure.query(async ({ ctx }) => {
    const activePeriod = await ctx.prisma.periodoAcademico.findFirst({
      where: { activo: true },
    });

    if (!activePeriod) {
      return null;
    }

    const prismaAny = ctx.prisma as any;

    // Step 1: Demanda Académica de Escuela
    const demandaEscuela = await prismaAny.demandaAcademica.findFirst({
      where: { periodoId: activePeriod.id },
      select: { id: true, estado: true, escuela: { select: { nombre: true } } },
    });

    // Step 2: Demanda de Departamento
    const step2Active = demandaEscuela?.estado === 'APROBADA';

    // Step 3: Carga Lectiva (Distribución)
    const distribucionLectiva = await prismaAny.distribucionLectiva.findFirst({
      where: { periodoId: activePeriod.id },
      select: { id: true, estado: true },
    });

    // Step 4: Horarios y Preliminares (ProcesoHorarioEscuela)
    const procesoHorario = await prismaAny.procesoHorarioEscuela.findFirst({
      where: { periodoId: activePeriod.id },
      select: { id: true, estado: true },
    });

    // Step 5: Carga No Lectiva
    const cargaNoLectivaCount = await ctx.prisma.cargaNoLectiva.count({
      where: { periodoId: activePeriod.id },
    });

    // Step 6: Declaraciones
    const totalDeclaraciones = await ctx.prisma.declaracionCarga.count({
      where: { periodoId: activePeriod.id },
    });
    const finalizadasDeclaraciones = await ctx.prisma.declaracionCarga.count({
      where: { periodoId: activePeriod.id, estado: 'FINALIZADA' },
    });

    const publicacionFinal = await prismaAny.publicacionAcademica.findFirst({
      where: { periodoId: activePeriod.id },
    });

    return {
      periodo: {
        id: activePeriod.id,
        nombre: activePeriod.nombre,
        estado: activePeriod.estado,
      },
      pasos: {
        paso1: {
          completado: demandaEscuela?.estado === 'APROBADA',
          estado: demandaEscuela?.estado ?? 'PENDIENTE',
          escuela: demandaEscuela?.escuela?.nombre ?? null,
        },
        paso2: {
          completado: step2Active,
          estado: step2Active ? 'ACTIVO' : 'PENDIENTE',
        },
        paso3: {
          completado: distribucionLectiva?.estado === 'APROBADA',
          estado: distribucionLectiva?.estado ?? 'PENDIENTE',
        },
        paso4: {
          completado: procesoHorario?.estado === 'PUBLICADO_PRELIMINAR' || procesoHorario?.estado === 'APROBADO',
          estado: procesoHorario?.estado ?? 'PENDIENTE',
        },
        paso5: {
          completado: cargaNoLectivaCount > 0,
          count: cargaNoLectivaCount,
          estado: cargaNoLectivaCount > 0 ? 'EN_PROGRESO' : 'PENDIENTE',
        },
        paso6: {
          completado: !!publicacionFinal,
          estado: publicacionFinal ? 'PUBLICADO' : 'PENDIENTE',
          totalDeclaraciones,
          finalizadasDeclaraciones,
        },
      },
    };
  }),

  // ── Franjas Horarias ──────────────────────────
  franjas: baseProcedure.query(async ({ ctx }) => {
    return ctx.prisma.franjaHoraria.findMany({
      orderBy: [{ dia: 'asc' }, { numeroBloque: 'asc' }],
    });
  }),
});
