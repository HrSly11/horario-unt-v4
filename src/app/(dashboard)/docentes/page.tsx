'use client';

import { useTRPC } from '@/trpc/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Plus, Pencil, Trash2, Search, X } from 'lucide-react';

type FormData = {
  nombre: string;
  email: string;
  categoria: 'PRINCIPAL' | 'ASOCIADO' | 'AUXILIAR' | 'JEFE_PRACTICA';
  tipo: 'NOMBRADO' | 'CONTRATADO';
  antiguedad: string;
  activo: boolean;
  gradoAcademico: string;
  especialidad: string;
  experienciaAnios: number;
  perfilAcademico: string;
  dni: string;
  codigoIBM: string;
  modalidad: 'TIEMPO_COMPLETO' | 'DEDICACION_EXCLUSIVA' | 'TIEMPO_PARCIAL';
  horasContrato: number;
};

const emptyForm: FormData = {
  nombre: '', email: '', categoria: 'AUXILIAR',
  tipo: 'CONTRATADO', antiguedad: '', activo: true,
  gradoAcademico: '', especialidad: '', experienciaAnios: 0, perfilAcademico: '',
  dni: '', codigoIBM: '', modalidad: 'TIEMPO_COMPLETO', horasContrato: 40,
};

const CATEGORIA_LABELS: Record<string, string> = {
  PRINCIPAL: 'Principal', ASOCIADO: 'Asociado',
  AUXILIAR: 'Auxiliar', JEFE_PRACTICA: 'Jefe de Práctica',
};

const TIPO_BADGES: Record<string, string> = {
  NOMBRADO: 'badge-success',
  CONTRATADO: 'badge-warning',
};

export default function DocentesPage() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<FormData>(emptyForm);
  const [search, setSearch] = useState('');

  const { data: user } = useQuery({ ...trpc.auth.me.queryOptions() });
  const canEdit = user?.role === 'ADMIN' || user?.role === 'SECRETARIA_ACADEMICA';

  const { data: docentes = [], isLoading } = useQuery({
    ...trpc.docente.list.queryOptions({ search: search || undefined })
  });

  const createMutation = useMutation(
    trpc.docente.create.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: trpc.docente.list.queryKey() });
        closeModal();
      },
    })
  );

  const updateMutation = useMutation(
    trpc.docente.update.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: trpc.docente.list.queryKey() });
        closeModal();
      },
    })
  );

  const deleteMutation = useMutation(
    trpc.docente.delete.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: trpc.docente.list.queryKey() });
      },
    })
  );

  function closeModal() {
    setShowModal(false);
    setEditId(null);
    setForm(emptyForm);
  }

  function openEdit(d: (typeof docentes)[0]) {
    setEditId(d.id);
    setForm({
      nombre: d.nombre,
      email: d.email,
      categoria: d.categoria,
      tipo: d.tipo,
      antiguedad: d.antiguedad.toString().slice(0, 10),
      activo: d.activo,
      gradoAcademico: d.gradoAcademico || '',
      especialidad: d.especialidad || '',
      experienciaAnios: d.experienciaAnios || 0,
      perfilAcademico: d.perfilAcademico || '',
      dni: (d as any).dni || '',
      codigoIBM: (d as any).codigoIBM || '',
      modalidad: (d as any).modalidad || 'TIEMPO_COMPLETO',
      horasContrato: (d as any).horasContrato || 40,
    });
    setShowModal(true);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload = { ...form, antiguedad: new Date(form.antiguedad) };
    if (editId) {
      updateMutation.mutate({ id: editId, ...payload });
    } else {
      createMutation.mutate(payload);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-main">Gestión de Docentes</h1>
          <p className="text-sm text-text-sub mt-1">
            Directorio y disponibilidad de la plana docente
          </p>
        </div>
        <div className="flex items-center gap-3">
          {canEdit && (
            <button
              onClick={() => setShowModal(true)}
              className="btn-primary"
            >
              <Plus className="h-4 w-4" />
              Registrar Docente
            </button>
          )}
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-text-sub" />
        <input
          type="text"
          placeholder="Buscar por nombre o email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="input-standard pl-12 pr-10"
        />
        {search && (
          <button
            onClick={() => setSearch('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-md text-text-sub hover:bg-slate-100 hover:text-text-main transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Table */}
      <div className="table-standard">
        <table className="w-full text-left border-separate border-spacing-0">
          <thead>
            <tr>
              <th>Docente</th>
              <th>Categoría / Dedicación</th>
              <th>Departamento</th>
              <th className="text-center">Horas</th>
              <th className="text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={5} className="px-6 py-12 text-center text-text-sub">Cargando...</td></tr>
            ) : docentes.length === 0 ? (
              <tr><td colSpan={5} className="px-6 py-12 text-center text-text-sub">No se encontraron docentes</td></tr>
            ) : (
              docentes.map((d) => (
                <tr key={d.id} className="group transition-colors">
                  <td>
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 border border-border text-text-sub text-xs font-bold group-hover:border-primary/30 group-hover:bg-primary-light group-hover:text-primary transition-colors">
                        {d.nombre.charAt(0)}
                      </div>
                      <div>
                        <p className="font-bold text-text-main group-hover:text-primary transition-colors">{d.nombre}</p>
                        <p className="text-[10px] text-text-sub font-bold uppercase tracking-tight">{(d as any).dni}</p>
                      </div>
                    </div>
                  </td>
                  <td>
                    <div className="flex flex-col gap-1">
                      <span className={`badge ${TIPO_BADGES[d.tipo] || 'badge-gray'} w-fit`}>
                        {CATEGORIA_LABELS[d.categoria]}
                      </span>
                      <p className="text-[10px] text-text-sub font-bold uppercase">{(d as any).modalidad?.replace(/_/g, ' ') || 'TC'}</p>
                    </div>
                  </td>
                  <td>
                    <p className="text-sm font-medium text-text-main/80">{(d as any).departamento?.nombre || 'Sin departamento'}</p>
                  </td>
                  <td className="text-center">
                    <span className="text-xs font-bold text-primary bg-primary-light px-2 py-1 rounded-md border border-primary/10">{(d as any).horasContrato || 40}h</span>
                  </td>
                  <td className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      {canEdit ? (
                        <>
                          <button onClick={() => openEdit(d)} 
                            className="p-2 rounded-lg text-text-sub hover:bg-primary-light hover:text-primary transition-all">
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button onClick={() => deleteMutation.mutate({ id: d.id })} 
                            className="p-2 rounded-lg text-text-sub hover:bg-red-50 hover:text-danger transition-all">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </>
                      ) : (
                        <span className="text-[10px] text-text-sub font-bold uppercase italic tracking-widest px-2">Lectura</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-text-main">
                {editId ? 'Editar Docente' : 'Nuevo Docente'}
              </h2>
              <button onClick={closeModal} className="rounded-lg p-1 text-text-sub hover:bg-slate-100 transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="label-standard">Nombre Completo</label>
                <input type="text" required value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                  className="input-standard" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label-standard">Email Institucional</label>
                  <input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="input-standard" />
                </div>
                <div>
                  <label className="label-standard">DNI / Documento</label>
                  <input type="text" required value={form.dni} onChange={(e) => setForm({ ...form, dni: e.target.value })}
                    className="input-standard" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label-standard">Categoría</label>
                  <select value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value as any })}
                    className="input-standard">
                    {Object.entries(CATEGORIA_LABELS).map(([val, label]) => (
                      <option key={val} value={val}>{label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label-standard">Tipo de Contrato</label>
                  <select value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value as any })}
                    className="input-standard">
                    <option value="NOMBRADO">Nombrado</option>
                    <option value="CONTRATADO">Contratado</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label-standard">Modalidad</label>
                  <select value={form.modalidad} onChange={(e) => setForm({ ...form, modalidad: e.target.value as any })}
                    className="input-standard">
                    <option value="TIEMPO_COMPLETO">Tiempo Completo (TC)</option>
                    <option value="DEDICACION_EXCLUSIVA">Dedicación Exclusiva (DE)</option>
                    <option value="TIEMPO_PARCIAL">Tiempo Parcial (TP)</option>
                  </select>
                </div>
                <div>
                  <label className="label-standard">Horas de Contrato</label>
                  <input type="number" required value={form.horasContrato} onChange={(e) => setForm({ ...form, horasContrato: Number(e.target.value) })}
                    className="input-standard" />
                </div>
              </div>
              <div>
                <label className="label-standard">Perfil Académico / Especialidad</label>
                <textarea value={form.perfilAcademico} onChange={(e) => setForm({ ...form, perfilAcademico: e.target.value })}
                  className="input-standard h-20" placeholder="Describa brevemente el perfil y especialidad del docente..." />
              </div>
              
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={closeModal} className="px-4 py-2 text-sm font-bold text-text-sub hover:text-text-main transition-colors">
                  Cancelar
                </button>
                <button type="submit" className="btn-primary" disabled={createMutation.isPending || updateMutation.isPending}>
                  {editId ? 'Guardar Cambios' : 'Registrar Docente'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
