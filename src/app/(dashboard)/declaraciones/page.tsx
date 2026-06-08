'use client';

import { useTRPC } from '@/trpc/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import {
  FileCheck, ChevronDown, ChevronUp, Send, CheckCircle2,
  XCircle, RotateCcw, Award, Plus, FileText, Loader2, Download,
  Trash2, RefreshCw,
} from 'lucide-react';
import Link from 'next/link';

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

const ESTADO_BADGES: Record<string, string> = {
  BORRADOR: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  ENVIADA: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  APROBADA_DEPARTAMENTO: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  APROBADA_ESCUELA: 'bg-green-500/20 text-green-400 border-green-500/30',
  RECHAZADA: 'bg-red-500/20 text-red-400 border-red-500/30',
  FINALIZADA: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
};

const ESTADO_LABELS: Record<string, string> = {
  BORRADOR: 'Borrador',
  ENVIADA: 'Enviada',
  APROBADA_DEPARTAMENTO: 'Aprob. Departamento',
  APROBADA_ESCUELA: 'Aprob. Escuela',
  RECHAZADA: 'Rechazada',
  FINALIZADA: 'Finalizada',
};

const TIPO_NO_LECTIVA_LABELS: Record<string, string> = {
  PREPARACION_EVALUACION: 'Preparación y Evaluación',
  CONSEJERIA: 'Consejería',
  INVESTIGACION: 'Investigación',
  CAPACITACION: 'Capacitación',
  GOBIERNO: 'Gobierno',
  ADMINISTRACION: 'Administración',
  ASESORIA_TESIS: 'Asesoría de Tesis',
  RESPONSABILIDAD_SOCIAL: 'Responsabilidad Social',
  COMITES_COMISIONES: 'Comités y Comisiones',
};

const STEPS = [
  { label: 'Borrador', key: 'BORRADOR' },
  { label: 'Enviada', key: 'ENVIADA' },
  { label: 'Aprob. Depto', key: 'APROBADA_DEPARTAMENTO' },
  { label: 'Aprob. Escuela', key: 'APROBADA_ESCUELA' },
  { label: 'Finalizada', key: 'FINALIZADA' },
];

export default function DeclaracionesPage() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const { data: user } = useQuery({ ...trpc.auth.me.queryOptions() });
  const { data: periodos = [] } = useQuery({ ...trpc.periodo.list.queryOptions() });

  const [selectedPeriodoId, setSelectedPeriodoId] = useState<string>('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [rejectModalId, setRejectModalId] = useState<string | null>(null);
  const [rejectObservaciones, setRejectObservaciones] = useState('');
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const periodoId = selectedPeriodoId || (periodos.length > 0 ? periodos[0].id : '');

  const isDocente = user?.role === 'DOCENTE';
  const isDirectorDepto = user?.role === 'DIRECTOR_DEPARTAMENTO';
  const isDirectorEscuela = user?.role === 'DIRECTOR_ESCUELA';
  const isDecano = user?.role === 'DECANO';
  const isAdmin = user?.role === 'ADMIN';

  const { data: declaraciones = [], isLoading } = useQuery({
    ...trpc.declaracion.list.queryOptions({ periodoId }),
    enabled: !!periodoId,
  });

  function invalidateAll() {
    queryClient.invalidateQueries({ queryKey: trpc.declaracion.list.queryKey() });
    queryClient.invalidateQueries({ queryKey: trpc.declaracion.pendientes.queryKey() });
  }

  const generatePDFMutation = useMutation(
    trpc.declaracionPDF.generate.mutationOptions({
      onSuccess: (data) => {
        downloadBase64PDF(data.pdfBase64, data.filename);
        setDownloadingId(null);
      },
      onError: () => {
        setDownloadingId(null);
        alert('Error al generar el PDF. Verifique que la declaración tenga carga asignada.');
      },
    })
  );

  const handleDownload = (declaracionId: string) => {
    setDownloadingId(declaracionId);
    generatePDFMutation.mutate({ declaracionId, formato: 'N1' });
  };

  const createMutation = useMutation(
    trpc.declaracion.create.mutationOptions({
      onSuccess: () => invalidateAll(),
    })
  );

  const enviarMutation = useMutation(
    trpc.declaracion.enviar.mutationOptions({
      onSuccess: () => invalidateAll(),
    })
  );

  const aprobarDeptoMutation = useMutation(
    trpc.declaracion.aprobarDepto.mutationOptions({
      onSuccess: () => invalidateAll(),
    })
  );

  const aprobarEscuelaMutation = useMutation(
    trpc.declaracion.aprobarEscuela.mutationOptions({
      onSuccess: () => invalidateAll(),
    })
  );

  const vbDecanoMutation = useMutation(
    trpc.declaracion.vbDecano.mutationOptions({
      onSuccess: () => invalidateAll(),
    })
  );

  const rechazarMutation = useMutation(
    trpc.declaracion.rechazar.mutationOptions({
      onSuccess: () => {
        invalidateAll();
        setRejectModalId(null);
        setRejectObservaciones('');
      },
    })
  );

  const reabrirMutation = useMutation(
    trpc.declaracion.reabrir.mutationOptions({
      onSuccess: () => invalidateAll(),
    })
  );

  const deleteMutation = useMutation(
    trpc.declaracion.delete.mutationOptions({
      onSuccess: () => {
        invalidateAll();
        setExpandedId(null);
      },
      onError: (err) => alert(err.message),
    })
  );

  const updateTotalsMutation = useMutation(
    trpc.declaracion.updateTotals.mutationOptions({
      onSuccess: () => invalidateAll(),
      onError: (err) => alert(err.message),
    })
  );

  const anyMutationPending =
    createMutation.isPending || enviarMutation.isPending || aprobarDeptoMutation.isPending ||
    aprobarEscuelaMutation.isPending || vbDecanoMutation.isPending || rechazarMutation.isPending ||
    reabrirMutation.isPending || deleteMutation.isPending || updateTotalsMutation.isPending;

  function handleCreate() {
    if (!user?.docenteId || !periodoId) return;
    createMutation.mutate({ docenteId: user.docenteId, periodoId });
  }

  function handleRejectSubmit() {
    if (!rejectModalId || !rejectObservaciones.trim()) return;
    rechazarMutation.mutate({ id: rejectModalId, observaciones: rejectObservaciones.trim() });
  }

  function canPerformAction(decDocenteId: string, estado: string, action: string): boolean {
    if (isAdmin) return true;
    switch (action) {
      case 'enviar':
        // El docente puede enviar su propia declaración
        // El director de departamento también puede enviar si el docente no lo hace (opcional, pero ayuda al flujo)
        return (isDocente && user?.docenteId === decDocenteId && (estado === 'BORRADOR' || estado === 'RECHAZADA')) ||
               (isDirectorDepto && (estado === 'BORRADOR' || estado === 'RECHAZADA'));
      case 'aprobarDepto':
        return isDirectorDepto && estado === 'ENVIADA';
      case 'aprobarEscuela':
        return isDirectorEscuela && estado === 'APROBADA_DEPARTAMENTO';
      case 'vbDecano':
        return isDecano && estado === 'APROBADA_ESCUELA';
      case 'rechazar':
        return (isDirectorDepto || isDirectorEscuela || isDecano) &&
          ['ENVIADA', 'APROBADA_DEPARTAMENTO', 'APROBADA_ESCUELA'].includes(estado);
      case 'reabrir':
        return isDocente && user?.docenteId === decDocenteId && estado === 'RECHAZADA';
      case 'eliminar':
        return (isDocente && user?.docenteId === decDocenteId && (estado === 'BORRADOR' || estado === 'RECHAZADA')) || isAdmin;
      case 'actualizar':
        return (isDocente && user?.docenteId === decDocenteId && (estado === 'BORRADOR' || estado === 'RECHAZADA')) || isAdmin;
      default:
        return false;
    }
  }

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Declaraciones de Carga</h1>
          <p className="text-zinc-400 text-sm mt-1">Flujo de aprobación de carga académica</p>
        </div>
        {(isDocente || isAdmin) && (
          <button
            onClick={handleCreate}
            disabled={anyMutationPending || !periodoId}
            className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-500 shadow-lg shadow-indigo-500/25 disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            Crear Declaración
          </button>
        )}
      </div>

      {/* Period Selector */}
      <div className="flex items-center gap-3">
        <label className="text-sm text-zinc-400">Periodo:</label>
        <select
          value={periodoId}
          onChange={(e) => setSelectedPeriodoId(e.target.value)}
          className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        >
          {periodos.map((p) => (
            <option key={p.id} value={p.id}>{p.nombre}</option>
          ))}
        </select>
        <span className="text-xs text-zinc-500">{declaraciones.length} declaraciones</span>
      </div>

      {/* Create mutation error */}
      {createMutation.isError && (
        <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg p-3">
          {createMutation.error?.message || 'Error al crear la declaración'}
        </div>
      )}

      {/* Declarations List */}
      {isLoading ? (
        <div className="text-center text-zinc-400 py-12">
          <Loader2 className="w-6 h-6 mx-auto mb-2 animate-spin" />
          Cargando declaraciones...
        </div>
      ) : (
        <div className="space-y-4">
          {declaraciones.map((dec) => (
            <DeclaracionCard
              key={dec.id}
              dec={dec}
              expanded={expandedId === dec.id}
              onToggleExpand={() => setExpandedId(expandedId === dec.id ? null : dec.id)}
              canPerformAction={canPerformAction}
              onEnviar={() => enviarMutation.mutate({ id: dec.id })}
              onAprobarDepto={() => aprobarDeptoMutation.mutate({ id: dec.id })}
              onAprobarEscuela={() => aprobarEscuelaMutation.mutate({ id: dec.id })}
              onVbDecano={() => vbDecanoMutation.mutate({ id: dec.id })}
              onRechazar={() => { setRejectModalId(dec.id); setRejectObservaciones(''); }}
              onReabrir={() => reabrirMutation.mutate({ id: dec.id })}
              onDelete={() => { if(confirm('¿Estás seguro de eliminar esta declaración?')) deleteMutation.mutate({ id: dec.id }); }}
              onUpdateTotals={() => updateTotalsMutation.mutate({ id: dec.id })}
              onDownload={() => handleDownload(dec.id)}
              isDownloading={downloadingId === dec.id}
              mutationPending={anyMutationPending}
              periodoId={periodoId}
            />
          ))}
          {declaraciones.length === 0 && (
            <div className="bg-zinc-900/80 border border-zinc-800 rounded-lg p-12 text-center text-zinc-500">
              <FileCheck className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>No hay declaraciones de carga para este periodo</p>
            </div>
          )}
        </div>
      )}

      {/* Reject Modal */}
      {rejectModalId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-zinc-700 bg-zinc-900 p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white">Rechazar Declaración</h2>
              <button
                onClick={() => { setRejectModalId(null); setRejectObservaciones(''); }}
                className="rounded-lg p-1 text-zinc-500 hover:bg-zinc-800"
              >
                <XCircle className="h-5 w-5" />
              </button>
            </div>
            <p className="text-sm text-zinc-400 mb-3">
              Indique el motivo del rechazo. Esta observación será visible para el docente.
            </p>
            <textarea
              value={rejectObservaciones}
              onChange={(e) => setRejectObservaciones(e.target.value)}
              rows={4}
              placeholder="Motivo del rechazo..."
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-200 placeholder-zinc-500 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500 resize-none"
            />
            {rechazarMutation.isError && (
              <p className="text-xs text-red-400 mt-2">{rechazarMutation.error?.message || 'Error al rechazar'}</p>
            )}
            <div className="flex justify-end gap-3 mt-4">
              <button
                type="button"
                onClick={() => { setRejectModalId(null); setRejectObservaciones(''); }}
                className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-400 hover:bg-zinc-800"
              >
                Cancelar
              </button>
              <button
                onClick={handleRejectSubmit}
                disabled={!rejectObservaciones.trim() || rechazarMutation.isPending}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500 disabled:opacity-50"
              >
                {rechazarMutation.isPending ? 'Rechazando...' : 'Confirmar Rechazo'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Declaration Card ─── */

type DeclaracionData = {
  id: string;
  docenteId: string;
  periodoId: string;
  estado: string;
  totalHorasLectivas: number;
  totalHorasNoLectivas: number;
  totalHoras: number;
  observaciones: string | null;
  docente: { id: string; nombre: string; horasContrato: number };
  periodo: { id: string; nombre: string };
};

function DeclaracionCard({
  dec,
  expanded,
  onToggleExpand,
  canPerformAction,
  onEnviar,
  onAprobarDepto,
  onAprobarEscuela,
  onVbDecano,
  onRechazar,
  onReabrir,
  onDelete,
  onUpdateTotals,
  onDownload,
  isDownloading,
  mutationPending,
  periodoId,
}: {
  dec: DeclaracionData;
  expanded: boolean;
  onToggleExpand: () => void;
  canPerformAction: (decDocenteId: string, estado: string, action: string) => boolean;
  onEnviar: () => void;
  onAprobarDepto: () => void;
  onAprobarEscuela: () => void;
  onVbDecano: () => void;
  onRechazar: () => void;
  onReabrir: () => void;
  onDelete: () => void;
  onUpdateTotals: () => void;
  onDownload: () => void;
  isDownloading: boolean;
  mutationPending: boolean;
  periodoId: string;
}) {
  const currentIdx = STEPS.findIndex((s) => s.key === dec.estado);

  const showEnviar = canPerformAction(dec.docenteId, dec.estado, 'enviar');
  const showAprobarDepto = canPerformAction(dec.docenteId, dec.estado, 'aprobarDepto');
  const showAprobarEscuela = canPerformAction(dec.docenteId, dec.estado, 'aprobarEscuela');
  const showVbDecano = canPerformAction(dec.docenteId, dec.estado, 'vbDecano');
  const showRechazar = canPerformAction(dec.docenteId, dec.estado, 'rechazar');
  const showReabrir = canPerformAction(dec.docenteId, dec.estado, 'reabrir');
  const showEliminar = canPerformAction(dec.docenteId, dec.estado, 'eliminar');
  const showActualizar = canPerformAction(dec.docenteId, dec.estado, 'actualizar');
  const showFormatos = dec.estado === 'FINALIZADA' || dec.estado === 'APROBADA_ESCUELA';

  const hasActions = showEnviar || showAprobarDepto || showAprobarEscuela ||
    showVbDecano || showRechazar || showReabrir || showEliminar || showActualizar || showFormatos;

  return (
    <div className="bg-zinc-900/80 border border-zinc-800 rounded-lg p-4">
      {/* Header row */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <span className="text-white font-medium">{dec.docente.nombre}</span>
          <span className="text-zinc-500 text-sm">{dec.periodo.nombre}</span>
        </div>
        <div className="flex items-center gap-2">
          {showEliminar && (
            <button
              onClick={onDelete}
              disabled={mutationPending}
              title="Eliminar declaración"
              className="p-1.5 rounded-md text-zinc-500 hover:bg-red-500/10 hover:text-red-400 transition-colors disabled:opacity-50"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
          <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${ESTADO_BADGES[dec.estado] || ''}`}>
            {ESTADO_LABELS[dec.estado] || dec.estado.replace(/_/g, ' ')}
          </span>
          <button
            onClick={onToggleExpand}
            className="rounded-md p-1 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300"
          >
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Progress stepper */}
      <div className="flex items-center gap-1 mb-3">
        {STEPS.map((step, i) => {
          const isDone = i <= currentIdx && dec.estado !== 'RECHAZADA';
          return (
            <div key={step.key} className="flex items-center flex-1">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] ${
                dec.estado === 'RECHAZADA' ? 'bg-red-500/20 text-red-400' :
                isDone ? 'bg-green-500/20 text-green-400' :
                'bg-zinc-700 text-zinc-500'
              }`}>
                {isDone ? '✓' : i + 1}
              </div>
              <span className="text-[10px] text-zinc-500 ml-1 hidden sm:inline">{step.label}</span>
              {i < STEPS.length - 1 && (
                <div className={`flex-1 h-0.5 mx-1 ${isDone ? 'bg-green-500/30' : 'bg-zinc-700'}`} />
              )}
            </div>
          );
        })}
      </div>

      {/* Hours summary */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-zinc-400">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-blue-500"></span>
          Lectivas: <span className="text-zinc-200">{dec.totalHorasLectivas}h</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-yellow-500"></span>
          No Lectivas: <span className="text-zinc-200">{dec.totalHorasNoLectivas}h</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
          Total: <span className="text-white font-bold">{dec.totalHoras}h</span>
          <span className="text-zinc-500">/ {dec.docente.horasContrato}h contrato</span>
        </div>
        {dec.totalHoras < dec.docente.horasContrato && (dec.estado === 'BORRADOR' || dec.estado === 'RECHAZADA') && (
          <div className="flex items-center gap-1 text-xs text-amber-400 font-medium bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
            <Loader2 className="h-3 w-3 animate-pulse" />
            Faltan {dec.docente.horasContrato - dec.totalHoras}h para completar contrato
          </div>
        )}
      </div>

      {/* Observaciones (if rejected) */}
      {dec.observaciones && (
        <div className="mt-2 text-sm text-red-400 bg-red-500/5 border border-red-500/20 rounded p-2">
          📝 {dec.observaciones}
        </div>
      )}

      {/* Action buttons */}
      {hasActions && (
        <div className="mt-3 pt-3 border-t border-zinc-800 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            {showEnviar && (
              <button
                onClick={onEnviar}
                disabled={mutationPending}
                className="flex items-center gap-1.5 rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-500 disabled:opacity-50 transition-all active:scale-95"
              >
                <Send className="h-3.5 w-3.5" />
                Enviar Declaración
              </button>
            )}
            {showActualizar && (
              <button
                onClick={onUpdateTotals}
                disabled={mutationPending}
                title="Actualizar horas desde las actividades registradas"
                className="flex items-center gap-1.5 rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:bg-zinc-700 hover:text-white disabled:opacity-50 transition-all active:scale-95"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${mutationPending ? 'animate-spin' : ''}`} />
                Actualizar Horas
              </button>
            )}
            {showAprobarDepto && (
              <button
                onClick={onAprobarDepto}
                disabled={mutationPending}
                className="flex items-center gap-1.5 rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-500 disabled:opacity-50 transition-all active:scale-95"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                Aprobar (Depto)
              </button>
            )}
            {showAprobarEscuela && (
              <button
                onClick={onAprobarEscuela}
                disabled={mutationPending}
                className="flex items-center gap-1.5 rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-500 disabled:opacity-50 transition-all active:scale-95"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                Aprobar (Escuela)
              </button>
            )}
            {showVbDecano && (
              <button
                onClick={onVbDecano}
                disabled={mutationPending}
                className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-50 transition-all active:scale-95"
              >
                <Award className="h-3.5 w-3.5" />
                V°B° Finalizar
              </button>
            )}
            {showRechazar && (
              <button
                onClick={onRechazar}
                disabled={mutationPending}
                className="flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-500 disabled:opacity-50 transition-all active:scale-95"
              >
                <XCircle className="h-3.5 w-3.5" />
                Rechazar
              </button>
            )}
            {showReabrir && (
              <button
                onClick={onReabrir}
                disabled={mutationPending}
                className="flex items-center gap-1.5 rounded-lg bg-yellow-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-yellow-500 disabled:opacity-50 transition-all active:scale-95"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Reabrir
              </button>
            )}
            {showFormatos && (
              <button
                onClick={onDownload}
                disabled={isDownloading || mutationPending}
                className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-500 disabled:opacity-50 transition-all active:scale-95"
              >
                {isDownloading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Download className="h-3.5 w-3.5" />
                )}
                Descargar PDF
              </button>
            )}
          </div>
        </div>
      )}

      {/* Expandable detail section */}
      {expanded && (
        <ExpandedDetails docenteId={dec.docenteId} periodoId={periodoId} />
      )}
    </div>
  );
}

/* ─── Expanded Detail Section (lazy loads on expand) ─── */

function ExpandedDetails({ docenteId, periodoId }: { docenteId: string; periodoId: string }) {
  const trpc = useTRPC();

  const { data: lectiva, isLoading: loadingLectiva } = useQuery({
    ...trpc.cargaLectiva.byDocente.queryOptions({ docenteId, periodoId }),
  });

  const { data: noLectiva, isLoading: loadingNoLectiva } = useQuery({
    ...trpc.cargaNoLectiva.byDocente.queryOptions({ docenteId, periodoId }),
  });

  return (
    <div className="mt-3 pt-3 border-t border-zinc-800 space-y-4">
      {/* Teaching Load Table */}
      <div>
        <h4 className="text-sm font-medium text-zinc-300 mb-2">Carga Lectiva</h4>
        {loadingLectiva ? (
          <div className="flex items-center gap-2 text-xs text-zinc-500 py-2">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Cargando...
          </div>
        ) : lectiva && lectiva.asignaciones.length > 0 ? (
          <div className="rounded-lg border border-zinc-800 overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-zinc-800 bg-zinc-800/50">
                  <th className="px-3 py-2 text-left font-medium text-zinc-400">Curso</th>
                  <th className="px-3 py-2 text-left font-medium text-zinc-400">Grupo</th>
                  <th className="px-3 py-2 text-center font-medium text-zinc-400">Tipo</th>
                  <th className="px-3 py-2 text-center font-medium text-zinc-400">Horas</th>
                  <th className="px-3 py-2 text-left font-medium text-zinc-400">Compartido</th>
                </tr>
              </thead>
              <tbody>
                {lectiva.asignaciones.map((a) => (
                  <tr key={a.id} className="border-b border-zinc-800/50">
                    <td className="px-3 py-2 text-zinc-300">
                      <span className="text-indigo-400 font-mono mr-1">{a.grupo.curso.codigo}</span>
                      {a.grupo.curso.nombre}
                    </td>
                    <td className="px-3 py-2 text-zinc-400">{a.grupo.nombre}</td>
                    <td className="px-3 py-2 text-center">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                        a.tipo === 'TEORIA' ? 'bg-blue-500/20 text-blue-400' :
                        a.tipo === 'PRACTICA' ? 'bg-orange-500/20 text-orange-400' :
                        'bg-purple-500/20 text-purple-400'
                      }`}>
                        {a.tipo}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-center text-zinc-300">{a.horasAsignadas}h</td>
                    <td className="px-3 py-2 text-zinc-400">
                      {a.docenteCompartido ? a.docenteCompartido.nombre : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-zinc-800/30">
                  <td colSpan={3} className="px-3 py-2 text-right text-zinc-400 font-medium">Total Lectivas:</td>
                  <td className="px-3 py-2 text-center text-white font-medium">{lectiva.totalLectivas}h</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        ) : (
          <p className="text-xs text-zinc-500 py-2">Sin carga lectiva asignada</p>
        )}
      </div>

      {/* Non-Teaching Load Table */}
      <div>
        <h4 className="text-sm font-medium text-zinc-300 mb-2">Carga No Lectiva</h4>
        {loadingNoLectiva ? (
          <div className="flex items-center gap-2 text-xs text-zinc-500 py-2">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Cargando...
          </div>
        ) : noLectiva && noLectiva.cargas.length > 0 ? (
          <div className="rounded-lg border border-zinc-800 overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-zinc-800 bg-zinc-800/50">
                  <th className="px-3 py-2 text-left font-medium text-zinc-400">Tipo</th>
                  <th className="px-3 py-2 text-left font-medium text-zinc-400">Descripción</th>
                  <th className="px-3 py-2 text-center font-medium text-zinc-400">Horas</th>
                </tr>
              </thead>
              <tbody>
                {noLectiva.cargas.map((c) => (
                  <tr key={c.id} className="border-b border-zinc-800/50">
                    <td className="px-3 py-2 text-zinc-300">
                      {TIPO_NO_LECTIVA_LABELS[c.tipo] || c.tipo}
                    </td>
                    <td className="px-3 py-2 text-zinc-400">{c.descripcion || '—'}</td>
                    <td className="px-3 py-2 text-center text-zinc-300">{c.horas}h</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-zinc-800/30">
                  <td colSpan={2} className="px-3 py-2 text-right text-zinc-400 font-medium">Total No Lectivas:</td>
                  <td className="px-3 py-2 text-center text-white font-medium">{noLectiva.totalNoLectivas}h</td>
                </tr>
              </tfoot>
            </table>
          </div>
        ) : (
          <p className="text-xs text-zinc-500 py-2">Sin carga no lectiva asignada</p>
        )}
      </div>

      {/* Combined totals */}
      {lectiva && noLectiva && (
        <div className="flex items-center gap-4 pt-2 text-sm">
          <span className="text-zinc-400">Lectivas: <span className="text-white font-medium">{lectiva.totalLectivas}h</span></span>
          <span className="text-zinc-400">No Lectivas: <span className="text-white font-medium">{noLectiva.totalNoLectivas}h</span></span>
          <span className="text-zinc-400">Total General: <span className="text-emerald-400 font-bold">{lectiva.totalLectivas + noLectiva.totalNoLectivas}h</span></span>
        </div>
      )}
    </div>
  );
}
