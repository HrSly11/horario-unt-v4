import { z } from 'zod';
import { createTRPCRouter, protectedProcedure, secretariaProcedure, secretariaEscuelaProcedure, directorProcedure } from '../init';
import type { Session } from '../init';
import { TRPCError } from '@trpc/server';
import { AvailabilityService } from '@/server/services/availability';
import { ScheduleEngine } from '@/server/services/schedule-engine';
import { AssignmentService } from '@/server/services/assignment.service';
import { assertCanAccessEscuela, getManagedEscuelaIds, getManagedDepartamentoIds, assertFacultyPeriodNotPublished } from '../policy';
import type { Prisma, PrismaClient } from '@/generated/prisma/client';

type SnapshotAsignacion = {
  docenteId?: string | null;
  aulaId?: string | null;
  franjaHoraria?: {
    dia?: string | null;
  } | null;
  [key: string]: unknown;
};

function getSnapshotAsignaciones(snapshot: unknown): SnapshotAsignacion[] | null {
  if (!snapshot || typeof snapshot !== 'object') return null;
  const asignaciones = (snapshot as { asignaciones?: unknown }).asignaciones;
  return Array.isArray(asignaciones) ? (asignaciones as SnapshotAsignacion[]) : null;
}

async function assertHorarioNotLocked(prisma: PrismaClient, grupoId: string, periodoId: string) {
  const grupo = await prisma.grupo.findUnique({
    where: { id: grupoId },
    include: {
      curso: {
        include: {
          cursoCurriculas: {
            include: {
              curricula: true,
            },
          },
        },
      },
    },
  });
  const escuelaId = grupo?.curso?.cursoCurriculas?.[0]?.curricula?.escuelaId;
  if (escuelaId) {
    const proc = await prisma.procesoHorarioEscuela.findFirst({
      where: { escuelaId, periodoId },
      select: { estado: true },
    });
    if (proc?.estado === 'PUBLICADO_PRELIMINAR') {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'El horario preliminar de esta escuela ya está publicado y bloqueado.',
      });
    }
  }
}

async function getGrupoEscuelaIds(prisma: PrismaClient, grupoId: string) {
  const grupo = await prisma.grupo.findUnique({
    where: { id: grupoId },
    select: {
      demandaLinea: {
        select: {
          demanda: { select: { escuelaId: true } },
        },
      },
      procesoHorario: { select: { escuelaId: true } },
      curso: {
        select: {
          cursoCurriculas: {
            where: { desasociadaEn: null },
            select: {
              curricula: { select: { escuelaId: true } },
            },
          },
        },
      },
    },
  });

  const ids = new Set<string>();
  if (grupo?.demandaLinea?.demanda?.escuelaId) ids.add(grupo.demandaLinea.demanda.escuelaId);
  if (grupo?.procesoHorario?.escuelaId) ids.add(grupo.procesoHorario.escuelaId);
  grupo?.curso?.cursoCurriculas?.forEach((cc) => {
    if (cc.curricula?.escuelaId) ids.add(cc.curricula.escuelaId);
  });

  return Array.from(ids);
}

async function assertCanManageHorarioForGrupo(prisma: PrismaClient, session: Session, grupoId: string) {
  if (session.role === 'ADMIN') return;

  const managedEscuelaIds = await getManagedEscuelaIds(prisma, session);
  const grupoEscuelaIds = await getGrupoEscuelaIds(prisma, grupoId);

  if (grupoEscuelaIds.length === 0) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'El grupo no está asociado a una escuela para programación de horarios.',
    });
  }

  if (managedEscuelaIds === null) return;

  const canManage = grupoEscuelaIds.some((escuelaId) => managedEscuelaIds.includes(escuelaId));
  if (!canManage) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'No tiene permiso para programar horarios de esta escuela.',
    });
  }
}

function buildEscuelaScopedGrupoWhere(escuelaIds: string[] | null) {
  if (escuelaIds === null) return {};
  if (escuelaIds.length === 0) return { id: { in: [] } };

  return {
    OR: [
      {
        demandaLinea: {
          demanda: {
            escuelaId: { in: escuelaIds },
          },
        },
      },
      {
        procesoHorario: {
          escuelaId: { in: escuelaIds },
        },
      },
      {
        curso: {
          cursoCurriculas: {
            some: {
              desasociadaEn: null,
              curricula: {
                escuelaId: { in: escuelaIds },
              },
            },
          },
        },
      },
    ],
  };
}

async function notifyDocenteScheduleAdjusted(
  prisma: PrismaClient,
  docenteId: string,
  periodoId: string,
  totalAdjustedAssignments: number
) {
  if (totalAdjustedAssignments <= 0) return;

  await prisma.notification.create({
    data: {
      docenteId,
      titulo: 'Horario sugerido ajustado por cruces',
      mensaje: `Tu horario sugerido para el periodo fue ajustado en ${totalAdjustedAssignments} bloque(s) debido a cruces de aula, ciclo o profesor. Revisa tu horario actualizado y, si es necesario, coordina con la secretaria académica.`,
      tipo: 'HORARIO_AJUSTADO',
      link: `/horarios?periodo=${periodoId}`,
    },
  });
}

async function notifyDocenteViableGaps(
  prisma: PrismaClient,
  docenteId: string,
  grupoId: string,
  tipo: 'TEORIA' | 'PRACTICA' | 'LABORATORIO',
  viableGaps: { franjaId: string; aulaId: string }[],
  periodoId: string
) {
  if (viableGaps.length === 0) return;

  const gapStrings = viableGaps.map((gap) => `franja ${gap.franjaId} / aula ${gap.aulaId}`).join(', ');
  await prisma.notification.create({
    data: {
      docenteId,
      titulo: 'Cruces detectados en tu sugerencia horaria',
      mensaje: `Se detectaron cruces al intentar respetar tu sugerencia para el grupo ${grupoId} (${tipo}). El sistema identificó espacios alternativos: ${gapStrings}. Revisa tu horario actualizado y coordina ajustes si corresponde.`,
      tipo: 'CONFLICTO_HORARIO',
      link: `/horarios?periodo=${periodoId}`,
    },
  });
}

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
      const publications = await ctx.prisma.publicacionAcademica.findMany({
        where: { periodoId: input.periodoId },
      });
      if (publications.length > 0) {
        let snapAsignaciones: SnapshotAsignacion[] = [];
        for (const pub of publications) {
          const snapshotAsignaciones = getSnapshotAsignaciones(pub.snapshot);
          if (snapshotAsignaciones) {
            let matches = snapshotAsignaciones;
            if (input.docenteId) matches = matches.filter((a) => a.docenteId === input.docenteId);
            if (input.aulaId) matches = matches.filter((a) => a.aulaId === input.aulaId);
            if (input.diaSemana) {
              const diaNames = ['LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO', 'DOMINGO'];
              const diaName = diaNames[input.diaSemana - 1];
              matches = matches.filter((a) => a.franjaHoraria?.dia === diaName);
            }
            snapAsignaciones = [...snapAsignaciones, ...matches];
          }
        }
        if (snapAsignaciones.length > 0) {
          return snapAsignaciones;
        }
      }

      const periodo = await ctx.prisma.periodoAcademico.findUnique({
        where: { id: input.periodoId },
        select: { estado: true }
      });

      const role = ctx.session.role;
      const isPrivileged = role === 'ADMIN' || role === 'SECRETARIA_ACADEMICA' || role === 'DIRECTOR_ESCUELA' || role === 'DECANO';
      const isPublished = periodo?.estado === 'APROBADO' || periodo?.estado === 'FINALIZADO';

      const where: Prisma.AsignacionWhereInput = {
        periodoId: input.periodoId,
        ...(input.docenteId ? { docenteId: input.docenteId } : {}),
        ...(input.aulaId ? { aulaId: input.aulaId } : {}),
        ...(input.diaSemana ? { diaSemana: input.diaSemana } : {}),
      };

      if (!isPrivileged && !isPublished) {
        const publishedSchools = await ctx.prisma.procesoHorarioEscuela.findMany({
          where: { periodoId: input.periodoId, estado: 'PUBLICADO_PRELIMINAR' },
          select: { escuelaId: true },
        });
        const publishedEscuelaIds = publishedSchools.map(p => p.escuelaId);
        if (publishedEscuelaIds.length === 0) {
          return [];
        }
        where.grupo = {
          curso: {
            cursoCurriculas: {
              some: {
                curricula: {
                  escuelaId: { in: publishedEscuelaIds }
                }
              }
            }
          }
        };
      }

      return ctx.prisma.asignacion.findMany({
        where,
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
      const publications = await ctx.prisma.publicacionAcademica.findMany({
        where: { periodoId: input.periodoId },
      });
      if (publications.length > 0) {
        let snapAsignaciones: SnapshotAsignacion[] = [];
        for (const pub of publications) {
          const snapshotAsignaciones = getSnapshotAsignaciones(pub.snapshot);
          if (snapshotAsignaciones) {
            const matches = snapshotAsignaciones.filter((a) => a.aulaId === input.aulaId);
            snapAsignaciones = [...snapAsignaciones, ...matches];
          }
        }
        if (snapAsignaciones.length > 0) {
          return snapAsignaciones;
        }
      }

      const periodo = await ctx.prisma.periodoAcademico.findUnique({
        where: { id: input.periodoId },
        select: { estado: true },
      });
      const isPrivileged = ['ADMIN', 'SECRETARIA_ACADEMICA', 'DIRECTOR_ESCUELA', 'DECANO'].includes(ctx.session.role);
      const isPublished = periodo?.estado === 'APROBADO' || periodo?.estado === 'FINALIZADO';
      
      const where: Prisma.AsignacionWhereInput = { aulaId: input.aulaId, periodoId: input.periodoId };

      if (!isPrivileged && !isPublished) {
        const publishedSchools = await ctx.prisma.procesoHorarioEscuela.findMany({
          where: { periodoId: input.periodoId, estado: 'PUBLICADO_PRELIMINAR' },
          select: { escuelaId: true },
        });
        const publishedEscuelaIds = publishedSchools.map(p => p.escuelaId);
        if (publishedEscuelaIds.length === 0) {
          return [];
        }
        where.grupo = {
          curso: {
            cursoCurriculas: {
              some: {
                curricula: {
                  escuelaId: { in: publishedEscuelaIds }
                }
              }
            }
          }
        };
      }

      return ctx.prisma.asignacion.findMany({
        where,
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
      const docente = await ctx.prisma.docente.findUnique({
        where: { id: input.docenteId },
        select: { departamento: { select: { facultadId: true } } },
      });
      if (docente?.departamento?.facultadId) {
        const pub = await ctx.prisma.publicacionAcademica.findUnique({
          where: {
            facultadId_periodoId: {
              facultadId: docente.departamento.facultadId,
              periodoId: input.periodoId,
            },
          },
        });
        if (pub) {
          const snapshotAsignaciones = getSnapshotAsignaciones(pub.snapshot);
          if (snapshotAsignaciones) {
            return snapshotAsignaciones.filter((a) => a.docenteId === input.docenteId);
          }
        }
      }

      const role = ctx.session.role;
      const isPrivileged = role === 'ADMIN' || role === 'SECRETARIA_ACADEMICA' || role === 'DIRECTOR_ESCUELA' || role === 'DIRECTOR_DEPARTAMENTO' || role === 'DECANO';
      const isSelf = ctx.session.docenteId === input.docenteId;

      const periodo = await ctx.prisma.periodoAcademico.findUnique({
        where: { id: input.periodoId },
        select: { estado: true }
      });
      const isPublished = periodo?.estado === 'APROBADO' || periodo?.estado === 'FINALIZADO';

      const where: Prisma.AsignacionWhereInput = { docenteId: input.docenteId, periodoId: input.periodoId };

      if (!isPrivileged && !isSelf && !isPublished) {
        const publishedSchools = await ctx.prisma.procesoHorarioEscuela.findMany({
          where: { periodoId: input.periodoId, estado: 'PUBLICADO_PRELIMINAR' },
          select: { escuelaId: true },
        });
        const publishedEscuelaIds = publishedSchools.map(p => p.escuelaId);
        if (publishedEscuelaIds.length === 0) {
          return [];
        }
        where.grupo = {
          curso: {
            cursoCurriculas: {
              some: {
                curricula: {
                  escuelaId: { in: publishedEscuelaIds }
                }
              }
            }
          }
        };
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
      const isPrivileged = [
        'ADMIN',
        'SECRETARIA_ACADEMICA',
        'DIRECTOR_ESCUELA',
        'DECANO',
        'DIRECTOR_DEPARTAMENTO',
        'SECRETARIA_DEPARTAMENTO',
      ].includes(ctx.session.role);
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
  manualOptions: secretariaEscuelaProcedure
    .input(z.object({ docenteId: z.string(), periodoId: z.string() }))
    .query(async ({ ctx, input }) => {
      const managedEscuelaIds = await getManagedEscuelaIds(ctx.prisma, ctx.session);
      const grupoScope = buildEscuelaScopedGrupoWhere(managedEscuelaIds);

      const [cargas, asignaciones] = await Promise.all([
        ctx.prisma.asignacionCargaLectiva.findMany({
          where: {
            periodoId: input.periodoId,
            OR: [{ docenteId: input.docenteId }, { docenteCompartidoId: input.docenteId }],
            grupo: {
              periodoAcademicoId: input.periodoId,
              ...grupoScope,
            },
          },
          include: {
            docente: { select: { id: true, nombre: true } },
            docenteCompartido: { select: { id: true, nombre: true } },
            grupo: {
              include: {
                curso: { select: { id: true, codigo: true, nombre: true, ciclo: true } },
                demandaLinea: {
                  include: {
                    demanda: {
                      include: {
                        escuela: { select: { id: true, nombre: true } },
                      },
                    },
                  },
                },
              },
            },
          },
          orderBy: [{ createdAt: 'asc' }],
        }),
        ctx.prisma.asignacion.findMany({
          where: { docenteId: input.docenteId, periodoId: input.periodoId },
          select: { grupoId: true, tipo: true },
        }),
      ]);

      const scheduledByComponent = new Map<string, number>();
      asignaciones.forEach((asignacion) => {
        const key = `${asignacion.grupoId}::${asignacion.tipo}`;
        scheduledByComponent.set(key, (scheduledByComponent.get(key) ?? 0) + 1);
      });

      return cargas.map((carga) => {
        const key = `${carga.grupoId}::${carga.tipo}`;
        const scheduledBlocks = scheduledByComponent.get(key) ?? 0;
        const effectiveDocente =
          carga.docenteId === input.docenteId
            ? carga.docente
            : carga.docenteCompartido ?? carga.docente;

        return {
          cargaLectivaId: carga.id,
          docenteId: input.docenteId,
          docenteNombre: effectiveDocente.nombre,
          grupoId: carga.grupoId,
          grupoNombre: carga.grupo.nombre,
          tipo: carga.tipo,
          horasAsignadas: carga.horasAsignadas,
          grupoLaboratorio: carga.grupoLaboratorio,
          rol: carga.rol,
          scheduledBlocks,
          remainingBlocks: Math.max(0, carga.horasAsignadas - scheduledBlocks),
          curso: carga.grupo.curso,
          escuela: carga.grupo.demandaLinea?.demanda?.escuela ?? null,
        };
      });
    }),

  create: secretariaEscuelaProcedure
    .input(z.object({
      docenteId: z.string(),
      aulaId: z.string(),
      grupoId: z.string(),
      franjaHorariaId: z.string(),
      periodoId: z.string(),
      tipo: z.enum(['TEORIA', 'PRACTICA', 'LABORATORIO']),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertFacultyPeriodNotPublished(ctx.prisma, { grupoId: input.grupoId, periodoId: input.periodoId });
      await assertHorarioNotLocked(ctx.prisma, input.grupoId, input.periodoId);
      await assertCanManageHorarioForGrupo(ctx.prisma, ctx.session, input.grupoId);
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

  delete: secretariaEscuelaProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.prisma.asignacion.findUniqueOrThrow({
        where: { id: input.id },
        select: { grupoId: true, periodoId: true },
      });
      await assertFacultyPeriodNotPublished(ctx.prisma, { grupoId: existing.grupoId, periodoId: existing.periodoId });
      await assertHorarioNotLocked(ctx.prisma, existing.grupoId, existing.periodoId);
      await assertCanManageHorarioForGrupo(ctx.prisma, ctx.session, existing.grupoId);
      return ctx.prisma.asignacion.delete({ where: { id: input.id } });
    }),

  update: secretariaEscuelaProcedure
    .input(z.object({
      id: z.string(),
      aulaId: z.string(),
      franjaHorariaId: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const service = new AvailabilityService(ctx.prisma);
      const asignacion = await ctx.prisma.asignacion.findUniqueOrThrow({ where: { id: input.id } });
      await assertFacultyPeriodNotPublished(ctx.prisma, { grupoId: asignacion.grupoId, periodoId: asignacion.periodoId });
      await assertHorarioNotLocked(ctx.prisma, asignacion.grupoId, asignacion.periodoId);
      await assertCanManageHorarioForGrupo(ctx.prisma, ctx.session, asignacion.grupoId);

      // Validate against all constraints
      const validation = await service.validateSlotSelection(
        asignacion.docenteId,
        input.aulaId,
        asignacion.grupoId,
        input.franjaHorariaId,
        asignacion.periodoId
      );

      if (!validation.valid) {
        throw new Error(validation.reasons.join(', '));
      }

      return ctx.prisma.asignacion.update({
        where: { id: input.id },
        data: {
          aulaId: input.aulaId,
          franjaHorariaId: input.franjaHorariaId,
        },
      });
    }),

  autoGenerate: secretariaEscuelaProcedure
    .input(z.object({
      periodoId: z.string(),
      overwrite: z.boolean().optional().default(true),
    }))
    .mutation(async ({ ctx, input }) => {
      const managedEscuelaIds = await getManagedEscuelaIds(ctx.prisma, ctx.session);
      const grupoScope = buildEscuelaScopedGrupoWhere(managedEscuelaIds);
      if (managedEscuelaIds !== null && managedEscuelaIds.length > 0) {
        for (const escId of managedEscuelaIds) {
          await assertFacultyPeriodNotPublished(ctx.prisma, { escuelaId: escId, periodoId: input.periodoId });
        }
      }
      if (managedEscuelaIds !== null) {
        const published = await ctx.prisma.procesoHorarioEscuela.findFirst({
          where: {
            escuelaId: { in: managedEscuelaIds },
            periodoId: input.periodoId,
            estado: 'PUBLICADO_PRELIMINAR',
          },
        });
        if (published) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'El horario preliminar ya está publicado y bloqueado.',
          });
        }
      }
      console.log(`[TRPC] autoGenerate iniciado. Periodo: ${input.periodoId}`);
      try {
        // 1. Fetch all data needed for the engine
        const [docentes, grupos, aulas, franjas, docenteGrupos, restricciones, mantenimientos, disponibilidades, asignacionesCarga] = await Promise.all([
          ctx.prisma.docente.findMany({ where: { activo: true } }),
          ctx.prisma.grupo.findMany({ 
            where: { periodoAcademicoId: input.periodoId, ...grupoScope },
            include: { curso: true }
          }),
          ctx.prisma.aula.findMany(),
          ctx.prisma.franjaHoraria.findMany(),
          ctx.prisma.docenteGrupo.findMany({
            where: { grupo: { periodoAcademicoId: input.periodoId, ...grupoScope } }
          }),
          ctx.prisma.restriccionDocente.findMany(),
          ctx.prisma.mantenimientoAula.findMany(),
          ctx.prisma.disponibilidadDocente.findMany({
            where: { periodoId: input.periodoId },
          }),
          ctx.prisma.asignacionCargaLectiva.findMany({
            where: {
              periodoId: input.periodoId,
              grupo: {
                periodoAcademicoId: input.periodoId,
                ...grupoScope,
              },
            }
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
        const hardBlockedDocenteSlots = new Set<string>();
        const blockedDocenteGrupoSlots = new Set<string>();
        const blockedDocenteGrupoTipoSlots = new Set<string>();
        restricciones.forEach(r => {
          hardBlockedDocenteSlots.add(`${r.docenteId}::${r.franjaHorariaId}`);
        });

        // 1. Process general availability (grupoId is null)
        const generalAvail = disponibilidades.filter(d => !d.grupoId);
        const docentesWithGeneralAvail = new Set(generalAvail.map(d => d.docenteId));
        const generalAvailMap = new Map<string, Set<string>>();
        generalAvail.forEach(d => {
          const set = generalAvailMap.get(d.docenteId) || new Set<string>();
          set.add(d.franjaHorariaId);
          generalAvailMap.set(d.docenteId, set);
        });

        docentes.forEach(docente => {
          if (docentesWithGeneralAvail.has(docente.id)) {
            const availableSet = generalAvailMap.get(docente.id)!;
            franjas.forEach(f => {
              if (!availableSet.has(f.id)) {
                blockedDocenteSlots.add(`${docente.id}::${f.id}`);
              }
            });
          }
        });

        // 2. Process specific availability (grupoId is not null, tipo is null)
        const specificAvail = disponibilidades.filter(d => d.grupoId && !d.tipo);
        const docenteGroupsWithSpecificAvail = new Set(specificAvail.map(d => `${d.docenteId}::${d.grupoId}`));
        const specificAvailMap = new Map<string, Set<string>>();
        specificAvail.forEach(d => {
          const key = `${d.docenteId}::${d.grupoId}`;
          const set = specificAvailMap.get(key) || new Set<string>();
          set.add(d.franjaHorariaId);
          specificAvailMap.set(key, set);
        });

        docenteGroupsWithSpecificAvail.forEach(key => {
          const [docenteId, grupoId] = key.split('::');
          const availableSet = specificAvailMap.get(key)!;
          franjas.forEach(f => {
            if (!availableSet.has(f.id)) {
              blockedDocenteGrupoSlots.add(`${docenteId}::${grupoId}::${f.id}`);
            }
          });
        });

        // 3. Process granular availability (grupoId is not null, tipo is not null)
        const granularAvail = disponibilidades.filter(d => d.grupoId && d.tipo);
        const docenteGroupTypesWithGranularAvail = new Set(granularAvail.map(d => `${d.docenteId}::${d.grupoId}::${d.tipo}`));
        const granularAvailMap = new Map<string, Set<string>>();
        granularAvail.forEach(d => {
          const key = `${d.docenteId}::${d.grupoId}::${d.tipo}`;
          const set = granularAvailMap.get(key) || new Set<string>();
          set.add(d.franjaHorariaId);
          granularAvailMap.set(key, set);
        });

        docenteGroupTypesWithGranularAvail.forEach(key => {
          const [docenteId, grupoId, tipo] = key.split('::');
          const availableSet = granularAvailMap.get(key)!;
          franjas.forEach(f => {
            if (!availableSet.has(f.id)) {
              blockedDocenteGrupoTipoSlots.add(`${docenteId}::${grupoId}::${tipo}::${f.id}`);
            }
          });
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
          hardBlockedDocenteSlots,
          blockedDocenteGrupoSlots,
          blockedDocenteGrupoTipoSlots,
          blockedAulaSlots: new Set(mantenimientos.map(m => `${m.aulaId}::${m.franjaHorariaId}`)),
          existingAssignments: [] // Start from zero on mass generate
        };

        const engine = new ScheduleEngine(engineInput);
        const result = engine.generate();

        const adjustedCountByDocente = new Map<string, number>();
        result.assignments.forEach((assignment) => {
          if (!assignment.ajustadaPorCruce) return;
          adjustedCountByDocente.set(
            assignment.docenteId,
            (adjustedCountByDocente.get(assignment.docenteId) ?? 0) + 1
          );
        });

        for (const [docenteId, adjustedCount] of adjustedCountByDocente) {
          await notifyDocenteScheduleAdjusted(ctx.prisma, docenteId, input.periodoId, adjustedCount);
        }

        // Trigger notifications for viable gaps
        for (const item of result.unassigned) {
          if (item.viableGaps && item.viableGaps.length > 0) {
            const workloads = engineInput.grupos.find(g => g.id === item.grupoId)?.workloads;
            const docenteId = workloads?.find(w => w.tipo === item.tipo)?.docenteId;
            if (docenteId) {
              await notifyDocenteViableGaps(
                ctx.prisma,
                docenteId,
                item.grupoId,
                item.tipo,
                item.viableGaps,
                input.periodoId
              );
            }
          }
        }

        if (result.assignments.length === 0) {
          return {
            success: false,
            reason: result.unassigned[0]?.reason || 'El motor no pudo generar ninguna asignación válida.',
            createdCount: 0,
            unassignedCount: result.unassigned.length,
            unassigned: result.unassigned,
            stats: result.stats,
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
          unassigned: result.unassigned,
          stats: result.stats,
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
      const managedEscuelaIds = await getManagedEscuelaIds(ctx.prisma, ctx.session);
      if (managedEscuelaIds !== null && managedEscuelaIds.length > 0) {
        for (const escId of managedEscuelaIds) {
          await assertFacultyPeriodNotPublished(ctx.prisma, { escuelaId: escId, periodoId: input.periodoId });
        }
      }
      const managedDepartamentoIds = await getManagedDepartamentoIds(ctx.prisma, ctx.session);
      if (managedDepartamentoIds !== null && managedDepartamentoIds.length > 0) {
        for (const deptId of managedDepartamentoIds) {
          await assertFacultyPeriodNotPublished(ctx.prisma, { departamentoId: deptId, periodoId: input.periodoId });
        }
      }
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
  confirmTeacherSchedule: secretariaEscuelaProcedure
    .input(z.object({ docenteId: z.string(), periodoId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await assertFacultyPeriodNotPublished(ctx.prisma, { docenteId: input.docenteId, periodoId: input.periodoId });
      const assignments = await ctx.prisma.asignacion.findMany({
        where: { docenteId: input.docenteId, periodoId: input.periodoId },
        select: { grupoId: true },
      });
      for (const grupoId of [...new Set(assignments.map((assignment) => assignment.grupoId))]) {
        await assertCanManageHorarioForGrupo(ctx.prisma, ctx.session, grupoId);
      }
      return ctx.prisma.asignacion.updateMany({
        where: { docenteId: input.docenteId, periodoId: input.periodoId },
        data: { confirmado: true }
      });
    }),

  /** Send whole schedule to Director for revision */
  sendToRevision: secretariaEscuelaProcedure
    .input(z.object({ periodoId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const managedEscuelaIds = await getManagedEscuelaIds(ctx.prisma, ctx.session);
      if (managedEscuelaIds !== null && managedEscuelaIds.length > 0) {
        for (const escId of managedEscuelaIds) {
          await assertFacultyPeriodNotPublished(ctx.prisma, { escuelaId: escId, periodoId: input.periodoId });
        }
      }
      return ctx.prisma.periodoAcademico.update({
        where: { id: input.periodoId },
        data: { estado: 'REVISION', comentariosDirector: null }
      });
    }),

  /** Approve schedule (Director only) */
  approveSchedule: directorProcedure
    .input(z.object({ periodoId: z.string(), comentarios: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const managedEscuelaIds = await getManagedEscuelaIds(ctx.prisma, ctx.session);
      if (managedEscuelaIds !== null && managedEscuelaIds.length > 0) {
        for (const escId of managedEscuelaIds) {
          await assertFacultyPeriodNotPublished(ctx.prisma, { escuelaId: escId, periodoId: input.periodoId });
        }
      }
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
      const managedEscuelaIds = await getManagedEscuelaIds(ctx.prisma, ctx.session);
      if (managedEscuelaIds !== null && managedEscuelaIds.length > 0) {
        for (const escId of managedEscuelaIds) {
          await assertFacultyPeriodNotPublished(ctx.prisma, { escuelaId: escId, periodoId: input.periodoId });
        }
      }
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
      const managedEscuelaIds = await getManagedEscuelaIds(ctx.prisma, ctx.session);
      if (managedEscuelaIds !== null && managedEscuelaIds.length > 0) {
        for (const escId of managedEscuelaIds) {
          await assertFacultyPeriodNotPublished(ctx.prisma, { escuelaId: escId, periodoId: input.periodoId });
        }
      }
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
  docentesByHierarchy: secretariaEscuelaProcedure
    .input(z.object({ periodoId: z.string() }))
    .query(async ({ ctx, input }) => {
      const managedEscuelaIds = await getManagedEscuelaIds(ctx.prisma, ctx.session);
      const grupoScope = buildEscuelaScopedGrupoWhere(managedEscuelaIds);
      const docentes = await ctx.prisma.docente.findMany({
        where: {
          activo: true,
          ...(managedEscuelaIds === null
            ? {}
            : {
                asignacionesCarga: {
                  some: {
                    periodoId: input.periodoId,
                    grupo: grupoScope,
                  },
                },
              }),
        },
        include: {
          _count: {
            select: {
              asignaciones: { where: { periodoId: input.periodoId } }
            }
          }
        }
      });

      const CATEGORIA_ORDER = { PRINCIPAL: 1, ASOCIADO: 2, AUXILIAR: 3, JEFE_PRACTICA: 4 };

      const result = docentes.sort((a, b) => {
        if (CATEGORIA_ORDER[a.categoria] !== CATEGORIA_ORDER[b.categoria]) 
          return CATEGORIA_ORDER[a.categoria] - CATEGORIA_ORDER[b.categoria];
        return a.antiguedad.getTime() - b.antiguedad.getTime();
      });

      console.log(`[DocentesByHierarchy] Found ${result.length} active docentes`);
      return result;
    }),

  /** Suggest assignments for a specific docente based on their assigned groups and availability */
  suggestDocenteAssignments: secretariaEscuelaProcedure
    .input(z.object({ periodoId: z.string(), docenteId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      console.log(`[TRPC] suggestDocenteAssignments para docente: ${input.docenteId}`);
      try {
        const managedEscuelaIds = await getManagedEscuelaIds(ctx.prisma, ctx.session);
        const grupoScope = buildEscuelaScopedGrupoWhere(managedEscuelaIds);
        // 1. Fetch all data needed for this specific docente
        const [docente, docenteGrupos, aulas, franjas, restricciones, mantenimientos, disponibilidades, existingAssignments, asignacionesCarga] = await Promise.all([
          ctx.prisma.docente.findUniqueOrThrow({ where: { id: input.docenteId } }),
          ctx.prisma.docenteGrupo.findMany({
            where: { docenteId: input.docenteId, grupo: { periodoAcademicoId: input.periodoId, ...grupoScope } },
            include: { grupo: { include: { curso: true } } }
          }),
          ctx.prisma.aula.findMany(),
          ctx.prisma.franjaHoraria.findMany(),
          ctx.prisma.restriccionDocente.findMany({ where: { docenteId: input.docenteId } }),
          ctx.prisma.mantenimientoAula.findMany(),
          ctx.prisma.disponibilidadDocente.findMany({
            where: { docenteId: input.docenteId, periodoId: input.periodoId },
          }),
          ctx.prisma.asignacion.findMany({
            where: {
              periodoId: input.periodoId,
              grupo: {
                periodoAcademicoId: input.periodoId,
                ...grupoScope,
              },
            },
          }),
          ctx.prisma.asignacionCargaLectiva.findMany({
            where: {
              periodoId: input.periodoId,
              OR: [{ docenteId: input.docenteId }, { docenteCompartidoId: input.docenteId }],
              grupo: {
                periodoAcademicoId: input.periodoId,
                ...grupoScope,
              },
            }
          })
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
            requiereLaboratorio: dg.grupo.curso.requiereLaboratorio,
            workloads: asignacionesCarga
              .filter(ac => ac.grupoId === dg.grupo.id)
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
          docenteGrupoMap: new Map([[docente.id, docenteGrupos.map(dg => dg.grupoId)]]),
          blockedDocenteSlots: new Set<string>(),
          hardBlockedDocenteSlots: new Set<string>(),
          blockedDocenteGrupoSlots: new Set<string>(),
          blockedDocenteGrupoTipoSlots: new Set<string>(),
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

        // 1. Process general availability (grupoId is null)
        const generalAvail = disponibilidades.filter(d => !d.grupoId);
        if (generalAvail.length > 0) {
          const positiveSet = new Set(generalAvail.map(d => d.franjaHorariaId));
          franjas.forEach(f => {
            if (!positiveSet.has(f.id)) {
              engineInput.blockedDocenteSlots.add(`${docente.id}::${f.id}`);
            }
          });
        }

        // 2. Process specific availability (grupoId is not null, tipo is null)
        const specificAvail = disponibilidades.filter(d => d.grupoId && !d.tipo);
        if (specificAvail.length > 0) {
          const groupsWithSpecAvail = new Set(specificAvail.map(d => d.grupoId));
          groupsWithSpecAvail.forEach(gId => {
            const positiveSetForGroup = new Set(
              specificAvail.filter(d => d.grupoId === gId).map(d => d.franjaHorariaId)
            );
            franjas.forEach(f => {
              if (!positiveSetForGroup.has(f.id)) {
                engineInput.blockedDocenteGrupoSlots.add(`${docente.id}::${gId}::${f.id}`);
              }
            });
          });
        }

        // 3. Process granular availability (grupoId is not null, tipo is not null)
        const granularAvail = disponibilidades.filter(d => d.grupoId && d.tipo);
        if (granularAvail.length > 0) {
          const groupTypesWithGranularAvail = new Set(granularAvail.map(d => `${d.grupoId}::${d.tipo}`));
          groupTypesWithGranularAvail.forEach(key => {
            const [gId, tipo] = key.split('::');
            const positiveSetForGroupType = new Set(
              granularAvail.filter(d => d.grupoId === gId && d.tipo === tipo).map(d => d.franjaHorariaId)
            );
            franjas.forEach(f => {
              if (!positiveSetForGroupType.has(f.id)) {
                engineInput.blockedDocenteGrupoTipoSlots.add(`${docente.id}::${gId}::${tipo}::${f.id}`);
              }
            });
          });
        }

        restricciones.forEach(r => {
          engineInput.hardBlockedDocenteSlots.add(`${docente.id}::${r.franjaHorariaId}`);
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
  applySuggestions: secretariaEscuelaProcedure
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
      await assertFacultyPeriodNotPublished(ctx.prisma, { docenteId: input.docenteId, periodoId: input.periodoId });
      if (input.assignments.length > 0) {
        const grupoIds = [...new Set(input.assignments.map((assignment) => assignment.grupoId))];
        for (const grupoId of grupoIds) {
          await assertCanManageHorarioForGrupo(ctx.prisma, ctx.session, grupoId);
          await assertHorarioNotLocked(ctx.prisma, grupoId, input.periodoId);
        }
      }
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

  getProceso: protectedProcedure
    .input(z.object({ escuelaId: z.string(), periodoId: z.string() }))
    .query(async ({ ctx, input }) => {
      await assertCanAccessEscuela(ctx.prisma, ctx.session, input.escuelaId);

      let proc = await ctx.prisma.procesoHorarioEscuela.findUnique({
        where: {
          escuelaId_periodoId: {
            escuelaId: input.escuelaId,
            periodoId: input.periodoId,
          },
        },
      });

      if (!proc) {
        proc = await ctx.prisma.procesoHorarioEscuela.create({
          data: {
            escuelaId: input.escuelaId,
            periodoId: input.periodoId,
            estado: 'BORRADOR',
          },
        });
      }

      return proc;
    }),

  submitProceso: secretariaEscuelaProcedure
    .input(z.object({ escuelaId: z.string(), periodoId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await assertCanAccessEscuela(ctx.prisma, ctx.session, input.escuelaId);
      await assertFacultyPeriodNotPublished(ctx.prisma, { escuelaId: input.escuelaId, periodoId: input.periodoId });

      const proc = await ctx.prisma.procesoHorarioEscuela.findUniqueOrThrow({
        where: {
          escuelaId_periodoId: {
            escuelaId: input.escuelaId,
            periodoId: input.periodoId,
          },
        },
      });

      if (proc.estado === 'PUBLICADO_PRELIMINAR') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'El proceso ya está publicado preliminarmente y no se puede editar.',
        });
      }

      return ctx.prisma.procesoHorarioEscuela.update({
        where: { id: proc.id },
        data: { estado: 'REVISION' },
      });
    }),

  reviewProceso: directorProcedure
    .input(z.object({
      escuelaId: z.string(),
      periodoId: z.string(),
      aprobado: z.boolean(),
      observacion: z.string().nullable().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertCanAccessEscuela(ctx.prisma, ctx.session, input.escuelaId);
      await assertFacultyPeriodNotPublished(ctx.prisma, { escuelaId: input.escuelaId, periodoId: input.periodoId });

      const proc = await ctx.prisma.procesoHorarioEscuela.findUniqueOrThrow({
        where: {
          escuelaId_periodoId: {
            escuelaId: input.escuelaId,
            periodoId: input.periodoId,
          },
        },
      });

      const nuevoEstado = input.aprobado ? 'APROBADO' : 'OBSERVADO';

      return ctx.prisma.procesoHorarioEscuela.update({
        where: { id: proc.id },
        data: {
          estado: nuevoEstado,
          observacion: input.observacion || null,
          revisadoPorId: ctx.session.id,
          revisadoEn: new Date(),
        },
      });
    }),

  publishPreliminary: directorProcedure
    .input(z.object({ escuelaId: z.string(), periodoId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await assertCanAccessEscuela(ctx.prisma, ctx.session, input.escuelaId);
      await assertFacultyPeriodNotPublished(ctx.prisma, { escuelaId: input.escuelaId, periodoId: input.periodoId });

      const proc = await ctx.prisma.procesoHorarioEscuela.findUniqueOrThrow({
        where: {
          escuelaId_periodoId: {
            escuelaId: input.escuelaId,
            periodoId: input.periodoId,
          },
        },
      });

      if (proc.estado !== 'APROBADO') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'El proceso debe estar aprobado por el director antes de ser publicado.',
        });
      }

      return ctx.prisma.procesoHorarioEscuela.update({
        where: { id: proc.id },
        data: {
          estado: 'PUBLICADO_PRELIMINAR',
          publicadoPorId: ctx.session.id,
          publicadoEn: new Date(),
        },
      });
    }),
});
