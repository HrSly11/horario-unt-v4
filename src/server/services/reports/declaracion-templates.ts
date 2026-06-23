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

export function templateFormatoN3(data: FormatoN3Data): string {
  // 1. Build the hourly grid slots for each day
  const dias = ['LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO'];
  const daySlots: Record<string, Record<string, any>> = {};
  
  // Initialize days
  dias.forEach((d) => {
    daySlots[d] = {};
  });

  // Populate lective slots (Asignaciones)
  data.asignacionesLectivas.forEach((a) => {
    const dia = a.dia.toUpperCase();
    if (daySlots[dia]) {
      daySlots[dia][a.horaInicio] = {
        dia,
        horaInicio: a.horaInicio,
        horaFin: a.horaFin,
        lectivo: a.cursoCodigo,
        local: 'LOCAL',
        aula: a.aulaCodigo,
        totalHrs: 1,
      };
    }
  });

  // Populate non-lective slots
  data.cargasNoLectivas.forEach((c) => {
    const horarios = c.horarios || [];
    horarios.forEach((h) => {
      const dia = h.dia.toUpperCase();
      if (!daySlots[dia]) return;

      let currentHour = parseInt(h.horaInicio.split(':')[0]!);
      const endHour = parseInt(h.horaFin.split(':')[0]!);
      
      while (currentHour < endHour) {
        const startStr = `${String(currentHour).padStart(2, '0')}:00`;
        const endStr = `${String(currentHour + 1).padStart(2, '0')}:00`;
        
        if (!daySlots[dia][startStr]) {
          daySlots[dia][startStr] = {
            dia,
            horaInicio: startStr,
            horaFin: endStr,
            local: h.lugar || 'LOCAL',
            aula: h.aula || 'CUBÍCULO',
            totalHrs: 1,
          };
        }
        
        const slot = daySlots[dia][startStr];
        
        if (c.tipo === 'PREPARACION_EVALUACION') slot.preparacion = 1;
        else if (c.tipo === 'CONSEJERIA') slot.consejeria = 1;
        else if (c.tipo === 'INVESTIGACION') slot.investigacion = 1;
        else if (c.tipo === 'CAPACITACION') slot.capacitacion = 1;
        else if (c.tipo === 'GOBIERNO') slot.gobierno = 1;
        else if (c.tipo === 'ADMINISTRACION') slot.administracion = 1;
        else if (c.tipo === 'ASESORIA_TESIS') slot.asesoriaTesis = 1;
        else if (c.tipo === 'RESPONSABILIDAD_SOCIAL') slot.responsabilidadSocial = 1;
        else if (c.tipo === 'COMITES_COMISIONES' || c.tipo === 'JURADOS' || c.tipo === 'AUTOEVALUACION_ACREDITACION' || c.tipo === 'OTRAS_AUTORIZADAS') slot.comitesComisiones = 1;
        
        currentHour++;
      }
    });
  });

  // 2. Generate table rows
  let rowHtml = '';
  let grandTotal = 0;

  dias.forEach((dia) => {
    const slotsMap = daySlots[dia];
    const sortedHours = Object.keys(slotsMap).sort();
    
    if (sortedHours.length === 0) return;

    sortedHours.forEach((hora, idx) => {
      const s = slotsMap[hora];
      grandTotal += 1;
      
      rowHtml += `
        <tr>
          ${idx === 0 ? `<td rowspan="${sortedHours.length}" class="day-header bold text-center uppercase" style="vertical-align: middle; background-color: #f8fafc; font-size: 8px; width: 60px;">${dia}</td>` : ''}
          <td class="text-center font-semibold" style="font-size: 8px; white-space: nowrap;">DE: ${s.horaInicio} A: ${s.horaFin}</td>
          <td class="text-center bold uppercase" style="font-size: 8px; background-color: ${s.lectivo ? '#eff6ff' : 'transparent'};">${s.lectivo || ''}</td>
          <td class="text-center" style="font-size: 8px;">${s.preparacion || ''}</td>
          <td class="text-center" style="font-size: 8px;">${s.consejeria || ''}</td>
          <td class="text-center" style="font-size: 8px;">${s.investigacion || ''}</td>
          <td class="text-center" style="font-size: 8px;">${s.capacitacion || ''}</td>
          <td class="text-center" style="font-size: 8px;">${s.gobierno || ''}</td>
          <td class="text-center" style="font-size: 8px;">${s.administracion || ''}</td>
          <td class="text-center" style="font-size: 8px;">${s.asesoriaTesis || ''}</td>
          <td class="text-center" style="font-size: 8px;">${s.responsabilidadSocial || ''}</td>
          <td class="text-center" style="font-size: 8px;">${s.comitesComisiones || ''}</td>
          <td class="text-center uppercase" style="font-size: 7.5px;">${s.local || 'LOCAL'}</td>
          <td class="text-center bold uppercase" style="font-size: 8px;">${s.aula || ''}</td>
          <td class="text-center bold" style="font-size: 8px; background-color: #f8fafc;">1</td>
        </tr>
      `;
    });
  });

  const parts = data.periodo.nombre.split('-');
  const cycle = parts[1] || 'I';

  // Render HTML document
  return `<!DOCTYPE html><html><head><meta charset="utf-8">
    <style>
      @page { size: A4 landscape; margin: 5mm; }
      body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #1e293b; margin: 0; padding: 0; line-height: 1.15; font-size: 8px; }
      .container { width: 100%; margin: 0 auto; }
      h2 { text-align: center; margin: 0 0 1px 0; font-size: 11px; font-weight: 800; letter-spacing: 0.5px; text-transform: uppercase; }
      h3 { text-align: center; margin: 0 0 6px 0; font-size: 9.5px; font-weight: 700; color: #475569; text-transform: uppercase; }
      
      .info-table { width: 100%; border-collapse: collapse; margin-bottom: 5px; font-size: 8px; }
      .info-table td { padding: 2px 3px; border: none; }
      
      .matrix-table { width: 100%; border-collapse: collapse; margin-bottom: 6px; }
      .matrix-table th { 
        border: 1px solid #94a3b8; 
        padding: 3px 1px; 
        font-weight: 800; 
        text-align: center; 
        background-color: #f1f5f9; 
        font-size: 7px;
        text-transform: uppercase;
        color: #334155;
        line-height: 1.1;
      }
      .matrix-table td { border: 1px solid #cbd5e1; padding: 2.5px 1px; }
      
      .text-center { text-align: center; }
      .text-right { text-align: right; }
      .bold { font-weight: 700; }
      .uppercase { text-transform: uppercase; }
      
      .signature-section { 
        margin-top: 20px; 
        display: flex; 
        justify-content: space-between; 
        align-items: flex-start;
        padding: 0 10px;
      }
      .signature { 
        text-align: center; 
        width: 28%; 
      }
      .signature .line { 
        border-top: 1px solid #475569; 
        margin-top: 25px; 
        padding-top: 3px; 
        font-size: 8px; 
        font-weight: 700;
        color: #334155;
      }
    </style>
  </head><body>
    <div class="container">
      <h2>FORMATO 3</h2>
      <h3>HORARIO SEMANAL DEL PERSONAL DOCENTE</h3>

      <table class="info-table">
        <tr>
          <td style="width: 50%;"><strong>FACULTAD DE:</strong> <span style="border-bottom: 1px dotted #475569; padding-bottom: 1px;">${data.facultad}</span></td>
          <td style="width: 50%;"><strong>DEPARTAMENTO ACADÉMICO:</strong> <span style="border-bottom: 1px dotted #475569; padding-bottom: 1px;">${data.departamento}</span></td>
        </tr>
        <tr>
          <td colspan="2" style="padding-top: 3px;">
            <strong>Código:</strong> <span style="border-bottom: 1px dotted #475569; width: 80px; display: inline-block;">${data.docente.codigoIBM || '___________'}</span> &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
            <strong>Nombre:</strong> <span style="border-bottom: 1px dotted #475569; width: 280px; display: inline-block;">${data.docente.nombre}</span> &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
            <strong>Semestre:</strong> <span style="border-bottom: 1px dotted #475569; width: 60px; display: inline-block; text-align: center;">${cycle}</span> &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
            <strong>Del:</strong> <span style="border-bottom: 1px dotted #475569; width: 85px; display: inline-block; text-align: center;">${data.periodo.fechaInicio || '___________'}</span> &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
            <strong>Al:</strong> <span style="border-bottom: 1px dotted #475569; width: 85px; display: inline-block; text-align: center;">${data.periodo.fechaFin || '___________'}</span>
          </td>
        </tr>
      </table>

      <table class="matrix-table">
        <thead>
          <tr>
            <th style="width: 5%;">DÍA</th>
            <th style="width: 10%;">HORA</th>
            <th style="width: 12%;">TRABAJO LECTIVO<br><span style="font-size: 6px; font-weight: normal;">(Código del Curso)</span></th>
            <th style="width: 7%;">PREPARACIÓN Y<br>EVALUACIÓN</th>
            <th style="width: 6%;">CONSEJERÍA</th>
            <th style="width: 7%;">INVESTIGACIÓN</th>
            <th style="width: 7%;">CAPACITACIÓN</th>
            <th style="width: 7%;">ACTIVIDADES DE<br>GOBIERNO</th>
            <th style="width: 7%;">ACTIVIDADES DE<br>ADMINISTRACIÓN</th>
            <th style="width: 8%;">ASESORÍA DE TESIS Y<br>EXÁMENES PROFESIONALES</th>
            <th style="width: 7%;">EXTENSIÓN Y<br>PROYECCIÓN SOCIAL</th>
            <th style="width: 7%;">COMITÉS TÉCNICOS Y<br>COMISIONES</th>
            <th style="width: 6%;">LOCAL</th>
            <th style="width: 6%;">AULA</th>
            <th style="width: 5%;">TOTAL<br>HRS.</th>
          </tr>
        </thead>
        <tbody>
          ${rowHtml || '<tr><td colspan="15" class="text-center" style="padding: 15px; color: #64748b;">No hay actividades registradas en el horario semanal para este periodo académico.</td></tr>'}
          ${rowHtml ? `
            <tr style="background-color: #f1f5f9; font-weight: bold;">
              <td colspan="14" class="text-right" style="padding: 3px 6px; font-size: 8px;">TOTAL HORAS ACADÉMICAS SEMANALES:</td>
              <td class="text-center" style="font-size: 8px; border: 2px solid #475569; background-color: #f1f5f9;">${grandTotal}</td>
            </tr>
          ` : ''}
        </tbody>
      </table>

      <!-- Delivery Date and Signatures -->
      <div style="margin-top: 15px;">
        <div style="font-size: 8px; margin-bottom: 8px;">
          <strong>FECHA DE ENTREGA :</strong> ................................................................
        </div>
        
        <div class="signature-section" style="margin-top: 25px;">
          <div class="signature">
            <div class="line">Decano de la Facultad</div>
          </div>
          <div class="signature">
            <div class="line">FIRMA DEL PROFESOR</div>
          </div>
          <div class="signature">
            <div class="line">Jefe de Departamento</div>
          </div>
        </div>
      </div>
    </div>
  </body></html>`;
}
