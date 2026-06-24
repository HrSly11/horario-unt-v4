/**
 * Helper centralizado para validar el formulario de asignación de carga lectiva.
 * Usado por /carga-lectiva y /demanda-departamento para que la habilitación del
 * botón "Guardar" sea coherente y predecible, y para mostrar mensajes
 * específicos al usuario cuando el botón está deshabilitado.
 */

export interface AssignmentFormState {
  /** Curso seleccionado en el modal */
  selectedCurso: {
    horasTeoria: number;
    horasPractica: number;
    horasLaboratorio: number;
    numGruposLaboratorio: number;
  } | null;

  docenteId: string;
  grupoId: string;

  horasTeoria: number;
  horasPractica: number;
  horasLaboratorio: number;

  horasTeoriaCompartido: number;
  horasPracticaCompartido: number;
  horasLaboratorioCompartido: number;

  teoriaCompartido: boolean;
  practicaCompartido: boolean;
  laboratorioCompartido: boolean;

  teoriaDocenteCompartidoId: string;
  practicaDocenteCompartidoId: string;
  laboratorioDocenteCompartidoId: string;

  gruposLaboratorio: number[];
  gruposLaboratorioCompartido: number[];

  isPending: boolean;
}

export interface ValidationResult {
  disabled: boolean;
  reason?: string;
}

/**
 * Evalúa si el botón "Guardar" debe estar habilitado y, si no, devuelve la razón.
 */
export function evaluateAssignmentForm(state: AssignmentFormState): ValidationResult {
  if (state.isPending) {
    return { disabled: true, reason: 'Guardando…' };
  }
  if (!state.docenteId) {
    return { disabled: true, reason: 'Selecciona un docente principal' };
  }
  if (!state.grupoId) {
    return { disabled: true, reason: 'Selecciona un curso (grupo)' };
  }
  if (!state.selectedCurso) {
    return { disabled: true, reason: 'Selecciona un curso para continuar' };
  }

  const {
    horasTeoria,
    horasPractica,
    horasLaboratorio,
    horasTeoriaCompartido,
    horasPracticaCompartido,
    horasLaboratorioCompartido,
    teoriaCompartido,
    practicaCompartido,
    laboratorioCompartido,
    teoriaDocenteCompartidoId,
    practicaDocenteCompartidoId,
    laboratorioDocenteCompartidoId,
    gruposLaboratorio,
    gruposLaboratorioCompartido,
    selectedCurso,
  } = state;

  // 1. Debe haber al menos una hora asignada en algún componente.
  const totalHorasAsignadas =
    horasTeoria +
    horasPractica +
    horasLaboratorio +
    horasTeoriaCompartido +
    horasPracticaCompartido +
    horasLaboratorioCompartido;

  if (totalHorasAsignadas === 0) {
    return {
      disabled: true,
      reason: 'Asigna al menos una hora de teoría, práctica o laboratorio',
    };
  }

  // 2. Cada componente marcado como compartido debe tener un docente compartido.
  if (teoriaCompartido && !teoriaDocenteCompartidoId) {
    return {
      disabled: true,
      reason: 'Selecciona el docente compartido para teoría',
    };
  }
  if (practicaCompartido && !practicaDocenteCompartidoId) {
    return {
      disabled: true,
      reason: 'Selecciona el docente compartido para práctica',
    };
  }
  if (laboratorioCompartido && !laboratorioDocenteCompartidoId) {
    return {
      disabled: true,
      reason: 'Selecciona el docente compartido para laboratorio',
    };
  }

  // 3. Las horas no deben exceder el límite del curso.
  const teoriaTotal = horasTeoria + (teoriaCompartido ? horasTeoriaCompartido : 0);
  if (teoriaTotal > selectedCurso.horasTeoria) {
    return {
      disabled: true,
      reason: `Teoría: ${teoriaTotal}h excede el límite del curso (${selectedCurso.horasTeoria}h)`,
    };
  }
  const practicaTotal = horasPractica + (practicaCompartido ? horasPracticaCompartido : 0);
  if (practicaTotal > selectedCurso.horasPractica) {
    return {
      disabled: true,
      reason: `Práctica: ${practicaTotal}h excede el límite del curso (${selectedCurso.horasPractica}h)`,
    };
  }

  // 4. Para laboratorio con múltiples turnos: todos los grupos deben estar
  //    asignados entre primario + compartido.
  if (
    selectedCurso.numGruposLaboratorio &&
    selectedCurso.numGruposLaboratorio > 1 &&
    selectedCurso.horasLaboratorio > 0
  ) {
    const totalGrupos =
      gruposLaboratorio.length +
      (laboratorioCompartido ? gruposLaboratorioCompartido.length : 0);
    if (totalGrupos !== selectedCurso.numGruposLaboratorio) {
      const faltan = selectedCurso.numGruposLaboratorio - totalGrupos;
      return {
        disabled: true,
        reason: `Falta asignar ${faltan} grupo(s) de laboratorio (${totalGrupos}/${selectedCurso.numGruposLaboratorio})`,
      };
    }
  } else {
    const labTotal = horasLaboratorio + (laboratorioCompartido ? horasLaboratorioCompartido : 0);
    if (labTotal > selectedCurso.horasLaboratorio) {
      return {
        disabled: true,
        reason: `Laboratorio: ${labTotal}h excede el límite del curso (${selectedCurso.horasLaboratorio}h)`,
      };
    }
  }

  return { disabled: false };
}
