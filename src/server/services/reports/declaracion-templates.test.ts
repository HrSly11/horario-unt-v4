import { describe, expect, it } from 'vitest';
import {
  templateFormatoN1,
  templateFormatoN3,
  templateFormatoN3Grid,
  type FormatoN1Data,
  type FormatoN3Data,
} from './declaracion-templates';

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

describe('Formato N1 template', () => {
  it('consolidates duplicate courses by course code and group, summing hours', () => {
    const sampleN1Data: FormatoN1Data = {
      docente: {
        nombre: 'HARRY POTTER',
        dni: '12345678',
        codigoIBM: 'DOC-123',
        categoria: 'AUXILIAR',
        tipo: 'CONTRATADO',
        modalidad: 'TIEMPO_COMPLETO',
        horasContrato: 40,
      },
      periodo: {
        nombre: '2026-I',
        fechaInicio: '01/04/2026',
        fechaFin: '31/07/2026',
      },
      anioAcademico: '2026',
      cicloSemestre: 'I',
      facultad: 'Ingeniería',
      departamento: 'Ingeniería de Sistemas',
      escuela: 'Ingeniería de Sistemas',
      asignaciones: [
        {
          cursoCodigo: 'EE-101',
          cursoNombre: 'Introducción a la Ingeniería de Sistemas',
          grupo: 'A',
          seccion: 'A',
          escuelaProf: 'Escuela de Ingeniería de Sistemas',
          ciclo: 1,
          numAlumnos: 30,
          horasTeoria: 2,
          horasPractica: 0,
          horasLaboratorio: 0,
          tipo: 'TEORIA',
          horas: 2,
        },
        {
          cursoCodigo: 'EE-101',
          cursoNombre: 'Introducción a la Ingeniería de Sistemas',
          grupo: 'A',
          seccion: 'A',
          escuelaProf: 'Escuela de Ingeniería de Sistemas',
          ciclo: 1,
          numAlumnos: 30,
          horasTeoria: 0,
          horasPractica: 2,
          horasLaboratorio: 0,
          tipo: 'PRACTICA',
          horas: 2,
        },
      ],
      cargasNoLectivas: [],
      totalLectivas: 4,
      totalNoLectivas: 0,
    };

    const html = templateFormatoN1(sampleN1Data);

    // Verify it consolidates the duplicate EE-101 rows into a single row
    // with 2 hours of theory, 2 hours of practice, and total 4 hours.
    expect(html).toContain('EE-101');
    expect(html).toContain('Introducción a la Ingeniería de Sistemas');
    
    // There should only be one occurrence of the course name in the table body rows
    const matches = html.match(/Introducción a la Ingeniería de Sistemas/g);
    expect(matches).toHaveLength(1);

    // Verify the columns for hours (ht, hp, hl, total)
    // <td>2</td> (ht)
    // <td>2</td> (hp)
    // <td></td> (hl) -> should render as '' or not be '2'
    // <td class="text-center bold">4</td> (total)
    expect(html).toContain('<td class="text-center">2</td>');
    expect(html).toContain('<td class="text-center bold">4</td>');
  });
});
