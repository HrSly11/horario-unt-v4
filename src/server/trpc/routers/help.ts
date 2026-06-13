import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { AvailabilityService } from '@/server/services/availability';
import { HelpAssistantService } from '@/server/services/help-assistant';
import { createTRPCRouter, protectedProcedure } from '../init';

const historyMessage = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().trim().min(1).max(1000),
});

export const helpRouter = createTRPCRouter({
  ask: protectedProcedure
    .input(z.object({
      message: z.string().trim().min(1).max(1000),
      history: z.array(historyMessage).max(10).default([]),
    }))
    .mutation(async ({ ctx, input }) => {
      const assistant = new HelpAssistantService(new AvailabilityService(ctx.prisma));

      try {
        return await assistant.answer(input.message, input.history);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Error desconocido';
        console.error('[HelpAssistant]', message);

        if (message.includes('OPENAI_API_KEY')) {
          throw new TRPCError({
            code: 'PRECONDITION_FAILED',
            message: 'El asistente no esta configurado. Falta OPENAI_API_KEY en el servidor.',
          });
        }

        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'No se pudo obtener una respuesta del asistente. Intenta nuevamente.',
        });
      }
    }),
});
