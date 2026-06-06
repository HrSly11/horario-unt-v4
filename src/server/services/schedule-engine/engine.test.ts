import { describe, it, expect } from 'vitest';
import { ScheduleEngine } from './engine';
import type {
  DocenteForSchedule,
  GrupoForSchedule,
  AulaForSchedule,
  FranjaForSchedule,
} from './types';

// ── Test Data Factories ────────────────────────────

function makeFranjas(count: number): FranjaForSchedule[] {
  const dias = ['LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES'];
  return Array.from({ length: count }, (_, i) => ({
    id: `franja-${i}`,
    dia: dias[i % dias.length],
    horaInicio: `${String(7 + Math.floor(i / dias.length)).padStart(2, '0')}:00`,
    horaFin: `${String(8 + Math.floor(i / dias.length)).padStart(2, '0')}:00`,
    numeroBloque: (i % 15) + 1,
  }));
}

function makeDocente(id: string, overrides: Partial<DocenteForSchedule> = {}): DocenteForSchedule {
  return {
    id,
    nombre: `Docente ${id}`,
    categoria: 'PRINCIPAL',
    tipo: 'NOMBRADO',
    antiguedad: new Date('2000-01-01'),
    ...overrides,
  };
}

function makeGrupo(id: string, overrides: Partial<GrupoForSchedule> = {}): GrupoForSchedule {
  return {
    id,
    nombre: 'A',
    cursoId: `curso-${id}`,
    cursoNombre: `Curso ${id}`,
    cursoCodigo: `IS-${id}`,
    ciclo: 5,
    numAlumnos: 30,
    horasTeoria: 2,
    horasPractica: 0,
    horasLaboratorio: 0,
    requiereLaboratorio: false,
    ...overrides,
  };
}

function makeAula(id: string, tipo: 'TEORIA' | 'LABORATORIO' = 'TEORIA'): AulaForSchedule {
  return { id, codigo: `A-${id}`, nombre: `Aula ${id}`, capacidad: 40, tipo };
}

// ── Map: Docente → Grupo assignments ───────────────
type DocenteGrupoMap = Map<string, string[]>;

function makeMap(entries: [string, string[]][]): DocenteGrupoMap {
  return new Map(entries);
}

// ── Tests ──────────────────────────────────────────

describe('ScheduleEngine', () => {
  it('assigns theory hours to theory aulas', () => {
    const engine = new ScheduleEngine({
      docentes: [makeDocente('d1')],
      grupos: [makeGrupo('g1', { horasTeoria: 2, horasLaboratorio: 0 })],
      aulas: [makeAula('a1', 'TEORIA')],
      franjas: makeFranjas(10),
      docenteGrupoMap: makeMap([['d1', ['g1']]]),
    });

    const result = engine.generate();

    expect(result.assignments.length).toBe(2);
    expect(result.assignments.every((a) => a.tipo === 'TEORIA')).toBe(true);
    expect(result.unassigned.length).toBe(0);
  });

  it('assigns lab hours to lab aulas separately from theory', () => {
    const engine = new ScheduleEngine({
      docentes: [makeDocente('d1')],
      grupos: [makeGrupo('g1', { horasTeoria: 2, horasLaboratorio: 2, requiereLaboratorio: true })],
      aulas: [makeAula('a-teoria', 'TEORIA'), makeAula('a-lab', 'LABORATORIO')],
      franjas: makeFranjas(10),
      docenteGrupoMap: makeMap([['d1', ['g1']]]),
    });

    const result = engine.generate();

    const teoriaAssignments = result.assignments.filter((a) => a.tipo === 'TEORIA');
    const labAssignments = result.assignments.filter((a) => a.tipo === 'LABORATORIO');

    expect(teoriaAssignments.length).toBe(2);
    expect(labAssignments.length).toBe(2);
    expect(teoriaAssignments.every((a) => a.aulaId === 'a-teoria')).toBe(true);
    expect(labAssignments.every((a) => a.aulaId === 'a-lab')).toBe(true);
  });

  it('assigns practice hours to theory aulas independently from theory and lab hours', () => {
    const engine = new ScheduleEngine({
      docentes: [makeDocente('d1')],
      grupos: [makeGrupo('g-practica', { horasTeoria: 0, horasPractica: 2, horasLaboratorio: 0 })],
      aulas: [makeAula('a-teoria', 'TEORIA')],
      franjas: makeFranjas(10),
      docenteGrupoMap: makeMap([['d1', ['g-practica']]]),
    });

    const result = engine.generate();

    expect(result.assignments).toHaveLength(2);
    expect(result.assignments.every((a) => a.tipo === 'PRACTICA')).toBe(true);
    expect(result.assignments.every((a) => a.aulaId === 'a-teoria')).toBe(true);
    expect(result.unassigned).toHaveLength(0);
  });

  it('does not assign a group to an aula below its enrollment capacity', () => {
    const engine = new ScheduleEngine({
      docentes: [makeDocente('d1')],
      grupos: [makeGrupo('g-large', { numAlumnos: 45, horasTeoria: 1 })],
      aulas: [makeAula('a-small', 'TEORIA')],
      franjas: makeFranjas(3),
      docenteGrupoMap: makeMap([['d1', ['g-large']]]),
    });

    const result = engine.generate();

    expect(result.assignments).toHaveLength(0);
    expect(result.unassigned).toHaveLength(1);
    expect(result.unassigned[0].reason).toContain('capacidad');
  });

  it('respects docente hierarchy — higher priority docente gets preferred slots', () => {
    const franjas = makeFranjas(2); // Only 2 slots available
    const aulas = [makeAula('a1', 'TEORIA')];

    const engine = new ScheduleEngine({
      docentes: [
        makeDocente('d-contratado', { tipo: 'CONTRATADO', categoria: 'AUXILIAR' }),
        makeDocente('d-nombrado', { tipo: 'NOMBRADO', categoria: 'PRINCIPAL' }),
      ],
      grupos: [
        makeGrupo('g1', { horasTeoria: 1 }),
        makeGrupo('g2', { horasTeoria: 1 }),
      ],
      aulas,
      franjas,
      docenteGrupoMap: makeMap([
        ['d-nombrado', ['g1']],
        ['d-contratado', ['g2']],
      ]),
    });

    const result = engine.generate();

    // Nombrado should get franja-0 (first available)
    const nombradoAssignment = result.assignments.find((a) => a.docenteId === 'd-nombrado');
    expect(nombradoAssignment?.franjaHorariaId).toBe('franja-0');
  });

  it('prevents docente double-booking', () => {
    const franjas = makeFranjas(2);

    const engine = new ScheduleEngine({
      docentes: [makeDocente('d1')],
      grupos: [
        makeGrupo('g1', { horasTeoria: 1 }),
        makeGrupo('g2', { horasTeoria: 1 }),
      ],
      aulas: [makeAula('a1'), makeAula('a2')],
      franjas,
      docenteGrupoMap: makeMap([['d1', ['g1', 'g2']]]),
    });

    const result = engine.generate();

    // Both assigned but in DIFFERENT franjas
    expect(result.assignments.length).toBe(2);
    const franjaIds = result.assignments.map((a) => a.franjaHorariaId);
    expect(new Set(franjaIds).size).toBe(2); // All unique franjas
  });

  it('prevents aula double-booking', () => {
    const franjas = makeFranjas(1); // Only 1 slot

    const engine = new ScheduleEngine({
      docentes: [makeDocente('d1'), makeDocente('d2', { categoria: 'ASOCIADO' })],
      grupos: [
        makeGrupo('g1', { horasTeoria: 1 }),
        makeGrupo('g2', { horasTeoria: 1 }),
      ],
      aulas: [makeAula('a1')], // Only 1 aula
      franjas,
      docenteGrupoMap: makeMap([['d1', ['g1']], ['d2', ['g2']]]),
    });

    const result = engine.generate();

    // One should be assigned, one should fail (only 1 aula × 1 franja = 1 slot)
    expect(result.assignments.length).toBe(1);
    expect(result.unassigned.length).toBe(1);
  });

  it('reports unassigned items with reason when no valid slot found', () => {
    const engine = new ScheduleEngine({
      docentes: [makeDocente('d1')],
      grupos: [makeGrupo('g1', { horasTeoria: 2, horasLaboratorio: 2, requiereLaboratorio: true })],
      aulas: [makeAula('a1', 'TEORIA')], // No lab aula!
      franjas: makeFranjas(10),
      docenteGrupoMap: makeMap([['d1', ['g1']]]),
    });

    const result = engine.generate();

    // Theory should work, lab should fail
    expect(result.assignments.filter((a) => a.tipo === 'TEORIA').length).toBe(2);
    expect(result.unassigned.length).toBe(1);
    expect(result.unassigned[0].tipo).toBe('LABORATORIO');
    expect(result.unassigned[0].reason).toContain('aula');
  });

  it('returns correct stats', () => {
    const engine = new ScheduleEngine({
      docentes: [makeDocente('d1')],
      grupos: [makeGrupo('g1', { horasTeoria: 2 })],
      aulas: [makeAula('a1')],
      franjas: makeFranjas(10),
      docenteGrupoMap: makeMap([['d1', ['g1']]]),
    });

    const result = engine.generate();

    expect(result.stats.totalGrupos).toBe(1);
    expect(result.stats.assigned).toBe(1);
    expect(result.stats.unassignedCount).toBe(0);
  });
});
