/**
 * PDF Report Templates — HTML generators for Puppeteer rendering.
 *
 * Two report types:
 * 1. Operational: Schedule by aula, lab, or docente
 * 2. Management: Executive summary with stats
 */

const STYLES = `
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Times New Roman', Times, serif;
      color: #000;
      font-size: 10px;
      line-height: 1.1;
      background: white;
    }
    .page { 
      page-break-after: always; 
      width: 100%;
      padding: 5mm;
      position: relative;
    }
    .page:last-child { page-break-after: auto; }

    /* Institutional Header */
    .inst-header {
      width: 100%;
      margin-bottom: 10px;
      border-bottom: 1px solid #000;
      padding-bottom: 5px;
    }
    .inst-header table {
      width: 100%;
      border-collapse: collapse;
    }
    .inst-header td {
      vertical-align: top;
      padding: 1px 0;
    }
    .inst-title {
      text-transform: uppercase;
      font-weight: bold;
      font-size: 12px;
      text-align: center;
      margin-bottom: 5px;
    }
    .inst-info-label {
      font-weight: bold;
      width: 140px;
      display: inline-block;
    }

    /* Main Grid Table */
    .schedule-grid {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
      margin-bottom: 15px;
    }
    .schedule-grid th, .schedule-grid td {
      border: 1px solid #000;
      text-align: center;
      padding: 2px;
    }
    .schedule-grid th {
      background: #f0f0f0;
      font-weight: bold;
      text-transform: uppercase;
      font-size: 9px;
    }
    .hora-col { width: 80px; font-weight: bold; background: #f0f0f0; }
    .day-col { width: calc((100% - 80px) / 6); }

    /* Audit Report Specific */
    .audit-table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 20px;
    }
    .audit-table th, .audit-table td {
      border: 1px solid #ddd;
      padding: 8px;
      text-align: left;
      font-size: 9px;
    }
    .audit-table th {
      background-color: #f8fafc;
      color: #475569;
      font-weight: bold;
      text-transform: uppercase;
    }
    .audit-table tr:nth-child(even) {
      background-color: #fcfcfc;
    }
    .badge {
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 8px;
      font-weight: bold;
      text-transform: uppercase;
    }
    .badge-login { background: #dcfce7; color: #166534; }
    .badge-critical { background: #fee2e2; color: #991b1b; }
    .badge-default { background: #f1f5f9; color: #475569; }
    
    .slot-box {
      font-size: 8px;
      height: 100%;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      overflow: hidden;
      border-radius: 2px;
    }
    
    /* Subtle colors for course visualization */
    .color-1 { background-color: #e0f2fe; }
    .color-2 { background-color: #f0fdf4; }
    .color-3 { background-color: #fefce8; }
    .color-4 { background-color: #faf5ff; }
    .color-5 { background-color: #fff1f2; }
    .color-6 { background-color: #ecfeff; }
    .color-7 { background-color: #f0f9ff; }
    .color-8 { background-color: #f5f3ff; }
    .color-9 { background-color: #fdf2f8; }
    .color-10 { background-color: #fff7ed; }

    .slot-correlativo { font-weight: bold; font-size: 7px; margin-bottom: 1px; color: #444; }
    .slot-curso { font-weight: bold; text-transform: uppercase; }
    .slot-tipo { font-style: italic; }

    /* Detail Tables */
    .detail-section {
      margin-top: 10px;
    }
    .detail-title {
      font-weight: bold;
      text-decoration: underline;
      margin-bottom: 5px;
      font-size: 10px;
    }
    .detail-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 9px;
    }
    .detail-table th, .detail-table td {
      border: 1px solid #000;
      padding: 3px 5px;
      text-align: left;
    }
    .detail-table th {
      background: #f0f0f0;
      font-weight: bold;
    }
    .text-center { text-align: center !important; }
    .text-right { text-align: right !important; }

    /* Summary / Footer */
    .summary-grid {
      display: flex;
      justify-content: space-between;
      margin-top: 15px;
    }
    .summary-box {
      border: 1px solid #000;
      padding: 5px;
      min-width: 200px;
    }
    .footer-line {
      position: absolute;
      bottom: 0;
      width: 100%;
      text-align: right;
      font-size: 7px;
      font-style: italic;
    }
  </style>
`;

const DIAS_ORDER = ['LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO'] as const;
const DIAS_LABELS: Record<string, string> = {
  LUNES: 'LUNES', MARTES: 'MARTES', MIERCOLES: 'MIÉRCOLES',
  JUEVES: 'JUEVES', VIERNES: 'VIERNES', SABADO: 'SÁBADO',
};

const HORAS = [
  '07:00', '08:00', '09:00', '10:00', '11:00', '12:00', '13:00',
  '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00',
];

interface SlotData {
  dia: string;
  horaInicio: string;
  cursoCodigo: string;
  cursoNombre: string;
  grupoNombre: string;
  docenteNombre: string;
  docenteCodigo?: string;
  aulaCodigo: string;
  aulaNombre: string;
  tipo: 'TEORIA' | 'PRACTICA' | 'LABORATORIO';
  ciclo: number;
  horasTeoria: number;
  horasPractica: number;
  horasLaboratorio: number;
  departamento?: string;
}

interface AulaReportData {
  aulaCodigo: string;
  aulaNombre: string;
  tipo: string;
  capacidad: number;
  slots: SlotData[];
}

interface DocenteReportData {
  docenteNombre: string;
  docenteCodigo?: string;
  tipo: string;
  categoria: string;
  antiguedad: string;
  slots: SlotData[];
}

interface CicloReportData {
  ciclo: number;
  seccion: string;
  periodoNombre: string;
  fechaInicio?: string;
  fechaFin?: string;
  slots: SlotData[];
}

function institutionalHeader(title: string, info: Record<string, string>): string {
  return `
    <div class="inst-header">
      <div class="inst-title">Universidad Nacional de Trujillo</div>
      <div class="inst-title" style="font-size: 11px;">Facultad de Ingeniería — Escuela Profesional de Ingeniería de Sistemas</div>
      <div class="inst-title" style="font-size: 10px; border-bottom: 1px double #000; padding-bottom: 3px; margin-bottom: 8px;">${title}</div>
      <table>
        <tr>
          <td>
            ${Object.entries(info).slice(0, Math.ceil(Object.keys(info).length / 2)).map(([label, value]) => `
              <div><span class="inst-info-label">${label}:</span> ${value}</div>
            `).join('')}
          </td>
          <td>
            ${Object.entries(info).slice(Math.ceil(Object.keys(info).length / 2)).map(([label, value]) => `
              <div><span class="inst-info-label">${label}:</span> ${value}</div>
            `).join('')}
          </td>
        </tr>
      </table>
    </div>
  `;
}

function renderScheduleGrid(slots: SlotData[], options: { showDocente?: boolean; showAula?: boolean; showCiclo?: boolean } = {}): string {
  const renderedCells = new Set<string>();
  
  // Pre-calculate correlation numbers and colors
  const uniqueCombos = new Map<string, number>();
  const courseColors = new Map<string, string>();
  let correlativo = 1;
  let colorIdx = 1;

  // Stable mapping for colors based on course code
  const uniqueCourses = [...new Set(slots.map(s => s.cursoCodigo))].sort();
  uniqueCourses.forEach(code => {
    courseColors.set(code, `color-${(colorIdx % 10) || 10}`);
    colorIdx++;
  });
  
  return `
    <table class="schedule-grid">
      <thead>
        <tr>
          <th class="hora-col">HORA</th>
          ${DIAS_ORDER.map(dia => `<th class="day-col">${DIAS_LABELS[dia]}</th>`).join('')}
        </tr>
      </thead>
      <tbody>
        ${HORAS.map((hora, rowIndex) => {
          const nextHora = HORAS[rowIndex + 1] || '21:00';
          return `
            <tr>
              <td class="hora-col">${hora} - ${nextHora}</td>
              ${DIAS_ORDER.map(dia => {
                const key = `${dia}-${hora}`;
                if (renderedCells.has(key)) return '';

                const slot = slots.find(s => s.dia === dia && s.horaInicio === hora);
                if (!slot) return '<td></td>';

                // Find consecutive blocks
                let rowSpan = 1;
                for (let i = rowIndex + 1; i < HORAS.length; i++) {
                  const currentBlockHora = HORAS[i];
                  const sameSlot = slots.find(s => 
                    s.dia === dia && 
                    s.horaInicio === currentBlockHora && 
                    s.cursoCodigo === slot.cursoCodigo && 
                    s.grupoNombre === slot.grupoNombre &&
                    s.tipo === slot.tipo
                  );
                  if (sameSlot) {
                    rowSpan++;
                    renderedCells.add(`${dia}-${currentBlockHora}`);
                  } else {
                    break;
                  }
                }

                const comboKey = `${slot.cursoCodigo}-${slot.grupoNombre}-${slot.tipo}`;
                if (!uniqueCombos.has(comboKey)) uniqueCombos.set(comboKey, correlativo++);
                const nro = uniqueCombos.get(comboKey);
                const colorClass = courseColors.get(slot.cursoCodigo) || '';

                return `
                  <td rowspan="${rowSpan}" class="${colorClass}">
                    <div class="slot-box">
                      <div class="slot-correlativo">(${nro})</div>
                      <div class="slot-curso">${slot.cursoCodigo} - G${slot.grupoNombre}</div>
                      ${options.showDocente ? `<div class="slot-docente">${slot.docenteNombre.split(' ').slice(0, 2).join(' ')}</div>` : ''}
                      ${options.showAula ? `<div class="slot-aula">${slot.aulaCodigo}</div>` : ''}
                      ${options.showCiclo ? `<div class="slot-ciclo">Ciclo: ${slot.ciclo}</div>` : ''}
                      <div class="slot-tipo">${slot.tipo.charAt(0)}</div>
                    </div>
                  </td>
                `;
              }).join('')}
            </tr>
          `;
        }).join('')}
      </tbody>
    </table>
  `;
}

// ─── REPORT GENERATORS ──────────────────────────────

export function generateAulaReportHTML(aulas: AulaReportData[], periodoNombre: string): string {
  const pages = aulas.map(aula => {
    const info = {
      'UNIVERSIDAD': 'UNIVERSIDAD NACIONAL DE TRUJILLO',
      'FACULTAD': 'FACULTAD DE INGENIERÍA',
      'ESCUELA PROFESIONAL': 'INGENIERÍA DE SISTEMAS',
      'SEDE': 'TRUJILLO',
      'AÑO ACADÉMICO': periodoNombre.split('-')[0],
      'SEMESTRE': periodoNombre,
      'AULA / LABORATORIO': `${aula.aulaCodigo} - ${aula.aulaNombre}`,
      'AFORO': `${aula.capacidad} vacantes`,
      'TIPO': aula.tipo
    };

    // Get unique courses for the detail table
    const uniqueCourses = Array.from(new Map(aula.slots.map(s => [`${s.cursoCodigo}-${s.grupoNombre}-${s.tipo}`, s])).values());

    return `
      <div class="page">
        ${institutionalHeader('HORARIO DE CLASES POR AMBIENTE ACADÉMICO', info)}
        ${renderScheduleGrid(aula.slots, { showDocente: true, showCiclo: true })}
        
        <div class="detail-section">
          <div class="detail-title">DETALLE DE ASIGNACIONES EN ESTE AMBIENTE:</div>
          <table class="detail-table">
            <thead>
              <tr>
                <th style="width: 30px;">N°</th>
                <th style="width: 60px;">Código</th>
                <th>Curso</th>
                <th>Docente</th>
                <th style="width: 40px;" class="text-center">Grup.</th>
                <th style="width: 30px;" class="text-center">T</th>
                <th style="width: 30px;" class="text-center">P</th>
                <th style="width: 30px;" class="text-center">L</th>
                <th style="width: 40px;" class="text-center">Total</th>
              </tr>
            </thead>
            <tbody>
              ${uniqueCourses.map((s, i) => `
                <tr>
                  <td class="text-center">${i + 1}</td>
                  <td>${s.cursoCodigo}</td>
                  <td>${s.cursoNombre}</td>
                  <td>${s.docenteNombre}</td>
                  <td class="text-center">${s.grupoNombre}</td>
                  <td class="text-center">${s.tipo === 'TEORIA' ? s.horasTeoria : '-'}</td>
                  <td class="text-center">${s.tipo === 'PRACTICA' ? s.horasPractica : '-'}</td>
                  <td class="text-center">${s.tipo === 'LABORATORIO' ? s.horasLaboratorio : '-'}</td>
                  <td class="text-center">${s.horasTeoria + s.horasPractica + s.horasLaboratorio}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
        <div class="footer-line">Documento oficial generado por el Sistema de Gestión de Horarios - UNT</div>
      </div>
    `;
  }).join('');

  return `<!DOCTYPE html><html><head>${STYLES}</head><body>${pages}</body></html>`;
}

export function generateCicloReportHTML(ciclos: CicloReportData[], periodoNombre: string): string {
  const pages = ciclos.map(c => {
    const info = {
      'UNIVERSIDAD': 'UNIVERSIDAD NACIONAL DE TRUJILLO',
      'FACULTAD': 'FACULTAD DE INGENIERÍA',
      'ESCUELA PROFESIONAL': 'INGENIERÍA DE SISTEMAS',
      'CICLO': `${c.ciclo}° CICLO`,
      'SECCIÓN': c.seccion,
      'AÑO ACADÉMICO': periodoNombre.split('-')[0],
      'SEMESTRE': periodoNombre,
      'INICIO DEL CICLO': c.fechaInicio || '---',
      'TÉRMINO DEL CICLO': c.fechaFin || '---'
    };

    const uniqueCourses = Array.from(new Map(c.slots.map(s => [`${s.cursoCodigo}-${s.grupoNombre}-${s.tipo}`, s])).values());

    return `
      <div class="page">
        ${institutionalHeader('HORARIO ACADÉMICO POR CICLO Y SECCIÓN', info)}
        ${renderScheduleGrid(c.slots, { showDocente: true, showAula: true })}
        
        <div class="detail-section">
          <div class="detail-title">LEYENDA DE CURSOS Y DOCENTES:</div>
          <table class="detail-table">
            <thead>
              <tr>
                <th style="width: 30px;">N°</th>
                <th style="width: 60px;">Código</th>
                <th>Curso</th>
                <th>Docente</th>
                <th style="width: 40px;" class="text-center">Grup.</th>
                <th style="width: 30px;" class="text-center">T</th>
                <th style="width: 30px;" class="text-center">P</th>
                <th style="width: 30px;" class="text-center">L</th>
                <th>Aula/Lab</th>
                <th>Dpto. Académico</th>
              </tr>
            </thead>
            <tbody>
              ${uniqueCourses.map((s, i) => `
                <tr>
                  <td class="text-center">${i + 1}</td>
                  <td>${s.cursoCodigo}</td>
                  <td>${s.cursoNombre}</td>
                  <td>${s.docenteNombre}</td>
                  <td class="text-center">${s.grupoNombre}</td>
                  <td class="text-center">${s.horasTeoria}</td>
                  <td class="text-center">${s.horasPractica || '-'}</td>
                  <td class="text-center">${s.horasLaboratorio || '-'}</td>
                  <td>${s.aulaCodigo}</td>
                  <td>${s.departamento || 'ING. DE SISTEMAS'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
        <div class="footer-line">Documento oficial generado por el Sistema de Gestión de Horarios - UNT</div>
      </div>
    `;
  }).join('');

  return `<!DOCTYPE html><html><head>${STYLES}</head><body>${pages}</body></html>`;
}

export function generateDocenteReportHTML(docentes: DocenteReportData[], periodoNombre: string): string {
  const pages = docentes.map(d => {
    const info = {
      'UNIVERSIDAD': 'UNIVERSIDAD NACIONAL DE TRUJILLO',
      'DOCENTE': d.docenteNombre,
      'CÓDIGO': d.docenteCodigo || '---',
      'CATEGORÍA': d.categoria,
      'TIPO': d.tipo,
      'ANTIGÜEDAD': d.antiguedad,
      'PERIODO ACADÉMICO': periodoNombre,
      'ESTADO CARGA': 'VIGENTE'
    };

    const uniqueAssignments = Array.from(new Map(d.slots.map(s => [`${s.cursoCodigo}-${s.grupoNombre}-${s.tipo}`, s])).values());
    
    const totalT = uniqueAssignments.reduce((acc, s) => acc + (s.tipo === 'TEORIA' ? s.horasTeoria : 0), 0);
    const totalP = uniqueAssignments.reduce((acc, s) => acc + (s.tipo === 'PRACTICA' ? s.horasPractica : 0), 0);
    const totalL = uniqueAssignments.reduce((acc, s) => acc + (s.tipo === 'LABORATORIO' ? s.horasLaboratorio : 0), 0);

    return `
      <div class="page">
        ${institutionalHeader('HORARIO INDIVIDUAL DE CARGA LECTIVA DEL DOCENTE', info)}
        ${renderScheduleGrid(d.slots, { showAula: true, showCiclo: true })}
        
        <div class="detail-section">
          <div class="detail-title">RESUMEN ACADÉMICO DE CARGA LECTIVA:</div>
          <table class="detail-table">
            <thead>
              <tr>
                <th>Curso</th>
                <th style="width: 40px;" class="text-center">Ciclo</th>
                <th style="width: 40px;" class="text-center">Grup.</th>
                <th style="width: 40px;" class="text-center">T</th>
                <th style="width: 40px;" class="text-center">P</th>
                <th style="width: 40px;" class="text-center">L</th>
                <th>Aula/Laboratorio</th>
                <th style="width: 60px;" class="text-center">Total Hrs</th>
              </tr>
            </thead>
            <tbody>
              ${uniqueAssignments.map(s => `
                <tr>
                  <td>${s.cursoNombre} (${s.cursoCodigo})</td>
                  <td class="text-center">${s.ciclo}</td>
                  <td class="text-center">${s.grupoNombre}</td>
                  <td class="text-center">${s.tipo === 'TEORIA' ? s.horasTeoria : '-'}</td>
                  <td class="text-center">${s.tipo === 'PRACTICA' ? s.horasPractica : '-'}</td>
                  <td class="text-center">${s.tipo === 'LABORATORIO' ? s.horasLaboratorio : '-'}</td>
                  <td>${s.aulaCodigo} - ${s.aulaNombre}</td>
                  <td class="text-center">${s.horasTeoria + s.horasPractica + s.horasLaboratorio}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        <div class="summary-grid">
          <div class="summary-box">
            <div class="detail-title">RESUMEN DE CARGA:</div>
            <div>Total Horas Teoría: <strong>${totalT}</strong></div>
            <div>Total Horas Práctica: <strong>${totalP}</strong></div>
            <div>Total Horas Laboratorio: <strong>${totalL}</strong></div>
            <div style="border-top: 1px solid #000; margin-top: 3px; padding-top: 3px;">
              TOTAL CARGA LECTIVA: <strong>${totalT + totalP + totalL} horas semanales</strong>
            </div>
          </div>
          <div class="summary-box">
            <div class="detail-title">ESTADÍSTICAS:</div>
            <div>Número de cursos: <strong>${new Set(d.slots.map(s => s.cursoCodigo)).size}</strong></div>
            <div>Número de aulas utilizadas: <strong>${new Set(d.slots.map(s => s.aulaCodigo)).size}</strong></div>
            <div>Número de grupos: <strong>${new Set(d.slots.map(s => `${s.cursoCodigo}-${s.grupoNombre}`)).size}</strong></div>
          </div>
        </div>
        <div class="footer-line">Documento oficial generado por el Sistema de Gestión de Horarios - UNT</div>
      </div>
    `;
  }).join('');

  return `<!DOCTYPE html><html><head>${STYLES}</head><body>${pages}</body></html>`;
}

export function generateAuditReportHTML(logs: any[]): string {
  const info = {
    'SISTEMA': 'GESTIÓN DE CARGA ACADÉMICA - UNT',
    'TIPO DE REPORTE': 'BITÁCORA DE ACCESOS Y ACTIVIDADES CRÍTICAS',
    'FECHA DE GENERACIÓN': new Date().toLocaleString('es-PE'),
    'REGISTROS MOSTRADOS': logs.length.toString(),
  };

  const html = `
    <div class="page">
      ${institutionalHeader('REPORTE DE AUDITORÍA Y SEGURIDAD', info)}
      
      <table class="audit-table">
        <thead>
          <tr>
            <th style="width: 150px;">Usuario / Email</th>
            <th style="width: 80px;">Rol</th>
            <th style="width: 100px;">Acción</th>
            <th>Detalles de la Actividad</th>
            <th style="width: 110px;">Fecha y Hora</th>
          </tr>
        </thead>
        <tbody>
          ${logs.map(log => {
            const isLogin = log.accion === 'LOGIN';
            const isCritical = log.accion.includes('DELETE') || log.accion.includes('UPDATE') || log.accion.includes('PUBLISH');
            const badgeClass = isLogin ? 'badge-login' : (isCritical ? 'badge-critical' : 'badge-default');
            
            return `
              <tr>
                <td>
                  <div style="font-weight: bold;">${log.usuario}</div>
                  <div style="font-size: 8px; color: #666;">${log.email}</div>
                </td>
                <td>${log.rol}</td>
                <td><span class="badge ${badgeClass}">${log.accion}</span></td>
                <td>${log.detalles}</td>
                <td>
                  <div>${new Date(log.fecha).toLocaleDateString('es-PE')}</div>
                  <div style="font-size: 8px; color: #666;">${new Date(log.fecha).toLocaleTimeString('es-PE')}</div>
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
      
      <div class="footer-line">Este reporte es confidencial y para uso exclusivo del administrador del sistema.</div>
    </div>
  `;

  return `<!DOCTYPE html><html><head>${STYLES}</head><body>${html}</body></html>`;
}

// ─── MANAGEMENT REPORT ──────────────────────────────

interface ManagementData {
  periodoNombre: string;
  totalDocentes: number;
  docentesConCarga: number;
  totalGrupos: number;
  gruposAsignados: number;
  totalAsignaciones: number;
  asignacionesConfirmadas: number;
  cargaDocente: Array<{
    nombre: string;
    tipo: string;
    categoria: string;
    horasAsignadas: number;
  }>;
  ocupacionAulas: Array<{
    codigo: string;
    tipo: string;
    slotsOcupados: number;
    totalSlots: number;
    ocupacion: number;
  }>;
}

const GESTION_STYLES = `
  <style>
    @page { size: A4 portrait; margin: 15mm; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Inter', -apple-system, sans-serif;
      color: #1f2937;
      font-size: 11px;
      line-height: 1.5;
      background: white;
    }
    .page { page-break-after: always; width: 100%; padding: 0; }
    
    .header-gestion {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 2px solid #4f46e5;
      padding-bottom: 15px;
      margin-bottom: 25px;
    }
    .header-left h1 { font-size: 18px; color: #1e1b4b; font-weight: 800; }
    .header-left p { color: #6366f1; font-weight: 600; font-size: 12px; }
    .header-right { text-align: right; color: #6b7280; font-size: 10px; }

    .stats-container {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 15px;
      margin-bottom: 25px;
    }
    .stat-card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 15px;
      text-align: center;
    }
    .stat-value { font-size: 22px; font-weight: 700; color: #4f46e5; margin-bottom: 5px; }
    .stat-label { font-size: 10px; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; }

    .section-title {
      font-size: 14px;
      font-weight: 700;
      color: #1e293b;
      margin-bottom: 12px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .section-title::before {
      content: '';
      display: block;
      width: 4px;
      height: 16px;
      background: #4f46e5;
      border-radius: 2px;
    }

    .modern-table {
      width: 100%;
      border-collapse: separate;
      border-spacing: 0;
      margin-bottom: 25px;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      overflow: hidden;
    }
    .modern-table th {
      background: #f1f5f9;
      padding: 10px 12px;
      text-align: left;
      font-weight: 600;
      color: #475569;
      border-bottom: 1px solid #e2e8f0;
    }
    .modern-table td {
      padding: 10px 12px;
      border-bottom: 1px solid #f1f5f9;
      color: #334155;
    }
    .modern-table tr:last-child td { border-bottom: none; }
    .modern-table tr:nth-child(even) { background: #f8fafc; }

    .badge-status {
      padding: 2px 8px;
      border-radius: 12px;
      font-size: 9px;
      font-weight: 600;
    }
    .status-success { background: #dcfce7; color: #166534; }
    .status-warning { background: #fef9c3; color: #854d0e; }
    .status-info { background: #e0f2fe; color: #075985; }

    .progress-bar-bg {
      width: 100px;
      height: 6px;
      background: #e2e8f0;
      border-radius: 3px;
      overflow: hidden;
    }
    .progress-bar-fill { height: 100%; border-radius: 3px; }

    .footer-gestion {
      margin-top: 30px;
      padding-top: 15px;
      border-top: 1px solid #e2e8f0;
      display: flex;
      justify-content: space-between;
      color: #94a3b8;
      font-size: 9px;
    }
  </style>
`;

export function generateManagementReportHTML(data: ManagementData): string {
  const completionRate = data.totalGrupos > 0
    ? Math.round((data.gruposAsignados / data.totalGrupos) * 100) : 0;
  const confirmRate = data.totalAsignaciones > 0
    ? Math.round((data.asignacionesConfirmadas / data.totalAsignaciones) * 100) : 0;

  return `
    <!DOCTYPE html>
    <html><head>${GESTION_STYLES}</head>
    <body>
      <div class="page">
        <div class="header-gestion">
          <div class="header-left">
            <h1>Reporte de Gestión Académica</h1>
            <p>Universidad Nacional de Trujillo — UNT</p>
          </div>
          <div class="header-right">
            <div>Periodo: <strong>${data.periodoNombre}</strong></div>
            <div>Fecha: ${new Date().toLocaleDateString('es-PE')}</div>
          </div>
        </div>

        <div class="stats-container">
          <div class="stat-card">
            <div class="stat-value">${completionRate}%</div>
            <div class="stat-label">Cobertura de Grupos</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${data.docentesConCarga}</div>
            <div class="stat-label">Docentes Asignados</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${confirmRate}%</div>
            <div class="stat-label">Confirmación</div>
          </div>
        </div>

        <div class="section-title">Indicadores Principales</div>
        <table class="modern-table">
          <thead>
            <tr>
              <th>Indicador</th>
              <th class="text-center">Progreso</th>
              <th class="text-center">Valor</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Grupos con Horario</td>
              <td>
                <div class="progress-bar-bg">
                  <div class="progress-bar-fill" style="width: ${completionRate}%; background: ${completionRate >= 90 ? '#10b981' : '#f59e0b'}"></div>
                </div>
              </td>
              <td class="text-center">${data.gruposAsignados} / ${data.totalGrupos}</td>
              <td><span class="badge-status ${completionRate >= 100 ? 'status-success' : 'status-warning'}">${completionRate >= 100 ? 'COMPLETO' : 'EN PROCESO'}</span></td>
            </tr>
            <tr>
              <td>Carga Lectiva Docente</td>
              <td>
                <div class="progress-bar-bg">
                  <div class="progress-bar-fill" style="width: ${(data.docentesConCarga/data.totalDocentes)*100}%; background: #6366f1"></div>
                </div>
              </td>
              <td class="text-center">${data.docentesConCarga} / ${data.totalDocentes}</td>
              <td><span class="badge-status status-info">EN REVISIÓN</span></td>
            </tr>
          </tbody>
        </table>

        <div class="section-title">Carga Horaria por Docente</div>
        <table class="modern-table">
          <thead>
            <tr>
              <th>Docente</th>
              <th>Tipo</th>
              <th class="text-center">Horas</th>
              <th>Cumplimiento</th>
            </tr>
          </thead>
          <tbody>
            ${data.cargaDocente
              .slice(0, 15) // Top 15 in first page
              .map(d => `
                <tr>
                  <td><strong>${d.nombre}</strong></td>
                  <td>${d.tipo}</td>
                  <td class="text-center">${d.horasAsignadas} hrs</td>
                  <td><span class="badge-status ${d.horasAsignadas >= 12 ? 'status-success' : 'status-info'}">${d.horasAsignadas >= 12 ? 'COMPLETA' : 'PARCIAL'}</span></td>
                </tr>
              `).join('')}
          </tbody>
        </table>
        
        <div class="footer-gestion">
          <div>Escuela Profesional de Ingeniería de Sistemas</div>
          <div>Página 1 de 2</div>
        </div>
      </div>

      <div class="page">
        <div class="section-title" style="margin-top: 20px;">Ocupación de Ambientes</div>
        <table class="modern-table">
          <thead>
            <tr>
              <th>Ambiente</th>
              <th>Tipo</th>
              <th class="text-center">Uso</th>
              <th class="text-center">Ocupación %</th>
            </tr>
          </thead>
          <tbody>
            ${data.ocupacionAulas
              .map(a => `
                <tr>
                  <td><strong>${a.codigo}</strong></td>
                  <td>${a.tipo}</td>
                  <td class="text-center">${a.slotsOcupados} / ${a.totalSlots}</td>
                  <td>
                    <div style="display:flex; align-items:center; gap:8px;">
                      <div class="progress-bar-bg" style="width: 60px;">
                        <div class="progress-bar-fill" style="width: ${a.ocupacion}%; background: ${a.ocupacion > 80 ? '#ef4444' : '#10b981'}"></div>
                      </div>
                      <span>${a.ocupacion}%</span>
                    </div>
                  </td>
                </tr>
              `).join('')}
          </tbody>
        </table>
        
        <div class="footer-gestion">
          <div>Escuela Profesional de Ingeniería de Sistemas</div>
          <div>Página 2 de 2</div>
        </div>
      </div>
    </body></html>
  `;
}
