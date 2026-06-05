import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { createTRPCRouter, protectedProcedure } from '../init';
import { renderPDF } from '@/server/services/reports';
import {
  templateFormatoN1,
  templateFormatoN2,
  templateFormatoN3,
} from '@/server/services/reports/declaracion-templates';

const formatDate = (date?: Date | null) => {
  if (!date) return '';
  const d = new Date(date);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
};

export const declaracionPDFRouter = createTRPCRouter({
  generate: protectedProcedure
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
              id: true,
              nombre: true,
              dni: true,
              codigoIBM: true,
              categoria: true,
              modalidad: true,
              tipo: true,
              departamento: {
                select: {
                  nombre: true,
                  facultad: {
                    select: {
                      nombre: true,
                      escuelas: { select: { nombre: true } },
                    },
                  },
                },
              },
            },
          },
          periodo: { select: { nombre: true, fechaInicio: true, fechaFin: true } },
        },
      });

      if (ctx.session.role === 'DOCENTE' && ctx.session.docenteId !== declaracion.docenteId) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'No tiene permiso para generar el PDF de otro docente' });
      }

      const [asignaciones, cargasNoLectivas] = await Promise.all([
        ctx.prisma.asignacionCargaLectiva.findMany({
          where: { docenteId: declaracion.docenteId, periodoId: declaracion.periodoId },
          include: {
            grupo: {
              include: {
                curso: {
                  include: {
                    cursoCurriculas: {
                      include: {
                        curricula: {
                          include: {
                            escuela: {
                              select: { nombre: true },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          orderBy: { grupo: { curso: { codigo: 'asc' } } },
        }),
        ctx.prisma.cargaNoLectiva.findMany({
          where: { docenteId: declaracion.docenteId, periodoId: declaracion.periodoId },
          include: { horarios: true },
          orderBy: { tipo: 'asc' },
        }),
      ]);

      const totalLectivas = asignaciones.reduce((sum, a) => sum + a.horasAsignadas, 0);
      const totalNoLectivas = cargasNoLectivas.reduce((sum, c) => sum + c.horas, 0);
      const departamento = declaracion.docente.departamento?.nombre || '';
      const facultad = declaracion.docente.departamento?.facultad?.nombre || '';
      const docenteEscuela = declaracion.docente.departamento?.facultad?.escuelas[0]?.nombre || 'Ingeniería de Sistemas';

      let html = '';
      if (input.formato === 'N1') {
        const parts = declaracion.periodo.nombre.split('-');
        const anioAcademico = parts[0] || new Date().getFullYear().toString();
        const cicloSemestre = parts[1] || 'I';

        html = templateFormatoN1({
          docente: {
            nombre: declaracion.docente.nombre,
            dni: declaracion.docente.dni,
            codigoIBM: declaracion.docente.codigoIBM,
            categoria: declaracion.docente.categoria,
            tipo: declaracion.docente.tipo,
            modalidad: declaracion.docente.modalidad,
          },
          periodo: {
            nombre: declaracion.periodo.nombre,
            fechaInicio: formatDate(declaracion.periodo.fechaInicio),
            fechaFin: formatDate(declaracion.periodo.fechaFin),
          },
          anioAcademico,
          cicloSemestre,
          facultad,
          departamento,
          escuela: docenteEscuela,
          asignaciones: asignaciones.map((a) => {
            const escuelaProf = a.grupo.curso.cursoCurriculas[0]?.curricula?.escuela?.nombre || docenteEscuela;
            return {
              cursoCodigo: a.grupo.curso.codigo,
              cursoNombre: a.grupo.curso.nombre,
              grupo: a.grupo.nombre,
              seccion: a.grupo.seccion || 'A',
              escuelaProf,
              ciclo: a.grupo.curso.ciclo,
              numAlumnos: a.grupo.numAlumnos,
              horasTeoria: a.tipo === 'TEORIA' ? a.horasAsignadas : 0,
              horasPractica: a.tipo === 'PRACTICA' ? a.horasAsignadas : 0,
              horasLaboratorio: a.tipo === 'LABORATORIO' ? a.horasAsignadas : 0,
              tipo: a.tipo,
              horas: a.horasAsignadas,
            };
          }),
          cargasNoLectivas: cargasNoLectivas.map((c) => ({
            tipo: c.tipo,
            horas: c.horas,
            descripcion: c.descripcion,
            horarios: c.horarios.map((h) => ({
              dia: h.dia,
              horaInicio: h.horaInicio,
              horaFin: h.horaFin,
              lugar: h.lugar,
              aula: h.aula,
            })),
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
          tipo: declaracion.docente.tipo,
        });
      } else {
        html = templateFormatoN3({
          docente: { nombre: declaracion.docente.nombre, dni: declaracion.docente.dni, codigoIBM: declaracion.docente.codigoIBM },
          periodo: declaracion.periodo.nombre,
          facultad,
          departamento,
          modalidad: declaracion.docente.modalidad,
          tipo: declaracion.docente.tipo,
        });
      }

      const pdfBuffer = await renderPDF(html, { landscape: false });
      return {
        pdfBase64: pdfBuffer.toString('base64'),
        filename: `Declaracion_${input.formato}_${declaracion.docente.nombre.replace(/\s+/g, '_')}_${declaracion.periodo.nombre}.pdf`,
      };
    }),
});
