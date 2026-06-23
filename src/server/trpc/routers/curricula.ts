import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import {
  academicManagerProcedure,
  createTRPCRouter,
  protectedProcedure,
} from '../init';
import type { PrismaClient } from '@/generated/prisma/client';
import {
  assertCanAccessEscuela,
  getManagedEscuelaIds,
  type SessionLike,
} from '../policy';
import { assertCurriculumCanClose } from '@/server/domain/workflow-foundation';

const curriculaInput = z.object({
  codigo: z.string().min(2, 'El código debe tener al menos 2 caracteres'),
  anio: z.number().int().min(1900).max(2100),
  escuelaId: z.string(),
  vigente: z.boolean().optional().default(true),
  estudiantesPendientes: z.number().int().min(0).optional(),
});

const linkCourseInput = z.object({
  curriculaId: z.string(),
  cursoId: z.string(),
  ciclo: z.number().int().min(1).max(12),
  esElectivo: z.boolean().optional().default(false),
});

type CurriculumClosureTransaction = {
  escuela: PrismaClient['escuela'];
  curricula: {
    findUniqueOrThrow(args: unknown): Promise<{
      id: string;
      escuelaId: string;
      estudiantesPendientes: number;
    }>;
    update(args: unknown): Promise<unknown>;
  };
  demandaLineaCurricula: {
    count(args: unknown): Promise<number>;
  };
};

type CurriculumClosureClient = {
  $transaction<T>(operation: (tx: CurriculumClosureTransaction) => Promise<T>): Promise<T>;
};

async function closeCurriculum(
  prisma: PrismaClient,
  session: SessionLike,
  curriculumId: string
) {
  const client = prisma as unknown as CurriculumClosureClient;
  return client.$transaction(async (tx) => {
    const curriculum = await tx.curricula.findUniqueOrThrow({
      where: { id: curriculumId },
      select: { id: true, escuelaId: true, estudiantesPendientes: true },
    });
    await assertCanAccessEscuela(tx as unknown as PrismaClient, session, curriculum.escuelaId);

    const activeDemandLineCount = await tx.demandaLineaCurricula.count({
      where: {
        curriculaId: curriculumId,
        demandaLinea: { demanda: { estado: { notIn: ['RECHAZADA'] } } },
      },
    });
    assertCurriculumCanClose({
      estudiantesPendientes: curriculum.estudiantesPendientes,
      activeDemandLineCount,
    });

    return tx.curricula.update({
      where: { id: curriculumId },
      data: {
        estado: 'CERRADA',
        vigente: false,
        cerradaEn: new Date(),
        cerradaPorId: session.id,
      },
    });
  });
}

export const curriculaRouter = createTRPCRouter({
  list: protectedProcedure
    .input(
      z.object({
        escuelaId: z.string().optional(),
        vigente: z.boolean().optional(),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      const where: Record<string, unknown> = {};
      const managedEscuelaIds = await getManagedEscuelaIds(ctx.prisma, ctx.session);
      if (input?.escuelaId) {
        await assertCanAccessEscuela(ctx.prisma, ctx.session, input.escuelaId);
        where.escuelaId = input.escuelaId;
      } else if (managedEscuelaIds !== null && managedEscuelaIds.length > 0) {
        where.escuelaId = { in: managedEscuelaIds };
      }
      if (input?.vigente !== undefined) where.vigente = input.vigente;

      return ctx.prisma.curricula.findMany({
        where,
        include: {
          escuela: { select: { id: true, nombre: true } },
          cursos: {
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
                  condicion: true,
                  departamento: true,
                  requisitos: true
                }
              }
            }
          }
        },
        orderBy: { anio: 'desc' },
      });
    }),

  byId: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const curriculum = await ctx.prisma.curricula.findUniqueOrThrow({
        where: { id: input.id },
        include: {
          escuela: { select: { id: true, nombre: true } },
          cursos: {
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
                  condicion: true,
                  departamento: true,
                  requisitos: true
                }
              }
            }
          }
        },
      });
      await assertCanAccessEscuela(ctx.prisma, ctx.session, curriculum.escuelaId);
      return curriculum;
    }),

  create: academicManagerProcedure
    .input(curriculaInput)
    .mutation(async ({ ctx, input }) => {
      await assertCanAccessEscuela(ctx.prisma, ctx.session, input.escuelaId);
      return ctx.prisma.curricula.create({
        data: {
          ...input,
          estudiantesPendientes: input.estudiantesPendientes ?? 0,
          estado: 'ACTIVA',
        } as never,
      });
    }),

  update: academicManagerProcedure
    .input(z.object({ id: z.string() }).merge(curriculaInput))
    .mutation(async ({ ctx, input }) => {
      if (!input.vigente) return closeCurriculum(ctx.prisma, ctx.session, input.id);

      const { id, ...data } = input;
      const current = await ctx.prisma.curricula.findUniqueOrThrow({
        where: { id },
        select: { escuelaId: true },
      });
      await assertCanAccessEscuela(ctx.prisma, ctx.session, current.escuelaId);
      await assertCanAccessEscuela(ctx.prisma, ctx.session, data.escuelaId);
      return ctx.prisma.curricula.update({
        where: { id },
        data: {
          ...data,
          estado: 'ACTIVA',
          cerradaEn: null,
          cerradaPorId: null,
        } as never,
      });
    }),

  delete: academicManagerProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return closeCurriculum(ctx.prisma, ctx.session, input.id);
    }),

  linkCourse: academicManagerProcedure
    .input(linkCourseInput)
    .mutation(async ({ ctx, input }) => {
      const curriculum = await ctx.prisma.curricula.findUniqueOrThrow({
        where: { id: input.curriculaId },
        select: { escuelaId: true, estado: true },
      });
      await assertCanAccessEscuela(ctx.prisma, ctx.session, curriculum.escuelaId);
      if (curriculum.estado === 'CERRADA') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'No se puede modificar una currícula cerrada',
        });
      }
      const membership = ctx.prisma.cursoCurricula as unknown as {
        upsert(args: unknown): Promise<unknown>;
      };
      const now = new Date();
      return membership.upsert({
        where: {
          cursoId_curriculaId: { cursoId: input.cursoId, curriculaId: input.curriculaId },
        },
        create: { ...input, asociadaEn: now },
        update: {
          ciclo: input.ciclo,
          esElectivo: input.esElectivo,
          asociadaEn: now,
          desasociadaEn: null,
        },
      });
    }),

  unlinkCourse: academicManagerProcedure
    .input(z.object({ curriculaId: z.string(), cursoId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const curriculum = await ctx.prisma.curricula.findUniqueOrThrow({
        where: { id: input.curriculaId },
        select: { escuelaId: true, estado: true },
      });
      await assertCanAccessEscuela(ctx.prisma, ctx.session, curriculum.escuelaId);
      if (curriculum.estado === 'CERRADA') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'No se puede modificar una currícula cerrada',
        });
      }
      const membership = ctx.prisma.cursoCurricula as unknown as {
        update(args: unknown): Promise<unknown>;
      };
      return membership.update({
        where: {
          cursoId_curriculaId: {
            cursoId: input.cursoId,
            curriculaId: input.curriculaId,
          },
        },
        data: { desasociadaEn: new Date() },
      });
    }),
});
