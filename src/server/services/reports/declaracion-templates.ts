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
  F14: 'Filial Valle Jequetepeque',
  F15: 'Filial Huamachuco',
  F16: 'Filial Santiago de Chuco',
  OA: 'Oficina Administrativa',
  SC: 'Salida de Campo',
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
    horasContrato?: number | null;
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

const N3_DIAS: DiaSemana[] = [
  DiaSemana.LUNES,
  DiaSemana.MARTES,
  DiaSemana.MIERCOLES,
  DiaSemana.JUEVES,
  DiaSemana.VIERNES,
  DiaSemana.SABADO,
];

const N3_DIA_LABELS: Record<DiaSemana, string> = {
  LUNES: 'Lun',
  MARTES: 'Mar',
  MIERCOLES: 'Mie',
  JUEVES: 'Jue',
  VIERNES: 'Vie',
  SABADO: 'Sab',
};

const N3_NO_LECTIVA_LABELS: Record<string, string> = {
  PREPARACION_EVALUACION: 'Prep. y Eval.',
  CONSEJERIA: 'Consejeria',
  INVESTIGACION: 'Investigacion',
  CAPACITACION: 'Capacitacion',
  GOBIERNO: 'Gobierno',
  ADMINISTRACION: 'Administracion',
  ASESORIA_TESIS: 'Asesoria Tesis',
  RESPONSABILIDAD_SOCIAL: 'Resp. Social',
  COMITES_COMISIONES: 'Comites',
  JURADOS: 'Jurados',
  AUTOEVALUACION_ACREDITACION: 'Autoeval.',
  OTRAS_AUTORIZADAS: 'Otras',
};

const N3_GRID_TYPE_STYLES: Record<string, { bg: string; border: string; text: string }> = {
  TEORIA: { bg: '#dbeafe', border: '#60a5fa', text: '#1e3a8a' },
  PRACTICA: { bg: '#dcfce7', border: '#4ade80', text: '#166534' },
  LABORATORIO: { bg: '#f3e8ff', border: '#a78bfa', text: '#6b21a8' },
  PREPARACION_EVALUACION: { bg: '#fef9c3', border: '#facc15', text: '#854d0e' },
  CONSEJERIA: { bg: '#fce7f3', border: '#f472b6', text: '#9d174d' },
  INVESTIGACION: { bg: '#e0e7ff', border: '#818cf8', text: '#3730a3' },
  CAPACITACION: { bg: '#ffedd5', border: '#fb923c', text: '#9a3412' },
  GOBIERNO: { bg: '#fee2e2', border: '#f87171', text: '#991b1b' },
  ADMINISTRACION: { bg: '#e5e7eb', border: '#9ca3af', text: '#1f2937' },
  ASESORIA_TESIS: { bg: '#ccfbf1', border: '#2dd4bf', text: '#115e59' },
  RESPONSABILIDAD_SOCIAL: { bg: '#ecfccb', border: '#a3e635', text: '#3f6212' },
  COMITES_COMISIONES: { bg: '#cffafe', border: '#22d3ee', text: '#155e75' },
  JURADOS: { bg: '#fae8ff', border: '#e879f9', text: '#86198f' },
  AUTOEVALUACION_ACREDITACION: { bg: '#ede9fe', border: '#a78bfa', text: '#5b21b6' },
  OTRAS_AUTORIZADAS: { bg: '#d1fae5', border: '#34d399', text: '#065f46' },
};

type FormatoN3TraditionalSlot = {
  dia: DiaSemana;
  horaInicio: string;
  horaFin: string;
  lectivo?: string;
  preparacion?: number;
  consejeria?: number;
  investigacion?: number;
  capacitacion?: number;
  gobierno?: number;
  administracion?: number;
  asesoriaTesis?: number;
  responsabilidadSocial?: number;
  comitesComisiones?: number;
  local: string;
  aula: string;
};

type FormatoN3GridCell = {
  tipo: string;
  label: string;
  detail: string;
};

type N3Interval = {
  dia: DiaSemana;
  horaInicio: string;
  horaFin: string;
  aula?: string | null;
};

type N3GroupedLectiveRow = {
  cursoCodigo: string;
  cursoNombre: string;
  grupoNombre: string;
  seccion?: string;
  ciclo: number;
  slots: FormatoN3Data['asignacionesLectivas'];
};

const N3_TEACHING_TYPE_LABELS: Record<string, string> = {
  TEORIA: 'T',
  PRACTICA: 'P',
  LABORATORIO: 'L',
};

const N3_PRESENTATION_NO_LECTIVE_ROWS = [
  { tipo: 'PREPARACION_EVALUACION', label: 'PREPARACION Y EVALUACION' },
  { tipo: 'CONSEJERIA', label: 'TUTORIA Y CONSEJERIA' },
  { tipo: 'INVESTIGACION', label: 'INVESTIGACION' },
  { tipo: 'RESPONSABILIDAD_SOCIAL', label: 'RESPONSABILIDAD SOCIAL UNIVERSITARIA' },
  { tipo: 'ASESORIA_TESIS', label: 'ASESORIA DE TESIS Y EXAMENES PROFESIONALES' },
  { tipo: 'CAPACITACION', label: 'FORMACION ACADEMICA Y CAPACITACION' },
  { tipo: 'AUTOEVALUACION_ACREDITACION', label: 'AUTOEVALUACION Y/O ACREDITACION DE LA ESCUELA PROFESIONAL' },
  { tipo: 'COMITES_COMISIONES', label: 'COMITES O COMISIONES ESPECIALES' },
  { tipo: 'GOBIERNO', label: 'ACTIVIDADES DE GOBIERNO O AUTORIDAD' },
  { tipo: 'ADMINISTRACION', label: 'ACTIVIDADES DE GESTION INSTITUCIONAL' },
] as const;

function stripAccents(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function expandHourRange(horaInicio: string, horaFin: string): Array<{ horaInicio: string; horaFin: string }> {
  const startHour = parseInt(horaInicio.split(':')[0] || '0', 10);
  const endHour = parseInt(horaFin.split(':')[0] || '0', 10);
  const result: Array<{ horaInicio: string; horaFin: string }> = [];

  for (let currentHour = startHour; currentHour < endHour; currentHour++) {
    result.push({
      horaInicio: `${String(currentHour).padStart(2, '0')}:00`,
      horaFin: `${String(currentHour + 1).padStart(2, '0')}:00`,
    });
  }

  return result;
}

function normalizeDia(dia: string): DiaSemana | null {
  const upperDia = dia.toUpperCase() as DiaSemana;
  return N3_DIAS.includes(upperDia) ? upperDia : null;
}

function getFormatoN3Cycle(periodoNombre: string): string {
  const parts = periodoNombre.split('-');
  return parts[1] || 'I';
}

function getFormatoN3Year(periodoNombre: string): string {
  const parts = periodoNombre.split('-');
  return parts[0] || new Date().getFullYear().toString();
}

function formatShortDate(value?: string): string {
  if (!value) return '___/___/____';
  const [day = '', month = '', year = ''] = value.split('/');
  if (!day || !month || !year) return value;
  return `${Number(day)}/${month}/${year}`;
}

function inferFacultyCode(facultad: string): string {
  const normalized = stripAccents(facultad).toUpperCase();
  const exact = Object.entries(LUGAR_LABELS).find(([, label]) => stripAccents(label).toUpperCase() === normalized);
  if (exact) return exact[0];

  const partial = Object.entries(LUGAR_LABELS).find(([, label]) => normalized.includes(stripAccents(label).toUpperCase()));
  return partial?.[0] || 'F11';
}

function getCategoriaDisplay(categoria: string): string {
  return (CATEGORIA_LABELS[categoria] || categoria).toUpperCase();
}

function getModalidadDisplay(modalidad: string, horasContrato?: number | null): string {
  if (modalidad === 'DEDICACION_EXCLUSIVA') return 'DE';
  if (modalidad === 'TIEMPO_COMPLETO') return 'TC';
  if (modalidad === 'TIEMPO_PARCIAL') {
    return horasContrato ? `TP ${horasContrato}H` : 'TP';
  }
  return modalidad;
}

function getDurationInHours(horaInicio: string, horaFin: string): number {
  const startHour = parseInt(horaInicio.split(':')[0] || '0', 10);
  const endHour = parseInt(horaFin.split(':')[0] || '0', 10);
  return Math.max(0, endHour - startHour);
}

function mergeIntervals(intervals: N3Interval[]): N3Interval[] {
  const sorted = [...intervals].sort((a, b) => {
    const dayDiff = N3_DIAS.indexOf(a.dia) - N3_DIAS.indexOf(b.dia);
    if (dayDiff !== 0) return dayDiff;
    return a.horaInicio.localeCompare(b.horaInicio);
  });

  const merged: N3Interval[] = [];
  for (const current of sorted) {
    const previous = merged[merged.length - 1];
    if (
      previous &&
      previous.dia === current.dia &&
      previous.horaFin === current.horaInicio &&
      (previous.aula || '') === (current.aula || '')
    ) {
      previous.horaFin = current.horaFin;
    } else {
      merged.push({ ...current });
    }
  }

  return merged;
}

function formatHorarioIntervals(intervals: N3Interval[], separator = ', '): { text: string; aulas: string[] } {
  const merged = mergeIntervals(intervals);
  return {
    text: merged
      .map((interval) => `${DIA_ABREV[interval.dia] || interval.dia}(${interval.horaInicio}-${interval.horaFin})`)
      .join(separator),
    aulas: merged.map((interval) => interval.aula || '---'),
  };
}

function buildPresentationLectiveRows(data: FormatoN3Data): { rowsHtml: string; totalLectivas: number } {
  const grouped = new Map<string, N3GroupedLectiveRow>();

  data.asignacionesLectivas.forEach((slot) => {
    const key = [slot.cursoCodigo, slot.grupoNombre, slot.seccion || '', slot.ciclo].join('|');
    const existing = grouped.get(key);
    if (existing) {
      existing.slots.push(slot);
      return;
    }
    grouped.set(key, {
      cursoCodigo: slot.cursoCodigo,
      cursoNombre: slot.cursoNombre,
      grupoNombre: slot.grupoNombre,
      seccion: slot.seccion,
      ciclo: slot.ciclo,
      slots: [slot],
    });
  });

  const lugar = inferFacultyCode(data.facultad);
  const rows = Array.from(grouped.values()).map((item) => {
    const horarioLines: string[] = [];
    const aulas: string[] = [];

    ['TEORIA', 'PRACTICA', 'LABORATORIO'].forEach((tipo) => {
      const slotsByType = item.slots.filter((slot) => slot.tipo === tipo);
      if (slotsByType.length === 0) return;

      const formatted = formatHorarioIntervals(
        slotsByType.map((slot) => ({
          dia: normalizeDia(slot.dia) || DiaSemana.LUNES,
          horaInicio: slot.horaInicio,
          horaFin: slot.horaFin,
          aula: slot.aulaCodigo,
        }))
      );

      horarioLines.push(`${N3_TEACHING_TYPE_LABELS[tipo]}: ${formatted.text}`);
      aulas.push(...formatted.aulas);
    });

    const total = item.slots.reduce(
      (sum, slot) => sum + getDurationInHours(slot.horaInicio, slot.horaFin),
      0
    );
    const detalleGrupo = [item.cursoCodigo, item.grupoNombre, item.seccion].filter(Boolean).join(' - ');

    return `
      <tr>
        <td>${horarioLines.join('<br>') || '&nbsp;'}</td>
        <td>
          <div class="row-title">${item.cursoNombre}</div>
          <div class="row-subtitle">${detalleGrupo}</div>
          <div class="row-subtitle">Ciclo ${item.ciclo}</div>
        </td>
        <td class="text-center">${lugar}</td>
        <td>${aulas.join(', ') || '&nbsp;'}</td>
        <td class="text-center">${total || ''}</td>
      </tr>
    `;
  });

  const totalLectivas = data.asignacionesLectivas.reduce(
    (sum, slot) => sum + getDurationInHours(slot.horaInicio, slot.horaFin),
    0
  );

  return {
    rowsHtml: rows.join(''),
    totalLectivas,
  };
}

function buildPresentationNoLectiveRows(data: FormatoN3Data): { rowsHtml: string; totalNoLectivas: number } {
  const rows = N3_PRESENTATION_NO_LECTIVE_ROWS.map((definition) => {
    const carga = data.cargasNoLectivas.find((item) => item.tipo === definition.tipo);
    if (!carga) {
      return `
        <tr>
          <td>&nbsp;</td>
          <td>${definition.label}</td>
          <td class="text-center">&nbsp;</td>
          <td>&nbsp;</td>
          <td class="text-center">&nbsp;</td>
        </tr>
      `;
    }

    const horarios = (carga.horarios || [])
      .map((horario) => ({
        dia: normalizeDia(horario.dia),
        horaInicio: horario.horaInicio,
        horaFin: horario.horaFin,
        aula: horario.aula || 'CUBICULO',
      }))
      .filter((horario): horario is N3Interval => Boolean(horario.dia));

    const formatted = formatHorarioIntervals(horarios, ', <br>');
    const lugar =
      carga.horarios?.find((horario) => horario.lugar)?.lugar ||
      inferFacultyCode(data.facultad);
    const aulaText =
      formatted.aulas.length > 0
        ? formatted.aulas.join(', ')
        : carga.horarios?.find((horario) => horario.aula)?.aula || 'CUBICULO';

    return `
      <tr>
        <td>${formatted.text || '&nbsp;'}</td>
        <td>${definition.label}</td>
        <td class="text-center">${lugar}</td>
        <td>${aulaText}</td>
        <td class="text-center">${carga.horas || ''}</td>
      </tr>
    `;
  });

  const totalNoLectivas = data.cargasNoLectivas.reduce((sum, carga) => sum + carga.horas, 0);

  return {
    rowsHtml: rows.join(''),
    totalNoLectivas,
  };
}

function buildLugarLegend(): string {
  const orderedCodes = [
    'F01', 'F02', 'F03', 'F04', 'F05', 'F06', 'F07', 'F08',
    'F09', 'F10', 'F11', 'F12', 'F13', 'F14', 'F15', 'F16', 'OA', 'SC',
  ];

  return orderedCodes
    .filter((code) => LUGAR_LABELS[code])
    .map((code) => `${code}: "${LUGAR_LABELS[code]}"`)
    .join('; ');
}

function getLectiveCellDetail(asignacion: FormatoN3Data['asignacionesLectivas'][number]): string {
  const groupLabel = asignacion.seccion
    ? `${asignacion.grupoNombre} / ${asignacion.seccion}`
    : asignacion.grupoNombre;
  const detailParts = [groupLabel, asignacion.aulaCodigo].filter(Boolean);
  return detailParts.join(' | ');
}

function getNoLectiveCellDetail(
  horario: NonNullable<FormatoN3Data['cargasNoLectivas'][number]['horarios']>[number]
): string {
  const detailParts = [horario.lugar, horario.aula].filter(Boolean);
  return detailParts.join(' | ');
}

function buildFormatoN3GridMatrix(data: FormatoN3Data) {
  const matrix: Record<DiaSemana, Record<string, FormatoN3GridCell | null>> = {
    LUNES: {},
    MARTES: {},
    MIERCOLES: {},
    JUEVES: {},
    VIERNES: {},
    SABADO: {},
  };

  N3_DIAS.forEach((dia) => {
    for (let hour = 7; hour <= 21; hour++) {
      matrix[dia][`${String(hour).padStart(2, '0')}:00`] = null;
    }
  });

  data.asignacionesLectivas.forEach((asignacion) => {
    const dia = normalizeDia(asignacion.dia);
    if (!dia) return;

    expandHourRange(asignacion.horaInicio, asignacion.horaFin).forEach((hourBlock) => {
      matrix[dia][hourBlock.horaInicio] = {
        tipo: asignacion.tipo,
        label: `${asignacion.cursoCodigo} - ${asignacion.grupoNombre}`,
        detail: getLectiveCellDetail(asignacion),
      };
    });
  });

  data.cargasNoLectivas.forEach((carga) => {
    const horarios = carga.horarios || [];

    horarios.forEach((horario) => {
      const dia = normalizeDia(horario.dia);
      if (!dia) return;

      expandHourRange(horario.horaInicio, horario.horaFin).forEach((hourBlock) => {
        if (matrix[dia][hourBlock.horaInicio]) return;

        matrix[dia][hourBlock.horaInicio] = {
          tipo: carga.tipo,
          label: N3_NO_LECTIVA_LABELS[carga.tipo] || carga.tipo,
          detail: getNoLectiveCellDetail(horario),
        };
      });
    });
  });

  return matrix;
}

export function templateFormatoN3(data: FormatoN3Data): string {
  const cycle = getFormatoN3Cycle(data.periodo.nombre);
  const year = getFormatoN3Year(data.periodo.nombre);
  const { rowsHtml: lectiveRowsHtml, totalLectivas } = buildPresentationLectiveRows(data);
  const { rowsHtml: noLectiveRowsHtml, totalNoLectivas } = buildPresentationNoLectiveRows(data);
  const totalGeneral = totalLectivas + totalNoLectivas;

  return `<!DOCTYPE html><html><head><meta charset="utf-8">
    <style>
      @page { size: A4 portrait; margin: 8mm; }
      * { box-sizing: border-box; }
      body {
        font-family: 'Times New Roman', Times, serif;
        color: #000;
        margin: 0;
        font-size: 9.2px;
        line-height: 1.2;
      }
      .page { width: 100%; }
      .title {
        text-align: center;
        font-size: 12px;
        font-weight: bold;
        text-transform: uppercase;
        margin-bottom: 8px;
      }
      .meta-table, .section-table, .total-table {
        width: 100%;
        border-collapse: collapse;
      }
      .meta-table td {
        padding: 2px 3px;
        border: none;
        vertical-align: top;
      }
      .meta-label {
        font-weight: bold;
        text-transform: uppercase;
      }
      .meta-value {
        display: inline-block;
        min-width: 50px;
        padding-left: 3px;
      }
      .section-table {
        margin-top: 6px;
      }
      .section-table th,
      .section-table td {
        border: 1px solid #000;
        padding: 3px 4px;
        vertical-align: top;
      }
      .section-table th {
        text-align: center;
        background: #f1f1f1;
        font-size: 8.5px;
        text-transform: uppercase;
      }
      .row-title {
        font-weight: bold;
        text-transform: uppercase;
      }
      .row-subtitle {
        margin-top: 1px;
      }
      .total-table {
        margin-top: 4px;
      }
      .total-table td {
        border: 1px solid #000;
        padding: 4px 6px;
        font-weight: bold;
      }
      .total-label {
        text-transform: uppercase;
      }
      .text-center { text-align: center; }
      .notes {
        margin-top: 8px;
        font-size: 8px;
        line-height: 1.35;
      }
      .notes p {
        margin: 2px 0;
      }
      .signatures {
        margin-top: 34px;
        width: 100%;
        table-layout: fixed;
        border-collapse: collapse;
      }
      .signatures td {
        width: 33.33%;
        text-align: center;
        vertical-align: bottom;
        border: none;
        padding: 0 8px;
      }
      .signature-line {
        border-top: 1px solid #000;
        padding-top: 4px;
        margin-top: 38px;
        font-size: 8.5px;
        font-weight: bold;
      }
    </style>
  </head><body>
    <div class="page">
      <div class="title">HORARIO SEMANAL DE LA CARGA ACADEMICA DOCENTE (F03-CAD)</div>

      <table class="meta-table">
        <tr>
          <td style="width:50%;">
            <span class="meta-label">Facultad / Filial:</span>
            <span class="meta-value">${data.facultad}</span>
          </td>
          <td style="width:50%;">
            <span class="meta-label">Dpto. Academico:</span>
            <span class="meta-value">${data.departamento}</span>
          </td>
        </tr>
        <tr>
          <td style="width:18%;">
            <span class="meta-label">DNI</span>
            <span class="meta-value">${data.docente.dni || '________'}</span>
          </td>
          <td style="width:52%;">
            <span class="meta-label">Docente:</span>
            <span class="meta-value">${data.docente.nombre}</span>
          </td>
          <td style="width:18%;" class="text-center">
            <span class="meta-label">${getCategoriaDisplay(data.docente.categoria)}</span>
          </td>
          <td style="width:12%;" class="text-center">
            <span class="meta-label">${getModalidadDisplay(data.docente.modalidad, data.docente.horasContrato)}</span>
          </td>
        </tr>
        <tr>
          <td colspan="4">
            <span class="meta-label">Ano academico:</span>
            <span class="meta-value">${year}</span>
            <span class="meta-label" style="margin-left: 18px;">Semestre:</span>
            <span class="meta-value">${cycle}</span>
            <span class="meta-label" style="margin-left: 18px;">Fecha de Inicio:</span>
            <span class="meta-value">${formatShortDate(data.periodo.fechaInicio)}</span>
            <span class="meta-label" style="margin-left: 18px;">Fecha de termino:</span>
            <span class="meta-value">${formatShortDate(data.periodo.fechaFin)}</span>
          </td>
        </tr>
      </table>

      <table class="section-table">
        <thead>
          <tr>
            <th style="width:22%;">Horario</th>
            <th>Carga Horaria Lectiva (CHL)</th>
            <th style="width:10%;">Lugar</th>
            <th style="width:18%;">Aula</th>
            <th style="width:8%;">Total</th>
          </tr>
        </thead>
        <tbody>
          ${lectiveRowsHtml || '<tr><td colspan="5" class="text-center">No hay carga lectiva con horario registrado.</td></tr>'}
        </tbody>
      </table>

      <table class="section-table">
        <thead>
          <tr>
            <th style="width:22%;">Horario</th>
            <th>Carga Horaria No Lectiva (CHNL)</th>
            <th style="width:10%;">Lugar</th>
            <th style="width:18%;">Aula</th>
            <th style="width:8%;">Total</th>
          </tr>
        </thead>
        <tbody>
          ${noLectiveRowsHtml}
        </tbody>
      </table>

      <table class="total-table">
        <tr>
          <td class="total-label">TOTAL HORAS CARGA ACADEMICA</td>
          <td style="width:80px;" class="text-center">${totalGeneral}</td>
        </tr>
      </table>

      <div class="notes">
        <p><strong>T: TEORIA - P: PRACTICA - L: LABORATORIO</strong></p>
        <p><strong>LU</strong> (LUNES); <strong>MA</strong> (MARTES); <strong>MI</strong> (MIERCOLES); <strong>JU</strong> (JUEVES); <strong>VI</strong> (VIERNES); <strong>SA</strong> (SABADO); TIEMPO EN FORMATO DE 24 HORAS.</p>
        <p><strong>LUGAR:</strong> (${buildLugarLegend()})</p>
      </div>

      <table class="signatures">
        <tr>
          <td><div class="signature-line">FIRMA DEL DOCENTE</div></td>
          <td><div class="signature-line">FIRMA Y SELLO DEL DIRECTOR DE DPTO. ACADEMICO</div></td>
          <td><div class="signature-line">V°B° DECANO</div></td>
        </tr>
      </table>
    </div>
  </body></html>`;
}

export function templateFormatoN3Grid(data: FormatoN3Data): string {
  const matrix = buildFormatoN3GridMatrix(data);
  const cycle = getFormatoN3Cycle(data.periodo.nombre);
  const hours = Array.from({ length: 15 }, (_, index) => `${String(7 + index).padStart(2, '0')}:00`);
  const dailyTotals = N3_DIAS.reduce<Record<DiaSemana, number>>((acc, dia) => {
    acc[dia] = hours.filter((hora) => matrix[dia][hora]).length;
    return acc;
  }, {
    LUNES: 0,
    MARTES: 0,
    MIERCOLES: 0,
    JUEVES: 0,
    VIERNES: 0,
    SABADO: 0,
  });

  const rowsHtml = hours.map((hora) => {
    const cellsHtml = N3_DIAS.map((dia) => {
      const cell = matrix[dia][hora];
      if (!cell) {
        return `<td class="slot-empty"></td>`;
      }

      const style = N3_GRID_TYPE_STYLES[cell.tipo] || {
        bg: '#f3f4f6',
        border: '#d1d5db',
        text: '#111827',
      };

      return `
        <td style="background: ${style.bg}; border: 1px solid ${style.border}; color: ${style.text};">
          <div class="slot-card">
            <div class="slot-label">${cell.label}</div>
            ${cell.detail ? `<div class="slot-detail">${cell.detail}</div>` : ''}
          </div>
        </td>
      `;
    }).join('');

    return `
      <tr>
        <td class="hour-cell">${hora}</td>
        ${cellsHtml}
      </tr>
    `;
  }).join('');

  const legendHtml = Object.entries(N3_GRID_TYPE_STYLES).map(([tipo, style]) => `
    <div class="legend-item">
      <span class="legend-dot" style="background:${style.bg}; border-color:${style.border};"></span>
      <span>${tipo === 'TEORIA' || tipo === 'PRACTICA' || tipo === 'LABORATORIO' ? tipo : (N3_NO_LECTIVA_LABELS[tipo] || tipo)}</span>
    </div>
  `).join('');

  return `<!DOCTYPE html><html><head><meta charset="utf-8">
    <style>
      @page { size: A4 landscape; margin: 6mm; }
      * { box-sizing: border-box; }
      body { font-family: Arial, Helvetica, sans-serif; color: #111827; margin: 0; font-size: 8px; }
      .page { width: 100%; }
      h2 { text-align: center; margin: 0 0 2px 0; font-size: 12px; text-transform: uppercase; }
      h3 { text-align: center; margin: 0 0 8px 0; font-size: 9px; color: #374151; text-transform: uppercase; }
      .summary {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 6px 12px;
        margin-bottom: 8px;
        padding: 6px 8px;
        border: 1px solid #d1d5db;
        border-radius: 6px;
        background: #f9fafb;
      }
      .summary strong { color: #111827; }
      .grid-table { width: 100%; border-collapse: collapse; table-layout: fixed; }
      .grid-table th {
        border: 1px solid #d1d5db;
        background: #f3f4f6;
        padding: 5px 3px;
        font-size: 8px;
        text-transform: uppercase;
      }
      .grid-table td { border: 1px solid #e5e7eb; height: 38px; padding: 2px; vertical-align: top; }
      .hour-cell {
        width: 54px;
        text-align: center;
        font-weight: bold;
        background: #f9fafb;
        color: #4b5563;
      }
      .day-header small {
        display: block;
        margin-top: 1px;
        font-size: 7px;
        font-weight: normal;
        color: #6b7280;
      }
      .slot-empty { background: #fafafa; }
      .slot-card {
        min-height: 33px;
        border-radius: 4px;
        padding: 2px 3px;
      }
      .slot-label {
        font-size: 7.4px;
        font-weight: bold;
        line-height: 1.15;
      }
      .slot-detail {
        margin-top: 2px;
        font-size: 6.8px;
        line-height: 1.15;
      }
      .legend {
        margin-top: 8px;
        display: flex;
        flex-wrap: wrap;
        gap: 6px 10px;
        font-size: 7px;
      }
      .legend-item {
        display: inline-flex;
        align-items: center;
        gap: 4px;
      }
      .legend-dot {
        width: 10px;
        height: 10px;
        border: 1px solid;
        border-radius: 2px;
      }
      .signature-section {
        margin-top: 12px;
        display: flex;
        justify-content: space-between;
        gap: 20px;
      }
      .signature {
        width: 30%;
        text-align: center;
      }
      .signature .line {
        border-top: 1px solid #374151;
        margin-top: 28px;
        padding-top: 4px;
        font-size: 7.5px;
        font-weight: bold;
      }
    </style>
  </head><body>
    <div class="page">
      <h2>FORMATO 3</h2>
      <h3>HORARIO SEMANAL DEL DOCENTE - DISEÑO GRILLA</h3>

      <div class="summary">
        <div><strong>Docente:</strong> ${data.docente.nombre}</div>
        <div><strong>Codigo IBM:</strong> ${data.docente.codigoIBM || '___________'}</div>
        <div><strong>Facultad:</strong> ${data.facultad}</div>
        <div><strong>Departamento:</strong> ${data.departamento}</div>
        <div><strong>Periodo:</strong> ${data.periodo.nombre}</div>
        <div><strong>Semestre:</strong> ${cycle}</div>
        <div><strong>Del:</strong> ${data.periodo.fechaInicio || '___________'}</div>
        <div><strong>Al:</strong> ${data.periodo.fechaFin || '___________'}</div>
      </div>

      <table class="grid-table">
        <thead>
          <tr>
            <th style="width: 54px;">Hora</th>
            ${N3_DIAS.map((dia) => `<th class="day-header">${N3_DIA_LABELS[dia]}<small>${dailyTotals[dia]}h</small></th>`).join('')}
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>

      <div class="legend">${legendHtml}</div>

      <div class="signature-section">
        <div class="signature">
          <div class="line">Decano de la Facultad</div>
        </div>
        <div class="signature">
          <div class="line">Firma del Profesor</div>
        </div>
        <div class="signature">
          <div class="line">Jefe de Departamento</div>
        </div>
      </div>
    </div>
  </body></html>`;
}
