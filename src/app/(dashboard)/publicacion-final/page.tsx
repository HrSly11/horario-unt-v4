'use client';

import { useState } from 'react';
import { useTRPC } from '@/trpc/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ShieldCheck,
  Calendar,
  AlertCircle,
  Loader2,
  CheckCircle2,
  Lock,
  Users,
  FileCheck,
  BookOpen,
} from 'lucide-react';

export default function PublicacionFinalPage() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const [selectedPeriodoId, setSelectedPeriodoId] = useState('');
  const [selectedFacultadId, setSelectedFacultadId] = useState('');
  const [confirming, setConfirming] = useState(false);

  const { data: user } = useQuery({ ...trpc.auth.me.queryOptions() });
  const role = user?.role;
  const isDecano = role === 'DECANO' || role === 'ADMIN';

  const { data: periodos = [] } = useQuery({ ...trpc.periodo.list.queryOptions() });
  const { data: facultades = [] } = useQuery({ ...trpc.facultad.list.queryOptions() });

  const activePeriod = periodos.find((p) => p.activo);
  const periodoId = selectedPeriodoId || activePeriod?.id || (periodos[0]?.id ?? '');
  const facultadId = selectedFacultadId || (facultades[0]?.id ?? '');

  // Check existing publication
  const { data: declaraciones = [], isLoading } = useQuery({
    ...trpc.declaracion.list.queryOptions({ periodoId }),
    enabled: !!periodoId && isDecano,
  });

  const publishMutation = useMutation({
    ...trpc.declaracion.publishFinal.mutationOptions(),
    onSuccess: () => {
      setConfirming(false);
      queryClient.invalidateQueries();
    },
  });

  const totalDeclaraciones = declaraciones.length;
  const finalizadas = declaraciones.filter((d: any) => d.estado === 'FINALIZADA').length;
  const pendientes = totalDeclaraciones - finalizadas;
  const allReady = totalDeclaraciones > 0 && pendientes === 0;

  if (!isDecano && user) {
    return (
      <div className="p-6">
        <div className="alert alert-error">
          <AlertCircle className="w-6 h-6" />
          <span>Acceso restringido: solo el Decano puede realizar la Publicación Final.</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ShieldCheck className="w-8 h-8 text-primary" />
            Publicación Final de Facultad
          </h1>
          <p className="text-sm text-base-content/70">
            Una vez publicada, todos los horarios y declaraciones quedan congelados de forma permanente. Esta acción es irreversible.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-base-content/50" />
          <select
            className="select select-bordered w-56"
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
      </div>

      {/* Facultad selector */}
      {facultades.length > 1 && (
        <div className="form-control max-w-xs">
          <label className="label"><span className="label-text font-bold">Facultad</span></label>
          <select
            className="select select-bordered"
            value={facultadId}
            onChange={(e) => setSelectedFacultadId(e.target.value)}
          >
            {facultades.map((f) => (
              <option key={f.id} value={f.id}>{f.nombre}</option>
            ))}
          </select>
        </div>
      )}

      {/* Status cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card bg-base-100 border border-base-200 shadow-sm">
          <div className="card-body p-4 flex-row items-center gap-4">
            <div className="rounded-full bg-primary/10 p-3">
              <Users className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{totalDeclaraciones}</p>
              <p className="text-xs text-base-content/60">Declaraciones totales</p>
            </div>
          </div>
        </div>
        <div className="card bg-base-100 border border-base-200 shadow-sm">
          <div className="card-body p-4 flex-row items-center gap-4">
            <div className="rounded-full bg-success/10 p-3">
              <FileCheck className="w-6 h-6 text-success" />
            </div>
            <div>
              <p className="text-2xl font-bold text-success">{finalizadas}</p>
              <p className="text-xs text-base-content/60">Declaraciones finalizadas</p>
            </div>
          </div>
        </div>
        <div className={`card border shadow-sm ${pendientes > 0 ? 'bg-error/5 border-error/20' : 'bg-base-100 border-base-200'}`}>
          <div className="card-body p-4 flex-row items-center gap-4">
            <div className={`rounded-full p-3 ${pendientes > 0 ? 'bg-error/10' : 'bg-base-200'}`}>
              <AlertCircle className={`w-6 h-6 ${pendientes > 0 ? 'text-error' : 'text-base-content/30'}`} />
            </div>
            <div>
              <p className={`text-2xl font-bold ${pendientes > 0 ? 'text-error' : 'text-base-content/30'}`}>{pendientes}</p>
              <p className="text-xs text-base-content/60">Declaraciones pendientes</p>
            </div>
          </div>
        </div>
      </div>

      {/* Lista de declaraciones */}
      {!isLoading && declaraciones.length > 0 && (
        <div className="card bg-base-100 border border-base-200 shadow-sm">
          <div className="card-body p-4 space-y-3">
            <h2 className="font-bold text-lg flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-primary" />
              Estado de declaraciones por docente
            </h2>
            <div className="overflow-x-auto">
              <table className="table table-zebra w-full">
                <thead>
                  <tr className="bg-base-200/50">
                    <th>Docente</th>
                    <th>Departamento</th>
                    <th className="text-center">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {declaraciones.map((dec: any) => (
                    <tr key={dec.id}>
                      <td className="font-semibold">{dec.docente?.nombre ?? dec.docenteId}</td>
                      <td className="text-xs text-base-content/60">{dec.docente?.departamentoId ?? '—'}</td>
                      <td className="text-center">
                        <span className={`badge text-xs font-bold ${
                          dec.estado === 'FINALIZADA' ? 'badge-success' :
                          dec.estado === 'APROBADA_DEPARTAMENTO' || dec.estado === 'APROBADA_ESCUELA' ? 'badge-info' :
                          dec.estado === 'RECHAZADA' ? 'badge-error' : 'badge-warning'
                        }`}>
                          {dec.estado}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {isLoading && (
        <div className="flex justify-center py-8">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      )}

      {/* Gate check */}
      {!isLoading && totalDeclaraciones > 0 && !allReady && (
        <div className="alert alert-warning">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <div>
            <p className="font-bold">No se puede publicar aún</p>
            <p className="text-sm">
              Hay {pendientes} declaración(es) que no están en estado FINALIZADA o les faltan firmas digitales. Todas deben completarse antes de la publicación final.
            </p>
          </div>
        </div>
      )}

      {!isLoading && allReady && (
        <div className="alert alert-success">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <p className="font-bold">Todas las declaraciones están listas. Podés proceder con la publicación final.</p>
        </div>
      )}

      {/* Publish button */}
      <div className="flex justify-end">
        <button
          className="btn btn-error gap-2 text-white"
          disabled={!allReady || publishMutation.isPending || !facultadId}
          onClick={() => setConfirming(true)}
        >
          <Lock className="w-4 h-4" />
          Publicar y Congelar Período
        </button>
      </div>

      {/* Confirm modal */}
      {confirming && (
        <div className="modal modal-open">
          <div className="modal-box border border-error/30">
            <h3 className="font-bold text-lg text-error flex items-center gap-2">
              <Lock className="w-5 h-5" /> Confirmar Publicación Final
            </h3>
            <div className="py-4 space-y-3">
              <p className="text-sm">Esta acción es <strong>irreversible</strong>. Al confirmar:</p>
              <ul className="list-disc list-inside text-sm space-y-1 text-base-content/70">
                <li>Se creará un snapshot inmutable de todos los horarios y declaraciones.</li>
                <li>Se registrarán los hashes SHA-256 de las 9 firmas digitales.</li>
                <li>Ningún docente, secretaría ni director podrá modificar datos del período.</li>
                <li>Los horarios pasarán a ser de solo lectura desde el snapshot.</li>
              </ul>
            </div>
            <div className="modal-action">
              <button className="btn btn-ghost" onClick={() => setConfirming(false)}>Cancelar</button>
              <button
                className="btn btn-error text-white gap-2"
                onClick={() => publishMutation.mutate({ facultadId, periodoId })}
                disabled={publishMutation.isPending}
              >
                {publishMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
                Sí, publicar definitivamente
              </button>
            </div>
          </div>
          <div className="modal-backdrop" onClick={() => setConfirming(false)} />
        </div>
      )}
    </div>
  );
}
