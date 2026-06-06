import { describe, expect, it, vi } from 'vitest';
import { AvailabilityService } from './availability.service';

function makePrisma({
  aulaCapacidad = 20,
  grupoNumAlumnos = 35,
  disponibilidadCount = 0,
  hasSpecificAvailability = true,
}: {
  aulaCapacidad?: number;
  grupoNumAlumnos?: number;
  disponibilidadCount?: number;
  hasSpecificAvailability?: boolean;
} = {}) {
  return {
    franjaHoraria: {
      findUniqueOrThrow: vi.fn(async () => ({
        id: 'franja-1',
        dia: 'LUNES',
        horaInicio: '08:00',
        horaFin: '09:00',
      })),
    },
    asignacion: {
      findMany: vi
        .fn()
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]),
    },
    restriccionDocente: {
      findFirst: vi.fn(async () => null),
    },
    mantenimientoAula: {
      findFirst: vi.fn(async () => null),
    },
    disponibilidadDocente: {
      count: vi.fn(async () => disponibilidadCount),
      findFirst: vi.fn(async () => (hasSpecificAvailability ? { id: 'disp-1' } : null)),
    },
    aula: {
      findUniqueOrThrow: vi.fn(async () => ({ id: 'aula-1', capacidad: aulaCapacidad })),
    },
    grupo: {
      findUniqueOrThrow: vi.fn(async () => ({ id: 'grupo-1', numAlumnos: grupoNumAlumnos })),
    },
  } as any;
}

describe('AvailabilityService capacity validation', () => {
  it('rejects a slot when aula capacity is below group enrollment', async () => {
    const prisma = makePrisma({ aulaCapacidad: 20, grupoNumAlumnos: 35 });
    const service = new AvailabilityService(prisma);

    const result = await service.validateSlotSelection(
      'docente-1',
      'aula-1',
      'grupo-1',
      'franja-1',
      'period-1'
    );

    expect(result.valid).toBe(false);
    expect(result.reasons).toContain('El aula no tiene capacidad suficiente para el grupo');
  });

  it('allows a slot when aula capacity covers group enrollment', async () => {
    const prisma = makePrisma({ aulaCapacidad: 40, grupoNumAlumnos: 35 });
    const service = new AvailabilityService(prisma);

    const result = await service.validateSlotSelection(
      'docente-1',
      'aula-1',
      'grupo-1',
      'franja-1',
      'period-1'
    );

    expect(result.valid).toBe(true);
    expect(result.reasons).not.toContain('El aula no tiene capacidad suficiente para el grupo');
  });

  it('checks docente availability within the selected period', async () => {
    const prisma = makePrisma({
      aulaCapacidad: 40,
      grupoNumAlumnos: 35,
      disponibilidadCount: 1,
      hasSpecificAvailability: false,
    });
    const service = new AvailabilityService(prisma);

    const result = await service.validateSlotSelection(
      'docente-1',
      'aula-1',
      'grupo-1',
      'franja-1',
      'period-1'
    );

    expect(result.valid).toBe(false);
    expect(result.reasons).toContain('Usted no ha marcado esta franja como disponible');
    expect(prisma.disponibilidadDocente.count).toHaveBeenCalledWith({
      where: { docenteId: 'docente-1', periodoId: 'period-1' },
    });
    expect(prisma.disponibilidadDocente.findFirst).toHaveBeenCalledWith({
      where: { docenteId: 'docente-1', periodoId: 'period-1', franjaHorariaId: 'franja-1' },
    });
  });
});
