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
  private cycleHorasPorDia = new Map<number, Map<string, string[]>>(); // New: track cycle hours
  private franjaById = new Map<string, FranjaForSchedule>();
  private blockedDocenteSlots: Set<string>;
  private blockedAulaSlots: Set<string>;

  constructor(input: ScheduleEngineInput) {
    this.input = input;
    this.checker = new ConstraintChecker();
    this.blockedDocenteSlots = new Set(input.blockedDocenteSlots || []);
    this.blockedAulaSlots = new Set(input.blockedAulaSlots || []);
  }

  generate(): ScheduleResult {
    this.assignments = [];
    this.unassigned = [];
    this.checker.clear();
    this.docenteHorasPorDia.clear();
    this.cycleHorasPorDia.clear();
    this.franjaById = new Map(this.input.franjas.map((f) => [f.id, f]));

    const sortedDocentes = sortDocentesByHierarchy(this.input.docentes);
    const grupoMap = new Map(this.input.grupos.map((g) => [g.id, g]));

    const remainingByGrupo = new Map(
      this.input.grupos.map((g) => [g.id, {
        teoria: g.horasTeoria,
        practica: g.horasPractica,
        laboratorio: g.horasLaboratorio,
      }])
    );

    const existing = this.input.existingAssignments ?? [];
    for (const assignment of existing) {
      const grupo = grupoMap.get(assignment.grupoId);
      this.checker.addAssignment(assignment, grupo?.ciclo);
      this.seedDocenteHora(assignment);

      const remaining = remainingByGrupo.get(assignment.grupoId);
      if (remaining) {
        if (assignment.tipo === 'TEORIA') {
          remaining.teoria = Math.max(0, remaining.teoria - 1);
        } else if (assignment.tipo === 'PRACTICA') {
          remaining.practica = Math.max(0, remaining.practica - 1);
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

        // Get workloads for THIS docente and THIS group
        const docenteWorkloads = grupo.workloads.filter(w => w.docenteId === docente.id);

        for (const workload of docenteWorkloads) {
          const remaining = remainingByGrupo.get(grupoId);
          if (!remaining) continue;

          if (workload.tipo === 'TEORIA') {
            this.assignSlots(
              docente.id,
              grupoId,
              workload.horas,
              teoriaAulas,
              'TEORIA'
            );
          } else if (workload.tipo === 'PRACTICA') {
            this.assignSlots(
              docente.id,
              grupoId,
              workload.horas,
              teoriaAulas,
              'PRACTICA'
            );
          } else if (workload.tipo === 'LABORATORIO') {
            // Requirement: Lab groups multiplier
            // Lab capacity is usually 16-20. We'll use 20 as default or the largest lab capacity.
            const labCapacity = 20;
            const numLabGroups = Math.ceil(grupo.numAlumnos / labCapacity);
            
            // If the course has e.g. 3h lab, and we need 2 lab groups,
            // the TOTAL lab dictation hours is 6h.
            // These 6h should be distributed among docentes.
            // If THIS docente has 'workload.horas' (e.g. 3h), they dictate 1 lab group.
            // If they have 6h, they dictate 2 groups.
            const groupsToDictate = Math.floor(workload.horas / grupo.horasLaboratorio);

            for (let i = 0; i < groupsToDictate; i++) {
              const assignedToLab = this.assignSlots(
                docente.id,
                grupoId,
                grupo.horasLaboratorio,
                labAulas,
                'LABORATORIO'
              );

              // Fallback to theory rooms if lab assignment failed and not strictly required
              if (!assignedToLab && !grupo.requiereLaboratorio) {
                this.assignSlots(
                  docente.id,
                  grupoId,
                  grupo.horasLaboratorio,
                  teoriaAulas,
                  'LABORATORIO'
                );
              }
            }
          }
        }
      }
    }

    // Mark groups as assigned if they have at least one assignment
    for (const assignment of this.assignments) {
      assignedGrupos.add(assignment.grupoId);
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
   * 
   * IMPROVED: Prioritizes consecutive hours on the same day.
   */
  private assignSlots(
    docenteId: string,
    grupoId: string,
    hoursNeeded: number,
    availableAulas: AulaForSchedule[],
    tipo: 'TEORIA' | 'PRACTICA' | 'LABORATORIO'
  ): boolean {
    if (availableAulas.length === 0) {
      this.unassigned.push({
        grupoId,
        tipo,
        reason: `No hay aula de tipo ${tipo.toLowerCase()} disponible`,
      });
      return false;
    }

    const grupo = this.input.grupos.find(g => g.id === grupoId);
    let capacityEligibleAulas = grupo
      ? availableAulas.filter((aula) => aula.capacidad >= grupo.numAlumnos)
      : availableAulas;

    // FIX: If no aula matches capacity exactly, don't fail immediately.
    // Use the largest available aulas as a fallback to avoid "disappearing" assignments.
    if (capacityEligibleAulas.length === 0 && availableAulas.length > 0) {
      capacityEligibleAulas = [...availableAulas].sort((a, b) => b.capacidad - a.capacidad);
    }

    if (capacityEligibleAulas.length === 0) {
      this.unassigned.push({
        grupoId,
        tipo,
        reason: `No hay aula de tipo ${tipo.toLowerCase()} con capacidad suficiente para ${grupo?.numAlumnos ?? 0} alumnos`,
      });
      return false;
    }

    let assignedCount = 0;

    // Group franjas by day and sort by block number
    const franjasByDay = new Map<string, FranjaForSchedule[]>();
    for (const f of this.input.franjas) {
      const dayFranjas = franjasByDay.get(f.dia) ?? [];
      dayFranjas.push(f);
      franjasByDay.set(f.dia, dayFranjas);
    }
    for (const dayFranjas of franjasByDay.values()) {
      dayFranjas.sort((a, b) => a.numeroBloque - b.numeroBloque);
    }

    // Try to find blocks of consecutive hours
    // We try from largest block possible (hoursNeeded) down to 1
    for (let blockSize = Math.min(hoursNeeded, 6); blockSize >= 1; blockSize--) {
      if (assignedCount >= hoursNeeded) break;
      // console.log(`Checking blockSize ${blockSize} for docente ${docenteId}, grupo ${grupoId}`);

      // Days sorted by priority:
      // 1. Prefer Monday-Friday over Saturday (unless special case)
      // 2. Prefer days with fewer hours current load
      const sortedDays = Array.from(franjasByDay.keys()).sort((a, b) => {
        const isSaturdayA = a === 'SABADO';
        const isSaturdayB = b === 'SABADO';
        
        // Exception: Course "DEPORTE" or similar for 2nd cycle might prefer Saturday if needed,
        // but here we follow the general rule: L-V first.
        if (isSaturdayA && !isSaturdayB) return 1;
        if (!isSaturdayA && isSaturdayB) return -1;

        const horasA = this.getDocenteHoras(docenteId, a).length;
        const horasB = this.getDocenteHoras(docenteId, b).length;
        return horasA - horasB;
      });

      for (const dia of sortedDays) {
        if (assignedCount >= hoursNeeded) break;
        
        const dayFranjas = franjasByDay.get(dia) || [];
        
        // Find consecutive blocks of 'blockSize' in this day
        for (let i = 0; i <= dayFranjas.length - blockSize; i++) {
          if (assignedCount + blockSize > hoursNeeded) break; // Don't over-assign

          const candidateBlock = dayFranjas.slice(i, i + blockSize);
          
          // Check if block is consecutive in time (numeroBloque)
          const isConsecutive = candidateBlock.every((f, idx) => 
            idx === 0 || f.numeroBloque === candidateBlock[idx - 1].numeroBloque + 1
          );
          if (!isConsecutive) continue;

          // Check if all franjas in block are already assigned in this run
          const isAlreadyAssigned = candidateBlock.some(f => 
            this.assignments.some(a => a.franjaHorariaId === f.id && a.docenteId === docenteId)
          );
          if (isAlreadyAssigned) continue;

          // Check if all franjas in block are available for docente, grupo, cycle
          const isBlockAvailable = candidateBlock.every(franja => {
            if (this.isDocenteBlocked(docenteId, franja.id)) return false;
            if (!this.checker.isDocenteAvailable(docenteId, franja.id)) return false;
            
            // For LABORATORIO, we allow same group and cycle to have multiple slots
            const isLab = tipo === 'LABORATORIO';
            if (!isLab && !this.checker.isGrupoAvailable(grupoId, franja.id)) return false;
            if (!isLab && grupo && !this.checker.isCycleAvailable(grupo.ciclo, franja.id)) return false;
            
            // Limit hours per day check (simplified, we'll check properly below)
            const currentDayHoras = this.getDocenteHoras(docenteId, dia);
            if (currentDayHoras.length >= 6) return false;

            return true;
          });

          if (!isBlockAvailable) continue;

          // Find an aula that is available for the ENTIRE block
          let selectedAula: AulaForSchedule | null = null;
          for (const aula of capacityEligibleAulas) {
            const isAulaAvailableForBlock = candidateBlock.every(franja => {
              if (this.isAulaBlocked(aula.id, franja.id)) return false;
              if (!this.checker.isSlotFullyAvailable(docenteId, aula.id, grupoId, franja.id, grupo?.ciclo, tipo)) {
                return false;
              }
              return true;
            });

            if (isAulaAvailableForBlock) {
              selectedAula = aula;
              break;
            }
          }

          if (selectedAula) {
            // Check if adding this block violates continuous hours or lunch
            // We simulate adding the entire block
            const currentDayHoras = this.getDocenteHoras(docenteId, dia);
            let canAddBlock = true;
            let tempDayHoras = [...currentDayHoras];

            for (const franja of candidateBlock) {
              if (wouldExceedContinuousHours(tempDayHoras, franja.horaInicio)) {
                canAddBlock = false;
                break;
              }
              const lunchBlocked = getLunchBlockedHoras(tempDayHoras);
              if (lunchBlocked.includes(franja.horaInicio)) {
                canAddBlock = false;
                break;
              }
              
              if (grupo) {
                const cycleDiaHoras = this.getCycleHoras(grupo.ciclo, dia);
                const cycleLunchBlocked = getLunchBlockedHoras(cycleDiaHoras);
                if (cycleLunchBlocked.includes(franja.horaInicio)) {
                  canAddBlock = false;
                  break;
                }
              }
              
              tempDayHoras.push(franja.horaInicio);
            }

            if (canAddBlock && tempDayHoras.length <= 6) {
              // ASSIGN THE BLOCK
              for (const franja of candidateBlock) {
                const assignment: Assignment = {
                  grupoId,
                  docenteId,
                  aulaId: selectedAula.id,
                  franjaHorariaId: franja.id,
                  tipo,
                  confirmado: false,
                };

                this.assignments.push(assignment);
                this.checker.addAssignment(assignment, grupo?.ciclo);
                this.addDocenteHora(docenteId, franja.dia, franja.horaInicio);
                if (grupo) {
                  this.addCycleHora(grupo.ciclo, franja.dia, franja.horaInicio);
                }
                assignedCount++;
              }
              // Skip the franjas we just assigned to avoid overlaps in same day search
              i += blockSize - 1;
            }
          }
        }
      }
    }

    if (assignedCount < hoursNeeded) {
      this.unassigned.push({
        grupoId,
        tipo,
        reason: `Solo se pudieron asignar ${assignedCount} de ${hoursNeeded} horas. Posible falta de aulas o cruces de ciclo/docente.`,
      });
      return false;
    }

    return true;
  }

  private key(entityId: string, franjaId: string): string {
    return `${entityId}::${franjaId}`;
  }

  private isDocenteBlocked(docenteId: string, franjaId: string): boolean {
    const key = `${docenteId}::${franjaId}`;
    return this.blockedDocenteSlots.has(key);
  }

  private isAulaBlocked(aulaId: string, franjaId: string): boolean {
    const key = `${aulaId}::${franjaId}`;
    return this.blockedAulaSlots.has(key);
  }

  private seedDocenteHora(assignment: Assignment): void {
    const franja = this.franjaById.get(assignment.franjaHorariaId);
    if (!franja) return;
    this.addDocenteHora(assignment.docenteId, franja.dia, franja.horaInicio);
    
    const grupo = this.input.grupos.find(g => g.id === assignment.grupoId);
    if (grupo) {
      this.addCycleHora(grupo.ciclo, franja.dia, franja.horaInicio);
    }
  }

  private addDocenteHora(docenteId: string, dia: string, horaInicio: string): void {
    const perDia = this.docenteHorasPorDia.get(docenteId) ?? new Map<string, string[]>();
    const horas = perDia.get(dia) ?? [];
    horas.push(horaInicio);
    perDia.set(dia, horas);
    this.docenteHorasPorDia.set(docenteId, perDia);
  }

  private addCycleHora(ciclo: number, dia: string, horaInicio: string): void {
    const perDia = this.cycleHorasPorDia.get(ciclo) ?? new Map<string, string[]>();
    const horas = perDia.get(dia) ?? [];
    horas.push(horaInicio);
    perDia.set(dia, horas);
    this.cycleHorasPorDia.set(ciclo, perDia);
  }

  private getDocenteHoras(docenteId: string, dia: string): string[] {
    const perDia = this.docenteHorasPorDia.get(docenteId);
    return perDia?.get(dia) ?? [];
  }

  private getCycleHoras(ciclo: number, dia: string): string[] {
    const perDia = this.cycleHorasPorDia.get(ciclo);
    return perDia?.get(dia) ?? [];
  }
}
