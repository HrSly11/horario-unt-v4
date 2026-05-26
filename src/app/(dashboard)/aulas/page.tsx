'use client';

import { useTRPC } from '@/trpc/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Plus, Pencil, Trash2, Search, X } from 'lucide-react';

type FormData = {
  codigo: string;
  nombre: string;
  capacidad: number;
  tipo: 'TEORIA' | 'LABORATORIO';
  edificio: string;
  piso: number;
};

const emptyForm: FormData = {
  codigo: '', nombre: '', capacidad: 40, tipo: 'TEORIA', edificio: '', piso: 1,
};

const TIPO_BADGE: Record<string, string> = {
  TEORIA: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  LABORATORIO: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
};

export default function AulasPage() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<FormData>(emptyForm);
  const [search, setSearch] = useState('');
  const [filterTipo, setFilterTipo] = useState<'TEORIA' | 'LABORATORIO' | undefined>();

  const { data: user } = useQuery({ ...trpc.auth.me.queryOptions() });
  const isAdmin = user?.role === 'ADMIN';
  const canEdit = user?.role === 'ADMIN' || user?.role === 'SECRETARIA_ACADEMICA';

  const { data: aulas = [], isLoading } = useQuery({
    ...trpc.aula.list.queryOptions({ search: search || undefined, tipo: filterTipo })
  });

  const createMutation = useMutation(
    trpc.aula.create.mutationOptions({
      onSuccess: () => { queryClient.invalidateQueries({ queryKey: trpc.aula.list.queryKey() }); closeModal(); },
    })
  );
  const updateMutation = useMutation(
    trpc.aula.update.mutationOptions({
      onSuccess: () => { queryClient.invalidateQueries({ queryKey: trpc.aula.list.queryKey() }); closeModal(); },
    })
  );
  const deleteMutation = useMutation(
    trpc.aula.delete.mutationOptions({
      onSuccess: () => { queryClient.invalidateQueries({ queryKey: trpc.aula.list.queryKey() }); },
    })
  );

  function closeModal() { setShowModal(false); setEditId(null); setForm(emptyForm); }

  function openEdit(a: (typeof aulas)[0]) {
    setEditId(a.id);
    setForm({ codigo: a.codigo, nombre: a.nombre, capacidad: a.capacidad, tipo: a.tipo, edificio: a.edificio, piso: a.piso });
    setShowModal(true);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (editId) {
      updateMutation.mutate({ id: editId, ...form });
    } else {
      createMutation.mutate(form);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Aulas y Laboratorios</h1>
          <p className="text-sm text-gray-500 mt-1">{aulas.length} ambientes registrados</p>
        </div>
        {canEdit && (
          <button onClick={() => setShowModal(true)}
            className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-500 shadow-lg shadow-indigo-500/25">
            <Plus className="h-4 w-4" /> Nueva Aula
          </button>
        )}
      </div>

      <div className="flex gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
          <input type="text" placeholder="Buscar por nombre o código..." value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-gray-700 bg-gray-900 py-2.5 pl-10 pr-4 text-sm text-gray-200 placeholder-gray-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
        </div>
        <select value={filterTipo ?? ''} onChange={(e) => setFilterTipo(e.target.value ? e.target.value as 'TEORIA' | 'LABORATORIO' : undefined)}
          className="rounded-lg border border-gray-700 bg-gray-900 px-3 py-2.5 text-sm text-gray-200 focus:border-indigo-500 focus:outline-none">
          <option value="">Todos los tipos</option>
          <option value="TEORIA">Teoría</option>
          <option value="LABORATORIO">Laboratorio</option>
        </select>
      </div>

      <div className="rounded-xl border border-gray-800 bg-gray-900 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800 bg-gray-900/50">
              <th className="px-4 py-3 text-left font-medium text-gray-400">Código</th>
              <th className="px-4 py-3 text-left font-medium text-gray-400">Nombre</th>
              <th className="px-4 py-3 text-center font-medium text-gray-400">Tipo</th>
              <th className="px-4 py-3 text-center font-medium text-gray-400">Capacidad</th>
              <th className="px-4 py-3 text-left font-medium text-gray-400">Edificio</th>
              <th className="px-4 py-3 text-center font-medium text-gray-400">Piso</th>
              <th className="px-4 py-3 text-right font-medium text-gray-400">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={7} className="px-4 py-12 text-center text-gray-600">Cargando...</td></tr>
            ) : aulas.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-12 text-center text-gray-600">No se encontraron aulas</td></tr>
            ) : (
              aulas.map((a) => (
                <tr key={a.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                  <td className="px-4 py-3 font-mono text-xs text-indigo-400">{a.codigo}</td>
                  <td className="px-4 py-3 font-medium text-gray-200">{a.nombre}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${TIPO_BADGE[a.tipo]}`}>
                      {a.tipo === 'LABORATORIO' ? 'Lab' : 'Teoría'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center text-gray-400">{a.capacidad}</td>
                  <td className="px-4 py-3 text-gray-400">{a.edificio}</td>
                  <td className="px-4 py-3 text-center text-gray-400">{a.piso}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {canEdit ? (
                        <>
                          <button onClick={() => openEdit(a)} className="rounded-md p-1.5 text-gray-500 hover:bg-gray-700 hover:text-gray-300"><Pencil className="h-3.5 w-3.5" /></button>
                          <button onClick={() => deleteMutation.mutate({ id: a.id })} className="rounded-md p-1.5 text-gray-500 hover:bg-red-900/30 hover:text-red-400"><Trash2 className="h-3.5 w-3.5" /></button>
                        </>
                      ) : (
                        <span className="text-[10px] text-gray-600">Solo lectura</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-gray-700 bg-gray-900 p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-white">{editId ? 'Editar Aula' : 'Nueva Aula'}</h2>
              <button onClick={closeModal} className="rounded-lg p-1 text-gray-500 hover:bg-gray-800"><X className="h-5 w-5" /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">Código</label>
                  <input type="text" required value={form.codigo} onChange={(e) => setForm({ ...form, codigo: e.target.value })}
                    className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-200 focus:border-indigo-500 focus:outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">Tipo</label>
                  <select value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value as FormData['tipo'] })}
                    className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-200 focus:border-indigo-500 focus:outline-none">
                    <option value="TEORIA">Teoría</option>
                    <option value="LABORATORIO">Laboratorio</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Nombre</label>
                <input type="text" required value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                  className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-200 focus:border-indigo-500 focus:outline-none" />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">Capacidad</label>
                  <input type="number" required min={1} value={form.capacidad} onChange={(e) => setForm({ ...form, capacidad: Number(e.target.value) })}
                    className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-200 focus:border-indigo-500 focus:outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">Edificio</label>
                  <input type="text" required value={form.edificio} onChange={(e) => setForm({ ...form, edificio: e.target.value })}
                    className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-200 focus:border-indigo-500 focus:outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">Piso</label>
                  <input type="number" required min={0} value={form.piso} onChange={(e) => setForm({ ...form, piso: Number(e.target.value) })}
                    className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-200 focus:border-indigo-500 focus:outline-none" />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={closeModal} className="rounded-lg border border-gray-700 px-4 py-2 text-sm text-gray-400 hover:bg-gray-800">Cancelar</button>
                <button type="submit" className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
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
