import type { PrismaClient } from '@/generated/prisma/client';
import type { AulaAvailability, AvailabilityCell, SlotStatus, ValidationResult } from './config';
import { getLunchBlockedHoras } from './lunch-window';
import { wouldExceedContinuousHours } from './continuous-hours';

export type ScheduleDay =
  | 'LUNES'
  | 'MARTES'
  | 'MIERCOLES'
  | 'JUEVES'
  | 'VIERNES'
  | 'SABADO';

export interface LaboratorySearchInput {
  day: ScheduleDay;
  startTime: string;
  endTime: string;
}

export interface LaboratorySearchResult {
  periodName: string;
  day: ScheduleDay;
  startTime: string;
  endTime: string;
  laboratories: Array<{
    code: string;
    name: string;
    capacity: number;
    building: string;
    floor: number;
  }>;
}

/**
 * Real-time availability service.
 * Computes slot availability for aulas considering all constraints.
 * Designed for <50ms response times.
 */
export class AvailabilityService {
  constructor(private prisma: PrismaClient) {}

  async findAvailableLaboratories({
    day,
    startTime,
    endTime,
  }: LaboratorySearchInput): Promise<LaboratorySearchResult> {
    if (startTime >= endTime) {
      throw new Error('La hora de inicio debe ser anterior a la hora de fin');
    }

    const period = await this.prisma.periodoAcademico.findFirst({
      where: { activo: true },
      select: { id: true, nombre: true },
    });

    if (!period) {
      throw new Error('No hay un periodo academico activo');
    }

    const slots = await this.prisma.franjaHoraria.findMany({
      where: {
        dia: day,
        horaInicio: { lt: endTime },
        horaFin: { gt: startTime },
      },
      orderBy: { horaInicio: 'asc' },
      select: { id: true, horaInicio: true, horaFin: true },
    });

    let coveredUntil = startTime;
    for (const slot of slots) {
      if (slot.horaInicio > coveredUntil) break;
      if (slot.horaFin > coveredUntil) coveredUntil = slot.horaFin;
    }

    if (coveredUntil < endTime) {
      throw new Error('El intervalo solicitado no esta cubierto por las franjas horarias del sistema');
    }

    const laboratories = await this.prisma.aula.findMany({
      where: { tipo: 'LABORATORIO' },
      orderBy: [{ edificio: 'asc' }, { piso: 'asc' }, { codigo: 'asc' }],
      select: {
        id: true,
        codigo: true,
        nombre: true,
        capacidad: true,
        edificio: true,
        piso: true,
      },
    });

    const laboratoryIds = laboratories.map((laboratory) => laboratory.id);
    const slotIds = slots.map((slot) => slot.id);

    const [assignments, maintenances] = laboratories.length === 0
      ? [[], []]
      : await Promise.all([
          this.prisma.asignacion.findMany({
            where: {
              periodoId: period.id,
              aulaId: { in: laboratoryIds },
              franjaHorariaId: { in: slotIds },
            },
            select: { aulaId: true },
          }),
          this.prisma.mantenimientoAula.findMany({
            where: {
              aulaId: { in: laboratoryIds },
              franjaHorariaId: { in: slotIds },
            },
            select: { aulaId: true },
          }),
        ]);
    const unavailableLaboratoryIds = new Set([
      ...assignments.map((assignment) => assignment.aulaId),
      ...maintenances.map((maintenance) => maintenance.aulaId),
    ]);

    return {
      periodName: period.nombre,
      day,
      startTime,
      endTime,
      laboratories: laboratories
        .filter((laboratory) => !unavailableLaboratoryIds.has(laboratory.id))
        .map((laboratory) => ({
          code: laboratory.codigo,
          name: laboratory.nombre,
          capacity: laboratory.capacidad,
          building: laboratory.edificio,
          floor: laboratory.piso,
        })),
    };
  }

  /**
   * Get availability matrix for a single aula.
   * Returns all slots with their status (LIBRE, OCUPADO, MANTENIMIENTO, etc.)
   */
  async getAulaAvailability(
    periodoId: string,
    aulaId: string
  ): Promise<AulaAvailability> {
    const [aula, franjas, asignaciones, mantenimientos] = await Promise.all([
      this.prisma.aula.findUniqueOrThrow({ where: { id: aulaId } }),
      this.prisma.franjaHoraria.findMany({
        orderBy: [{ dia: 'asc' }, { numeroBloque: 'asc' }],
      }),
      this.prisma.asignacion.findMany({
        where: { aulaId, periodoId },
        include: {
          grupo: { include: { curso: true } },
          docente: true,
        },
      }),
      this.prisma.mantenimientoAula.findMany({
        where: { aulaId },
        select: { franjaHorariaId: true },
      }),
    ]);

    const asignacionMap = new Map(
      asignaciones.map((a) => [a.franjaHorariaId, a])
    );
    const mantenimientoSet = new Set(
      mantenimientos.map((m) => m.franjaHorariaId)
    );

    const slots: AvailabilityCell[] = franjas.map((f) => {
      const asig = asignacionMap.get(f.id);
      const enMantenimiento = mantenimientoSet.has(f.id);

      let status: SlotStatus = 'LIBRE';
      let ocupadoPor: AvailabilityCell['ocupadoPor'] = undefined;

      if (enMantenimiento) {
        status = 'MANTENIMIENTO';
      } else if (asig) {
        status = 'OCUPADO';
        ocupadoPor = {
          cursoNombre: asig.grupo.curso.nombre,
          cursoCodigo: asig.grupo.curso.codigo,
          grupoNombre: asig.grupo.nombre,
          docenteNombre: asig.docente.nombre,
        };
      }

      return {
        franjaId: f.id,
        dia: f.dia,
        horaInicio: f.horaInicio,
        horaFin: f.horaFin,
        status,
        ocupadoPor,
      };
    });

    return {
      aulaId: aula.id,
      aulaCodigo: aula.codigo,
      aulaNombre: aula.nombre,
      tipo: aula.tipo,
      capacidad: aula.capacidad,
      slots,
    };
  }

  /**
   * Get availability for ALL aulas of a given type.
   */
  async getAulasAvailabilityByTipo(
    periodoId: string,
    tipo: 'TEORIA' | 'LABORATORIO'
  ): Promise<AulaAvailability[]> {
    const aulas = await this.prisma.aula.findMany({
      where: { tipo },
      orderBy: { codigo: 'asc' },
    });

    return Promise.all(
      aulas.map((aula) => this.getAulaAvailability(periodoId, aula.id))
    );
  }

  /**
   * Get docente-specific constraints on top of aula availability.
   * Returns the aula availability matrix annotated with docente-specific blocks.
   */
  async getDocenteAulaAvailability(
    periodoId: string,
    aulaId: string,
    docenteId: string
  ): Promise<AulaAvailability> {
    const [aulaAvail, docenteAsignaciones, restricciones, disponibilidadCount] = await Promise.all([
      this.getAulaAvailability(periodoId, aulaId),
      this.prisma.asignacion.findMany({
        where: { docenteId, periodoId },
        include: { franjaHoraria: true },
      }),
      this.prisma.restriccionDocente.findMany({
        where: { docenteId },
        select: { franjaHorariaId: true },
      }),
      this.prisma.disponibilidadDocente.count({
        where: { docenteId, periodoId },
      }),
    ]);

    const hasAvailabilityDefined = disponibilidadCount > 0;
    let registeredDisponibilidad = new Set<string>();
    
    if (hasAvailabilityDefined) {
      const disp = await this.prisma.disponibilidadDocente.findMany({
        where: { docenteId, periodoId },
        select: { franjaHorariaId: true },
      });
      registeredDisponibilidad = new Set(disp.map(d => d.franjaHorariaId));
    }

    // Build lookup sets
    const docenteOccupiedFranjas = new Set(
      docenteAsignaciones.map((a) => a.franjaHorariaId)
    );
    const restriccionFranjas = new Set(
      restricciones.map((r) => r.franjaHorariaId)
    );

    // Build per-day scheduled hours for continuous-hours and lunch checks
    const docenteHorasPorDia = new Map<string, string[]>();
    docenteAsignaciones.forEach((a) => {
      const dia = a.franjaHoraria.dia;
      const horas = docenteHorasPorDia.get(dia) ?? [];
      horas.push(a.franjaHoraria.horaInicio);
      docenteHorasPorDia.set(dia, horas);
    });

    // Annotate each slot
    aulaAvail.slots = aulaAvail.slots.map((slot) => {
      // Already occupied or in maintenance — keep original status
      if (slot.status !== 'LIBRE') return slot;

      // Check if docente is available (only if they registered availability)
      if (hasAvailabilityDefined && !registeredDisponibilidad.has(slot.franjaId)) {
        return { ...slot, status: 'RESTRICCION_DOCENTE' as SlotStatus };
      }

      // Docente has restriction on this franja
      if (restriccionFranjas.has(slot.franjaId)) {
        return { ...slot, status: 'RESTRICCION_DOCENTE' as SlotStatus };
      }

      // Docente already has another class in this franja
      if (docenteOccupiedFranjas.has(slot.franjaId)) {
        return { ...slot, status: 'DOCENTE_OCUPADO' as SlotStatus };
      }

      // Lunch window check
      const diaHoras = docenteHorasPorDia.get(slot.dia) ?? [];
      const lunchBlocked = getLunchBlockedHoras(diaHoras);
      if (lunchBlocked.includes(slot.horaInicio)) {
        return { ...slot, status: 'ALMUERZO_REQUERIDO' as SlotStatus };
      }

      // Continuous hours check
      if (wouldExceedContinuousHours(diaHoras, slot.horaInicio)) {
        return { ...slot, status: 'MAX_HORAS_EXCEDIDO' as SlotStatus };
      }

      return slot;
    });

    return aulaAvail;
  }

  /**
   * Validates a slot selection against ALL constraints.
   * Called when a docente clicks a cell in the availability matrix.
   */
  async validateSlotSelection(
    docenteId: string,
    aulaId: string,
    grupoId: string,
    franjaId: string,
    periodoId: string,
    tipo?: 'TEORIA' | 'PRACTICA' | 'LABORATORIO',
    excludeAsignacionId?: string
  ): Promise<ValidationResult> {
    const reasons: string[] = [];

    const [franja, aula, grupo, existingAsignaciones, docenteAsignaciones, restricciones, mantenimiento, disponibilidadCount] =
      await Promise.all([
        this.prisma.franjaHoraria.findUniqueOrThrow({ where: { id: franjaId } }),
        this.prisma.aula.findUniqueOrThrow({
          where: { id: aulaId },
          select: { capacidad: true },
        }),
        this.prisma.grupo.findUniqueOrThrow({
          where: { id: grupoId },
          include: { curso: true },
        }),
        // Check aula + grupo occupancy for this franja
        this.prisma.asignacion.findMany({
          where: {
            periodoId,
            franjaHorariaId: franjaId,
            OR: [{ aulaId }, { docenteId }, { grupoId }],
            ...(excludeAsignacionId ? { NOT: { id: excludeAsignacionId } } : {}),
          },
        }),
        // All docente's assignments for this period (for continuous-hours / lunch)
        this.prisma.asignacion.findMany({
          where: { docenteId, periodoId },
          include: { franjaHoraria: true },
        }),
        this.prisma.restriccionDocente.findFirst({
          where: { docenteId, franjaHorariaId: franjaId },
        }),
        this.prisma.mantenimientoAula.findFirst({
          where: { aulaId, franjaHorariaId: franjaId },
        }),
        this.prisma.disponibilidadDocente.count({
          where: { docenteId, periodoId },
        }),
      ]);

    // 0. Docente availability? (Requirement 4.3: Default to full availability if none registered)
    if (disponibilidadCount > 0) {
      const hasSpecificAvailability = await this.prisma.disponibilidadDocente.findFirst({
        where: { docenteId, periodoId, franjaHorariaId: franjaId },
      });
      if (!hasSpecificAvailability) {
        reasons.push('Usted no ha marcado esta franja como disponible');
      }
    }

    // 1. Aula already booked?
    if (existingAsignaciones.some((a) => a.aulaId === aulaId)) {
      reasons.push('El aula ya está ocupada en esta franja');
    }

    // 2. Docente already has class in this franja?
    if (existingAsignaciones.some((a) => a.docenteId === docenteId)) {
      reasons.push('Usted ya tiene una clase asignada en esta franja');
    }

    // 3. Grupo already booked?
    if (existingAsignaciones.some((a) => a.grupoId === grupoId)) {
      reasons.push('El grupo ya tiene clase en esta franja');
    }

    // 4. Docente restriction?
    if (restricciones) {
      reasons.push('Tiene una restricción personal en esta franja');
    }

    // 5. Maintenance?
    if (mantenimiento) {
      reasons.push('El aula está en mantenimiento en esta franja');
    }

    // 6. Capacity check
    let targetNumAlumnos = grupo.numAlumnos;
    if (tipo === 'LABORATORIO' && grupo.curso.numGruposLaboratorio > 1) {
      targetNumAlumnos = Math.ceil(grupo.numAlumnos / grupo.curso.numGruposLaboratorio);
    }
    if (aula.capacidad < targetNumAlumnos) {
      reasons.push(`El aula no tiene capacidad suficiente para el grupo (${targetNumAlumnos} alumnos requeridos vs ${aula.capacidad} capacidad)`);
    }

    // 7. Continuous hours check
    const diaHoras = docenteAsignaciones
      .filter((a) => a.franjaHoraria.dia === franja.dia)
      .map((a) => a.franjaHoraria.horaInicio);

    if (wouldExceedContinuousHours(diaHoras, franja.horaInicio)) {
      reasons.push(`Excede el máximo de horas continuas por día`);
    }

    // 8. Lunch window check
    const lunchBlocked = getLunchBlockedHoras(diaHoras);
    if (lunchBlocked.includes(franja.horaInicio)) {
      reasons.push('Esta franja está bloqueada como ventana de almuerzo');
    }

    return {
      valid: reasons.length === 0,
      reasons,
    };
  }

  /**
   * Suggests an aula for a group based on cycle consistency.
   * "Tratando de que los cursos de un solo ciclo se lleven en la misma aula"
   */
  async suggestAulaForGroup(
    grupoId: string,
    periodoId: string,
    tipo: 'TEORIA' | 'PRACTICA' | 'LABORATORIO'
  ): Promise<string | null> {
    const grupo = await this.prisma.grupo.findUniqueOrThrow({
      where: { id: grupoId },
      include: { curso: true },
    });

    // For laboratories, the user said they are "plena elección del docente" 
    // but the system can suggest one.
    if (tipo === 'LABORATORIO') {
       // Just suggest the first available lab with enough capacity
       const lab = await this.prisma.aula.findFirst({
         where: { tipo: 'LABORATORIO', capacidad: { gte: grupo.numAlumnos } },
       });
       
       if (lab) return lab.id;

       // Fallback: suggest the largest laboratory if none has enough capacity
       const largestLab = await this.prisma.aula.findFirst({
         where: { tipo: 'LABORATORIO' },
         orderBy: { capacidad: 'desc' },
       });
       return largestLab?.id || null;
    }

    // For theory/practice, try to match the cycle
    const otherAssignmentSameCycle = await this.prisma.asignacion.findFirst({
      where: {
        periodoId,
        tipo: { in: ['TEORIA', 'PRACTICA'] },
        grupo: {
          curso: { ciclo: grupo.curso.ciclo },
          id: { not: grupoId },
        },
      },
      select: { aulaId: true },
    });

    if (otherAssignmentSameCycle) return otherAssignmentSameCycle.aulaId;

    // Default: suggest first theory aula
    const defaultAula = await this.prisma.aula.findFirst({
      where: { tipo: 'TEORIA', capacidad: { gte: grupo.numAlumnos } },
    });
    return defaultAula?.id || null;
  }
}
