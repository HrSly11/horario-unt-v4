'use client';

import { useTRPC } from '@/trpc/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { WeeklyGrid } from './components/WeeklyGrid';
import { AsignarHorarioModal } from './components/AsignarHorarioModal';
import { useMemo, useState } from 'react';
import { Clock, BookOpen, AlertTriangle, CalendarPlus, Pencil, Trash2, Download, FileText, Loader2 } from 'lucide-react';

interface SlotItem {
  dia: string;
  horaInicio: string;
  ocupado: boolean;
  tipo?: string;
  label?: string;
  readonly?: boolean;
  onClick?: () => void;
}

const DIAS = ['LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO'];
const HORAS = Array.from({ length: 15 }, (_, i) => `${(7 + i).toString().padStart(2, '0')}:00`);

const TIPO_NO_LECTIVA_LABELS: Record<string, string> = {
  PREPARACION_EVALUACION: 'Prep. y Eval.',
  CONSEJERIA: 'Consejería',
  INVESTIGACION: 'Investigación',
  CAPACITACION: 'Capacitación',
  GOBIERNO: 'Gobierno',
  ADMINISTRACION: 'Administración',
  ASESORIA_TESIS: 'Ases. Tesis',
  RESPONSABILIDAD_SOCIAL: 'Resp. Social',
  COMITES_COMISIONES: 'Comités',
};

/**
 * Parse an "HH:00" hour string into its numeric hour value.
 */
function parseHour(time: string): number {
  return parseInt(time.split(':')[0], 10);
}

function downloadBase64PDF(base64: string, filename: string) {
  const byteCharacters = atob(base64);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  const blob = new Blob([byteArray], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export default function HorarioPersonalPage() {
  const trpc = useTRPC();
  const [periodoId, setPeriodoId] = useState('');
  const [cargaParaHorario, setCargaParaHorario] = useState<any | null>(null);
  const [downloadingFormato3, setDownloadingFormato3] = useState<'FORMAL' | 'TABLA' | null>(null);

  // ─── Auth & base data ───────────────────────────────
  const { data: user } = useQuery({ ...trpc.auth.me.queryOptions() });
  const docenteId = user?.docenteId || '';

  const { data: periodos = [] } = useQuery({
    ...trpc.periodo.list.queryOptions(),
    enabled: true,
  });

  const activePeriod = periodos.find((p) => p.activo);
  const activePeriodo = periodoId || activePeriod?.id || (periodos.length > 0 ? periodos[0].id : '');

  // ─── Carga lectiva summary (stat cards) ─────────────
  const { data: cargaLectiva } = useQuery({
    ...trpc.cargaLectiva.byDocente.queryOptions({
      docenteId,
      periodoId: activePeriodo,
    }),
    enabled: !!docenteId && !!activePeriodo,
    refetchInterval: 30000,
  });

  // ─── Teaching assignments (grid data) ───────────────
  const { data: asignacionesData } = useQuery({
    ...trpc.horario.byDocente.queryOptions({
      docenteId,
      periodoId: activePeriodo,
    }),
    enabled: !!docenteId && !!activePeriodo,
    refetchInterval: 30000,
  });
  const asignaciones = (asignacionesData ?? []) as any[];

  // ─── Non-teaching activities with horarios ──────────
  const { data: cargasNoLectivas = [] } = useQuery({
    ...trpc.cargaNoLectiva.list.queryOptions({
      docenteId,
      periodoId: activePeriodo,
    }),
    enabled: !!docenteId && !!activePeriodo,
    refetchInterval: 30000,
  });

  // ─── Docente info (contract hours) ──────────────────
  const { data: docente } = useQuery({
    ...trpc.docente.byId.queryOptions({ id: docenteId }),
    enabled: !!docenteId,
  });

  const { data: declaracionActual } = useQuery({
    ...trpc.declaracion.byDocente.queryOptions({
      docenteId,
      periodoId: activePeriodo,
    }),
    enabled: !!docenteId && !!activePeriodo,
  });

  const generateFormato3Mutation = useMutation(
    trpc.declaracionPDF.generate.mutationOptions({
      onSuccess: (data) => {
        downloadBase64PDF(data.pdfBase64, data.filename);
        setDownloadingFormato3(null);
      },
      onError: (error) => {
        setDownloadingFormato3(null);
        alert(error.message || 'No se pudo generar el Formato 3.');
      },
    })
  );

  // ─── Build slots ───────────────────────────────────
  const slots = useMemo(() => {
    // Index occupied slots by "DIA-HH:00" key
    const occupied = new Map<string, SlotItem>();

    // 1. Teaching assignments → one slot per franjaHoraria
    for (const asig of asignaciones) {
      const franja = asig.franjaHoraria;
      if (!franja) continue;
      const key = `${franja.dia}-${franja.horaInicio}`;
      const curso = asig.grupo?.curso;
      const label = curso
        ? `${curso.codigo} - ${asig.grupo.nombre}`
        : asig.grupo?.nombre || '';
      occupied.set(key, {
        dia: franja.dia,
        horaInicio: franja.horaInicio,
        ocupado: true,
        tipo: asig.tipo,
        label,
        readonly: true,
      });
    }

    // 2. Non-teaching activities → expand each horario block into 1h slots
    for (const carga of cargasNoLectivas) {
      const tipoLabel = TIPO_NO_LECTIVA_LABELS[carga.tipo] || carga.tipo;
      const horarios = (carga as { horarios?: Array<{ dia: string; horaInicio: string; horaFin: string }> }).horarios;
      if (!horarios || horarios.length === 0) continue;

      for (const horario of horarios) {
        const startHour = parseHour(horario.horaInicio);
        const endHour = parseHour(horario.horaFin);
        for (let h = startHour; h < endHour; h++) {
          const hora = `${h.toString().padStart(2, '0')}:00`;
          const key = `${horario.dia}-${hora}`;
          // Don't overwrite teaching assignments
          if (!occupied.has(key)) {
            occupied.set(key, {
              dia: horario.dia,
              horaInicio: hora,
              ocupado: true,
              tipo: carga.tipo,
              label: tipoLabel,
              readonly: true,
            });
          }
        }
      }
    }

    // 3. Build complete grid: all days × all hours
    return DIAS.flatMap((dia) =>
      HORAS.map((hora) => {
        const key = `${dia}-${hora}`;
        return occupied.get(key) || {
          dia,
          horaInicio: hora,
          ocupado: false,
          readonly: true,
        };
      })
    );
  }, [asignaciones, cargasNoLectivas]);

  // ─── Daily totals ──────────────────────────────────
  const dailyTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    DIAS.forEach((d) => {
      totals[d] = slots.filter((s) => s.dia === d && s.ocupado).length;
    });
    return totals;
  }, [slots]);

  const horasContrato = docente?.horasContrato || 0;
  const totalGeneral = cargaLectiva?.totalGeneral || 0;
  const horasCargaCompletas = totalGeneral >= horasContrato && horasContrato > 0;
  const horasFaltantes = Math.max(0, horasContrato - totalGeneral);
  const motivoBloqueoFormato3 = !declaracionActual
    ? 'Crea primero tu declaración de carga en el módulo Declaraciones para habilitar el Formato 3.'
    : !horasCargaCompletas
      ? `Completa ${horasFaltantes}h adicionales para habilitar la descarga del Formato 3 oficial.`
      : null;

  function handleDescargarFormato3(diseno: 'FORMAL' | 'TABLA') {
    if (!declaracionActual || motivoBloqueoFormato3) {
      alert(motivoBloqueoFormato3 || 'No hay una declaración disponible para este periodo.');
      return;
    }

    setDownloadingFormato3(diseno);
    generateFormato3Mutation.mutate({
      declaracionId: declaracionActual.id,
      formato: 'N3',
      disenoN3: diseno,
    });
  }

  // ─── Guard: not a docente ──────────────────────────
  if (!docenteId) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-6 text-center">
          <AlertTriangle className="w-12 h-12 text-amber-400 mx-auto mb-3" />
          <h2 className="text-lg font-semibold text-amber-400">Acceso Restringido</h2>
          <p className="text-zinc-400 mt-2">Solo los docentes pueden acceder a su horario personal.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Horario Personal</h1>
          <p className="text-zinc-400 text-sm mt-1">Visualiza tu carga horaria semanal</p>
        </div>
        <select
          value={activePeriodo}
          onChange={(e) => setPeriodoId(e.target.value)}
          className="bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-white text-sm"
        >
          {periodos.map((p) => (
            <option key={p.id} value={p.id}>{p.nombre}</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div className="bg-zinc-900/80 border border-zinc-800 rounded-lg p-4">
          <div className="flex items-center gap-2 text-zinc-400 mb-2">
            <BookOpen className="w-4 h-4" />
            <span className="text-sm">Carga Lectiva</span>
          </div>
          <p className="text-2xl font-bold text-white">{cargaLectiva?.totalLectivas || 0}h</p>
        </div>
        <div className="bg-zinc-900/80 border border-zinc-800 rounded-lg p-4">
          <div className="flex items-center gap-2 text-zinc-400 mb-2">
            <Clock className="w-4 h-4" />
            <span className="text-sm">Carga No Lectiva</span>
          </div>
          <p className="text-2xl font-bold text-white">{cargaLectiva?.totalNoLectivas || 0}h</p>
        </div>
        <div className="bg-zinc-900/80 border border-zinc-800 rounded-lg p-4">
          <div className="flex items-center gap-2 text-zinc-400 mb-2">
            <Clock className="w-4 h-4" />
            <span className="text-sm">Total General</span>
          </div>
          <p className="text-2xl font-bold text-green-400">{cargaLectiva?.totalGeneral || 0}h</p>
        </div>
        <div className="bg-zinc-900/80 border border-zinc-800 rounded-lg p-4">
          <div className="flex items-center gap-2 text-zinc-400 mb-2">
            <Clock className="w-4 h-4" />
            <span className="text-sm">Contrato</span>
          </div>
          <p className="text-2xl font-bold text-blue-400">{horasContrato}h</p>
        </div>
      </div>

      {/* Non-teaching activities pending horario assignment (columna izquierda)
          + Horario semanal (columna derecha) en un layout de 2 columnas */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <NonLectiveScheduleManager
          cargasNoLectivas={cargasNoLectivas as any[]}
          onAssign={(carga) => setCargaParaHorario(carga)}
        />

        <div className="bg-zinc-900/80 border border-zinc-800 rounded-lg p-4 lg:col-span-3">
          <h2 className="text-lg font-semibold text-white mb-4">Horario Semanal</h2>
          <WeeklyGrid slots={slots} dailyTotals={dailyTotals} />

          {/* Legend */}
          <div className="mt-6 border-t border-zinc-800 pt-4">
            <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">Leyenda de Actividades</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2">
            <div className="flex items-center gap-2 text-xs">
              <span className="w-3.5 h-3.5 rounded border border-blue-400 bg-blue-100 shrink-0"></span>
              <span className="text-zinc-300">Teoría</span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="w-3.5 h-3.5 rounded border border-green-400 bg-green-100 shrink-0"></span>
              <span className="text-zinc-300">Práctica</span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="w-3.5 h-3.5 rounded border border-purple-400 bg-purple-100 shrink-0"></span>
              <span className="text-zinc-300">Laboratorio</span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="w-3.5 h-3.5 rounded border border-yellow-400 bg-yellow-100 shrink-0"></span>
              <span className="text-zinc-300">Prep. y Eval.</span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="w-3.5 h-3.5 rounded border border-pink-400 bg-pink-100 shrink-0"></span>
              <span className="text-zinc-300">Consejería</span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="w-3.5 h-3.5 rounded border border-indigo-400 bg-indigo-100 shrink-0"></span>
              <span className="text-zinc-300">Investigación</span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="w-3.5 h-3.5 rounded border border-orange-400 bg-orange-100 shrink-0"></span>
              <span className="text-zinc-300">Capacitación</span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="w-3.5 h-3.5 rounded border border-red-400 bg-red-100 shrink-0"></span>
              <span className="text-zinc-300">Gobierno</span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="w-3.5 h-3.5 rounded border border-gray-400 bg-gray-200 shrink-0"></span>
              <span className="text-zinc-300">Administración</span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="w-3.5 h-3.5 rounded border border-teal-400 bg-teal-100 shrink-0"></span>
              <span className="text-zinc-300">Ases. Tesis</span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="w-3.5 h-3.5 rounded border border-lime-400 bg-lime-100 shrink-0"></span>
              <span className="text-zinc-300">Resp. Social</span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="w-3.5 h-3.5 rounded border border-cyan-400 bg-cyan-100 shrink-0"></span>
              <span className="text-zinc-300">Comités</span>
            </div>
          </div>
          </div>
        </div>
      </div>

      <div className="bg-zinc-900/80 border border-zinc-800 rounded-lg p-4 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-zinc-300">
              <FileText className="h-4 w-4 text-indigo-400" />
              <h2 className="text-lg font-semibold text-white">Descarga de Formato 3</h2>
            </div>
            <p className="text-sm text-zinc-400 mt-1">
              Descarga tu horario semanal en versión formal `F03-CAD` o en formato tabla como se visualiza en la grilla.
            </p>
          </div>
          <div className="text-sm">
            {motivoBloqueoFormato3 ? (
              <span className="inline-flex rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-amber-300">
                {motivoBloqueoFormato3}
              </span>
            ) : (
              <span className="inline-flex rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-emerald-300">
                Descarga habilitada para el periodo actual
              </span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <button
            onClick={() => handleDescargarFormato3('FORMAL')}
            disabled={!!motivoBloqueoFormato3 || generateFormato3Mutation.isPending}
            title={motivoBloqueoFormato3 || 'Descargar Formato 3 formal (F03-CAD)'}
            className="flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-3 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95"
          >
            {downloadingFormato3 === 'FORMAL' ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Generando F03-CAD...
              </>
            ) : (
              <>
                <Download className="h-4 w-4" />
                Descargar formato de presentación
              </>
            )}
          </button>

          <button
            onClick={() => handleDescargarFormato3('TABLA')}
            disabled={!!motivoBloqueoFormato3 || generateFormato3Mutation.isPending}
            title={motivoBloqueoFormato3 || 'Descargar horario semanal en formato tabla'}
            className="flex items-center justify-center gap-2 rounded-lg bg-zinc-800 border border-zinc-700 px-4 py-3 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95"
          >
            {downloadingFormato3 === 'TABLA' ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Generando tabla...
              </>
            ) : (
              <>
                <Download className="h-4 w-4" />
                Descargar formato tabla
              </>
            )}
          </button>
        </div>

        {!motivoBloqueoFormato3 && declaracionActual && (
          <p className="text-xs text-zinc-500">
            Estado de la declaración actual: {declaracionActual.estado.replace(/_/g, ' ')}.
          </p>
        )}
      </div>

      {/* Modal de asignación de franja horaria */}
      {cargaParaHorario && (
        <AsignarHorarioModal
          cargaNoLectiva={cargaParaHorario}
          onClose={() => setCargaParaHorario(null)}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// NonLectiveScheduleManager: lista de actividades no lectivas
// con su estado de horario (asignado / pendiente) y acceso al
// modal de asignación.
// ─────────────────────────────────────────────────────────
interface NonLectiveScheduleManagerProps {
  cargasNoLectivas: any[];
  onAssign: (carga: any) => void;
}

const NL_TIPO_LABEL: Record<string, string> = {
  PREPARACION_EVALUACION: 'Prep. y Evaluación',
  CONSEJERIA: 'Consejería',
  INVESTIGACION: 'Investigación',
  CAPACITACION: 'Capacitación',
  GOBIERNO: 'Gobierno',
  ADMINISTRACION: 'Administración',
  ASESORIA_TESIS: 'Asesoría de Tesis',
  RESPONSABILIDAD_SOCIAL: 'Responsabilidad Social',
  COMITES_COMISIONES: 'Comités / Comisiones',
  JURADOS: 'Jurados',
  AUTOEVALUACION_ACREDITACION: 'Autoeval. y Acreditación',
  OTRAS_AUTORIZADAS: 'Otras (autorizadas)',
};

const NL_TIPO_COLOR: Record<string, string> = {
  PREPARACION_EVALUACION: 'bg-yellow-500/15 text-yellow-300 border-yellow-500/30',
  CONSEJERIA: 'bg-pink-500/15 text-pink-300 border-pink-500/30',
  INVESTIGACION: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30',
  CAPACITACION: 'bg-orange-500/15 text-orange-300 border-orange-500/30',
  GOBIERNO: 'bg-red-500/15 text-red-300 border-red-500/30',
  ADMINISTRACION: 'bg-gray-500/15 text-gray-300 border-gray-500/30',
  ASESORIA_TESIS: 'bg-teal-500/15 text-teal-300 border-teal-500/30',
  RESPONSABILIDAD_SOCIAL: 'bg-lime-500/15 text-lime-300 border-lime-500/30',
  COMITES_COMISIONES: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30',
  JURADOS: 'bg-fuchsia-500/15 text-fuchsia-300 border-fuchsia-500/30',
  AUTOEVALUACION_ACREDITACION: 'bg-violet-500/15 text-violet-300 border-violet-500/30',
  OTRAS_AUTORIZADAS: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
};

function NonLectiveScheduleManager({ cargasNoLectivas, onAssign }: NonLectiveScheduleManagerProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [selectedPendienteId, setSelectedPendienteId] = useState<string>('');

  const removeHorarioMutation = useMutation(
    trpc.cargaNoLectiva.removeHorario.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: trpc.cargaNoLectiva.list.queryKey() });
        queryClient.invalidateQueries({ queryKey: trpc.horario.byDocente.queryKey() });
        queryClient.invalidateQueries({ queryKey: trpc.cargaLectiva.byDocente.queryKey() });
      },
      onError: (err) => alert(err.message),
    })
  );

  const sinHorario = useMemo(
    () => cargasNoLectivas.filter((c) => !c.horarios || c.horarios.length === 0),
    [cargasNoLectivas]
  );
  const conHorario = useMemo(
    () => cargasNoLectivas.filter((c) => c.horarios && c.horarios.length > 0),
    [cargasNoLectivas]
  );

  const selectedPendiente = useMemo(
    () => sinHorario.find((c) => c.id === selectedPendienteId) ?? null,
    [sinHorario, selectedPendienteId]
  );

  if (cargasNoLectivas.length === 0) return null;

  return (
    <div className="bg-zinc-900/80 border border-zinc-800 rounded-lg p-4 space-y-4 lg:col-span-2">
      <div className="flex items-center gap-2">
        <CalendarPlus className="w-5 h-5 text-indigo-400" />
        <h2 className="text-lg font-semibold text-white">Franjas Horarias</h2>
      </div>

      {/* Selector de actividad pendiente */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label
            htmlFor="select-actividad-pendiente"
            className="text-xs font-semibold text-amber-400 uppercase tracking-wider"
          >
            Pendientes de horario ({sinHorario.length})
          </label>
        </div>

        {sinHorario.length === 0 ? (
          <p className="text-sm text-zinc-500 italic">
            Todas tus actividades no lectivas tienen horario asignado.
          </p>
        ) : (
          <>
            <select
              id="select-actividad-pendiente"
              value={selectedPendienteId}
              onChange={(e) => setSelectedPendienteId(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
            >
              <option value="">— Selecciona una actividad pendiente —</option>
              {sinHorario.map((c) => (
                <option key={c.id} value={c.id}>
                  {NL_TIPO_LABEL[c.tipo] || c.tipo} · {c.horas}h
                  {c.descripcion ? ` · ${c.descripcion}` : ''}
                </option>
              ))}
            </select>

            {selectedPendiente && (
              <div className="bg-zinc-800/40 rounded-lg p-3 border border-amber-500/30 space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className={`px-2 py-0.5 rounded-md text-xs font-medium border ${
                      NL_TIPO_COLOR[selectedPendiente.tipo] ||
                      'bg-zinc-700 text-zinc-200 border-zinc-600'
                    }`}
                  >
                    {NL_TIPO_LABEL[selectedPendiente.tipo] || selectedPendiente.tipo}
                  </span>
                  <span className="text-sm text-white font-medium">
                    {selectedPendiente.horas}h
                  </span>
                  {selectedPendiente.descripcion && (
                    <span className="text-xs text-zinc-400" title={selectedPendiente.descripcion}>
                      · {selectedPendiente.descripcion}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => onAssign(selectedPendiente)}
                  className="w-full flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-500 shadow-lg shadow-indigo-500/25 transition-all active:scale-95"
                >
                  <CalendarPlus className="h-4 w-4" />
                  Asignar Franja Horaria
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Actividades con horario (para edición) */}
      {conHorario.length > 0 && (
        <div className="pt-4 border-t border-zinc-800">
          <h3 className="text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-2">
            Con horario ({conHorario.length})
          </h3>
          <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
            {conHorario.map((c) => (
              <div
                key={c.id}
                className="bg-zinc-800/40 rounded-lg p-3 border border-zinc-700"
              >
                <div className="flex items-center justify-between mb-2 gap-2">
                  <div className="flex items-center gap-2 flex-wrap min-w-0">
                    <span
                      className={`px-2 py-0.5 rounded-md text-xs font-medium border ${
                        NL_TIPO_COLOR[c.tipo] || 'bg-zinc-700 text-zinc-200 border-zinc-600'
                      }`}
                    >
                      {NL_TIPO_LABEL[c.tipo] || c.tipo}
                    </span>
                    <span className="text-sm text-white">{c.horas}h</span>
                    {c.descripcion && (
                      <span className="text-xs text-zinc-400 truncate" title={c.descripcion}>
                        · {c.descripcion}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => onAssign(c)}
                    className="flex items-center gap-1.5 rounded-lg bg-zinc-700 px-2.5 py-1 text-xs font-medium text-zinc-100 hover:bg-zinc-600 transition-all active:scale-95 shrink-0"
                    title="Editar franjas horarias"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    Editar
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {c.horarios.map((h: any) => (
                    <div
                      key={h.id}
                      className="flex items-center gap-1.5 bg-zinc-900/60 rounded-md px-2 py-1 text-xs border border-zinc-700"
                    >
                      <Clock className="h-3 w-3 text-zinc-400" />
                      <span className="text-zinc-200">
                        {h.dia.charAt(0) + h.dia.slice(1).toLowerCase()} {h.horaInicio}–{h.horaFin}
                      </span>
                      <button
                        onClick={() => removeHorarioMutation.mutate({ horarioId: h.id })}
                        disabled={removeHorarioMutation.isPending}
                        className="text-zinc-500 hover:text-red-400 transition-colors ml-1"
                        title="Eliminar esta franja"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
