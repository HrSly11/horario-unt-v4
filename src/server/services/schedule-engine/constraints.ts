import type { Assignment } from './types';

/**
 * Tracks occupied slots and detects scheduling conflicts.
 * Uses Sets of composite keys for O(1) lookup.
 */
export class ConstraintChecker {
  private docenteSlots = new Set<string>();
  private aulaSlots = new Set<string>();
  private grupoSlots = new Set<string>();
  private cycleSlots = new Set<string>(); // New: track cycle + period overlap
  private conflictsAvoided = 0;

  private key(entityId: string, franjaId: string): string {
    return `${entityId}::${franjaId}`;
  }

  addAssignment(assignment: Assignment, cycle?: number): void {
    this.docenteSlots.add(this.key(assignment.docenteId, assignment.franjaHorariaId));
    this.aulaSlots.add(this.key(assignment.aulaId, assignment.franjaHorariaId));
    this.grupoSlots.add(this.key(assignment.grupoId, assignment.franjaHorariaId));
    if (cycle !== undefined) {
      this.cycleSlots.add(`${cycle}::${assignment.franjaHorariaId}`);
    }
  }

  isDocenteAvailable(docenteId: string, franjaId: string): boolean {
    return !this.docenteSlots.has(this.key(docenteId, franjaId));
  }

  isAulaAvailable(aulaId: string, franjaId: string): boolean {
    return !this.aulaSlots.has(this.key(aulaId, franjaId));
  }

  isGrupoAvailable(grupoId: string, franjaId: string): boolean {
    return !this.grupoSlots.has(this.key(grupoId, franjaId));
  }

  isCycleAvailable(cycle: number, franjaId: string): boolean {
    return !this.cycleSlots.has(`${cycle}::${franjaId}`);
  }

  /**
   * Checks all constraints at once.
   * Increments conflictsAvoided counter if any constraint fails.
   */
  isSlotFullyAvailable(
    docenteId: string,
    aulaId: string,
    grupoId: string,
    franjaId: string,
    cycle?: number,
    tipo?: 'TEORIA' | 'PRACTICA' | 'LABORATORIO'
  ): boolean {
    const docenteFree = this.isDocenteAvailable(docenteId, franjaId);
    const aulaFree = this.isAulaAvailable(aulaId, franjaId);
    
    // For LABORATORIO, we allow the same group and cycle to have multiple assignments
    // at the same time (in different aulas/with different docentes),
    // because labs divide the students.
    const isLab = tipo === 'LABORATORIO';
    const grupoFree = isLab ? true : this.isGrupoAvailable(grupoId, franjaId);
    const cycleFree = (isLab || cycle === undefined) ? true : this.isCycleAvailable(cycle, franjaId);

    const available = docenteFree && aulaFree && grupoFree && cycleFree;

    if (!available) {
      this.conflictsAvoided++;
    }

    return available;
  }

  getConflictsAvoided(): number {
    return this.conflictsAvoided;
  }

  clear(): void {
    this.docenteSlots.clear();
    this.aulaSlots.clear();
    this.grupoSlots.clear();
    this.cycleSlots.clear();
    this.conflictsAvoided = 0;
  }
}
