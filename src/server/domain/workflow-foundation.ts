export type CurriculumClosureState = {
  estudiantesPendientes: number;
  activeDemandLineCount: number;
};

export function getCurriculumClosureBlockers(state: CurriculumClosureState): string[] {
  const blockers: string[] = [];

  if (state.estudiantesPendientes > 0) {
    blockers.push(
      `La currícula mantiene ${state.estudiantesPendientes} estudiante(s) pendiente(s)`
    );
  }

  if (state.activeDemandLineCount > 0) {
    blockers.push(
      `La currícula mantiene ${state.activeDemandLineCount} apertura(s) de demanda activa(s)`
    );
  }

  return blockers;
}

export function assertCurriculumCanClose(state: CurriculumClosureState): void {
  const blockers = getCurriculumClosureBlockers(state);
  if (blockers.length > 0) throw new Error(blockers.join('. '));
}

export function assertExpectedVersion(currentVersion: number, expectedVersion: number): void {
  if (currentVersion !== expectedVersion) {
    throw new Error(
      `Versión desactualizada: se esperaba ${expectedVersion} y la versión actual es ${currentVersion}`
    );
  }
}

function normalizeLegacyName(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLocaleLowerCase('es-PE');
}

export type RelationCandidate = { id: string; name: string };

export type RelationResolution =
  | { status: 'MATCHED'; id: string }
  | { status: 'AMBIGUOUS'; candidateIds: string[] }
  | { status: 'UNMATCHED' };

export function resolveUniqueNormalizedRelation(
  legacyName: string,
  candidates: RelationCandidate[]
): RelationResolution {
  const normalizedLegacyName = normalizeLegacyName(legacyName);
  const matches = candidates.filter(
    (candidate) => normalizeLegacyName(candidate.name) === normalizedLegacyName
  );

  if (matches.length === 1) return { status: 'MATCHED', id: matches[0].id };
  if (matches.length > 1) {
    return { status: 'AMBIGUOUS', candidateIds: matches.map(({ id }) => id) };
  }
  return { status: 'UNMATCHED' };
}

export type LegacyAssignment = {
  component: 'TEORIA' | 'PRACTICA' | 'LABORATORIO';
  labGroup: number | null;
  hours: number;
};

export function reconcileLegacyAssignmentHours(input: {
  expectedHours: number;
  assignments: LegacyAssignment[];
}) {
  const assignedHours = input.assignments.reduce((total, assignment) => total + assignment.hours, 0);
  const seen = new Set<string>();
  const duplicateKeys = new Set<string>();

  for (const assignment of input.assignments) {
    const key = `${assignment.component}:${assignment.labGroup ?? 'GENERAL'}`;
    if (seen.has(key)) duplicateKeys.add(key);
    seen.add(key);
  }

  return {
    expectedHours: input.expectedHours,
    assignedHours,
    balanced: assignedHours === input.expectedHours && duplicateKeys.size === 0,
    duplicateKeys: [...duplicateKeys].sort(),
  };
}

export type ActivationIssue = {
  blocking: boolean;
  resolved: boolean;
  code: string;
};

export function assertWorkflowActivationReady(issues: ActivationIssue[]): void {
  const blockers = issues.filter((issue) => issue.blocking && !issue.resolved);
  if (blockers.length > 0) {
    throw new Error(
      `La activación está bloqueada por reconciliaciones pendientes: ${blockers
        .map(({ code }) => code)
        .join(', ')}`
    );
  }
}

export function getTeachersWithoutAuthorityAccount<T extends { id: string }>(
  teachers: T[],
  authorityTeacherIds: Iterable<string>
): T[] {
  const claimedIds = new Set(authorityTeacherIds);
  return teachers.filter((teacher) => !claimedIds.has(teacher.id));
}
