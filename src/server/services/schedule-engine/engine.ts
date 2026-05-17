import { sortDocentesByHierarchy } from './hierarchy';
import { ConstraintChecker } from './constraints';
import { getLunchBlockedHoras } from '../availability/lunch-window';
import { wouldExceedContinuousHours } from '../availability/continuous-hours';
import type {
  DocenteForSchedule,
  GrupoForSchedule,
  AulaForSchedule,
  FranjaForSchedule,
  Assignment,
  UnassignedItem,
  ScheduleResult,
} from './types';

interface ScheduleEngineInput {
  docentes: DocenteForSchedule[];
  grupos: GrupoForSchedule[];
  aulas: AulaForSchedule[];
  franjas: FranjaForSchedule[];
  /** Maps docenteId → grupoIds that the docente teaches */
  docenteGrupoMap: Map<string, string[]>;
  /** Pre-existing assignments that must be respected (read-only) */
  existingAssignments?: Assignment[];
  /** Blocked slots per docente (restricciones, etc.) */
  blockedDocenteSlots?: Set<string>;
  /** Blocked slots per aula (mantenimiento, etc.) */
  blockedAulaSlots?: Set<string>;
}

/**
 * Greedy hierarchical scheduling engine.
 *
 * Processes docentes in strict priority order and assigns
 * available time slots to their grupos, avoiding all conflicts.
 */
export class ScheduleEngine {
  private input: ScheduleEngineInput;
  private checker: ConstraintChecker;
  private assignments: Assignment[] = [];
  private unassigned: UnassignedItem[] = [];
  private docenteHorasPorDia = new Map<string, Map<string, string[]>>();
  private franjaById = new Map<string, FranjaForSchedule>();
  private blockedDocenteSlots: Set<string>;
  private blockedAulaSlots: Set<string>;

  constructor(input: ScheduleEngineInput) {
    this.input = input;
    this.checker = new ConstraintChecker();
    this.blockedDocenteSlots = input.blockedDocenteSlots ?? new Set();
    this.blockedAulaSlots = input.blockedAulaSlots ?? new Set();
  }

  generate(): ScheduleResult {
    this.assignments = [];
    this.unassigned = [];
    this.checker.clear();
    this.docenteHorasPorDia.clear();
    this.franjaById = new Map(this.input.franjas.map((f) => [f.id, f]));

    const sortedDocentes = sortDocentesByHierarchy(this.input.docentes);
    const grupoMap = new Map(this.input.grupos.map((g) => [g.id, g]));

    const remainingByGrupo = new Map(
      this.input.grupos.map((g) => [g.id, {
        teoria: g.horasTeoria,
        laboratorio: g.horasLaboratorio,
      }])
    );

    const existing = this.input.existingAssignments ?? [];
    for (const assignment of existing) {
      this.checker.addAssignment(assignment);
      this.seedDocenteHora(assignment);

      const remaining = remainingByGrupo.get(assignment.grupoId);
      if (remaining) {
        if (assignment.tipo === 'TEORIA') {
          remaining.teoria = Math.max(0, remaining.teoria - 1);
        } else {
          remaining.laboratorio = Math.max(0, remaining.laboratorio - 1);
        }
      }
    }

    const teoriaAulas = this.input.aulas.filter((a) => a.tipo === 'TEORIA');
    const labAulas = this.input.aulas.filter((a) => a.tipo === 'LABORATORIO');

    const assignedGrupos = new Set<string>();

    for (const docente of sortedDocentes) {
      const grupoIds = this.input.docenteGrupoMap.get(docente.id) ?? [];

      for (const grupoId of grupoIds) {
        const grupo = grupoMap.get(grupoId);
        if (!grupo) continue;

        const remaining = remainingByGrupo.get(grupoId);
        if (!remaining) continue;

        // Assign theory hours
        if (remaining.teoria > 0) {
          const assigned = this.assignSlots(
            docente.id,
            grupoId,
            remaining.teoria,
            teoriaAulas,
            'TEORIA'
          );

          if (assigned) {
            assignedGrupos.add(grupoId);
          }
        }

        // Assign lab hours independently
        if (remaining.laboratorio > 0 && grupo.requiereLaboratorio) {
          const assigned = this.assignSlots(
            docente.id,
            grupoId,
            remaining.laboratorio,
            labAulas,
            'LABORATORIO'
          );

          if (assigned) {
            assignedGrupos.add(grupoId);
          }
        }
      }
    }

    return {
      assignments: this.assignments,
      unassigned: this.unassigned,
      stats: {
        totalGrupos: this.input.grupos.length,
        assigned: assignedGrupos.size,
        unassignedCount: this.input.grupos.length - assignedGrupos.size,
        conflictsAvoided: this.checker.getConflictsAvoided(),
      },
    };
  }

  /**
   * Tries to assign `hoursNeeded` slots for a grupo/docente combination.
   * Returns true if ALL hours were assigned, false otherwise.
   */
  private assignSlots(
    docenteId: string,
    grupoId: string,
    hoursNeeded: number,
    availableAulas: AulaForSchedule[],
    tipo: 'TEORIA' | 'LABORATORIO'
  ): boolean {
    if (availableAulas.length === 0) {
      this.unassigned.push({
        grupoId,
        tipo,
        reason: `No hay aula de tipo ${tipo.toLowerCase()} disponible`,
      });
      return false;
    }

    let assignedCount = 0;

    for (const franja of this.input.franjas) {
      if (assignedCount >= hoursNeeded) break;

      if (this.isDocenteBlocked(docenteId, franja.id)) continue;

      // Check docente availability for this franja
      if (!this.checker.isDocenteAvailable(docenteId, franja.id)) continue;
      // Check grupo availability for this franja
      if (!this.checker.isGrupoAvailable(grupoId, franja.id)) continue;

      const diaHoras = this.getDocenteHoras(docenteId, franja.dia);
      if (wouldExceedContinuousHours(diaHoras, franja.horaInicio)) continue;

      const lunchBlocked = getLunchBlockedHoras(diaHoras);
      if (lunchBlocked.includes(franja.horaInicio)) continue;

      // Find first available aula in this franja
      for (const aula of availableAulas) {
        if (this.isAulaBlocked(aula.id, franja.id)) {
          continue;
        }
        if (!this.checker.isSlotFullyAvailable(docenteId, aula.id, grupoId, franja.id)) {
          continue;
        }

        // Found a valid slot!
        const assignment: Assignment = {
          grupoId,
          docenteId,
          aulaId: aula.id,
          franjaHorariaId: franja.id,
          tipo,
        };

        this.assignments.push(assignment);
        this.checker.addAssignment(assignment);
        this.addDocenteHora(docenteId, franja.dia, franja.horaInicio);
        assignedCount++;
        break; // Move to next franja
      }
    }

    if (assignedCount < hoursNeeded) {
      this.unassigned.push({
        grupoId,
        tipo,
        reason: `Solo se asignaron ${assignedCount}/${hoursNeeded} horas — no hay slots disponibles sin conflictos`,
      });
      return false;
    }

    return true;
  }

  private key(entityId: string, franjaId: string): string {
    return `${entityId}::${franjaId}`;
  }

  private isDocenteBlocked(docenteId: string, franjaId: string): boolean {
    return this.blockedDocenteSlots.has(this.key(docenteId, franjaId));
  }

  private isAulaBlocked(aulaId: string, franjaId: string): boolean {
    return this.blockedAulaSlots.has(this.key(aulaId, franjaId));
  }

  private seedDocenteHora(assignment: Assignment): void {
    const franja = this.franjaById.get(assignment.franjaHorariaId);
    if (!franja) return;
    this.addDocenteHora(assignment.docenteId, franja.dia, franja.horaInicio);
  }

  private addDocenteHora(docenteId: string, dia: string, horaInicio: string): void {
    const perDia = this.docenteHorasPorDia.get(docenteId) ?? new Map<string, string[]>();
    const horas = perDia.get(dia) ?? [];
    horas.push(horaInicio);
    perDia.set(dia, horas);
    this.docenteHorasPorDia.set(docenteId, perDia);
  }

  private getDocenteHoras(docenteId: string, dia: string): string[] {
    const perDia = this.docenteHorasPorDia.get(docenteId);
    return perDia?.get(dia) ?? [];
  }
}
