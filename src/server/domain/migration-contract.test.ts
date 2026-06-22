import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migrationsRoot = resolve(process.cwd(), 'prisma/migrations');
const ownershipDirectory = resolve(migrationsRoot, '20260622154000_scoped_ownership_curricula_reconciliation');
const workflowDirectory = resolve(migrationsRoot, '20260622154100_scheduling_workflow_aggregates');

function migrationSql(directory: string) {
  return readFileSync(resolve(directory, 'migration.sql'), 'utf8');
}

describe('integral scheduling migration contract', () => {
  it('uses immutable ordered migration boundaries with matching rollback files', () => {
    expect(
      existsSync(resolve(migrationsRoot, '20260622154000_integral_scheduling_foundation', 'migration.sql'))
    ).toBe(false);
    expect(existsSync(resolve(ownershipDirectory, 'rollback.sql'))).toBe(true);
    expect(existsSync(resolve(workflowDirectory, 'rollback.sql'))).toBe(true);
  });

  it('keeps unique-only ownership reconciliation and blocking ambiguity rows in the first migration', () => {
    const sql = migrationSql(ownershipDirectory);
    expect(sql).toContain('candidates.matches = 1');
    expect(sql).toContain("'DEPARTAMENTO_AMBIGUO'");
    expect(sql).toContain('migracion_reconciliaciones');
  });

  it('materializes only unambiguous openings and enforces cargo scope in the workflow migration', () => {
    const sql = migrationSql(workflowDirectory);
    expect(sql).toContain('INSERT INTO "demandas_academicas"');
    expect(sql).toContain('COUNT(DISTINCT cu."escuela_id") = 1');
    expect(sql).toContain('INSERT INTO "procesos_horario_escuela"');
    expect(sql).toContain('cargos_docentes_scope_check');
    expect(sql).toContain('"cargo" = \'JEFE_DEPARTAMENTO\'');
    expect(sql).toContain('"cargo" = \'DIRECTOR_ESCUELA\'');
    expect(sql).toContain('"cargo" = \'DECANO\'');
  });
});
