'use client';

import { useTRPC } from '@/trpc/client';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { Building2, FlaskConical, User, Calendar, FileDown, CheckCircle2, XCircle, Send, AlertTriangle, EyeOff, Loader2, X } from 'lucide-react';

const DIAS = ['LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO'];
const DIA_LABELS: Record<string, string> = {
  LUNES: 'Lun', MARTES: 'Mar', MIERCOLES: 'Mié',
  JUEVES: 'Jue', VIERNES: 'Vie', SABADO: 'Sáb',
};

const ESTADO_LABELS: Record<string, string> = {
  PLANIFICACION: 'Planificación',
  POSTULACION: 'Postulación',
  ASIGNACION: 'Asignación',
  REVISION: 'En revisión',
  APROBADO: 'Aprobado',
  FINALIZADO: 'Publicado',
};

const ESTADO_COLORS: Record<string, string> = {
  PLANIFICACION: 'bg-slate-100 text-slate-500 border-slate-200',
  POSTULACION: 'bg-primary/10 text-primary border-primary/20',
  ASIGNACION: 'bg-warning/10 text-warning border-warning/20',
  REVISION: 'bg-info/10 text-info border-info/20',
  APROBADO: 'bg-success/10 text-success border-success/20',
  FINALIZADO: 'bg-success text-white border-success/20',
};

const SLOT_COLORS = [
  'bg-blue-50 border-blue-200 text-blue-700',
  'bg-purple-50 border-purple-200 text-purple-700',
  'bg-emerald-50 border-emerald-200 text-emerald-700',
  'bg-amber-50 border-amber-200 text-amber-700',
  'bg-rose-50 border-rose-200 text-rose-700',
  'bg-sky-50 border-sky-200 text-sky-700',
  'bg-indigo-50 border-indigo-200 text-indigo-700',
  'bg-teal-50 border-teal-200 text-teal-700',
  'bg-orange-50 border-orange-200 text-orange-700',
  'bg-lime-50 border-lime-200 text-lime-700',
];

type ViewMode = 'general' | 'aula' | 'docente' | 'mi-horario' | 'ciclo';

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

export default function HorariosPage() {
  const trpc = useTRPC();
  const { data: user } = useQuery({ ...trpc.auth.me.queryOptions() });
  const isDocente = user?.role === 'DOCENTE';
  const isDirector = user?.role === 'DIRECTOR_ESCUELA';
  const isSecretaria = user?.role === 'SECRETARIA_ACADEMICA';
  const isAdmin = user?.role === 'ADMIN';
  const isPrivileged = isAdmin || isSecretaria || isDirector;

  const [viewMode, setViewMode] = useState<ViewMode>(isDocente ? 'mi-horario' : 'general');
  const [selectedAulaId, setSelectedAulaId] = useState<string | null>(null);
  const [selectedDocenteId, setSelectedDocenteId] = useState<string | null>(null);
  const [selectedCiclo, setSelectedCiclo] = useState<number | null>(1);
  const [rejectComment, setRejectComment] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);

  const { data: periodoActivo } = useQuery({ ...trpc.periodo.active.queryOptions() });
  const { data: approvalInfo, refetch: refetchApproval } = useQuery({
    ...trpc.horario.getApprovalInfo.queryOptions(),
    enabled: !!periodoActivo?.id,
  });
  const { data: aulas = [] } = useQuery({ ...trpc.aula.list.queryOptions({}) });
  const { data: docentes = [] } = useQuery({ ...trpc.docente.list.queryOptions({}) });
  const { data: stats } = useQuery({ ...trpc.horario.stats.queryOptions({ periodoId: periodoActivo?.id ?? '' }), enabled: !!periodoActivo?.id });

  const queryInput = viewMode === 'aula' && selectedAulaId
    ? { aulaId: selectedAulaId, periodoId: periodoActivo?.id ?? '' }
    : viewMode === 'docente' && selectedDocenteId
      ? { docenteId: selectedDocenteId, periodoId: periodoActivo?.id ?? '' }
      : viewMode === 'mi-horario' && user?.docenteId
        ? { docenteId: user.docenteId, periodoId: periodoActivo?.id ?? '' }
        : { periodoId: periodoActivo?.id ?? '' };

  const { data: rawAsignaciones = [], isLoading } = useQuery({
    ...trpc.horario.list.queryOptions(queryInput),
    enabled: !!periodoActivo?.id,
  });

  const estado = periodoActivo?.estado ?? 'PLANIFICACION';
  const isPublished = estado === 'APROBADO' || estado === 'FINALIZADO';

  const asignaciones = (rawAsignaciones as HorarioAsignacion[]).filter(a => {
    const isVisible = isPrivileged || isPublished || a.confirmado;
    if (!isVisible) return false;
    if (viewMode === 'ciclo' && selectedCiclo !== null) {
      return a.grupo.curso.ciclo === selectedCiclo;
    }
    return true;
  });

  const downloadBase64PDF = (base64: string, filename: string) => {
    const link = document.createElement('a');
    link.href = `data:application/pdf;base64,${base64}`;
    link.download = filename;
    link.click();
  };

  const generatePDFMutation = useMutation(
    trpc.reporte.generatePDF.mutationOptions({
      onSuccess: (data) => downloadBase64PDF(data.pdf, data.filename),
      onError: () => alert('Error al generar el PDF'),
    })
  );

  const approveMutation = useMutation(
    trpc.horario.approveSchedule.mutationOptions({
      onSuccess: () => { refetchApproval(); alert('Horario aprobado correctamente.'); },
      onError: (e) => alert(e.message),
    })
  );

  const rejectMutation = useMutation(
    trpc.horario.rejectSchedule.mutationOptions({
      onSuccess: () => { setShowRejectModal(false); setRejectComment(''); refetchApproval(); alert('Horario devuelto a la secretaria para correcciones.'); },
      onError: (e) => alert(e.message),
    })
  );

  const publishMutation = useMutation(
    trpc.horario.publishSchedule.mutationOptions({
      onSuccess: () => { refetchApproval(); alert('Horario publicado. Ahora es visible para todos los usuarios.'); },
      onError: (e) => alert(e.message),
    })
  );

  const sendToRevisionMutation = useMutation(
    trpc.horario.sendToRevision.mutationOptions({
      onSuccess: () => { refetchApproval(); alert('Asignación enviada al director para revisión.'); },
      onError: (e) => alert(e.message),
    })
  );

  const horas = [...new Set(asignaciones.map((a) => a.franjaHoraria.horaInicio))].sort();

  const uniqueCourseIds = Array.from(new Set(rawAsignaciones.map(a => a.grupo?.curso?.id))).filter(Boolean) as string[];
  const cursoColorMap = new Map<string, string>();
  uniqueCourseIds.sort().forEach((id, i) => {
    cursoColorMap.set(id, SLOT_COLORS[i % SLOT_COLORS.length]);
  });

  const canViewContent = isPrivileged || isPublished;

  return (
    <div className="space-y-6">
      {/* ===== APPROVAL BANNER ===== */}
      {isDirector && estado === 'REVISION' && (
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-5">
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div>
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-primary" />
                <h2 className="text-lg font-bold text-text-main">Horario pendiente de revisión</h2>
              </div>
              <p className="text-sm text-text-main mt-1 font-medium">
                La secretaria ha enviado la asignación para su aprobación.
                Revise el horario y apruebe o devuelva con observaciones.
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowRejectModal(true)}
                className="btn-secondary text-danger border-danger/30 hover:bg-danger/5"
              >
                <XCircle className="h-4 w-4" /> Devolver con observaciones
              </button>
              <button
                onClick={() => {
                  if (!periodoActivo?.id) return;
                  approveMutation.mutate({ periodoId: periodoActivo.id, comentarios: 'Horario conforme. Aprobado por Dirección de Escuela.' });
                }}
                disabled={approveMutation.isPending}
                className="btn-primary"
              >
                <CheckCircle2 className="h-4 w-4" /> {approveMutation.isPending ? 'Aprobando...' : 'Aprobar horario'}
              </button>
            </div>
          </div>

          {/* Reject Modal Inline */}
          {showRejectModal && (
            <div className="mt-4 rounded-lg border border-danger/20 bg-white p-4 shadow-sm">
              <p className="text-sm font-bold text-text-main mb-2">Motivo de devolución (obligatorio)</p>
              <textarea
                value={rejectComment}
                onChange={(e) => setRejectComment(e.target.value)}
                placeholder="Describa las correcciones necesarias..."
                className="input-standard h-24"
              />
              <div className="flex gap-2 mt-3">
                <button
                  onClick={() => {
                    if (!periodoActivo?.id || !rejectComment.trim()) return;
                    rejectMutation.mutate({ periodoId: periodoActivo.id, comentarios: rejectComment.trim() });
                  }}
                  disabled={rejectMutation.isPending || !rejectComment.trim()}
                  className="btn-primary bg-danger hover:bg-red-700"
                >
                  {rejectMutation.isPending ? 'Devolviendo...' : 'Confirmar devolución'}
                </button>
                <button
                  onClick={() => { setShowRejectModal(false); setRejectComment(''); }}
                  className="btn-secondary"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ===== DIRECTOR REJECTION FEEDBACK (for secretary) ===== */}
      {isSecretaria && estado === 'ASIGNACION' && approvalInfo?.comentariosDirector && (
        <div className="rounded-xl border border-warning/30 bg-warning/5 p-5">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-warning mt-0.5 shrink-0" />
            <div>
              <h2 className="text-lg font-bold text-text-main">Horario devuelto por el director</h2>
              <p className="text-sm text-text-main mt-1 font-medium">
                El director ha solicitado modificaciones. Realice los ajustes necesarios y vuelva a enviar para revisión.
              </p>
              <div className="mt-3 rounded-lg border border-warning/20 bg-white p-4">
                <p className="text-xs font-bold text-warning uppercase tracking-wider mb-1">Observaciones del director:</p>
                <p className="text-sm text-text-main font-semibold italic">"{approvalInfo.comentariosDirector}"</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===== APPROVED / PUBLISHED BANNER ===== */}
      {estado === 'APROBADO' && (
        <div className="rounded-xl border border-success/30 bg-success/5 p-5">
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-success" />
                <h2 className="text-lg font-bold text-text-main">Horario aprobado</h2>
              </div>
              <p className="text-sm text-text-main mt-1 font-medium">
                {approvalInfo?.aprobadoPor?.nombre ? `Aprobado por ${approvalInfo.aprobadoPor.nombre}` : 'Aprobado por Dirección de Escuela'}.
                {approvalInfo?.fechaAprobacion ? ` ${new Date(approvalInfo.fechaAprobacion).toLocaleDateString('es-PE')}` : ''}
              </p>
            </div>
            {isDirector && (
              <button
                onClick={() => {
                  if (!periodoActivo?.id) return;
                  if (!confirm('¿Publicar este horario? Será visible para todos los usuarios.')) return;
                  publishMutation.mutate({ periodoId: periodoActivo.id });
                }}
                disabled={publishMutation.isPending}
                className="btn-primary bg-success hover:bg-green-700"
              >
                <Send className="h-4 w-4" /> {publishMutation.isPending ? 'Publicando...' : 'Publicar horario'}
              </button>
            )}
          </div>
        </div>
      )}

      {estado === 'FINALIZADO' && (
        <div className="rounded-xl border border-success/30 bg-success/5 p-5">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="h-5 w-5 text-success mt-0.5 shrink-0" />
            <div>
              <h2 className="text-lg font-bold text-text-main">Horario publicado</h2>
              <p className="text-sm text-text-main font-medium">El horario ya está visible para todos los usuarios de la escuela.</p>
            </div>
          </div>
        </div>
      )}

      {/* ===== DRAFT PREVIEW for privileged users during ASIGNACION ===== */}
      {isPrivileged && estado === 'ASIGNACION' && (
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-primary shrink-0 mt-0.5" />
            <div>
              <h2 className="text-sm font-bold text-text-main">Previsualización — Asignación en curso</h2>
              <p className="text-xs text-text-main mt-1 font-medium">
                La secretaria está asignando los horarios. Esta vista es solo para seguimiento interno.
                El horario no será visible para docentes ni público hasta que sea aprobado y publicado.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ===== NOT PUBLISHED — Non-privileged ===== */}
      {!isPrivileged && !isPublished && (
        <div className="rounded-2xl border border-border bg-white p-16 text-center shadow-sm">
          <div className="h-20 w-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <EyeOff className="h-10 w-10 text-text-sub" />
          </div>
          <h2 className="text-2xl font-bold text-text-main tracking-tight">Horario no disponible</h2>
          <p className="text-text-sub mt-2 max-w-md mx-auto font-medium">
            El proceso de asignación de horarios aún no ha finalizado.
            El horario será visible aquí una vez que el director de escuela lo apruebe y publique.
          </p>
        </div>
      )}

      {/* ===== HEADER & CONTROLS (only if can view) ===== */}
      {canViewContent && (
        <>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-text-main tracking-tight">Visualización de Horarios</h1>
              <div className="flex items-center gap-3 mt-1.5">
                <p className="text-sm text-text-sub font-bold">{periodoActivo?.nombre ?? 'Sin periodo activo'}</p>
                <div className="h-1 w-1 rounded-full bg-slate-300" />
                <div className="flex items-center gap-1.5">
                  <span className={`badge ${ESTADO_COLORS[estado] ?? 'badge-gray'}`}>
                    {ESTADO_LABELS[estado] ?? estado}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              {isSecretaria && estado === 'ASIGNACION' && (
                <button
                  onClick={() => {
                    if (!periodoActivo?.id) return;
                    if (!confirm('¿Enviar la asignación actual al director para revisión?')) return;
                    sendToRevisionMutation.mutate({ periodoId: periodoActivo.id });
                  }}
                  disabled={sendToRevisionMutation.isPending}
                  className="btn-primary bg-indigo-600 hover:bg-indigo-700"
                >
                  <Send className="h-4 w-4" /> {sendToRevisionMutation.isPending ? 'Enviando...' : 'Enviar a revisión'}
                </button>
              )}

              <button
                onClick={() => {
                  if (!periodoActivo) return;
                  let tipo: 'por-aula' | 'por-laboratorio' | 'por-docente' | 'por-ciclo' = 'por-ciclo';
                  let docenteId: string | undefined = undefined;
                  let aulaId: string | undefined = undefined;
                  let ciclo: number | undefined = undefined;

                  if (viewMode === 'mi-horario') {
                    tipo = 'por-docente';
                    docenteId = user?.docenteId || undefined;
                  } else if (viewMode === 'docente') {
                    tipo = 'por-docente';
                    docenteId = selectedDocenteId || undefined;
                  } else if (viewMode === 'aula') {
                    const selectedAula = aulas.find(a => a.id === selectedAulaId);
                    tipo = selectedAula?.tipo === 'LABORATORIO' ? 'por-laboratorio' : 'por-aula';
                    aulaId = selectedAulaId || undefined;
                  } else if (viewMode === 'ciclo') {
                    tipo = 'por-ciclo';
                    ciclo = selectedCiclo || undefined;
                  }

                  generatePDFMutation.mutate({
                    periodoId: periodoActivo.id,
                    tipo,
                    docenteId,
                    aulaId,
                    ciclo
                  });
                }}
                disabled={generatePDFMutation.isPending || !periodoActivo}
                className="btn-secondary"
              >
                <FileDown className="h-4 w-4" /> {generatePDFMutation.isPending ? 'Generando...' : 'Descargar PDF'}
              </button>
            </div>
          </div>

          {/* Stats Cards */}
          {isPrivileged && stats && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="card-standard p-4">
                <p className="text-[10px] text-text-sub uppercase font-bold mb-1 tracking-wider">Progreso de Asignación</p>
                <div className="flex items-end justify-between">
                  <span className="text-2xl font-bold text-text-main">{stats.totalGrupos > 0 ? Math.round((stats.gruposAsignados / stats.totalGrupos) * 100) : 0}%</span>
                  <span className="text-xs text-text-sub font-bold">{stats.gruposAsignados} / {stats.totalGrupos} grupos</span>
                </div>
              </div>
              <div className="card-standard p-4">
                <p className="text-[10px] text-text-sub uppercase font-bold mb-1 tracking-wider">Docentes con carga</p>
                <p className="text-2xl font-bold text-text-main">{stats.docentesConCarga}</p>
              </div>
              <div className="card-standard p-4">
                <p className="text-[10px] text-text-sub uppercase font-bold mb-1 tracking-wider">Estado Actual</p>
                <div className="flex items-center gap-2 mt-1">
                  <div className={`h-2 w-2 rounded-full ${estado === 'FINALIZADO' ? 'bg-success' : 'bg-primary'} animate-pulse`} />
                  <span className="text-sm font-bold text-text-main">{ESTADO_LABELS[estado] ?? estado}</span>
                </div>
              </div>
            </div>
          )}

          {/* Navigation Tabs */}
          <div className="flex gap-1 p-1 bg-slate-100 border border-border rounded-xl w-fit">
            {isDocente && (
              <button onClick={() => setViewMode('mi-horario')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all uppercase tracking-wider ${viewMode === 'mi-horario' ? 'bg-white text-primary shadow-sm' : 'text-text-sub hover:text-text-main'}`}>
                <Calendar className="h-4 w-4" /> Mi Horario
              </button>
            )}
            <button onClick={() => setViewMode('general')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all uppercase tracking-wider ${viewMode === 'general' ? 'bg-white text-primary shadow-sm' : 'text-text-sub hover:text-text-main'}`}>
              Vista General
            </button>
            <button onClick={() => setViewMode('ciclo')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all uppercase tracking-wider ${viewMode === 'ciclo' ? 'bg-white text-primary shadow-sm' : 'text-text-sub hover:text-text-main'}`}>
              Por Ciclo
            </button>
            <button onClick={() => setViewMode('aula')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all uppercase tracking-wider ${viewMode === 'aula' ? 'bg-white text-primary shadow-sm' : 'text-text-sub hover:text-text-main'}`}>
              <Building2 className="h-4 w-4" /> Por Aula
            </button>
            {(isDirector || isSecretaria || isAdmin) && (
              <button onClick={() => setViewMode('docente')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all uppercase tracking-wider ${viewMode === 'docente' ? 'bg-white text-primary shadow-sm' : 'text-text-sub hover:text-text-main'}`}>
                <User className="h-4 w-4" /> Por Docente
              </button>
            )}
          </div>

          {/* Selectors */}
          <div className="flex flex-wrap gap-2">
            {viewMode === 'ciclo' && [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(c => (
              <button key={c} onClick={() => setSelectedCiclo(c)}
                className={`rounded-lg border px-4 py-1.5 text-[10px] font-bold transition-all uppercase tracking-widest ${selectedCiclo === c ? 'border-primary bg-primary-light text-primary shadow-sm' : 'border-border bg-white text-text-sub hover:border-primary/30'}`}>
                CICLO {c}
              </button>
            ))}
            {viewMode === 'aula' && aulas.map(a => (
              <button key={a.id} onClick={() => setSelectedAulaId(a.id)}
                className={`rounded-lg border px-3 py-1.5 text-[10px] font-bold transition-all uppercase tracking-widest ${selectedAulaId === a.id ? 'border-primary bg-primary-light text-primary shadow-sm' : 'border-border bg-white text-text-sub hover:border-primary/30'}`}>
                {a.codigo} {a.tipo === 'LABORATORIO' && <FlaskConical className="inline h-3 w-3 ml-1" />}
              </button>
            ))}
            {viewMode === 'docente' && docentes.map(d => (
              <button key={d.id} onClick={() => setSelectedDocenteId(d.id)}
                className={`rounded-lg border px-3 py-1.5 text-[10px] font-bold transition-all uppercase tracking-widest ${selectedDocenteId === d.id ? 'border-primary bg-primary-light text-primary shadow-sm' : 'border-border bg-white text-text-sub hover:border-primary/30'}`}>
                {d.nombre.split(' ').slice(0, 2).join(' ')}
              </button>
            ))}
          </div>

          {/* Grid Container */}
          <div className="table-standard overflow-x-auto shadow-sm">
            <table className="w-full text-[11px] border-collapse">
              <thead>
                <tr className="bg-slate-50/80">
                  <th className="px-4 py-4 text-left font-bold text-text-sub uppercase tracking-wider w-24 sticky left-0 bg-slate-50 border-b border-border">Hora</th>
                  {DIAS.map(dia => (
                    <th key={dia} className="px-2 py-4 text-center font-bold text-text-sub uppercase tracking-wider min-w-[160px] border-b border-border">
                      {DIA_LABELS[dia]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td colSpan={7} className="py-24 text-center">
                    <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-3" />
                    <p className="text-text-sub font-bold">Cargando grilla horaria...</p>
                  </td></tr>
                ) : horas.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-20 text-center text-text-sub font-bold italic">
                    {isPrivileged ? 'No hay asignaciones para mostrar' : 'No hay asignaciones confirmadas para mostrar'}
                  </td></tr>
                ) : (
                  horas.map(hora => (
                    <tr key={hora} className="border-b border-slate-50 last:border-0">
                      <td className="px-4 py-4 font-mono font-bold text-text-sub bg-slate-50/30 sticky left-0 border-r border-border/50">{hora}</td>
                      {DIAS.map(dia => {
                        const slots = asignaciones.filter(a => a.franjaHoraria.dia === dia && a.franjaHoraria.horaInicio === hora);
                        
                        return (
                            <td key={dia} className="p-1 border-r border-slate-50 last:border-0 min-h-[80px]">
                              <div className={`grid gap-1.5 ${slots.length > 1 ? 'grid-cols-1 xl:grid-cols-2' : 'grid-cols-1'}`}>
                                {slots.map((slot, idx) => {
                                const colorClass = cursoColorMap.get(slot.grupo.curso.id) || SLOT_COLORS[0];
                                return (
                                  <div key={`${slot.id}-${idx}`} className={`h-full min-h-[70px] rounded-xl border p-3 shadow-sm transition-all hover:shadow-md ${colorClass}`}>
                                    <div className="flex justify-between items-start mb-1.5">
                                      <span className="text-[9px] font-black uppercase tracking-tighter opacity-70">{slot.grupo.curso.codigo}</span>
                                      <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-md bg-white/40 border border-white/20">{slot.tipo}</span>
                                    </div>
                                    <p className="font-bold text-[11px] leading-tight mb-2 line-clamp-2">{slot.grupo.curso.nombre}</p>
                                    <div className="space-y-1">
                                      <div className="flex items-center gap-1.5">
                                        <User className="h-3 w-3 shrink-0 opacity-60" />
                                        <span className="text-[9px] font-bold truncate">{slot.docente?.nombre ?? 'Sin docente'}</span>
                                      </div>
                                      <div className="flex items-center gap-1.5">
                                        <Building2 className="h-3 w-3 shrink-0 opacity-60" />
                                        <span className="text-[9px] font-bold">{slot.aula?.codigo ?? 'Sin aula'}</span>
                                      </div>
                                    </div>
                                    {viewMode === 'general' && (
                                      <div className="mt-2 pt-1.5 border-t border-current/10">
                                        <span className="text-[8px] font-black uppercase">Grupo {slot.grupo.nombre}</span>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
