import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { createHash } from 'node:crypto';
import { createTRPCRouter, protectedProcedure } from '../init';
import type { Prisma, UserRole } from '@/generated/prisma/client';
import { academicManagerRoles, departmentScopedRoles, getManagedDepartamentoIds, hasRole } from '../policy';
import { writeAuditLog } from '@/server/services/audit';
import {
  renderPDF,
  generateAulaReportHTML,
  generateDocenteReportHTML,
  generateManagementReportHTML,
  generateCicloReportHTML,
  generateAuditReportHTML,
} from '@/server/services/reports';

const reportRoles: UserRole[] = [...academicManagerRoles, ...departmentScopedRoles, 'DOCENTE'];

function buildAssignmentWhere(
  periodoId: string,
  baseFilter: Prisma.AsignacionWhereInput,
  managedDepartamentoIds: string[] | null
): Prisma.AsignacionWhereInput {
  return {
    periodoId,
    ...baseFilter,
    ...(managedDepartamentoIds
      ? { docente: { departamentoId: { in: managedDepartamentoIds } } }
      : {}),
  };
}

function buildActiveDocenteWhere(managedDepartamentoIds: string[] | null): Prisma.DocenteWhereInput {
  return {
    activo: true,
    ...(managedDepartamentoIds
      ? { departamentoId: { in: managedDepartamentoIds } }
      : {}),
  };
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Error al generar el reporte PDF';
}

export const reporteRouter = createTRPCRouter({
  /** Generate PDF report — returns base64-encoded PDF */
  generatePDF: protectedProcedure
    .input(z.object({
      periodoId: z.string(),
      tipo: z.enum(['por-aula', 'por-laboratorio', 'por-docente', 'por-ciclo', 'gestion']),
      docenteId: z.string().optional(), // For specific docente report
      aulaId: z.string().optional(),    // For specific aula report
      ciclo: z.number().optional(),      // For specific ciclo report
    }))
    .mutation(async ({ ctx, input }) => {
      const role = ctx.session.role;
      const isInstitutionalManager = hasRole(ctx.session, academicManagerRoles);
      const isDepartmentManager = hasRole(ctx.session, departmentScopedRoles);
      const isDocente = role === 'DOCENTE';

      if (!hasRole(ctx.session, reportRoles)) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'No tiene permisos para generar reportes' });
      }

      const periodo = await ctx.prisma.periodoAcademico.findUniqueOrThrow({
        where: { id: input.periodoId },
        select: { id: true, nombre: true, fechaInicio: true, fechaFin: true, estado: true }
      });

      const isPublished = periodo.estado === 'APROBADO' || periodo.estado === 'FINALIZADO';
      const canAccessDraftReports = isInstitutionalManager || isDepartmentManager;

      if (!canAccessDraftReports && !isPublished) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'El horario aún no ha sido publicado',
        });
      }

      if (input.tipo === 'gestion' && !isInstitutionalManager && !isDepartmentManager) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'No tiene permisos para generar reportes de gestión',
        });
      }

      const managedDepartamentoIds = isDepartmentManager
        ? await getManagedDepartamentoIds(ctx.prisma, ctx.session)
        : null;
      const docenteIdForReport = isDocente ? ctx.session.docenteId : input.docenteId;

      if (isDocente) {
        if (!ctx.session.docenteId) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'El usuario docente no tiene un ID de docente asociado',
          });
        }
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

      if (isDepartmentManager && input.tipo === 'por-docente' && input.docenteId) {
        const docente = await ctx.prisma.docente.findUniqueOrThrow({
          where: { id: input.docenteId },
          select: { departamentoId: true },
        });

        if (!docente.departamentoId || !(managedDepartamentoIds ?? []).includes(docente.departamentoId)) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'No tiene permiso para generar reportes de este docente',
          });
        }
      }

      try {

        const assignmentFilter: Prisma.AsignacionWhereInput = (!canAccessDraftReports && !isPublished)
          ? { confirmado: true }
          : {};
        const assignmentWhere = buildAssignmentWhere(input.periodoId, assignmentFilter, managedDepartamentoIds);

        let html = '';
        const options = { landscape: true };

      if (input.tipo === 'por-aula' || input.tipo === 'por-laboratorio') {
        const whereClause: Prisma.AulaWhereInput = {};
        if (input.aulaId) {
          whereClause.id = input.aulaId;
        } else if (input.tipo === 'por-laboratorio') {
          whereClause.tipo = 'LABORATORIO';
        }

        const aulas = await ctx.prisma.aula.findMany({
          where: whereClause,
          include: {
            asignaciones: {
              where: assignmentWhere,
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
            tipo: a.tipo,
            ciclo: a.grupo.curso.ciclo,
            horasTeoria: a.grupo.curso.horasTeoria,
            horasPractica: a.grupo.curso.horasPractica,
            horasLaboratorio: a.grupo.curso.horasLaboratorio,
          })),
        }));

        html = generateAulaReportHTML(reportData, periodo.nombre);
      } else if (input.tipo === 'por-ciclo') {
        const asignaciones = await ctx.prisma.asignacion.findMany({
          where: assignmentWhere,
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

        const reportData: Parameters<typeof generateCicloReportHTML>[0] = [];
        
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
                horasPractica: a.grupo.curso.horasPractica,
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
        const docenteWhere: Prisma.DocenteWhereInput = docenteIdForReport
          ? { id: docenteIdForReport }
          : buildActiveDocenteWhere(managedDepartamentoIds);

        const docentes = await ctx.prisma.docente.findMany({
          where: docenteWhere,
          include: {
            asignaciones: {
              where: assignmentWhere,
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
                tipo: a.tipo,
                ciclo: a.grupo.curso.ciclo,
                horasTeoria: a.grupo.curso.horasTeoria,
                horasPractica: a.grupo.curso.horasPractica,
                horasLaboratorio: a.grupo.curso.horasLaboratorio,
              })),
            };
          });

        html = generateDocenteReportHTML(reportData, periodo.nombre);
      } else if (input.tipo === 'gestion') {
        const activeDocenteWhere = buildActiveDocenteWhere(managedDepartamentoIds);
        const grupoWhere: Prisma.GrupoWhereInput = {
          periodoAcademicoId: input.periodoId,
          ...(managedDepartamentoIds
            ? { asignaciones: { some: assignmentWhere } }
            : {}),
        };
        const aulaWhere: Prisma.AulaWhereInput | undefined = managedDepartamentoIds
          ? { asignaciones: { some: assignmentWhere } }
          : undefined;

        const [totalDocentes, docentesConCarga, totalGrupos, gruposAsignados, asignaciones, aulas, franjasCount] = await Promise.all([
          ctx.prisma.docente.count({ where: activeDocenteWhere }),
          ctx.prisma.asignacion.groupBy({
            by: ['docenteId'],
            where: assignmentWhere,
          }),
          ctx.prisma.grupo.count({ where: grupoWhere }),
          ctx.prisma.asignacion.groupBy({
            by: ['grupoId'],
            where: assignmentWhere,
          }),
          ctx.prisma.asignacion.findMany({
            where: assignmentWhere,
            include: { docente: true, aula: true },
          }),
          ctx.prisma.aula.findMany({
            where: aulaWhere,
            include: {
              asignaciones: {
                where: assignmentWhere,
              },
            },
          }),
          ctx.prisma.franjaHoraria.count(),
        ]);

        const cargaDocente = await ctx.prisma.docente.findMany({
          where: activeDocenteWhere,
          include: {
            asignaciones: {
              where: assignmentWhere,
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
      const pdfHash = createHash('sha256').update(pdfBuffer).digest('hex');
      const filename = `reporte-${input.tipo}.pdf`;

      await writeAuditLog(ctx.prisma, {
        session: ctx.session,
        headers: ctx.headers,
        accion: 'REPORTE_PDF_GENERADO',
        entidad: 'ReportePDF',
        entidadId: pdfHash,
        despues: {
          periodoId: input.periodoId,
          tipo: input.tipo,
          docenteId: input.docenteId,
          aulaId: input.aulaId,
          ciclo: input.ciclo,
          filename,
          documentoHash: pdfHash,
        },
      });

        return { pdf: pdfBuffer.toString('base64'), filename, documentoHash: pdfHash };
      } catch (error: unknown) {
        if (error instanceof TRPCError) {
          throw error;
        }
        console.error('Error generating PDF:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: getErrorMessage(error),
        });
      }
    }),

  porCiclo: protectedProcedure
    .input(z.object({ periodoId: z.string() }))
    .query(async ({ ctx, input }) => {
      const periodo = await ctx.prisma.periodoAcademico.findUnique({
        where: { id: input.periodoId },
        select: { estado: true }
      });

      const role = ctx.session.role;
      const isInstitutionalManager = hasRole(ctx.session, academicManagerRoles);
      const isDepartmentManager = hasRole(ctx.session, departmentScopedRoles);
      if (!isInstitutionalManager && !isDepartmentManager) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'No tiene permisos para consultar reportes por ciclo' });
      }

      const managedDepartamentoIds = isDepartmentManager
        ? await getManagedDepartamentoIds(ctx.prisma, ctx.session)
        : null;
      const isPublished = periodo?.estado === 'APROBADO' || periodo?.estado === 'FINALIZADO';

      if (!isInstitutionalManager && !isDepartmentManager && !isPublished) {
        return [];
      }

      const assignmentFilter: Prisma.AsignacionWhereInput = (!isInstitutionalManager && !isDepartmentManager && !isPublished)
        ? { confirmado: true }
        : {};

      return ctx.prisma.asignacion.findMany({
        where: buildAssignmentWhere(input.periodoId, assignmentFilter, managedDepartamentoIds),
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

  /** Generate Audit Report PDF */
  generateAuditReport: protectedProcedure
    .mutation(async ({ ctx }) => {
      if (ctx.session.role !== 'ADMIN') {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Solo los administradores pueden generar reportes de bitácora' });
      }

      const logs = await ctx.prisma.log.findMany({
        include: { user: { select: { nombre: true, email: true, role: true } } },
        orderBy: { createdAt: 'desc' },
        take: 500 // Last 500 activities
      });

      const reportData = logs.map(log => ({
        usuario: log.user?.nombre || 'Sistema',
        email: log.user?.email || '-',
        rol: log.user?.role || '-',
        accion: log.accion,
        detalles: log.detalles,
        fecha: log.createdAt,
      }));

      const html = generateAuditReportHTML(reportData);
      const buffer = await renderPDF(html, { landscape: true });

      await writeAuditLog(ctx.prisma, {
        session: ctx.session,
        headers: ctx.headers,
        accion: 'GENERATE_AUDIT_REPORT',
        entidad: 'Log',
        detalles: 'Se generó un reporte PDF de la bitácora del sistema',
      });

      return {
        pdf: buffer.toString('base64'),
        filename: `bitacora_sistema_${new Date().toISOString().split('T')[0]}.pdf`,
      };
    }),

  /** Decano Dashboard Stats */
  getDecanoStats: protectedProcedure
    .input(z.object({ periodoId: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      if (!hasRole(ctx.session, ['ADMIN', 'DECANO'])) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'No tiene permisos para ver estadísticas de decanato' });
      }

      const activePeriodo = input.periodoId 
        ? await ctx.prisma.periodoAcademico.findUnique({ where: { id: input.periodoId } })
        : await ctx.prisma.periodoAcademico.findFirst({ where: { activo: true }, orderBy: { fechaInicio: 'desc' } });

      if (!activePeriodo) {
        return {
          contadores: { docentes: 0, departamentos: 0, escuelas: 0, declaracionesFinalizadas: 0 },
          progresoDeclaraciones: [],
          cargaPorDepartamento: [],
          estadoHorarios: [],
        };
      }

      const [
        totalDocentes,
        totalDepartamentos,
        totalEscuelas,
        declaraciones,
        departamentos,
        escuelas,
      ] = await Promise.all([
        ctx.prisma.docente.count({ where: { activo: true } }),
        ctx.prisma.departamento.count(),
        ctx.prisma.escuela.count(),
        ctx.prisma.declaracionCarga.findMany({
          where: { periodoId: activePeriodo.id },
          include: { docente: { include: { departamento: true } } },
        }),
        ctx.prisma.departamento.findMany({ include: { docentes: true } }),
        ctx.prisma.escuela.findMany({
          include: {
            curriculas: {
              include: {
                cursos: {
                  include: {
                    curso: {
                      include: {
                        grupos: { where: { periodoAcademicoId: activePeriodo.id } }
                      }
                    }
                  }
                }
              }
            }
          }
        }),
      ]);

      // 1. Contadores de Declaraciones por estado
      const finalizadas = declaraciones.filter(d => d.estado === 'FINALIZADA').length;
      const pendientes = declaraciones.filter(d => d.estado !== 'FINALIZADA').length;

      // 2. Progreso por Departamento (Cumplimiento de Declaraciones)
      const progresoPorDepto = departamentos.map(depto => {
        const decsDepto = declaraciones.filter(d => d.docente.departamentoId === depto.id);
        const total = depto.docentes.length;
        const completadas = decsDepto.filter(d => d.estado === 'FINALIZADA').length;
        return {
          nombre: depto.nombre,
          total,
          completadas,
          porcentaje: total > 0 ? Math.round((completadas / total) * 100) : 0,
        };
      });

      // 3. Carga Lectiva vs No Lectiva Global
      const totalLectivas = declaraciones.reduce((acc, d) => acc + (d.totalHorasLectivas || 0), 0);
      const totalNoLectivas = declaraciones.reduce((acc, d) => acc + (d.totalHorasNoLectivas || 0), 0);

      // 4. Estado de Horarios por Escuela
      const estadoHorarios = escuelas.map(esc => {
        const gruposEscuela = esc.curriculas.flatMap(curr => 
          curr.cursos.flatMap(cc => cc.curso.grupos)
        );
        const totalGrupos = gruposEscuela.length;
        // This is a simplification, ideally we'd check if all groups have assignments
        return {
          nombre: esc.nombre,
          grupos: totalGrupos,
        };
      });

      return {
        periodo: activePeriodo.nombre,
        contadores: {
          docentes: totalDocentes,
          departamentos: totalDepartamentos,
          escuelas: totalEscuelas,
          declaracionesFinalizadas: finalizadas,
          declaracionesPendientes: pendientes,
        },
        graficos: {
          distribucionDeclaraciones: [
            { name: 'Finalizadas', value: finalizadas },
            { name: 'Pendientes', value: pendientes },
          ],
          cargaGlobal: [
            { name: 'Lectiva', horas: totalLectivas },
            { name: 'No Lectiva', horas: totalNoLectivas },
          ],
          progresoDepartamentos: progresoPorDepto,
          horariosEscuelas: estadoHorarios,
        }
      };
    }),
});
