'use client';

import { useTRPC } from '@/trpc/client';
import { useQuery } from '@tanstack/react-query';
import { WeeklyGrid } from './components/WeeklyGrid';
import { useMemo, useState } from 'react';
import { Clock, BookOpen, AlertTriangle } from 'lucide-react';

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

export default function HorarioPersonalPage() {
  const trpc = useTRPC();
  const [periodoId, setPeriodoId] = useState('');

  // ─── Auth & base data ───────────────────────────────
  const { data: user } = useQuery({ ...trpc.auth.me.queryOptions() });
  const docenteId = user?.docenteId || '';

  const { data: periodos = [] } = useQuery({
    ...trpc.periodo.list.queryOptions(),
    enabled: true,
  });

  const activePeriodo = periodoId || (periodos.length > 0 ? periodos[0].id : '');

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
  const { data: asignaciones = [] } = useQuery({
    ...trpc.horario.byDocente.queryOptions({
      docenteId,
      periodoId: activePeriodo,
    }),
    enabled: !!docenteId && !!activePeriodo,
    refetchInterval: 30000,
  });

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
          <p className="text-2xl font-bold text-blue-400">{docente?.horasContrato || 0}h</p>
        </div>
      </div>

      <div className="bg-zinc-900/80 border border-zinc-800 rounded-lg p-4">
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
  );
}
