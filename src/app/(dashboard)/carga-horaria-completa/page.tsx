'use client';

import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useTRPC } from '@/trpc/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import {
  CalendarClock, X, User as UserIcon, Calendar, GripVertical, AlertTriangle, Save, Edit3,
} from 'lucide-react';
import { TipoCargaNoLectiva } from '@/generated/prisma/client';

// ── Tipos ─────────────────────────────────────────────────
type BloquePendiente = {
  uid: string;
  tipoOrigen: 'lectiva' | 'no_lectiva';
  origenId: string;
  subtipo: string | null;
  nombre: string;
  horasTotales: number;
  horasColocadas: number;
  color: string;
};

type BloqueColocado = BloquePendiente & {
  diaSemana: string;
  horaInicio: string;
  horaFin: string;
  horaInicioMin: number;
  horaFinMin: number;
  bloqueId?: string;
  readOnly?: boolean;
};

const COLORES: Record<string, string> = {
  TEORIA: 'bg-blue-50 border-blue-300 text-blue-700',
  PRACTICA: 'bg-emerald-50 border-emerald-300 text-emerald-700',
  LABORATORIO: 'bg-amber-50 border-amber-300 text-amber-700',
  PREPARACION_EVALUACION: 'bg-rose-50 border-rose-300 text-rose-700',
  CONSEJERIA: 'bg-violet-50 border-violet-300 text-violet-700',
  INVESTIGACION: 'bg-cyan-50 border-cyan-300 text-cyan-700',
  ADMINISTRACION: 'bg-slate-100 border-slate-300 text-slate-600',
  CAPACITACION: 'bg-indigo-50 border-indigo-300 text-indigo-700',
  ASESORIA_TESIS: 'bg-sky-50 border-sky-300 text-sky-700',
  JURADOS: 'bg-amber-50 border-amber-300 text-amber-700',
  RESPONSABILIDAD_SOCIAL: 'bg-lime-50 border-lime-300 text-lime-700',
};

const DIAS = ['LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO'] as const;
const HORAS_INICIO = 7;
const HORAS_FIN = 22;

function horaToMin(h: string) { const [hh, mm] = h.split(':').map(Number); return hh * 60 + mm; }
function minToHora(m: number) { return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`; }
function colorFromTipo(tipoOrigen: string, subtipo?: string | null) {
  if (tipoOrigen === 'lectiva' && subtipo) return COLORES[subtipo] || COLORES.TEORIA;
  return COLORES[tipoOrigen.toUpperCase()] || COLORES.ADMINISTRACION;
}

const TIPO_NOMBRE: Record<string, string> = {
  PREPARACION_EVALUACION: '2. PREPARACIÓN Y EVALUACIÓN',
  CONSEJERIA: '3. CONSEJERÍA',
  INVESTIGACION: '4. INVESTIGACIÓN',
  CAPACITACION: '5. CAPACITACIÓN',
  GOBIERNO: '6. ACTIVIDADES DE GOBIERNO',
  ADMINISTRACION: '7. ACTIVIDADES DE ADMINISTRACIÓN',
  ASESORIA_TESIS: '8. ASESORÍA DE TESIS, EXÁMENES PROFESIONALES Y EXPERIENCIA PROFESIONAL',
  RESPONSABILIDAD_SOCIAL: '9. EXTENSIÓN Y PROYECCIÓN SOCIAL',
  JURADOS: '10. COMITÉS TÉCNICOS Y COMISIONES',
};

const RUBROS_ORDEN: string[] = [
  'PREPARACION_EVALUACION', 'CONSEJERIA', 'INVESTIGACION', 'CAPACITACION',
  'GOBIERNO', 'ADMINISTRACION', 'ASESORIA_TESIS', 'RESPONSABILIDAD_SOCIAL', 'JURADOS',
];

const RUBRO_DESCRIPCION: Record<string, string> = {
  PREPARACION_EVALUACION: 'Preparación de clases y evaluación de los cursos asignados.',
  CONSEJERIA: 'Señalar número de alumnos y el ciclo académico con los que se desarrolla.',
  INVESTIGACION: 'Consignar el nro de inscripción, código, nombre y duración del proyecto.',
  CAPACITACION: 'Señale lo referente a este rubro en el marco de los planes de cada Facultad.',
  GOBIERNO: 'Si desempeña cargo indique la resolución de designación.',
  ADMINISTRACION: 'Si desempeña cargo indique la resolución de designación.',
  ASESORIA_TESIS: 'Indicar número de Resolución Decanal, tesistas, título del proyecto.',
  RESPONSABILIDAD_SOCIAL: 'Señalar actividad, proyecto o programa a ejecutarse en beneficio de la comunidad.',
  JURADOS: 'Consignar el número de Resolución autoritativa indicando el lapso de vigencia.',
};

export default function CargaHorariaCompletaPage() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const router = useRouter();

  const { data: user } = useQuery({ ...trpc.auth.me.queryOptions() });
  const { data: periodos = [] } = useQuery({ ...trpc.periodo.list.queryOptions() });
  const activePeriod = periodos.find((p: any) => p.activo);
  const [selectedPeriodoId, setSelectedPeriodoId] = useState('');
  const periodoId = selectedPeriodoId || activePeriod?.id || (periodos.length > 0 ? (periodos[0] as any).id : '');

  const showTeacherSearch = useMemo(() => user?.role !== 'DOCENTE', [user]);
  const [selectedDocenteId, setSelectedDocenteId] = useState('');
  useEffect(() => {
    if (user?.role === 'DOCENTE' && user.docenteId) setSelectedDocenteId(user.docenteId);
  }, [user]);

  const { data: docentes = [] } = useQuery({
    ...trpc.docente.list.queryOptions({}), enabled: showTeacherSearch,
  });
  const { data: docente, isLoading: isLoadingDocente } = useQuery({
    ...trpc.docente.byId.queryOptions({ id: selectedDocenteId }),
    enabled: !!selectedDocenteId,
  });
  const { data: cargasLectivas = [] } = useQuery({
    ...trpc.cargaLectiva.list.queryOptions({ docenteId: selectedDocenteId, periodoId }),
    enabled: !!selectedDocenteId && !!periodoId,
  });
  const { data: cargasNoLectivasData } = useQuery({
    ...trpc.cargaNoLectiva.byDocente.queryOptions({ docenteId: selectedDocenteId, periodoId }),
    enabled: !!selectedDocenteId && !!periodoId,
  });
  const cargasNoLectivas = cargasNoLectivasData?.cargas || [];
  const { data: bloquesGuardados = [] } = useQuery({
    ...trpc.horarioBloque.list.queryOptions({ docenteId: selectedDocenteId, periodoId }),
    enabled: !!selectedDocenteId && !!periodoId,
  });
  const { data: asignaciones = [] } = useQuery({
    ...trpc.horario.byDocente.queryOptions({ docenteId: selectedDocenteId, periodoId }),
    enabled: !!selectedDocenteId && !!periodoId,
  });

  const [showHorario, setShowHorario] = useState(false);

  const groupedLectivas = useMemo(() => {
    const map: Record<string, any> = {};
    cargasLectivas.forEach((a: any) => {
      const key = a.grupoId;
      if (!map[key]) {
        map[key] = {
          grupoId: a.grupoId, cursoNombre: a.grupo.curso.nombre, cursoCodigo: a.grupo.curso.codigo,
          seccion: a.grupo.seccion || a.grupo.nombre || 'A', ciclo: a.grupo.curso.ciclo,
          numAlumnos: a.grupo.numAlumnos || 0, escuela: a.grupo.curso.escuela?.nombre || '',
          teoria: { id: '', horas: 0 }, practica: { id: '', horas: 0 }, laboratorio: { id: '', horas: 0 },
        };
      }
      if (a.tipo === 'TEORIA') map[key].teoria = { id: a.id, horas: a.horasAsignadas };
      else if (a.tipo === 'PRACTICA') map[key].practica = { id: a.id, horas: a.horasAsignadas };
      else if (a.tipo === 'LABORATORIO') map[key].laboratorio = { id: a.id, horas: a.horasAsignadas };
    });
    return Object.values(map);
  }, [cargasLectivas]);

  const totalLectivas = cargasLectivas.reduce((acc: number, c: any) => acc + c.horasAsignadas, 0);

  const rubroMap: Record<string, { horas: number; descripcion: string; id: string }> = {};
  for (const r of RUBROS_ORDEN) rubroMap[r] = { horas: 0, descripcion: '', id: '' };
  for (const c of cargasNoLectivas) {
    const tipo = c.tipo as string;
    if (rubroMap[tipo] !== undefined) {
      rubroMap[tipo].horas += c.horas;
      rubroMap[tipo].descripcion = rubroMap[tipo].descripcion
        ? rubroMap[tipo].descripcion + '; ' + (c.descripcion || '')
        : (c.descripcion || '');
      rubroMap[tipo].id = c.id;
    }
  }

  const totalNoLectivas = Object.values(rubroMap).reduce((s, r) => s + r.horas, 0);

  // ── Edición inline de rubros no lectivos ──
  const [editRubro, setEditRubro] = useState<string | null>(null);
  const [editHoras, setEditHoras] = useState(0);
  const [editDesc, setEditDesc] = useState('');

  const createNoLectivaMutation = useMutation(
    trpc.cargaNoLectiva.create.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: trpc.cargaNoLectiva.byDocente.queryKey() });
        setEditRubro(null);
      },
      onError: (err: any) => alert(err.message),
    })
  );

  const updateNoLectivaMutation = useMutation(
    trpc.cargaNoLectiva.update.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: trpc.cargaNoLectiva.byDocente.queryKey() });
        setEditRubro(null);
      },
      onError: (err: any) => alert(err.message),
    })
  );

  function startEditRubro(tipo: string) {
    const data = rubroMap[tipo];
    setEditRubro(tipo);
    setEditHoras(data.horas);
    setEditDesc(data.descripcion);
  }

  function cancelEditRubro() { setEditRubro(null); }

  function saveRubro(tipo: string) {
    const data = rubroMap[tipo];
    if (data.id) {
      updateNoLectivaMutation.mutate({ id: data.id, horas: editHoras, descripcion: editDesc || undefined });
    } else {
      createNoLectivaMutation.mutate({
        docenteId: selectedDocenteId,
        periodoId,
        tipo: tipo as any,
        horas: editHoras,
        descripcion: editDesc || undefined,
      });
    }
  }

  const docenteFac = useMemo(() => {
    if (!docente) return { facultad: '-', departamento: '-', escuela: '-' };
    const dept = (docente as any).departamento;
    return { facultad: dept?.facultad?.nombre || '-', departamento: dept?.nombre || '-' };
  }, [docente]);

  const catNombre = (cat: string) => ({ PRINCIPAL: 'Principal', ASOCIADO: 'Asociado', AUXILIAR: 'Auxiliar', JEFE_PRACTICA: 'Jefe de Práctica' } as Record<string, string>)[cat] || cat;

  const modalidadNombre = (m: string) => ({ DEDICACION_EXCLUSIVA: 'Dedicación Exclusiva', TIEMPO_COMPLETO: 'Tiempo Completo', TIEMPO_PARCIAL: 'Tiempo Parcial' } as Record<string, string>)[m] || m;

  if (selectedDocenteId && !isLoadingDocente && groupedLectivas.length === 0 && cargasNoLectivas.length === 0) {
    return (
      <div className="p-6 max-w-5xl mx-auto">
        <div className="bg-white border-2 border-slate-300 rounded p-16 text-center">
          <CalendarClock className="h-16 w-16 mx-auto text-slate-300 mb-4" />
          <h2 className="text-xl font-bold text-slate-700 mb-2">Sin carga registrada</h2>
          <p className="text-slate-500 mb-6">Aún no has registrado tu carga lectiva ni no lectiva para este período.</p>
          <button onClick={() => router.push('/')} className="btn-primary">
            Volver al Inicio
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-0">
      {/* TÍTULO PRINCIPAL */}
      <div className="text-center mb-6">
        <h1 className="text-lg font-bold uppercase tracking-wide text-slate-900">
          CARGA HORARIA — DECLARACIÓN DE CARGA HORARIA ASIGNADA
        </h1>
      </div>

      {/* Selector de Periodo / Docente */}
      <div className="flex flex-wrap gap-3 mb-6">
        <select value={periodoId} onChange={(e) => setSelectedPeriodoId(e.target.value)}
          className="border border-slate-300 rounded px-3 py-1.5 text-sm bg-white">
          {periodos.map((p: any) => <option key={p.id} value={p.id}>{p.nombre} {p.activo ? '(Activo)' : ''}</option>)}
        </select>
        {showTeacherSearch && (
          <select value={selectedDocenteId} onChange={(e) => setSelectedDocenteId(e.target.value)}
            className="border border-slate-300 rounded px-3 py-1.5 text-sm bg-white">
            <option value="">-- Seleccione Docente --</option>
            {docentes.map((d: any) => <option key={d.id} value={d.id}>{d.nombre}</option>)}
          </select>
        )}
      </div>

      {!selectedDocenteId && (
        <div className="bg-slate-50 border border-slate-200 p-8 text-center text-slate-500">
          <UserIcon className="h-10 w-10 mx-auto text-slate-400 mb-3" />
          Seleccione un docente para visualizar su carga horaria.
        </div>
      )}

      {selectedDocenteId && docente && (
        <div className="border-2 border-black bg-white">
          {/* ── I. DATOS DEL PROFESOR ── */}
          <div className="border-b-2 border-black p-4">
            <h2 className="text-sm font-bold uppercase text-center mb-3">I. DATOS SOBRE LA SITUACIÓN DEL PROFESOR</h2>
            <div className="grid grid-cols-2 gap-y-1 gap-x-6 text-sm">
              <div><span className="font-bold">FACULTAD:</span> {docenteFac.facultad}</div>
              <div><span className="font-bold">DPTO. ACADÉMICO:</span> {docenteFac.departamento}</div>
              <div className="col-span-2 grid grid-cols-3 gap-x-6 mt-1 pt-1">
                <div><span className="font-bold">NOMBRE:</span> {(docente as any).nombre}</div>
                <div><span className="font-bold">CONDICIÓN:</span> {(docente as any).tipo === 'NOMBRADO' ? 'Nombrado' : 'Contratado'}</div>
                <div><span className="font-bold">CATEGORÍA:</span> {catNombre((docente as any).categoria)}</div>
              </div>
              <div className="mt-1 pt-1"><span className="font-bold">MODALIDAD:</span> {modalidadNombre((docente as any).modalidad)} {(docente as any).horasContrato}H</div>
            </div>
          </div>

          {/* ── 1. TRABAJO LECTIVO ── */}
          <div className="border-b-2 border-black p-4">
            <h2 className="text-sm font-bold uppercase text-center mb-3">1. TRABAJO LECTIVO — Datos completos y con claridad</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse border border-black">
                <thead>
                  <tr className="bg-slate-100 text-center">
                    <th className="border border-black px-1 py-1.5 w-16">CÓDIGO</th>
                    <th className="border border-black px-1 py-1.5">NOMBRE DEL CURSO</th>
                    <th className="border border-black px-1 py-1.5 w-14">SECC.</th>
                    <th className="border border-black px-1 py-1.5 w-14">OB/EL</th>
                    <th className="border border-black px-1 py-1.5">ESCUELA PROF.</th>
                    <th className="border border-black px-1 py-1.5 w-16">AÑO/CICLO</th>
                    <th className="border border-black px-1 py-1.5 w-14">ALUMN.</th>
                    <th className="border border-black px-1 py-1.5 w-16">HrsTeo</th>
                    <th className="border border-black px-1 py-1.5 w-16">HrsPra</th>
                    <th className="border border-black px-1 py-1.5 w-14">TOTAL</th>
                  </tr>
                </thead>
                <tbody>
                  {groupedLectivas.length === 0 ? (
                    <tr><td colSpan={10} className="border border-black px-2 py-4 text-center text-slate-400 italic">Sin carga lectiva registrada</td></tr>
                  ) : groupedLectivas.map((item: any, i: number) => {
                    const totalCurso = item.teoria.horas + item.practica.horas + item.laboratorio.horas;
                    const horasTeoriaVisual = item.teoria.horas + item.practica.horas;
                    const horasPracticaVisual = item.laboratorio.horas;
                    const anio = Math.ceil(item.ciclo / 2);
                    return (
                      <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                        <td className="border border-black px-1 py-1 text-center font-mono text-[11px]">{item.cursoCodigo}</td>
                        <td className="border border-black px-1 py-1 text-[11px]">{item.cursoNombre}</td>
                        <td className="border border-black px-1 py-1 text-center">{item.seccion}</td>
                        <td className="border border-black px-1 py-1 text-center">OB</td>
                        <td className="border border-black px-1 py-1 text-[11px]">{docenteFac.departamento}</td>
                        <td className="border border-black px-1 py-1 text-center">{anio}° / {item.ciclo}</td>
                        <td className="border border-black px-1 py-1 text-center">{item.numAlumnos}</td>
                        <td className="border border-black px-1 py-1 text-center">{horasTeoriaVisual || '-'}</td>
                        <td className="border border-black px-1 py-1 text-center">{horasPracticaVisual || '-'}</td>
                        <td className="border border-black px-1 py-1 text-center font-bold">{totalCurso}h</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between mt-3">
              <div className="text-sm font-bold">Total Horas Lectivas: <span className="text-base">{totalLectivas}h</span></div>
              <button onClick={() => setShowHorario(true)}
                className="bg-blue-800 hover:bg-blue-900 text-white font-bold py-2 px-5 rounded text-sm flex items-center gap-2 shadow"
                style={{ color: '#fff' }}>
                <Calendar className="h-4 w-4" style={{ color: '#fff' }} /> <span style={{ color: '#fff' }}>Horario</span>
              </button>
            </div>
          </div>

          {/* ── CARGA NO LECTIVA (RUBROS 2-10) ── */}
          <div className="p-4">
            <h2 className="text-sm font-bold uppercase text-center mb-3">CARGA HORARIA NO LECTIVA</h2>

            {RUBROS_ORDEN.map((tipo) => {
              const data = rubroMap[tipo];
              const isEditing = editRubro === tipo;
              return (
                <div key={tipo} className="border border-black mb-2 last:mb-0">
                  <div className="flex flex-col md:flex-row">
                    {/* Título del rubro */}
                    <div className="bg-slate-100 font-bold text-xs px-3 py-2 border-b md:border-b-0 md:border-r border-black md:w-52 shrink-0 flex items-center">
                      {TIPO_NOMBRE[tipo] || tipo}
                    </div>

                    {/* Contenido central */}
                    <div className="flex-1 flex flex-col md:flex-row">
                      <div className="flex-1 px-3 py-2 text-xs text-slate-700">
                        {isEditing ? (
                          <textarea
                            value={editDesc}
                            onChange={(e) => setEditDesc(e.target.value)}
                            className="w-full border border-slate-300 rounded px-2 py-1 text-xs text-slate-700 resize-y"
                            rows={2}
                            placeholder={RUBRO_DESCRIPCION[tipo]}
                          />
                        ) : (
                          <span className="italic">{data.descripcion || RUBRO_DESCRIPCION[tipo]}{data.descripcion ? '' : ' (Sin registro)'}</span>
                        )}
                      </div>

                      {/* Recuadro de horas a la derecha */}
                      <div className="border-t md:border-t-0 md:border-l border-black shrink-0 flex items-stretch min-w-[120px]">
                        <div className="bg-slate-50 font-bold text-sm px-4 flex items-center justify-center min-w-[80px]">
                          <span className="border-2 border-slate-400 px-3 py-1 bg-white">
                            {isEditing ? (
                              <input
                                type="number"
                                value={editHoras}
                                onChange={(e) => setEditHoras(Number(e.target.value))}
                                className="w-16 text-center border border-slate-300 rounded text-sm font-bold"
                                min={0}
                              />
                            ) : (
                              <>Horas: {data.horas}</>
                            )}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Barra inferior: botones de acción */}
                  <div className="border-t border-slate-200 bg-slate-50 px-3 py-1.5 flex items-center justify-end gap-2">
                    {isEditing ? (
                      <>
                        <button onClick={() => saveRubro(tipo)}
                          disabled={createNoLectivaMutation.isPending || updateNoLectivaMutation.isPending}
                          className="bg-blue-800 hover:bg-blue-900 text-white font-bold text-[11px] px-3 py-1 rounded flex items-center gap-1">
                          <Save className="h-3 w-3" /> Guardar
                        </button>
                        <button onClick={cancelEditRubro}
                          className="text-[11px] text-slate-500 hover:text-slate-700 px-3 py-1 rounded border border-slate-300">
                          Cancelar
                        </button>
                      </>
                    ) : (
                      <button onClick={() => startEditRubro(tipo)}
                        className="text-[11px] text-slate-600 hover:text-blue-700 font-medium px-3 py-1 rounded border border-slate-300 hover:border-blue-300 hover:bg-blue-50 flex items-center gap-1">
                        <Edit3 className="h-3 w-3" /> Editar
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* ── PIE: TOTAL GENERAL ── */}
          <div className="border-t-2 border-black p-4">
            <div className="flex justify-end items-center gap-4">
              <span className="text-sm font-bold uppercase">Total Horas Lectivas: {totalLectivas}h</span>
              <span className="text-sm font-bold uppercase">Total Horas No Lectivas: {totalNoLectivas}h</span>
              <div className="bg-white text-slate-900 font-black text-lg px-6 py-2 border-2 border-black">
                TOTAL: {totalLectivas + totalNoLectivas}h / {(docente as any).horasContrato}h
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Horario Modal */}
      {showHorario && docente && (
        <HorarioModal
          docenteId={selectedDocenteId}
          periodoId={periodoId}
          cargasLectivas={cargasLectivas}
          cargasNoLectivas={cargasNoLectivas}
          horasContrato={(docente as any).horasContrato}
          bloquesGuardados={bloquesGuardados as any[]}
          asignaciones={asignaciones as any[]}
          userRole={user?.role}
          onClose={() => setShowHorario(false)}
          onSaved={() => {
            queryClient.invalidateQueries({ queryKey: trpc.horarioBloque.list.queryKey() });
          }}
        />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════
//  HORARIO MODAL
// ═══════════════════════════════════════════════════════
function HorarioModal({
  docenteId, periodoId, cargasLectivas, cargasNoLectivas, horasContrato, bloquesGuardados, asignaciones, userRole, onClose, onSaved,
}: {
  docenteId: string; periodoId: string; cargasLectivas: any[]; cargasNoLectivas: any[];
  horasContrato: number; bloquesGuardados: any[]; asignaciones: any[]; userRole?: string;
  onClose: () => void; onSaved: () => void;
}) {
  const trpc = useTRPC();
  const saveMutation = useMutation(trpc.horarioBloque.save.mutationOptions({
    onSuccess: () => { onSaved(); onClose(); },
    onError: (err: any) => alert(err.message),
  }));

  const isDocente = userRole === 'DOCENTE';

  // ── Bloques de TODOS los docentes para validación cross-docente ──
  const { data: allBloquesPeriodo = [] as any[] } = useQuery({
    ...trpc.horarioBloque.listAllByPeriodo.queryOptions({ periodoId }),
    enabled: !!periodoId,
  });

  // ── Convertir asignaciones a BloqueColocado para visualización ──
  const bloquesAsignados: BloqueColocado[] = useMemo(() => {
    if (!asignaciones || asignaciones.length === 0) return [];

    // Ordenar asignaciones por día y hora
    const diasOrden = ['LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO'];
    const sorted = [...asignaciones].sort((a: any, b: any) => {
      const diaA = diasOrden.indexOf(a.franjaHoraria.dia);
      const diaB = diasOrden.indexOf(b.franjaHoraria.dia);
      if (diaA !== diaB) return diaA - diaB;
      return a.franjaHoraria.horaInicio.localeCompare(b.franjaHoraria.horaInicio);
    });

    const grupos: any[] = [];
    let grupoActual: any = null;

    for (const a of sorted) {
      const cursoNombre = a.grupo?.curso?.nombre || 'Curso';
      const tipo = a.tipo;
      const key = `${a.franjaHoraria.dia}-${a.aula.id}-${tipo}-${a.grupo?.curso?.id || 'unknown'}`;

      if (grupoActual && grupoActual.key === key) {
        // Verificar si la hora es consecutiva
        const horaFinAnterior = grupoActual.horaFin;
        const horaInicioActual = a.franjaHoraria.horaInicio;
        if (horaFinAnterior === horaInicioActual) {
          // Fusionar bloques
          grupoActual.horaFin = a.franjaHoraria.horaFin;
          grupoActual.horaFinMin = horaToMin(a.franjaHoraria.horaFin);
          grupoActual.horasColocadas += 1;
          continue;
        }
      }

      // Crear nuevo grupo
      grupoActual = {
        uid: `asign-${a.id}`,
        tipoOrigen: 'lectiva',
        origenId: a.id,
        subtipo: tipo,
        nombre: `${cursoNombre} (${tipo === 'TEORIA' ? 'Teoría' : tipo === 'PRACTICA' ? 'Práctica' : 'Lab'})`,
        horasTotales: 0,
        horasColocadas: 1,
        color: colorFromTipo('lectiva', tipo),
        diaSemana: a.franjaHoraria.dia,
        horaInicio: a.franjaHoraria.horaInicio,
        horaFin: a.franjaHoraria.horaFin,
        horaInicioMin: horaToMin(a.franjaHoraria.horaInicio),
        horaFinMin: horaToMin(a.franjaHoraria.horaFin),
        bloqueId: a.id,
        readOnly: true,
        key: key
      };
      grupos.push(grupoActual);
    }

    // Eliminar la propiedad key temporal de los grupos
    return grupos.map(({ key, ...rest }) => rest);
  }, [asignaciones]);

  // ── Build pendientes ──────────────────────────────────
  const buildPendientes = useCallback((): BloquePendiente[] => {
    const result: BloquePendiente[] = [];
    // Si es docente, no mostrar pendientes de lectivas
    if (!isDocente) {
      for (const a of cargasLectivas) {
        const cursoNombre = a.grupo?.curso?.nombre || 'Curso';
        const tipo = a.tipo;
        result.push({
          uid: `lect-${a.id}`,
          tipoOrigen: 'lectiva', origenId: a.id, subtipo: tipo,
          nombre: `${cursoNombre} (${tipo === 'TEORIA' ? 'Teoría' : tipo === 'PRACTICA' ? 'Práctica' : 'Lab'})`,
          horasTotales: a.horasAsignadas, horasColocadas: 0, color: colorFromTipo('lectiva', tipo),
        });
      }
    }
    for (const n of cargasNoLectivas) {
      const tipoLabel = TIPO_NOMBRE[n.tipo]?.replace(/^\d+\.\s*/, '') || n.tipo;
      result.push({
        uid: `nolect-${n.id}`,
        tipoOrigen: 'no_lectiva', origenId: n.id, subtipo: null,
        nombre: `${tipoLabel}${n.descripcion ? ': ' + n.descripcion : ''}`,
        horasTotales: n.horas, horasColocadas: 0, color: colorFromTipo(n.tipo),
      });
    }
    return result;
  }, [cargasLectivas, cargasNoLectivas, isDocente]);

  const [bloquesColocados, setBloquesColocados] = useState<BloqueColocado[]>([]);
  // pendientes: TODOS los bloques siempre visibles (incluso completados)
  const [pendientes, setPendientes] = useState<BloquePendiente[]>([]);
  // duración seleccionada por tarjeta: uid -> horas
  const [durationByUid, setDurationByUid] = useState<Record<string, number>>({});
  const [changed, setChanged] = useState(false);

  function getDuration(uid: string): number {
    return durationByUid[uid] ?? 2; // default 2h
  }

  function setDuration(uid: string, h: number) {
    setDurationByUid(prev => ({ ...prev, [uid]: h }));
  }

  useEffect(() => {
    const base = buildPendientes();
    const colocados: BloqueColocado[] = [...bloquesAsignados];

    for (const b of bloquesGuardados) {
      let nombre = '';
      let tipoOrigen: 'lectiva' | 'no_lectiva' = b.tipoOrigen as any;
      if (b.tipoOrigen === 'lectiva') {
        const asign = cargasLectivas.find((a: any) => a.id === b.origenId);
        nombre = `${asign?.grupo?.curso?.nombre || 'Curso'} (${b.subtipo === 'TEORIA' ? 'Teoría' : b.subtipo === 'PRACTICA' ? 'Práctica' : 'Lab'})`;
      } else {
        const carga = cargasNoLectivas.find((n: any) => n.id === b.origenId);
        const tipoLabel = TIPO_NOMBRE[carga?.tipo]?.replace(/^\d+\.\s*/, '') || carga?.tipo;
        nombre = `${tipoLabel}${carga?.descripcion ? ': ' + carga.descripcion : ''}`;
      }
      colocados.push({
        uid: `saved-${b.id}`, tipoOrigen, origenId: b.origenId, subtipo: b.subtipo,
        nombre, horasTotales: 0, horasColocadas: (horaToMin(b.horaFin) - horaToMin(b.horaInicio)) / 60,
        color: colorFromTipo(tipoOrigen, b.subtipo),
        diaSemana: b.diaSemana, horaInicio: b.horaInicio, horaFin: b.horaFin,
        horaInicioMin: horaToMin(b.horaInicio), horaFinMin: horaToMin(b.horaFin),
        bloqueId: b.id,
      });
    }

    const colocadosPorOrigen: Record<string, number> = {};
    for (const c of colocados) if (!c.readOnly) colocadosPorOrigen[c.origenId] = (colocadosPorOrigen[c.origenId] || 0) + c.horasColocadas;

    // TODOS los bloques base, con horasColocadas actualizado
    const allPends = base.map(p => ({ ...p, horasColocadas: colocadosPorOrigen[p.origenId] || 0 }));
    setBloquesColocados(colocados);
    setPendientes(allPends);
    // Inicializar duraciones por defecto
    const initDurations: Record<string, number> = {};
    for (const p of allPends) initDurations[p.uid] = 2;
    setDurationByUid(prev => ({ ...initDurations, ...prev }));
    setChanged(false);
  }, [bloquesGuardados, cargasLectivas, cargasNoLectivas, buildPendientes, bloquesAsignados]);

  // ── Drag & Drop (Dispensador) ──────────────────────────
  const draggedRef = useRef<{ uid: string; duracion: number; tipoOrigen: string; origenId: string; subtipo: string | null; nombre: string; color: string } | null>(null);

  function handleDragStart(e: React.DragEvent, block: BloquePendiente) {
    const pendiente = block.horasTotales - block.horasColocadas;
    if (pendiente <= 0) { e.preventDefault(); return; }
    const dur = Math.min(getDuration(block.uid), pendiente);
    draggedRef.current = { uid: block.uid, duracion: dur, tipoOrigen: block.tipoOrigen, origenId: block.origenId, subtipo: block.subtipo, nombre: block.nombre, color: block.color };
    e.dataTransfer.setData('text/plain', block.uid);
    e.dataTransfer.effectAllowed = 'move';
  }

  function handleColocadoDragStart(e: React.DragEvent, block: BloqueColocado) {
    if ((block as any).readOnly) { e.preventDefault(); return; }
    draggedRef.current = { uid: block.uid, duracion: block.horasColocadas, tipoOrigen: block.tipoOrigen, origenId: block.origenId, subtipo: block.subtipo, nombre: block.nombre, color: block.color };
    e.dataTransfer.setData('text/plain', block.uid);
    e.dataTransfer.effectAllowed = 'move';
  }

  function recalcular(colocados: BloqueColocado[]) {
    const base = buildPendientes();
    const map: Record<string, number> = {};
    for (const c of colocados) if (!(c as any).readOnly) map[c.origenId] = (map[c.origenId] || 0) + c.horasColocadas;
    setPendientes(base.map(p => ({ ...p, horasColocadas: map[p.origenId] || 0 })));
  }

  function handleDrop(e: React.DragEvent, dia: string, horaMin: number) {
    e.preventDefault();
    const info = draggedRef.current;
    if (!info) return;

    const duracion = info.duracion;
    if (duracion <= 0) return;

    // Check for conflicts with read-only blocks first!
    const solapaAsignados = bloquesAsignados.some(c => {
      if (c.diaSemana !== dia) return false;
      const hInicio = horaMin;
      const hFin = hInicio + duracion * 60;
      return hInicio < c.horaFinMin && c.horaInicioMin < hFin;
    });
    if (solapaAsignados) { alert('Conflicto con un horario asignado por la secretaría.'); return; }

    // Si es un bloque ya colocado, verificar no exceder
    if (info.uid.startsWith('placed-') || info.uid.startsWith('saved-')) {
      const pendiente = pendientes.find(p => p.origenId === info.origenId);
      const pend = pendiente ? pendiente.horasTotales - pendiente.horasColocadas : 0;
      if (duracion > pend + duracion) { alert('Excede horas disponibles.'); return; } // already counting self
    } else {
      const pendiente = pendientes.find(p => p.uid === info.uid);
      const pend = pendiente ? pendiente.horasTotales - pendiente.horasColocadas : 0;
      if (duracion > pend) { alert(`Solo quedan ${pend}h pendientes.`); return; }
    }

    const hInicio = horaMin;
    const hFin = hInicio + duracion * 60;
    if (hInicio < HORAS_INICIO * 60 || hFin > HORAS_FIN * 60) { alert('Fuera del rango 07:00-22:00'); return; }

    const solapa = bloquesColocados.some(c => {
      if (c.diaSemana !== dia) return false;
      if (c.uid === info.uid) return false;
      return hInicio < c.horaFinMin && c.horaInicioMin < hFin;
    });
    if (solapa) { alert('Conflicto de horario con otro bloque propio.'); return; }

    // Validar solapamiento con otros docentes (cross-teacher)
    const solapaOtro = allBloquesPeriodo.some((ob: any) => {
      if (ob.docenteId === docenteId) return false;
      if (ob.diaSemana !== dia) return false;
      return hInicio < horaToMin(ob.horaFin) && horaToMin(ob.horaInicio) < hFin;
    });
    if (solapaOtro) {
      const otro = allBloquesPeriodo.find((ob: any) => ob.docenteId !== docenteId && ob.diaSemana === dia && hInicio < horaToMin(ob.horaFin) && horaToMin(ob.horaInicio) < hFin);
      alert(`Conflicto con otro docente (${otro?.docente?.nombre || 'desconocido'}): ya tiene bloque en ${dia} ${minToHora(hInicio)}-${minToHora(hFin)}.`);
      return;
    }

    // Si es reubicación, quitar el original
    let nuevos = bloquesColocados.filter(c => c.uid !== info.uid);

    const nb: BloqueColocado = {
      uid: `placed-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      tipoOrigen: info.tipoOrigen as 'lectiva' | 'no_lectiva',
      origenId: info.origenId, subtipo: info.subtipo,
      nombre: info.nombre, horasTotales: 0, horasColocadas: duracion,
      color: info.color, diaSemana: dia, horaInicio: minToHora(hInicio), horaFin: minToHora(hFin),
      horaInicioMin: hInicio, horaFinMin: hFin,
    };
    setBloquesColocados([...nuevos, nb]);
    recalcular([...nuevos, nb]);
    setChanged(true);
    draggedRef.current = null;
  }

  function handleRemove(uid: string) {
    const block = bloquesColocados.find(c => c.uid === uid);
    if (block && (block as any).readOnly) { return; }
    const n = bloquesColocados.filter(c => c.uid !== uid);
    setBloquesColocados(n);
    recalcular(n);
    setChanged(true);
  }

  function handleClear() {
    if (confirm('¿Limpiar todo el horario?')) {
      const nuevosBloques = bloquesColocados.filter(c => (c as any).readOnly);
      setBloquesColocados(nuevosBloques);
      setPendientes(buildPendientes());
      setChanged(true);
    }
  }

  function handleSave() {
    const bloques = bloquesColocados
      .filter(c => !(c as any).readOnly)
      .map(c => ({
        id: c.bloqueId, tipoOrigen: c.tipoOrigen, origenId: c.origenId, subtipo: c.subtipo,
        diaSemana: c.diaSemana, horaInicio: c.horaInicio, horaFin: c.horaFin,
      }));
    saveMutation.mutate({ docenteId, periodoId, bloques: bloques as any });
  }

  function handleClose() { if (changed && !confirm('Hay cambios sin guardar. ¿Salir?')) return; onClose(); }

  const horasGrid = useMemo(() => { const h: string[] = []; for (let i = HORAS_INICIO; i < HORAS_FIN; i++) h.push(`${String(i).padStart(2, '0')}:00`); return h; }, []);
  const totalColocadas = bloquesColocados.reduce((s, c) => s + c.horasColocadas, 0);
  const excede = totalColocadas > horasContrato;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-1">
      <div className="bg-white w-full h-full flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 border-b border-slate-300 bg-slate-100">
          <div>
            <h2 className="text-lg font-bold text-slate-800">Editor de Horario Semanal</h2>
            <p className="text-xs text-slate-500">Arrastre los bloques del panel izquierdo hacia la cuadrícula</p>
          </div>
          <div className="flex items-center gap-2">
            <div className={`text-sm font-bold px-3 py-1 rounded ${excede ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
              Ubicadas: {totalColocadas}h / {horasContrato}h
            </div>
            <button onClick={handleClear} className="px-3 py-1.5 text-sm border border-slate-300 rounded hover:bg-slate-200">Limpiar</button>
            <button onClick={handleClose} className="px-3 py-1.5 text-sm border border-slate-300 rounded hover:bg-slate-200">Cancelar</button>
            <button onClick={handleSave} disabled={saveMutation.isPending}
              className="bg-blue-800 hover:bg-blue-900 text-white font-bold px-5 py-1.5 rounded text-sm">
              {saveMutation.isPending ? 'Guardando...' : 'Guardar Horario'}
            </button>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Panel lateral */}
          <div className="w-72 border-r border-slate-300 bg-slate-50 p-3 overflow-y-auto shrink-0">
            <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Dispensador de Horas</h3>

            <h4 className="text-[11px] font-bold text-slate-700 border-b border-slate-200 pb-1 mb-2">Carga No Lectiva</h4>
            <div className="space-y-1.5 mb-3">
              {pendientes.filter(b => b.tipoOrigen === 'no_lectiva').map(b => {
                const pend = b.horasTotales - b.horasColocadas;
                const done = pend <= 0;
                const dur = getDuration(b.uid);
                return (
                  <div key={b.uid} className={`border-2 ${b.color} rounded p-1.5 text-[11px] font-medium shadow-sm ${done ? 'opacity-40 grayscale' : 'hover:shadow'}`}>
                    <div className="flex items-center gap-1">
                      <GripVertical className="h-3 w-3 opacity-40 shrink-0" />
                      <span className="truncate font-semibold flex-1">{b.nombre}</span>
                    </div>
                    <div className="flex items-center justify-between mt-0.5">
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${done ? 'bg-green-100 text-green-700' : 'bg-red-50 text-red-600'}`}>
                        {done ? '✓ Completado' : `Pendiente: ${pend}h / ${b.horasTotales}h`}
                      </span>
                    </div>
                    {!done && (
                      <div className="flex items-center gap-1 mt-1 pt-1 border-t border-slate-200">
                        <select
                          value={dur}
                          onChange={e => setDuration(b.uid, Number(e.target.value))}
                          className="text-[10px] border border-slate-300 rounded px-1 py-0"
                        >
                          {Array.from({ length: Math.min(4, pend) }, (_, i) => i + 1).map(n => <option key={n} value={n}>{n}h</option>)}
                        </select>
                        <span className="text-[9px] text-slate-400">por bloque</span>
                      </div>
                    )}
                    {!done && (
                      <div
                        draggable
                        onDragStart={e => handleDragStart(e, b)}
                        className="mt-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 text-[10px] font-bold text-center py-0.5 rounded cursor-grab active:cursor-grabbing"
                      >
                        Arrastrar {Math.min(dur, pend)}h
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Leyenda */}
            <div className="mt-4 pt-3 border-t border-slate-200">
              <h4 className="text-[10px] font-bold text-slate-400 uppercase mb-1.5">Leyenda</h4>
              <div className="grid grid-cols-2 gap-0.5 text-[9px]">
                {[
                  ['bg-blue-50 border border-blue-300', 'Teoría'],
                  ['bg-emerald-50 border border-emerald-300', 'Práctica'],
                  ['bg-amber-50 border border-amber-300', 'Laboratorio'],
                  ['bg-violet-50 border border-violet-300', 'Consejería'],
                  ['bg-cyan-50 border border-cyan-300', 'Investigación'],
                  ['bg-slate-100 border border-slate-300', 'Admin/Gobierno'],
                ].map(([color, label]) => (
                  <div key={label} className="flex items-center gap-1"><div className={`w-2.5 h-2.5 rounded-sm ${color}`}></div>{label}</div>
                ))}
              </div>
            </div>
          </div>

          {/* Cuadrícula */}
          <div className="flex-1 overflow-auto">
            <div className="min-w-[900px]">
              {/* Días */}
              <div className="grid grid-cols-7 sticky top-0 bg-white z-10 border-b-2 border-slate-400">
                <div className="py-2 text-center text-xs font-bold text-slate-400 uppercase">Hora</div>
                {DIAS.map(dia => (
                  <div key={dia} className="py-2 text-center text-sm font-bold text-slate-700 border-l border-slate-200 uppercase">
                    {dia.slice(0, 3)}
                  </div>
                ))}
              </div>

              {horasGrid.map(hora => {
                const hm = horaToMin(hora);
                const hf = hm + 60;
                return (
                  <div key={hora} className="grid grid-cols-7 border-b border-slate-200 min-h-[56px] relative">
                    <div className="py-1 text-center text-xs font-medium text-slate-400 border-r border-slate-100 flex items-center justify-center bg-white">
                      {hora}
                    </div>
                    {DIAS.map(dia => {
                      const enCelda = bloquesColocados.filter(c =>
                        c.diaSemana === dia && c.horaInicioMin >= hm && c.horaInicioMin < hf
                      );
                      return (
                        <div key={dia} className="border-l border-slate-100 relative"
                          onDragOver={e => e.preventDefault()} onDrop={e => handleDrop(e, dia, hm)}>
                          {enCelda.map(b => {
                            const dur = b.horasColocadas;
                            const top = ((horaToMin(b.horaInicio) - hm) / 60) * 100;
                            const h = dur * 56; // 56px por hora
                            const isReadOnly = (b as any).readOnly;
                            return (
                              <div key={b.uid} 
                                draggable={!isReadOnly} 
                                onDragStart={isReadOnly ? undefined : (e => handleColocadoDragStart(e, b))}
                                className={`absolute left-0.5 right-0.5 border-2 ${b.color} rounded p-0.5 ${isReadOnly ? 'cursor-default' : 'cursor-grab'} overflow-hidden shadow-sm z-10 flex flex-col items-center justify-center`}
                                style={{ top: `${top}%`, height: `${h}px`, minHeight: '28px' }}>
                                {!isReadOnly && (
                                  <button onClick={e => { e.stopPropagation(); handleRemove(b.uid); }}
                                    className="absolute top-0.5 right-0.5 text-slate-500 hover:text-red-600 leading-none"><X className="h-2 w-2" /></button>
                                )}
                                <span className="text-[11px] font-bold text-center leading-tight px-1 line-clamp-2 w-full">{b.nombre}</span>
                                <span className="text-[9px] opacity-50">{b.horaInicio}-{b.horaFin}</span>
                              </div>
                            );
                          })}
                          {enCelda.length === 0 && <div className="w-full h-full min-h-[56px]" />}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
