import { describe, it, expect } from 'vitest';
import {
  validateDailyLimit,
  validateWeeklyLimit,
  validateNoOverlap,
  validatePreparacionLimit,
  validateDEDictaOtraUniversidad,
  validateCargaCompleta,
  validateAll,
  validateDocenteWorkload,
  type HorarioSlot,
} from './workload-validator';
import { ModalidadDocente, TipoDocente, CategoriaDocente, CargoAcademico, TipoCargaNoLectiva } from '@/generated/prisma/client';

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

describe('validateDocenteWorkload detailed rules', () => {
  function makeMockPrisma({
    categoria = CategoriaDocente.PRINCIPAL,
    tipo = TipoDocente.NOMBRADO,
    modalidad = ModalidadDocente.TIEMPO_COMPLETO,
    horasContrato = 40,
    cargo = null as CargoAcademico | null,
    cargoRuleLectiveMin = null as number | null,
    asignaciones = [] as { horasAsignadas: number }[],
    cargasNoLectivas = [] as any[],
  }: {
    categoria?: CategoriaDocente;
    tipo?: TipoDocente;
    modalidad?: ModalidadDocente;
    horasContrato?: number;
    cargo?: CargoAcademico | null;
    cargoRuleLectiveMin?: number | null;
    asignaciones?: { horasAsignadas: number }[];
    cargasNoLectivas?: any[];
  }) {
    return {
      docente: {
        findUniqueOrThrow: async () => ({
          id: 'docente-1',
          categoria,
          tipo,
          modalidad,
          horasContrato,
          dictaOtraUniversidad: false,
        }),
      },
      cargoDocente: {
        findFirst: async () => cargo ? { cargo } : null,
      },
      reglaCargaPorCargo: {
        findFirst: async () => cargoRuleLectiveMin !== null ? { horasLectivasMinimas: cargoRuleLectiveMin } : null,
      },
      asignacionCargaLectiva: {
        findMany: async () => asignaciones,
      },
      cargaNoLectiva: {
        findMany: async () => cargasNoLectivas,
      },
      asignacion: {
        findMany: async () => [],
      },
      preasignacion: {
        findMany: async () => [],
      },
    } as any;
  }

  it('Ordinary DE/TC: passes when lective is exactly 16h', async () => {
    const prisma = makeMockPrisma({
      modalidad: ModalidadDocente.TIEMPO_COMPLETO,
      tipo: TipoDocente.NOMBRADO,
      asignaciones: [{ horasAsignadas: 16 }],
      cargasNoLectivas: [{ tipo: 'RESPONSABILIDAD_SOCIAL', horas: 1, descripcion: 'Proyeccion social' }],
    });
    const result = await validateDocenteWorkload(prisma, 'docente-1', 'period-1');
    expect(result.valid).toBe(true);
  });

  it('Ordinary DE/TC: fails when lective is under 16h', async () => {
    const prisma = makeMockPrisma({
      modalidad: ModalidadDocente.TIEMPO_COMPLETO,
      tipo: TipoDocente.NOMBRADO,
      asignaciones: [{ horasAsignadas: 15 }],
    });
    const result = await validateDocenteWorkload(prisma, 'docente-1', 'period-1');
    expect(result.valid).toBe(false);
    expect(result.message).toContain('Mínimo de horas lectivas no cumplido');
  });

  it('Contracted DE/TC: fails when lective is under 20h', async () => {
    const prisma = makeMockPrisma({
      modalidad: ModalidadDocente.TIEMPO_COMPLETO,
      tipo: TipoDocente.CONTRATADO,
      asignaciones: [{ horasAsignadas: 19 }],
    });
    const result = await validateDocenteWorkload(prisma, 'docente-1', 'period-1');
    expect(result.valid).toBe(false);
    expect(result.message).toContain('Mínimo de horas lectivas no cumplido');
  });

  it('Jefe de Práctica TC: fails when lective is under 24h', async () => {
    const prisma = makeMockPrisma({
      categoria: CategoriaDocente.JEFE_PRACTICA,
      modalidad: ModalidadDocente.TIEMPO_COMPLETO,
      tipo: TipoDocente.CONTRATADO,
      asignaciones: [{ horasAsignadas: 23 }],
    });
    const result = await validateDocenteWorkload(prisma, 'docente-1', 'period-1');
    expect(result.valid).toBe(false);
    expect(result.message).toContain('Mínimo de horas lectivas no cumplido');
  });

  it('Ordinary TP20: fails when lective is under 12h', async () => {
    const prisma = makeMockPrisma({
      modalidad: ModalidadDocente.TIEMPO_PARCIAL,
      tipo: TipoDocente.NOMBRADO,
      horasContrato: 20,
      asignaciones: [{ horasAsignadas: 11 }],
    });
    const result = await validateDocenteWorkload(prisma, 'docente-1', 'period-1');
    expect(result.valid).toBe(false);
    expect(result.message).toContain('Mínimo de horas lectivas no cumplido');
  });

  it('Special-position rules override defaults (e.g. DE/TC with cargo decano needs 4h lective)', async () => {
    const prisma = makeMockPrisma({
      modalidad: ModalidadDocente.TIEMPO_COMPLETO,
      tipo: TipoDocente.NOMBRADO,
      cargo: CargoAcademico.DECANO,
      cargoRuleLectiveMin: 4,
      asignaciones: [{ horasAsignadas: 4 }],
      cargasNoLectivas: [{ tipo: 'RESPONSABILIDAD_SOCIAL', horas: 1, descripcion: 'Proyeccion social' }],
    });
    const result = await validateDocenteWorkload(prisma, 'docente-1', 'period-1');
    expect(result.valid).toBe(true);
  });

  it('Training: fails when training hours exceed 5h', async () => {
    const prisma = makeMockPrisma({
      modalidad: ModalidadDocente.TIEMPO_COMPLETO,
      tipo: TipoDocente.NOMBRADO,
      asignaciones: [{ horasAsignadas: 16 }],
      cargasNoLectivas: [
        { tipo: 'CAPACITACION', horas: 6, descripcion: 'Curso de capacitacion' },
        { tipo: 'RESPONSABILIDAD_SOCIAL', horas: 1, descripcion: 'Proyeccion social' }
      ],
    });
    const result = await validateDocenteWorkload(prisma, 'docente-1', 'period-1');
    expect(result.valid).toBe(false);
    expect(result.message).toContain('Capacitación excede el límite máximo de 5h');
  });

  it('Thesis: fails when thesis advisory hours exceed 3h', async () => {
    const prisma = makeMockPrisma({
      modalidad: ModalidadDocente.TIEMPO_COMPLETO,
      tipo: TipoDocente.NOMBRADO,
      asignaciones: [{ horasAsignadas: 16 }],
      cargasNoLectivas: [
        { tipo: 'ASESORIA_TESIS', horas: 4, descripcion: 'Asesoria de tesis' },
        { tipo: 'RESPONSABILIDAD_SOCIAL', horas: 1, descripcion: 'Proyeccion social' }
      ],
    });
    const result = await validateDocenteWorkload(prisma, 'docente-1', 'period-1');
    expect(result.valid).toBe(false);
    expect(result.message).toContain('Asesoría de tesis excede el límite máximo de 3h');
  });

  it('Juries: fails when jury hours exceed 1h', async () => {
    const prisma = makeMockPrisma({
      modalidad: ModalidadDocente.TIEMPO_COMPLETO,
      tipo: TipoDocente.NOMBRADO,
      asignaciones: [{ horasAsignadas: 16 }],
      cargasNoLectivas: [
        { tipo: 'JURADOS', horas: 2, descripcion: 'Jurado de tesis' },
        { tipo: 'RESPONSABILIDAD_SOCIAL', horas: 1, descripcion: 'Proyeccion social' }
      ],
    });
    const result = await validateDocenteWorkload(prisma, 'docente-1', 'period-1');
    expect(result.valid).toBe(false);
    expect(result.message).toContain('Jurados excede el límite máximo de 1h');
  });

  it('Research: fails when research has no project code or name', async () => {
    const prisma = makeMockPrisma({
      modalidad: ModalidadDocente.TIEMPO_COMPLETO,
      tipo: TipoDocente.NOMBRADO,
      asignaciones: [{ horasAsignadas: 16 }],
      cargasNoLectivas: [
        { tipo: 'INVESTIGACION', horas: 5, descripcion: 'Investigacion cientifica' },
        { tipo: 'RESPONSABILIDAD_SOCIAL', horas: 1, descripcion: 'Proyeccion social' }
      ],
    });
    const result = await validateDocenteWorkload(prisma, 'docente-1', 'period-1');
    expect(result.valid).toBe(false);
    expect(result.message).toContain('Investigación requiere código y nombre de proyecto registrado');
  });

  it('Research: passes when research has project code and name and >= 5h for TC', async () => {
    const prisma = makeMockPrisma({
      modalidad: ModalidadDocente.TIEMPO_COMPLETO,
      tipo: TipoDocente.NOMBRADO,
      asignaciones: [{ horasAsignadas: 16 }],
      cargasNoLectivas: [
        { tipo: 'INVESTIGACION', horas: 5, descripcion: 'Investigacion cientifica', codigoProyecto: 'PRY-001', nombreProyecto: 'Proyecto Unt' },
        { tipo: 'RESPONSABILIDAD_SOCIAL', horas: 1, descripcion: 'Proyeccion social' }
      ],
    });
    const result = await validateDocenteWorkload(prisma, 'docente-1', 'period-1');
    expect(result.valid).toBe(true);
  });

  it('Research: fails when research is under 5h for TC', async () => {
    const prisma = makeMockPrisma({
      modalidad: ModalidadDocente.TIEMPO_COMPLETO,
      tipo: TipoDocente.NOMBRADO,
      asignaciones: [{ horasAsignadas: 16 }],
      cargasNoLectivas: [
        { tipo: 'INVESTIGACION', horas: 4, descripcion: 'Investigacion cientifica', codigoProyecto: 'PRY-001', nombreProyecto: 'Proyecto Unt' },
        { tipo: 'RESPONSABILIDAD_SOCIAL', horas: 1, descripcion: 'Proyeccion social' }
      ],
    });
    const result = await validateDocenteWorkload(prisma, 'docente-1', 'period-1');
    expect(result.valid).toBe(false);
    expect(result.message).toContain('Investigación requiere un mínimo de 5h para TC/DE');
  });

  it('Social projection: fails when TC/DE lacks at least 1h of social projection', async () => {
    const prisma = makeMockPrisma({
      modalidad: ModalidadDocente.TIEMPO_COMPLETO,
      tipo: TipoDocente.NOMBRADO,
      asignaciones: [{ horasAsignadas: 16 }],
      cargasNoLectivas: [],
    });
    const result = await validateDocenteWorkload(prisma, 'docente-1', 'period-1');
    expect(result.valid).toBe(false);
    expect(result.message).toContain('Dedicación Exclusiva / Tiempo Completo requiere mínimo 1h de responsabilidad social');
  });

  it('Evidence: fails when a regulated activity has no description evidence', async () => {
    const prisma = makeMockPrisma({
      modalidad: ModalidadDocente.TIEMPO_COMPLETO,
      tipo: TipoDocente.NOMBRADO,
      asignaciones: [{ horasAsignadas: 16 }],
      cargasNoLectivas: [
        { tipo: 'ASESORIA_TESIS', horas: 2, descripcion: '' },
        { tipo: 'RESPONSABILIDAD_SOCIAL', horas: 1, descripcion: 'Proyeccion social' }
      ],
    });
    const result = await validateDocenteWorkload(prisma, 'docente-1', 'period-1');
    expect(result.valid).toBe(false);
    expect(result.message).toContain('requiere descripción de evidencia');
  });
});

