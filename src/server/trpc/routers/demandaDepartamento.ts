import { z } from 'zod';
import { createTRPCRouter, protectedProcedure } from '../init';
import { assertRole, getManagedDepartamentoIds } from '../policy';

export const demandaDepartamentoRouter = createTRPCRouter({
  listApproved: protectedProcedure
    .input(z.object({ periodoId: z.string() }))
    .query(async ({ ctx, input }) => {
      assertRole(ctx.session, ['DIRECTOR_DEPARTAMENTO', 'SECRETARIA_DEPARTAMENTO', 'ADMIN']);

      const where: any = {
        demanda: {
          periodoId: input.periodoId,
          estado: 'APROBADA',
        },
      };

      const managedDeptoIds = await getManagedDepartamentoIds(ctx.prisma, ctx.session);
      if (managedDeptoIds !== null) {
        where.departamentoId = { in: managedDeptoIds };
      }

      return ctx.prisma.demandaLinea.findMany({
        where,
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
            },
          },
          demanda: {
            include: {
              escuela: {
                select: {
                  id: true,
                  nombre: true,
                },
              },
            },
          },
          curriculas: {
            include: {
              curricula: {
                select: {
                  id: true,
                  codigo: true,
                },
              },
            },
          },
          grupos: {
            include: {
              asignacionesCarga: {
                include: {
                  docente: true,
                },
              },
            },
          },
        },
      });
    }),
});
