import type { DocenteForSchedule } from './types';
import type { CategoriaDocente, TipoDocente } from '@/generated/prisma/client';

/**
 * Priority ordering for docente types.
 * Lower number = higher priority (gets assigned first).
 */
export const TIPO_ORDER: Record<TipoDocente, number> = {
  NOMBRADO: 1,
  CONTRATADO: 2,
};

/**
 * Priority ordering for docente categories within each type.
 * Lower number = higher priority.
 */
export const CATEGORIA_ORDER: Record<CategoriaDocente, number> = {
  PRINCIPAL: 1,
  ASOCIADO: 2,
  AUXILIAR: 3,
  JEFE_PRACTICA: 4,
};

/**
 * Sorts docentes by the hierarchical priority defined in the spec:
 * 1. Nombrados before Contratados
 * 2. Within each tipo: Principal → Asociado → Auxiliar → JP
 * 3. Within each category: most senior (earliest antigüedad) first
 *
 * Returns a NEW sorted array — does not mutate the input.
 */
export function sortDocentesByHierarchy(
  docentes: DocenteForSchedule[]
): DocenteForSchedule[] {
  return [...docentes].sort((a, b) => {
    // 1. Categoria: Principal → Asociado → Auxiliar → JP
    const catDiff = CATEGORIA_ORDER[a.categoria] - CATEGORIA_ORDER[b.categoria];
    if (catDiff !== 0) return catDiff;

    // 2. Antigüedad: most senior (earlier date) first
    return a.antiguedad.getTime() - b.antiguedad.getTime();
  });
}

