import { z } from 'zod';
import { createTRPCRouter, baseProcedure, adminProcedure, protectedProcedure, secretariaProcedure, secretariaEscuelaProcedure, academicManagerProcedure } from '../init';
import { TRPCError } from '@trpc/server';
import { Prisma } from '@/generated/prisma/client';
import { assertWorkflowActivationReady } from '@/server/domain/workflow-foundation';
import { materializeGruposForCurso } from '@/server/domain/grupo-materializer';
import { assertCanAccessEscuela, assertRole, getManagedEscuelaIds } from '../policy';

const cursoInput = z.object({
  codigo: z.string().min(2, 'El código es obligatorio'),
  nombre: z.string().min(3, 'El nombre debe tener al menos 3 caracteres'),
  creditos: z.number().int().min(1).max(10),
  horasTeoria: z.number().int().min(0),
  horasPractica: z.number().int().min(0).default(0),
  horasLaboratorio: z.number().int().min(0),
  numGruposLaboratorio: z.number().int().min(1).optional().default(1),
  ciclo: z.number().int().min(1).max(12),
  requiereLaboratorio: z.boolean().optional().default(false),
  perfilRequerido: z.string().optional(),
  gradoRequerido: z.string().optional(),
  experienciaMinima: z.number().int().min(0).optional(),
  especialidadRequerida: z.string().optional(),
  aperturado: z.boolean().optional().default(false),
  departamento: z.string().optional(),
  departamentoId: z.string().optional(),
  requisitos: z.string().optional(),
  condicion: z.string().optional().default("O"),
  motivoAperturaExcepcional: z.string().optional(), // Para casos excepcionales
});

const grupoInput = z.object({
  nombre: z.string().min(1, 'El nombre del grupo es obligatorio'),
  cursoId: z.string(),
  periodoAcademicoId: z.string(),
});

export const cursoRouter = createTRPCRouter({
  list: protectedProcedure
    .input(
      z.object({
        ciclo: z.number().int().optional(),
        search: z.string().optional(),
        vista: z.enum(['CATALOGO', 'APERTURA', 'MIS_CURSOS']).optional().default('CATALOGO'),
        periodoId: z.string().optional(),
        docenteId: z.string().optional(),
        soloAperturados: z.boolean().optional(),
        curriculaId: z.string().optional(), // Nuevo filtro por currícula
        invertirParidad: z.boolean().optional(), // Para apertura excepcional
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      const where: Prisma.CursoWhereInput = {};

      if (input?.ciclo) where.ciclo = input.ciclo;
      if (input?.soloAperturados) where.aperturado = true;
      if (input?.search) {
        where.OR = [
          { nombre: { contains: input.search, mode: 'insensitive' } },
          { codigo: { contains: input.search, mode: 'insensitive' } },
        ];
      }
      // Filtrar por currícula
      if (input?.curriculaId) {
        where.cursoCurriculas = {
          some: { curriculaId: input.curriculaId, desasociadaEn: null }
        };
      }

      // Si es la vista de MIS_CURSOS, filtramos por el docente y el periodo específico
      if (input?.vista === 'MIS_CURSOS' && input.docenteId && input.periodoId) {
        where.grupos = {
          some: {
            periodoAcademicoId: input.periodoId,
            asignaciones: {
              some: {
                docenteId: input.docenteId
              }
            }
          }
        };
      }

      // Lógica de Paridad para la vista de APERTURA o MIS_CURSOS
      if (input?.vista === 'APERTURA' || input?.vista === 'MIS_CURSOS') {
        const periodo = input?.periodoId 
          ? await ctx.prisma.periodoAcademico.findUnique({ where: { id: input.periodoId } })
          : await ctx.prisma.periodoAcademico.findFirst({ where: { activo: true } });

        if (periodo) {
          const esExtraordinario = periodo.nombre.toLowerCase().includes('extraordinario') || 
                                 periodo.nombre.toLowerCase().includes('vacacional');
          
          if (!esExtraordinario) {
            const esImpar = periodo.nombre.endsWith('-I');
            const esPar = periodo.nombre.endsWith('-II');

            if (input?.invertirParidad) {
              if (esImpar) {
                where.ciclo = { in: [2, 4, 6, 8, 10, 12] };
              } else if (esPar) {
                where.ciclo = { in: [1, 3, 5, 7, 9, 11] };
              }
            } else {
              if (esImpar) {
                where.ciclo = { in: [1, 3, 5, 7, 9, 11] };
              } else if (esPar) {
                where.ciclo = { in: [2, 4, 6, 8, 10, 12] };
              }
            }
          }
        }
      }

      const results = await ctx.prisma.curso.findMany({
        where,
        include: {
          grupos: {
            where: input?.periodoId ? { periodoAcademicoId: input.periodoId } : undefined,
            include: { periodoAcademico: true },
            orderBy: { nombre: 'asc' },
          },
          cursoCurriculas: {
            include: {
              curricula: true
            }
          },
          departamentoOwner: true
        },
        orderBy: [{ ciclo: 'asc' }, { codigo: 'asc' }],
      });
      return results;
    }),

  byId: baseProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.curso.findUniqueOrThrow({
        where: { id: input.id },
        include: {
          grupos: {
            include: {
              periodoAcademico: true,
              asignaciones: {
                include: { docente: true, aula: true, franjaHoraria: true },
              },
            },
          },
          cursoCurriculas: {
            include: {
              curricula: true
            }
          }
        },
      });
    }),

  create: secretariaEscuelaProcedure.input(cursoInput).mutation(async ({ ctx, input }) => {
    return ctx.prisma.$transaction(async (tx) => {
      const curso = await tx.curso.create({ data: input });

      // Materializar Grupo "A" (y turnos de laboratorio) en el periodo activo
      // para que la carga lectiva pueda asignarse inmediatamente si el curso
      // es aperturado en este mismo flujo.
      const periodoActivo = await tx.periodoAcademico.findFirst({
        where: { activo: true },
        select: { id: true },
      });
      if (periodoActivo) {
        await materializeGruposForCurso(tx, {
          cursoId: curso.id,
          periodoId: periodoActivo.id,
          numGruposLaboratorio: curso.numGruposLaboratorio,
        });
      }

      return curso;
    });
  }),

  update: secretariaEscuelaProcedure
    .input(z.object({ id: z.string() }).merge(cursoInput))
    .mutation(({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.prisma.curso.update({ where: { id }, data });
    }),

  delete: adminProcedure.input(z.object({ id: z.string() })).mutation(({ ctx, input }) => {
    return ctx.prisma.curso.delete({ where: { id: input.id } });
  }),

  // Grupos
  createGrupo: secretariaProcedure.input(grupoInput).mutation(({ ctx, input }) => {
    return ctx.prisma.grupo.create({ data: input });
  }),

  deleteGrupo: adminProcedure.input(z.object({ id: z.string() })).mutation(({ ctx, input }) => {
    return ctx.prisma.grupo.delete({ where: { id: input.id } });
  }),

  // Get all unique ciclos (for filters)
  ciclos: baseProcedure.query(async ({ ctx }) => {
    const cursos = await ctx.prisma.curso.findMany({
      select: { ciclo: true },
      distinct: ['ciclo'],
      orderBy: { ciclo: 'asc' },
    });
    return cursos.map((c) => c.ciclo);
  }),
  // Get all departamentos
  departamentos: baseProcedure.query(async ({ ctx }) => {
    return await ctx.prisma.departamento.findMany({
      orderBy: { nombre: 'asc' }
    });
  }),

  /** Aperture courses for the semester */
  toggleApertura: secretariaProcedure
    .input(z.object({ 
      id: z.string(), 
      aperturado: z.boolean(),
      motivoAperturaExcepcional: z.string().optional(),
      numGruposLaboratorio: z.number().int().optional() // Nuevo parámetro para editar grupos de laboratorio
    }))
    .mutation(async ({ ctx, input }) => {
      const curso = await ctx.prisma.curso.findUnique({ where: { id: input.id } });
      if (!curso) throw new TRPCError({ code: 'NOT_FOUND' });

      const periodo = await ctx.prisma.periodoAcademico.findFirst({ where: { activo: true } });
      if (!periodo) throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'No hay un periodo académico activo' });

      const esExtraordinario = periodo.nombre.includes('Extraordinario');
      const esImpar = periodo.nombre.endsWith('-I');
      const esPar = periodo.nombre.endsWith('-II');

      const cicloImpar = curso.ciclo % 2 !== 0;
      const cicloPar = curso.ciclo % 2 === 0;

      let esValido = esExtraordinario;
      if (!esValido) {
        if (esImpar && cicloImpar) esValido = true;
        if (esPar && cicloPar) esValido = true;
      }

      if (input.aperturado && !esValido && !input.motivoAperturaExcepcional) {
        throw new TRPCError({ 
          code: 'BAD_REQUEST', 
          message: 'Este curso no corresponde al semestre actual. Debe proporcionar un motivo para la apertura excepcional.' 
        });
      }

      // Determinar numGruposLaboratorio: si se pasa, usar ese; si no, por defecto 3 si hay horas de laboratorio, 0 si no
      const numGruposLaboratorio = input.numGruposLaboratorio ?? (
        input.aperturado ? (curso.horasLaboratorio > 0 ? 3 : 0) : curso.numGruposLaboratorio
      );

      // Usar transacción para actualizar curso y demanda
      return ctx.prisma.$transaction(async (tx) => {
        const updatedCurso = await tx.curso.update({
          where: { id: input.id },
          data: { 
            aperturado: input.aperturado,
            motivoAperturaExcepcional: input.aperturado ? input.motivoAperturaExcepcional : null,
            numGruposLaboratorio,
          },
          include: { cursoCurriculas: { where: { desasociadaEn: null } } }
        });

        if (input.aperturado) {
          // Obtener la escuela del usuario (para la demanda)
          const managedEscuelaIds = await getManagedEscuelaIds(tx as any, ctx.session);
          if (managedEscuelaIds && managedEscuelaIds.length > 0) {
            for (const escuelaId of managedEscuelaIds) {
              // Obtener o crear la demanda académica para esta escuela y periodo
              let demanda = await tx.demandaAcademica.findUnique({
                where: { escuelaId_periodoId: { escuelaId, periodoId: periodo.id } }
              });

              if (!demanda) {
                demanda = await tx.demandaAcademica.create({
                  data: { escuelaId, periodoId: periodo.id, estado: 'BORRADOR', version: 1 }
                });
              }

              // Verificar si ya existe una línea de demanda para este curso
              const existingLine = await tx.demandaLinea.findFirst({
                where: { demandaId: demanda.id, cursoId: input.id }
              });

              if (!existingLine && curso.departamentoId) {
                // Crear la línea de demanda
                const demandaLinea = await tx.demandaLinea.create({
                data: {
                  demandaId: demanda.id,
                  cursoId: input.id,
                  departamentoId: curso.departamentoId,
                  horasTeoria: curso.horasTeoria,
                  horasPractica: curso.horasPractica,
                  horasLaboratorio: curso.horasLaboratorio,
                  numGruposLaboratorio: numGruposLaboratorio,
                  motivoAperturaExcepcional: input.motivoAperturaExcepcional,
                }
              });

                // Asociar las currículas del curso a la línea de demanda
                for (const cc of updatedCurso.cursoCurriculas) {
                  await tx.demandaLineaCurricula.create({
                    data: { demandaLineaId: demandaLinea.id, curriculaId: cc.curriculaId, ciclo: cc.ciclo }
                  });
                }

                // Materializar los Grupo (sección "A" + Lab-1..Lab-N) vinculados a la línea
                await materializeGruposForCurso(tx, {
                  cursoId: input.id,
                  periodoId: periodo.id,
                  numGruposLaboratorio,
                  demandaLineaId: demandaLinea.id,
                });
              } else if (existingLine) {
                // Si la línea ya existía pero los Grupo no se materializaron,
                // asegurar la asociación a la línea y completar los turnos faltantes.
                await materializeGruposForCurso(tx, {
                  cursoId: input.id,
                  periodoId: periodo.id,
                  numGruposLaboratorio,
                  demandaLineaId: existingLine.id,
                });
              }
            }
          }
        }

        return updatedCurso;
      });
    }),

  /** Aperture all corresponding courses for the semester */
  aperturarTodo: secretariaProcedure.input(z.object({ curriculaId: z.string().optional() })).mutation(async ({ ctx, input }) => {
    const periodo = await ctx.prisma.periodoAcademico.findFirst({ where: { activo: true } });
    if (!periodo) throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'No hay un periodo académico activo' });

    const esExtraordinario = periodo.nombre.includes('Extraordinario');
    const esImpar = periodo.nombre.endsWith('-I');
    const esPar = periodo.nombre.endsWith('-II');

    let where: Prisma.CursoWhereInput = {};
    if (!esExtraordinario) {
      if (esImpar) where.ciclo = { in: [1, 3, 5, 7, 9, 11] };
      else if (esPar) where.ciclo = { in: [2, 4, 6, 8, 10, 12] };
    }
    // Filtrar por currícula si se proporciona
    if (input.curriculaId) {
      where.cursoCurriculas = {
        some: { curriculaId: input.curriculaId, desasociadaEn: null }
      };
    }

    // Obtener los cursos que vamos a aperturar
    const cursosToAperturar = await ctx.prisma.curso.findMany({
      where,
      include: { cursoCurriculas: { where: { desasociadaEn: null } } }
    });

    const managedEscuelaIds = await getManagedEscuelaIds(ctx.prisma, ctx.session);

    // Usar transacción para actualizar cursos y demanda
    return ctx.prisma.$transaction(async (tx) => {
      // Actualizar todos los cursos (aperturar y establecer numGruposLaboratorio)
      for (const curso of cursosToAperturar) {
        await tx.curso.update({
          where: { id: curso.id },
          data: {
            aperturado: true,
            numGruposLaboratorio: curso.horasLaboratorio > 0 ? 3 : 0,
          }
        });
      }

      // Actualizar la demanda
      if (managedEscuelaIds && managedEscuelaIds.length > 0) {
        for (const escuelaId of managedEscuelaIds) {
          // Obtener o crear la demanda académica para esta escuela y periodo
          let demanda = await tx.demandaAcademica.findUnique({
            where: { escuelaId_periodoId: { escuelaId, periodoId: periodo.id } }
          });

          if (!demanda) {
            demanda = await tx.demandaAcademica.create({
              data: { escuelaId, periodoId: periodo.id, estado: 'BORRADOR', version: 1 }
            });
          }

          // Agregar líneas de demanda para cada curso
          for (const curso of cursosToAperturar) {
            if (curso.departamentoId) {
              const numGruposLab = curso.horasLaboratorio > 0 ? 3 : 0;
              const existingLine = await tx.demandaLinea.findFirst({
                where: { demandaId: demanda.id, cursoId: curso.id }
              });

              let demandaLineaId: string;
              if (!existingLine) {
                const demandaLinea = await tx.demandaLinea.create({
                  data: {
                    demandaId: demanda.id,
                    cursoId: curso.id,
                    departamentoId: curso.departamentoId,
                    horasTeoria: curso.horasTeoria,
                    horasPractica: curso.horasPractica,
                    horasLaboratorio: curso.horasLaboratorio,
                    numGruposLaboratorio: numGruposLab,
                  }
                });
                demandaLineaId = demandaLinea.id;

                // Asociar currículas
                for (const cc of curso.cursoCurriculas) {
                  await tx.demandaLineaCurricula.create({
                    data: { demandaLineaId: demandaLinea.id, curriculaId: cc.curriculaId, ciclo: cc.ciclo }
                  });
                }
              } else {
                demandaLineaId = existingLine.id;
              }

              // Materializar los Grupo (sección "A" + Lab-1..Lab-N) por curso.
              // Es idempotente: respeta el unique @@unique([cursoId, nombre, periodoAcademicoId]).
              await materializeGruposForCurso(tx, {
                cursoId: curso.id,
                periodoId: periodo.id,
                numGruposLaboratorio: numGruposLab,
                demandaLineaId,
              });
            }
          }
        }
      }

      return { count: cursosToAperturar.length };
    });
  }),

  /** Start scheduling process (Representative only) */
  startProcess: academicManagerProcedure.mutation(async ({ ctx }) => {
    const client = ctx.prisma as unknown as {
      $transaction<T>(operation: (tx: {
        migracionReconciliacion: {
          findMany(args: unknown): Promise<Array<{
            codigo: string;
            blocking: boolean;
            resueltaEn: Date | null;
          }>>;
        };
        periodoAcademico: typeof ctx.prisma.periodoAcademico;
      }) => Promise<T>): Promise<T>;
    };

    return client.$transaction(async (tx) => {
      const issues = await tx.migracionReconciliacion.findMany({
        where: { blocking: true, resueltaEn: null },
        select: { codigo: true, blocking: true, resueltaEn: true },
      });
      assertWorkflowActivationReady(
        issues.map((issue) => ({
          code: issue.codigo,
          blocking: issue.blocking,
          resolved: issue.resueltaEn !== null,
        }))
      );

      const periodo = await tx.periodoAcademico.findFirst({ where: { activo: true } });
      if (!periodo) throw new TRPCError({ code: 'NOT_FOUND' });

      return tx.periodoAcademico.update({
        where: { id: periodo.id },
        data: { estado: 'POSTULACION' },
      });
    });
  }),

  getDemanda: academicManagerProcedure
    .input(z.object({ escuelaId: z.string(), periodoId: z.string() }))
    .query(async ({ ctx, input }) => {
      await assertCanAccessEscuela(ctx.prisma, ctx.session, input.escuelaId);

      const demanda = await ctx.prisma.demandaAcademica.findUnique({
        where: {
          escuelaId_periodoId: { escuelaId: input.escuelaId, periodoId: input.periodoId },
        },
        include: {
          lineas: {
            include: {
              curso: true,
              curriculas: {
                include: {
                  curricula: true,
                },
              },
            },
          },
        },
      });

      const activeCurricula = await ctx.prisma.curricula.findMany({
        where: {
          escuelaId: input.escuelaId,
          estado: 'ACTIVA',
        },
        include: {
          cursos: {
            where: {
              desasociadaEn: null,
            },
            include: {
              curso: true,
            },
          },
        },
      });

      const availableCourses = activeCurricula.flatMap((curr) =>
        curr.cursos.map((cc) => ({
          curso: cc.curso,
          curriculaId: curr.id,
          curriculaCodigo: curr.codigo,
          ciclo: cc.ciclo,
        }))
      );

      // Also return courses with aperturado=true for the given period so the UI
      // can pre-load demand lines even when CursoCurricula entries are absent,
      // but only courses that are linked to the escuela via any curricula.
      const cursosAperturados = await ctx.prisma.curso.findMany({
        where: {
          aperturado: true,
          cursoCurriculas: {
            some: {
              desasociadaEn: null,
              curricula: {
                escuelaId: input.escuelaId,
              },
            },
          },
        },
        include: {
          cursoCurriculas: {
            where: { desasociadaEn: null },
            include: { curricula: { select: { id: true, codigo: true, escuelaId: true } } },
          },
        },
        orderBy: [{ ciclo: 'asc' }, { codigo: 'asc' }],
      });

      return {
        demanda,
        availableCourses,
        cursosAperturados,
      };
    }),

  saveDemanda: academicManagerProcedure
    .input(
      z.object({
        escuelaId: z.string(),
        periodoId: z.string(),
        lineas: z.array(
          z.object({
            cursoId: z.string(),
            numGruposLaboratorio: z.number().int().min(0),
            motivoAperturaExcepcional: z.string().optional(),
            curriculas: z.array(
              z.object({
                curriculaId: z.string(),
                ciclo: z.number().int().min(1).max(12),
              })
            ),
          })
        ),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await assertCanAccessEscuela(ctx.prisma, ctx.session, input.escuelaId);

      return ctx.prisma.$transaction(async (tx) => {
        let demanda = await tx.demandaAcademica.findUnique({
          where: {
            escuelaId_periodoId: { escuelaId: input.escuelaId, periodoId: input.periodoId },
          },
        });

        if (demanda) {
          if (demanda.estado === 'ENVIADA' || demanda.estado === 'APROBADA') {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: 'No se puede modificar una demanda enviada o aprobada',
            });
          }

          await tx.demandaLinea.deleteMany({
            where: { demandaId: demanda.id },
          });

          demanda = await tx.demandaAcademica.update({
            where: { id: demanda.id },
            data: {
              estado: 'BORRADOR',
              version: { increment: 1 },
            },
          });
        } else {
          demanda = await tx.demandaAcademica.create({
            data: {
              escuelaId: input.escuelaId,
              periodoId: input.periodoId,
              estado: 'BORRADOR',
              version: 1,
            },
          });
        }

        for (const line of input.lineas) {
          const curso = await tx.curso.findUniqueOrThrow({
            where: { id: line.cursoId },
          });

          if (!curso.departamentoId) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: `El curso ${curso.codigo} - ${curso.nombre} no tiene un departamento asignado`,
            });
          }

          const demandLine = await tx.demandaLinea.create({
            data: {
              demandaId: demanda.id,
              cursoId: line.cursoId,
              departamentoId: curso.departamentoId,
              horasTeoria: curso.horasTeoria,
              horasPractica: curso.horasPractica,
              horasLaboratorio: curso.horasLaboratorio,
              numGruposLaboratorio: line.numGruposLaboratorio,
              motivoAperturaExcepcional: line.motivoAperturaExcepcional,
            },
          });

          for (const curr of line.curriculas) {
            await tx.demandaLineaCurricula.create({
              data: {
                demandaLineaId: demandLine.id,
                curriculaId: curr.curriculaId,
                ciclo: curr.ciclo,
              },
            });
          }

          // Materializar los Grupo (sección "A" + Lab-1..Lab-N) vinculados a la línea.
          // Idempotente: respeta el unique @@unique([cursoId, nombre, periodoAcademicoId])
          // y vuelve a vincular los Grupo existentes que aún no tengan demandaLineaId.
          await materializeGruposForCurso(tx, {
            cursoId: line.cursoId,
            periodoId: input.periodoId,
            numGruposLaboratorio: line.numGruposLaboratorio,
            demandaLineaId: demandLine.id,
          });
        }

        await tx.log.create({
          data: {
            userId: ctx.session.id,
            accion: 'GUARDAR_DEMANDA',
            entidad: 'DemandaAcademica',
            entidadId: demanda.id,
            despues: JSON.stringify({
              escuelaId: input.escuelaId,
              periodoId: input.periodoId,
              lineasCount: input.lineas.length,
            }),
          },
        });

        return demanda;
      });
    }),

  submitDemanda: academicManagerProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const demanda = await ctx.prisma.demandaAcademica.findUniqueOrThrow({
        where: { id: input.id },
        include: { escuela: true },
      });

      await assertCanAccessEscuela(ctx.prisma, ctx.session, demanda.escuelaId);

      if (
        demanda.estado !== 'BORRADOR' &&
        demanda.estado !== 'OBSERVADA' &&
        demanda.estado !== 'RECHAZADA'
      ) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'La demanda no está en un estado que permita su envío',
        });
      }

      const updated = await ctx.prisma.demandaAcademica.update({
        where: { id: input.id },
        data: {
          estado: 'ENVIADA',
          enviadaPorId: ctx.session.id,
          enviadaEn: new Date(),
        },
      });

      await ctx.prisma.log.create({
        data: {
          userId: ctx.session.id,
          accion: 'ENVIAR_DEMANDA',
          entidad: 'DemandaAcademica',
          entidadId: demanda.id,
          antes: JSON.stringify({ estado: demanda.estado }),
          despues: JSON.stringify({ estado: 'ENVIADA' }),
        },
      });

      if (demanda.escuela.directorId) {
        await ctx.prisma.notification.create({
          data: {
            recipientUserId: demanda.escuela.directorId,
            titulo: 'Demanda Académica Enviada',
            mensaje: `La demanda académica para el periodo ha sido enviada por la secretaría y está lista para su revisión.`,
            tipo: 'DEMANDA_ENVIADA',
          },
        });
      }

      return updated;
    }),

  reviewDemanda: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        estado: z.enum(['APROBADA', 'OBSERVADA', 'RECHAZADA']),
        observacion: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      assertRole(ctx.session, ['DIRECTOR_ESCUELA', 'ADMIN']);

      const demanda = await ctx.prisma.demandaAcademica.findUniqueOrThrow({
        where: { id: input.id },
        include: { escuela: true },
      });

      await assertCanAccessEscuela(ctx.prisma, ctx.session, demanda.escuelaId);

      if (demanda.estado !== 'ENVIADA') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'La demanda debe estar en estado ENVIADA para ser revisada',
        });
      }

      if (
        (input.estado === 'OBSERVADA' || input.estado === 'RECHAZADA') &&
        (!input.observacion || input.observacion.trim() === '')
      ) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Debe especificar una observación al observar o rechazar la demanda',
        });
      }

      const updated = await ctx.prisma.demandaAcademica.update({
        where: { id: input.id },
        data: {
          estado: input.estado,
          observacion: input.observacion || null,
          revisadaPorId: ctx.session.id,
          revisadaEn: new Date(),
        },
      });

      await ctx.prisma.log.create({
        data: {
          userId: ctx.session.id,
          accion: `REVISAR_DEMANDA_${input.estado}`,
          entidad: 'DemandaAcademica',
          entidadId: demanda.id,
          antes: JSON.stringify({ estado: demanda.estado }),
          despues: JSON.stringify({ estado: input.estado, observacion: input.observacion }),
        },
      });

      if (input.estado === 'APROBADA') {
        if (demanda.escuela.secretariaId) {
          await ctx.prisma.notification.create({
            data: {
              recipientUserId: demanda.escuela.secretariaId,
              titulo: 'Demanda Académica Aprobada',
              mensaje: `La demanda académica ha sido aprobada por el director.`,
              tipo: 'DEMANDA_APROBADA',
            },
          });
        }

        const lines = await ctx.prisma.demandaLinea.findMany({
          where: { demandaId: demanda.id },
          include: { departamento: true },
        });

        const departmentDirectorIds = lines
          .map((l) => l.departamento.directorId)
          .filter((id): id is string => !!id);

        const uniqueDirectorIds = [...new Set(departmentDirectorIds)];

        for (const directorId of uniqueDirectorIds) {
          await ctx.prisma.notification.create({
            data: {
              recipientUserId: directorId,
              titulo: 'Demanda Aprobada Asignada',
              mensaje: `Se ha aprobado la demanda académica de la escuela ${demanda.escuela.nombre}. Los cursos de su departamento están listos para la distribución.`,
              tipo: 'DEMANDA_APROBADA_DEPARTAMENTO',
            },
          });
        }
      } else {
        if (demanda.escuela.secretariaId) {
          await ctx.prisma.notification.create({
            data: {
              recipientUserId: demanda.escuela.secretariaId,
              titulo: `Demanda Académica ${input.estado === 'OBSERVADA' ? 'Observada' : 'Rechazada'}`,
              mensaje: `La demanda académica ha sido revisada con observaciones: "${input.observacion}".`,
              tipo: `DEMANDA_${input.estado}`,
            },
          });
        }
      }

      return updated;
    }),
});
