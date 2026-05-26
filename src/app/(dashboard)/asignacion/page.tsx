'use client';

import { useTRPC } from '@/trpc/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { User, Calendar, CheckCircle2, TrendingUp, AlertTriangle } from 'lucide-react';

const DIAS = ['LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES'];
const DIA_LABELS: Record<string, string> = {
  LUNES: 'Lun', MARTES: 'Mar', MIERCOLES: 'Mié',
  JUEVES: 'Jue', VIERNES: 'Vie',
};

const SLOT_COLORS = [
  'bg-indigo-500/20 border-indigo-500/30 text-indigo-300',
  'bg-cyan-500/20 border-cyan-500/30 text-cyan-300',
  'bg-emerald-500/20 border-emerald-500/30 text-emerald-300',
  'bg-amber-500/20 border-amber-500/30 text-amber-300',
  'bg-purple-500/20 border-purple-500/30 text-purple-300',
  'bg-rose-500/20 border-rose-500/30 text-rose-300',
  'bg-teal-500/20 border-teal-500/30 text-teal-300',
  'bg-orange-500/20 border-orange-500/30 text-orange-300',
  'bg-lime-500/20 border-lime-500/30 text-lime-300',
  'bg-pink-500/20 border-pink-500/30 text-pink-300',
  'bg-violet-500/20 border-violet-500/30 text-violet-300',
  'bg-fuchsia-500/20 border-fuchsia-500/30 text-fuchsia-300',
  'bg-sky-500/20 border-sky-500/30 text-sky-300',
  'bg-blue-500/20 border-blue-500/30 text-blue-300',
  'bg-red-500/20 border-red-500/30 text-red-300',
  'bg-yellow-500/20 border-yellow-500/30 text-yellow-300',
];

type HorarioAsignacion = {
  id: string;
  tipo: 'TEORIA' | 'PRACTICA' | 'LABORATORIO';
  confirmado: boolean;
  docenteId?: string;
  grupo: {
    nombre: string;
    curso: { id: string; codigo: string; nombre: string; ciclo: number };
  };
  docente?: { nombre: string; tipo: string; categoria: string };
  aula?: { codigo: string; nombre: string; tipo: string };
  franjaHoraria: { dia: string; horaInicio: string; horaFin: string };
};

export default function AsignacionPage() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { data: user } = useQuery({ ...trpc.auth.me.queryOptions() });
  
  const [selectedDocenteId, setSelectedDocenteId] = useState<string | null>(null);
  const [currentDocenteIdx, setCurrentDocenteIdx] = useState(0);

  const { data: periodoActivo } = useQuery({ ...trpc.periodo.active.queryOptions() });
  const { data: approvalInfo } = useQuery({
    ...trpc.horario.getApprovalInfo.queryOptions(),
    enabled: !!periodoActivo?.id,
  });
  const { data: docentesHierarchy = [] } = useQuery({ 
    ...trpc.horario.docentesByHierarchy.queryOptions({ periodoId: periodoActivo?.id ?? '' }),
    enabled: !!periodoActivo?.id
  });
  
  const { data: asignaciones = [], isLoading: isLoadingAsignaciones } = useQuery({
    ...trpc.horario.byDocente.queryOptions({ 
      docenteId: selectedDocenteId ?? '', 
      periodoId: periodoActivo?.id ?? '' 
    }),
    enabled: !!selectedDocenteId && !!periodoActivo?.id,
  });

  const confirmTeacherScheduleMutation = useMutation(
    trpc.horario.confirmTeacherSchedule.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries(); // Invalidate everything to be safe
        alert('Horario del docente confirmado');
        if (currentDocenteIdx < docentesHierarchy.length - 1) {
          const nextIdx = currentDocenteIdx + 1;
          setCurrentDocenteIdx(nextIdx);
          setSelectedDocenteId(docentesHierarchy[nextIdx].id);
        }
      },
      onError: (err) => alert(err.message),
    })
  );

  const applySuggestionsMutation = useMutation(
    trpc.horario.applySuggestions.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries();
      },
    })
  );

  const suggestAssignmentsMutation = useMutation(
    trpc.horario.suggestDocenteAssignments.mutationOptions({
      onMutate: () => {
        console.log("Iniciando sugerencia para docente:", selectedDocenteId);
      },
      onSuccess: (data) => {
        console.log("Sugerencia recibida:", data);
        if (data.assignments.length === 0) {
          const reason = data.unassigned[0]?.reason || 'No se pudieron generar sugerencias. Verifique disponibilidad o cruces.';
          alert(`Aviso: ${reason}`);
          return;
        }
        if (confirm(`Se han generado ${data.assignments.length} sugerencias. ¿Desea aplicarlas como borrador visual?`)) {
           applySuggestionsMutation.mutate({
             periodoId: periodoActivo!.id,
             docenteId: selectedDocenteId!,
             assignments: data.assignments.map(a => ({
               grupoId: a.grupoId,
               aulaId: a.aulaId,
               franjaHorariaId: a.franjaHorariaId,
               tipo: a.tipo as any
             }))
           });
        }
      },
      onError: (err) => {
        console.error("Error en sugerencia:", err);
        alert(`Error al generar sugerencias: ${err.message}`);
      }
    })
  );

  const sendToRevisionMutation = useMutation(
    trpc.horario.sendToRevision.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: trpc.periodo.active.queryKey() });
        alert('Todo el horario ha sido enviado a revisión del Director');
      },
      onError: (err) => alert(err.message),
    })
  );

  const autoGenerateMutation = useMutation(
    trpc.horario.autoGenerate.mutationOptions({
      onMutate: () => {
        console.log("Iniciando autogeneración masiva para periodo:", periodoActivo?.id);
      },
      onSuccess: (data) => {
        console.log("Autogeneración masiva exitosa:", data);
        if (data.success) {
          alert(`Éxito: Se generaron correctamente ${data.createdCount} asignaciones.\nSin asignar: ${data.unassignedCount} (ver log para detalles).`);
        } else {
          alert(`No se pudo generar el horario: ${data.reason}`);
        }
        queryClient.invalidateQueries();
      },
      onError: (err) => {
        console.error("Error en autogeneración masiva:", err);
        alert(`Error crítico al autogenerar: ${err.message}`);
      }
    })
  );

  const horas = [...new Set(asignaciones.map((a) => a.franjaHoraria.horaInicio))].sort();
  
  // Stable color mapping by course ID
  const uniqueCourseIds = Array.from(new Set(asignaciones.map(a => a.grupo.curso.id))).sort();
  const cursoColorMap = new Map<string, string>();
  uniqueCourseIds.forEach((id, i) => {
    cursoColorMap.set(id, SLOT_COLORS[i % SLOT_COLORS.length]);
  });

  if (!periodoActivo) return <div className="p-8 text-gray-500">Cargando periodo activo...</div>;

  const estado = periodoActivo?.estado ?? 'PLANIFICACION';
  const canEdit = estado === 'PLANIFICACION' || estado === 'POSTULACION' || estado === 'ASIGNACION';

  return (
    <div className="space-y-6">
      {/* ===== DIRECTOR REJECTION FEEDBACK ===== */}
      {estado === 'ASIGNACION' && approvalInfo?.comentariosDirector && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-5">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-400 mt-0.5 shrink-0" />
            <div>
              <h2 className="text-lg font-bold text-amber-200">Horario devuelto por el director</h2>
              <p className="text-sm text-amber-300/70 mt-1">
                El director ha solicitado modificaciones. Realice los ajustes necesarios y vuelva a enviar para revisión.
              </p>
              <div className="mt-3 rounded-lg border border-amber-500/20 bg-gray-950/50 p-4">
                <p className="text-xs font-bold text-amber-400 uppercase tracking-wider mb-1">Observaciones del director:</p>
                <p className="text-sm text-gray-200">{approvalInfo.comentariosDirector}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===== ALREADY IN REVISION ===== */}
      {estado === 'REVISION' && (
        <div className="rounded-xl border border-purple-500/30 bg-purple-500/10 p-5">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-purple-400 mt-0.5 shrink-0" />
            <div>
              <h2 className="text-lg font-bold text-purple-200">Horario en revisión</h2>
              <p className="text-sm text-purple-300/70 mt-1">
                La asignación ya fue enviada al director para su aprobación. No se pueden realizar modificaciones hasta que el director revise o devuelva el horario.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ===== APPROVED OR FINALIZED ===== */}
      {(estado === 'APROBADO' || estado === 'FINALIZADO') && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-5">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="h-5 w-5 text-emerald-400 mt-0.5 shrink-0" />
            <div>
              <h2 className="text-lg font-bold text-emerald-200">
                {estado === 'FINALIZADO' ? 'Horario publicado' : 'Horario aprobado'}
              </h2>
              <p className="text-sm text-emerald-300/70 mt-1">
                {estado === 'FINALIZADO'
                  ? 'El horario ya está publicado y visible para todos los usuarios.'
                  : 'El director ha aprobado el horario. Ya no se pueden realizar modificaciones.'}
              </p>
            </div>
          </div>
        </div>
      )}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Módulo de Asignación de Horarios</h1>
          <p className="text-sm text-gray-500 mt-1">
            Proceso secuencial por jerarquía para el periodo {periodoActivo.nombre}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => {
              if (confirm('¿Desea autogenerar TODO el horario? Esto sobreescribirá asignaciones actuales.')) {
                autoGenerateMutation.mutate({ periodoId: periodoActivo.id });
              }
            }}
            disabled={!canEdit}
            className="rounded-lg border border-indigo-500/30 bg-indigo-500/5 px-4 py-2 text-xs font-bold text-indigo-400 hover:bg-indigo-500/10 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Autogenerar Todo
          </button>
          {canEdit && (
          <button
            onClick={() => {
              if (confirm('¿Desea enviar todo el horario consolidado al Director para su aprobación final?')) {
                sendToRevisionMutation.mutate({ periodoId: periodoActivo.id });
              }
            }}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-500 shadow-lg shadow-emerald-500/20"
          >
            Enviar a Revisión Final
          </button>
          )}
        </div>
      </div>

      {/* Sequential Progress */}
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-6 shadow-lg">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-600 text-white text-xl font-bold">
              {currentDocenteIdx + 1}
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">
                {selectedDocenteId ? docentesHierarchy[currentDocenteIdx]?.nombre : 'Seleccione un docente'}
              </h3>
              <div className="flex gap-2 mt-1">
                <span className="text-[10px] bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full font-bold uppercase">
                  {docentesHierarchy[currentDocenteIdx]?.categoria}
                </span>
                <span className="text-[10px] bg-gray-800 text-gray-400 px-2 py-0.5 rounded-full font-bold uppercase">
                  {docentesHierarchy[currentDocenteIdx]?.tipo}
                </span>
              </div>
            </div>
          </div>
          
          <div className="flex gap-3">
            <button
              onClick={() => {
                if (!selectedDocenteId) return;
                suggestAssignmentsMutation.mutate({ periodoId: periodoActivo.id, docenteId: selectedDocenteId });
              }}
              disabled={!selectedDocenteId || !canEdit || suggestAssignmentsMutation.isPending}
              className="flex items-center gap-2 rounded-lg bg-indigo-600 px-6 py-2.5 text-sm font-bold text-white hover:bg-indigo-500 disabled:opacity-50 transition-all"
            >
              <TrendingUp className="h-4 w-4" />
              {suggestAssignmentsMutation.isPending ? 'Procesando...' : 'Sugerir Horario'}
            </button>
            <button
              onClick={() => {
                if (!selectedDocenteId) return;
                confirmTeacherScheduleMutation.mutate({ docenteId: selectedDocenteId, periodoId: periodoActivo.id });
              }}
              disabled={!selectedDocenteId || !canEdit || confirmTeacherScheduleMutation.isPending || asignaciones.length === 0}
              className="flex items-center gap-2 rounded-lg bg-emerald-600 px-6 py-2.5 text-sm font-bold text-white hover:bg-emerald-500 disabled:opacity-50 transition-all"
            >
              <CheckCircle2 className="h-4 w-4" />
              Confirmar y Siguiente
            </button>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex justify-between text-xs font-bold text-gray-500 uppercase tracking-widest">
            <span>Progreso de Asignación</span>
            <span>{Math.round(((currentDocenteIdx + 1) / docentesHierarchy.length) * 100)}%</span>
          </div>
          <div className="h-2 w-full rounded-full bg-gray-800 overflow-hidden">
            <div 
              className="h-full bg-amber-500 transition-all duration-700 ease-out" 
              style={{ width: `${((currentDocenteIdx + 1) / docentesHierarchy.length) * 100}%` }}
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Docentes List */}
        <div className="lg:col-span-1 space-y-2 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
          <h4 className="text-xs font-bold text-gray-500 uppercase mb-4 sticky top-0 bg-gray-950 py-2">Lista Jerárquica</h4>
          {docentesHierarchy.map((d, idx) => (
            <button
              key={d.id}
              onClick={() => { setSelectedDocenteId(d.id); setCurrentDocenteIdx(idx); }}
              className={`w-full text-left p-3 rounded-xl border transition-all ${
                selectedDocenteId === d.id
                  ? 'border-indigo-500 bg-indigo-600/10 text-white'
                  : 'border-gray-800 bg-gray-900/50 text-gray-400 hover:border-gray-700'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-bold truncate">{d.nombre}</p>
                {(d as any)._count?.asignaciones > 0 && (
                  <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 flex-shrink-0" title="Ya tiene asignaciones" />
                )}
              </div>
              <p className="text-[10px] mt-0.5 opacity-60">{d.categoria} · {d.tipo}</p>
            </button>
          ))}
        </div>

        {/* Schedule Preview */}
        <div className="lg:col-span-3">
          {isLoadingAsignaciones ? (
             <div className="h-full rounded-2xl border border-gray-800 bg-gray-900/50 flex flex-col items-center justify-center p-12">
                <div className="h-8 w-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4" />
                <p className="text-gray-400 text-sm animate-pulse">Cargando horario...</p>
             </div>
          ) : !selectedDocenteId ? (
            <div className="h-full rounded-2xl border-2 border-dashed border-gray-800 flex flex-col items-center justify-center p-12 text-center">
              <User className="h-12 w-12 text-gray-700 mb-4" />
              <h3 className="text-gray-400 font-bold">Seleccione un docente para iniciar</h3>
              <p className="text-gray-600 text-sm mt-1">Se mostrará la vista previa de su horario y las sugerencias del sistema.</p>
            </div>
          ) : asignaciones.length === 0 ? (
             <div className="h-full rounded-2xl border-2 border-dashed border-gray-800 flex flex-col items-center justify-center p-12 text-center">
               <AlertTriangle className="h-12 w-12 text-amber-500/20 mb-4" />
               <h3 className="text-gray-500 font-bold">Sin asignaciones para este docente</h3>
               <p className="text-gray-600 text-sm mt-1">Haga clic en "Sugerir Horario" para que el sistema asigne sus cursos automáticamente.</p>
             </div>
          ) : (
            <div className="rounded-2xl border border-gray-800 bg-gray-900 overflow-hidden shadow-xl">
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="bg-gray-800/50">
                    <th className="px-4 py-3 text-left font-bold text-gray-400 uppercase tracking-widest w-20">Hora</th>
                    {DIAS.map(dia => (
                      <th key={dia} className="px-2 py-3 text-center font-bold text-gray-400 uppercase tracking-widest">
                        {DIA_LABELS[dia]}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {horas.map(hora => (
                    <tr key={hora} className="border-t border-gray-800/50">
                      <td className="px-4 py-3 font-mono text-gray-500 bg-gray-900/50">{hora}</td>
                      {DIAS.map(dia => {
                        const a = asignaciones.find(a => a.franjaHoraria.dia === dia && a.franjaHoraria.horaInicio === hora);
                        if (!a) return <td key={dia} className="px-1 py-1" />;
                        
                        const colorClass = cursoColorMap.get(a.grupo.curso.id) || '';
                        return (
                          <td key={dia} className="px-1 py-1">
                            <div className={`p-2 rounded-lg border flex flex-col justify-center min-h-[50px] shadow-sm transition-all ${colorClass} ${!a.confirmado ? 'border-dashed border-white/40 ring-1 ring-white/10' : ''}`}>
                              <div className="flex items-center justify-between gap-1 mb-0.5">
                                <p className="font-black text-[10px] leading-tight truncate">
                                  {a.grupo.curso.codigo}
                                </p>
                                {!a.confirmado && <span className="text-[7px] bg-white/20 px-1 rounded-sm font-bold animate-pulse">SUG</span>}
                              </div>
                              <p className="text-[9px] font-medium opacity-80 truncate">{a.grupo.curso.nombre}</p>
                              <div className="mt-1 flex items-center justify-between opacity-70 text-[8px] font-bold">
                                <span>G{a.grupo.nombre}</span>
                                <span>{a.aula?.codigo}</span>
                              </div>
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
