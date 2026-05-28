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
  NOMBRADO: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  CONTRATADO: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
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
          <h1 className="text-2xl font-bold text-white">Gestión de Docentes</h1>
          <p className="text-sm text-gray-500 mt-1">
            Directorio y disponibilidad de la plana docente
          </p>
        </div>
        <div className="flex items-center gap-3">
          {canEdit && (
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition-all hover:bg-indigo-500 shadow-lg shadow-indigo-500/25"
            >
              <Plus className="h-4 w-4" />
              Registrar Docente
            </button>
          )}
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
        <input
          type="text"
          placeholder="Buscar por nombre o email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-lg border border-gray-700 bg-gray-900 py-2.5 pl-10 pr-4 text-sm text-gray-200 placeholder-gray-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
      </div>

      {/* Table */}
      <div className="rounded-xl border border-gray-800 bg-gray-900 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800 bg-gray-900/50">
              <th className="px-4 py-3 text-left font-medium text-gray-400">Nombre</th>
              <th className="px-4 py-3 text-left font-medium text-gray-400">Email</th>
              <th className="px-4 py-3 text-left font-medium text-gray-400">Tipo</th>
              <th className="px-4 py-3 text-left font-medium text-gray-400">Categoría</th>
              <th className="px-4 py-3 text-left font-medium text-gray-400">Modalidad</th>
              <th className="px-4 py-3 text-center font-medium text-gray-400">Contrato</th>
              <th className="px-4 py-3 text-left font-medium text-gray-400">Antigüedad</th>
              <th className="px-4 py-3 text-right font-medium text-gray-400">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={8} className="px-4 py-12 text-center text-gray-600">Cargando...</td></tr>
            ) : docentes.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-12 text-center text-gray-600">No se encontraron docentes</td></tr>
            ) : (
              docentes.map((d) => (
                <tr key={d.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                  <td className="px-4 py-3 font-medium text-gray-200">{d.nombre}</td>
                  <td className="px-4 py-3 text-gray-400">{d.email}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${TIPO_BADGES[d.tipo]}`}>
                      {d.tipo}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-300">{CATEGORIA_LABELS[d.categoria]}</td>
                  <td className="px-4 py-3">
                    <span className="text-xs text-purple-400">{(d as any).modalidad?.replace(/_/g, ' ') || 'TC'}</span>
                  </td>
                  <td className="px-4 py-3 text-center text-gray-300">{(d as any).horasContrato || 40}h</td>
                  <td className="px-4 py-3 text-gray-400">
                    {new Date(d.antiguedad).toLocaleDateString('es-PE')}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {canEdit ? (
                        <>
                          <button onClick={() => openEdit(d)} className="rounded-md p-1.5 text-gray-500 hover:bg-gray-700 hover:text-gray-300">
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button onClick={() => deleteMutation.mutate({ id: d.id })} className="rounded-md p-1.5 text-gray-500 hover:bg-red-900/30 hover:text-red-400">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </>
                      ) : (
                        <span className="text-[10px] text-gray-600 font-medium">Solo lectura</span>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-gray-700 bg-gray-900 p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-white">
                {editId ? 'Editar Docente' : 'Nuevo Docente'}
              </h2>
              <button onClick={closeModal} className="rounded-lg p-1 text-gray-500 hover:bg-gray-800 hover:text-gray-300">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Nombre</label>
                <input type="text" required value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                  className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-200 focus:border-indigo-500 focus:outline-none" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Email</label>
                <input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-200 focus:border-indigo-500 focus:outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">Tipo</label>
                  <select value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value as FormData['tipo'] })}
                    className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-200 focus:border-indigo-500 focus:outline-none">
                    <option value="NOMBRADO">Nombrado</option>
                    <option value="CONTRATADO">Contratado</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">Categoría</label>
                  <select value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value as FormData['categoria'] })}
                    className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-200 focus:border-indigo-500 focus:outline-none">
                    <option value="PRINCIPAL">Principal</option>
                    <option value="ASOCIADO">Asociado</option>
                    <option value="AUXILIAR">Auxiliar</option>
                    <option value="JEFE_PRACTICA">Jefe de Práctica</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">Grado Académico</label>
                  <input type="text" value={form.gradoAcademico} onChange={(e) => setForm({ ...form, gradoAcademico: e.target.value })}
                    className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-200 focus:border-indigo-500 focus:outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">Especialidad</label>
                  <input type="text" value={form.especialidad} onChange={(e) => setForm({ ...form, especialidad: e.target.value })}
                    className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-200 focus:border-indigo-500 focus:outline-none" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Experiencia (años)</label>
                <input type="number" value={form.experienciaAnios} onChange={(e) => setForm({ ...form, experienciaAnios: parseInt(e.target.value) || 0 })}
                  className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-200 focus:border-indigo-500 focus:outline-none" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Perfil Académico (Keywords)</label>
                <textarea value={form.perfilAcademico} onChange={(e) => setForm({ ...form, perfilAcademico: e.target.value })}
                  placeholder="Ej: software bases de datos inteligencia artificial react node"
                  className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-200 focus:border-indigo-500 focus:outline-none h-20" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Fecha de Antigüedad</label>
                <input type="date" required value={form.antiguedad} onChange={(e) => setForm({ ...form, antiguedad: e.target.value })}
                  className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-200 focus:border-indigo-500 focus:outline-none" />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={closeModal}
                  className="rounded-lg border border-gray-700 px-4 py-2 text-sm text-gray-400 hover:bg-gray-800">
                  Cancelar
                </button>
                <button type="submit"
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
                  disabled={createMutation.isPending || updateMutation.isPending}>
                  {editId ? 'Guardar' : 'Crear'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
