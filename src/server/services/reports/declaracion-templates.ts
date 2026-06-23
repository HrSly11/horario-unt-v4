import { DiaSemana } from '@/generated/prisma/client';

// ──── Helpers ────────────────────────────────────────────

const DIA_ABREV: Record<string, string> = {
  LUNES: 'LU',
  MARTES: 'MA',
  MIERCOLES: 'MI',
  JUEVES: 'JU',
  VIERNES: 'VI',
  SABADO: 'SA',
};

const LUGAR_LABELS: Record<string, string> = {
  F01: 'CC. Agropecuarias',
  F02: 'CC. Biológicas',
  F03: 'CC. Económicas',
  F04: 'CC. Físicas y Matemáticas',
  F05: 'CC. Sociales',
  F06: 'Derecho y Ciencias Políticas',
  F07: 'Educación y CC. Comunicación',
  F08: 'Enfermería',
  F09: 'Estomatología',
  F10: 'Farmacia y Bioquímica',
  F11: 'Ingeniería',
  F12: 'Ingeniería Química',
  F13: 'Medicina',
};

const TIPO_LABELS: Record<string, string> = {
  PREPARACION_EVALUACION: 'PREPARACION Y EVALUACION',
  CONSEJERIA: 'TUTORIA Y CONSEJERIA',
  INVESTIGACION: 'INVESTIGACION',
  CAPACITACION: 'FORMACION ACADÉMICA Y CAPACITACIÓN',
  GOBIERNO: 'ACTIVIDADES DE GOBIERNO O AUTORIDAD',
  ADMINISTRACION: 'ACTIVIDADES DE GESTIÓN INSTITUCIONAL',
  ASESORIA_TESIS: 'ASESORÍA DE TESIS Y EXAMENES PROFESIONALES',
  RESPONSABILIDAD_SOCIAL: 'RESPONSABILIDAD SOCIAL UNIVERSITARIA',
  COMITES_COMISIONES: 'COMITES O COMISIONES ESPECIALES',
};

const MODALIDAD_LABELS: Record<string, string> = {
  TIEMPO_COMPLETO: 'Tiempo Completo 40 H',
  DEDICACION_EXCLUSIVA: 'Dedicación Exclusiva',
  TIEMPO_PARCIAL: 'Tiempo Parcial',
};

const CONDICION_LABELS: Record<string, string> = {
  NOMBRADO: 'Nombrado',
  CONTRATADO: 'Contratado',
};

const CATEGORIA_LABELS: Record<string, string> = {
  PRINCIPAL: 'Principal',
  ASOCIADO: 'Asociado',
  AUXILIAR: 'Auxiliar',
  JEFE_PRACTICA: 'Jefe de Práctica',
};

function formatNoLectivaDescription(c: any): string {
  if (!c) return '';
  const parts: string[] = [];
  if (c.descripcion) parts.push(c.descripcion);
  if (c.codigoProyecto) parts.push(`Reg N°: ${c.codigoProyecto}`);
  if (c.nombreProyecto) parts.push(`Proy: ${c.nombreProyecto}`);
  if (c.numAlumnos) parts.push(`Alum: ${c.numAlumnos}`);
  if (c.cicloConsejeria) parts.push(`Ciclo: ${c.cicloConsejeria}`);
  return parts.join(' | ');
}

function formatSlotsText(slots: { tipo: string; dia: string; horaInicio: string; horaFin: string }[]): string {
  const compMap: Record<string, typeof slots> = {};
  slots.forEach((s) => {
    const compLabel = s.tipo === 'TEORIA' ? 'T' : s.tipo === 'PRACTICA' ? 'P' : 'L';
    if (!compMap[compLabel]) compMap[compLabel] = [];
    compMap[compLabel].push(s);
  });

  return Object.entries(compMap)
    .map(([comp, compSlots]) => {
      const dayMap: Record<string, { start: number; end: number }[]> = {};
      compSlots.forEach((cs) => {
        const diaStr = DIA_ABREV[cs.dia] || cs.dia;
        if (!dayMap[diaStr]) dayMap[diaStr] = [];
        const startHour = parseInt(cs.horaInicio.split(':')[0]!);
        const endHour = parseInt(cs.horaFin.split(':')[0]!);
        dayMap[diaStr].push({ start: startHour, end: endHour });
      });

      const dayTexts = Object.entries(dayMap).map(([dia, intervals]) => {
        intervals.sort((a, b) => a.start - b.start);
        const merged: { start: number; end: number }[] = [];
        intervals.forEach((interval) => {
          if (merged.length === 0) {
            merged.push(interval);
          } else {
            const last = merged[merged.length - 1]!;
            if (last.end === interval.start) {
              last.end = interval.end;
            } else {
              merged.push(interval);
            }
          }
        });

        const intervalsStr = merged
          .map((m) => `${String(m.start).padStart(2, '0')}:00-${String(m.end).padStart(2, '0')}:00`)
          .join(', ');
        return `${dia}(${intervalsStr})`;
      });

      return `${comp}: ${dayTexts.join(', ')}`;
    })
    .join('<br>');
}

function formatNoLectivaHorarios(horarios: { dia: string; horaInicio: string; horaFin: string }[]): string {
  if (!horarios || horarios.length === 0) return '—';
  
  const dayMap: Record<string, { start: number; end: number }[]> = {};
  horarios.forEach((h) => {
    const diaStr = DIA_ABREV[h.dia] || h.dia;
    if (!dayMap[diaStr]) dayMap[diaStr] = [];
    const startHour = parseInt(h.horaInicio.split(':')[0]!);
    const endHour = parseInt(h.horaFin.split(':')[0]!);
    dayMap[diaStr].push({ start: startHour, end: endHour });
  });

  const dayTexts = Object.entries(dayMap).map(([dia, intervals]) => {
    intervals.sort((a, b) => a.start - b.start);
    const merged: { start: number; end: number }[] = [];
    intervals.forEach((interval) => {
      if (merged.length === 0) {
        merged.push(interval);
      } else {
        const last = merged[merged.length - 1]!;
        if (last.end === interval.start) {
          last.end = interval.end;
        } else {
          merged.push(interval);
        }
      }
    });

    const intervalsStr = merged
      .map((m) => `${String(m.start).padStart(2, '0')}:00-${String(m.end).padStart(2, '0')}:00`)
      .join(', ');
    return `${dia}(${intervalsStr})`;
  });

  return dayTexts.join(', ');
}

// ──── Styles ─────────────────────────────────────────────

const COMMON_STYLES = `
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, Helvetica, sans-serif; color: #000; font-size: 9.5px; line-height: 1.25; }
    .page { padding: 8mm 8mm; }
    h2 { text-align: center; font-size: 11.5px; margin-bottom: 6px; text-transform: uppercase; font-weight: bold; }
    table { width: 100%; border-collapse: collapse; margin: 5px 0; }
    th, td { border: 1px solid #000; padding: 3px 4px; font-size: 8.5px; vertical-align: top; }
    th { background: #f2f2f2; text-align: center; font-weight: bold; }
    .text-center { text-align: center; }
    .text-right { text-align: right; }
    .bold { font-weight: bold; }
    .uppercase { text-transform: uppercase; }
    .no-border { border: none; }
    .no-border td { border: none; padding: 1px 4px; }
    .total-row td { background: #e6efff; font-weight: bold; }
    .signature-section { margin-top: 25px; display: flex; justify-content: space-between; }
    .signature { text-align: center; width: 30%; }
    .signature .line { border-top: 1px solid #000; margin-top: 40px; padding-top: 3px; font-size: 8.5px; }
    .leyenda { font-size: 7.5px; margin-top: 6px; line-height: 1.3; }
    .info-table td { font-size: 9px; padding: 2px 4px; }
    .info-table th { font-size: 8px; padding: 2px 2px; }
  </style>
`;

const STYLES_JURADA = `
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Times New Roman', Times, serif; color: #000; font-size: 11.5px; line-height: 1.5; }
    .page { padding: 12mm 12mm; }
    h2 { text-align: center; font-size: 13px; margin-bottom: 6px; text-transform: uppercase; font-weight: bold; }
    h3 { text-align: center; font-size: 11px; margin-bottom: 12px; text-transform: uppercase; font-weight: bold; }
    p { margin: 5px 0; text-align: justify; }
    .indent { text-indent: 2em; }
    .bold-italic { font-weight: bold; font-style: italic; }
    .mt-10 { margin-top: 8px; }
    .mt-20 { margin-top: 15px; }
    .mt-30 { margin-top: 25px; }
    .text-right { text-align: right; }
    .text-center { text-align: center; }
    .signature { text-align: center; margin-top: 50px; }
    .signature .line { border-top: 1px solid #000; display: inline-block; width: 220px; padding-top: 3px; }
    .nota { font-size: 9px; margin-top: 25px; }
    .strong-caps { font-weight: bold; text-transform: uppercase; }
  </style>
`;

// ──── Formato N° 1 — Declaración de Carga Horaria Asignada ─────────

export interface FormatoN1Data {
  docente: {
    nombre: string;
    dni?: string | null;
    codigoIBM?: string | null;
    categoria: string;
    tipo: string;
    modalidad: string;
    horasContrato?: number;
  };
  periodo: { nombre: string; fechaInicio?: string; fechaFin?: string };
  anioAcademico: string;
  cicloSemestre: string;
  facultad: string;
  departamento: string;
  escuela: string;
  asignaciones: {
    cursoCodigo: string;
    cursoNombre: string;
    cursoAbrev?: string;
    grupo: string;
    seccion?: string;
    escuelaProf: string;
    ciclo: number;
    numAlumnos: number;
    horasTeoria: number;
    horasPractica: number;
    horasLaboratorio: number;
    tipo: string;
    horas: number;
  }[];
  cargasNoLectivas: {
    tipo: string;
    horas: number;
    descripcion?: string | null;
    codigoProyecto?: string | null;
    nombreProyecto?: string | null;
    numAlumnos?: number | null;
    cicloConsejeria?: string | null;
  }[];
  totalLectivas: number;
  totalNoLectivas: number;
}

export function templateFormatoN1(data: FormatoN1Data): string {
  const filasLectivas = data.asignaciones.map((a) => {
    const isElectivo = a.cursoAbrev === 'E' || a.tipo === 'E' || (a as any).esElectivo;
    const oMark = !isElectivo ? 'X' : '';
    const eMark = isElectivo ? 'X' : '';
    
    const ht = a.horasTeoria > 0 ? a.horasTeoria : 0;
    const hp = a.horasPractica > 0 ? a.horasPractica : 0;
    const hl = a.horasLaboratorio > 0 ? a.horasLaboratorio : 0;
    const total = ht + hp + hl;
    
    return `
      <tr>
        <td class="text-center font-mono" style="font-size: 8px;">${a.cursoCodigo}</td>
        <td style="font-size: 8px;">${a.cursoNombre}</td>
        <td class="text-center bold">${oMark}</td>
        <td class="text-center bold">${eMark}</td>
        <td style="font-size: 8px;">${a.escuelaProf}</td>
        <td class="text-center">${a.ciclo}</td>
        <td class="text-center">${a.grupo}</td>
        <td class="text-center">${a.numAlumnos}</td>
        <td class="text-center">${ht || ''}</td>
        <td class="text-center">${hp || ''}</td>
        <td class="text-center">${hl || ''}</td>
        <td class="text-center bold">${total}</td>
      </tr>
    `;
  }).join('');

  const rowsNoLectivas = [
    { tipo: 'PREPARACION_EVALUACION', label: '2. PREPARACIÓN Y EVALUACIÓN: (Max. 50% del Trabajo Lectivo)' },
    { tipo: 'CONSEJERIA', label: '3. CONSEJERÍA: señalar número de alumnos y el ciclo académico con los que se desarrolla. (Como mínimo una 01 hora semanal).' },
    { tipo: 'INVESTIGACION', label: '3. INVESTIGACIÓN: Consignar el Nº de inscripción, código, nombre y duración del Proyecto. (Como mínimo 04 y 05 horas semanales, según modalidad de trabajo de docentes ordinarios).' },
    { tipo: 'CAPACITACION', label: '4. CAPACITACIÓN: Señale lo referente a este rubro en el marco de los planes de cada Facultad (como máximo 05 semanales).' },
    { tipo: 'GOBIERNO', label: '5. ACTIVIDADES DE GOBIERNO: Si desempeña cargo indique' },
    { tipo: 'ADMINISTRACION', label: '6. ACTIVIDADES DE ADMINISTRACIÓN: Si desempeña cargo indique' },
    { tipo: 'ASESORIA_TESIS', label: '7. ASESORÍA DE TESIS, EXÁMENES PROFESIONALES Y EXPERIENCIA PROFESIONAL: Indicar el número de Resolución Decanal, precisando el nombre y duración de la actividad programada.' },
    { tipo: 'RESPONSABILIDAD_SOCIAL', label: '8. EXTENSIÓN Y PROYECCIÓN SOCIAL: Señalar actividad, proyecto programa a ejecutarse en beneficio de la comunidad local o regional. (Como máximo 02 horas semanales)' },
    { tipo: 'COMITES_COMISIONES', label: '9. COMITÉS TÉCNICOS Y COMISIONES: Consignar el número de Resolución autoritativa indicando el lapso de vigencia.' },
  ];

  const filasNoLectivas = rowsNoLectivas.map((row) => {
    const c = data.cargasNoLectivas.find((item) => item.tipo === row.tipo);
    const desc = formatNoLectivaDescription(c);
    return `
      <tr>
        <td colspan="8" style="font-size: 8px; line-height: 1.15; padding: 2px 4px;">${row.label}</td>
        <td colspan="3" style="font-size: 8px;">${desc}</td>
        <td class="text-center bold">${c?.horas || ''}</td>
      </tr>
    `;
  }).join('');

  const totalGeneral = data.totalLectivas + data.totalNoLectivas;
  const fechaInicio = data.periodo.fechaInicio || '.../.../...';
  const fechaFin = data.periodo.fechaFin || '.../.../...';

  const tVal = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'][new Date().getMonth()];

  return `<!DOCTYPE html><html><head><meta charset="utf-8">${COMMON_STYLES}</head><body>
    <div class="page">
      <h2>FORMATO N° 1<br>DECLARACIÓN DE CARGA HORARIA ASIGNADA</h2>

      <div style="display: flex; justify-content: space-between; margin-bottom: 4px; font-size: 9px;">
        <div><strong>I. DATOS SOBRE LA SITUACIÓN DEL PROFESOR:</strong></div>
        <div style="text-align: right; width: 60%;">
          <strong>FACULTAD:</strong> <span style="border-bottom: 1px dotted #000; display: inline-block; width: 70%; text-align: left; padding-left: 5px;">${data.facultad}</span><br>
          <strong style="margin-top: 2px; display: inline-block;">DPTO. ACADÉMICO:</strong> <span style="border-bottom: 1px dotted #000; display: inline-block; width: 55%; text-align: left; padding-left: 5px;">${data.departamento}</span>
        </div>
      </div>

      <table class="info-table" style="margin-bottom: 4px;">
        <thead>
          <tr>
            <th rowspan="2" style="vertical-align: middle; width: 35%;">NOMBRE COMPLETO</th>
            <th colspan="2" style="width: 15%;">CONDICIÓN</th>
            <th colspan="4" style="width: 25%;">CATEGORÍA</th>
            <th colspan="3" style="width: 25%;">MODALIDAD</th>
          </tr>
          <tr>
            <th>REGULAR</th>
            <th>CONTRATADO</th>
            <th>PRIN</th>
            <th>ASO</th>
            <th>AUX</th>
            <th>JP</th>
            <th>DE</th>
            <th>TC</th>
            <th>TP......... Hs.</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td class="bold text-center" style="vertical-align: middle;">${data.docente.nombre}</td>
            <td class="text-center bold" style="vertical-align: middle;">${data.docente.tipo === 'NOMBRADO' ? 'X' : ''}</td>
            <td class="text-center bold" style="vertical-align: middle;">${data.docente.tipo === 'CONTRATADO' ? 'X' : ''}</td>
            <td class="text-center bold" style="vertical-align: middle;">${data.docente.categoria === 'PRINCIPAL' ? 'X' : ''}</td>
            <td class="text-center bold" style="vertical-align: middle;">${data.docente.categoria === 'ASOCIADO' ? 'X' : ''}</td>
            <td class="text-center bold" style="vertical-align: middle;">${data.docente.categoria === 'AUXILIAR' ? 'X' : ''}</td>
            <td class="text-center bold" style="vertical-align: middle;">${data.docente.categoria === 'JEFE_PRACTICA' ? 'X' : ''}</td>
            <td class="text-center bold" style="vertical-align: middle;">${data.docente.modalidad === 'DEDICACION_EXCLUSIVA' ? 'X' : ''}</td>
            <td class="text-center bold" style="vertical-align: middle;">${data.docente.modalidad === 'TIEMPO_COMPLETO' ? 'X' : ''}</td>
            <td class="text-center bold" style="vertical-align: middle;">${data.docente.modalidad === 'TIEMPO_PARCIAL' ? `X (${data.docente.horasContrato ?? ''} Hs.)` : ''}</td>
          </tr>
        </tbody>
      </table>

      <div style="margin-bottom: 5px; font-size: 9px; line-height: 1.4;">
        <strong>AÑO ACADÉMICO:</strong> <span style="border-bottom: 1px dotted #000; padding: 0 8px;">${data.anioAcademico}</span> &nbsp;&nbsp;&nbsp;&nbsp;
        <strong>SEMESTRE:</strong> <span style="border-bottom: 1px dotted #000; padding: 0 8px;">${data.cicloSemestre}</span> &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
        <strong>Inicio:</strong> <span style="border-bottom: 1px dotted #000; padding: 0 8px;">${fechaInicio}</span> &nbsp;&nbsp;&nbsp;&nbsp;
        <strong>Final:</strong> <span style="border-bottom: 1px dotted #000; padding: 0 8px;">${fechaFin}</span>
      </div>

      <table class="info-table" style="margin-bottom: 4px;">
        <thead>
          <tr class="section-header">
            <th colspan="12" style="text-align: left; background: #fff; font-weight: bold; font-size: 9px; border-bottom: none; padding-left: 0;">
              1. TRABAJO LECTIVO.- Datos completos y con claridad
            </th>
          </tr>
          <tr>
            <th rowspan="2" style="vertical-align: middle; width: 8%;">CODIGO</th>
            <th rowspan="2" style="vertical-align: middle; width: 32%;">NOMBRE DEL CURSO</th>
            <th colspan="2" style="width: 6%;">Curso</th>
            <th rowspan="2" style="vertical-align: middle; width: 14%;">Escuela Prof.</th>
            <th rowspan="2" style="vertical-align: middle; width: 6%;">Año o Ciclo</th>
            <th rowspan="2" style="vertical-align: middle; width: 8%;">Nº Sec. o Grupo</th>
            <th rowspan="2" style="vertical-align: middle; width: 8%;">Nº Tot. Alumn.</th>
            <th colspan="3" style="width: 12%;">Horas</th>
            <th rowspan="2" style="vertical-align: middle; width: 6%;">Total Hrs.</th>
          </tr>
          <tr>
            <th>O</th>
            <th>E</th>
            <th>Teor.</th>
            <th>Prác.</th>
            <th>Lab.</th>
          </tr>
        </thead>
        <tbody>
          ${filasLectivas || '<tr><td colspan="12" class="text-center">Sin asignaciones lectivas</td></tr>'}
          ${filasNoLectivas}
          <tr class="total-row">
            <td colspan="11" class="text-right bold" style="padding-right: 12px; font-size: 9px;">TOTAL HORAS/ MENSUAL</td>
            <td class="text-center bold" style="font-size: 9px;">${totalGeneral}</td>
          </tr>
        </tbody>
      </table>

      <div style="display: flex; justify-content: flex-end; margin-top: 10px; font-size: 9px;">
        Trujillo, <span style="border-bottom: 1px dotted #000; width: 25px; display: inline-block; text-align: center;">${new Date().getDate()}</span> de 
        <span style="border-bottom: 1px dotted #000; width: 80px; display: inline-block; text-align: center;">${tVal}</span> de 
        <span style="border-bottom: 1px dotted #000; width: 45px; display: inline-block; text-align: center;">${new Date().getFullYear()}</span>
      </div>
      
      <div class="signature-section" style="margin-top: 25px;">
        <div class="signature">
          <div class="line"><strong>Firma del Profesor</strong></div>
        </div>
        <div class="signature">
          <div class="line"><strong>Firma Jefe Dpto. Acad.</strong></div>
        </div>
        <div class="signature">
          <div class="line"><strong>Vº Bº DECANO</strong></div>
        </div>
      </div>
    </div>
  </body></html>`;
}

// ──── Formato N° 2 — Declaración Jurada de No Estar Incurso ────────

export interface FormatoN23Data {
  docente: { nombre: string; dni?: string | null; codigoIBM?: string | null };
  periodo: string;
  facultad: string;
  departamento: string;
  modalidad: string;
  tipo: string;
  fecha?: string;
}

export function templateFormatoN2(data: FormatoN23Data): string {
  const fecha = data.fecha || `${new Date().getDate()} de ${['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'][new Date().getMonth()]} del ${new Date().getFullYear()}`;

  return `<!DOCTYPE html><html><head><meta charset="utf-8">${STYLES_JURADA}</head><body>
    <div class="page">
      <h2>Formato N° 2</h2>
      <h3>Declaración Jurada de No Estar Incurso en Causales<br>de Incompatibilidad o Impedimento Laboral</h3>

      <p class="indent">
        Yo, <strong>${data.docente.nombre}</strong> identificado con DNI. Nro ${data.docente.dni || '___________'} con Código IBM Nro ${data.docente.codigoIBM || '___________'} del
        Departamento Académico Dpto. de ${data.departamento} Facultad de ${data.facultad}; en el marco del programa de
        Homologación de la remuneración de los docentes universitarios, dispuesto por el D.U. Nro 033-2006 y D.S. Nro
        019-2006-EF, DECLARO BAJO JURAMENTO Y EN HONOR A LA VERDAD, que:
      </p>

      <p class="indent mt-10">
        <strong class="strong-caps">NO ESTOY INCURSO</strong> en causales de incompatibilidad laboral y <strong>NO TENGO</strong> impedimento para ejercer la docencia en
        la Universidad Nacional de Trujillo, de conformidad con lo previsto en el capítulo VII de las Incompatibilidades e
        Impedimentos, del Título VI: Los Profesores, del Estatuto Institucional vigente.
      </p>

      <p class="indent mt-10">
        Soy docente ${CONDICION_LABELS[data.tipo] || data.tipo} a ${MODALIDAD_LABELS[data.modalidad] || data.modalidad} y NO desempeño cargo público o privado en horas que coincidan con
        el horario establecido en la Universidad Nacional de Trujillo (De conformidad con los artículos 270ro y 277ro del Estatuto
        Institucional vigente).
      </p>

      <p class="indent mt-20 bold">
        EN CASO DE FALTAR A LA VERDAD ME SOMETO A LAS SANCIONES QUE SEAN APLICABLES DE
        ACUERDO A LEY; ASIMISMO, DE ENCONTRARME INCURSO EN SITUACIÓN DE INCOMPATIBILIDAD O
        IMPEDIMENTO PARA EJERCER LA DOCENCIA EN LA U.N.T., ME SOMETO A LAS SANCIONES PREVISTAS
        POR SU ESTATUTO,
      </p>
      <p class="bold-italic mt-10">
        Y AUTORIZO AL FUNCIONARIO COMPETENTE DISPONGA EL DESCUENTO DE MI PLANILLA DE HABERES,
        DEL MONTO QUE LA UNIDAD DE REMUNERACIONES LIQUIDE COMO PAGOS INDEBIDOS POR EL LAPSO
        DE TIEMPO LABORADO ILEGALMENTE.
      </p>

      <p class="text-right mt-30">Trujillo, ${fecha}</p>

      <div class="signature">
        <div class="line">
          FIRMA DEL DECLARANTE<br>
          DNI: ${data.docente.dni || '___________'}
        </div>
      </div>

      <p class="nota">
        Nota: Los docentes deben suscribir de forma obligatoria el presente formato en cada Semestre Académico, en el reverso de la
        Declaración de Carga Horaria Asignada
      </p>
    </div>
  </body></html>`;
}

// ──── Formato N° 3 — Horario Semanal de la Carga Académica (F03-CAD) ──

export interface FormatoN3Data {
  docente: {
    nombre: string;
    dni?: string | null;
    codigoIBM?: string | null;
    categoria: string;
    tipo: string;
    modalidad: string;
  };
  periodo: { nombre: string; fechaInicio?: string; fechaFin?: string };
  facultad: string;
  departamento: string;
  asignacionesLectivas: {
    cursoCodigo: string;
    cursoNombre: string;
    grupoNombre: string;
    seccion?: string;
    ciclo: number;
    dia: string;
    horaInicio: string;
    horaFin: string;
    tipo: string;
    aulaCodigo: string;
  }[];
  cargasNoLectivas: {
    tipo: string;
    horas: number;
    descripcion?: string | null;
    horarios?: { dia: string; horaInicio: string; horaFin: string; lugar?: string | null; aula?: string | null }[];
  }[];
}

interface GroupedLectiva {
  key: string;
  cursoCodigo: string;
  cursoNombre: string;
  grupoNombre: string;
  ciclo: number;
  seccion: string;
  aulas: string[];
  slots: {
    tipo: string;
    dia: string;
    horaInicio: string;
    horaFin: string;
  }[];
  totalHoras: number;
}

export function templateFormatoN3(data: FormatoN3Data): string {
  const groupsMap: Record<string, GroupedLectiva> = {};
  data.asignacionesLectivas.forEach((a) => {
    const key = `${a.cursoCodigo}-${a.grupoNombre}`;
    if (!groupsMap[key]) {
      groupsMap[key] = {
        key,
        cursoCodigo: a.cursoCodigo,
        cursoNombre: a.cursoNombre,
        grupoNombre: a.grupoNombre,
        ciclo: a.ciclo,
        seccion: a.seccion || 'A',
        aulas: [],
        slots: [],
        totalHoras: 0,
      };
    }
    const item = groupsMap[key];
    if (!item.aulas.includes(a.aulaCodigo)) {
      item.aulas.push(a.aulaCodigo);
    }
    item.slots.push({
      tipo: a.tipo,
      dia: a.dia,
      horaInicio: a.horaInicio,
      horaFin: a.horaFin,
    });
    item.totalHoras += 1;
  });

  const filasLectivas = Object.values(groupsMap).map((g) => {
    const horarioText = formatSlotsText(g.slots);
    const totalHrs = g.totalHoras;
    const aulasList = g.aulas.join(', ');
    return `
      <tr>
        <td style="font-size: 8px;">${horarioText}</td>
        <td style="font-size: 8px;">
          <strong class="uppercase">${g.cursoNombre}</strong><br>
          Ciclo ${g.ciclo} — Grupo ${g.grupoNombre}
        </td>
        <td class="text-center font-bold">F11</td>
        <td class="text-center" style="font-size: 8px;">${aulasList}</td>
        <td class="text-center bold">${totalHrs}</td>
      </tr>
    `;
  }).join('');

  const filasNoLectivas = data.cargasNoLectivas.map((c) => {
    const horarioText = formatNoLectivaHorarios(c.horarios || []);
    const label = TIPO_LABELS[c.tipo] || c.tipo;
    const aulaStr = 'CUBÍCULO';
    return `
      <tr>
        <td style="font-size: 8px;">${horarioText}</td>
        <td style="font-size: 8px; font-weight: 500;">${label}</td>
        <td class="text-center font-bold">F11</td>
        <td class="text-center" style="font-size: 8px;">${aulaStr}</td>
        <td class="text-center bold">${c.horas}</td>
      </tr>
    `;
  }).join('');

  const totalLectivas = data.asignacionesLectivas.length;
  const totalNoLectivas = data.cargasNoLectivas.reduce((sum, c) => sum + c.horas, 0);
  const totalGeneral = totalLectivas + totalNoLectivas;
  const fechaInicio = data.periodo.fechaInicio || '.../.../...';
  const fechaFin = data.periodo.fechaFin || '.../.../...';

  const parts = data.periodo.nombre.split('-');
  const anioAcademico = parts[0] || new Date().getFullYear().toString();
  const cicloSemestre = parts[1] || 'I';

  return `<!DOCTYPE html><html><head><meta charset="utf-8">${COMMON_STYLES}</head><body>
    <div class="page">
      <h2>HORARIO SEMANAL DE LA CARGA ACADÉMICA DOCENTE (F03-CAD)</h2>

      <table class="info-table no-border" style="margin-bottom: 2px;">
        <tr>
          <td><strong>Facultad / Filial:</strong> ${data.facultad}</td>
          <td><strong>Dpto. Académico:</strong> ${data.departamento}</td>
        </tr>
        <tr>
          <td><strong>DNI:</strong> ${data.docente.dni || '___________'} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; <strong>Docente:</strong> ${data.docente.nombre}</td>
          <td class="bold uppercase" style="font-size: 9px; line-height: 1.15;">
            ${CATEGORIA_LABELS[data.docente.categoria] || data.docente.categoria} - 
            ${data.docente.modalidad === 'TIEMPO_COMPLETO' ? 'TC' : data.docente.modalidad === 'DEDICACION_EXCLUSIVA' ? 'DE' : 'TP'}
          </td>
        </tr>
        <tr>
          <td><strong>AÑO ACADÉMICO:</strong> ${anioAcademico} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; <strong>SEMESTRE:</strong> ${cicloSemestre}</td>
          <td><strong>Fecha de Inicio:</strong> ${fechaInicio} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; <strong>Fecha de término:</strong> ${fechaFin}</td>
        </tr>
      </table>

      <!-- Lective Section -->
      <table class="info-table">
        <thead>
          <tr>
            <th style="width: 25%;">HORARIO</th>
            <th style="width: 45%;">CARGA HORARIA LECTIVA (CHL)</th>
            <th style="width: 10%;">LUGAR</th>
            <th style="width: 12%;">AULA</th>
            <th style="width: 8%;">TOTAL</th>
          </tr>
        </thead>
        <tbody>
          ${filasLectivas || '<tr><td colspan="5" class="text-center text-zinc-500">Sin carga horaria lectiva</td></tr>'}
        </tbody>
      </table>

      <!-- Non-Lective Section -->
      <table class="info-table">
        <thead>
          <tr>
            <th style="width: 25%;">HORARIO</th>
            <th style="width: 45%;">CARGA HORARIA NO LECTIVA (CHNL)</th>
            <th style="width: 10%;">LUGAR</th>
            <th style="width: 12%;">AULA</th>
            <th style="width: 8%;">TOTAL</th>
          </tr>
        </thead>
        <tbody>
          ${filasNoLectivas || '<tr><td colspan="5" class="text-center text-zinc-500">Sin carga horaria no lectiva</td></tr>'}
          <tr class="total-row">
            <td colspan="4" class="text-right bold" style="padding-right: 12px; font-size: 9px;">TOTAL HORAS CARGA ACADÉMICA</td>
            <td class="text-center bold" style="font-size: 9px;">${totalGeneral}</td>
          </tr>
        </tbody>
      </table>

      <!-- Legend -->
      <div class="leyenda">
        <p><strong>T: TEORÍA - P: PRÁCTICA - L: LABORATORIO</strong></p>
        <p>LU (LUNES); MA (MARTES); MI (MIÉRCOLES); JU (JUEVES); VI (VIERNES); SA (SÁBADO) — TIEMPO EN FORMATO DE 24 HORAS.</p>
        <p><strong>LUGAR:</strong> ${Object.entries(LUGAR_LABELS).map(([k, v]) => `${k}: "${v}"`).join(', ')}</p>
      </div>

      <!-- Signatures -->
      <div class="signature-section" style="margin-top: 35px;">
        <div class="signature">
          <div class="line"><strong>Firma del Docente</strong></div>
        </div>
        <div class="signature">
          <div class="line"><strong>Firma Jefe Dpto. Académico</strong></div>
        </div>
        <div class="signature">
          <div class="line"><strong>Vº Bº DECANO</strong></div>
        </div>
      </div>
    </div>
  </body></html>`;
}
