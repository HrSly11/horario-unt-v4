'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTRPC } from '@/trpc/client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { X, Plus, Trash2, AlertTriangle, Loader2, Save } from 'lucide-react';

const DIAS = ['LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO'] as const;
type Dia = typeof DIAS[number];

interface FranjaInput {
  dia: Dia;
  horaInicio: string;
  horaFin: string;
}

interface Props {
  cargaNoLectiva: {
    id: string;
    tipo: string;
    horas: number;
    descripcion?: string | null;
    horarios: Array<{ id?: string; dia: string; horaInicio: string; horaFin: string; lugar?: string | null; aula?: string | null }>;
  };
  onClose: () => void;
}

function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map((x) => parseInt(x, 10));
  return h * 60 + (m || 0);
}

function minutesToTime(m: number): string {
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${h.toString().padStart(2, '0')}:${mm.toString().padStart(2, '0')}`;
}

function franjasOverlap(a: FranjaInput, b: FranjaInput): boolean {
  if (a.dia !== b.dia) return false;
  const aStart = timeToMinutes(a.horaInicio);
  const aEnd = timeToMinutes(a.horaFin);
  const bStart = timeToMinutes(b.horaInicio);
  const bEnd = timeToMinutes(b.horaFin);
  return aStart < bEnd && bStart < aEnd;
}

function franjaDuration(f: FranjaInput): number {
  return (timeToMinutes(f.horaFin) - timeToMinutes(f.horaInicio)) / 60;
}

const HORAS_OPTIONS = (() => {
  const arr: string[] = [];
  for (let h = 7; h <= 21; h++) {
    arr.push(`${h.toString().padStart(2, '0')}:00`);
  }
  return arr;
})();

const TIPO_LABEL: Record<string, string> = {
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

export function AsignarHorarioModal({ cargaNoLectiva, onClose }: Props) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  // Franjas a crear/reemplazar. Si no hay franjas existentes, empezamos con una vacía.
  const initial: FranjaInput[] = cargaNoLectiva.horarios.length > 0
    ? cargaNoLectiva.horarios.map((h) => ({
        dia: h.dia as Dia,
        horaInicio: h.horaInicio,
        horaFin: h.horaFin,
      }))
    : [{ dia: 'LUNES', horaInicio: '07:00', horaFin: '08:00' }];

  const [franjas, setFranjas] = useState<FranjaInput[]>(initial);
  const [error, setError] = useState<string | null>(null);

  // Horas totales planificadas: suma de las duraciones de las franjas.
  const totalFranjasHoras = useMemo(
    () => franjas.reduce((s, f) => s + franjaDuration(f), 0),
    [franjas]
  );

  const asignarMutation = useMutation(
    trpc.cargaNoLectiva.asignarHorario.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: trpc.cargaNoLectiva.list.queryKey() });
        queryClient.invalidateQueries({ queryKey: trpc.horario.byDocente.queryKey() });
        queryClient.invalidateQueries({ queryKey: trpc.cargaLectiva.byDocente.queryKey() });
        onClose();
      },
      onError: (err) => {
        setError(err.message);
      },
    })
  );

  function updateFranja(idx: number, patch: Partial<FranjaInput>) {
    setFranjas((prev) => prev.map((f, i) => (i === idx ? { ...f, ...patch } : f)));
  }

  function removeFranja(idx: number) {
    setFranjas((prev) => prev.filter((_, i) => i !== idx));
  }

  function addFranja() {
    // Sugerir el mismo día que la primera franja, y la siguiente hora libre
    const last = franjas[franjas.length - 1];
    setFranjas((prev) => [
      ...prev,
      {
        dia: last?.dia ?? 'LUNES',
        horaInicio: last?.horaFin ?? '07:00',
        horaFin: minutesToTime(timeToMinutes(last?.horaFin ?? '08:00') + 60),
      },
    ]);
  }

  function validateLocal(): string | null {
    if (franjas.length === 0) {
      return 'Agrega al menos una franja horaria (o cierra el modal para dejar la actividad sin horario).';
    }
    for (const f of franjas) {
      if (timeToMinutes(f.horaFin) <= timeToMinutes(f.horaInicio)) {
        return `La franja ${f.dia} ${f.horaInicio}-${f.horaFin} termina antes de empezar.`;
      }
    }
    for (let i = 0; i < franjas.length; i++) {
      for (let j = i + 1; j < franjas.length; j++) {
        if (franjasOverlap(franjas[i], franjas[j])) {
          return `Las franjas ${i + 1} y ${j + 1} se solapan entre sí.`;
        }
      }
    }
    if (totalFranjasHoras > cargaNoLectiva.horas) {
      return `Las horas de las franjas (${totalFranjasHoras}h) superan las horas de la actividad (${cargaNoLectiva.horas}h). Ajusta la duración o las horas de la actividad.`;
    }
    return null;
  }

  function handleSave() {
    const localError = validateLocal();
    if (localError) {
      setError(localError);
      return;
    }
    setError(null);
    asignarMutation.mutate({
      cargaNoLectivaId: cargaNoLectiva.id,
      horarios: franjas,
    });
  }

  useEffect(() => {
    setError(null);
  }, [franjas]);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-zinc-800">
          <div>
            <h3 className="text-lg font-semibold text-white">Asignar Horario a Actividad No Lectiva</h3>
            <p className="text-xs text-zinc-400 mt-0.5">
              {TIPO_LABEL[cargaNoLectiva.tipo] || cargaNoLectiva.tipo} · {cargaNoLectiva.horas}h registradas
              {cargaNoLectiva.descripcion ? ` · ${cargaNoLectiva.descripcion}` : ''}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
            aria-label="Cerrar modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-4">
          <p className="text-sm text-zinc-300">
            Define una o más franjas horarias para esta actividad. Puede ser un bloque
            seguido (por ejemplo Lunes 07:00–11:00) o varias franjas separadas en
            distintos días/horas.
          </p>

          {/* Franjas */}
          <div className="space-y-3">
            {franjas.map((f, idx) => (
              <div
                key={idx}
                className="grid grid-cols-12 gap-2 items-end bg-zinc-800/40 rounded-lg p-3 border border-zinc-800"
              >
                <div className="col-span-4">
                  <label className="block text-xs font-medium text-zinc-400 mb-1">
                    Día
                  </label>
                  <select
                    value={f.dia}
                    onChange={(e) => updateFranja(idx, { dia: e.target.value as Dia })}
                    className="w-full bg-zinc-800 border border-zinc-700 text-white rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-indigo-500"
                  >
                    {DIAS.map((d) => (
                      <option key={d} value={d}>
                        {d.charAt(0) + d.slice(1).toLowerCase()}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-span-3">
                  <label className="block text-xs font-medium text-zinc-400 mb-1">
                    Inicio
                  </label>
                  <select
                    value={f.horaInicio}
                    onChange={(e) => updateFranja(idx, { horaInicio: e.target.value })}
                    className="w-full bg-zinc-800 border border-zinc-700 text-white rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-indigo-500"
                  >
                    {HORAS_OPTIONS.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-span-3">
                  <label className="block text-xs font-medium text-zinc-400 mb-1">
                    Fin
                  </label>
                  <select
                    value={f.horaFin}
                    onChange={(e) => updateFranja(idx, { horaFin: e.target.value })}
                    className="w-full bg-zinc-800 border border-zinc-700 text-white rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-indigo-500"
                  >
                    {HORAS_OPTIONS.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-span-2 flex items-end">
                  <button
                    type="button"
                    onClick={() => removeFranja(idx)}
                    disabled={franjas.length === 1}
                    className="w-full p-2 rounded-lg text-zinc-400 hover:text-red-400 hover:bg-zinc-800 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                    title="Eliminar franja"
                  >
                    <Trash2 className="h-4 w-4 mx-auto" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={addFranja}
            className="flex items-center gap-2 text-sm text-indigo-400 hover:text-indigo-300 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Agregar otra franja
          </button>

          {/* Resumen */}
          <div className="flex items-center justify-between bg-zinc-800/40 rounded-lg p-3 border border-zinc-800 text-sm">
            <div className="text-zinc-300">
              Franjas: <span className="font-semibold text-white">{franjas.length}</span>
            </div>
            <div className="text-zinc-300">
              Horas asignadas:{' '}
              <span
                className={`font-semibold ${
                  totalFranjasHoras > cargaNoLectiva.horas ? 'text-red-400' : 'text-white'
                }`}
              >
                {totalFranjasHoras}h
              </span>{' '}
              / {cargaNoLectiva.horas}h declaradas
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/40 rounded-lg p-3 text-sm text-red-300">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 p-4 border-t border-zinc-800">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-zinc-300 hover:text-white transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={asignarMutation.isPending || franjas.length === 0}
            className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 shadow-lg shadow-indigo-500/25 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95"
          >
            {asignarMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Guardando…
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                Guardar Horario
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
