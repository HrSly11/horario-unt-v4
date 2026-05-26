'use client';

import { useTRPC } from '@/trpc/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Plus, X } from 'lucide-react';

export default function PeriodosPage() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ nombre: '', fechaInicio: '', fechaFin: '', activo: false });

  const { data: periodos = [], isLoading } = useQuery({ ...trpc.periodo.list.queryOptions() });

  const createMutation = useMutation(
    trpc.periodo.create.mutationOptions({
      onSuccess: () => { queryClient.invalidateQueries({ queryKey: trpc.periodo.list.queryKey() }); setShowModal(false); setForm({ nombre: '', fechaInicio: '', fechaFin: '', activo: false }); },
    })
  );

  const toggleMutation = useMutation(
    trpc.periodo.toggleActive.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: trpc.periodo.list.queryKey() });
        queryClient.invalidateQueries({ queryKey: trpc.periodo.active.queryKey() });
      },
    })
  );

  const deleteMutation = useMutation(
    trpc.periodo.delete.mutationOptions({
      onSuccess: () => { queryClient.invalidateQueries({ queryKey: trpc.periodo.list.queryKey() }); },
    })
  );

  const startProcessMutation = useMutation(
    trpc.periodo.startAssignmentProcess.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: trpc.periodo.list.queryKey() });
        alert('Proceso iniciado. Se ha notificado a los docentes.');
      },
      onError: (err: any) => alert(err.message),
    })
  );

  const { data: user } = useQuery({ ...trpc.auth.me.queryOptions() });
  const isDirector = user?.role === 'DIRECTOR_ESCUELA' || user?.role === 'ADMIN';
  const canEdit = user?.role === 'ADMIN' || user?.role === 'SECRETARIA_ACADEMICA' || user?.role === 'DIRECTOR_ESCUELA';
  const isGuest = user?.role === 'INVITADO';
  const isDocente = user?.role === 'DOCENTE';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Periodos Académicos</h1>
          <p className="text-sm text-gray-500 mt-1">Configuración de semestres y estados del proceso</p>
        </div>
        {canEdit && !isGuest && !isDocente && (
          <button
            onClick={() => {
              setForm({ nombre: '', fechaInicio: '', fechaFin: '', activo: false });
              setShowModal(true);
            }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-500 shadow-lg shadow-indigo-600/25 transition-all"
          >
            <Plus className="h-4 w-4" /> Nuevo Periodo
          </button>
        )}
      </div>

      <div className="grid gap-4">
        {isLoading ? (
          <div className="text-center text-gray-600 py-12">Cargando...</div>
        ) : (
          periodos.map((p) => (
            <div key={p.id} className={`rounded-xl border p-5 ${p.activo ? 'border-indigo-500/40 bg-indigo-500/5' : 'border-gray-800 bg-gray-900'}`}>
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-3">
                    <h3 className="text-lg font-semibold text-white">{p.nombre}</h3>
                    {p.activo && (
                      <span className="rounded-full bg-indigo-500/20 px-2.5 py-0.5 text-xs font-medium text-indigo-400 border border-indigo-500/30">
                        Activo
                      </span>
                    )}
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium border ${
                      p.estado === 'PLANIFICACION' ? 'bg-gray-500/10 text-gray-400 border-gray-500/20' :
                      p.estado === 'POSTULACION' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                      p.estado === 'ASIGNACION' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                      p.estado === 'REVISION' ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' :
                      p.estado === 'APROBADO' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                      'bg-red-500/10 text-red-400 border-red-500/20'
                    }`}>
                      {p.estado}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500 mt-1">
                    {new Date(p.fechaInicio).toLocaleDateString('es-PE')} — {new Date(p.fechaFin).toLocaleDateString('es-PE')}
                  </p>
                  <p className="text-xs text-gray-600 mt-1">
                    {p._count.grupos} grupos · {p._count.asignaciones} asignaciones
                  </p>
                </div>
                <div className="flex gap-2">
                  {canEdit && !isGuest && !isDocente && (
                    <>
                      {isDirector && p.estado === 'PLANIFICACION' && (
                        <button onClick={() => {
                          if (confirm('¿Desea iniciar el proceso de asignación? Esto notificará a los docentes para ingresar su disponibilidad.')) {
                            startProcessMutation.mutate({ id: p.id });
                          }
                        }}
                          className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-500 shadow-lg shadow-emerald-500/20">
                          Iniciar Proceso
                        </button>
                      )}
                      {!p.activo && (
                        <button onClick={() => toggleMutation.mutate({ id: p.id, activo: true })}
                          className="rounded-lg border border-emerald-500/30 px-3 py-1.5 text-xs font-medium text-emerald-400 hover:bg-emerald-500/10">
                          Activar
                        </button>
                      )}
                      <button onClick={() => deleteMutation.mutate({ id: p.id })}
                        className="rounded-lg border border-red-500/30 px-3 py-1.5 text-xs font-medium text-red-400 hover:bg-red-500/10">
                        Eliminar
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-gray-700 bg-gray-900 p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-white">Nuevo Periodo</h2>
              <button onClick={() => setShowModal(false)} className="rounded-lg p-1 text-gray-500 hover:bg-gray-800"><X className="h-5 w-5" /></button>
            </div>
            <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate({ ...form, fechaInicio: new Date(form.fechaInicio), fechaFin: new Date(form.fechaFin) }); }} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Nombre (ej: 2026-I)</label>
                <input type="text" required value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                  className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-200 focus:border-indigo-500 focus:outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">Fecha Inicio</label>
                  <input type="date" required value={form.fechaInicio} onChange={(e) => setForm({ ...form, fechaInicio: e.target.value })}
                    className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-200 focus:border-indigo-500 focus:outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">Fecha Fin</label>
                  <input type="date" required value={form.fechaFin} onChange={(e) => setForm({ ...form, fechaFin: e.target.value })}
                    className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-200 focus:border-indigo-500 focus:outline-none" />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-300">
                <input type="checkbox" checked={form.activo} onChange={(e) => setForm({ ...form, activo: e.target.checked })}
                  className="rounded border-gray-600 bg-gray-800 text-indigo-500" />
                Establecer como periodo activo
              </label>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="rounded-lg border border-gray-700 px-4 py-2 text-sm text-gray-400 hover:bg-gray-800">Cancelar</button>
                <button type="submit" className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
                  disabled={createMutation.isPending}>Crear</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
