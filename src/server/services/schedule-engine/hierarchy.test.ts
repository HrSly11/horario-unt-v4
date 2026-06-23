import { describe, it, expect } from 'vitest';
import { sortDocentesByHierarchy, CATEGORIA_ORDER } from './hierarchy';
import type { DocenteForSchedule } from './types';

function makeDocente(overrides: Partial<DocenteForSchedule> & { id: string }): DocenteForSchedule {
  return {
    nombre: 'Test Docente',
    categoria: 'AUXILIAR',
    tipo: 'CONTRATADO',
    antiguedad: new Date('2020-01-01'),
    ...overrides,
  };
}

describe('hierarchy', () => {
  describe('CATEGORIA_ORDER', () => {
    it('follows PRINCIPAL < ASOCIADO < AUXILIAR < JEFE_PRACTICA', () => {
      expect(CATEGORIA_ORDER.PRINCIPAL).toBeLessThan(CATEGORIA_ORDER.ASOCIADO);
      expect(CATEGORIA_ORDER.ASOCIADO).toBeLessThan(CATEGORIA_ORDER.AUXILIAR);
      expect(CATEGORIA_ORDER.AUXILIAR).toBeLessThan(CATEGORIA_ORDER.JEFE_PRACTICA);
    });
  });

  describe('sortDocentesByHierarchy', () => {
    it('sorts by category first, regardless of tipo', () => {
      const docentes = [
        makeDocente({ id: 'asociado-nombrado', tipo: 'NOMBRADO', categoria: 'ASOCIADO', antiguedad: new Date('1990-01-01') }),
        makeDocente({ id: 'principal-contratado', tipo: 'CONTRATADO', categoria: 'PRINCIPAL', antiguedad: new Date('2000-01-01') }),
      ];

      const sorted = sortDocentesByHierarchy(docentes);
      expect(sorted[0].id).toBe('principal-contratado');
      expect(sorted[1].id).toBe('asociado-nombrado');
    });

    it('sorts by antiguedad (most senior first) within same category, regardless of tipo', () => {
      const docentes = [
        makeDocente({ id: 'junior-nombrado', tipo: 'NOMBRADO', categoria: 'PRINCIPAL', antiguedad: new Date('2010-01-01') }),
        makeDocente({ id: 'senior-contratado', tipo: 'CONTRATADO', categoria: 'PRINCIPAL', antiguedad: new Date('1995-01-01') }),
      ];

      const sorted = sortDocentesByHierarchy(docentes);
      expect(sorted.map((d) => d.id)).toEqual(['senior-contratado', 'junior-nombrado']);
    });
  });
});
