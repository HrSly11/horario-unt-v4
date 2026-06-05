// ──── Helpers ────────────────────────────────────────────

const DIA_ABREV: Record<string, string> = {
  LUNES: 'LU', MARTES: 'MA', MIERCOLES: 'MI', JUEVES: 'JU', VIERNES: 'VI', SABADO: 'SA',
};

const LUGAR_LABELS: Record<string, string> = {
  F01: 'CC. Agropecuarias', F02: 'CC. Biológicas', F03: 'CC. Económicas',
  F04: 'CC. Físicas y Matemáticas', F05: 'CC. Sociales', F06: 'Derecho y Ciencias Políticas',
  F07: 'Educación y CC. Comunicación', F08: 'Enfermería', F09: 'Estomatología',
  F10: 'Farmacia y Bioquímica', F11: 'Ingeniería', F12: 'Ingeniería Química', F13: 'Medicina',
};

const TIPO_LABELS: Record<string, string> = {
  PREPARACION_EVALUACION: 'Preparación y Evaluación',
  CONSEJERIA: 'Tutoría y Consejería',
  INVESTIGACION: 'Investigación',
  CAPACITACION: 'Formación Académica y Capacitación',
  GOBIERNO: 'Actividades de Gobierno o Autoridad',
  ADMINISTRACION: 'Actividades de Administración',
  ASESORIA_TESIS: 'Asesoría de Tesis y Exámenes Profesionales',
  RESPONSABILIDAD_SOCIAL: 'Responsabilidad Social Universitaria',
  COMITES_COMISIONES: 'Comités o Comisiones Especiales',
};

const TIPO_NUMERO: Record<string, number> = {
  PREPARACION_EVALUACION: 2,
  CONSEJERIA: 3,
  INVESTIGACION: 4,
  CAPACITACION: 5,
  GOBIERNO: 6,
  ADMINISTRACION: 7,
  ASESORIA_TESIS: 8,
  RESPONSABILIDAD_SOCIAL: 9,
  COMITES_COMISIONES: 10,
};

const TIPO_INSTRUCCIONES: Record<string, string> = {
  PREPARACION_EVALUACION: 'Max 50% de Trabajo Lectivo',
  CONSEJERIA: 'Señalar número de alumnos y el ciclo académico con los que se desarrolla. (Como mínimo una 01 hora semanal).',
  INVESTIGACION: 'Consignar el N° de inscripción, código, nombre y duración del proyecto. (Como mínimo 04 y 05 horas semanales, según modalidad de trabajo de docentes ordinarios).',
  CAPACITACION: 'Señale lo referente a este rubro en el marco de los planes de cada Facultad (como máximo 05 semanales).',
  GOBIERNO: 'Si desempeña cargo indique.',
  ADMINISTRACION: 'Si desempeña cargo indique.',
  ASESORIA_TESIS: 'Indicar el número de Resolución Decanal, precisando el nombre y duración de la actividad programada.',
  RESPONSABILIDAD_SOCIAL: 'Señalar actividad, proyecto programa a ejecutarse n beneficio de la comunidad local o regional. (Como máximo 02 horas semanales)',
  COMITES_COMISIONES: 'Consignar el número de Resolución autoritativa indicando el lapso de vigencia.',
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

// ──── Styles ─────────────────────────────────────────────

const STYLES_N1 = `
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Times New Roman', Times, serif; color: #000; font-size: 10px; line-height: 1.3; }
    .page { padding: 10mm 8mm; }
    h2 { text-align: center; font-size: 13px; margin-bottom: 4px; text-transform: uppercase; font-weight: bold; }
    table { width: 100%; border-collapse: collapse; margin: 4px 0; }
    th, td { border: 1px solid #000; padding: 2px 4px; font-size: 9px; vertical-align: top; }
    th { background: #e8e8e8; text-align: center; font-weight: bold; }
    .text-center { text-align: center; }
    .text-right { text-align: right; }
    .bold { font-weight: bold; }
    .no-border { border: none; }
    .no-border td { border: none; padding: 1px 4px; }
    .section-header td { background: #f0f0f0; font-weight: bold; }
    .total-row td { background: #d0e0ff; font-weight: bold; }
    .signature-section { margin-top: 20px; display: flex; justify-content: space-between; }
    .signature { text-align: center; width: 30%; }
    .signature .line { border-top: 1px solid #000; margin-top: 50px; padding-top: 4px; font-size: 9px; }
    .leyenda { font-size: 8px; margin-top: 8px; line-height: 1.4; }
    .info-table { margin-bottom: 6px; }
    .info-table td { font-size: 10px; }
  </style>
`;

const STYLES_JURADA = `
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Times New Roman', Times, serif; color: #000; font-size: 12px; line-height: 1.6; }
    .page { padding: 15mm 15mm; }
    h2 { text-align: center; font-size: 14px; margin-bottom: 8px; text-transform: uppercase; font-weight: bold; }
    h3 { text-align: center; font-size: 12px; margin-bottom: 15px; text-transform: uppercase; font-weight: bold; }
    p { margin: 6px 0; text-align: justify; }
    .indent { text-indent: 2em; }
    .bold-italic { font-weight: bold; font-style: italic; }
    .mt-10 { margin-top: 10px; }
    .mt-20 { margin-top: 20px; }
    .mt-30 { margin-top: 30px; }
    .text-right { text-align: right; }
    .text-center { text-align: center; }
    .signature { text-align: center; margin-top: 60px; }
    .signature .line { border-top: 1px solid #000; display: inline-block; width: 250px; padding-top: 4px; }
    .nota { font-size: 10px; margin-top: 30px; }
    .strong-caps { font-weight: bold; text-transform: uppercase; }
  </style>
`;

// ──── Formato N°1 — Declaración de Carga Horaria Asignada ─────────

export interface FormatoN1Data {
  docente: {
    nombre: string;
    dni?: string | null;
    codigoIBM?: string | null;
    categoria: string;
    tipo: string;
    modalidad: string;
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
    horarios?: { dia: string; horaInicio: string; horaFin: string; lugar?: string | null; aula?: string | null }[];
  }[];
  totalLectivas: number;
  totalNoLectivas: number;
}

export function templateFormatoN1(data: FormatoN1Data): string {
  // Section I: Teaching load table
  const filasLectivas = data.asignaciones.map((a) => {
    const htStr = a.horasTeoria > 0 ? `${a.horasTeoria} x 1` : '0 x 1';
    const hpStr = a.horasPractica > 0 ? `${a.horasPractica} x 1` : '0 x 1';
    const hlStr = a.horasLaboratorio > 0 ? `${a.horasLaboratorio} x ${a.horasLaboratorio}` : '0 x 0';
    const total = a.horasTeoria + a.horasPractica + a.horasLaboratorio;
    return `
      <tr>
        <td class="text-center">${a.cursoCodigo}</td>
        <td>${a.cursoNombre.length > 25 ? a.cursoNombre.substring(0, 25) + '...' : a.cursoNombre}</td>
        <td class="text-center">${a.grupo}</td>
        <td class="text-center">${a.escuelaProf}</td>
        <td class="text-center">${a.ciclo}</td>
        <td class="text-center">${a.seccion || 'A'}</td>
        <td class="text-center">${a.numAlumnos}</td>
        <td class="text-center">${htStr}</td>
        <td class="text-center">${hpStr}</td>
        <td class="text-center">${hlStr}</td>
        <td class="text-center bold">${total}</td>
      </tr>
    `;
  }).join('');

  // Section II: Non-teaching activities (numbered 2-10)
  const allTipos = [
    'PREPARACION_EVALUACION', 'CONSEJERIA', 'INVESTIGACION', 'CAPACITACION',
    'GOBIERNO', 'ADMINISTRACION', 'ASESORIA_TESIS', 'RESPONSABILIDAD_SOCIAL',
    'COMITES_COMISIONES',
  ];
  const filasNoLectivas = allTipos.map((tipo) => {
    const carga = data.cargasNoLectivas.find((c) => c.tipo === tipo);
    const num = TIPO_NUMERO[tipo];
    const instruccion = TIPO_INSTRUCCIONES[tipo];
    return `
      <tr>
        <td class="bold">${num}. ${instruccion}</td>
        <td>${carga?.descripcion || ''}</td>
        <td class="text-center bold">${carga?.horas || 0}</td>
      </tr>
    `;
  }).join('');

  // Non-teaching schedule table
  const horarioRows = data.cargasNoLectivas
    .filter((c) => c.horarios && c.horarios.length > 0)
    .flatMap((c) => {
      return (c.horarios || []).map((h) => {
        const diaAbrev = DIA_ABREV[h.dia] || h.dia;
        const horarioStr = `${diaAbrev}(${h.horaInicio}-${h.horaFin})`;
        return `
          <tr>
            <td>${horarioStr}</td>
            <td>${TIPO_LABELS[c.tipo] || c.tipo}</td>
            <td class="text-center">${h.lugar || ''}</td>
            <td>${h.aula || ''}</td>
            <td class="text-center">${c.horas}</td>
          </tr>
        `;
      });
    }).join('');

  // Combine horarios by tipo for display
  const totalGeneral = data.totalLectivas + data.totalNoLectivas;

  const fechaInicio = data.periodo.fechaInicio || '';
  const fechaFin = data.periodo.fechaFin || '';

  return `<!DOCTYPE html><html><head><meta charset="utf-8">${STYLES_N1}</head><body>
    <div class="page">
      <h2>Formato N° 1<br>Declaración de Carga Horaria Asignada</h2>

      <!-- Section I: Professor Data -->
      <table class="info-table no-border">
        <tr>
          <td><strong>I. DATOS SOBRE LA SITUACIÓN DEL PROFESOR:</strong></td>
          <td></td>
        </tr>
        <tr>
          <td>FACULTAD:</td>
          <td><strong>${data.facultad}</strong></td>
        </tr>
        <tr>
          <td>DPTO. ACADÉMICO:</td>
          <td><strong>${data.departamento}</strong></td>
        </tr>
      </table>

      <table>
        <tr>
          <th>NOMBRE COMPLETO</th>
          <th>CONDICIÓN</th>
          <th>CATEGORÍA</th>
          <th>MODALIDAD</th>
        </tr>
        <tr>
          <td class="bold">${data.docente.nombre}</td>
          <td class="text-center">${CONDICION_LABELS[data.docente.tipo] || data.docente.tipo}</td>
          <td class="text-center">${CATEGORIA_LABELS[data.docente.categoria] || data.docente.categoria}</td>
          <td class="text-center">${MODALIDAD_LABELS[data.docente.modalidad] || data.docente.modalidad}</td>
        </tr>
      </table>

      <table class="no-border">
        <tr>
          <td><strong>AÑO ACADÉMICO:</strong> ${data.anioAcademico}</td>
          <td><strong>CICLO(SEM):</strong> ${data.cicloSemestre}</td>
          <td><strong>INICIO:</strong> ${fechaInicio}</td>
          <td><strong>FINAL:</strong> ${fechaFin}</td>
        </tr>
      </table>

      <!-- Section: Teaching Load -->
      <table>
        <tr class="section-header">
          <td colspan="11">1. TRABAJO LECTIVO.- Datos completos y con claridad</td>
        </tr>
        <tr>
          <th>CÓDIGO</th>
          <th>NOMBRE DEL CURSO</th>
          <th>CUR.</th>
          <th>ESCUELA PROF.</th>
          <th>CIC.</th>
          <th>SEC.</th>
          <th>N° AL.</th>
          <th>H.T.</th>
          <th>H.P.</th>
          <th>H.L.</th>
          <th>Total</th>
        </tr>
        ${filasLectivas || '<tr><td colspan="11" class="text-center">Sin asignaciones lectivas</td></tr>'}
      </table>

      <!-- Section: Non-Teaching Activities -->
      <table>
        ${filasNoLectivas}
        <tr class="total-row">
          <td colspan="2" class="text-right">TOTAL</td>
          <td class="text-center">${totalGeneral}</td>
        </tr>
      </table>

      <!-- Section: Non-Teaching Schedule -->
      ${horarioRows ? `
      <table>
        <tr>
          <th>HORARIO</th>
          <th>CARGA HORARIA NO LECTIVA (CHNL)</th>
          <th>LUGAR</th>
          <th>AULA</th>
          <th>TOTAL</th>
        </tr>
        ${horarioRows}
        <tr class="total-row">
          <td colspan="4" class="text-right">TOTAL HORAS CARGA ACADÉMICA</td>
          <td class="text-center">${totalGeneral}</td>
        </tr>
      </table>
      ` : ''}

      <!-- Legend -->
      <div class="leyenda">
        <p><strong>T: TEORÍA - P: PRÁCTICA</strong></p>
        <p>LU (LUNES), MA (MARTES), MI (MIÉRCOLES), JU (JUEVES), VI (VIERNES), SA (SÁBADO) — EN FORMATO DE 24 HORAS</p>
        <p><strong>LUGAR:</strong> ${Object.entries(LUGAR_LABELS).map(([k, v]) => `${k}: "${v}"`).join(', ')}</p>
      </div>

      <!-- Signatures -->
      <div class="signature-section">
        <div class="signature"><div class="line">Firma del Profesor</div></div>
        <div class="signature"><div class="line">Firma del Director de Dpto.</div></div>
        <div class="signature"><div class="line">V° B° DECANO FAC.</div></div>
      </div>
    </div>
  </body></html>`;
}

// ──── Formato N°2 — Declaración Jurada de No Estar Incurso ────────

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
  const fecha = data.fecha || `___ de ___________ del ${new Date().getFullYear()}`;
  const horasContrato = data.modalidad === 'TIEMPO_COMPLETO' ? '40 H' : data.modalidad === 'DEDICACION_EXCLUSIVA' ? '40 H' : '20 H';

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

// ──── Formato N°3 — Declaración Jurada Sedes Descentralizadas ─────

export function templateFormatoN3(data: FormatoN23Data): string {
  const fecha = data.fecha || `___ de ___________ del ${new Date().getFullYear()}`;

  return `<!DOCTYPE html><html><head><meta charset="utf-8">${STYLES_JURADA}</head><body>
    <div class="page">
      <h2>Declaración Jurada de los Docentes que Prestan Servicios en Sedes Descentralizadas</h2>

      <p class="indent">
        Yo, <strong>${data.docente.nombre}</strong> identificado con DNI. Nro ${data.docente.dni || '___________'} con Código IBM Nro ${data.docente.codigoIBM || '___________'} del
        Departamento Académico Dpto. de ${data.departamento} Facultad de ${data.facultad}; en el marco del reglamento de
        funcionamiento de Sedes Descentralizadas (RCU Nro 072 CU-COG-2005/UNT) y la Directiva Nro 01-2007-VAC/UNT
        sobre Racionalización Académica del Personal Docentes que labora en las Sedes descentralizadas (R.C.U. Nro
        576-2007/UNT) DECLARO BAJO JURAMENTO Y EN HONOR A LA VERDAD QUE:
      </p>

      <p class="indent mt-10 strong-caps">
        EN MI PRESTACIÓN DE SERVICIOS EN SEDES DESCENTRALIZADAS NO ESTOY INCURSO EN
        INCOMPATIBILIDAD HORARIA NI CONTRAVENGO LA SIGUIENTE NORMATIVIDAD INSTITUCIONAL:
      </p>

      <p class="indent mt-10">
        Los docentes ordinarios a Dedicación Exclusiva y Tiempo Completo solo pueden tener carga horaria máxima de diez (10)
        horas semanales (num. 1 de la Directiva).
      </p>

      <p class="indent mt-10">
        Los docentes que ejercen cargos académicos y administrativos de: Jefe de Departamento Académico, Director de Escuela
        Académico Profesional, Director de Sección de Postgrado, Profesor Secretario de Facultad. Jefe de Oficina General, o cargos
        Directivos en Centros de Producción o líneas de Rentabilidad pueden asumir carga máxima de 05 horas semanales, siempre
        que sea en forma excepcional y por no contar con docente de la especialidad habilitada para asumir dicha carga. (num. 2 y 3
        de la Directiva RCU Nro 005-2009/UNT y art.23 del Reglamento).
      </p>

      <p class="indent mt-10">
        Los docentes que ejercen cargo de Decano o Director de Postgrado y aquellos que prestan servicios en Centros de Producción
        y línea de Rentabilidad no pueden asumir carga horaria en Sedes Descentralizadas. (num. 3 de la Directiva ya art 23 del
        Reglamento).
      </p>

      <p class="indent mt-10">
        Los docentes beneficiados con becas de estudio de maestría o doctorado o Segunda especialidad solo pueden tener carga
        horaria máxima de tres (03) horas semanales. (num. 4 de la Directiva).
      </p>

      <p class="indent mt-10">
        El desarrollo de la carga en sede descentralizada no puede inferir con la carga lectiva y no lectiva asignada en la Sede
        Central; salvo el caso de las Sedes de Cascas, Huamachuco, Tayabamba y Santiago de Chuco en que se debe contar con
        Licencia por comisión de servicios y carta de compromiso del docente que asumirá la carga horaria en la Sede Central (num.
        5 y 7 de la Directiva y art. 23 del Reglamento).
      </p>

      <p class="indent mt-10">
        Los docentes que asumen carga horaria en las Sedes de Huamachuco, Cascas, Santiago de Chuco y Tayabamba no pueden
        asumir labores labores durante el mismo periodo en otra Sede (num. 6 de la Directiva).
      </p>

      <p class="indent mt-10">
        En caso de faltar a la verdad así como de incurrir en incompatibilidad horaria contraviniendo los dispositivos pre-citados me
        avengo a las sanciones que correspondan,
      </p>
      <p class="bold-italic">
        y autorizo al funcionario competente disponga el descuento del pago por mis servicios en Sedes Descentralizadas,
        conforme al monto que la unidad de remuneraciones liquide como pago indebido por el periodo ilegalmente laborado.
      </p>

      <p class="text-right mt-30">Trujillo, ${fecha}</p>

      <div class="signature">
        <div class="line">
          FIRMA DEL DECLARANTE<br>
          DNI: ${data.docente.dni || '___________'}
        </div>
      </div>

      <p class="nota">
        Nota: Los docentes deben suscribir de forma obligatoria el presente formato para prestar servicios en cada Sede
        Descentralizada, al reverso de la Declaración de la Carga Horaria
      </p>
    </div>
  </body></html>`;
}
