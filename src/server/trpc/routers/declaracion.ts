import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import {
  createTRPCRouter,
  baseProcedure,
  protectedProcedure,
  docenteProcedure,
  directorDepartamentoProcedure,
  directorProcedure,
  decanoProcedure,
} from '../init';

const validTransitions: Record<string, string[]> = {
  BORRADOR: ['ENVIADA'],
  ENVIADA: ['APROBADA_DEPARTAMENTO', 'RECHAZADA'],
  APROBADA_DEPARTAMENTO: ['APROBADA_ESCUELA', 'RECHAZADA'],
  APROBADA_ESCUELA: ['FINALIZADA', 'RECHAZADA'],
  RECHAZADA: ['BORRADOR'],
  FINALIZADA: [],
};

export const declaracionRouter = createTRPCRouter({
  list: protectedProcedure
    .input(
      z.object({
        periodoId: z.string().optional(),
        estado: z.enum(['BORRADOR', 'ENVIADA', 'APROBADA_DEPARTAMENTO', 'APROBADA_ESCUELA', 'RECHAZADA', 'FINALIZADA']).optional(),
        departamentoId: z.string().optional(),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      const where: Record<string, any> = {};
      if (input?.periodoId) where.periodoId = input.periodoId;
      if (input?.estado) where.estado = input.estado;
      if (input?.departamentoId) {
        where.docente = { departamentoId: input.departamentoId };
      }

      if (ctx.session.role === 'DOCENTE') {
        if (!ctx.session.docenteId) {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'El usuario docente no tiene un ID de docente asociado.' });
        }
        where.docenteId = ctx.session.docenteId;
      }

      return ctx.prisma.declaracionCarga.findMany({
        where,
        include: {
          docente: { select: { id: true, nombre: true, email: true, departamentoId: true } },
          periodo: { select: { id: true, nombre: true } },
          aprobadorDepto: { select: { id: true, nombre: true } },
          aprobadorEscuela: { select: { id: true, nombre: true } },
          vbDecano: { select: { id: true, nombre: true } },
        },
        orderBy: { updatedAt: 'desc' },
      });
    }),

  byId: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const declaracion = await ctx.prisma.declaracionCarga.findUniqueOrThrow({
        where: { id: input.id },
        include: {
          docente: {
            select: {
              id: true, nombre: true, email: true, dni: true, codigoIBM: true,
              categoria: true, modalidad: true, horasContrato: true,
              departamento: { select: { id: true, nombre: true, facultad: { select: { nombre: true } } } },
            },
          },
          periodo: { select: { id: true, nombre: true } },
          aprobadorDepto: { select: { id: true, nombre: true } },
          aprobadorEscuela: { select: { id: true, nombre: true } },
          vbDecano: { select: { id: true, nombre: true } },
        },
      });

      if (ctx.session.role === 'DOCENTE' && ctx.session.docenteId !== declaracion.docenteId) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'No tiene permiso para ver esta declaración.' });
      }

      return declaracion;
    }),

  byDocente: docenteProcedure
    .input(z.object({ docenteId: z.string(), periodoId: z.string() }))
    .query(async ({ ctx, input }) => {
      if (ctx.session.role === 'DOCENTE' && ctx.session.docenteId !== input.docenteId) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'No tiene permiso para ver declaraciones de otro docente' });
      }

      return ctx.prisma.declaracionCarga.findUnique({
        where: { docenteId_periodoId: { docenteId: input.docenteId, periodoId: input.periodoId } },
        include: {
          docente: { select: { id: true, nombre: true, modalidad: true, horasContrato: true } },
          periodo: { select: { id: true, nombre: true } },
          aprobadorDepto: { select: { id: true, nombre: true } },
          aprobadorEscuela: { select: { id: true, nombre: true } },
          vbDecano: { select: { id: true, nombre: true } },
        },
      });
    }),

  create: docenteProcedure
    .input(z.object({ docenteId: z.string(), periodoId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.session.role === 'DOCENTE' && ctx.session.docenteId !== input.docenteId) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'No tiene permiso para crear declaraciones para otro docente' });
      }

      const existing = await ctx.prisma.declaracionCarga.findUnique({
        where: { docenteId_periodoId: { docenteId: input.docenteId, periodoId: input.periodoId } },
      });
      if (existing) throw new TRPCError({ code: 'CONFLICT', message: 'Ya existe una declaración para este periodo' });

      return ctx.prisma.declaracionCarga.create({
        data: {
          docenteId: input.docenteId,
          periodoId: input.periodoId,
          estado: 'BORRADOR',
        },
        include: { docente: { select: { id: true, nombre: true } }, periodo: { select: { id: true, nombre: true } } },
      });
    }),

  enviar: docenteProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const declaracion = await ctx.prisma.declaracionCarga.findUniqueOrThrow({ where: { id: input.id } });
      if (declaracion.estado !== 'BORRADOR' && declaracion.estado !== 'RECHAZADA') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Solo se puede enviar desde BORRADOR o RECHAZADA' });
      }
      if (ctx.session.role === 'DOCENTE' && ctx.session.docenteId !== declaracion.docenteId) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'No tiene permiso para enviar declaraciones de otro docente' });
      }

      const [asignaciones, cargas] = await Promise.all([
        ctx.prisma.asignacionCargaLectiva.findMany({ where: { docenteId: declaracion.docenteId, periodoId: declaracion.periodoId } }),
        ctx.prisma.cargaNoLectiva.findMany({ where: { docenteId: declaracion.docenteId, periodoId: declaracion.periodoId } }),
      ]);

      const totalLectivas = asignaciones.reduce((sum, a) => sum + a.horasAsignadas, 0);
      const totalNoLectivas = cargas.reduce((sum, c) => sum + c.horas, 0);

      return ctx.prisma.declaracionCarga.update({
        where: { id: input.id },
        data: {
          estado: 'ENVIADA',
          totalHorasLectivas: totalLectivas,
          totalHorasNoLectivas: totalNoLectivas,
          totalHoras: totalLectivas + totalNoLectivas,
        },
        include: { docente: { select: { id: true, nombre: true } } },
      });
    }),

  aprobarDepto: directorDepartamentoProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const declaracion = await ctx.prisma.declaracionCarga.findUniqueOrThrow({
        where: { id: input.id },
        include: { docente: true }
      });
      if (declaracion.estado !== 'ENVIADA') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Solo se puede aprobar desde ENVIADA' });
      }

      if (ctx.session.role === 'DIRECTOR_DEPARTAMENTO') {
        const departamento = await ctx.prisma.departamento.findUnique({
          where: { directorId: ctx.session.id }
        });
        if (!departamento || departamento.id !== declaracion.docente.departamentoId) {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'No tiene permiso para aprobar declaraciones de docentes fuera de su departamento' });
        }
      }

      return ctx.prisma.declaracionCarga.update({
        where: { id: input.id },
        data: {
          estado: 'APROBADA_DEPARTAMENTO',
          aprobadoDepartamentoId: ctx.session.id,
          fechaAprobacionDepto: new Date(),
        },
        include: { docente: { select: { id: true, nombre: true } } },
      });
    }),

  aprobarEscuela: directorProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const declaracion = await ctx.prisma.declaracionCarga.findUniqueOrThrow({ where: { id: input.id } });
      if (declaracion.estado !== 'APROBADA_DEPARTAMENTO') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Debe estar aprobada por departamento primero' });
      }
      return ctx.prisma.declaracionCarga.update({
        where: { id: input.id },
        data: {
          estado: 'APROBADA_ESCUELA',
          aprobadoEscuelaId: ctx.session.id,
          fechaAprobacionEscuela: new Date(),
        },
        include: { docente: { select: { id: true, nombre: true } } },
      });
    }),

  vbDecano: decanoProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const declaracion = await ctx.prisma.declaracionCarga.findUniqueOrThrow({ where: { id: input.id } });
      if (declaracion.estado !== 'APROBADA_ESCUELA') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Debe estar aprobada por escuela primero' });
      }
      return ctx.prisma.declaracionCarga.update({
        where: { id: input.id },
        data: {
          estado: 'FINALIZADA',
          vistoBuenoDecanoId: ctx.session.id,
          fechaVistoBueno: new Date(),
        },
        include: { docente: { select: { id: true, nombre: true } } },
      });
    }),

  rechazar: protectedProcedure
    .input(z.object({ id: z.string(), observaciones: z.string().min(1, 'Debe indicar el motivo del rechazo') }))
    .mutation(async ({ ctx, input }) => {
      const declaracion = await ctx.prisma.declaracionCarga.findUniqueOrThrow({
        where: { id: input.id },
        include: { docente: true }
      });
      if (declaracion.estado === 'FINALIZADA') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'No se puede rechazar una declaración finalizada' });
      }

      if (ctx.session.role === 'DIRECTOR_DEPARTAMENTO') {
        const departamento = await ctx.prisma.departamento.findUnique({
          where: { directorId: ctx.session.id }
        });
        if (!departamento || departamento.id !== declaracion.docente.departamentoId) {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'No tiene permiso para rechazar declaraciones de docentes fuera de su departamento' });
        }
      }

      return ctx.prisma.declaracionCarga.update({
        where: { id: input.id },
        data: { estado: 'RECHAZADA', observaciones: input.observaciones },
        include: { docente: { select: { id: true, nombre: true } } },
      });
    }),

  reabrir: docenteProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const declaracion = await ctx.prisma.declaracionCarga.findUniqueOrThrow({ where: { id: input.id } });
      if (declaracion.estado !== 'RECHAZADA') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Solo se puede reabrir una declaración rechazada' });
      }
      if (ctx.session.role === 'DOCENTE' && ctx.session.docenteId !== declaracion.docenteId) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'No tiene permiso para reabrir declaraciones de otro docente' });
      }

      return ctx.prisma.declaracionCarga.update({
        where: { id: input.id },
        data: { estado: 'BORRADOR', observaciones: null },
        include: { docente: { select: { id: true, nombre: true } } },
      });
    }),

  pendientes: protectedProcedure
    .query(async ({ ctx }) => {
      const role = ctx.session.role;
      if (role === 'DIRECTOR_DEPARTAMENTO') {
        return ctx.prisma.declaracionCarga.findMany({
          where: { estado: 'ENVIADA' },
          include: {
            docente: { select: { id: true, nombre: true, email: true } },
            periodo: { select: { id: true, nombre: true } },
          },
          orderBy: { updatedAt: 'asc' },
        });
      }
      if (role === 'DIRECTOR_ESCUELA') {
        return ctx.prisma.declaracionCarga.findMany({
          where: { estado: 'APROBADA_DEPARTAMENTO' },
          include: {
            docente: { select: { id: true, nombre: true, email: true } },
            periodo: { select: { id: true, nombre: true } },
          },
          orderBy: { updatedAt: 'asc' },
        });
      }
      if (role === 'DECANO') {
        return ctx.prisma.declaracionCarga.findMany({
          where: { estado: 'APROBADA_ESCUELA' },
          include: {
            docente: { select: { id: true, nombre: true, email: true } },
            periodo: { select: { id: true, nombre: true } },
          },
          orderBy: { updatedAt: 'asc' },
        });
      }
      return [];
    }),
});
