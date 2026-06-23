import { type PrismaClient, ModalidadDocente, type TipoAsignacion, CategoriaDocente, TipoDocente, CargoAcademico, TipoCargaNoLectiva } from '@/generated/prisma/client';

export interface HorarioSlot {
  dia: string;
  horaInicio: string;
  horaFin: string;
  horas: number;
}

export interface ValidationResult {
  valid: boolean;
  message?: string;
}

export interface CargaLectivaSummary {
  docenteId: string;
  totalLectivasAsignadas: number;
  asignaciones: { id: string; grupoId: string; tipo: string; horasAsignadas: number; horarios?: HorarioSlot[] }[];
}

export interface CargaNoLectivaSummary {
  docenteId: string;
  totalNoLectivas: number;
  cargas: { id: string; tipo: string; horas: number; horarios?: HorarioSlot[] }[];
}

export interface ValidateAllOptions {
  excludeAsignacionId?: string;
  excludeGrupoId?: string;
}

function ok(): ValidationResult {
  return { valid: true };
}

function fail(message: string): ValidationResult {
  return { valid: false, message };
}

export function validateDailyLimit(totalHorasDia: number): ValidationResult {
  if (totalHorasDia > 8) return fail(`Excede límite de 8h/día (${totalHorasDia}h)`);
  return ok();
}

export function validateWeeklyLimit(
  totalHorasSemana: number,
  modalidad: ModalidadDocente,
  horasContrato: number
): ValidationResult {
  if (modalidad === 'TIEMPO_PARCIAL') {
    if (totalHorasSemana > horasContrato) return fail(`Excede horas de contrato: ${totalHorasSemana}h > ${horasContrato}h`);
  } else {
    if (totalHorasSemana > 40) return fail(`Dedicación Exclusiva / Tiempo Completo: máximo 40h semanales (${totalHorasSemana}h)`);
  }
  return ok();
}

export function validateNoOverlap(
  existingSlots: HorarioSlot[],
  newSlots: HorarioSlot[]
): ValidationResult {
  for (const existing of existingSlots) {
    for (const nuevo of newSlots) {
      if (existing.dia !== nuevo.dia) continue;
      const existingStart = timeToMinutes(existing.horaInicio);
      const existingEnd = timeToMinutes(existing.horaFin);
      const newStart = timeToMinutes(nuevo.horaInicio);
      const newEnd = timeToMinutes(nuevo.horaFin);
      if (newStart < existingEnd && newEnd > existingStart) {
        return fail(`Conflicto de horario: ${existing.dia} ${existing.horaInicio}-${existing.horaFin}`);
      }
    }
  }
  return ok();
}

export function calculateSlotHours(slot: Pick<HorarioSlot, 'horaInicio' | 'horaFin'>): number {
  return (timeToMinutes(slot.horaFin) - timeToMinutes(slot.horaInicio)) / 60;
}

export function validateNonLectiveSchedule(
  existingSlots: HorarioSlot[],
  newSlots: HorarioSlot[]
): ValidationResult {
  for (let i = 0; i < newSlots.length; i++) {
    const current = newSlots[i];
    const currentHours = calculateSlotHours(current);
    if (currentHours <= 0) {
      return fail(`Horario invÃ¡lido: ${current.dia} ${current.horaInicio}-${current.horaFin}`);
    }

    const overlapResult = validateNoOverlap(newSlots.slice(0, i), [current]);
    if (!overlapResult.valid) return overlapResult;
  }

  const overlapWithExisting = validateNoOverlap(existingSlots, newSlots);
  if (!overlapWithExisting.valid) return overlapWithExisting;

  const hoursByDay = new Map<string, number>();
  for (const slot of [...existingSlots, ...newSlots]) {
    const hours = slot.horas ?? calculateSlotHours(slot);
    hoursByDay.set(slot.dia, (hoursByDay.get(slot.dia) ?? 0) + hours);
  }

  for (const [dia, horas] of hoursByDay.entries()) {
    const daily = validateDailyLimit(horas);
    if (!daily.valid) return fail(`${dia}: ${daily.message}`);
  }

  return ok();
}

export function validatePeriodMutable(estado: string, subject = 'carga no lectiva'): ValidationResult {
  if (!['PLANIFICACION', 'POSTULACION', 'ASIGNACION'].includes(estado)) {
    return fail(`El periodo académico no permite modificar ${subject} en estado ${estado}`);
  }
  return ok();
}

export function validatePreparacionLimit(
  horasPreparacion: number,
  horasLectivas: number
): ValidationResult {
  if (horasPreparacion > horasLectivas * 0.5) {
    return fail(`Preparación y Evaluación excede 50% de horas lectivas (${horasPreparacion}h > ${Math.floor(horasLectivas * 0.5)}h)`);
  }
  return ok();
}

export function validateDEDictaOtraUniversidad(
  modalidad: ModalidadDocente,
  dictaOtraUniversidad: boolean
): ValidationResult {
  if (modalidad === 'DEDICACION_EXCLUSIVA' && dictaOtraUniversidad) {
    return fail('Dedicación Exclusiva no permite dictar en otra universidad');
  }
  return ok();
}

export function validateCargaCompleta(
  totalLectiva: number,
  totalNoLectiva: number,
  horasContrato: number
): ValidationResult {
  const total = totalLectiva + totalNoLectiva;
  if (total > horasContrato) {
    return fail(`Total excede horas de contrato: ${total}h > ${horasContrato}h`);
  }
  if (total < horasContrato) {
    return fail(`Faltan ${horasContrato - total}h para completar contrato de ${horasContrato}h`);
  }
  return ok();
}

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

export async function validateAll(
  prisma: PrismaClient,
  docenteId: string,
  periodoId: string,
  nuevasHorasLectivas: number,
  _nuevoTipo: TipoAsignacion,
  options: ValidateAllOptions = {}
): Promise<ValidationResult> {
  const docente = await prisma.docente.findUniqueOrThrow({
    where: { id: docenteId },
    select: { modalidad: true, horasContrato: true, dictaOtraUniversidad: true },
  });

  const result = validateDEDictaOtraUniversidad(docente.modalidad as ModalidadDocente, docente.dictaOtraUniversidad);
  if (!result.valid) return result;

  const asignacionesExistentes = await prisma.asignacionCargaLectiva.findMany({
    where: {
      periodoId,
      OR: [
        { docenteId },
        { docenteCompartidoId: docenteId }
      ],
      ...(options.excludeAsignacionId ? { id: { not: options.excludeAsignacionId } } : {}),
      ...(options.excludeGrupoId ? { grupoId: { not: options.excludeGrupoId } } : {}),
    },
  });

  const cargasNoLectivas = await prisma.cargaNoLectiva.findMany({
    where: { docenteId, periodoId },
  });

  const totalLectivasExistentes = asignacionesExistentes.reduce((sum, a) => sum + a.horasAsignadas, 0);
  const totalNoLectivas = cargasNoLectivas.reduce((sum, c) => sum + c.horas, 0);
  const totalLectivas = totalLectivasExistentes + nuevasHorasLectivas;

  const weeklyResult = validateWeeklyLimit(
    totalLectivas + totalNoLectivas,
    docente.modalidad as ModalidadDocente,
    docente.horasContrato
  );
  if (!weeklyResult.valid) return weeklyResult;

  const preparacion = cargasNoLectivas
    .filter((c) => c.tipo === 'PREPARACION_EVALUACION')
    .reduce((sum, c) => sum + c.horas, 0);
  const prepResult = validatePreparacionLimit(preparacion, totalLectivas);
  if (!prepResult.valid) return prepResult;

  return ok();
}

export async function validateDocenteWorkload(
  prisma: any,
  docenteId: string,
  periodoId: string
): Promise<ValidationResult> {
  const docente = await prisma.docente.findUniqueOrThrow({
    where: { id: docenteId },
    select: { categoria: true, tipo: true, modalidad: true, horasContrato: true },
  });

  const [asignaciones, cargasNoLectivas] = await Promise.all([
    prisma.asignacionCargaLectiva.findMany({
      where: { docenteId, periodoId },
    }),
    prisma.cargaNoLectiva.findMany({
      where: { docenteId, periodoId },
    }),
  ]);

  const totalLectivas = asignaciones.reduce((sum: number, a: any) => sum + a.horasAsignadas, 0);

  // 1. Determine minimum lective hours
  let lectiveMinimum = 0;
  const cargoDocente = await prisma.cargoDocente.findFirst({
    where: { docenteId, periodoId },
    select: { cargo: true },
  });

  if (cargoDocente) {
    const rule = await prisma.reglaCargaPorCargo.findFirst({
      where: { cargo: cargoDocente.cargo, codigoActividad: 'LECTIVA_MINIMA', activa: true },
      select: { horasLectivasMinimas: true },
    });
    if (rule && rule.horasLectivasMinimas !== null) {
      lectiveMinimum = rule.horasLectivasMinimas;
    }
  } else {
    // default rules
    if (docente.categoria === CategoriaDocente.JEFE_PRACTICA) {
      if (docente.modalidad === ModalidadDocente.TIEMPO_COMPLETO || docente.modalidad === ModalidadDocente.DEDICACION_EXCLUSIVA) {
        lectiveMinimum = 24;
      } else {
        if (docente.horasContrato === 20) lectiveMinimum = 16;
        else if (docente.horasContrato === 12) lectiveMinimum = 12;
        else if (docente.horasContrato === 10) lectiveMinimum = 10;
        else if (docente.horasContrato === 8) lectiveMinimum = 8;
        else lectiveMinimum = docente.horasContrato; // nominal
      }
    } else if (docente.tipo === TipoDocente.NOMBRADO) {
      if (docente.modalidad === ModalidadDocente.TIEMPO_COMPLETO || docente.modalidad === ModalidadDocente.DEDICACION_EXCLUSIVA) {
        lectiveMinimum = 16;
      } else {
        if (docente.horasContrato === 20) lectiveMinimum = 12;
        else if (docente.horasContrato === 12) lectiveMinimum = 10;
        else if (docente.horasContrato === 10 || docente.horasContrato === 8) lectiveMinimum = 8;
        else lectiveMinimum = docente.horasContrato;
      }
    } else if (docente.tipo === TipoDocente.CONTRATADO) {
      if (docente.modalidad === ModalidadDocente.TIEMPO_COMPLETO || docente.modalidad === ModalidadDocente.DEDICACION_EXCLUSIVA) {
        lectiveMinimum = 20;
      } else {
        if (docente.horasContrato === 20) lectiveMinimum = 14;
        else if (docente.horasContrato === 12) lectiveMinimum = 12;
        else if (docente.horasContrato === 10) lectiveMinimum = 10;
        else if (docente.horasContrato === 8) lectiveMinimum = 8;
        else lectiveMinimum = docente.horasContrato;
      }
    }
  }

  if (totalLectivas < lectiveMinimum) {
    return fail(`Mínimo de horas lectivas no cumplido: tiene ${totalLectivas}h, requiere ${lectiveMinimum}h`);
  }

  // 2. Validate caps and non-lective rules
  let totalPreparacion = 0;
  let totalTraining = 0;
  let totalThesis = 0;
  let totalJuries = 0;
  let totalResearch = 0;
  let totalSocialProjection = 0;

  for (const carga of cargasNoLectivas) {
    if (carga.tipo === 'PREPARACION_EVALUACION') {
      totalPreparacion += carga.horas;
    } else if (carga.tipo === 'CAPACITACION') {
      totalTraining += carga.horas;
    } else if (carga.tipo === 'ASESORIA_TESIS') {
      totalThesis += carga.horas;
    } else if (carga.tipo === 'JURADOS') {
      totalJuries += carga.horas;
    } else if (carga.tipo === 'INVESTIGACION') {
      totalResearch += carga.horas;
      // Research requires code and name
      if (!carga.codigoProyecto || !carga.codigoProyecto.trim() || !carga.nombreProyecto || !carga.nombreProyecto.trim()) {
        return fail('Investigación requiere código y nombre de proyecto registrado');
      }
    } else if (carga.tipo === 'RESPONSABILIDAD_SOCIAL') {
      totalSocialProjection += carga.horas;
    }

    // Regulated activities require evidence description (except research which is checked above)
    const regulatedTypes = ['ASESORIA_TESIS', 'CAPACITACION', 'JURADOS', 'RESPONSABILIDAD_SOCIAL'];
    if (regulatedTypes.includes(carga.tipo)) {
      if (!carga.descripcion || !carga.descripcion.trim()) {
        return fail(`Actividad ${carga.tipo} requiere descripción de evidencia`);
      }
    }
  }

  // Check caps
  if (totalPreparacion > totalLectivas * 0.5) {
    return fail(`Preparación excede el 50% de horas lectivas`);
  }
  if (totalTraining > 5) {
    return fail(`Capacitación excede el límite máximo de 5h`);
  }
  if (totalThesis > 3) {
    return fail(`Asesoría de tesis excede el límite máximo de 3h`);
  }
  if (totalJuries > 1) {
    return fail(`Jurados excede el límite máximo de 1h`);
  }

  // Ordinary Research minimums (4h for TP20, 5h for TC/DE)
  if (totalResearch > 0 && docente.tipo === TipoDocente.NOMBRADO) {
    if (docente.modalidad === ModalidadDocente.TIEMPO_COMPLETO || docente.modalidad === ModalidadDocente.DEDICACION_EXCLUSIVA) {
      if (totalResearch < 5) {
        return fail('Investigación requiere un mínimo de 5h para TC/DE');
      }
    } else if (docente.modalidad === ModalidadDocente.TIEMPO_PARCIAL && docente.horasContrato === 20) {
      if (totalResearch < 4) {
        return fail('Investigación requiere un mínimo de 4h para TP20');
      }
    }
  }

  // Social projection: minimum 1h weekly for TC and DE
  const isTCorDE = docente.modalidad === ModalidadDocente.TIEMPO_COMPLETO || docente.modalidad === ModalidadDocente.DEDICACION_EXCLUSIVA;
  if (isTCorDE && totalSocialProjection < 1) {
    return fail('Dedicación Exclusiva / Tiempo Completo requiere mínimo 1h de responsabilidad social');
  }

  return ok();
}

