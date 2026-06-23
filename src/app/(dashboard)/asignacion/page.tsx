'use client';

import { useTRPC } from '@/trpc/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { User, Calendar, CheckCircle2, TrendingUp, AlertTriangle, Edit, Trash2, X, Save, Plus, Clock, MapPin } from 'lucide-react';

const DIAS = ['LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO'];
const DIA_LABELS: Record<string, string> = {
  LUNES: 'Lun', MARTES: 'Mar', MIERCOLES: 'Mié',
  JUEVES: 'Jue', VIERNES: 'Vie', SABADO: 'Sáb',
};

const SLOT_COLORS = [
  'bg-primary/10 border-primary/20 text-primary',
  'bg-info/10 border-info/20 text-info',
  'bg-success/10 border-success/20 text-success',
  'bg-warning/10 border-warning/20 text-warning',
  'bg-danger/10 border-danger/20 text-danger',
  'bg-secondary/10 border-secondary/20 text-secondary',
  'bg-blue-100 border-blue-200 text-blue-900',
  'bg-purple-100 border-purple-200 text-purple-900',
  'bg-rose-100 border-rose-200 text-rose-900',
  'bg-teal-100 border-teal-200 text-teal-900',
  'bg-orange-100 border-orange-200 text-orange-900',
  'bg-lime-100 border-lime-200 text-lime-900',
  'bg-pink-100 border-pink-200 text-pink-900',
  'bg-violet-100 border-violet-200 text-violet-900',
  'bg-fuchsia-100 border-fuchsia-200 text-fuchsia-900',
  'bg-sky-100 border-sky-200 text-sky-900',
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
  aula?: { id: string; codigo: string; nombre: string; tipo: string };
  franjaHoraria: { id: string; dia: string; horaInicio: string; horaFin: string };
};

type AulaOption = {
  id: string;
  codigo: string;
  nombre: string;
  tipo: string;
};

type FranjaOption = {
  id: string;
  dia: string;
  horaInicio: string;
  horaFin: string;
};

import { type ManualScheduleOption, resolveManualOptionStatus } from './utils';


export default function AsignacionPage() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  
  const [selectedDocenteId, setSelectedDocenteId] = useState<string | null>(null);
  const [currentDocenteIdx, setCurrentDocenteIdx] = useState(0);
  const [editingAsignacion, setEditingAsignacion] = useState<HorarioAsignacion | null>(null);
  const [selectedAulaId, setSelectedAulaId] = useState<string>('');
  const [selectedFranjaId, setSelectedFranjaId] = useState<string>('');
  const [selectedManualCargaId, setSelectedManualCargaId] = useState<string>('');
  const [manualAulaId, setManualAulaId] = useState<string>('');
  const [manualFranjaId, setManualFranjaId] = useState<string>('');

  const { data: periodoActivo } = useQuery({ ...trpc.periodo.active.queryOptions() });
  const { data: approvalInfo } = useQuery({
    ...trpc.horario.getApprovalInfo.queryOptions(),
    enabled: !!periodoActivo?.id,
  });
  const { data: docentesHierarchy = [] } = useQuery({ 
    ...trpc.horario.docentesByHierarchy.queryOptions({ periodoId: periodoActivo?.id ?? '' }),
    enabled: !!periodoActivo?.id
  });
  const { data: aulas = [] } = useQuery({ 
    ...trpc.aula.list.queryOptions(),
  });
  const { data: franjas = [] } = useQuery({ 
    ...trpc.franjaHoraria.list.queryOptions(),
  });
  const { data: asignacionesData, isLoading: isLoadingAsignaciones } = useQuery({
    ...trpc.horario.byDocente.queryOptions({ 
      docenteId: selectedDocenteId ?? '', 
      periodoId: periodoActivo?.id ?? '' 
    }),
    enabled: !!selectedDocenteId && !!periodoActivo?.id,
  });
  const asignaciones = (asignacionesData ?? []) as HorarioAsignacion[];
  const { data: manualOptionsData = [], isLoading: isLoadingManualOptions } = useQuery({
    ...trpc.horario.manualOptions.queryOptions({
      docenteId: selectedDocenteId ?? '',
      periodoId: periodoActivo?.id ?? '',
    }),
    enabled: !!selectedDocenteId && !!periodoActivo?.id,
  });
  const manualOptions = manualOptionsData as ManualScheduleOption[];
  


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
               tipo: a.tipo as HorarioAsignacion['tipo']
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

  const updateAsignacionMutation = useMutation(
    trpc.horario.update.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries();
        setEditingAsignacion(null);
      },
      onError: (err) => alert(err.message),
    })
  );

  const createAsignacionMutation = useMutation(
    trpc.horario.create.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries();
        setManualFranjaId('');
      },
      onError: (err) => alert(err.message),
    })
  );

  const deleteAsignacionMutation = useMutation(
    trpc.horario.delete.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries();
        setEditingAsignacion(null);
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
  const pendingManualOptions = useMemo(
    () => manualOptions.filter((option) => option.remainingBlocks > 0),
    [manualOptions]
  );
  const selectedManualOption =
    manualOptions.find((option) => option.cargaLectivaId === selectedManualCargaId) ??
    pendingManualOptions[0] ??
    manualOptions[0];
  const activeManualCargaId = selectedManualOption?.cargaLectivaId ?? '';
  const compatibleAulas = useMemo(() => {
    const aulasList = aulas as AulaOption[];
    if (!selectedManualOption) return aulasList;
    const preferred = aulasList.filter((aula) =>
      selectedManualOption.tipo === 'LABORATORIO'
        ? aula.tipo === 'LABORATORIO'
        : aula.tipo !== 'LABORATORIO'
    );
    return preferred.length > 0 ? preferred : aulasList;
  }, [aulas, selectedManualOption]);

  function handleEdit(asignacion: HorarioAsignacion) {
    setEditingAsignacion(asignacion);
    setSelectedAulaId(asignacion.aula?.id || '');
    setSelectedFranjaId(asignacion.franjaHoraria.id || '');
  }

  function handleSave() {
    if (!editingAsignacion) return;
    updateAsignacionMutation.mutate({
      id: editingAsignacion.id,
      aulaId: selectedAulaId,
      franjaHorariaId: selectedFranjaId,
    });
  }

  function handleDelete() {
    if (!editingAsignacion) return;
    if (confirm('¿Está seguro de eliminar esta asignación?')) {
      deleteAsignacionMutation.mutate({ id: editingAsignacion.id });
    }
  }

  function handleManualCreate() {
    if (!selectedDocenteId || !periodoActivo?.id || !selectedManualOption || !manualAulaId || !manualFranjaId) return;
    createAsignacionMutation.mutate({
      docenteId: selectedDocenteId,
      grupoId: selectedManualOption.grupoId,
      periodoId: periodoActivo.id,
      tipo: selectedManualOption.tipo,
      aulaId: manualAulaId,
      franjaHorariaId: manualFranjaId,
    });
  }
  
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
        <div className="rounded-xl border border-warning/30 bg-warning/10 p-5">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-warning mt-0.5 shrink-0" />
            <div>
              <h2 className="text-lg font-bold text-text-main">Horario devuelto por el director</h2>
              <p className="text-sm text-text-main mt-1 font-medium">
                El director ha solicitado modificaciones. Realice los ajustes necesarios y vuelva a enviar para revisión.
              </p>
              <div className="mt-3 rounded-lg border border-warning/20 bg-white p-4">
                <p className="text-xs font-bold text-warning uppercase tracking-wider mb-1">Observaciones del director:</p>
                <p className="text-sm text-text-main font-semibold">{approvalInfo.comentariosDirector}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===== ALREADY IN REVISION ===== */}
      {estado === 'REVISION' && (
        <div className="rounded-xl border border-info/30 bg-info/10 p-5">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-info mt-0.5 shrink-0" />
            <div>
              <h2 className="text-lg font-bold text-text-main">Horario en revisión</h2>
              <p className="text-sm text-text-main mt-1 font-medium">
                La asignación ya fue enviada al director para su aprobación. No se pueden realizar modificaciones hasta que el director revise o devuelva el horario.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ===== APPROVED OR FINALIZED ===== */}
      {(estado === 'APROBADO' || estado === 'FINALIZADO') && (
        <div className="rounded-xl border border-success/30 bg-success/10 p-5">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="h-5 w-5 text-success mt-0.5 shrink-0" />
            <div>
              <h2 className="text-lg font-bold text-text-main">
                {estado === 'FINALIZADO' ? 'Horario publicado' : 'Horario aprobado'}
              </h2>
              <p className="text-sm text-text-main mt-1 font-medium">
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
          <h1 className="text-2xl font-bold text-text-main">Módulo de Asignación de Horarios</h1>
          <p className="text-sm text-text-sub mt-1">
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
            className="px-4 py-2 rounded-lg bg-primary/10 text-primary text-xs font-bold border border-primary/20 hover:bg-primary/20 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
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
            className="btn-primary"
          >
            Enviar a Revisión
          </button>
          )}
        </div>
      </div>

      {/* Sequential Progress */}
      <div className="rounded-xl border border-warning/30 bg-warning/5 p-6 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-warning text-white text-xl font-black shadow-lg shadow-warning/20">
              {currentDocenteIdx + 1}
            </div>
            <div>
              <h3 className="text-lg font-bold text-text-main tracking-tight">
                {selectedDocenteId ? docentesHierarchy[currentDocenteIdx]?.nombre : 'Seleccione un docente'}
              </h3>
              <div className="flex gap-2 mt-1">
                <span className="text-[10px] bg-warning/10 text-warning px-2 py-0.5 rounded-full font-bold uppercase border border-warning/20">
                  {docentesHierarchy[currentDocenteIdx]?.categoria}
                </span>
                <span className="text-[10px] bg-slate-100 text-text-sub px-2 py-0.5 rounded-full font-bold uppercase border border-border">
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
              className="flex items-center gap-2 rounded-lg bg-primary/10 px-6 py-2.5 text-sm font-bold text-primary hover:bg-primary/20 disabled:opacity-50 transition-all border border-primary/20"
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
              className="flex items-center gap-2 rounded-lg bg-success px-6 py-2.5 text-sm font-bold text-white hover:bg-green-700 disabled:opacity-50 transition-all shadow-lg shadow-success/20"
            >
              <CheckCircle2 className="h-4 w-4" />
              Confirmar y Siguiente
            </button>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex justify-between text-[10px] font-black text-text-sub uppercase tracking-widest">
            <span>Progreso de Asignación Jerárquica</span>
            <span>{Math.round(((currentDocenteIdx + 1) / docentesHierarchy.length) * 100)}%</span>
          </div>
          <div className="h-2 w-full rounded-full bg-slate-200 overflow-hidden">
            <div 
              className="h-full bg-warning transition-all duration-700 ease-out" 
              style={{ width: `${((currentDocenteIdx + 1) / docentesHierarchy.length) * 100}%` }}
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Docentes List */}
        <div className="lg:col-span-1 space-y-2 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
          <h4 className="text-[10px] font-black text-text-sub uppercase mb-4 sticky top-0 bg-page py-2 tracking-widest">Lista Jerárquica</h4>
          {docentesHierarchy.map((d, idx) => (
            <button
              key={d.id}
              onClick={() => { setSelectedDocenteId(d.id); setCurrentDocenteIdx(idx); }}
              className={`w-full text-left p-3 rounded-xl border transition-all ${
                selectedDocenteId === d.id
                  ? 'border-primary bg-primary/10 text-primary shadow-sm'
                  : 'border-border bg-white text-text-sub hover:border-slate-300'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <p className={`text-sm font-bold truncate ${selectedDocenteId === d.id ? 'text-primary' : 'text-text-main'}`}>{d.nombre}</p>
                {d._count?.asignaciones > 0 && (
                  <div className="h-1.5 w-1.5 rounded-full bg-success flex-shrink-0" title="Ya tiene asignaciones" />
                )}
              </div>
              <p className="text-[10px] mt-0.5 font-bold uppercase opacity-60 tracking-tight">{d.categoria} · {d.tipo}</p>
            </button>
          ))}
        </div>

        {/* Schedule Preview */}
        <div className="lg:col-span-3 space-y-4">
          {selectedDocenteId && (
            <div className="rounded-2xl border border-border bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <Plus className="h-4 w-4" />
                    </div>
                    <div>
                      <h3 className="text-base font-black text-text-main">Programación manual de bloque</h3>
                      <p className="text-xs font-medium text-text-sub">
                        Elegí un componente ya asignado en carga lectiva y definí aula + franja.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 rounded-xl border border-info/20 bg-info/5 px-3 py-2 text-xs font-bold text-info">
                  <Clock className="h-4 w-4" />
                  {pendingManualOptions.length} componentes con bloques pendientes
                </div>
              </div>

              <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(280px,0.8fr)]">
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-[10px] font-black uppercase tracking-widest text-text-sub">
                      Componentes de carga lectiva
                    </p>
                    {isLoadingManualOptions && (
                      <span className="text-[10px] font-bold text-text-sub">Cargando...</span>
                    )}
                  </div>

                  {manualOptions.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-border bg-slate-50 p-4 text-sm font-medium text-text-sub">
                      Este docente todavía no tiene carga lectiva aprobada/asignada para programar.
                    </div>
                  ) : (
                    <div className="grid gap-2 md:grid-cols-2">
                      {manualOptions.map((option) => {
                        const status = resolveManualOptionStatus(option);
                        const isSelected = activeManualCargaId === option.cargaLectivaId;

                        return (
                          <button
                            key={option.cargaLectivaId}
                            type="button"
                            onClick={() => {
                              if (status.disabled || !canEdit) return;
                              setSelectedManualCargaId(option.cargaLectivaId);
                            }}
                            disabled={status.disabled || !canEdit}
                            className={`rounded-xl border p-3 text-left transition-all ${
                              isSelected
                                ? 'border-primary bg-primary/10 shadow-sm ring-2 ring-primary/10'
                                : 'border-border bg-white hover:border-primary/40 hover:bg-slate-50'
                            } disabled:cursor-not-allowed disabled:opacity-60`}
                          >
                            <div className="mb-2 flex items-start justify-between gap-2">
                              <div>
                                <p className="text-sm font-black leading-tight text-text-main">
                                  {option.curso.codigo} · {option.tipo}
                                </p>
                                <p className="mt-0.5 text-xs font-semibold text-text-sub">
                                  {option.curso.nombre}
                                </p>
                              </div>
                              <span className={status.badgeClass}>{status.label}</span>
                            </div>
                            <div className="flex flex-wrap items-center gap-2 text-[10px] font-bold uppercase tracking-wide text-text-sub">
                              <span className="rounded-full bg-slate-100 px-2 py-1">Grupo {option.grupoNombre}</span>
                              {option.grupoLaboratorio ? (
                                <span className="rounded-full bg-amber-50 px-2 py-1 text-amber-700">
                                  Lab {option.grupoLaboratorio}
                                </span>
                              ) : null}
                              <span className="rounded-full bg-slate-100 px-2 py-1">
                                {option.scheduledBlocks}/{option.horasAsignadas} programados
                              </span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="rounded-xl border border-border bg-slate-50 p-4">
                  <p className="text-[10px] font-black uppercase tracking-widest text-text-sub">Ubicación y hora</p>
                  <div className="mt-3 space-y-3">
                    <div>
                      <label className="label-standard">Aula o laboratorio</label>
                      <select
                        value={manualAulaId}
                        onChange={(event) => setManualAulaId(event.target.value)}
                        className="input-standard"
                        disabled={!selectedManualOption || !canEdit}
                      >
                        <option value="">Seleccione un ambiente</option>
                        {compatibleAulas.map((aula) => (
                          <option key={aula.id} value={aula.id}>
                            {aula.codigo} - {aula.nombre} ({aula.tipo})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="label-standard">Franja horaria</label>
                      <select
                        value={manualFranjaId}
                        onChange={(event) => setManualFranjaId(event.target.value)}
                        className="input-standard"
                        disabled={!selectedManualOption || !canEdit}
                      >
                        <option value="">Seleccione una franja</option>
                        {(franjas as FranjaOption[]).map((franja) => (
                          <option key={franja.id} value={franja.id}>
                            {DIA_LABELS[franja.dia] || franja.dia} {franja.horaInicio} - {franja.horaFin}
                          </option>
                        ))}
                      </select>
                    </div>

                    {selectedManualOption ? (
                      <div className="rounded-lg border border-primary/10 bg-white p-3 text-xs text-text-sub">
                        <p className="font-bold text-text-main">
                          {selectedManualOption.curso.codigo} · {selectedManualOption.tipo}
                        </p>
                        <p className="mt-1">
                          Se programará un bloque para {selectedManualOption.docenteNombre}.
                        </p>
                      </div>
                    ) : (
                      <div className="rounded-lg border border-dashed border-border bg-white p-3 text-xs text-text-sub">
                        Seleccioná primero un componente pendiente.
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={handleManualCreate}
                      disabled={
                        !canEdit ||
                        !selectedManualOption ||
                        selectedManualOption.remainingBlocks <= 0 ||
                        !manualAulaId ||
                        !manualFranjaId ||
                        createAsignacionMutation.isPending
                      }
                      className="btn-primary w-full justify-center disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <MapPin className="mr-2 h-4 w-4" />
                      {createAsignacionMutation.isPending ? 'Programando...' : 'Programar bloque manual'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {isLoadingAsignaciones ? (
             <div className="h-full rounded-2xl border border-border bg-white flex flex-col items-center justify-center p-12 shadow-sm">
                <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4" />
                <p className="text-text-sub text-sm font-bold animate-pulse">Cargando horario...</p>
             </div>
          ) : !selectedDocenteId ? (
            <div className="h-full rounded-2xl border-2 border-dashed border-border flex flex-col items-center justify-center p-12 text-center bg-white/50">
              <User className="h-12 w-12 text-slate-300 mb-4" />
              <h3 className="text-text-sub font-bold">Seleccione un docente para iniciar</h3>
              <p className="text-text-sub/60 text-xs mt-1">Se mostrará la vista previa de su horario y las sugerencias del sistema.</p>
            </div>
          ) : asignaciones.length === 0 ? (
             <div className="h-full rounded-2xl border-2 border-dashed border-border flex flex-col items-center justify-center p-12 text-center bg-white/50">
               <AlertTriangle className="h-12 w-12 text-warning/20 mb-4" />
               <h3 className="text-text-sub font-bold">Sin asignaciones para este docente</h3>
               <p className="text-text-sub/60 text-xs mt-1">Use la programación manual de arriba o haga clic en “Sugerir Horario”.</p>
             </div>
          ) : (
            <div className="rounded-2xl border border-border bg-white overflow-hidden shadow-sm">
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="bg-slate-50 border-b border-border">
                    <th className="px-4 py-4 text-left font-black text-text-sub uppercase tracking-widest w-24">Hora</th>
                    {DIAS.map(dia => (
                      <th key={dia} className="px-2 py-4 text-center font-black text-text-sub uppercase tracking-widest">
                        {DIA_LABELS[dia]}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {horas.map(hora => (
                    <tr key={hora} className="border-t border-border group">
                      <td className="px-4 py-3 font-mono font-bold text-text-sub bg-slate-50/50">{hora}</td>
                      {DIAS.map(dia => {
                        const a = asignaciones.find(a => a.franjaHoraria.dia === dia && a.franjaHoraria.horaInicio === hora);
                        if (!a) return <td key={dia} className="px-1 py-1" />;
        
        const colorClass = cursoColorMap.get(a.grupo.curso.id) || '';
        return (
          <td key={dia} className="px-1 py-1">
            <div 
              onClick={() => canEdit && handleEdit(a)}
              className={`p-2 rounded-xl border flex flex-col justify-center min-h-[60px] shadow-sm transition-all hover:scale-[1.02] cursor-pointer ${colorClass} ${!a.confirmado ? 'border-dashed ring-2 ring-primary/20' : 'border-current/10'}`}
            >
              <div className="flex items-center justify-between gap-1 mb-1">
                <p className="font-black text-[10px] leading-tight truncate">
                  {a.grupo.curso.codigo}
                </p>
                {!a.confirmado && <span className="text-[7px] bg-white/40 px-1 rounded-sm font-black animate-pulse">SUG</span>}
                {canEdit && <Edit className="h-2 w-2 opacity-70" />}
              </div>
              <p className="text-[9px] font-bold opacity-80 truncate leading-tight">{a.grupo.curso.nombre}</p>
              <div className="mt-2 flex items-center justify-between opacity-70 text-[8px] font-black uppercase tracking-tighter">
                <span className="bg-white/20 px-1 rounded">G{a.grupo.nombre}</span>
                <span className="flex items-center gap-0.5">
                  <Calendar className="h-2 w-2" />
                  {a.aula?.codigo}
                </span>
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

      {/* Modal de edición */}
      {editingAsignacion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-border bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-text-main">Editar Asignación</h2>
              <button onClick={() => setEditingAsignacion(null)} className="rounded-lg p-1 text-text-sub hover:bg-slate-100">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mb-4">
              <p className="text-sm text-text-sub mb-2">Curso: <span className="font-bold">{editingAsignacion.grupo.curso.nombre} ({editingAsignacion.grupo.curso.codigo})</span></p>
              <p className="text-sm text-text-sub mb-2">Grupo: <span className="font-bold">{editingAsignacion.grupo.nombre}</span></p>
              <p className="text-sm text-text-sub mb-2">Tipo: <span className="font-bold">{editingAsignacion.tipo}</span></p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="label-standard">Aula</label>
                <select 
                  value={selectedAulaId} 
                  onChange={(e) => setSelectedAulaId(e.target.value)}
                  className="input-standard"
                >
                  <option value="">Seleccione una aula</option>
                  {(aulas as AulaOption[]).map(aula => (
                    <option key={aula.id} value={aula.id}>{aula.codigo} - {aula.nombre} ({aula.tipo})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label-standard">Franja Horaria</label>
                <select 
                  value={selectedFranjaId} 
                  onChange={(e) => setSelectedFranjaId(e.target.value)}
                  className="input-standard"
                >
                  <option value="">Seleccione una franja</option>
                  {(franjas as FranjaOption[]).map(franja => (
                    <option key={franja.id} value={franja.id}>
                      {DIA_LABELS[franja.dia] || franja.dia} {franja.horaInicio} - {franja.horaFin}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex gap-3 pt-4 border-t border-border">
                <button 
                  onClick={() => setEditingAsignacion(null)} 
                  className="btn-secondary flex-1"
                >
                  Cancelar
                </button>
                <button 
                  onClick={handleDelete} 
                  className="btn-secondary text-danger border-danger/30 hover:bg-danger/10"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Eliminar
                </button>
                <button 
                  onClick={handleSave} 
                  className="btn-primary flex-1"
                >
                  <Save className="h-4 w-4 mr-2" />
                  Guardar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
