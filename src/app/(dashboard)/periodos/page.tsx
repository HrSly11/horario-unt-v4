'use client';

import { useTRPC } from '@/trpc/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Plus, X, Trash2, Pencil } from 'lucide-react';

export default function PeriodosPage() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({
    nombre: '',
    fechaInicio: '',
    fechaFin: '',
    activo: false,
    estado: 'PLANIFICACION' as any,
  });

  const { data: periodos = [], isLoading } = useQuery({ ...trpc.periodo.list.queryOptions() });

  const createMutation = useMutation(
    trpc.periodo.create.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: trpc.periodo.list.queryKey() });
        setShowModal(false);
        resetForm();
      },
      onError: (e: any) => alert(e.message),
    })
  );

  const updateMutation = useMutation(
    trpc.periodo.update.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: trpc.periodo.list.queryKey() });
        setShowModal(false);
        resetForm();
      },
      onError: (e: any) => alert(e.message),
    })
  );

  const resetForm = () => {
    setForm({ nombre: '', fechaInicio: '', fechaFin: '', activo: false, estado: 'PLANIFICACION' });
    setEditId(null);
  };

  const openEdit = (p: any) => {
    setEditId(p.id);
    setForm({
      nombre: p.nombre,
      fechaInicio: new Date(p.fechaInicio).toISOString().split('T')[0],
      fechaFin: new Date(p.fechaFin).toISOString().split('T')[0],
      activo: p.activo,
      estado: p.estado,
    });
    setShowModal(true);
  };

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
          <h1 className="text-2xl font-bold text-text-main">Periodos Académicos</h1>
          <p className="text-sm text-text-sub mt-1">Configuración de semestres y estados del proceso</p>
        </div>
        {canEdit && !isGuest && !isDocente && (
          <button
            onClick={() => {
              setForm({ nombre: '', fechaInicio: '', fechaFin: '', activo: false });
              setShowModal(true);
            }}
            className="btn-primary"
          >
            <Plus className="h-4 w-4" /> Nuevo Periodo
          </button>
        )}
      </div>

      <div className="grid gap-4">
        {isLoading ? (
          <div className="text-center text-text-sub py-12 font-medium">Cargando periodos...</div>
        ) : (
          periodos
            .sort((a, b) => (b.activo ? 1 : 0) - (a.activo ? 1 : 0))
            .map((p) => (
            <div 
              key={p.id} 
              className={`card-standard transition-all duration-300 ${
                p.activo 
                  ? 'border-success/30 bg-green-50/30 ring-4 ring-success/5 scale-[1.01]' 
                  : 'hover:border-primary/20'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-6">
                  <div className={`flex h-14 w-14 items-center justify-center rounded-xl shadow-sm ${
                    p.activo ? 'bg-success text-white' : 'bg-slate-100 text-text-sub border border-border'
                  }`}>
                    <span className="text-lg font-bold">
                      {p.nombre.toLowerCase().includes('extraordinario') || p.nombre.toLowerCase().includes('vacacional') 
                        ? 'E' 
                        : (p.nombre.split('-')[1] || p.nombre.charAt(0).toUpperCase())}
                    </span>
                  </div>
                  <div>
                    <div className="flex items-center gap-3">
                      <h3 className={`text-xl font-bold tracking-tight ${p.activo ? 'text-success' : 'text-text-main'}`}>
                        {p.nombre}
                      </h3>
                      {p.activo && (
                        <span className="badge badge-success">ACTIVO</span>
                      )}
                      <span className={`badge ${
                        p.estado === 'PLANIFICACION' ? 'badge-gray' :
                        p.estado === 'POSTULACION' ? 'badge-primary' :
                        p.estado === 'ASIGNACION' ? 'badge-warning' :
                        p.estado === 'REVISION' ? 'badge-info' :
                        p.estado === 'APROBADO' ? 'badge-success' :
                        'badge-danger'
                      }`}>
                        {p.estado}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 mt-1.5">
                      <p className={`text-sm font-medium ${p.activo ? 'text-success/80' : 'text-text-sub'}`}>
                        {new Date(p.fechaInicio).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' })}
                        <span className="mx-2 opacity-40">—</span>
                        {new Date(p.fechaFin).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </p>
                      <div className="h-1 w-1 rounded-full bg-slate-300" />
                      <p className="text-[11px] font-bold text-text-sub/70 uppercase tracking-tight">
                        {p._count.grupos} grupos · {p._count.asignaciones} asignaciones
                      </p>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  {canEdit && !isGuest && !isDocente && (
                    <>
                      <button onClick={() => openEdit(p)}
                        className="p-2.5 rounded-lg text-text-sub hover:bg-primary-light hover:text-primary transition-all">
                        <Pencil className="h-4.5 w-4.5" />
                      </button>
                      {isDirector && p.estado === 'PLANIFICACION' && (
                        <button onClick={() => {
                          if (confirm('¿Desea iniciar el proceso de asignación? Esto notificará a los docentes para ingresar su disponibilidad.')) {
                            startProcessMutation.mutate({ id: p.id });
                          }
                        }}
                          className="btn-primary bg-indigo-600 hover:bg-indigo-700">
                          Iniciar Proceso
                        </button>
                      )}
                      {!p.activo && (
                        <button onClick={() => toggleMutation.mutate({ id: p.id, activo: true })}
                          className="btn-secondary text-success border-success/30 hover:bg-success hover:text-white">
                          Activar
                        </button>
                      )}
                      <button onClick={() => {
                        if (confirm(`¿Está seguro de eliminar el periodo ${p.nombre}? Esta acción es irreversible.`)) {
                          deleteMutation.mutate({ id: p.id });
                        }
                      }}
                        className="p-2.5 rounded-lg text-text-sub hover:bg-red-50 hover:text-danger transition-all">
                        <Trash2 className="h-4.5 w-4.5" />
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
        <div className="modal-overlay">
          <div className="modal-content max-w-md">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-text-main">
                {editId ? 'Editar Periodo Académico' : 'Nuevo Periodo Académico'}
              </h2>
              <button onClick={() => { setShowModal(false); resetForm(); }} className="rounded-lg p-1 text-text-sub hover:bg-slate-100 transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={(e) => { 
              e.preventDefault(); 
              const data = { ...form, fechaInicio: new Date(form.fechaInicio), fechaFin: new Date(form.fechaFin) };
              if (editId) {
                updateMutation.mutate({ id: editId, ...data });
              } else {
                createMutation.mutate(data);
              }
            }} className="space-y-4">
              <div>
                <label className="label-standard">Nombre del Periodo (ej: 2026-I)</label>
                <input type="text" required value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                  className="input-standard" placeholder="2026-I" />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label-standard">Fecha Inicio</label>
                  <input type="date" required value={form.fechaInicio} onChange={(e) => setForm({ ...form, fechaInicio: e.target.value })}
                    className="input-standard" />
                </div>
                <div>
                  <label className="label-standard">Fecha Fin</label>
                  <input type="date" required value={form.fechaFin} onChange={(e) => setForm({ ...form, fechaFin: e.target.value })}
                    className="input-standard" />
                </div>
              </div>

              {editId && (
                <div>
                  <label className="label-standard">Estado del Periodo</label>
                  <select 
                    value={form.estado} 
                    onChange={(e) => setForm({ ...form, estado: e.target.value as any })}
                    className="input-standard"
                  >
                    <option value="PLANIFICACION">Planificación</option>
                    <option value="POSTULACION">Postulación</option>
                    <option value="ASIGNACION">Asignación</option>
                    <option value="REVISION">En Revisión</option>
                    <option value="APROBADO">Aprobado</option>
                    <option value="FINALIZADO">Finalizado</option>
                  </select>
                </div>
              )}

              <label className="flex items-center gap-3 p-3 rounded-xl border border-border bg-slate-50/50 cursor-pointer hover:bg-slate-50 transition-colors group">
                <input type="checkbox" checked={form.activo} onChange={(e) => setForm({ ...form, activo: e.target.checked })}
                  className="h-4 w-4 rounded border-border bg-white text-primary focus:ring-primary/20" />
                <span className="text-sm text-text-sub font-bold group-hover:text-text-main transition-colors">Establecer como periodo activo</span>
              </label>

              <div className="flex justify-end gap-3 pt-4 border-t border-border">
                <button type="button" onClick={() => { setShowModal(false); resetForm(); }} className="btn-secondary">Cancelar</button>
                <button type="submit" className="btn-primary"
                  disabled={createMutation.isPending || updateMutation.isPending}>
                  {createMutation.isPending || updateMutation.isPending 
                    ? (editId ? 'Actualizando...' : 'Creando...') 
                    : (editId ? 'Guardar Cambios' : 'Crear Periodo')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
