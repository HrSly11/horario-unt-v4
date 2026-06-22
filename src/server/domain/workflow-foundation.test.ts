import { describe, expect, it } from 'vitest';
import {
  assertExpectedVersion,
  assertWorkflowActivationReady,
  getTeachersWithoutAuthorityAccount,
  reconcileLegacyAssignmentHours,
  resolveUniqueNormalizedRelation,
} from './workflow-foundation';

describe('workflow foundation reconciliation', () => {
  it('matches a normalized legacy department name only when the candidate is unique', () => {
    expect(
      resolveUniqueNormalizedRelation('  Departamento   de SISTEMAS ', [
        { id: 'dept-1', name: 'Departamento de Sistemas' },
        { id: 'dept-2', name: 'Departamento de Matemáticas' },
      ])
    ).toEqual({ status: 'MATCHED', id: 'dept-1' });
  });

  it('returns a blocking ambiguity instead of guessing among duplicate normalized names', () => {
    expect(
      resolveUniqueNormalizedRelation('Sistemas', [
        { id: 'dept-1', name: 'Sistemas' },
        { id: 'dept-2', name: ' SISTEMAS ' },
      ])
    ).toEqual({ status: 'AMBIGUOUS', candidateIds: ['dept-1', 'dept-2'] });

    expect(resolveUniqueNormalizedRelation('Química', [])).toEqual({ status: 'UNMATCHED' });
  });

  it('reconciles exact component hours and reports no blockers', () => {
    expect(
      reconcileLegacyAssignmentHours({
        expectedHours: 8,
        assignments: [
          { component: 'TEORIA', labGroup: null, hours: 3 },
          { component: 'PRACTICA', labGroup: null, hours: 2 },
          { component: 'LABORATORIO', labGroup: 1, hours: 3 },
        ],
      })
    ).toEqual({ expectedHours: 8, assignedHours: 8, balanced: true, duplicateKeys: [] });
  });

  it('blocks activation for hour mismatches and duplicate component assignments', () => {
    const result = reconcileLegacyAssignmentHours({
      expectedHours: 6,
      assignments: [
        { component: 'TEORIA', labGroup: null, hours: 2 },
        { component: 'TEORIA', labGroup: null, hours: 1 },
        { component: 'LABORATORIO', labGroup: 1, hours: 2 },
      ],
    });

    expect(result).toEqual({
      expectedHours: 6,
      assignedHours: 5,
      balanced: false,
      duplicateKeys: ['TEORIA:GENERAL'],
    });
    expect(() =>
      assertWorkflowActivationReady([
        { blocking: true, resolved: false, code: 'HOUR_MISMATCH' },
      ])
    ).toThrow('HOUR_MISMATCH');
    expect(() =>
      assertWorkflowActivationReady([
        { blocking: true, resolved: true, code: 'RESOLVED_AMBIGUITY' },
        { blocking: false, resolved: false, code: 'INFORMATIONAL' },
      ])
    ).not.toThrow();
  });

  it('rejects stale aggregate versions and accepts the current version', () => {
    expect(() => assertExpectedVersion(4, 3)).toThrow('Versión desactualizada');
    expect(() => assertExpectedVersion(4, 4)).not.toThrow();
  });

  it('excludes teachers already claimed by authority users from DOCENTE account seeding', () => {
    expect(
      getTeachersWithoutAuthorityAccount(
        [{ id: 'teacher-1' }, { id: 'teacher-2' }, { id: 'teacher-3' }],
        ['teacher-1', 'teacher-3']
      )
    ).toEqual([{ id: 'teacher-2' }]);
    expect(
      getTeachersWithoutAuthorityAccount([{ id: 'teacher-1' }], [])
    ).toEqual([{ id: 'teacher-1' }]);
  });
});
