import { CategoriaDocente, TipoDocente } from '@/generated/prisma/client';

// ── Core Types ─────────────────────────────────────

export interface DocenteForSchedule {
  id: string;
  nombre: string;
  categoria: CategoriaDocente;
  tipo: TipoDocente;
  antiguedad: Date;
}

export interface GrupoForSchedule {
  id: string;
  nombre: string;
  cursoId: string;
  cursoNombre: string;
  cursoCodigo: string;
  ciclo: number;
  numAlumnos: number;
  horasTeoria: number;
  horasPractica: number;
  horasLaboratorio: number;
  requiereLaboratorio: boolean;
  workloads: WorkloadPerDocente[];
}

export interface WorkloadPerDocente {
  docenteId: string;
  tipo: 'TEORIA' | 'PRACTICA' | 'LABORATORIO';
  horas: number;
}

export interface AulaForSchedule {
  id: string;
  codigo: string;
  nombre: string;
  capacidad: number;
  tipo: 'TEORIA' | 'LABORATORIO';
}

export interface FranjaForSchedule {
  id: string;
  dia: string;
  horaInicio: string;
  horaFin: string;
  numeroBloque: number;
}

export interface Assignment {
  grupoId: string;
  docenteId: string;
  aulaId: string;
  franjaHorariaId: string;
  tipo: 'TEORIA' | 'PRACTICA' | 'LABORATORIO';
  confirmado?: boolean;
}

export interface UnassignedItem {
  grupoId: string;
  tipo: 'TEORIA' | 'PRACTICA' | 'LABORATORIO';
  reason: string;
}

export interface ScheduleResult {
  assignments: Assignment[];
  unassigned: UnassignedItem[];
  stats: {
    totalGrupos: number;
    assigned: number;
    unassignedCount: number;
    conflictsAvoided: number;
  };
}

// ── Conflict Tracking ──────────────────────────────

export interface OccupiedSlot {
  franjaHorariaId: string;
  docenteId?: string;
  aulaId?: string;
  grupoId?: string;
}
