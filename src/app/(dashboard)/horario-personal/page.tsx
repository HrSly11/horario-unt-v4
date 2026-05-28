'use client';

import { useTRPC } from '@/trpc/client';
import { useQuery } from '@tanstack/react-query';
import { WeeklyGrid } from './components/WeeklyGrid';
import { useState } from 'react';
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

export default function HorarioPersonalPage() {
  const trpc = useTRPC();
  const [periodoId, setPeriodoId] = useState('');

  const { data: user } = useQuery({ ...trpc.auth.me.queryOptions() });
  const docenteId = user?.docenteId || '';

  const { data: periodos = [] } = useQuery({
    ...trpc.periodo.list.queryOptions(),
    enabled: true,
  });

  const activePeriodo = periodoId || (periodos.length > 0 ? periodos[0].id : '');

  const { data: cargaLectiva } = useQuery({
    ...trpc.cargaLectiva.byDocente.queryOptions({
      docenteId,
      periodoId: activePeriodo,
    }),
    enabled: !!docenteId && !!activePeriodo,
    refetchInterval: 30000,
  });

  const { data: docente } = useQuery({
    ...trpc.docente.byId.queryOptions({ id: docenteId }),
    enabled: !!docenteId,
  });

  const DIAS = ['LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO'];

  const slots = DIAS.flatMap((dia) =>
    Array.from({ length: 15 }, (_, i) => {
      const hora = `${(7 + i).toString().padStart(2, '0')}:00`;
      const lectiva = cargaLectiva?.asignaciones?.find((a) => false);
      return {
        dia,
        horaInicio: hora,
        ocupado: false,
        readonly: false,
      } as SlotItem;
    })
  );

  const dailyTotals: Record<string, number> = {};
  DIAS.forEach((d) => {
    dailyTotals[d] = slots.filter((s) => s.dia === d && s.ocupado).length;
  });

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
      </div>
    </div>
  );
}
