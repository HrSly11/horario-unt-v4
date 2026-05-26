'use client';

import { useTRPC } from '@/trpc/client';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { Building2, FlaskConical, User, Calendar, FileDown, CheckCircle2, XCircle, Send, AlertTriangle, EyeOff } from 'lucide-react';

const DIAS = ['LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES'];
const DIA_LABELS: Record<string, string> = {
  LUNES: 'Lun', MARTES: 'Mar', MIERCOLES: 'Mié',
  JUEVES: 'Jue', VIERNES: 'Vie',
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
  PLANIFICACION: 'bg-slate-500',
  POSTULACION: 'bg-blue-500',
  ASIGNACION: 'bg-amber-500',
  REVISION: 'bg-purple-500',
  APROBADO: 'bg-emerald-500',
  FINALIZADO: 'bg-emerald-600',
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
        <div className="rounded-xl border border-purple-500/30 bg-purple-500/10 p-5">
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div>
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-purple-400" />
                <h2 className="text-lg font-bold text-purple-200">Horario pendiente de revisión</h2>
              </div>
              <p className="text-sm text-purple-300/70 mt-1">
                La secretaria ha enviado la asignación para su aprobación.
                Revise el horario y apruebe o devuelva con observaciones.
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowRejectModal(true)}
                className="flex items-center gap-2 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm font-bold text-red-300 hover:bg-red-500/20 transition-colors"
              >
                <XCircle className="h-4 w-4" /> Devolver con observaciones
              </button>
              <button
                onClick={() => {
                  if (!periodoActivo?.id) return;
                  approveMutation.mutate({ periodoId: periodoActivo.id, comentarios: 'Horario conforme. Aprobado por Dirección de Escuela.' });
                }}
                disabled={approveMutation.isPending}
                className="flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2 text-sm font-bold text-white hover:bg-emerald-500 transition-colors disabled:opacity-50"
              >
                <CheckCircle2 className="h-4 w-4" /> {approveMutation.isPending ? 'Aprobando...' : 'Aprobar horario'}
              </button>
            </div>
          </div>

          {/* Reject Modal */}
          {showRejectModal && (
            <div className="mt-4 rounded-lg border border-red-500/20 bg-red-500/5 p-4">
              <p className="text-sm font-bold text-red-300 mb-2">Motivo de devolución (obligatorio)</p>
              <textarea
                value={rejectComment}
                onChange={(e) => setRejectComment(e.target.value)}
                placeholder="Describa las correcciones necesarias para que la secretaria realice los ajustes..."
                className="w-full rounded-lg border border-red-500/30 bg-gray-950 px-4 py-3 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-red-500/50"
                rows={3}
              />
              <div className="flex gap-2 mt-3">
                <button
                  onClick={() => {
                    if (!periodoActivo?.id || !rejectComment.trim()) return;
                    rejectMutation.mutate({ periodoId: periodoActivo.id, comentarios: rejectComment.trim() });
                  }}
                  disabled={rejectMutation.isPending || !rejectComment.trim()}
                  className="rounded-lg bg-red-600 px-4 py-2 text-xs font-bold text-white hover:bg-red-500 disabled:opacity-50"
                >
                  {rejectMutation.isPending ? 'Devolviendo...' : 'Confirmar devolución'}
                </button>
                <button
                  onClick={() => { setShowRejectModal(false); setRejectComment(''); }}
                  className="rounded-lg border border-gray-700 px-4 py-2 text-xs font-bold text-gray-400 hover:text-white"
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
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-5">
          <div className="flex items-start gap-3">
            <XCircle className="h-5 w-5 text-amber-400 mt-0.5 shrink-0" />
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

      {/* ===== APPROVED / PUBLISHED BANNER ===== */}
      {estado === 'APROBADO' && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-5">
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                <h2 className="text-lg font-bold text-emerald-200">Horario aprobado</h2>
              </div>
              <p className="text-sm text-emerald-300/70 mt-1">
                {approvalInfo?.aprobadoPor?.nombre ? `Aprobado por ${approvalInfo.aprobadoPor.nombre}` : 'Aprobado por Dirección de Escuela'}.
                {approvalInfo?.fechaAprobacion ? ` ${new Date(approvalInfo.fechaAprobacion).toLocaleDateString('es-PE')}` : ''}
                {approvalInfo?.comentariosDirector && (
                  <span className="block mt-1 italic">&ldquo;{approvalInfo.comentariosDirector}&rdquo;</span>
                )}
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
                className="flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2 text-sm font-bold text-white hover:bg-emerald-500 transition-colors disabled:opacity-50"
              >
                <Send className="h-4 w-4" /> {publishMutation.isPending ? 'Publicando...' : 'Publicar horario'}
              </button>
            )}
          </div>
        </div>
      )}

      {estado === 'FINALIZADO' && (
        <div className="rounded-xl border border-emerald-600/30 bg-emerald-600/10 p-4">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-emerald-400" />
            <div>
              <h2 className="text-lg font-bold text-emerald-200">Horario publicado</h2>
              <p className="text-sm text-emerald-300/70">Visible para todos los usuarios de la escuela.</p>
            </div>
          </div>
        </div>
      )}

      {/* ===== DRAFT PREVIEW for privileged users during ASIGNACION ===== */}
      {isPrivileged && estado === 'ASIGNACION' && (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-400" />
            <div>
              <h2 className="text-sm font-bold text-amber-200">Previsualización — Asignación en curso</h2>
              <p className="text-xs text-amber-300/70 mt-0.5">
                La secretaria está asignando los horarios. Esta vista es solo para seguimiento interno.
                El horario no será visible para docentes ni público hasta que sea aprobado y publicado.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ===== NOT PUBLISHED — Non-privileged ===== */}
      {!isPrivileged && !isPublished && (
        <div className="rounded-xl border border-gray-700 bg-gray-900 p-12 text-center">
          <EyeOff className="h-12 w-12 text-gray-600 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-400">Horario no disponible</h2>
          <p className="text-sm text-gray-600 mt-2 max-w-md mx-auto">
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
              <h1 className="text-2xl font-bold text-white">Visualización de Horarios</h1>
              <div className="flex items-center gap-2 mt-1">
                <p className="text-sm text-gray-500">{periodoActivo?.nombre ?? 'Sin periodo activo'}</p>
                <span className="text-gray-700">·</span>
                <div className="flex items-center gap-1.5">
                  <div className={`h-2 w-2 rounded-full ${ESTADO_COLORS[estado] ?? 'bg-gray-500'}`} />
                  <span className="text-xs font-bold text-gray-400">{ESTADO_LABELS[estado] ?? estado}</span>
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              {/* SEND TO REVISION button for secretary */}
              {isSecretaria && estado === 'ASIGNACION' && (
                <button
                  onClick={() => {
                    if (!periodoActivo?.id) return;
                    if (!confirm('¿Enviar la asignación actual al director para revisión?')) return;
                    sendToRevisionMutation.mutate({ periodoId: periodoActivo.id });
                  }}
                  disabled={sendToRevisionMutation.isPending}
                  className="flex items-center gap-2 rounded-lg border border-purple-500/40 bg-purple-500/10 px-4 py-2 text-xs font-bold text-purple-300 hover:bg-purple-500/20 transition-colors disabled:opacity-50"
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
                className="flex items-center gap-2 rounded-lg bg-gray-800 px-4 py-2 text-xs font-bold text-white hover:bg-gray-700 disabled:opacity-50"
              >
                <FileDown className="h-4 w-4" /> {generatePDFMutation.isPending ? 'Generando...' : 'Descargar PDF'}
              </button>
            </div>
          </div>

          {/* Stats for Privileged */}
          {isPrivileged && stats && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl bg-gray-900 border border-gray-800">
                <p className="text-[10px] text-gray-500 uppercase font-bold mb-1">Progreso de Asignación</p>
                <div className="flex items-end justify-between">
                  <span className="text-xl font-bold text-white">{stats.totalGrupos > 0 ? Math.round((stats.gruposAsignados / stats.totalGrupos) * 100) : 0}%</span>
                  <span className="text-xs text-gray-500">{stats.gruposAsignados} / {stats.totalGrupos} grupos</span>
                </div>
              </div>
              <div className="p-4 rounded-xl bg-gray-900 border border-gray-800">
                <p className="text-[10px] text-gray-500 uppercase font-bold mb-1">Docentes con carga</p>
                <p className="text-xl font-bold text-white">{stats.docentesConCarga}</p>
              </div>
              <div className="p-4 rounded-xl bg-gray-900 border border-gray-800">
                <p className="text-[10px] text-gray-500 uppercase font-bold mb-1">Estado</p>
                <div className="flex items-center gap-2">
                  <div className={`h-2 w-2 rounded-full ${ESTADO_COLORS[estado] ?? 'bg-gray-500'}`} />
                  <span className="text-sm font-bold text-gray-200">{ESTADO_LABELS[estado] ?? estado}</span>
                </div>
              </div>
            </div>
          )}

          {/* View Mode Tabs */}
          <div className="flex gap-1 rounded-lg bg-gray-800 p-1">
            {isDocente && (
              <button onClick={() => setViewMode('mi-horario')}
                className={`flex-1 flex items-center justify-center gap-1 rounded-md px-4 py-2 text-sm font-medium transition-all ${viewMode === 'mi-horario' ? 'bg-indigo-600 text-white shadow-lg' : 'text-gray-400 hover:text-gray-200'}`}>
                <Calendar className="h-3.5 w-3.5" /> Mi Horario
              </button>
            )}
            <button onClick={() => setViewMode('general')}
              className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-all ${viewMode === 'general' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-gray-200'}`}>
              Todo
            </button>
            <button onClick={() => setViewMode('ciclo')}
              className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-all ${viewMode === 'ciclo' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-gray-200'}`}>
              Por Ciclo
            </button>
            <button onClick={() => setViewMode('aula')}
              className={`flex-1 flex items-center justify-center gap-1 rounded-md px-4 py-2 text-sm font-medium transition-all ${viewMode === 'aula' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-gray-200'}`}>
              <Building2 className="h-3.5 w-3.5" /> Por Aula
            </button>
            {(isDirector || isSecretaria || isAdmin) && (
              <button onClick={() => setViewMode('docente')}
                className={`flex-1 flex items-center justify-center gap-1 rounded-md px-4 py-2 text-sm font-medium transition-all ${viewMode === 'docente' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-gray-200'}`}>
                <User className="h-3.5 w-3.5" /> Por Docente
              </button>
            )}
          </div>

          {/* Selectors */}
          <div className="flex flex-wrap gap-2">
            {viewMode === 'ciclo' && [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(c => (
              <button key={c} onClick={() => setSelectedCiclo(c)}
                className={`rounded-lg border px-4 py-1.5 text-xs font-bold transition-all ${selectedCiclo === c ? 'border-indigo-500 bg-indigo-600/20 text-indigo-300' : 'border-gray-800 bg-gray-900/50 text-gray-400 hover:border-gray-700'}`}>
                CICLO {c}
              </button>
            ))}
            {viewMode === 'aula' && aulas.map(a => (
              <button key={a.id} onClick={() => setSelectedAulaId(a.id)}
                className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-all ${selectedAulaId === a.id ? 'border-indigo-500 bg-indigo-600/20 text-indigo-300' : 'border-gray-800 bg-gray-900/50 text-gray-400 hover:border-gray-700'}`}>
                {a.codigo} {a.tipo === 'LABORATORIO' && <FlaskConical className="inline h-3 w-3 ml-1" />}
              </button>
            ))}
            {viewMode === 'docente' && docentes.map(d => (
              <button key={d.id} onClick={() => setSelectedDocenteId(d.id)}
                className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-all ${selectedDocenteId === d.id ? 'border-indigo-500 bg-indigo-600/20 text-indigo-300' : 'border-gray-800 bg-gray-900/50 text-gray-400 hover:border-gray-700'}`}>
                {d.nombre.split(' ').slice(0, 2).join(' ')}
              </button>
            ))}
          </div>

          {/* Grid */}
          <div className="rounded-2xl border border-gray-800 bg-gray-900 overflow-hidden shadow-xl overflow-x-auto">
            <table className="w-full text-[11px]">
              <thead>
                <tr className="bg-gray-800/50">
                  <th className="px-4 py-3 text-left font-bold text-gray-400 uppercase tracking-widest w-20 sticky left-0 bg-gray-800">Hora</th>
                  {DIAS.map(dia => (
                    <th key={dia} className="px-2 py-3 text-center font-bold text-gray-400 uppercase tracking-widest min-w-[140px]">
                      {DIA_LABELS[dia]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {horas.length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-20 text-center text-gray-600 font-medium">
                    {isPrivileged ? 'No hay asignaciones para mostrar' : 'No hay asignaciones confirmadas para mostrar'}
                  </td></tr>
                ) : (
                  horas.map(hora => (
                    <tr key={hora} className="border-t border-gray-800/50">
                      <td className="px-4 py-3 font-mono text-gray-500 bg-gray-950/30 sticky left-0">{hora}</td>
                      {DIAS.map(dia => {
                        const a = asignaciones.find(a => a.franjaHoraria.dia === dia && a.franjaHoraria.horaInicio === hora);
                        if (!a) return <td key={dia} className="px-1 py-1" />;

                        const colorClass = cursoColorMap.get(a.grupo.curso.id) || '';
                        return (
                          <td key={dia} className="px-1 py-1">
                            <div className={`p-2 rounded-lg border flex flex-col justify-center min-h-[50px] ${colorClass}`}>
                              <div className="flex items-center justify-between mb-1">
                                <p className="font-black text-[10px] leading-tight">{a.grupo.curso.codigo}</p>
                                {isPrivileged && !a.confirmado && <span className="text-[7px] bg-white/20 px-1 rounded font-bold">BORRADOR</span>}
                              </div>
                              <p className="text-[9px] font-medium opacity-80 truncate">{a.grupo.curso.nombre}</p>
                              <div className="mt-1 pt-1 border-t border-white/10 flex flex-wrap gap-x-2 text-[8px] font-bold opacity-70">
                                <span>G{a.grupo.nombre}</span>
                                <span>{a.aula?.codigo}</span>
                                {viewMode !== 'docente' && viewMode !== 'mi-horario' && <span>{a.docente?.nombre.split(' ')[0]}</span>}
                              </div>
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
