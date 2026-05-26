import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { createTRPCRouter, adminProcedure, protectedProcedure, secretariaProcedure, directorProcedure, baseProcedure } from '../init';
import {
  renderPDF,
  generateAulaReportHTML,
  generateDocenteReportHTML,
  generateManagementReportHTML,
  generateCicloReportHTML,
} from '@/server/services/reports';

export const reporteRouter = createTRPCRouter({
  /** Generate PDF report — returns base64-encoded PDF */
  generatePDF: baseProcedure
    .input(z.object({
      periodoId: z.string(),
      tipo: z.enum(['por-aula', 'por-laboratorio', 'por-docente', 'por-ciclo', 'gestion']),
      docenteId: z.string().optional(), // For specific docente report
      aulaId: z.string().optional(),    // For specific aula report
      ciclo: z.number().optional(),      // For specific ciclo report
    }))
    .mutation(async ({ ctx, input }) => {
      const role = ctx.session?.role;
      const isPrivileged = role === 'ADMIN' || role === 'SECRETARIA_ACADEMICA' || role === 'DIRECTOR_ESCUELA';

      const periodo = await ctx.prisma.periodoAcademico.findUniqueOrThrow({
        where: { id: input.periodoId },
        select: { id: true, nombre: true, fechaInicio: true, fechaFin: true, estado: true }
      });

      const isPublished = periodo.estado === 'APROBADO' || periodo.estado === 'FINALIZADO';

      if (!isPrivileged && !isPublished) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'El horario aún no ha sido publicado',
        });
      }

      if (input.tipo === 'gestion' && !isPrivileged) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'No tiene permisos para generar reportes de gestión',
        });
      }

      if (!isPrivileged && role === 'DOCENTE') {
        if (input.tipo !== 'por-docente') {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'No tiene permisos para generar este reporte',
          });
        }
        if (input.docenteId && input.docenteId !== ctx.session?.docenteId) {
           throw new TRPCError({
             code: 'FORBIDDEN',
             message: 'No tiene permisos para ver el horario de otro docente',
           });
        }
      }

      try {

        const assignmentFilter = (!isPrivileged && !isPublished) ? { confirmado: true } : {};

        let html = '';
        const options = { landscape: true };

      if (input.tipo === 'por-aula' || input.tipo === 'por-laboratorio') {
        const whereClause: any = {};
        if (input.aulaId) {
          whereClause.id = input.aulaId;
        } else if (input.tipo === 'por-laboratorio') {
          whereClause.tipo = 'LABORATORIO';
        }

        const aulas = await ctx.prisma.aula.findMany({
          where: whereClause,
          include: {
            asignaciones: {
              where: { periodoId: input.periodoId, ...assignmentFilter },
              include: {
                grupo: { include: { curso: true } },
                docente: true,
                franjaHoraria: true,
              },
            },
          },
        });

        // Filter out aulas with no assignments if we're generating a batch report
        const aulasWithAssignments = input.aulaId 
          ? aulas 
          : aulas.filter(aula => aula.asignaciones.length > 0);

        if (aulasWithAssignments.length === 0) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'No hay asignaciones registradas para los ambientes seleccionados',
          });
        }

        const reportData = aulasWithAssignments.map(aula => ({
          aulaCodigo: aula.codigo,
          aulaNombre: aula.nombre,
          tipo: aula.tipo,
          capacidad: aula.capacidad,
          slots: aula.asignaciones.map(a => ({
            dia: a.franjaHoraria.dia,
            horaInicio: a.franjaHoraria.horaInicio,
            cursoCodigo: a.grupo.curso.codigo,
            cursoNombre: a.grupo.curso.nombre,
            grupoNombre: a.grupo.nombre,
            docenteNombre: a.docente.nombre,
            docenteCodigo: a.docente.codigo || undefined,
            aulaCodigo: aula.codigo,
            aulaNombre: aula.nombre,
            tipo: a.tipo as any,
            ciclo: a.grupo.curso.ciclo,
            horasTeoria: a.grupo.curso.horasTeoria,
            horasPractica: 0,
            horasLaboratorio: a.grupo.curso.horasLaboratorio,
          })),
        }));

        html = generateAulaReportHTML(reportData, periodo.nombre);
      } else if (input.tipo === 'por-ciclo') {
        const asignaciones = await ctx.prisma.asignacion.findMany({
          where: { periodoId: input.periodoId, ...assignmentFilter },
          include: {
            grupo: { include: { curso: true } },
            docente: true,
            aula: true,
            franjaHoraria: true,
          },
          orderBy: [
            { grupo: { curso: { ciclo: 'asc' } } },
            { grupo: { nombre: 'asc' } }
          ]
        });

        const reportData: any[] = [];
        
        const uniqueCiclos = [...new Set(asignaciones.map(a => a.grupo.curso.ciclo))].sort((a, b) => a - b);
        
        for (const ciclo of uniqueCiclos) {
          if (input.ciclo && ciclo !== input.ciclo) continue;

          const asignacionesCiclo = asignaciones.filter(a => a.grupo.curso.ciclo === ciclo);
          const secciones = [...new Set(asignacionesCiclo.map(a => a.grupo.nombre))].sort();

          for (const seccion of secciones) {
            const slots = asignacionesCiclo
              .filter(a => a.grupo.nombre === seccion)
              .map(a => ({
                dia: a.franjaHoraria.dia,
                horaInicio: a.franjaHoraria.horaInicio,
                cursoCodigo: a.grupo.curso.codigo,
                cursoNombre: a.grupo.curso.nombre,
                grupoNombre: seccion,
                docenteNombre: a.docente.nombre,
                aulaCodigo: a.aula.codigo,
                aulaNombre: a.aula.nombre,
                tipo: a.tipo,
                ciclo: ciclo,
                horasTeoria: a.grupo.curso.horasTeoria,
                horasPractica: 0,
                horasLaboratorio: a.grupo.curso.horasLaboratorio,
              }));

            if (slots.length > 0) {
              reportData.push({
                ciclo,
                seccion,
                periodoNombre: periodo.nombre,
                fechaInicio: periodo.fechaInicio.toLocaleDateString('es-PE'),
                fechaFin: periodo.fechaFin.toLocaleDateString('es-PE'),
                slots,
              });
            }
          }
        }

        if (reportData.length === 0) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'No hay asignaciones registradas para generar el reporte de ciclos',
          });
        }

        html = generateCicloReportHTML(reportData, periodo.nombre);
      } else if (input.tipo === 'por-docente') {
        const docentes = await ctx.prisma.docente.findMany({
          where: input.docenteId ? { id: input.docenteId } : { activo: true },
          include: {
            asignaciones: {
              where: { periodoId: input.periodoId, ...assignmentFilter },
              include: {
                grupo: { include: { curso: true } },
                aula: true,
                franjaHoraria: true,
              },
            },
          },
        });

        const reportData = docentes
          .filter(d => d.asignaciones.length > 0)
          .map(d => {
            // VALIDATION: Check for overlaps in docente schedule
            const slotsSet = new Set();
            for (const a of d.asignaciones) {
              const key = `${a.franjaHoraria.dia}-${a.franjaHoraria.horaInicio}`;
              if (slotsSet.has(key)) {
                throw new TRPCError({
                  code: 'CONFLICT',
                  message: `Conflicto detectado para docente ${d.nombre}: Cruce de horario en ${key}`,
                });
              }
              slotsSet.add(key);
            }

            return {
              docenteNombre: d.nombre,
              docenteCodigo: d.codigo || undefined,
              tipo: d.tipo,
              categoria: d.categoria,
              antiguedad: d.antiguedad.toLocaleDateString('es-PE'),
              slots: d.asignaciones.map(a => ({
                dia: a.franjaHoraria.dia,
                horaInicio: a.franjaHoraria.horaInicio,
                cursoCodigo: a.grupo.curso.codigo,
                cursoNombre: a.grupo.curso.nombre,
                grupoNombre: a.grupo.nombre,
                docenteNombre: d.nombre,
                aulaCodigo: a.aula.codigo,
                aulaNombre: a.aula.nombre,
                tipo: a.tipo as any,
                ciclo: a.grupo.curso.ciclo,
                horasTeoria: a.grupo.curso.horasTeoria,
                horasPractica: 0,
                horasLaboratorio: a.grupo.curso.horasLaboratorio,
              })),
            };
          });

        html = generateDocenteReportHTML(reportData, periodo.nombre);
      } else if (input.tipo === 'gestion') {
        const [totalDocentes, docentesConCarga, totalGrupos, gruposAsignados, asignaciones, aulas, franjasCount] = await Promise.all([
          ctx.prisma.docente.count({ where: { activo: true } }),
          ctx.prisma.asignacion.groupBy({
            by: ['docenteId'],
            where: { periodoId: input.periodoId },
          }),
          ctx.prisma.grupo.count({ where: { periodoAcademicoId: input.periodoId } }),
          ctx.prisma.asignacion.groupBy({
            by: ['grupoId'],
            where: { periodoId: input.periodoId },
          }),
          ctx.prisma.asignacion.findMany({
            where: { periodoId: input.periodoId },
            include: { docente: true, aula: true },
          }),
          ctx.prisma.aula.findMany({
            include: {
              asignaciones: {
                where: { periodoId: input.periodoId },
              },
            },
          }),
          ctx.prisma.franjaHoraria.count(),
        ]);

        const cargaDocente = await ctx.prisma.docente.findMany({
          where: { activo: true },
          include: {
            asignaciones: {
              where: { periodoId: input.periodoId },
            },
          },
        });

        const reportData = {
          periodoNombre: periodo.nombre,
          totalDocentes,
          docentesConCarga: docentesConCarga.length,
          totalGrupos,
          gruposAsignados: gruposAsignados.length,
          totalAsignaciones: asignaciones.length,
          asignacionesConfirmadas: asignaciones.length, // Or use a confirmed field if exists
          cargaDocente: cargaDocente.map(d => ({
            nombre: d.nombre,
            tipo: d.tipo,
            categoria: d.categoria,
            horasAsignadas: d.asignaciones.length,
          })),
          ocupacionAulas: aulas.map(a => ({
            codigo: a.codigo,
            tipo: a.tipo,
            slotsOcupados: a.asignaciones.length,
            totalSlots: franjasCount,
            ocupacion: franjasCount > 0 ? Math.round((a.asignaciones.length / franjasCount) * 100) : 0,
          })),
        };

        html = generateManagementReportHTML(reportData);
      }

      const pdfBuffer = await renderPDF(html, options);
        return { pdf: pdfBuffer.toString('base64'), filename: `reporte-${input.tipo}.pdf` };
      } catch (error: any) {
        console.error('Error generating PDF:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message || 'Error al generar el reporte PDF',
        });
      }
    }),

  porCiclo: baseProcedure
    .input(z.object({ periodoId: z.string() }))
    .query(async ({ ctx, input }) => {
      const periodo = await ctx.prisma.periodoAcademico.findUnique({
        where: { id: input.periodoId },
        select: { estado: true }
      });

      const role = ctx.session?.role;
      const isPrivileged = role === 'ADMIN' || role === 'SECRETARIA_ACADEMICA' || role === 'DIRECTOR_ESCUELA';
      const isPublished = periodo?.estado === 'APROBADO' || periodo?.estado === 'FINALIZADO';

      if (!isPrivileged && !isPublished) {
        return [];
      }

      const assignmentFilter = (!isPrivileged && !isPublished) ? { confirmado: true } : {};

      return ctx.prisma.asignacion.findMany({
        where: { periodoId: input.periodoId, ...assignmentFilter },
        include: {
          docente: true,
          aula: true,
          grupo: { include: { curso: true } },
          franjaHoraria: true,
        },
        orderBy: [
          { franjaHoraria: { dia: 'asc' } },
          { franjaHoraria: { horaInicio: 'asc' } }
        ]
      });
    }),
});
