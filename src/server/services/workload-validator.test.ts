import { describe, it, expect } from 'vitest';
import {
  validateDailyLimit,
  validateWeeklyLimit,
  validateNoOverlap,
  validatePreparacionLimit,
  validateDEDictaOtraUniversidad,
  validateCargaCompleta,
  validateAll,
  type HorarioSlot,
} from './workload-validator';
import { ModalidadDocente } from '@/generated/prisma/client';

function slot(dia: string, inicio: string, fin: string, horas: number): HorarioSlot {
  return { dia, horaInicio: inicio, horaFin: fin, horas };
}

describe('validateDailyLimit', () => {
  it('passes when hours are under 8', () => {
    expect(validateDailyLimit(4)).toEqual({ valid: true });
    expect(validateDailyLimit(8)).toEqual({ valid: true });
  });

  it('fails when hours exceed 8', () => {
    const result = validateDailyLimit(9);
    expect(result.valid).toBe(false);
    expect(result.message).toContain('Excede límite de 8h/día');
  });

  it('fails with 0 hours edge case (passes)', () => {
    expect(validateDailyLimit(0)).toEqual({ valid: true });
  });
});

describe('validateWeeklyLimit', () => {
  it('TC: passes at 40h exactly', () => {
    expect(validateWeeklyLimit(40, ModalidadDocente.TIEMPO_COMPLETO, 40)).toEqual({ valid: true });
  });

  it('DE: passes at 40h exactly', () => {
    expect(validateWeeklyLimit(40, ModalidadDocente.DEDICACION_EXCLUSIVA, 40)).toEqual({ valid: true });
  });

  it('TC: fails above 40h', () => {
    const result = validateWeeklyLimit(42, ModalidadDocente.TIEMPO_COMPLETO, 40);
    expect(result.valid).toBe(false);
    expect(result.message).toContain('40h semanales');
  });

  it('DE: fails above 40h', () => {
    const result = validateWeeklyLimit(41, ModalidadDocente.DEDICACION_EXCLUSIVA, 40);
    expect(result.valid).toBe(false);
  });

  it('TP: passes under or equal to contrato', () => {
    expect(validateWeeklyLimit(20, ModalidadDocente.TIEMPO_PARCIAL, 20)).toEqual({ valid: true });
    expect(validateWeeklyLimit(15, ModalidadDocente.TIEMPO_PARCIAL, 20)).toEqual({ valid: true });
  });

  it('TP: fails above contrato even if under 40', () => {
    const result = validateWeeklyLimit(25, ModalidadDocente.TIEMPO_PARCIAL, 20);
    expect(result.valid).toBe(false);
    expect(result.message).toContain('Excede horas de contrato');
  });

  it('TP: fails above 40 regardless of contrato', () => {
    const result = validateWeeklyLimit(41, ModalidadDocente.TIEMPO_PARCIAL, 40);
    expect(result.valid).toBe(false);
  });
});

describe('validateNoOverlap', () => {
  const existing = [slot('LUNES', '08:00', '10:00', 2)];

  it('passes when no overlap with existing slots', () => {
    const result = validateNoOverlap(existing, [slot('LUNES', '10:00', '12:00', 2)]);
    expect(result.valid).toBe(true);
  });

  it('passes on different day', () => {
    const result = validateNoOverlap(existing, [slot('MARTES', '08:00', '10:00', 2)]);
    expect(result.valid).toBe(true);
  });

  it('fails on overlap (nuevo starts within existing)', () => {
    const result = validateNoOverlap(existing, [slot('LUNES', '09:00', '11:00', 2)]);
    expect(result.valid).toBe(false);
    expect(result.message).toContain('Conflicto');
  });

  it('fails on overlap (nuevo completely covers existing)', () => {
    const result = validateNoOverlap(existing, [slot('LUNES', '07:00', '12:00', 5)]);
    expect(result.valid).toBe(false);
  });

  it('fails on overlap (adjacent edge, same start/end)', () => {
    const result = validateNoOverlap([slot('LUNES', '10:00', '12:00', 2)], [slot('LUNES', '11:00', '13:00', 2)]);
    expect(result.valid).toBe(false);
  });

  it('passes with no existing slots', () => {
    const result = validateNoOverlap([], [slot('LUNES', '08:00', '10:00', 2)]);
    expect(result.valid).toBe(true);
  });

  it('fails on exact same slot', () => {
    const result = validateNoOverlap(existing, [slot('LUNES', '08:00', '10:00', 2)]);
    expect(result.valid).toBe(false);
  });
});

describe('validatePreparacionLimit', () => {
  it('passes when preparacion is exactly 50% of lectivas', () => {
    expect(validatePreparacionLimit(5, 10)).toEqual({ valid: true });
  });

  it('passes when preparacion is under 50%', () => {
    expect(validatePreparacionLimit(3, 10)).toEqual({ valid: true });
  });

  it('fails when preparacion exceeds 50%', () => {
    const result = validatePreparacionLimit(6, 10);
    expect(result.valid).toBe(false);
    expect(result.message).toContain('excede 50%');
  });

  it('passes with 0 lectivas and 0 preparacion', () => {
    expect(validatePreparacionLimit(0, 0)).toEqual({ valid: true });
  });

  it('fails when preparacion > 0 but lectivas = 0', () => {
    const result = validatePreparacionLimit(1, 0);
    expect(result.valid).toBe(false);
  });
});

describe('validateDEDictaOtraUniversidad', () => {
  it('passes for DE that does NOT teach elsewhere', () => {
    expect(validateDEDictaOtraUniversidad(ModalidadDocente.DEDICACION_EXCLUSIVA, false)).toEqual({ valid: true });
  });

  it('fails for DE that DOES teach elsewhere', () => {
    const result = validateDEDictaOtraUniversidad(ModalidadDocente.DEDICACION_EXCLUSIVA, true);
    expect(result.valid).toBe(false);
    expect(result.message).toContain('Dedicación Exclusiva');
  });

  it('passes for TC regardless of dictaOtraUniversidad', () => {
    expect(validateDEDictaOtraUniversidad(ModalidadDocente.TIEMPO_COMPLETO, true)).toEqual({ valid: true });
    expect(validateDEDictaOtraUniversidad(ModalidadDocente.TIEMPO_COMPLETO, false)).toEqual({ valid: true });
  });

  it('passes for TP regardless of dictaOtraUniversidad', () => {
    expect(validateDEDictaOtraUniversidad(ModalidadDocente.TIEMPO_PARCIAL, true)).toEqual({ valid: true });
  });
});

describe('validateCargaCompleta', () => {
  it('passes when lectiva + noLectiva equals contrato exactly', () => {
    expect(validateCargaCompleta(30, 10, 40)).toEqual({ valid: true });
  });

  it('fails when total exceeds contrato', () => {
    const result = validateCargaCompleta(35, 10, 40);
    expect(result.valid).toBe(false);
    expect(result.message).toContain('excede');
  });

  it('fails when total is less than contrato', () => {
    const result = validateCargaCompleta(20, 5, 40);
    expect(result.valid).toBe(false);
    expect(result.message).toContain('Faltan');
  });

  it('passes with zero total for partial contract', () => {
    const result = validateCargaCompleta(0, 0, 20);
    expect(result.valid).toBe(false);
    expect(result.message).toContain('Faltan');
  });
});

describe('validateAll', () => {
  function makePrisma({
    asignaciones = [],
    cargasNoLectivas = [],
    horasContrato = 40,
  }: {
    asignaciones?: Array<{ id: string; tipo: string; horasAsignadas: number }>;
    cargasNoLectivas?: Array<{ tipo: string; horas: number }>;
    horasContrato?: number;
  }) {
    return {
      docente: {
        findUniqueOrThrow: async () => ({
          modalidad: ModalidadDocente.TIEMPO_PARCIAL,
          horasContrato,
          dictaOtraUniversidad: false,
        }),
      },
      asignacionCargaLectiva: {
        findMany: async (args?: { where?: { tipo?: { not?: string }; id?: { not?: string } } }) => {
          return asignaciones.filter((asignacion) => {
            if (args?.where?.tipo?.not && asignacion.tipo === args.where.tipo.not) return false;
            if (args?.where?.id?.not && asignacion.id === args.where.id.not) return false;
            return true;
          });
        },
      },
      cargaNoLectiva: {
        findMany: async () => cargasNoLectivas,
      },
    } as never;
  }

  it('counts existing assignments of the same type when adding a new lective load', async () => {
    const prisma = makePrisma({
      asignaciones: [
        { id: 'a1', tipo: 'TEORIA', horasAsignadas: 20 },
        { id: 'a2', tipo: 'TEORIA', horasAsignadas: 15 },
      ],
      horasContrato: 40,
    });

    const result = await validateAll(prisma, 'docente-1', 'period-1', 10, 'TEORIA');

    expect(result.valid).toBe(false);
    expect(result.message).toContain('45h > 40h');
  });

  it('replaces the current assignment hours without losing same-type assignments during updates', async () => {
    const prisma = makePrisma({
      asignaciones: [
        { id: 'current', tipo: 'PRACTICA', horasAsignadas: 8 },
        { id: 'same-type-other', tipo: 'PRACTICA', horasAsignadas: 4 },
        { id: 'lab', tipo: 'LABORATORIO', horasAsignadas: 6 },
      ],
      horasContrato: 14,
    });

    const result = await validateAll(prisma, 'docente-1', 'period-1', 5, 'PRACTICA', {
      excludeAsignacionId: 'current',
    });

    expect(result.valid).toBe(false);
    expect(result.message).toContain('15h > 14h');
  });
});
