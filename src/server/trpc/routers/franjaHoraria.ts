import { z } from 'zod';
import { createTRPCRouter, baseProcedure } from '../init';

export const franjaHorariaRouter = createTRPCRouter({
  list: baseProcedure
    .query(async ({ ctx }) => {
      return ctx.prisma.franjaHoraria.findMany({
        orderBy: [{ dia: 'asc' }, { horaInicio: 'asc' }],
      });
    }),
});
