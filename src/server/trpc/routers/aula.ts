import { z } from 'zod';
import { createTRPCRouter, baseProcedure, adminProcedure, secretariaProcedure } from '../init';

const aulaInput = z.object({
  codigo: z.string().min(2, 'El código es obligatorio'),
  nombre: z.string().min(3, 'El nombre debe tener al menos 3 caracteres'),
  capacidad: z.number().int().min(1, 'La capacidad debe ser al menos 1'),
  tipo: z.enum(['TEORIA', 'LABORATORIO'] as const),
  edificio: z.string().min(1),
  piso: z.number().int().min(0),
});

export const aulaRouter = createTRPCRouter({
  list: baseProcedure
    .input(
      z.object({
        tipo: z.enum(['TEORIA', 'LABORATORIO'] as const).optional(),
        search: z.string().optional(),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      const where: Record<string, unknown> = {};

      if (input?.tipo) where.tipo = input.tipo;
      if (input?.search) {
        where.OR = [
          { nombre: { contains: input.search, mode: 'insensitive' } },
          { codigo: { contains: input.search, mode: 'insensitive' } },
        ];
      }

      return ctx.prisma.aula.findMany({
        where,
        orderBy: [{ edificio: 'asc' }, { piso: 'asc' }, { codigo: 'asc' }],
      });
    }),

  stats: baseProcedure
    .input(z.object({ periodoId: z.string().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const [total, porTipo, porEdificio, aulas, asignaciones, totalFranjas] = await Promise.all([
        ctx.prisma.aula.count(),
        ctx.prisma.aula.groupBy({
          by: ['tipo'],
          _count: true,
        }),
        ctx.prisma.aula.groupBy({
          by: ['edificio'],
          _count: true,
        }),
        ctx.prisma.aula.findMany({
          select: { id: true, codigo: true },
        }),
        input?.periodoId
          ? ctx.prisma.asignacion.findMany({
              where: { periodoId: input.periodoId },
              select: { aulaId: true },
            })
          : Promise.resolve([]),
        ctx.prisma.franjaHoraria.count(),
      ]);

      // Calculate occupation per aula
      const ocupacionPorAula = aulas.map((aula) => {
        const slotsAsignados = asignaciones.filter((a) => a.aulaId === aula.id).length;
        // Occupation % = (slots assigned / total slots available in the period)
        // Since franjas are the same for all aulas
        const ocupacion = totalFranjas > 0 ? Math.round((slotsAsignados / totalFranjas) * 100) : 0;

        return {
          id: aula.id,
          codigo: aula.codigo,
          ocupacion,
        };
      });

      return {
        total,
        porTipo: {
          TEORIA: porTipo.find((t) => t.tipo === 'TEORIA')?._count ?? 0,
          LABORATORIO: porTipo.find((t) => t.tipo === 'LABORATORIO')?._count ?? 0,
        },
        porEdificio: porEdificio.map((e) => ({
          edificio: e.edificio,
          count: e._count,
        })),
        ocupacionPorAula,
      };
    }),

  create: secretariaProcedure.input(aulaInput).mutation(({ ctx, input }) => {
    return ctx.prisma.aula.create({ data: input });
  }),

  update: secretariaProcedure
    .input(z.object({ id: z.string() }).merge(aulaInput))
    .mutation(({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.prisma.aula.update({ where: { id }, data });
    }),

  delete: adminProcedure.input(z.object({ id: z.string() })).mutation(({ ctx, input }) => {
    return ctx.prisma.aula.delete({ where: { id: input.id } });
  })
});
