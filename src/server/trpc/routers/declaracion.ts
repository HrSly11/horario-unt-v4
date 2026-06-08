import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import type { Prisma } from '@/generated/prisma/client';
import {
  createTRPCRouter,
  protectedProcedure,
  docenteProcedure,
  directorDepartamentoProcedure,
  directorProcedure,
  decanoProcedure,
} from '../init';
import {
  assertCanAccessDepartamento,
  assertCanAccessDocenteDepartamento,
  assertDocenteSelfOrRole,
  getManagedDepartamentoIds,
  hasRole,
} from '../policy';
import { validateCargaCompleta } from '@/server/services/workload-validator';
import { writeAuditLog } from '@/server/services/audit';

const validTransitions: Record<string, string[]> = {
  BORRADOR: ['ENVIADA'],
  ENVIADA: ['APROBADA_DEPARTAMENTO', 'RECHAZADA'],
  APROBADA_DEPARTAMENTO: ['APROBADA_ESCUELA', 'RECHAZADA'],
  APROBADA_ESCUELA: ['FINALIZADA', 'RECHAZADA'],
  RECHAZADA: ['BORRADOR'],
  FINALIZADA: [],
};

const signatureTypeInput = z.enum([
  'DECLARACION_JURADA',
  'DECLARACION_SEDES',
  'APROBACION_DEPARTAMENTO',
  'APROBACION_ESCUELA',
  'VISTO_BUENO_DECANO',
  'REPORTE_FINAL',
]);

const signatureInput = z.object({
  declaracionId: z.string(),
  tipo: signatureTypeInput,
  documentoHash: z.string().regex(/^[a-f0-9]{64}$/i, 'Debe ser un hash SHA-256 hexadecimal'),
  algoritmoHash: z.string().default('SHA-256'),
  certificadoSerial: z.string().min(1),
  certificadoEmisor: z.string().min(1),
  firmaPayload: z.string().min(1),
  cadenaCustodia: z.record(z.string(), z.unknown()).optional(),
});

function legacySignatureFlag(tipo: z.infer<typeof signatureTypeInput>) {
  if (tipo === 'DECLARACION_JURADA') return { declaracionJuradaFirmada: true };
  if (tipo === 'DECLARACION_SEDES') return { declaracionSedesFirmada: true };
  return {};
}

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
      const where: Prisma.DeclaracionCargaWhereInput = {};
      if (input?.periodoId) where.periodoId = input.periodoId;
      if (input?.estado) where.estado = input.estado;
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

      return ctx.prisma.declaracionCarga.findMany({
        where,
        include: {
          docente: { select: { id: true, nombre: true, email: true, departamentoId: true, horasContrato: true } },
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
      if (ctx.session.role !== 'DOCENTE') {
        await assertCanAccessDocenteDepartamento(ctx.prisma, ctx.session, declaracion.docenteId);
      }

      return declaracion;
    }),

  byDocente: protectedProcedure
    .input(z.object({ docenteId: z.string(), periodoId: z.string() }))
    .query(async ({ ctx, input }) => {
      assertDocenteSelfOrRole(ctx.session, input.docenteId);
      if (ctx.session.role !== 'DOCENTE') {
        await assertCanAccessDocenteDepartamento(ctx.prisma, ctx.session, input.docenteId);
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
      assertDocenteSelfOrRole(ctx.session, input.docenteId, ['ADMIN']);

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

  updateTotals: docenteProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const declaracion = await ctx.prisma.declaracionCarga.findUniqueOrThrow({ where: { id: input.id } });
      
      if (ctx.session.role === 'DOCENTE' && ctx.session.docenteId !== declaracion.docenteId) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'No tiene permiso para actualizar esta declaración' });
      }

      if (declaracion.estado !== 'BORRADOR' && declaracion.estado !== 'RECHAZADA') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Solo se pueden actualizar los totales en estado BORRADOR o RECHAZADA' });
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
          totalHorasLectivas: totalLectivas,
          totalHorasNoLectivas: totalNoLectivas,
          totalHoras: totalLectivas + totalNoLectivas,
        },
        include: { docente: { select: { id: true, nombre: true, horasContrato: true } } },
      });
    }),

  delete: docenteProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const declaracion = await ctx.prisma.declaracionCarga.findUniqueOrThrow({ where: { id: input.id } });

      if (ctx.session.role === 'DOCENTE' && ctx.session.docenteId !== declaracion.docenteId) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'No tiene permiso para eliminar esta declaración' });
      }

      if (declaracion.estado !== 'BORRADOR' && declaracion.estado !== 'RECHAZADA') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Solo se pueden eliminar declaraciones en estado BORRADOR o RECHAZADA' });
      }

      await writeAuditLog(ctx.prisma, {
        session: ctx.session,
        headers: ctx.headers,
        accion: 'DECLARACION_ELIMINADA',
        entidad: 'DeclaracionCarga',
        entidadId: input.id,
        antes: { estado: declaracion.estado, totalHoras: declaracion.totalHoras },
        despues: null,
      });

      return ctx.prisma.declaracionCarga.delete({ where: { id: input.id } });
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
      assertDocenteSelfOrRole(ctx.session, declaracion.docenteId, ['ADMIN']);

      const [asignaciones, cargas, docente] = await Promise.all([
        ctx.prisma.asignacionCargaLectiva.findMany({ where: { docenteId: declaracion.docenteId, periodoId: declaracion.periodoId } }),
        ctx.prisma.cargaNoLectiva.findMany({ where: { docenteId: declaracion.docenteId, periodoId: declaracion.periodoId } }),
        ctx.prisma.docente.findUniqueOrThrow({
          where: { id: declaracion.docenteId },
          select: { horasContrato: true },
        }),
      ]);

      const totalLectivas = asignaciones.reduce((sum, a) => sum + a.horasAsignadas, 0);
      const totalNoLectivas = cargas.reduce((sum, c) => sum + c.horas, 0);
      const completeResult = validateCargaCompleta(totalLectivas, totalNoLectivas, docente.horasContrato);
      if (!completeResult.valid) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: completeResult.message });
      }

      const updated = await ctx.prisma.declaracionCarga.update({
        where: { id: input.id },
        data: {
          estado: 'ENVIADA',
          totalHorasLectivas: totalLectivas,
          totalHorasNoLectivas: totalNoLectivas,
          totalHoras: totalLectivas + totalNoLectivas,
        },
        include: { docente: { select: { id: true, nombre: true } } },
      });

      await writeAuditLog(ctx.prisma, {
        session: ctx.session,
        headers: ctx.headers,
        accion: 'DECLARACION_ENVIADA',
        entidad: 'DeclaracionCarga',
        entidadId: input.id,
        antes: { estado: declaracion.estado },
        despues: {
          estado: updated.estado,
          totalHorasLectivas: totalLectivas,
          totalHorasNoLectivas: totalNoLectivas,
          totalHoras: totalLectivas + totalNoLectivas,
        },
      });

      return updated;
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

      const updated = await ctx.prisma.declaracionCarga.update({
        where: { id: input.id },
        data: {
          estado: 'APROBADA_DEPARTAMENTO',
          aprobadoDepartamentoId: ctx.session.id,
          fechaAprobacionDepto: new Date(),
        },
        include: { docente: { select: { id: true, nombre: true } } },
      });

      await writeAuditLog(ctx.prisma, {
        session: ctx.session,
        headers: ctx.headers,
        accion: 'DECLARACION_APROBADA_DEPARTAMENTO',
        entidad: 'DeclaracionCarga',
        entidadId: input.id,
        antes: { estado: declaracion.estado },
        despues: { estado: updated.estado, aprobadoDepartamentoId: ctx.session.id },
      });

      return updated;
    }),

  aprobarEscuela: directorProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const declaracion = await ctx.prisma.declaracionCarga.findUniqueOrThrow({ where: { id: input.id } });
      if (declaracion.estado !== 'APROBADA_DEPARTAMENTO') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Debe estar aprobada por departamento primero' });
      }
      const updated = await ctx.prisma.declaracionCarga.update({
        where: { id: input.id },
        data: {
          estado: 'APROBADA_ESCUELA',
          aprobadoEscuelaId: ctx.session.id,
          fechaAprobacionEscuela: new Date(),
        },
        include: { docente: { select: { id: true, nombre: true } } },
      });

      await writeAuditLog(ctx.prisma, {
        session: ctx.session,
        headers: ctx.headers,
        accion: 'DECLARACION_APROBADA_ESCUELA',
        entidad: 'DeclaracionCarga',
        entidadId: input.id,
        antes: { estado: declaracion.estado },
        despues: { estado: updated.estado, aprobadoEscuelaId: ctx.session.id },
      });

      return updated;
    }),

  vbDecano: decanoProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const declaracion = await ctx.prisma.declaracionCarga.findUniqueOrThrow({ where: { id: input.id } });
      if (declaracion.estado !== 'APROBADA_ESCUELA') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Debe estar aprobada por escuela primero' });
      }
      const updated = await ctx.prisma.declaracionCarga.update({
        where: { id: input.id },
        data: {
          estado: 'FINALIZADA',
          vistoBuenoDecanoId: ctx.session.id,
          fechaVistoBueno: new Date(),
        },
        include: { docente: { select: { id: true, nombre: true } } },
      });

      await writeAuditLog(ctx.prisma, {
        session: ctx.session,
        headers: ctx.headers,
        accion: 'DECLARACION_FINALIZADA_DECANO',
        entidad: 'DeclaracionCarga',
        entidadId: input.id,
        antes: { estado: declaracion.estado },
        despues: { estado: updated.estado, vistoBuenoDecanoId: ctx.session.id },
      });

      return updated;
    }),

  rechazar: protectedProcedure
    .input(z.object({ id: z.string(), observaciones: z.string().min(1, 'Debe indicar el motivo del rechazo') }))
    .mutation(async ({ ctx, input }) => {
      if (!hasRole(ctx.session, ['ADMIN', 'DIRECTOR_DEPARTAMENTO', 'DIRECTOR_ESCUELA', 'DECANO'])) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'No tiene permiso para rechazar declaraciones' });
      }

      const declaracion = await ctx.prisma.declaracionCarga.findUniqueOrThrow({
        where: { id: input.id },
        include: { docente: true }
      });
      if (declaracion.estado === 'FINALIZADA') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'No se puede rechazar una declaración finalizada' });
      }
      if (!['ENVIADA', 'APROBADA_DEPARTAMENTO', 'APROBADA_ESCUELA'].includes(declaracion.estado)) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'La declaración no está en un estado rechazable' });
      }

      if (ctx.session.role === 'DIRECTOR_DEPARTAMENTO' && declaracion.estado !== 'ENVIADA') {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'El director de departamento solo rechaza declaraciones enviadas' });
      }
      if (ctx.session.role === 'DIRECTOR_ESCUELA' && declaracion.estado !== 'APROBADA_DEPARTAMENTO') {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'El director de escuela solo rechaza declaraciones aprobadas por departamento' });
      }
      if (ctx.session.role === 'DECANO' && declaracion.estado !== 'APROBADA_ESCUELA') {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'El decano solo rechaza declaraciones aprobadas por escuela' });
      }

      if (ctx.session.role === 'DIRECTOR_DEPARTAMENTO') {
        const departamento = await ctx.prisma.departamento.findUnique({
          where: { directorId: ctx.session.id }
        });
        if (!departamento || departamento.id !== declaracion.docente.departamentoId) {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'No tiene permiso para rechazar declaraciones de docentes fuera de su departamento' });
        }
      }

      const updated = await ctx.prisma.declaracionCarga.update({
        where: { id: input.id },
        data: { estado: 'RECHAZADA', observaciones: input.observaciones },
        include: { docente: { select: { id: true, nombre: true } } },
      });

      await writeAuditLog(ctx.prisma, {
        session: ctx.session,
        headers: ctx.headers,
        accion: 'DECLARACION_RECHAZADA',
        entidad: 'DeclaracionCarga',
        entidadId: input.id,
        antes: { estado: declaracion.estado },
        despues: { estado: updated.estado, observaciones: input.observaciones },
        motivo: input.observaciones,
      });

      return updated;
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
      assertDocenteSelfOrRole(ctx.session, declaracion.docenteId, ['ADMIN']);

      const updated = await ctx.prisma.declaracionCarga.update({
        where: { id: input.id },
        data: { estado: 'BORRADOR', observaciones: null },
        include: { docente: { select: { id: true, nombre: true } } },
      });

      await writeAuditLog(ctx.prisma, {
        session: ctx.session,
        headers: ctx.headers,
        accion: 'DECLARACION_REABIERTA',
        entidad: 'DeclaracionCarga',
        entidadId: input.id,
        antes: { estado: declaracion.estado, observaciones: declaracion.observaciones },
        despues: { estado: updated.estado, observaciones: null },
      });

      return updated;
    }),

  registrarFirma: protectedProcedure
    .input(signatureInput)
    .mutation(async ({ ctx, input }) => {
      const declaracion = await ctx.prisma.declaracionCarga.findUniqueOrThrow({
        where: { id: input.declaracionId },
        include: { docente: true },
      });

      if (input.tipo === 'DECLARACION_JURADA' || input.tipo === 'DECLARACION_SEDES') {
        assertDocenteSelfOrRole(ctx.session, declaracion.docenteId, ['ADMIN']);
      } else if (input.tipo === 'APROBACION_DEPARTAMENTO') {
        if (!hasRole(ctx.session, ['ADMIN', 'DIRECTOR_DEPARTAMENTO'])) {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'No tiene permiso para firmar aprobación de departamento' });
        }
        if (ctx.session.role === 'DIRECTOR_DEPARTAMENTO') {
          const departamento = await ctx.prisma.departamento.findUnique({
            where: { directorId: ctx.session.id },
          });
          if (!departamento || departamento.id !== declaracion.docente.departamentoId) {
            throw new TRPCError({ code: 'FORBIDDEN', message: 'No puede firmar declaraciones fuera de su departamento' });
          }
        }
      } else if (input.tipo === 'APROBACION_ESCUELA') {
        if (!hasRole(ctx.session, ['ADMIN', 'DIRECTOR_ESCUELA'])) {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'No tiene permiso para firmar aprobación de escuela' });
        }
      } else if (input.tipo === 'VISTO_BUENO_DECANO') {
        if (!hasRole(ctx.session, ['ADMIN', 'DECANO'])) {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'No tiene permiso para firmar visto bueno de decano' });
        }
      } else if (!hasRole(ctx.session, ['ADMIN', 'SECRETARIA_ACADEMICA', 'DIRECTOR_ESCUELA', 'DECANO'])) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'No tiene permiso para firmar reportes finales' });
      }

      const latest = await ctx.prisma.documentoFirmaDigital.findFirst({
        where: { declaracionId: input.declaracionId, tipo: input.tipo },
        select: { version: true },
        orderBy: { version: 'desc' },
      });
      const version = (latest?.version ?? 0) + 1;

      const firma = await ctx.prisma.$transaction(async (tx) => {
        const firma = await tx.documentoFirmaDigital.create({
          data: {
            declaracionId: input.declaracionId,
            tipo: input.tipo,
            documentoHash: input.documentoHash.toLowerCase(),
            algoritmoHash: input.algoritmoHash,
            certificadoSerial: input.certificadoSerial,
            certificadoEmisor: input.certificadoEmisor,
            firmaPayload: input.firmaPayload,
            firmadoPorId: ctx.session.id,
            version,
            cadenaCustodia: input.cadenaCustodia as Prisma.InputJsonValue | undefined,
          },
          include: {
            firmadoPor: { select: { id: true, nombre: true, role: true } },
          },
        });

        const legacyFlags = legacySignatureFlag(input.tipo);
        if (Object.keys(legacyFlags).length > 0) {
          await tx.declaracionCarga.update({
            where: { id: input.declaracionId },
            data: legacyFlags,
          });
        }

        return firma;
      });

      await writeAuditLog(ctx.prisma, {
        session: ctx.session,
        headers: ctx.headers,
        accion: 'FIRMA_DIGITAL_REGISTRADA',
        entidad: 'DocumentoFirmaDigital',
        entidadId: firma.id,
        despues: {
          declaracionId: input.declaracionId,
          tipo: input.tipo,
          documentoHash: input.documentoHash.toLowerCase(),
          version,
          firmadoPorId: ctx.session.id,
        },
      });

      return firma;
    }),

  firmas: protectedProcedure
    .input(z.object({ declaracionId: z.string() }))
    .query(async ({ ctx, input }) => {
      const declaracion = await ctx.prisma.declaracionCarga.findUniqueOrThrow({
        where: { id: input.declaracionId },
        select: { docenteId: true },
      });
      await assertCanAccessDocenteDepartamento(ctx.prisma, ctx.session, declaracion.docenteId);

      return ctx.prisma.documentoFirmaDigital.findMany({
        where: { declaracionId: input.declaracionId },
        include: {
          firmadoPor: { select: { id: true, nombre: true, role: true } },
        },
        orderBy: [
          { tipo: 'asc' },
          { version: 'desc' },
        ],
      });
    }),

  pendientes: protectedProcedure
    .query(async ({ ctx }) => {
      const role = ctx.session.role;
      if (role === 'DIRECTOR_DEPARTAMENTO') {
        const managedDepartamentoIds = await getManagedDepartamentoIds(ctx.prisma, ctx.session);
        return ctx.prisma.declaracionCarga.findMany({
          where: { estado: 'ENVIADA', docente: { departamentoId: { in: managedDepartamentoIds ?? [] } } },
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
