import { describe, expect, it } from 'vitest';
import { evaluateAssignmentForm, type AssignmentFormState } from './assignment-validation';

function baseForm(overrides: Partial<AssignmentFormState> = {}): AssignmentFormState {
  return {
    selectedCurso: {
      horasTeoria: 4,
      horasPractica: 2,
      horasLaboratorio: 4,
      numGruposLaboratorio: 2,
    },
    docenteId: 'doc-1',
    grupoId: 'grupo-1',
    horasTeoria: 4,
    horasPractica: 0,
    horasLaboratorio: 4,
    horasTeoriaCompartido: 0,
    horasPracticaCompartido: 0,
    horasLaboratorioCompartido: 0,
    teoriaCompartido: false,
    practicaCompartido: false,
    laboratorioCompartido: false,
    teoriaDocenteCompartidoId: '',
    practicaDocenteCompartidoId: '',
    laboratorioDocenteCompartidoId: '',
    gruposLaboratorio: [1, 2],
    gruposLaboratorioCompartido: [],
    isPending: false,
    ...overrides,
  };
}

describe('evaluateAssignmentForm', () => {
  it('enables when all required fields are filled (single teacher)', () => {
    const result = evaluateAssignmentForm(baseForm());
    expect(result.disabled).toBe(false);
  });

  it('blocks when docenteId is missing', () => {
    const result = evaluateAssignmentForm(baseForm({ docenteId: '' }));
    expect(result.disabled).toBe(true);
    expect(result.reason).toMatch(/docente/i);
  });

  it('blocks when grupoId is missing', () => {
    const result = evaluateAssignmentForm(baseForm({ grupoId: '' }));
    expect(result.disabled).toBe(true);
    expect(result.reason).toMatch(/curso|grupo/i);
  });

  it('blocks when no horas are distributed', () => {
    const result = evaluateAssignmentForm(
      baseForm({ horasTeoria: 0, horasLaboratorio: 0, gruposLaboratorio: [] })
    );
    expect(result.disabled).toBe(true);
    expect(result.reason).toMatch(/hora/i);
  });

  it('blocks when theory hours exceed course limit', () => {
    const result = evaluateAssignmentForm(
      baseForm({ horasTeoria: 8 })
    );
    expect(result.disabled).toBe(true);
    expect(result.reason).toMatch(/Teoría.*excede/i);
  });

  it('blocks when practice hours exceed course limit', () => {
    const result = evaluateAssignmentForm(
      baseForm({ horasPractica: 5 })
    );
    expect(result.disabled).toBe(true);
    expect(result.reason).toMatch(/Práctica.*excede/i);
  });

  it('blocks when shared teacher is missing but compartido is checked (theory)', () => {
    const result = evaluateAssignmentForm(
      baseForm({ teoriaCompartido: true, horasTeoriaCompartido: 2 })
    );
    expect(result.disabled).toBe(true);
    expect(result.reason).toMatch(/docente compartido/i);
  });

  it('blocks when not all lab groups are assigned (numGruposLaboratorio=2)', () => {
    const result = evaluateAssignmentForm(baseForm({ gruposLaboratorio: [1] }));
    expect(result.disabled).toBe(true);
    expect(result.reason).toMatch(/grupo.*laboratorio/i);
  });

  it('allows when lab groups are split between primary and shared', () => {
    const result = evaluateAssignmentForm(
      baseForm({
        laboratorioCompartido: true,
        laboratorioDocenteCompartidoId: 'doc-2',
        horasLaboratorioCompartido: 4,
        gruposLaboratorio: [1],
        gruposLaboratorioCompartido: [2],
      })
    );
    expect(result.disabled).toBe(false);
  });

  it('blocks when lab hours exceed course limit (numGruposLaboratorio=1)', () => {
    const result = evaluateAssignmentForm(
      baseForm({
        selectedCurso: {
          horasTeoria: 4,
          horasPractica: 2,
          horasLaboratorio: 2,
          numGruposLaboratorio: 1,
        },
        horasLaboratorio: 4,
        gruposLaboratorio: [],
        gruposLaboratorioCompartido: [],
      })
    );
    expect(result.disabled).toBe(true);
    expect(result.reason).toMatch(/Laboratorio.*excede/i);
  });

  it('blocks while pending', () => {
    const result = evaluateAssignmentForm(baseForm({ isPending: true }));
    expect(result.disabled).toBe(true);
  });
});
