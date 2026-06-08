import { z } from 'zod';
import { createTRPCRouter, adminProcedure, protectedProcedure, secretariaProcedure, directorProcedure } from '../init';
import { TRPCError } from '@trpc/server';
import { AvailabilityService } from '@/server/services/availability';
import { ScheduleEngine } from '@/server/services/schedule-engine';
import { AssignmentService } from '@/server/services/assignment.service';

export const horarioRouter = createTRPCRouter({
  // ─── Availability (Real-time) ────────────────────────

  /** Availability matrix for a single aula (raw — no docente constraints) */
  aulaAvailability: protectedProcedure
    .input(z.object({ periodoId: z.string(), aulaId: z.string() }))
    .query(async ({ ctx, input }) => {
      const service = new AvailabilityService(ctx.prisma);
      return service.getAulaAvailability(input.periodoId, input.aulaId);
    }),

  /** Availability matrix for a single aula annotated with docente-specific constraints */
  docenteAulaAvailability: protectedProcedure
    .input(z.object({ periodoId: z.string(), aulaId: z.string(), docenteId: z.string() }))
    .query(async ({ ctx, input }) => {
      if (ctx.session.role === 'DOCENTE' && ctx.session.docenteId !== input.docenteId) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'No tiene permiso para consultar disponibilidad de otro docente' });
      }

      const service = new AvailabilityService(ctx.prisma);
      return service.getDocenteAulaAvailability(input.periodoId, input.aulaId, input.docenteId);
    }),

  // ─── Assignments ───────────────────────────────────

  list: protectedProcedure
    .input(z.object({
      periodoId: z.string(),
      docenteId: z.string().optional(),
      aulaId: z.string().optional(),
      cursoId: z.string().optional(),
      diaSemana: z.number().min(1).max(7).optional()
    }))
    .query(async ({ ctx, input }) => {
      const periodo = await ctx.prisma.periodoAcademico.findUnique({
        where: { id: input.periodoId },
        select: { estado: true }
      });

      const role = ctx.session.role;
      const isPrivileged = role === 'ADMIN' || role === 'SECRETARIA_ACADEMICA' || role === 'DIRECTOR_ESCUELA' || role === 'DECANO';
      const isPublished = periodo?.estado === 'APROBADO' || periodo?.estado === 'FINALIZADO';

      if (!isPrivileged && !isPublished) {
        return [];
      }

      return ctx.prisma.asignacion.findMany({
        where: {
          periodoId: input.periodoId,
          ...(input.docenteId ? { docenteId: input.docenteId } : {}),
          ...(input.aulaId ? { aulaId: input.aulaId } : {}),
          ...(input.diaSemana ? { diaSemana: input.diaSemana } : {}),
        },
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

  byAula: protectedProcedure
    .input(z.object({ aulaId: z.string(), periodoId: z.string() }))
    .query(async ({ ctx, input }) => {
      const periodo = await ctx.prisma.periodoAcademico.findUnique({
        where: { id: input.periodoId },
        select: { estado: true },
      });
      const isPrivileged = ['ADMIN', 'SECRETARIA_ACADEMICA', 'DIRECTOR_ESCUELA', 'DECANO'].includes(ctx.session.role);
      const isPublished = periodo?.estado === 'APROBADO' || periodo?.estado === 'FINALIZADO';
      if (!isPrivileged && !isPublished) {
        return [];
      }

      return ctx.prisma.asignacion.findMany({
        where: { aulaId: input.aulaId, periodoId: input.periodoId },
        include: {
          grupo: { include: { curso: true } },
          docente: true,
          aula: true,
          franjaHoraria: true,
        },
      });
    }),

  byDocente: protectedProcedure
    .input(z.object({ docenteId: z.string(), periodoId: z.string() }))
    .query(async ({ ctx, input }) => {
      const role = ctx.session.role;
      const isPrivileged = role === 'ADMIN' || role === 'SECRETARIA_ACADEMICA' || role === 'DIRECTOR_ESCUELA' || role === 'DIRECTOR_DEPARTAMENTO' || role === 'DECANO';
      const isSelf = ctx.session.docenteId === input.docenteId;

      const periodo = await ctx.prisma.periodoAcademico.findUnique({
        where: { id: input.periodoId },
        select: { estado: true }
      });
      const isPublished = periodo?.estado === 'APROBADO' || periodo?.estado === 'FINALIZADO';

      if (!isPrivileged && !isSelf && !isPublished) {
        return [];
      }

      return ctx.prisma.asignacion.findMany({
        where: { docenteId: input.docenteId, periodoId: input.periodoId },
        include: {
          grupo: { include: { curso: true } },
          aula: true,
          docente: true,
          franjaHoraria: true,
        },
      });
    }),

  /** Stats for dashboard/management */
  stats: protectedProcedure
    .input(z.object({ periodoId: z.string() }))
    .query(async ({ ctx, input }) => {
      const isPrivileged = ['ADMIN', 'SECRETARIA_ACADEMICA', 'DIRECTOR_ESCUELA', 'DECANO'].includes(ctx.session.role);
      if (!isPrivileged) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'No tiene permiso para consultar indicadores de horarios' });
      }

      const [asignaciones, grupos, docentesConCargaCount] = await Promise.all([
        ctx.prisma.asignacion.findMany({
          where: { periodoId: input.periodoId },
          include: { docente: true },
        }),
        ctx.prisma.grupo.findMany({
          where: { periodoAcademicoId: input.periodoId },
        }),
        ctx.prisma.asignacion.groupBy({
          by: ['docenteId'],
          where: { periodoId: input.periodoId },
        }),
      ]);

      const totalAsignaciones = asignaciones.length;
      const totalGrupos = grupos.length;

      // Unique groups that have at least one assignment
      const assignedGroupIds = new Set(asignaciones.map((a) => a.grupoId));
      const gruposAsignados = assignedGroupIds.size;
      const gruposSinAsignar = totalGrupos - gruposAsignados;

      const docenteCarga = new Map<string, { nombre: string; horasAsignadas: number }>();

      asignaciones.forEach((a) => {
        const d = a.docente;
        const current = docenteCarga.get(d.id) || { nombre: d.nombre, horasAsignadas: 0 };
        docenteCarga.set(d.id, { ...current, horasAsignadas: current.horasAsignadas + 1 });
      });

      return {
        totalAsignaciones,
        totalGrupos,
        gruposAsignados,
        gruposSinAsignar,
        docentesConCarga: docentesConCargaCount.length,
        cargaDocente: Array.from(docenteCarga.values()),
      };
    }),

  /** Create a single assignment (from filling session or admin) */
  create: secretariaProcedure
    .input(z.object({
      docenteId: z.string(),
      aulaId: z.string(),
      grupoId: z.string(),
      franjaHorariaId: z.string(),
      periodoId: z.string(),
      tipo: z.enum(['TEORIA', 'PRACTICA', 'LABORATORIO']),
    }))
    .mutation(async ({ ctx, input }) => {
      const service = new AvailabilityService(ctx.prisma);

      // Validate against all constraints
      const validation = await service.validateSlotSelection(
        input.docenteId,
        input.aulaId,
        input.grupoId,
        input.franjaHorariaId,
        input.periodoId
      );

      if (!validation.valid) {
        throw new Error(validation.reasons.join(', '));
      }

      return ctx.prisma.asignacion.create({
        data: {
          docenteId: input.docenteId,
          aulaId: input.aulaId,
          grupoId: input.grupoId,
          franjaHorariaId: input.franjaHorariaId,
          periodoId: input.periodoId,
          tipo: input.tipo,
        },
      });
    }),

  delete: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.asignacion.delete({ where: { id: input.id } });
    }),

  // ─── Auto Scheduling (Batch) ───────────────────────

  autoGenerate: secretariaProcedure
    .input(z.object({
      periodoId: z.string(),
      overwrite: z.boolean().optional().default(true),
    }))
    .mutation(async ({ ctx, input }) => {
      console.log(`[TRPC] autoGenerate iniciado. Periodo: ${input.periodoId}`);
      try {
        // 1. Fetch all data needed for the engine
        const [docentes, grupos, aulas, franjas, docenteGrupos, restricciones, mantenimientos, disponibilidades, asignacionesCarga] = await Promise.all([
          ctx.prisma.docente.findMany({ where: { activo: true } }),
          ctx.prisma.grupo.findMany({ 
            where: { periodoAcademicoId: input.periodoId },
            include: { curso: true }
          }),
          ctx.prisma.aula.findMany(),
          ctx.prisma.franjaHoraria.findMany(),
          ctx.prisma.docenteGrupo.findMany({
            where: { grupo: { periodoAcademicoId: input.periodoId } }
          }),
          ctx.prisma.restriccionDocente.findMany(),
          ctx.prisma.mantenimientoAula.findMany(),
          ctx.prisma.disponibilidadDocente.findMany(),
          ctx.prisma.asignacionCargaLectiva.findMany({
            where: { periodoId: input.periodoId }
          })
        ]);

        console.log(`[TRPC] Datos recuperados: ${docentes.length} docentes, ${grupos.length} grupos, ${docenteGrupos.length} vinculaciones, ${aulas.length} aulas`);

        if (docenteGrupos.length === 0) {
          throw new Error('No existen vinculaciones Docente-Grupo para este periodo.');
        }

        const docenteGrupoMap = new Map<string, string[]>();
        docenteGrupos.forEach(dg => {
          const current = docenteGrupoMap.get(dg.docenteId) || [];
          docenteGrupoMap.set(dg.docenteId, [...current, dg.grupoId]);
        });

        const blockedDocenteSlots = new Set<string>();
        restricciones.forEach(r => {
          blockedDocenteSlots.add(`${r.docenteId}::${r.franjaHorariaId}`);
        });

        const docentesWithAvailability = new Set(disponibilidades.map(d => d.docenteId));
        const positiveAvailMap = new Map<string, Set<string>>();
        disponibilidades.forEach(d => {
          const set = positiveAvailMap.get(d.docenteId) || new Set<string>();
          set.add(d.franjaHorariaId);
          positiveAvailMap.set(d.docenteId, set);
        });

        docentes.forEach(docente => {
          if (docentesWithAvailability.has(docente.id)) {
            const availableSet = positiveAvailMap.get(docente.id)!;
            franjas.forEach(f => {
              if (!availableSet.has(f.id)) {
                blockedDocenteSlots.add(`${docente.id}::${f.id}`);
              }
            });
          }
        });

        const engineInput = {
          docentes: docentes.map(d => ({
            id: d.id,
            nombre: d.nombre,
            categoria: d.categoria,
            tipo: d.tipo,
            antiguedad: d.antiguedad
          })),
          grupos: grupos.map(g => ({
            id: g.id,
            nombre: g.nombre,
            cursoId: g.cursoId,
            cursoNombre: g.curso.nombre,
            cursoCodigo: g.curso.codigo,
            ciclo: g.curso.ciclo,
            numAlumnos: g.numAlumnos,
            horasTeoria: g.curso.horasTeoria,
            horasPractica: g.curso.horasPractica,
            horasLaboratorio: g.curso.horasLaboratorio,
            requiereLaboratorio: g.curso.requiereLaboratorio,
            workloads: asignacionesCarga
              .filter(ac => ac.grupoId === g.id)
              .map(ac => ({
                docenteId: ac.docenteId,
                tipo: ac.tipo as 'TEORIA' | 'PRACTICA' | 'LABORATORIO',
                horas: ac.horasAsignadas
              }))
          })),
          aulas: aulas.map(a => ({
            id: a.id,
            codigo: a.codigo,
            nombre: a.nombre,
            capacidad: a.capacidad,
            tipo: a.tipo
          })),
          franjas: franjas.map(f => ({
            id: f.id,
            dia: f.dia,
            horaInicio: f.horaInicio,
            horaFin: f.horaFin,
            numeroBloque: f.numeroBloque
          })),
          docenteGrupoMap,
          blockedDocenteSlots,
          blockedAulaSlots: new Set(mantenimientos.map(m => `${m.aulaId}::${m.franjaHorariaId}`)),
          existingAssignments: [] // Start from zero on mass generate
        };

        const engine = new ScheduleEngine(engineInput);
        const result = engine.generate();
        
        console.log(`[TRPC] Motor generó ${result.assignments.length} asignaciones y ${result.unassigned.length} fallos.`);

        if (result.assignments.length === 0) {
          return {
            success: false,
            reason: result.unassigned[0]?.reason || 'El motor no pudo generar ninguna asignación válida.',
            createdCount: 0,
            unassignedCount: result.unassigned.length,
            unassigned: result.unassigned
          };
        }

        // 2. Persist assignments if requested
        if (input.overwrite) {
          const deleteRes = await ctx.prisma.asignacion.deleteMany({
            where: { periodoId: input.periodoId }
          });
          console.log(`[TRPC] Sobreescritura: ${deleteRes.count} asignaciones previas eliminadas.`);
        }

        const createdCount = await ctx.prisma.$transaction(
          result.assignments.map(a => 
            ctx.prisma.asignacion.create({
              data: {
                periodoId: input.periodoId,
                docenteId: a.docenteId,
                aulaId: a.aulaId,
                grupoId: a.grupoId,
                franjaHorariaId: a.franjaHorariaId,
                tipo: a.tipo,
                confirmado: false
              }
            })
          )
        );
        
        console.log(`[TRPC] Persistencia completada: ${createdCount.length} registros creados.`);

        return {
          success: true,
          createdCount: createdCount.length,
          unassignedCount: result.unassigned.length,
          unassigned: result.unassigned
        };
      } catch (error) {
        console.error(`[TRPC] Error crítico en autoGenerate:`, error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Error interno al autogenerar horarios',
        });
      }
    }),

  /** Run automatic assignment based on postulations and hierarchy */
  processAssignments: secretariaProcedure
    .input(z.object({ periodoId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      console.log(`[TRPC] processAssignments iniciado para periodo: ${input.periodoId}`);
      try {
        const service = new AssignmentService(ctx.prisma);
        const result = await service.processPostulations(input.periodoId);
        console.log(`[TRPC] processAssignments completado. Resultado:`, result);
        return result;
      } catch (error) {
        console.error(`[TRPC] Error en processAssignments:`, error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Error desconocido en el motor de asignación',
        });
      }
    }),

  /** Confirm a teacher's schedule (Secretaria confirms) */
  confirmTeacherSchedule: secretariaProcedure
    .input(z.object({ docenteId: z.string(), periodoId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.asignacion.updateMany({
        where: { docenteId: input.docenteId, periodoId: input.periodoId },
        data: { confirmado: true }
      });
    }),

  /** Send whole schedule to Director for revision */
  sendToRevision: secretariaProcedure
    .input(z.object({ periodoId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.periodoAcademico.update({
        where: { id: input.periodoId },
        data: { estado: 'REVISION', comentariosDirector: null }
      });
    }),

  /** Approve schedule (Director only) */
  approveSchedule: directorProcedure
    .input(z.object({ periodoId: z.string(), comentarios: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.periodoAcademico.update({
        where: { id: input.periodoId },
        data: { 
          estado: 'APROBADO',
          aprobadoPorId: ctx.session.id,
          fechaAprobacion: new Date(),
          comentariosDirector: input.comentarios || null
        }
      });
    }),

  /** Reject schedule (Director only) — sends back to secretary for corrections */
  rejectSchedule: directorProcedure
    .input(z.object({ periodoId: z.string(), comentarios: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.periodoAcademico.update({
        where: { id: input.periodoId },
        data: { 
          estado: 'ASIGNACION',
          comentariosDirector: input.comentarios
        }
      });
    }),

  /** Publish schedule (Director only) — makes it visible to all users */
  publishSchedule: directorProcedure
    .input(z.object({ periodoId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.periodoAcademico.update({
        where: { id: input.periodoId },
        data: { estado: 'FINALIZADO' }
      });
    }),

  /** Get approval info for the active period */
  getApprovalInfo: protectedProcedure.query(async ({ ctx }) => {
    const activo = await ctx.prisma.periodoAcademico.findFirst({
      where: { activo: true },
      select: {
        id: true,
        nombre: true,
        estado: true,
        comentariosDirector: true,
        aprobadoPor: { select: { nombre: true } },
        fechaAprobacion: true,
      }
    });
    if (!activo) return null;
    const role = ctx.session.role;
    const isPrivileged = role === 'ADMIN' || role === 'SECRETARIA_ACADEMICA' || role === 'DIRECTOR_ESCUELA' || role === 'DECANO';
    const isPublished = activo.estado === 'APROBADO' || activo.estado === 'FINALIZADO';
    return {
      ...activo,
      isPublished,
      canView: isPrivileged || isPublished,
    };
  }),

  /** Get docentes sorted by hierarchy for the secretary to process one by one */
  docentesByHierarchy: secretariaProcedure
    .input(z.object({ periodoId: z.string() }))
    .query(async ({ ctx }) => {
      const docentes = await ctx.prisma.docente.findMany({
        where: { activo: true },
        include: {
          _count: {
            select: {
              asignaciones: { where: { periodoId: ctx.session.role === 'ADMIN' ? undefined : undefined } } // Placeholder
            }
          }
        }
      });

      const CATEGORIA_ORDER = { PRINCIPAL: 1, ASOCIADO: 2, AUXILIAR: 3, JEFE_PRACTICA: 4 };
      const TIPO_ORDER = { NOMBRADO: 1, CONTRATADO: 2 };

      const result = docentes.sort((a, b) => {
        if (CATEGORIA_ORDER[a.categoria] !== CATEGORIA_ORDER[b.categoria]) 
          return CATEGORIA_ORDER[a.categoria] - CATEGORIA_ORDER[b.categoria];
        if (TIPO_ORDER[a.tipo] !== TIPO_ORDER[b.tipo])
          return TIPO_ORDER[a.tipo] - TIPO_ORDER[b.tipo];
        return a.antiguedad.getTime() - b.antiguedad.getTime();
      });

      console.log(`[DocentesByHierarchy] Found ${result.length} active docentes`);
      return result;
    }),

  /** Suggest assignments for a specific docente based on their assigned groups and availability */
  suggestDocenteAssignments: secretariaProcedure
    .input(z.object({ periodoId: z.string(), docenteId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      console.log(`[TRPC] suggestDocenteAssignments para docente: ${input.docenteId}`);
      try {
        // 1. Fetch all data needed for this specific docente
        const [docente, docenteGrupos, aulas, franjas, restricciones, mantenimientos, disponibilidades, existingAssignments] = await Promise.all([
          ctx.prisma.docente.findUniqueOrThrow({ where: { id: input.docenteId } }),
          ctx.prisma.docenteGrupo.findMany({
            where: { docenteId: input.docenteId, grupo: { periodoAcademicoId: input.periodoId } },
            include: { grupo: { include: { curso: true } } }
          }),
          ctx.prisma.aula.findMany(),
          ctx.prisma.franjaHoraria.findMany(),
          ctx.prisma.restriccionDocente.findMany({ where: { docenteId: input.docenteId } }),
          ctx.prisma.mantenimientoAula.findMany(),
          ctx.prisma.disponibilidadDocente.findMany({ where: { docenteId: input.docenteId } }),
          ctx.prisma.asignacion.findMany({ where: { periodoId: input.periodoId } }) 
        ]);

        console.log(`[TRPC] Datos recuperados para sugerencia: ${docenteGrupos.length} grupos asignados al docente.`);

        if (docenteGrupos.length === 0) {
          return { assignments: [], unassigned: [{ grupoId: 'N/A', tipo: 'TEORIA', reason: 'El docente no tiene grupos vinculados para este periodo.' }] };
        }

        const engineInput = {
          docentes: [{
            id: docente.id,
            nombre: docente.nombre,
            categoria: docente.categoria,
            tipo: docente.tipo,
            antiguedad: docente.antiguedad
          }],
          grupos: docenteGrupos.map(dg => ({
            id: dg.grupo.id,
            nombre: dg.grupo.nombre,
            cursoId: dg.grupo.cursoId,
            cursoNombre: dg.grupo.curso.nombre,
            cursoCodigo: dg.grupo.curso.codigo,
            ciclo: dg.grupo.curso.ciclo,
            numAlumnos: dg.grupo.numAlumnos,
            horasTeoria: dg.grupo.curso.horasTeoria,
            horasPractica: dg.grupo.curso.horasPractica,
            horasLaboratorio: dg.grupo.curso.horasLaboratorio,
            requiereLaboratorio: dg.grupo.curso.requiereLaboratorio
          })),
          aulas: aulas.map(a => ({
            id: a.id,
            codigo: a.codigo,
            nombre: a.nombre,
            capacidad: a.capacidad,
            tipo: a.tipo
          })),
          franjas: franjas.map(f => ({
            id: f.id,
            dia: f.dia,
            horaInicio: f.horaInicio,
            horaFin: f.horaFin,
            numeroBloque: f.numeroBloque
          })),
          docenteGrupoMap: new Map([[docente.id, docenteGrupos.map(dg => dg.grupoId)]]),
          blockedDocenteSlots: new Set<string>(),
          blockedAulaSlots: new Set<string>(),
          existingAssignments: existingAssignments.map(a => ({
            grupoId: a.grupoId,
            docenteId: a.docenteId!,
            aulaId: a.aulaId,
            franjaHorariaId: a.franjaHorariaId,
            tipo: a.tipo,
            confirmado: a.confirmado
          }))
        };

        if (disponibilidades.length > 0) {
          const positiveSet = new Set(disponibilidades.map(d => d.franjaHorariaId));
          franjas.forEach(f => {
            if (!positiveSet.has(f.id)) {
              engineInput.blockedDocenteSlots.add(`${docente.id}::${f.id}`);
            }
          });
        }
        restricciones.forEach(r => {
          engineInput.blockedDocenteSlots.add(`${docente.id}::${r.franjaHorariaId}`);
        });

        mantenimientos.forEach(m => {
          engineInput.blockedAulaSlots.add(`${m.aulaId}::${m.franjaHorariaId}`);
        });

        const engine = new ScheduleEngine(engineInput);
        const result = engine.generate();
        
        console.log(`[TRPC] Sugerencia generada: ${result.assignments.length} asignaciones.`);

        return result;
      } catch (error) {
        console.error(`[TRPC] Error en suggestDocenteAssignments:`, error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Error al generar sugerencias para el docente',
        });
      }
    }),

  /** Apply suggestions for a docente */
  applySuggestions: secretariaProcedure
    .input(z.object({ 
      periodoId: z.string(), 
      docenteId: z.string(),
      assignments: z.array(z.object({
        grupoId: z.string(),
        aulaId: z.string(),
        franjaHorariaId: z.string(),
        tipo: z.enum(['TEORIA', 'PRACTICA', 'LABORATORIO']),
      }))
    }))
    .mutation(async ({ ctx, input }) => {
      console.log(`[TRPC] applySuggestions iniciado para docente: ${input.docenteId}, Asignaciones: ${input.assignments.length}`);
      try {
        // 1. Delete existing unconfirmed assignments for this docente
        const deleteRes = await ctx.prisma.asignacion.deleteMany({
          where: { docenteId: input.docenteId, periodoId: input.periodoId, confirmado: false }
        });
        console.log(`[TRPC] Eliminadas ${deleteRes.count} sugerencias previas.`);

        // 2. Create new suggested assignments
        const createRes = await ctx.prisma.asignacion.createMany({
          data: input.assignments.map(a => ({
            docenteId: input.docenteId,
            periodoId: input.periodoId,
            aulaId: a.aulaId,
            grupoId: a.grupoId,
            franjaHorariaId: a.franjaHorariaId,
            tipo: a.tipo,
            confirmado: false
          }))
        });
        
        console.log(`[TRPC] Aplicadas ${createRes.count} nuevas sugerencias.`);
        return createRes;
      } catch (error) {
        console.error(`[TRPC] Error en applySuggestions:`, error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Error al persistir las sugerencias en la base de datos',
        });
      }
    }),

  /** Suggest an aula based on business rules */
  suggestAula: protectedProcedure
    .input(z.object({ grupoId: z.string(), periodoId: z.string(), tipo: z.enum(['TEORIA', 'PRACTICA', 'LABORATORIO']) }))
    .query(async ({ ctx, input }) => {
      const service = new AvailabilityService(ctx.prisma);
      return service.suggestAulaForGroup(input.grupoId, input.periodoId, input.tipo);
    }),
});
