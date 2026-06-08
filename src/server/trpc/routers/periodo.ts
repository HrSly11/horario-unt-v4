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

  // ── Franjas Horarias ──────────────────────────
  franjas: baseProcedure.query(async ({ ctx }) => {
    return ctx.prisma.franjaHoraria.findMany({
      orderBy: [{ dia: 'asc' }, { numeroBloque: 'asc' }],
    });
  }),
});
