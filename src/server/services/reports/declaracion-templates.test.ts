import { describe, expect, it } from 'vitest';
import { templateFormatoN3, templateFormatoN3Grid, type FormatoN3Data } from './declaracion-templates';

const sampleData: FormatoN3Data = {
  docente: {
    nombre: 'ROBERT JERRY SANCHEZ TICONA',
    dni: '19082305',
    codigoIBM: 'DOC-001',
    categoria: 'ASOCIADO',
    tipo: 'NOMBRADO',
    modalidad: 'TIEMPO_COMPLETO',
    horasContrato: 40,
  },
  periodo: {
    nombre: '2025-II',
    fechaInicio: '01/09/2025',
    fechaFin: '31/12/2025',
  },
  facultad: 'Ingeniería',
  departamento: 'Ingeniería de Sistemas',
  asignacionesLectivas: [
    {
      cursoCodigo: '10-C',
      cursoNombre: 'Aplicaciones Móviles',
      grupoNombre: 'A',
      seccion: 'A',
      ciclo: 10,
      dia: 'LUNES',
      horaInicio: '07:00',
      horaFin: '09:00',
      tipo: 'TEORIA',
      aulaCodigo: 'EPG-209',
    },
    {
      cursoCodigo: '10-C',
      cursoNombre: 'Aplicaciones Móviles',
      grupoNombre: 'A',
      seccion: 'A',
      ciclo: 10,
      dia: 'VIERNES',
      horaInicio: '15:00',
      horaFin: '18:00',
      tipo: 'PRACTICA',
      aulaCodigo: 'LAB 4',
    },
  ],
  cargasNoLectivas: [
    {
      tipo: 'PREPARACION_EVALUACION',
      horas: 10,
      descripcion: 'Preparación semanal',
      horarios: [
        {
          dia: 'MARTES',
          horaInicio: '15:00',
          horaFin: '18:00',
          lugar: 'F11',
          aula: 'CUBÍCULO',
        },
      ],
    },
  ],
};

describe('Formato N3 templates', () => {
  it('renderiza el formato formal F03-CAD con encabezado y totales', () => {
    const html = templateFormatoN3(sampleData);

    expect(html).toContain('HORARIO SEMANAL DE LA CARGA ACADEMICA DOCENTE (F03-CAD)');
    expect(html).toContain('Aplicaciones Móviles');
    expect(html).toContain('PREPARACION Y EVALUACION');
    expect(html).toContain('TOTAL HORAS CARGA ACADEMICA');
    expect(html).toContain('FIRMA DEL DOCENTE');
  });

  it('renderiza el formato tabla con la grilla semanal', () => {
    const html = templateFormatoN3Grid(sampleData);

    expect(html).toContain('HORARIO SEMANAL DEL DOCENTE - DISEÑO GRILLA');
    expect(html).toContain('10-C - A');
    expect(html).toContain('Prep. y Eval.');
    expect(html).toContain('Lun');
  });
});
