'use client';

import { useTRPC } from '@/trpc/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { use, useState, useCallback } from 'react';
import {
  ChevronRight, SkipForward, UserX, CheckCircle,
  Clock, User, BookOpen, Building2, FlaskConical,
} from 'lucide-react';
import Link from 'next/link';

const STATUS_COLORS: Record<string, string> = {
  LIBRE: 'bg-emerald-600/30 border-emerald-500/40 text-emerald-300 hover:bg-emerald-600/50 cursor-pointer',
  OCUPADO: 'bg-red-600/20 border-red-500/30 text-red-400',
  MANTENIMIENTO: 'bg-orange-600/20 border-orange-500/30 text-orange-400',
  FERIADO: 'bg-gray-600/20 border-gray-500/30 text-gray-400',
  DOCENTE_OCUPADO: 'bg-amber-600/20 border-amber-500/30 text-amber-400',
  ALMUERZO_REQUERIDO: 'bg-yellow-600/20 border-yellow-500/30 text-yellow-400',
  MAX_HORAS_EXCEDIDO: 'bg-purple-600/20 border-purple-500/30 text-purple-400',
  RESTRICCION_DOCENTE: 'bg-pink-600/20 border-pink-500/30 text-pink-400',
};

const STATUS_ICONS: Record<string, string> = {
  LIBRE: '✅', OCUPADO: '❌', MANTENIMIENTO: '🔧',
  FERIADO: '🚫', DOCENTE_OCUPADO: '👤', ALMUERZO_REQUERIDO: '🍽️',
  MAX_HORAS_EXCEDIDO: '⚠️', RESTRICCION_DOCENTE: '🚷',
};

const DIAS = ['LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES'];
const DIA_LABELS: Record<string, string> = {
  LUNES: 'Lun', MARTES: 'Mar', MIERCOLES: 'Mié',
  JUEVES: 'Jue', VIERNES: 'Vie',
};

export default function SesionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: sesionId } = use(params);
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const [selectedAulaId, setSelectedAulaId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'TEORIA' | 'LABORATORIO'>('TEORIA');
  const [selectedGrupoId, setSelectedGrupoId] = useState<string | null>(null);

  // ─── Queries ────────────────────────────────────────

  const { data: sesion, isLoading } = useQuery({
    ...trpc.sesion.estado.queryOptions({ sesionId }),
    refetchInterval: 3000, // Polling every 3s for real-time updates
  });

  const { data: periodoActivo } = useQuery(trpc.periodo.active.queryOptions());

  const docenteEnTurno = sesion?.turnoActual?.docente;

  // Get docente's assigned groups
  const { data: docenteGrupos = [] } = useQuery({
    ...trpc.docente.grupos.queryOptions({ docenteId: docenteEnTurno?.id ?? '' }),
    enabled: !!docenteEnTurno?.id,
  });

  // Get availability for selected aula (annotated with docente constraints)
  const { data: aulaAvailability } = useQuery({
    ...trpc.horario.docenteAulaAvailability.queryOptions({
      periodoId: periodoActivo?.id ?? '',
      aulaId: selectedAulaId ?? '',
      docenteId: docenteEnTurno?.id ?? '',
    }),
    enabled: !!periodoActivo?.id && !!selectedAulaId && !!docenteEnTurno?.id,
    refetchInterval: 3000,
  });

  // Get all aulas of current type for selection
  const { data: aulasDisponibles = [] } = useQuery({
    ...trpc.aula.list.queryOptions({ tipo: activeTab }),
    enabled: !!docenteEnTurno,
  });

  // Get docente's current assignments
  const { data: docenteAsignaciones = [] } = useQuery({
    ...trpc.horario.byDocente.queryOptions({
      docenteId: docenteEnTurno?.id ?? '',
      periodoId: periodoActivo?.id ?? '',
    }),
    enabled: !!docenteEnTurno?.id && !!periodoActivo?.id,
    refetchInterval: 3000,
  });

  // ─── Mutations ─────────────────────────────────────

  const selectSlotMutation = useMutation(
    trpc.horario.selectSlot.mutationOptions({
      onSuccess: (result) => {
        if (!result.success) {
          alert(`No se puede asignar:\n${result.reasons.join('\n')}`);
        }
        invalidateAll();
      },
    })
  );

  const releaseSlotMutation = useMutation(
    trpc.horario.releaseSlot.mutationOptions({
      onSuccess: () => invalidateAll(),
    })
  );

  const confirmMutation = useMutation(
    trpc.horario.confirmSchedule.mutationOptions({
      onSuccess: () => invalidateAll(),
    })
  );

  const avanzarMutation = useMutation(
    trpc.sesion.avanzarTurno.mutationOptions({
      onSuccess: () => {
        invalidateAll();
        setSelectedAulaId(null);
        setSelectedGrupoId(null);
      },
    })
  );

  const ausenteMutation = useMutation(
    trpc.sesion.marcarAusente.mutationOptions({
      onSuccess: () => {
        invalidateAll();
        setSelectedAulaId(null);
        setSelectedGrupoId(null);
      },
    })
  );

  const invalidateAll = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: trpc.sesion.estado.queryKey() });
    queryClient.invalidateQueries({ queryKey: trpc.horario.docenteAulaAvailability.queryKey() });
    queryClient.invalidateQueries({ queryKey: trpc.horario.byDocente.queryKey() });
  }, [queryClient, trpc]);

  // ─── Derived Data ──────────────────────────────────

  const horas = aulaAvailability
    ? [...new Set(aulaAvailability.slots.map((s) => s.horaInicio))].sort()
    : [];

  const handleSlotClick = (franjaId: string) => {
    if (!docenteEnTurno || !selectedAulaId || !selectedGrupoId || !periodoActivo) return;

    selectSlotMutation.mutate({
      docenteId: docenteEnTurno.id,
      grupoId: selectedGrupoId,
      aulaId: selectedAulaId,
      franjaHorariaId: franjaId,
      periodoId: periodoActivo.id,
      tipo: activeTab,
    });
  };

  // ─── Render ────────────────────────────────────────

  if (isLoading) return <div className="text-center text-gray-600 py-12">Cargando sesión...</div>;
  if (!sesion) return <div className="text-center text-red-400 py-12">Sesión no encontrada</div>;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
            <Link href="/sesiones" className="hover:text-gray-300">Sesiones</Link>
            <ChevronRight className="h-3 w-3" />
            <span className="text-gray-300">{sesion.nombre}</span>
          </div>
          <h1 className="text-2xl font-bold text-white">{sesion.nombre}</h1>
          <p className="text-sm text-gray-500 mt-1">
            Progreso: {sesion.progreso.completados}/{sesion.progreso.total} docentes ({sesion.progreso.porcentaje}%)
          </p>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mb-6 rounded-full bg-gray-800 h-2 overflow-hidden">
        <div
          className="h-full bg-linear-to-r from-indigo-500 to-cyan-400 transition-all duration-500"
          style={{ width: `${sesion.progreso.porcentaje}%` }}
        />
      </div>

      {sesion.estado === 'FINALIZADA' ? (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-8 text-center">
          <CheckCircle className="h-12 w-12 text-emerald-400 mx-auto mb-3" />
          <h2 className="text-xl font-semibold text-white mb-1">Sesión Finalizada</h2>
          <p className="text-gray-400">{sesion.progreso.completados} docentes completaron su horario</p>
        </div>
      ) : !docenteEnTurno ? (
        <div className="rounded-xl border border-gray-800 bg-gray-900 p-12 text-center text-gray-600">
          No hay turno activo
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-6">
          {/* Main Panel: Availability Matrix */}
          <div className="space-y-4">
            {/* Active Turn Banner */}
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-600/20">
                    <User className="h-5 w-5 text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-xs text-emerald-500 uppercase tracking-wider font-medium">Turno #{sesion.turnoActual?.orden}</p>
                    <p className="font-semibold text-white">{docenteEnTurno.nombre}</p>
                    <p className="text-xs text-gray-400">
                      {docenteEnTurno.tipo} · {docenteEnTurno.categoria}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => sesion.turnoActual && ausenteMutation.mutate({
                      turnoId: sesion.turnoActual.id,
                      sesionId,
                    })}
                    className="flex items-center gap-1 rounded-lg border border-amber-500/30 px-3 py-1.5 text-xs text-amber-400 hover:bg-amber-500/10"
                  >
                    <UserX className="h-3 w-3" /> Ausente
                  </button>
                  <button
                    onClick={() => {
                      if (docenteEnTurno && periodoActivo) {
                        confirmMutation.mutate({ docenteId: docenteEnTurno.id, periodoId: periodoActivo.id });
                      }
                    }}
                    className="flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500"
                  >
                    <CheckCircle className="h-3 w-3" /> Confirmar
                  </button>
                  <button
                    onClick={() => avanzarMutation.mutate({ sesionId })}
                    className="flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-500"
                  >
                    <SkipForward className="h-3 w-3" /> Siguiente
                  </button>
                </div>
              </div>
            </div>

            {/* Grupo Selector */}
            <div className="rounded-xl border border-gray-800 bg-gray-900 p-4">
              <p className="text-xs font-medium text-gray-400 mb-2 uppercase tracking-wider">
                <BookOpen className="inline h-3 w-3 -mt-0.5 mr-1" />
                Seleccione el curso/grupo a asignar
              </p>
              {docenteGrupos.length === 0 ? (
                <p className="text-sm text-gray-600">No tiene grupos asignados. Asigne grupos desde Cursos.</p>
              ) : (
                <select
                  value={selectedGrupoId ?? ''}
                  onChange={(e) => setSelectedGrupoId(e.target.value || null)}
                  className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-200 focus:border-indigo-500 focus:outline-none"
                >
                  <option value="">Seleccione un curso/grupo</option>
                  {docenteGrupos.map((dg) => (
                    <option key={dg.id} value={dg.grupoId}>
                      {dg.grupo.curso.codigo} - {dg.grupo.curso.nombre} - G{dg.grupo.nombre}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Tab: Teoría / Laboratorio */}
            <div className="flex gap-1 rounded-lg bg-gray-800 p-1">
              <button
                onClick={() => { setActiveTab('TEORIA'); setSelectedAulaId(null); }}
                className={`flex-1 flex items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-all ${
                  activeTab === 'TEORIA'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                <Building2 className="h-4 w-4" /> Aulas de Teoría
              </button>
              <button
                onClick={() => { setActiveTab('LABORATORIO'); setSelectedAulaId(null); }}
                className={`flex-1 flex items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-all ${
                  activeTab === 'LABORATORIO'
                    ? 'bg-purple-600 text-white shadow-sm'
                    : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                <FlaskConical className="h-4 w-4" /> Laboratorios
              </button>
            </div>

            {/* Aula Selector */}
            <div className="flex flex-wrap gap-2">
              {aulasDisponibles.map((aula) => (
                <button
                  key={aula.id}
                  onClick={() => setSelectedAulaId(aula.id)}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-all ${
                    selectedAulaId === aula.id
                      ? 'border-indigo-500 bg-indigo-600/20 text-indigo-300'
                      : 'border-gray-700 bg-gray-800 text-gray-400 hover:border-gray-600 hover:text-gray-200'
                  }`}
                >
                  {aula.codigo}
                  <span className="ml-1 text-gray-500">({aula.capacidad})</span>
                </button>
              ))}
            </div>

            {/* Availability Matrix */}
            {selectedAulaId && aulaAvailability ? (
              <div className="rounded-xl border border-gray-800 bg-gray-900 overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-800 bg-gray-900/50">
                  <h3 className="text-sm font-semibold text-white">
                    {aulaAvailability.aulaCodigo} — {aulaAvailability.aulaNombre}
                    <span className="ml-2 text-xs text-gray-500">Cap: {aulaAvailability.capacidad}</span>
                  </h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-gray-800">
                        <th className="sticky left-0 bg-gray-900 px-3 py-2 text-left font-medium text-gray-400 w-16">Hora</th>
                        {DIAS.map((dia) => (
                          <th key={dia} className="px-2 py-2 text-center font-medium text-gray-400 min-w-25">
                            {DIA_LABELS[dia]}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {horas.map((hora) => (
                        <tr key={hora} className="border-b border-gray-800/50">
                          <td className="sticky left-0 bg-gray-900 px-3 py-1 font-mono text-gray-500">{hora}</td>
                          {DIAS.map((dia) => {
                            const slot = aulaAvailability.slots.find(
                              (s) => s.dia === dia && s.horaInicio === hora
                            );
                            if (!slot) return <td key={dia} />;

                            return (
                              <td key={dia} className="px-1 py-1">
                                <button
                                  disabled={slot.status !== 'LIBRE' || !selectedGrupoId}
                                  onClick={() => slot.status === 'LIBRE' && handleSlotClick(slot.franjaId)}
                                  className={`w-full rounded-md border p-1.5 text-center text-[10px] transition-all ${
                                    STATUS_COLORS[slot.status] ?? 'bg-gray-800 border-gray-700 text-gray-500'
                                  } ${slot.status !== 'LIBRE' || !selectedGrupoId ? 'cursor-not-allowed' : ''}`}
                                  title={slot.status !== 'LIBRE'
                                    ? `${slot.status}${slot.ocupadoPor ? `: ${slot.ocupadoPor.cursoCodigo} - ${slot.ocupadoPor.docenteNombre}` : ''}`
                                    : selectedGrupoId ? 'Click para asignar' : 'Seleccione un grupo primero'
                                  }
                                >
                                  {slot.status === 'LIBRE' ? (
                                    STATUS_ICONS.LIBRE
                                  ) : (
                                    <div>
                                      <span>{STATUS_ICONS[slot.status]}</span>
                                      {slot.ocupadoPor && (
                                        <p className="truncate mt-0.5">{slot.ocupadoPor.cursoCodigo}</p>
                                      )}
                                    </div>
                                  )}
                                </button>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Legend */}
                <div className="px-4 py-2 border-t border-gray-800 bg-gray-900/50">
                  <div className="flex flex-wrap gap-3 text-[10px] text-gray-500">
                    <span>✅ Disponible</span>
                    <span>❌ Ocupado</span>
                    <span>👤 Docente ocupado</span>
                    <span>🍽️ Almuerzo</span>
                    <span>⚠️ Máx horas</span>
                    <span>🔧 Mantenimiento</span>
                    <span>🚷 Restricción</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-gray-800 bg-gray-900 p-8 text-center text-gray-600">
                {!selectedGrupoId
                  ? 'Seleccione un curso/grupo y luego un aula para ver la disponibilidad'
                  : 'Seleccione un aula para ver la matriz de disponibilidad'
                }
              </div>
            )}
          </div>

          {/* Right Panel: Queue & Current Assignments */}
          <div className="space-y-4">
            {/* Docente's Assigned Slots */}
            <div className="rounded-xl border border-gray-800 bg-gray-900 p-4">
              <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">
                Horario del Docente
              </h3>
              {docenteAsignaciones.length === 0 ? (
                <p className="text-xs text-gray-600">Sin asignaciones aún</p>
              ) : (
                <div className="space-y-1.5">
                  {docenteAsignaciones.map((a) => (
                    <div key={a.id} className="flex items-center justify-between rounded-md border border-gray-700 bg-gray-800 p-2 text-xs">
                      <div>
                        <p className="font-medium text-gray-200">
                          {a.grupo.curso.codigo} — G{a.grupo.nombre}
                        </p>
                        <p className="text-gray-500">
                          {DIA_LABELS[a.franjaHoraria.dia]} {a.franjaHoraria.horaInicio} · {a.aula.codigo}
                        </p>
                      </div>
                      {!a.confirmado && (
                        <button
                          onClick={() => releaseSlotMutation.mutate({
                            asignacionId: a.id,
                            docenteId: docenteEnTurno?.id ?? '',
                          })}
                          className="text-red-400 hover:text-red-300 text-[10px]"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Queue */}
            <div className="rounded-xl border border-gray-800 bg-gray-900 p-4">
              <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">
                <Clock className="inline h-3 w-3 -mt-0.5 mr-1" />
                Cola ({sesion.siguientes.length} pendientes)
              </h3>
              <div className="space-y-1 max-h-80 overflow-y-auto">
                {sesion.siguientes.slice(0, 10).map((t) => (
                  <div key={t.id} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs">
                    <span className="w-5 text-right text-gray-600 font-mono">#{t.orden}</span>
                    <span className="text-gray-500">{t.horaAsignada}</span>
                    <span className="text-gray-300 truncate flex-1">{t.docente.nombre}</span>
                    <span className="text-[10px] text-gray-600">{t.docente.categoria}</span>
                  </div>
                ))}
                {sesion.siguientes.length > 10 && (
                  <p className="text-[10px] text-gray-600 text-center pt-1">
                    +{sesion.siguientes.length - 10} más
                  </p>
                )}
              </div>
            </div>

            {/* Completed */}
            <div className="rounded-xl border border-gray-800 bg-gray-900 p-4">
              <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">
                <CheckCircle className="inline h-3 w-3 -mt-0.5 mr-1" />
                Completados ({sesion.completados.length})
              </h3>
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {sesion.completados.map((t) => (
                  <div key={t.id} className="flex items-center gap-2 rounded-md px-2 py-1 text-xs text-gray-600">
                    <CheckCircle className="h-3 w-3 text-emerald-600" />
                    <span className="truncate">{t.docente.nombre}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
