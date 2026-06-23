import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { Prisma } from '@/generated/prisma/client';
import type { PrismaClient, TipoAsignacion } from '@/generated/prisma/client';
import {
  createTRPCRouter,
  protectedProcedure,
  secretariaDepartamentoProcedure,
  directorDepartamentoProcedure,
} from '../init';
import { validateAll, validatePeriodMutable } from '@/server/services/workload-validator';
import {
  assertCanAccessDepartamento,
  assertCanAccessDocenteDepartamento,
  getManagedDepartamentoIds,
  assertFacultyPeriodNotPublished,
} from '../policy';

async function assertDistribucionNotApproved(prisma: PrismaClient, docenteId: string, periodoId: string) {
  const docente = await prisma.docente.findUnique({
    where: { id: docenteId },
    select: { departamentoId: true },
  });
  if (docente?.departamentoId) {
    const dist = await prisma.distribucionLectiva.findUnique({
      where: {
        departamentoId_periodoId: {
          departamentoId: docente.departamentoId,
          periodoId,
        },
      },
      select: { estado: true },
    });
    if (dist?.estado === 'APROBADA') {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'La distribución de carga académica para este departamento ya está aprobada y bloqueada.',
      });
    }
  }
}

const assignInput = z.object({
  docenteId: z.string().min(1),
  grupoId: z.string().min(1),
  periodoId: z.string().min(1),
  tipo: z.enum(['TEORIA', 'PRACTICA', 'LABORATORIO']),
  horasAsignadas: z.number().int().min(1).max(40),
  compartido: z.boolean().optional().default(false),
  docenteCompartidoId: z.string().optional(),
});

async function assertLectivePeriodMutable(prisma: PrismaClient, periodoId: string) {
  const periodo = await prisma.periodoAcademico.findUniqueOrThrow({
    where: { id: periodoId },
    select: { estado: true },
  });
  const result = validatePeriodMutable(periodo.estado, 'carga lectiva');
  if (!result.valid) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: result.message });
  }
}

async function assertGrupoBelongsToPeriodo(prisma: PrismaClient, grupoId: string, periodoId: string) {
  const grupo = await prisma.grupo.findUniqueOrThrow({
    where: { id: grupoId },
    select: { periodoAcademicoId: true },
  });

  if (grupo.periodoAcademicoId !== periodoId) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'El grupo no pertenece al periodo académico indicado',
    });
  }
}

async function assertUniqueGrupoPeriodoTipo(
  prisma: PrismaClient,
  input: { grupoId: string; periodoId: string; tipo: TipoAsignacion },
  excludeAsignacionId?: string
) {
  const existing = await prisma.asignacionCargaLectiva.findFirst({
    where: {
      grupoId: input.grupoId,
      periodoId: input.periodoId,
      tipo: input.tipo,
      ...(excludeAsignacionId ? { id: { not: excludeAsignacionId } } : {}),
    },
    select: {
      id: true,
      docente: { select: { nombre: true } },
    },
  });

  if (existing) {
    throw new TRPCError({
      code: 'CONFLICT',
      message: `El grupo ya tiene carga ${input.tipo} asignada para este periodo${existing.docente?.nombre ? ` a ${existing.docente.nombre}` : ''}`,
    });
  }
}

export const cargaLectivaRouter = createTRPCRouter({
  list: protectedProcedure
    .input(
      z.object({
        periodoId: z.string().optional(),
        departamentoId: z.string().optional(),
        docenteId: z.string().optional(),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      const where: Prisma.AsignacionCargaLectivaWhereInput = {};
      if (input?.periodoId) where.periodoId = input.periodoId;
      if (input?.docenteId) where.docenteId = input.docenteId;
      if (input?.departamentoId) {
        await assertCanAccessDepartamento(ctx.prisma, ctx.session, input.departamentoId);
        where.docente = { departamentoId: input.departamentoId };
      }

      if (ctx.session.role === 'DOCENTE') {
        if (!ctx.session.docenteId) {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'El usuario docente no tiene un ID de docente asociado.' });
        }
        where.OR = [
          { docenteId: ctx.session.docenteId },
          { docenteCompartidoId: ctx.session.docenteId }
        ];
      } else if (!input?.departamentoId) {
        const managedDepartamentoIds = await getManagedDepartamentoIds(ctx.prisma, ctx.session);
        if (managedDepartamentoIds !== null) {
          where.docente = { departamentoId: { in: managedDepartamentoIds } };
        }
      }

      return ctx.prisma.asignacionCargaLectiva.findMany({
        where,
        include: {
          docente: { select: { id: true, nombre: true, email: true, categoria: true, modalidad: true, horasContrato: true } },
          grupo: { include: { curso: { select: { id: true, codigo: true, nombre: true, creditos: true, horasTeoria: true, horasPractica: true, horasLaboratorio: true, ciclo: true, numGruposLaboratorio: true } } } },
          periodo: { select: { id: true, nombre: true } },
          docenteCompartido: { select: { id: true, nombre: true } },
        },
        orderBy: { createdAt: 'desc' },
      });
    }),

  byDocente: protectedProcedure
    .input(z.object({ docenteId: z.string(), periodoId: z.string() }))
    .query(async ({ ctx, input }) => {
      if (ctx.session.role === 'DOCENTE' && ctx.session.docenteId !== input.docenteId) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'No tiene permiso para ver la carga lectiva de otro docente' });
      }
      if (ctx.session.role !== 'DOCENTE') {
        await assertCanAccessDocenteDepartamento(ctx.prisma, ctx.session, input.docenteId);
      }

      const [asignaciones, cargaNoLectiva] = await Promise.all([
        ctx.prisma.asignacionCargaLectiva.findMany({
          where: {
            periodoId: input.periodoId,
            OR: [
              { docenteId: input.docenteId },
              { docenteCompartidoId: input.docenteId }
            ]
          },
          include: {
            docente: { select: { id: true, nombre: true } },
            grupo: { include: { curso: { select: { id: true, codigo: true, nombre: true, creditos: true, horasTeoria: true, horasPractica: true, horasLaboratorio: true, ciclo: true } } } },
            docenteCompartido: { select: { id: true, nombre: true } },
          },
          orderBy: { createdAt: 'asc' },
        }),
        ctx.prisma.cargaNoLectiva.findMany({
          where: { docenteId: input.docenteId, periodoId: input.periodoId },
        }),
      ]);

      const totalLectivas = asignaciones.reduce((sum, a) => sum + a.horasAsignadas, 0);
      const totalNoLectivas = cargaNoLectiva.reduce((sum, c) => sum + c.horas, 0);

      return {
        asignaciones,
        cargaNoLectiva,
        totalLectivas,
        totalNoLectivas,
        totalGeneral: totalLectivas + totalNoLectivas,
      };
    }),

  assign: secretariaDepartamentoProcedure
    .input(assignInput)
    .mutation(async ({ ctx, input }) => {
      await assertCanAccessDocenteDepartamento(ctx.prisma, ctx.session, input.docenteId);
      await assertFacultyPeriodNotPublished(ctx.prisma, { docenteId: input.docenteId, periodoId: input.periodoId });
      await assertDistribucionNotApproved(ctx.prisma, input.docenteId, input.periodoId);
      await assertLectivePeriodMutable(ctx.prisma, input.periodoId);
      await assertGrupoBelongsToPeriodo(ctx.prisma, input.grupoId, input.periodoId);

      const grupo = await ctx.prisma.grupo.findUniqueOrThrow({
        where: { id: input.grupoId },
        include: { curso: true },
      });

      // Check if there's an existing assignment for this group, period, and type
      const existing = await ctx.prisma.asignacionCargaLectiva.findFirst({
        where: {
          grupoId: input.grupoId,
          periodoId: input.periodoId,
          tipo: input.tipo,
        },
        include: { docente: { select: { nombre: true } } },
      });

      if (existing && existing.docenteId !== input.docenteId) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: `El grupo ya tiene carga ${input.tipo} asignada para este periodo${existing.docente?.nombre ? ` a ${existing.docente.nombre}` : ''}`,
        });
      }

      const horasFinales = existing ? existing.horasAsignadas + input.horasAsignadas : input.horasAsignadas;

      // Course hours limit check
      let maxHoras = 0;
      if (input.tipo === 'TEORIA') maxHoras = grupo.curso.horasTeoria;
      else if (input.tipo === 'PRACTICA') maxHoras = grupo.curso.horasPractica;
      else if (input.tipo === 'LABORATORIO') maxHoras = grupo.curso.horasLaboratorio;

      if (horasFinales > maxHoras) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Las horas asignadas (${horasFinales}h) exceden el límite del curso para ${input.tipo} (${maxHoras}h)`,
        });
      }

      const validation = await validateAll(
        ctx.prisma,
        input.docenteId,
        input.periodoId,
        horasFinales,
        input.tipo,
        { excludeAsignacionId: existing?.id }
      );
      if (!validation.valid) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: validation.message });
      }

      try {
        if (existing) {
          // Update existing assignment by adding hours
          return await ctx.prisma.asignacionCargaLectiva.update({
            where: { id: existing.id },
            data: {
              horasAsignadas: horasFinales,
              compartido: input.compartido ?? existing.compartido,
              docenteCompartidoId: input.docenteCompartidoId ?? existing.docenteCompartidoId,
            },
            include: {
              docente: { select: { id: true, nombre: true } },
              grupo: { include: { curso: { select: { codigo: true, nombre: true } } } },
              docenteCompartido: { select: { id: true, nombre: true } },
            },
          });
        } else {
          // Create new assignment
          return await ctx.prisma.asignacionCargaLectiva.create({
            data: input,
            include: {
              docente: { select: { id: true, nombre: true } },
              grupo: { include: { curso: { select: { codigo: true, nombre: true } } } },
              docenteCompartido: { select: { id: true, nombre: true } },
            },
          });
        }
      } catch (error: unknown) {
        if (error && typeof error === 'object' && 'code' in error && (error as { code: string }).code === 'P2002') {
          throw new TRPCError({ code: 'CONFLICT', message: 'Asignación duplicada: ya existe este grupo-periodo-tipo' });
        }
        throw error;
      }
    }),

  assignCursoCompleto: secretariaDepartamentoProcedure
    .input(
      z.object({
        docenteId: z.string().min(1),
        grupoId: z.string().min(1),
        periodoId: z.string().min(1),
        teoria: z.object({
          horas: z.number().int().nonnegative(),
          compartido: z.boolean(),
          docenteCompartidoId: z.string().nullable().optional(),
          horasCompartido: z.number().int().nonnegative().optional(),
        }),
        practica: z.object({
          horas: z.number().int().nonnegative(),
          compartido: z.boolean(),
          docenteCompartidoId: z.string().nullable().optional(),
          horasCompartido: z.number().int().nonnegative().optional(),
        }),
        laboratorio: z.object({
          horas: z.number().int().nonnegative(),
          compartido: z.boolean(),
          docenteCompartidoId: z.string().nullable().optional(),
          horasCompartido: z.number().int().nonnegative().optional(),
          gruposLaboratorio: z.array(z.number().int().min(1)).optional().default([]),
          gruposLaboratorioCompartido: z.array(z.number().int().min(1)).optional().default([]),
        }),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await assertCanAccessDocenteDepartamento(ctx.prisma, ctx.session, input.docenteId);
      await assertFacultyPeriodNotPublished(ctx.prisma, { docenteId: input.docenteId, periodoId: input.periodoId });
      await assertDistribucionNotApproved(ctx.prisma, input.docenteId, input.periodoId);
      await assertLectivePeriodMutable(ctx.prisma, input.periodoId);
      await assertGrupoBelongsToPeriodo(ctx.prisma, input.grupoId, input.periodoId);

      const grupo = await ctx.prisma.grupo.findUniqueOrThrow({
        where: { id: input.grupoId },
        include: { curso: true },
      });

      const numGrupos = grupo.curso.numGruposLaboratorio || 1;

      // 1. Check Course hours limits for each type
      const horasTeoriaTotal = input.teoria.horas + (input.teoria.compartido ? input.teoria.horasCompartido || 0 : 0);
      if (horasTeoriaTotal > grupo.curso.horasTeoria) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Las horas de TEORIA (${horasTeoriaTotal}h) exceden el límite del curso (${grupo.curso.horasTeoria}h)`,
        });
      }

      const horasPracticaTotal = input.practica.horas + (input.practica.compartido ? input.practica.horasCompartido || 0 : 0);
      if (horasPracticaTotal > grupo.curso.horasPractica) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Las horas de PRACTICA (${horasPracticaTotal}h) exceden el límite del curso (${grupo.curso.horasPractica}h)`,
        });
      }

      // Check Laboratory hours limits based on group assignment
      const labHorasPrim = input.laboratorio.horas;
      const labHorasComp = input.laboratorio.compartido ? input.laboratorio.horasCompartido || 0 : 0;
      const horasPorGrupo = grupo.curso.horasLaboratorio;

      if (numGrupos > 1) {
        const expectedPrimGroups = horasPorGrupo > 0 ? Math.ceil(labHorasPrim / horasPorGrupo) : 0;
        if (labHorasPrim > 0 && input.laboratorio.gruposLaboratorio.length !== expectedPrimGroups) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: `Debe seleccionar exactamente ${expectedPrimGroups} grupo(s) de laboratorio para el docente principal`,
          });
        }

        const expectedCompGroups = horasPorGrupo > 0 ? Math.ceil(labHorasComp / horasPorGrupo) : 0;
        if (labHorasComp > 0 && input.laboratorio.gruposLaboratorioCompartido.length !== expectedCompGroups) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: `Debe seleccionar exactamente ${expectedCompGroups} grupo(s) de laboratorio para el docente compartido`,
          });
        }

        // Check for overlaps (disjoint sets)
        const primSet = new Set(input.laboratorio.gruposLaboratorio);
        for (const gComp of input.laboratorio.gruposLaboratorioCompartido) {
          if (primSet.has(gComp)) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: `El Grupo Lab ${gComp} no puede ser asignado a ambos docentes al mismo tiempo`,
            });
          }
        }

        // Check index limit
        for (const gIdx of [...input.laboratorio.gruposLaboratorio, ...input.laboratorio.gruposLaboratorioCompartido]) {
          if (gIdx > numGrupos) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: `El Grupo Lab ${gIdx} excede el número de grupos de laboratorio del curso (${numGrupos})`,
            });
          }
        }

        // Check coverage: all lab groups must be assigned if lab hours exist
        if (horasPorGrupo > 0) {
          const totalSelected = input.laboratorio.gruposLaboratorio.length +
            (input.laboratorio.compartido ? input.laboratorio.gruposLaboratorioCompartido.length : 0);
          if (totalSelected !== numGrupos) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: `Debe asignar todos los grupos de laboratorio del curso (${numGrupos} en total). Asignados actualmente: ${totalSelected}.`,
            });
          }
        }
      } else {
        // Only 1 group, so they share it (directly sum)
        if (labHorasPrim + labHorasComp > horasPorGrupo) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: `Las horas de LABORATORIO (${labHorasPrim + labHorasComp}h) exceden el límite del curso (${horasPorGrupo}h)`,
          });
        }
      }

      // 2. Validate Workload (HT + HP + HL) for the primary docente
      const totalNuevasHoras = input.teoria.horas + input.practica.horas + input.laboratorio.horas;
      if (totalNuevasHoras > 0) {
        const validation = await validateAll(
          ctx.prisma,
          input.docenteId,
          input.periodoId,
          totalNuevasHoras,
          'TEORIA',
          { excludeGrupoId: input.grupoId }
        );
        if (!validation.valid) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: `Docente Principal: ${validation.message}` });
        }
      }

      // 3. Validate Workload for each shared docente (if any)
      const uniqueSharedIds = new Set<string>();
      if (input.teoria.compartido && input.teoria.docenteCompartidoId && (input.teoria.horasCompartido || 0) > 0) {
        uniqueSharedIds.add(input.teoria.docenteCompartidoId);
      }
      if (input.practica.compartido && input.practica.docenteCompartidoId && (input.practica.horasCompartido || 0) > 0) {
        uniqueSharedIds.add(input.practica.docenteCompartidoId);
      }
      if (input.laboratorio.compartido && input.laboratorio.docenteCompartidoId && (input.laboratorio.horasCompartido || 0) > 0) {
        uniqueSharedIds.add(input.laboratorio.docenteCompartidoId);
      }

      for (const sharedId of uniqueSharedIds) {
        await assertCanAccessDocenteDepartamento(ctx.prisma, ctx.session, sharedId);
        
        let sharedHours = 0;
        if (input.teoria.compartido && input.teoria.docenteCompartidoId === sharedId) {
          sharedHours += input.teoria.horasCompartido || 0;
        }
        if (input.practica.compartido && input.practica.docenteCompartidoId === sharedId) {
          sharedHours += input.practica.horasCompartido || 0;
        }
        if (input.laboratorio.compartido && input.laboratorio.docenteCompartidoId === sharedId) {
          sharedHours += input.laboratorio.horasCompartido || 0;
        }

        if (sharedHours > 0) {
          const validation = await validateAll(
            ctx.prisma,
            sharedId,
            input.periodoId,
            sharedHours,
            'TEORIA',
            { excludeGrupoId: input.grupoId }
          );
          if (!validation.valid) {
            throw new TRPCError({ code: 'BAD_REQUEST', message: `Docente Compartido: ${validation.message}` });
          }
        }
      }

      // 4. Save assignments in transaction (delete existing for group+period, then create new)
      return await ctx.prisma.$transaction(async (tx) => {
        // Delete all existing assignments for this group and period
        await tx.asignacionCargaLectiva.deleteMany({
          where: { grupoId: input.grupoId, periodoId: input.periodoId },
        });

        // Helper to insert an assignment
        const insertAsignacion = async (
          docenteId: string,
          tipo: 'TEORIA' | 'PRACTICA' | 'LABORATORIO',
          horas: number,
          compartido: boolean,
          docenteCompartidoId: string | null,
          grupoLaboratorio: number | null
        ) => {
          await tx.asignacionCargaLectiva.create({
            data: {
              docenteId,
              grupoId: input.grupoId,
              periodoId: input.periodoId,
              tipo,
              horasAsignadas: horas,
              compartido,
              docenteCompartidoId,
              grupoLaboratorio,
            },
          });
        };

        // Teoría
        if (input.teoria.horas > 0) {
          await insertAsignacion(
            input.docenteId,
            'TEORIA',
            input.teoria.horas,
            input.teoria.compartido,
            input.teoria.compartido ? input.teoria.docenteCompartidoId || null : null,
            null
          );
        }
        if (input.teoria.compartido && (input.teoria.horasCompartido || 0) > 0 && input.teoria.docenteCompartidoId) {
          await insertAsignacion(
            input.teoria.docenteCompartidoId,
            'TEORIA',
            input.teoria.horasCompartido || 0,
            true,
            input.docenteId,
            null
          );
        }

        // Práctica
        if (input.practica.horas > 0) {
          await insertAsignacion(
            input.docenteId,
            'PRACTICA',
            input.practica.horas,
            input.practica.compartido,
            input.practica.compartido ? input.practica.docenteCompartidoId || null : null,
            null
          );
        }
        if (input.practica.compartido && (input.practica.horasCompartido || 0) > 0 && input.practica.docenteCompartidoId) {
          await insertAsignacion(
            input.practica.docenteCompartidoId,
            'PRACTICA',
            input.practica.horasCompartido || 0,
            true,
            input.docenteId,
            null
          );
        }

        // Laboratorio
        if (input.laboratorio.horas > 0) {
          if (grupo.curso.numGruposLaboratorio > 1 && input.laboratorio.gruposLaboratorio.length > 0) {
            for (const grupoLabIndex of input.laboratorio.gruposLaboratorio) {
              await insertAsignacion(
                input.docenteId,
                'LABORATORIO',
                grupo.curso.horasLaboratorio,
                input.laboratorio.compartido,
                input.laboratorio.compartido ? input.laboratorio.docenteCompartidoId || null : null,
                grupoLabIndex
              );
            }
          } else {
            await insertAsignacion(
              input.docenteId,
              'LABORATORIO',
              input.laboratorio.horas,
              input.laboratorio.compartido,
              input.laboratorio.compartido ? input.laboratorio.docenteCompartidoId || null : null,
              null
            );
          }
        }
        if (input.laboratorio.compartido && (input.laboratorio.horasCompartido || 0) > 0 && input.laboratorio.docenteCompartidoId) {
          if (grupo.curso.numGruposLaboratorio > 1 && input.laboratorio.gruposLaboratorioCompartido.length > 0) {
            for (const grupoLabIndex of input.laboratorio.gruposLaboratorioCompartido) {
              await insertAsignacion(
                input.laboratorio.docenteCompartidoId,
                'LABORATORIO',
                grupo.curso.horasLaboratorio,
                true,
                input.docenteId,
                grupoLabIndex
              );
            }
          } else {
            await insertAsignacion(
              input.laboratorio.docenteCompartidoId,
              'LABORATORIO',
              input.laboratorio.horasCompartido || 0,
              true,
              input.docenteId,
              null
            );
          }
        }

        return { success: true };
      });
    }),

  unassign: secretariaDepartamentoProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.prisma.asignacionCargaLectiva.findUniqueOrThrow({
        where: { id: input.id },
        select: { docenteId: true, periodoId: true },
      });
      await assertFacultyPeriodNotPublished(ctx.prisma, { docenteId: existing.docenteId, periodoId: existing.periodoId });
      await assertCanAccessDocenteDepartamento(ctx.prisma, ctx.session, existing.docenteId);
      await assertDistribucionNotApproved(ctx.prisma, existing.docenteId, existing.periodoId);
      await assertLectivePeriodMutable(ctx.prisma, existing.periodoId);

      return ctx.prisma.asignacionCargaLectiva.delete({ where: { id: input.id } });
    }),

  update: secretariaDepartamentoProcedure
    .input(
      z.object({
        id: z.string(),
        docenteId: z.string().optional(),
        horasAsignadas: z.number().int().min(1).max(40).optional(),
        compartido: z.boolean().optional(),
        docenteCompartidoId: z.string().nullable().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, docenteId: newDocenteId, ...data } = input;
      const existing = await ctx.prisma.asignacionCargaLectiva.findUniqueOrThrow({ 
        where: { id },
        include: { grupo: { include: { curso: true } } }
      });
      await assertFacultyPeriodNotPublished(ctx.prisma, { docenteId: existing.docenteId, periodoId: existing.periodoId });
      await assertCanAccessDocenteDepartamento(ctx.prisma, ctx.session, existing.docenteId);
      await assertDistribucionNotApproved(ctx.prisma, existing.docenteId, existing.periodoId);
      await assertLectivePeriodMutable(ctx.prisma, existing.periodoId);

      // If changing docente, validate the new docente belongs to managed dept
      if (newDocenteId && newDocenteId !== existing.docenteId) {
        await assertCanAccessDocenteDepartamento(ctx.prisma, ctx.session, newDocenteId);
        // Check no conflict: same grupo+periodo+tipo for the new docente
        await assertUniqueGrupoPeriodoTipo(
          ctx.prisma,
          { grupoId: existing.grupoId, periodoId: existing.periodoId, tipo: existing.tipo },
          id
        );
      }

      const effectiveDocenteId = newDocenteId ?? existing.docenteId;

      if (data.horasAsignadas !== undefined) {
        // Course hours limit check
        let maxHoras = 0;
        if (existing.tipo === 'TEORIA') maxHoras = existing.grupo.curso.horasTeoria;
        else if (existing.tipo === 'PRACTICA') maxHoras = existing.grupo.curso.horasPractica;
        else if (existing.tipo === 'LABORATORIO') maxHoras = existing.grupo.curso.horasLaboratorio;

        if (data.horasAsignadas > maxHoras) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: `Las horas asignadas (${data.horasAsignadas}h) exceden el límite del curso para ${existing.tipo} (${maxHoras}h)`,
          });
        }

        const validation = await validateAll(
          ctx.prisma,
          effectiveDocenteId,
          existing.periodoId,
          data.horasAsignadas,
          existing.tipo,
          { excludeAsignacionId: id }
        );
        if (!validation.valid) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: validation.message });
        }
      }

      return ctx.prisma.asignacionCargaLectiva.update({
        where: { id },
        data: { ...data, ...(newDocenteId ? { docenteId: newDocenteId } : {}) },
        include: {
          docente: { select: { id: true, nombre: true } },
          grupo: { include: { curso: { select: { codigo: true, nombre: true } } } },
        },
      });
    }),

  /** Returns docentes who have postulated (DocenteGrupo) to a given grupo, with compatibility info */
  postulantesByGrupo: protectedProcedure
    .input(z.object({ grupoId: z.string() }))
    .query(async ({ ctx, input }) => {
      const { grupoId } = input;

      const grupo = await ctx.prisma.grupo.findUniqueOrThrow({
        where: { id: grupoId },
        include: { curso: true },
      });

      const docenteGrupos = await ctx.prisma.docenteGrupo.findMany({
        where: { grupoId },
        include: {
          docente: {
            select: {
              id: true,
              nombre: true,
              email: true,
              categoria: true,
              modalidad: true,
              especialidad: true,
              horasContrato: true,
            },
          },
        },
        orderBy: { createdAt: 'asc' },
      });

      return docenteGrupos.map((dg, index) => {
        // Simple compatibility: check if docente categoria matches curso creditos
        const creditos = grupo.curso.creditos;
        const base = dg.docente.categoria === 'PRINCIPAL' ? 100
          : dg.docente.categoria === 'ASOCIADO' ? 85
          : dg.docente.categoria === 'AUXILIAR' ? 70
          : 60;
        const compatibility = Math.min(100, base + (creditos >= 4 ? 5 : 0));
        return {
          docente: {
            id: dg.docente.id,
            nombre: dg.docente.nombre,
            email: dg.docente.email,
            categoria: dg.docente.categoria,
            modalidad: dg.docente.modalidad,
            horasContrato: dg.docente.horasContrato,
          },
          prioridad: index + 1,
          compatibilidad: compatibility,
        };
      });
    }),

  /** Returns all grupos for a period with full curso info — for the assignment dropdown */
  gruposDisponibles: protectedProcedure
    .input(z.object({ periodoId: z.string(), curriculaId: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      const grupos = await ctx.prisma.grupo.findMany({
        where: { 
          periodoAcademicoId: input.periodoId,
          ...(input.curriculaId ? {
            curso: {
              cursoCurriculas: {
                some: {
                  curriculaId: input.curriculaId
                }
              }
            }
          } : {})
        },
        include: {
          curso: {
            select: {
              id: true,
              codigo: true,
              nombre: true,
              creditos: true,
              horasTeoria: true,
              horasPractica: true,
              horasLaboratorio: true,
              numGruposLaboratorio: true,
              ciclo: true,
              departamentoId: true,
              cursoCurriculas: {
                where: { desasociadaEn: null },
                select: { curriculaId: true },
              },
            },
          },
        },
        orderBy: [{ curso: { codigo: 'asc' } }, { nombre: 'asc' }],
      });
      return grupos;
    }),

  resumenPorDepartamento: protectedProcedure
    .input(z.object({ periodoId: z.string(), departamentoId: z.string() }))
    .query(async ({ ctx, input }) => {
      await assertCanAccessDepartamento(ctx.prisma, ctx.session, input.departamentoId);

      const docentes = await ctx.prisma.docente.findMany({
        where: { departamentoId: input.departamentoId, activo: true },
        select: {
          id: true,
          nombre: true,
          email: true,
          categoria: true,
          modalidad: true,
          horasContrato: true,
          asignacionesCarga: {
            where: { periodoId: input.periodoId },
            include: {
              grupo: { include: { curso: { select: { codigo: true, nombre: true } } } },
            },
          },
          cargasNoLectivas: {
            where: { periodoId: input.periodoId },
          },
        },
        orderBy: { nombre: 'asc' },
      });

      return docentes.map((d) => {
        const totalLectivas = d.asignacionesCarga.reduce((sum, a) => sum + a.horasAsignadas, 0);
        const totalNoLectivas = d.cargasNoLectivas.reduce((sum, c) => sum + c.horas, 0);
        return {
          docenteId: d.id,
          nombre: d.nombre,
          email: d.email,
          categoria: d.categoria,
          modalidad: d.modalidad,
          horasContrato: d.horasContrato,
          totalLectivas,
          totalNoLectivas,
          totalGeneral: totalLectivas + totalNoLectivas,
          porcentajeCubierto: d.horasContrato > 0 ? Math.round(((totalLectivas + totalNoLectivas) / d.horasContrato) * 100) : 0,
          asignaciones: d.asignacionesCarga,
          cargasNoLectivas: d.cargasNoLectivas,
        };
      });
    }),

  getDistribucion: secretariaDepartamentoProcedure
    .input(z.object({ periodoId: z.string(), departamentoId: z.string() }))
    .query(async ({ ctx, input }) => {
      await assertCanAccessDepartamento(ctx.prisma, ctx.session, input.departamentoId);

      let dist = await ctx.prisma.distribucionLectiva.findUnique({
        where: {
          departamentoId_periodoId: {
            departamentoId: input.departamentoId,
            periodoId: input.periodoId,
          },
        },
        include: {
          coberturas: {
            include: {
              demandaLinea: {
                include: {
                  curso: true,
                },
              },
            },
          },
        },
      });

      if (!dist) {
        dist = await ctx.prisma.distribucionLectiva.create({
          data: {
            departamentoId: input.departamentoId,
            periodoId: input.periodoId,
            estado: 'BORRADOR',
          },
          include: {
            coberturas: {
              include: {
                demandaLinea: {
                  include: {
                    curso: true,
                  },
                },
              },
            },
          },
        }) as any;
      }

      if (!dist) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'No se pudo obtener ni crear la distribución lectiva',
        });
      }

      const lineasAprobadas = await ctx.prisma.demandaLinea.findMany({
        where: {
          demanda: {
            periodoId: input.periodoId,
            estado: 'APROBADA',
          },
          departamentoId: input.departamentoId,
        },
        include: {
          curso: true,
        },
      });

      const requiredCoberturas: {
        demandaLineaId: string;
        componente: 'TEORIA' | 'PRACTICA' | 'LABORATORIO';
        grupoLaboratorio: number;
      }[] = [];

      for (const linea of lineasAprobadas) {
        if (linea.horasTeoria > 0) {
          requiredCoberturas.push({
            demandaLineaId: linea.id,
            componente: 'TEORIA',
            grupoLaboratorio: 0,
          });
        }
        if (linea.horasPractica > 0) {
          requiredCoberturas.push({
            demandaLineaId: linea.id,
            componente: 'PRACTICA',
            grupoLaboratorio: 0,
          });
        }
        if (linea.horasLaboratorio > 0 && linea.numGruposLaboratorio > 0) {
          for (let g = 1; g <= linea.numGruposLaboratorio; g++) {
            requiredCoberturas.push({
              demandaLineaId: linea.id,
              componente: 'LABORATORIO',
              grupoLaboratorio: g,
            });
          }
        }
      }

      const existing = await ctx.prisma.coberturaComponente.findMany({
        where: { distribucionId: dist.id },
      });

      const toCreate = requiredCoberturas.filter(req => 
        !existing.some(ext => 
          ext.demandaLineaId === req.demandaLineaId &&
          ext.componente === req.componente &&
          ext.grupoLaboratorio === req.grupoLaboratorio
        )
      );

      const toDelete = existing.filter(ext =>
        !requiredCoberturas.some(req =>
          req.demandaLineaId === ext.demandaLineaId &&
          req.componente === ext.componente &&
          req.grupoLaboratorio === ext.grupoLaboratorio
        )
      );

      if (toCreate.length > 0) {
        await ctx.prisma.coberturaComponente.createMany({
          data: toCreate.map(req => ({
            distribucionId: dist.id,
            demandaLineaId: req.demandaLineaId,
            componente: req.componente,
            grupoLaboratorio: req.grupoLaboratorio,
            estado: 'PENDIENTE',
          })),
        });
      }

      if (toDelete.length > 0) {
        await ctx.prisma.coberturaComponente.deleteMany({
          where: {
            id: { in: toDelete.map(d => d.id) },
          },
        });
      }

      const finalDist = await ctx.prisma.distribucionLectiva.findUniqueOrThrow({
        where: { id: dist.id },
        include: {
          coberturas: {
            include: {
              demandaLinea: {
                include: {
                  curso: true,
                },
              },
              asignaciones: {
                include: {
                  docente: { select: { nombre: true } },
                },
              },
            },
          },
        },
      });

      return finalDist;
    }),

  updateCobertura: secretariaDepartamentoProcedure
    .input(z.object({
      id: z.string(),
      estado: z.enum(['CUBIERTA', 'PENDIENTE']),
      motivoPendiente: z.string().nullable().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.prisma.coberturaComponente.findUniqueOrThrow({
        where: { id: input.id },
        include: { distribucion: true },
      });

      await assertFacultyPeriodNotPublished(ctx.prisma, { departamentoId: existing.distribucion.departamentoId, periodoId: existing.distribucion.periodoId });
      await assertCanAccessDepartamento(ctx.prisma, ctx.session, existing.distribucion.departamentoId);

      if (existing.distribucion.estado === 'APROBADA') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'La distribución ya está aprobada y no se pueden modificar las coberturas.',
        });
      }

      return ctx.prisma.coberturaComponente.update({
        where: { id: input.id },
        data: {
          estado: input.estado,
          motivoPendiente: input.motivoPendiente || null,
        },
      });
    }),

  submitDistribucion: secretariaDepartamentoProcedure
    .input(z.object({ periodoId: z.string(), departamentoId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await assertFacultyPeriodNotPublished(ctx.prisma, { departamentoId: input.departamentoId, periodoId: input.periodoId });
      await assertCanAccessDepartamento(ctx.prisma, ctx.session, input.departamentoId);

      const dist = await ctx.prisma.distribucionLectiva.findUniqueOrThrow({
        where: {
          departamentoId_periodoId: {
            departamentoId: input.departamentoId,
            periodoId: input.periodoId,
          },
        },
        include: {
          coberturas: true,
        },
      });

      if (dist.estado === 'APROBADA') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'La distribución ya está aprobada.',
        });
      }

      const missingReason = dist.coberturas.some(
        c => c.estado === 'PENDIENTE' && (!c.motivoPendiente || c.motivoPendiente.trim() === '')
      );

      if (missingReason) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Debe especificar un motivo para todos los componentes pendientes de cobertura.',
        });
      }

      return ctx.prisma.distribucionLectiva.update({
        where: { id: dist.id },
        data: { estado: 'ENVIADA' },
      });
    }),

  reviewDistribucion: directorDepartamentoProcedure
    .input(z.object({
      periodoId: z.string(),
      departamentoId: z.string(),
      aprobado: z.boolean(),
      observacion: z.string().nullable().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertFacultyPeriodNotPublished(ctx.prisma, { departamentoId: input.departamentoId, periodoId: input.periodoId });
      await assertCanAccessDepartamento(ctx.prisma, ctx.session, input.departamentoId);

      const dist = await ctx.prisma.distribucionLectiva.findUniqueOrThrow({
        where: {
          departamentoId_periodoId: {
            departamentoId: input.departamentoId,
            periodoId: input.periodoId,
          },
        },
      });

      const nuevoEstado = input.aprobado ? 'APROBADA' : 'OBSERVADA';

      return ctx.prisma.distribucionLectiva.update({
        where: { id: dist.id },
        data: {
          estado: nuevoEstado,
          observacion: input.observacion || null,
        },
      });
    }),
});
