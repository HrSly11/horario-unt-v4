import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { createTRPCRouter, protectedProcedure } from '../init';
import { DiaSemana } from '@/generated/prisma/client';

const diaSemanaSchema = z.enum(['LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO']);

const bloqueSchema = z.object({
  id: z.string().optional(),
  tipoOrigen: z.enum(['lectiva', 'no_lectiva']),
  origenId: z.string(),
  subtipo: z.string().nullable().optional(),
  diaSemana: diaSemanaSchema,
  horaInicio: z.string().regex(/^\d{2}:\d{2}$/),
  horaFin: z.string().regex(/^\d{2}:\d{2}$/),
});

function horaToMinutes(h: string): number {
  const [hh, mm] = h.split(':').map(Number);
  return hh * 60 + mm;
}

function overlap(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return horaToMinutes(aStart) < horaToMinutes(bEnd) && horaToMinutes(bStart) < horaToMinutes(aEnd);
}

export const horarioBloqueRouter = createTRPCRouter({
  /** Obtener bloques de un docente para un periodo */
  list: protectedProcedure
    .input(z.object({
      docenteId: z.string(),
      periodoId: z.string(),
    }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.horarioBloque.findMany({
        where: { docenteId: input.docenteId, periodoId: input.periodoId },
        orderBy: [{ diaSemana: 'asc' }, { horaInicio: 'asc' }],
      });
    }),

  /** Obtener todos los bloques de un periodo (para validación cross-docente) */
  listAllByPeriodo: protectedProcedure
    .input(z.object({ periodoId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.horarioBloque.findMany({
        where: { periodoId: input.periodoId },
        include: { docente: { select: { id: true, nombre: true } } },
        orderBy: [{ diaSemana: 'asc' }, { horaInicio: 'asc' }],
      });
    }),

  /** Guardar todos los bloques (reemplazo completo) */
  save: protectedProcedure
    .input(z.object({
      docenteId: z.string(),
      periodoId: z.string(),
      bloques: z.array(bloqueSchema),
    }))
    .mutation(async ({ ctx, input }) => {
      const { docenteId, periodoId, bloques } = input;

      // Validar no-solapamiento entre los bloques enviados
      for (let i = 0; i < bloques.length; i++) {
        for (let j = i + 1; j < bloques.length; j++) {
          const a = bloques[i];
          const b = bloques[j];
          if (a.diaSemana === b.diaSemana && overlap(a.horaInicio, a.horaFin, b.horaInicio, b.horaFin)) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: `Conflicto de horario: dos bloques se solapan el ${a.diaSemana} entre ${a.horaInicio}-${a.horaFin} y ${b.horaInicio}-${b.horaFin}`,
            });
          }
        }
      }

      // Validar que la duración de los bloques no use más horas de las que permite `horaInicio` y `horaFin`
      for (const b of bloques) {
        const start = horaToMinutes(b.horaInicio);
        const end = horaToMinutes(b.horaFin);
        if (end <= start) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: `Hora fin (${b.horaFin}) debe ser mayor a hora inicio (${b.horaInicio})` });
        }
        if (start < 420 || end > 1320) { // 07:00 - 22:00
          throw new TRPCError({ code: 'BAD_REQUEST', message: `El horario debe estar entre 07:00 y 22:00` });
        }
      }

      // Verificar horas declaradas - validar no exceder lo registrado
      for (const b of bloques) {
        const duracionBloque = (horaToMinutes(b.horaFin) - horaToMinutes(b.horaInicio)) / 60;

        if (b.tipoOrigen === 'lectiva') {
          const asignacion = await ctx.prisma.asignacionCargaLectiva.findUnique({
            where: { id: b.origenId },
          });
          if (!asignacion) {
            throw new TRPCError({ code: 'BAD_REQUEST', message: `Asignación lectiva ${b.origenId} no encontrada` });
          }
          // Sumar horas ya colocadas para este origen (excluyendo el bloque actual si es edición)
          const otrosBloques = bloques.filter(bl => bl.origenId === b.origenId && bl.id !== b.id);
          const horasYaColocadas = otrosBloques.reduce((sum, bl) => {
            return sum + (horaToMinutes(bl.horaFin) - horaToMinutes(bl.horaInicio)) / 60;
          }, 0);
          if (horasYaColocadas + duracionBloque > asignacion.horasAsignadas) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: `Excede las horas lectivas declaradas: ${horasYaColocadas + duracionBloque}h > ${asignacion.horasAsignadas}h`,
            });
          }
        } else {
          const cargaNoLectiva = await ctx.prisma.cargaNoLectiva.findUnique({
            where: { id: b.origenId },
          });
          if (!cargaNoLectiva) {
            throw new TRPCError({ code: 'BAD_REQUEST', message: `Carga no lectiva ${b.origenId} no encontrada` });
          }
          const otrosBloques = bloques.filter(bl => bl.origenId === b.origenId && bl.id !== b.id);
          const horasYaColocadas = otrosBloques.reduce((sum, bl) => {
            return sum + (horaToMinutes(bl.horaFin) - horaToMinutes(bl.horaInicio)) / 60;
          }, 0);
          if (horasYaColocadas + duracionBloque > cargaNoLectiva.horas) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: `Excede las horas no lectivas declaradas: ${horasYaColocadas + duracionBloque}h > ${cargaNoLectiva.horas}h`,
            });
          }
        }
      }

      // ── Validar solapamiento con otros docentes ──
      for (const b of bloques) {
        const conflicto = await ctx.prisma.horarioBloque.findFirst({
          where: {
            periodoId,
            diaSemana: b.diaSemana as DiaSemana,
            docenteId: { not: docenteId }, // otros docentes
            AND: [
              { horaInicio: { lt: b.horaFin } },
              { horaFin: { gt: b.horaInicio } },
            ],
          },
          include: { docente: { select: { nombre: true } } },
        });
        if (conflicto) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: `Conflicto con ${conflicto.docente.nombre}: ${b.diaSemana} ${b.horaInicio}-${b.horaFin} ya está ocupado por otro docente`,
          });
        }
      }

      return ctx.prisma.$transaction(async (tx) => {
        // Eliminar bloques existentes del docente y periodo
        await tx.horarioBloque.deleteMany({
          where: { docenteId, periodoId },
        });

        // Insertar nuevos bloques
        if (bloques.length > 0) {
          await tx.horarioBloque.createMany({
            data: bloques.map((b) => ({
              docenteId,
              periodoId,
              tipoOrigen: b.tipoOrigen,
              origenId: b.origenId,
              subtipo: b.subtipo ?? null,
              diaSemana: b.diaSemana as DiaSemana,
              horaInicio: b.horaInicio,
              horaFin: b.horaFin,
            })),
          });
        }

        return { success: true };
      });
    }),
});
