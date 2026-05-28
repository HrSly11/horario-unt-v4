const STYLES = `
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Times New Roman', Times, serif; color: #000; font-size: 11px; line-height: 1.4; }
    .page { padding: 15mm 10mm; }
    h2 { text-align: center; font-size: 14px; margin-bottom: 8px; text-transform: uppercase; }
    h3 { font-size: 12px; margin: 10px 0 5px; }
    table { width: 100%; border-collapse: collapse; margin: 8px 0; }
    th, td { border: 1px solid #000; padding: 3px 5px; font-size: 9px; }
    th { background: #f0f0f0; text-align: center; }
    .text-center { text-align: center; }
    .text-right { text-align: right; }
    .mt-10 { margin-top: 10px; }
    .mt-20 { margin-top: 20px; }
    .bold { font-weight: bold; }
    .signature-line { margin-top: 40px; display: flex; justify-content: space-between; }
    .signature { text-align: center; width: 30%; }
    .signature .line { border-top: 1px solid #000; margin-top: 40px; padding-top: 4px; }
    .section { margin: 6px 0; padding: 3px 0; }
    p { margin: 4px 0; }
  </style>
`;

interface FormatoN1Data {
  docente: { nombre: string; dni?: string | null; categoria: string; modalidad: string };
  periodo: string;
  facultad: string;
  departamento: string;
  asignaciones: { cursoCodigo: string; cursoNombre: string; grupo: string; tipo: string; horas: number }[];
  cargasNoLectivas: { tipo: string; horas: number; descripcion?: string | null }[];
  totalLectivas: number;
  totalNoLectivas: number;
}

export function templateFormatoN1(data: FormatoN1Data): string {
  const filasLectivas = data.asignaciones.map((a) => `
    <tr>
      <td>${a.cursoCodigo}</td>
      <td>${a.cursoNombre}</td>
      <td class="text-center">${a.grupo}</td>
      <td class="text-center">${a.tipo}</td>
      <td class="text-center">${a.horas}</td>
    </tr>
  `).join('');

  const filasNoLectivas = data.cargasNoLectivas.map((c) => `
    <tr>
      <td>${tipoLabel(c.tipo)}</td>
      <td class="text-center">${c.horas}</td>
      <td>${c.descripcion || ''}</td>
    </tr>
  `).join('');

  return `<!DOCTYPE html><html><head><meta charset="utf-8">${STYLES}</head><body>
    <div class="page">
      <h2>Formato N° 1<br>Declaración de Carga Horaria Asignada</h2>
      <p><strong>Facultad:</strong> ${data.facultad} | <strong>Departamento:</strong> ${data.departamento}</p>
      <p><strong>Docente:</strong> ${data.docente.nombre} | <strong>DNI:</strong> ${data.docente.dni || ''} | <strong>Categoría:</strong> ${data.docente.categoria} | <strong>Modalidad:</strong> ${data.docente.modalidad}</p>
      <p><strong>Periodo:</strong> ${data.periodo}</p>

      <h3>I. Trabajo Lectivo</h3>
      <table>
        <thead><tr><th>Código</th><th>Curso</th><th>Grupo</th><th>Tipo</th><th>Horas</th></tr></thead>
        <tbody>${filasLectivas || '<tr><td colspan="5" class="text-center">Sin asignaciones</td></tr>'}</tbody>
        <tfoot><tr><td colspan="4" class="text-right bold">Total Lectivas:</td><td class="text-center bold">${data.totalLectivas}</td></tr></tfoot>
      </table>

      <h3>II. Actividades No Lectivas</h3>
      <table>
        <thead><tr><th>Actividad</th><th>Horas</th><th>Descripción</th></tr></thead>
        <tbody>${filasNoLectivas || '<tr><td colspan="3" class="text-center">Sin actividades registradas</td></tr>'}</tbody>
        <tfoot><tr><td colspan="2" class="text-right bold">Total No Lectivas:</td><td class="text-center bold">${data.totalNoLectivas}</td></tr></tfoot>
      </table>

      <p class="bold mt-10">Total General: ${data.totalLectivas + data.totalNoLectivas} horas</p>

      <div class="signature-line">
        <div class="signature"><div class="line">${data.docente.nombre}<br>Docente</div></div>
        <div class="signature"><div class="line">Director de Departamento</div></div>
        <div class="signature"><div class="line">V° B° Decano</div></div>
      </div>
    </div>
  </body></html>`;
}

interface FormatoN23Data {
  docente: { nombre: string; dni?: string | null; codigoIBM?: string | null };
  periodo: string;
  facultad: string;
  departamento: string;
  modalidad: string;
}

export function templateFormatoN2(data: FormatoN23Data): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8">${STYLES}</head><body>
    <div class="page">
      <h2>Formato N° 2<br>Declaración Jurada — Sede Central</h2>
      <p><strong>Yo,</strong> ${data.docente.nombre}, identificado con DNI N° ${data.docente.dni || ''}, Código IBM ${data.docente.codigoIBM || ''}, docente del Departamento de ${data.departamento} de la Facultad de ${data.facultad}, en condición de ${data.modalidad}.</p>

      <p class="mt-10"><strong>DECLARO BAJO JURAMENTO:</strong></p>
      <p>1. Que la información contenida en el Formato N° 1 sobre mi carga horaria asignada para el periodo ${data.periodo} es veraz y completa.</p>
      <p>2. Que no tengo incompatibilidad horaria ni legal para el ejercicio de la docencia en la Universidad Nacional de Trujillo.</p>
      <p>3. Que en caso de tener Dedicación Exclusiva, no realizo actividades remuneradas en otra institución.</p>
      <p>4. Que conozco las sanciones administrativas y penales aplicables en caso de falsedad en la presente declaración.</p>

      <div class="signature-line mt-20">
        <div class="signature"><div class="line">${data.docente.nombre}<br>DNI: ${data.docente.dni || ''}</div></div>
      </div>
      <p class="mt-10">Trujillo, ___ de ___________ de 2026</p>
    </div>
  </body></html>`;
}

export function templateFormatoN3(data: FormatoN23Data): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8">${STYLES}</head><body>
    <div class="page">
      <h2>Formato N° 3<br>Declaración Jurada — Sedes Descentralizadas</h2>
      <p><strong>Yo,</strong> ${data.docente.nombre}, identificado con DNI N° ${data.docente.dni || ''}, docente del Departamento de ${data.departamento} de la Facultad de ${data.facultad}.</p>

      <p class="mt-10"><strong>DECLARO BAJO JURAMENTO:</strong></p>
      <p>1. Que para el periodo ${data.periodo}, cumplo con los requisitos establecidos por la normativa de sedes descentralizadas de la UNT.</p>
      <p>2. Que mi carga horaria en sede descentralizada no excede las ${data.modalidad === 'DEDICACION_EXCLUSIVA' ? '40 horas semanales' : 'horas establecidas en mi contrato'} contemplando traslados.</p>
      <p>3. Que me comprometo a cumplir con el horario establecido en la sede asignada, garantizando la calidad académica.</p>
      <p>4. Que conozco el Reglamento de Sedes Descentralizadas y acepto sus disposiciones.</p>
      <p>5. Que autorizo la verificación de la presente declaración por las autoridades competentes.</p>

      <div class="signature-line mt-20">
        <div class="signature"><div class="line">${data.docente.nombre}<br>DNI: ${data.docente.dni || ''}</div></div>
      </div>
      <p class="mt-10">Trujillo, ___ de ___________ de 2026</p>
    </div>
  </body></html>`;
}

function tipoLabel(tipo: string): string {
  const labels: Record<string, string> = {
    PREPARACION_EVALUACION: 'Preparación y Evaluación',
    CONSEJERIA: 'Consejería',
    INVESTIGACION: 'Investigación',
    CAPACITACION: 'Capacitación',
    GOBIERNO: 'Gobierno',
    ADMINISTRACION: 'Administración',
    ASESORIA_TESIS: 'Asesoría de Tesis',
    RESPONSABILIDAD_SOCIAL: 'Resp. Social',
    COMITES_COMISIONES: 'Comités/Comisiones',
  };
  return labels[tipo] || tipo;
}
