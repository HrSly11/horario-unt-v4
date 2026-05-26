import { z } from 'zod';
import { createTRPCRouter, baseProcedure, adminProcedure, protectedProcedure, secretariaProcedure } from '../init';
import { TRPCError } from '@trpc/server';
import { CategoriaDocente, TipoDocente } from '@/generated/prisma/client';

const docenteInput = z.object({
  nombre: z.string().min(3),
  email: z.string().email(),
  categoria: z.nativeEnum(CategoriaDocente),
  tipo: z.nativeEnum(TipoDocente),
  antiguedad: z.coerce.date(),
  activo: z.boolean().default(true),
  gradoAcademico: z.string().optional(),
  especialidad: z.string().optional(),
  experienciaAnios: z.number().int().min(0).default(0),
  perfilAcademico: z.string().optional(),
});

// Helper for profile compatibility
function calculateCompatibility(docente: any, curso: any): number {
  let score = 0;

  // 1. Perfil Académico (Keyword matching) - Weight 40%
  if (curso.perfilRequerido && docente.perfilAcademico) {
    const dWords = new Set(docente.perfilAcademico.toLowerCase().split(/[\s,.-]+/));
    const cWords = curso.perfilRequerido.toLowerCase().split(/[\s,.-]+/);
    if (cWords.length > 0) {
      const matches = cWords.filter((w: string) => dWords.has(w)).length;
      score += (matches / cWords.length) * 40;
    }
  }

  // 2. Grado Académico - Weight 20%
  if (curso.gradoRequerido && docente.gradoAcademico) {
    if (docente.gradoAcademico.toLowerCase().includes(curso.gradoRequerido.toLowerCase())) {
      score += 20;
    }
  }

  // 3. Especialidad - Weight 20%
  if (curso.especialidadRequerida && docente.especialidad) {
    if (docente.especialidad.toLowerCase().includes(curso.especialidadRequerida.toLowerCase())) {
      score += 20;
    }
  }

  // 4. Experiencia - Weight 20%
  if (docente.experienciaAnios >= (curso.experienciaMinima || 0)) {
    score += 20;
  }

  return Math.min(100, score);
}

export const docenteRouter = createTRPCRouter({
  list: baseProcedure
    .input(z.object({ search: z.string().optional() }).optional())
    .query(async ({ ctx, input }) => {
      return ctx.prisma.docente.findMany({
        where: input?.search
          ? {
              OR: [
                { nombre: { contains: input.search, mode: 'insensitive' } },
                { email: { contains: input.search, mode: 'insensitive' } },
              ],
            }
          : undefined,
        orderBy: { nombre: 'asc' },
      });
    }),

  byId: baseProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.docente.findUniqueOrThrow({
        where: { id: input.id },
        include: {
          user: true,
          docenteGrupos: {
            include: { grupo: { include: { curso: true, periodoAcademico: true } } },
          },
        },
      });
    }),

  create: secretariaProcedure.input(docenteInput).mutation(({ ctx, input }) => {
    return ctx.prisma.docente.create({ data: input });
  }),

  update: secretariaProcedure
    .input(z.object({ id: z.string() }).merge(docenteInput))
    .mutation(({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.prisma.docente.update({ where: { id }, data });
    }),

  delete: adminProcedure.input(z.object({ id: z.string() })).mutation(({ ctx, input }) => {
    return ctx.prisma.docente.delete({ where: { id: input.id } });
  }),

  stats: baseProcedure.query(async ({ ctx }) => {
    const [total, porCategoria, porTipo] = await Promise.all([
      ctx.prisma.docente.count(),
      ctx.prisma.docente.groupBy({
        by: ['categoria'],
        _count: true,
      }),
      ctx.prisma.docente.groupBy({
        by: ['tipo'],
        _count: true,
      }),
    ]);

    const stats = {
      total,
      porCategoria: {
        PRINCIPAL: porCategoria.find(c => c.categoria === 'PRINCIPAL')?._count ?? 0,
        ASOCIADO: porCategoria.find(c => c.categoria === 'ASOCIADO')?._count ?? 0,
        AUXILIAR: porCategoria.find(c => c.categoria === 'AUXILIAR')?._count ?? 0,
        JEFE_PRACTICA: porCategoria.find(c => c.categoria === 'JEFE_PRACTICA')?._count ?? 0,
      },
      nombrados: porTipo.find(t => t.tipo === 'NOMBRADO')?._count ?? 0,
      contratados: porTipo.find(t => t.tipo === 'CONTRATADO')?._count ?? 0,
    };

    return stats;
  }),

  /** Get personal stats for the current docente */
  personalStats: protectedProcedure.query(async ({ ctx }) => {
    if (!ctx.session?.docenteId) throw new TRPCError({ code: 'UNAUTHORIZED' });

    const [docente, assignments] = await Promise.all([
      ctx.prisma.docente.findUniqueOrThrow({
        where: { id: ctx.session.docenteId },
        include: {
          docenteGrupos: {
            include: { grupo: { include: { curso: true } } },
          },
        },
      }),
      ctx.prisma.asignacion.findMany({
        where: { docenteId: ctx.session.docenteId },
        include: {
          grupo: { include: { curso: true } },
          aula: true,
          franjaHoraria: true,
        },
      }),
    ]);

    const totalHoras = docente.docenteGrupos.reduce((acc: number, dg: any) => {
      return acc + (dg.grupo.curso.horasTeoria + dg.grupo.curso.horasLaboratorio);
    }, 0);

    return {
      docente,
      workload: totalHoras,
      coursesCount: docente.docenteGrupos.length,
      limits: {
        min: docente.tipo === 'NOMBRADO' ? 8 : 12,
        max: docente.tipo === 'NOMBRADO' ? 16 : 24,
      },
      assignments,
    };
  }),

  /** Get groups for a specific docente */
  grupos: baseProcedure
    .input(z.object({ docenteId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.docenteGrupo.findMany({
        where: { docenteId: input.docenteId },
        include: {
          grupo: {
            include: { curso: true },
          },
        },
      });
    }),

  /** Application to a course/group by a docente */
  postulateToGroup: protectedProcedure
    .input(z.object({ grupoId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.session?.docenteId) throw new TRPCError({ code: 'UNAUTHORIZED' });

      const docenteId = ctx.session.docenteId;
      const { grupoId } = input;

      // 1. Validate if already assigned
      const existing = await ctx.prisma.docenteGrupo.findUnique({
        where: { docenteId_grupoId: { docenteId, grupoId } },
      });

      if (existing) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Ya estás asignado a este grupo',
        });
      }

      // 2. Check load limit
      const docente = await ctx.prisma.docente.findUniqueOrThrow({
        where: { id: docenteId },
        include: { docenteGrupos: { include: { grupo: { include: { curso: true } } } } },
      });

      const currentLoad = docente.docenteGrupos.reduce((acc: number, dg: any) => {
        return acc + (dg.grupo.curso.horasTeoria + dg.grupo.curso.horasLaboratorio);
      }, 0);

      const group = await ctx.prisma.grupo.findUniqueOrThrow({
        where: { id: grupoId },
        include: { curso: true },
      });

      const nextLoad = currentLoad + group.curso.horasTeoria + group.curso.horasLaboratorio;
      const maxLoad = docente.tipo === 'NOMBRADO' ? 16 : 24;

      if (nextLoad > maxLoad) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Has superado tu carga máxima permitida (${maxLoad} horas)`,
        });
      }

      // 3. Create assignment link
      return ctx.prisma.docenteGrupo.upsert({
        where: { docenteId_grupoId: { docenteId, grupoId } },
        create: { docenteId, grupoId },
        update: {},
      });
    }),

  /** Get courses matching docente profile (>70%) */
  matchingCourses: protectedProcedure.query(async ({ ctx }) => {
    if (!ctx.session?.docenteId) throw new TRPCError({ code: 'UNAUTHORIZED' });

    const docente = await ctx.prisma.docente.findUniqueOrThrow({
      where: { id: ctx.session.docenteId },
    });

    const cursos = await ctx.prisma.curso.findMany({
      where: { aperturado: true },
    });

    const matched = cursos
      .map(curso => {
        const compatibility = calculateCompatibility(docente, curso);
        return { ...curso, compatibility };
      })
      .filter(c => c.compatibility > 70)
      .sort((a, b) => b.compatibility - a.compatibility);

    return matched;
  }),

  /** Get current docente's availability */
  getDisponibilidad: protectedProcedure.query(async ({ ctx }) => {
    if (!ctx.session?.docenteId) throw new TRPCError({ code: 'UNAUTHORIZED' });

    return ctx.prisma.disponibilidadDocente.findMany({
      where: { docenteId: ctx.session.docenteId },
      include: { franjaHoraria: true },
    });
  }),

  /** Save teacher availability */
  saveAvailability: protectedProcedure
    .input(z.object({ franjaIds: z.array(z.string()) }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.session?.docenteId) throw new TRPCError({ code: 'UNAUTHORIZED' });

      const docenteId = ctx.session.docenteId;

      return ctx.prisma.$transaction(async (tx) => {
        await tx.disponibilidadDocente.deleteMany({
          where: { docenteId },
        });

        if (input.franjaIds.length > 0) {
          await tx.disponibilidadDocente.createMany({
            data: input.franjaIds.map(id => ({
              docenteId,
              franjaHorariaId: id,
            })),
          });
        }
        return { success: true };
      });
    }),

  /** Postulate to a course */
  postulateToCourse: protectedProcedure
    .input(z.object({ cursoId: z.string(), prioridad: z.number().int().min(1) }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.session?.docenteId) throw new TRPCError({ code: 'UNAUTHORIZED' });

      const docente = await ctx.prisma.docente.findUniqueOrThrow({ where: { id: ctx.session.docenteId } });
      const curso = await ctx.prisma.curso.findUniqueOrThrow({ where: { id: input.cursoId } });

      const compatibility = calculateCompatibility(docente, curso);

      if (compatibility <= 70) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Tu compatibilidad (${compatibility.toFixed(1)}%) es insuficiente (mínimo 70%)`,
        });
      }

      return ctx.prisma.postulacionCurso.upsert({
        where: { docenteId_cursoId: { docenteId: docente.id, cursoId: curso.id } },
        create: { 
          docenteId: docente.id, 
          cursoId: curso.id, 
          prioridad: input.prioridad,
          compatibilidad: compatibility 
        },
        update: { prioridad: input.prioridad, compatibilidad: compatibility },
      });
    }),

  /** Get my postulations */
  myPostulations: protectedProcedure.query(async ({ ctx }) => {
    if (!ctx.session?.docenteId) throw new TRPCError({ code: 'UNAUTHORIZED' });

    return ctx.prisma.postulacionCurso.findMany({
      where: { docenteId: ctx.session.docenteId },
      include: { curso: true },
      orderBy: { prioridad: 'asc' },
    });
  }),
});
