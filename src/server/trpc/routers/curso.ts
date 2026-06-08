import { z } from 'zod';
import { createTRPCRouter, baseProcedure, adminProcedure, protectedProcedure, secretariaProcedure } from '../init';
import { TRPCError } from '@trpc/server';

const cursoInput = z.object({
  codigo: z.string().min(2, 'El código es obligatorio'),
  nombre: z.string().min(3, 'El nombre debe tener al menos 3 caracteres'),
  creditos: z.number().int().min(1).max(10),
  horasTeoria: z.number().int().min(0),
  horasPractica: z.number().int().min(0).default(0),
  horasLaboratorio: z.number().int().min(0),
  ciclo: z.number().int().min(1).max(12),
  requiereLaboratorio: z.boolean().optional().default(false),
  perfilRequerido: z.string().optional(),
  gradoRequerido: z.string().optional(),
  experienciaMinima: z.number().int().min(0).optional(),
  especialidadRequerida: z.string().optional(),
  aperturado: z.boolean().optional().default(false),
  departamento: z.string().optional(),
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
  list: baseProcedure
    .input(
      z.object({
        ciclo: z.number().int().optional(),
        search: z.string().optional(),
        vista: z.enum(['CATALOGO', 'APERTURA', 'MIS_CURSOS']).optional().default('CATALOGO'),
        periodoId: z.string().optional(),
        docenteId: z.string().optional(),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      const where: Record<string, any> = {};

      if (input?.ciclo) where.ciclo = input.ciclo;
      if (input?.search) {
        where.OR = [
          { nombre: { contains: input.search, mode: 'insensitive' } },
          { codigo: { contains: input.search, mode: 'insensitive' } },
        ];
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
      } else if (input?.periodoId) {
        // Para otras vistas con periodoId (como APERTURA), solo cursos con grupos en ese periodo
        where.grupos = {
          some: {
            periodoAcademicoId: input.periodoId
          }
        };
      }

      // Lógica de Paridad para la vista de APERTURA o MIS_CURSOS
      // En MIS_CURSOS también aplicamos paridad por seguridad, aunque las asignaciones ya deberían respetarla
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

            if (esImpar) {
              where.ciclo = { in: [1, 3, 5, 7, 9, 11] };
            } else if (esPar) {
              where.ciclo = { in: [2, 4, 6, 8, 10, 12] };
            }
          }
          // Si es extraordinario, no se añade filtro de paridad (es libre)
        }
      }

      const results = await ctx.prisma.curso.findMany({
        where,
        include: {
          grupos: {
            include: { periodoAcademico: true },
            orderBy: { nombre: 'asc' },
          },
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
        },
      });
    }),

  create: secretariaProcedure.input(cursoInput).mutation(({ ctx, input }) => {
    return ctx.prisma.curso.create({ data: input });
  }),

  update: secretariaProcedure
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

  /** Aperture courses for the semester */
  toggleApertura: secretariaProcedure
    .input(z.object({ 
      id: z.string(), 
      aperturado: z.boolean(),
      motivoAperturaExcepcional: z.string().optional()
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

      return ctx.prisma.curso.update({
        where: { id: input.id },
        data: { 
          aperturado: input.aperturado,
          motivoAperturaExcepcional: input.aperturado ? input.motivoAperturaExcepcional : null
        },
      });
    }),

  /** Aperture all corresponding courses for the semester */
  aperturarTodo: secretariaProcedure.mutation(async ({ ctx }) => {
    const periodo = await ctx.prisma.periodoAcademico.findFirst({ where: { activo: true } });
    if (!periodo) throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'No hay un periodo académico activo' });

    const esExtraordinario = periodo.nombre.includes('Extraordinario');
    const esImpar = periodo.nombre.endsWith('-I');
    const esPar = periodo.nombre.endsWith('-II');

    let where: Record<string, any> = {};
    if (!esExtraordinario) {
      if (esImpar) where.ciclo = { in: [1, 3, 5, 7, 9, 11] };
      else if (esPar) where.ciclo = { in: [2, 4, 6, 8, 10, 12] };
    }

    return ctx.prisma.curso.updateMany({
      where,
      data: { aperturado: true },
    });
  }),

  /** Start scheduling process (Representative only) */
  startProcess: secretariaProcedure.mutation(async ({ ctx }) => {
    const periodo = await ctx.prisma.periodoAcademico.findFirst({ where: { activo: true } });
    if (!periodo) throw new TRPCError({ code: 'NOT_FOUND' });

    return ctx.prisma.periodoAcademico.update({
      where: { id: periodo.id },
      data: { estado: 'POSTULACION' },
    });
  }),
});
