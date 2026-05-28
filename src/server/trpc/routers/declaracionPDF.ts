import { z } from 'zod';
import { createTRPCRouter, baseProcedure } from '../init';
import { renderPDF } from '@/server/services/reports';
import {
  templateFormatoN1,
  templateFormatoN2,
  templateFormatoN3,
} from '@/server/services/reports/declaracion-templates';

export const declaracionPDFRouter = createTRPCRouter({
  generate: baseProcedure
    .input(z.object({
      declaracionId: z.string(),
      formato: z.enum(['N1', 'N2', 'N3']),
    }))
    .mutation(async ({ ctx, input }) => {
      const declaracion = await ctx.prisma.declaracionCarga.findUniqueOrThrow({
        where: { id: input.declaracionId },
        include: {
          docente: {
            select: {
              id: true, nombre: true, dni: true, codigoIBM: true,
              categoria: true, modalidad: true,
              departamento: { select: { nombre: true, facultad: { select: { nombre: true } } } },
            },
          },
          periodo: { select: { nombre: true } },
        },
      });

      const [asignaciones, cargasNoLectivas] = await Promise.all([
        ctx.prisma.asignacionCargaLectiva.findMany({
          where: { docenteId: declaracion.docenteId, periodoId: declaracion.periodoId },
          include: { grupo: { include: { curso: { select: { codigo: true, nombre: true } } } } },
          orderBy: { grupo: { curso: { codigo: 'asc' } } },
        }),
        ctx.prisma.cargaNoLectiva.findMany({
          where: { docenteId: declaracion.docenteId, periodoId: declaracion.periodoId },
          orderBy: { tipo: 'asc' },
        }),
      ]);

      const totalLectivas = asignaciones.reduce((sum, a) => sum + a.horasAsignadas, 0);
      const totalNoLectivas = cargasNoLectivas.reduce((sum, c) => sum + c.horas, 0);
      const departamento = declaracion.docente.departamento?.nombre || '';
      const facultad = declaracion.docente.departamento?.facultad?.nombre || '';

      let html = '';
      if (input.formato === 'N1') {
        html = templateFormatoN1({
          docente: {
            nombre: declaracion.docente.nombre,
            dni: declaracion.docente.dni,
            categoria: declaracion.docente.categoria,
            modalidad: declaracion.docente.modalidad,
          },
          periodo: declaracion.periodo.nombre,
          facultad,
          departamento,
          asignaciones: asignaciones.map((a) => ({
            cursoCodigo: a.grupo.curso.codigo,
            cursoNombre: a.grupo.curso.nombre,
            grupo: a.grupo.nombre,
            tipo: a.tipo,
            horas: a.horasAsignadas,
          })),
          cargasNoLectivas: cargasNoLectivas.map((c) => ({
            tipo: c.tipo,
            horas: c.horas,
            descripcion: c.descripcion,
          })),
          totalLectivas,
          totalNoLectivas,
        });
      } else if (input.formato === 'N2') {
        html = templateFormatoN2({
          docente: { nombre: declaracion.docente.nombre, dni: declaracion.docente.dni, codigoIBM: declaracion.docente.codigoIBM },
          periodo: declaracion.periodo.nombre,
          facultad,
          departamento,
          modalidad: declaracion.docente.modalidad,
        });
      } else {
        html = templateFormatoN3({
          docente: { nombre: declaracion.docente.nombre, dni: declaracion.docente.dni, codigoIBM: declaracion.docente.codigoIBM },
          periodo: declaracion.periodo.nombre,
          facultad,
          departamento,
          modalidad: declaracion.docente.modalidad,
        });
      }

      const pdfBuffer = await renderPDF(html, { landscape: false });
      return {
        pdfBase64: pdfBuffer.toString('base64'),
        filename: `Declaracion_${input.formato}_${declaracion.docente.nombre.replace(/\s+/g, '_')}_${declaracion.periodo.nombre}.pdf`,
      };
    }),
});
