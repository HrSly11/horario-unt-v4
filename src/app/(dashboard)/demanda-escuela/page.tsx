'use client';

import { useState, useEffect, useMemo } from 'react';
import { useTRPC } from '@/trpc/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  BookOpen,
  Calendar,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Send,
  Eye,
  Loader2,
  School,
  Plus,
  Trash2,
  MessageSquare,
  Hash,
  Download,
  Clock,
  ChevronRight,
} from 'lucide-react';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ESTADO_BADGE: Record<string, string> = {
  BORRADOR: 'badge badge-gray',
  ENVIADA: 'badge badge-info',
  APROBADA: 'badge badge-success',
  OBSERVADA: 'badge badge-warning',
  RECHAZADA: 'badge badge-danger',
};

const ESTADO_LABEL: Record<string, string> = {
  BORRADOR: 'Borrador',
  ENVIADA: 'Enviada',
  APROBADA: 'Aprobada',
  OBSERVADA: 'Observada',
  RECHAZADA: 'Rechazada',
};

interface LineaDraft {
  cursoId: string;
  curriculas: Array<{ curriculaId: string; ciclo: number }>;
  numGruposLaboratorio: number;
  motivoAperturaExcepcional: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function DemandaEscuelaPage() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const [selectedPeriodoId, setSelectedPeriodoId] = useState('');
  const [selectedEscuelaId, setSelectedEscuelaId] = useState('');
  const [reviewModal, setReviewModal] = useState(false);
  const [reviewEstado, setReviewEstado] = useState<'APROBADA' | 'OBSERVADA' | 'RECHAZADA'>('APROBADA');
  const [reviewObs, setReviewObs] = useState('');
  const [lineas, setLineas] = useState<LineaDraft[]>([]);

  // ── Auth & roles ──
  const { data: user } = useQuery({ ...trpc.auth.me.queryOptions() });
  const role = user?.role;
  const isDirector = role === 'DIRECTOR_ESCUELA';
  const isSecretaria = role === 'SECRETARIA_ACADEMICA';
  const isAdmin = role === 'ADMIN';
  const canSee = isDirector || isSecretaria || isAdmin;

  // ── Periods & schools ──
  const { data: periodos = [] } = useQuery({ ...trpc.periodo.list.queryOptions() });
  const { data: escuelas = [] } = useQuery({
    ...trpc.escuela.list.queryOptions({}),
    enabled: canSee,
  });

  // ── Resolve IDs ──
  const activePeriod = periodos.find((p) => p.activo);
  const periodoId = selectedPeriodoId || activePeriod?.id || (periodos[0]?.id ?? '');
  const autoEscuela = !isAdmin && escuelas.length > 0 ? escuelas[0] : null;
  const escuelaId = isAdmin
    ? selectedEscuelaId || (escuelas[0]?.id ?? '')
    : autoEscuela?.id ?? '';

  // ── Main query ──
  const {
    data: demandaData,
    isLoading,
    refetch,
  } = useQuery({
    ...trpc.curso.getDemanda.queryOptions({ escuelaId, periodoId }),
    enabled: !!escuelaId && !!periodoId && canSee,
  });

  const demanda = demandaData?.demanda;
  const availableCourses = demandaData?.availableCourses ?? [];
  const cursosAperturados = demandaData?.cursosAperturados ?? [];

  // Courses aperturados that are NOT yet in the saved demand nor in the local draft.
  const alreadySavedIds = new Set((demanda as any)?.lineas?.map((l: any) => l.cursoId) ?? []);
  const alreadyDraftIds = new Set(lineas.map((l) => l.cursoId));
  const pendingAperturados = cursosAperturados.filter(
    (c) => !alreadySavedIds.has(c.id) && !alreadyDraftIds.has(c.id)
  );

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    setCurrentPage(1);
  }, [escuelaId, periodoId]);

  const totalPages = Math.ceil(((demanda as any)?.lineas?.length ?? 0) / itemsPerPage);
  const paginatedLineas = useMemo(() => {
    const lines = (demanda as any)?.lineas ?? [];
    const start = (currentPage - 1) * itemsPerPage;
    return lines.slice(start, start + itemsPerPage);
  }, [demanda, currentPage]);

  // ── Permissions ──
  const canEdit =
    (isSecretaria || isAdmin) &&
    (!demanda || demanda.estado === 'BORRADOR' || demanda.estado === 'OBSERVADA' || demanda.estado === 'RECHAZADA');
  const canSubmit = canEdit && (demanda?.lineas?.length ?? 0) > 0 && lineas.length === 0;
  const canReview = (isDirector || isAdmin) && demanda?.estado === 'ENVIADA';

  // ── Mutations ──
  const saveMutation = useMutation({
    ...trpc.curso.saveDemanda.mutationOptions(),
    onSuccess: () => {
      queryClient.invalidateQueries();
      setLineas([]);
      refetch();
    },
    onError: (err: any) => {
      alert(`Error al guardar: ${err?.message ?? 'Error desconocido'}`);
    },
  });

  const submitMutation = useMutation({
    ...trpc.curso.submitDemanda.mutationOptions(),
    onSuccess: () => refetch(),
  });

  const reviewMutation = useMutation({
    ...trpc.curso.reviewDemanda.mutationOptions(),
    onSuccess: () => {
      setReviewModal(false);
      setReviewObs('');
      refetch();
    },
  });

  // ── Line helpers ──
  const addLinea = () =>
    setLineas((prev) => [
      ...prev,
      { cursoId: '', curriculas: [], numGruposLaboratorio: 0, motivoAperturaExcepcional: '' },
    ]);

  const removeLinea = (idx: number) => setLineas((prev) => prev.filter((_, i) => i !== idx));

  const updateLinea = (idx: number, field: keyof LineaDraft, value: any) =>
    setLineas((prev) => prev.map((l, i) => (i === idx ? { ...l, [field]: value } : l)));

  const precargarDesdeApertura = () => {
    if (pendingAperturados.length === 0) return;
    const nuevas: LineaDraft[] = pendingAperturados.map((c: any) => {
      const curriculasList = (c.cursoCurriculas ?? [])
        .filter((cc: any) => cc.curricula?.escuelaId === escuelaId)
        .map((cc: any) => ({ curriculaId: cc.curricula.id, ciclo: cc.ciclo }));
      
      return {
        cursoId: c.id,
        curriculas: curriculasList,
        numGruposLaboratorio: c.numGruposLaboratorio ?? 0,
        motivoAperturaExcepcional: '',
      };
    });
    setLineas((prev) => [...prev, ...nuevas]);
  };

  const getCurriculasForCourse = (cursoId: string) =>
    availableCourses.filter((ac) => ac.curso.id === cursoId);

  const handleSave = () => {
    if (!escuelaId || !periodoId) return;
    const validLineas = lineas.filter((l) => l.cursoId);
    if (validLineas.length === 0) return;

    saveMutation.mutate({
      escuelaId,
      periodoId,
      lineas: validLineas.map((l) => ({
        cursoId: l.cursoId,
        numGruposLaboratorio: l.numGruposLaboratorio,
        motivoAperturaExcepcional: l.motivoAperturaExcepcional || undefined,
        curriculas: l.curriculas,
      })),
    });
  };

  const handleSubmit = () => {
    if (!demanda?.id) return;
    submitMutation.mutate({ id: demanda.id });
  };

  const handleReview = () => {
    if (!demanda?.id) return;
    reviewMutation.mutate({
      id: demanda.id,
      estado: reviewEstado,
      observacion: reviewObs || undefined,
    });
  };

  // ── Access guard ──
  if (!canSee && user) {
    return (
      <div className="p-6">
        <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-xl text-danger">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span className="text-sm font-medium">Acceso restringido a Secretaria Academica y Director de Escuela.</span>
        </div>
      </div>
    );
  }

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-main flex items-center gap-2.5">
            <School className="w-7 h-7 text-primary" />
            Demanda Academica de Escuela
          </h1>
          <p className="text-sm text-text-sub mt-1">
            {isSecretaria
              ? 'Arma la demanda de cursos para el periodo y enviala al Director de Escuela para su aprobacion.'
              : isDirector
              ? 'Revisa la demanda enviada por la secretaria y aprueba o devuelvela con observaciones.'
              : 'Vista de administracion del flujo de demanda academica por escuela.'}
          </p>
        </div>

        {/* Selectors */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 bg-white border border-border rounded-lg px-3 py-2">
            <Calendar className="w-4 h-4 text-text-sub" />
            <select
              className="text-sm text-text-main outline-none bg-transparent font-medium"
              value={periodoId}
              onChange={(e) => setSelectedPeriodoId(e.target.value)}
            >
              {periodos.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre} {p.activo ? '(Activo)' : ''}
                </option>
              ))}
            </select>
          </div>

          {isAdmin && (
            <div className="flex items-center gap-2 bg-white border border-border rounded-lg px-3 py-2">
              <School className="w-4 h-4 text-text-sub" />
              <select
                className="text-sm text-text-main outline-none bg-transparent font-medium"
                value={escuelaId}
                onChange={(e) => setSelectedEscuelaId(e.target.value)}
              >
                <option value="">-- Selecciona escuela --</option>
                {escuelas.map((e) => (
                  <option key={e.id} value={e.id}>{e.nombre}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* ── Sin escuela vinculada ────────────────────────────────────────────── */}
      {!isAdmin && escuelas.length === 0 && !isLoading && (
        <div className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
          <AlertCircle className="w-5 h-5 text-warning shrink-0" />
          <span className="text-sm font-medium text-warning">
            No se encontro ninguna escuela vinculada a tu cuenta. Contacta al administrador.
          </span>
        </div>
      )}


      {/* ── Estado actual de la demanda ─────────────────────────────────────── */}
      {demanda && (
        <div className="card-standard flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-slate-100">
              <Eye className="w-5 h-5 text-text-sub" />
            </div>
            <div>
              <p className="font-bold text-text-main">Estado actual de la demanda</p>
              <p className="text-xs text-text-sub flex items-center gap-1 mt-0.5">
                <Clock className="w-3 h-3" />
                Version {demanda.version} &middot; {new Date(demanda.updatedAt).toLocaleString('es-PE')}
              </p>
            </div>
          </div>
          <span className={`${ESTADO_BADGE[demanda.estado]} text-lg px-4 py-2 font-bold uppercase tracking-wider`}>
            {ESTADO_LABEL[demanda.estado]}
          </span>
        </div>
      )}

      {/* ── Observacion del director ─────────────────────────────────────────── */}
      {demanda?.observacion && (
        <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
          <MessageSquare className="w-5 h-5 text-warning shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-warning mb-0.5">Observacion del director</p>
            <p className="text-sm text-amber-800">{demanda.observacion}</p>
          </div>
        </div>
      )}

      {/* ── Lineas guardadas en la demanda ──────────────────────────────────── */}
      {demanda && (demanda as any).lineas && (demanda as any).lineas.length > 0 && (
        <div className="card-standard space-y-4">
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-primary" />
            <h2 className="font-bold text-text-main text-lg">
              Cursos en la demanda
            </h2>
            <span className="badge badge-info ml-1">{(demanda as any).lineas.length}</span>
          </div>

          <div className="table-standard">
            <table className="w-full text-left border-separate border-spacing-0">
              <thead>
                <tr>
                  <th className="px-4 py-3">Codigo</th>
                  <th className="px-4 py-3">Curso</th>
                  <th className="px-4 py-3 text-center">HT / HP / HL</th>
                  <th className="px-4 py-3 text-center">G. Lab</th>
                  <th className="px-4 py-3">Plan / Ciclo</th>
                  <th className="px-4 py-3">Excepcion</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {paginatedLineas.map((linea: any) => (
                  <tr key={linea.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs font-bold text-text-sub">
                      {linea.curso?.codigo}
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-semibold text-text-main text-sm">{linea.curso?.nombre}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <span className="badge badge-info">{linea.horasTeoria}T</span>
                        <span className="badge badge-success">{linea.horasPractica}P</span>
                        <span className="badge badge-warning">{linea.horasLaboratorio}L</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {linea.numGruposLaboratorio > 0 ? (
                        <span className="badge badge-warning font-bold">{linea.numGruposLaboratorio}</span>
                      ) : (
                        <span className="text-text-sub text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {linea.curriculas?.map((lc: any) => (
                          <span key={lc.id} className="badge badge-gray">
                            {lc.curricula?.codigo ?? '?'} – Ciclo {lc.ciclo}
                          </span>
                        ))}
                        {(!linea.curriculas || linea.curriculas.length === 0) && (
                          <span className="text-text-sub text-xs">Sin plan</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-text-sub">
                      {linea.motivoAperturaExcepcional || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-border px-6 py-4 bg-white rounded-b-xl shadow-sm mt-3">
              <span className="text-sm text-text-sub font-medium">
                Mostrando pág. {currentPage} de {totalPages} ({(demanda as any).lineas.length} cursos)
              </span>
              <div className="flex gap-2">
                <button
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(prev => prev - 1)}
                  className="px-3 py-1.5 border border-border rounded-lg text-xs font-bold text-text-main hover:bg-slate-50 disabled:opacity-50 disabled:hover:bg-transparent transition-all"
                >
                  Anterior
                </button>
                <button
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(prev => prev + 1)}
                  className="px-3 py-1.5 border border-border rounded-lg text-xs font-bold text-text-main hover:bg-slate-50 disabled:opacity-50 disabled:hover:bg-transparent transition-all"
                >
                  Siguiente
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Sin demanda aun ─────────────────────────────────────────────────── */}
      {!isLoading && !demanda && escuelaId && periodoId && (
        <div className="card-standard flex flex-col items-center justify-center py-14 text-center gap-3">
          <div className="p-4 rounded-full bg-slate-100">
            <BookOpen className="w-8 h-8 text-slate-400" />
          </div>
          <div>
            <p className="font-bold text-lg text-text-main">Sin demanda registrada</p>
            <p className="text-sm text-text-sub mt-1 max-w-sm">
              Todavia no se creo ninguna demanda para este periodo.
              {(isSecretaria || isAdmin) ? ' Agrega cursos abajo para comenzar, o usa el boton de pre-carga.' : ''}
            </p>
          </div>
          {(isSecretaria || isAdmin) && pendingAperturados.length > 0 && (
            <button onClick={precargarDesdeApertura} className="btn-primary mt-2">
              <Download className="w-4 h-4" />
              Pre-cargar {pendingAperturados.length} cursos aperturados
            </button>
          )}
        </div>
      )}

      {/* ── Editor de lineas nuevas ─────────────────────────────────────────── */}
      {canEdit && escuelaId && periodoId && (
        <div className="card-standard space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-bold text-text-main text-lg">Agregar cursos a la demanda</h2>
              <p className="text-xs text-text-sub mt-0.5">
                Podes agregar un curso manualmente o pre-cargar desde la apertura
              </p>
            </div>
            <button className="btn-secondary" onClick={addLinea}>
              <Plus className="w-4 h-4" />
              Agregar curso
            </button>
          </div>

          {lineas.length === 0 && (
            <div className="py-8 text-center text-sm text-text-sub border border-dashed border-border rounded-xl bg-slate-50">
              {availableCourses.length === 0 && cursosAperturados.length === 0
                ? 'No hay cursos disponibles. Asegurate de tener curriculas activas o cursos aperturados.'
                : 'Haz clic en "Agregar curso" para comenzar.'}
            </div>
          )}

          {lineas.length > 0 && (
            <div className="space-y-3">
              {lineas.map((linea, idx) => {
                const curriculasForCourse = getCurriculasForCourse(linea.cursoId);
                // Find the full course info for the selected cursoId
                const cursoInfo = cursosAperturados.find((c) => c.id === linea.cursoId);

                // Get all possible curriculas for this course, deduplicated by curriculaId
                const allPossibleCurriculas = (() => {
                  const seen = new Map();
                  for (const ac of curriculasForCourse) {
                    if (!seen.has(ac.curriculaId)) {
                      seen.set(ac.curriculaId, { curriculaId: ac.curriculaId, ciclo: ac.ciclo, codigo: ac.curriculaCodigo });
                    }
                  }
                  if (cursoInfo?.cursoCurriculas) {
                    for (const cc of cursoInfo.cursoCurriculas) {
                      if (!seen.has(cc.curricula.id) && cc.curricula.escuelaId === escuelaId) {
                        seen.set(cc.curricula.id, { curriculaId: cc.curricula.id, ciclo: cc.ciclo, codigo: cc.curricula.codigo });
                      }
                    }
                  }
                  return [...seen.values()];
                })();

                return (
                  <div key={idx} className="bg-slate-50 border border-border rounded-xl p-4">
                    <div className="flex gap-3 items-start">
                      <div className="flex-1 space-y-3">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          {/* Curso */}
                          <div>
                            <label className="label-standard">Curso</label>
                            <select
                              className="input-standard"
                              value={linea.cursoId}
                              onChange={(e) => {
                              const newCursoId = e.target.value;
                              updateLinea(idx, 'cursoId', newCursoId);
                              // Auto-select all curriculas for this course if available
                              if (newCursoId) {
                                const fromAperturados = cursosAperturados.find((c) => c.id === newCursoId);
                                const fromAvailable = availableCourses.filter((ac) => ac.curso.id === newCursoId);
                                const initialCurriculas: Array<{ curriculaId: string; ciclo: number }> = [];
                                
                                if (fromAperturados?.cursoCurriculas) {
                                  for (const cc of fromAperturados.cursoCurriculas) {
                                    if ((cc as any).curricula?.escuelaId === escuelaId && !cc.desasociadaEn) {
                                      initialCurriculas.push({ curriculaId: (cc as any).curricula.id, ciclo: cc.ciclo });
                                    }
                                  }
                                } else {
                                  for (const ac of fromAvailable) {
                                    initialCurriculas.push({ curriculaId: ac.curriculaId, ciclo: ac.ciclo });
                                  }
                                }
                                
                                updateLinea(idx, 'curriculas', initialCurriculas);
                              } else {
                                updateLinea(idx, 'curriculas', []);
                              }
                            }}
                            >
                              <option value="">-- Selecciona --</option>
                              {/* Merge aperturados + curricula courses, unique by id */}
                              {(() => {
                                const seen = new Map<string, { id: string; codigo: string; nombre: string }>();
                                for (const c of cursosAperturados) {
                                  seen.set(c.id, { id: c.id, codigo: c.codigo, nombre: c.nombre });
                                }
                                for (const ac of availableCourses) {
                                  if (!seen.has(ac.curso.id)) {
                                    seen.set(ac.curso.id, { id: ac.curso.id, codigo: ac.curso.codigo, nombre: ac.curso.nombre });
                                  }
                                }
                                return [...seen.values()].map((c) => (
                                  <option key={c.id} value={c.id}>
                                    [{c.codigo}] {c.nombre}
                                  </option>
                                ));
                              })()}
                            </select>
                          </div>

                          {/* Grupos de lab */}
                          <div>
                            <label className="label-standard">Grupos Lab</label>
                            <div className="relative">
                              <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-sub" />
                              <input
                                type="number"
                                min={0}
                                max={10}
                                className="input-standard pl-9"
                                placeholder="0"
                                value={linea.numGruposLaboratorio}
                                onChange={(e) => updateLinea(idx, 'numGruposLaboratorio', Number(e.target.value))}
                              />
                            </div>
                          </div>

                          {/* Motivo excepcion */}
                          <div>
                            <label className="label-standard">Excepcion (opcional)</label>
                            <input
                              type="text"
                              className="input-standard"
                              placeholder="Motivo de excepcion..."
                              value={linea.motivoAperturaExcepcional}
                              onChange={(e) => updateLinea(idx, 'motivoAperturaExcepcional', e.target.value)}
                            />
                          </div>
                        </div>

                        {/* Curricula (checkboxes) */}
                        {linea.cursoId && allPossibleCurriculas.length > 0 && (
                          <div>
                            <label className="label-standard">Plan(es) de estudio</label>
                            <div className="flex flex-wrap gap-3">
                              {allPossibleCurriculas.map((curr) => {
                                const isSelected = linea.curriculas.some((c) => c.curriculaId === curr.curriculaId);
                                return (
                                  <label
                                    key={curr.curriculaId}
                                    className="flex items-center gap-2 px-3 py-2 border border-border rounded-lg cursor-pointer hover:bg-white transition-all"
                                  >
                                    <input
                                      type="checkbox"
                                      checked={isSelected}
                                      onChange={(e) => {
                                        if (e.target.checked) {
                                          updateLinea(idx, 'curriculas', [...linea.curriculas, { curriculaId: curr.curriculaId, ciclo: curr.ciclo }]);
                                        } else {
                                          updateLinea(idx, 'curriculas', linea.curriculas.filter((c) => c.curriculaId !== curr.curriculaId));
                                        }
                                      }}
                                    />
                                    <span className="text-sm text-text-main font-medium">{curr.codigo} • Ciclo {curr.ciclo}</span>
                                  </label>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>

                      <button
                        onClick={() => removeLinea(idx)}
                        className="mt-5 p-2 rounded-lg text-text-sub hover:bg-red-50 hover:text-danger transition-all shrink-0"
                        title="Eliminar linea"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}

              {/* Save button */}
              {lineas.some((l) => l.cursoId) && (
                <div className="flex justify-end pt-2">
                  <button
                    onClick={handleSave}
                    disabled={saveMutation.isPending}
                    className="btn-primary"
                  >
                    {saveMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4" />
                    )}
                    Guardar borrador
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Acciones principales ────────────────────────────────────────────── */}
      {(canSubmit || canReview) && (
        <div className="flex gap-3 justify-end flex-wrap">
          {canSubmit && demanda && (
            <button
              onClick={handleSubmit}
              disabled={submitMutation.isPending}
              className="btn-primary bg-indigo-600 hover:bg-indigo-700"
            >
              {submitMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              Enviar al Director
            </button>
          )}

          {canReview && (
            <button
              onClick={() => setReviewModal(true)}
              className="btn-primary"
            >
              <Eye className="w-4 h-4" />
              Revisar y decidir
            </button>
          )}
        </div>
      )}

      {/* ── Loading ─────────────────────────────────────────────────────────── */}
      {isLoading && (
        <div className="flex justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      )}

      {/* ── Modal revision ──────────────────────────────────────────────────── */}
      {reviewModal && (
        <div className="modal-overlay">
          <div className="modal-content max-w-md">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="font-bold text-lg text-text-main">Revision de Demanda Academica</h3>
                <p className="text-xs text-text-sub mt-0.5">Selecciona tu decision y confirma</p>
              </div>
              <button
                onClick={() => setReviewModal(false)}
                className="p-1.5 rounded-lg text-text-sub hover:bg-slate-100 transition-colors"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="label-standard">Decision</label>
                <div className="grid grid-cols-3 gap-2 mt-2">
                  {(['APROBADA', 'OBSERVADA', 'RECHAZADA'] as const).map((est) => (
                    <label
                      key={est}
                      className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border cursor-pointer transition-all text-center ${
                        reviewEstado === est
                          ? 'border-primary bg-primary/5'
                          : 'border-border bg-slate-50 hover:border-primary/30'
                      }`}
                    >
                      <input
                        type="radio"
                        className="sr-only"
                        checked={reviewEstado === est}
                        onChange={() => setReviewEstado(est)}
                      />
                      {est === 'APROBADA' && <CheckCircle2 className={`w-5 h-5 ${reviewEstado === est ? 'text-success' : 'text-text-sub'}`} />}
                      {est === 'OBSERVADA' && <AlertCircle className={`w-5 h-5 ${reviewEstado === est ? 'text-warning' : 'text-text-sub'}`} />}
                      {est === 'RECHAZADA' && <XCircle className={`w-5 h-5 ${reviewEstado === est ? 'text-danger' : 'text-text-sub'}`} />}
                      <span className={`text-[11px] font-bold uppercase tracking-wide ${
                        reviewEstado === est ? 'text-primary' : 'text-text-sub'
                      }`}>{ESTADO_LABEL[est]}</span>
                    </label>
                  ))}
                </div>
              </div>

              {reviewEstado !== 'APROBADA' && (
                <div>
                  <label className="label-standard">
                    Observacion <span className="text-danger">*</span>
                  </label>
                  <textarea
                    className="input-standard resize-none"
                    rows={3}
                    placeholder="Describe las observaciones o motivo de rechazo..."
                    value={reviewObs}
                    onChange={(e) => setReviewObs(e.target.value)}
                  />
                </div>
              )}
            </div>

            <div className="flex gap-3 justify-end mt-6 pt-4 border-t border-border">
              <button onClick={() => setReviewModal(false)} className="btn-secondary">
                Cancelar
              </button>
              <button
                onClick={handleReview}
                disabled={reviewMutation.isPending || (reviewEstado !== 'APROBADA' && !reviewObs)}
                className={`btn-primary ${
                  reviewEstado === 'RECHAZADA'
                    ? 'bg-danger hover:bg-red-800'
                    : reviewEstado === 'OBSERVADA'
                    ? 'bg-warning hover:bg-amber-800'
                    : ''
                }`}
              >
                {reviewMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : reviewEstado === 'APROBADA' ? (
                  <CheckCircle2 className="w-4 h-4" />
                ) : (
                  <XCircle className="w-4 h-4" />
                )}
                Confirmar decision
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
