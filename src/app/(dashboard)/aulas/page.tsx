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
  TEORIA: 'badge-info',
  LABORATORIO: 'badge-warning',
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-main">Aulas y Laboratorios</h1>
          <p className="text-sm text-text-sub mt-1">{aulas.length} ambientes registrados</p>
        </div>
        {canEdit && (
          <button onClick={() => setShowModal(true)}
            className="btn-primary">
            <Plus className="h-4 w-4" /> Nueva Aula
          </button>
        )}
      </div>

      <div className="flex gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-text-sub" />
          <input type="text" placeholder="Buscar por nombre o código..." value={search} onChange={(e) => setSearch(e.target.value)}
            className="input-standard pl-12" />
        </div>
        <select value={filterTipo ?? ''} onChange={(e) => setFilterTipo(e.target.value ? e.target.value as 'TEORIA' | 'LABORATORIO' : undefined)}
          className="rounded-lg border border-border bg-white px-3 py-2.5 text-sm text-text-main focus:border-primary focus:ring-1 focus:ring-primary outline-none">
          <option value="">Todos los tipos</option>
          <option value="TEORIA">Teoría</option>
          <option value="LABORATORIO">Laboratorio</option>
        </select>
      </div>

      <div className="table-standard">
        <table className="w-full text-left border-separate border-spacing-0">
          <thead>
            <tr>
              <th>Ambiente</th>
              <th className="text-center">Tipo</th>
              <th className="text-center">Capacidad</th>
              <th>Edificio / Piso</th>
              <th className="text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={5} className="px-6 py-12 text-center text-text-sub">Cargando ambientes...</td></tr>
            ) : aulas.length === 0 ? (
              <tr><td colSpan={5} className="px-6 py-12 text-center text-text-sub">No se encontraron ambientes</td></tr>
            ) : (
              aulas.map((a) => (
                <tr key={a.id} className="group transition-colors">
                  <td>
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 border border-border group-hover:border-primary/30 group-hover:bg-primary-light transition-colors">
                        <span className="text-[10px] font-bold text-text-sub group-hover:text-primary">{a.codigo}</span>
                      </div>
                      <span className="text-sm font-bold text-text-main group-hover:text-primary transition-colors">{a.nombre}</span>
                    </div>
                  </td>
                  <td className="text-center">
                    <span className={`badge ${TIPO_BADGE[a.tipo]}`}>
                      {a.tipo}
                    </span>
                  </td>
                  <td className="text-center">
                    <span className="text-xs font-bold text-text-main bg-slate-50 px-2 py-1 rounded border border-border">{a.capacidad} pers.</span>
                  </td>
                  <td>
                    <div className="text-[11px]">
                      <p className="text-text-main font-bold uppercase tracking-tight">Edificio {a.edificio}</p>
                      <p className="text-text-sub font-bold uppercase tracking-tighter">Piso {a.piso}</p>
                    </div>
                  </td>
                  <td className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      {canEdit ? (
                        <>
                          <button onClick={() => openEdit(a)} 
                            className="p-2 rounded-lg text-text-sub hover:bg-primary-light hover:text-primary transition-all">
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button onClick={() => deleteMutation.mutate({ id: a.id })} 
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

      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content max-w-md">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-text-main">{editId ? 'Editar Aula' : 'Nueva Aula'}</h2>
              <button onClick={closeModal} className="rounded-lg p-1 text-text-sub hover:bg-slate-100 transition-colors"><X className="h-5 w-5" /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label-standard">Código</label>
                  <input type="text" required value={form.codigo} onChange={(e) => setForm({ ...form, codigo: e.target.value })}
                    className="input-standard" />
                </div>
                <div>
                  <label className="label-standard">Tipo</label>
                  <select value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value as FormData['tipo'] })}
                    className="input-standard">
                    <option value="TEORIA">Teoría</option>
                    <option value="LABORATORIO">Laboratorio</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="label-standard">Nombre</label>
                <input type="text" required value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                  className="input-standard" />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="label-standard">Capacidad</label>
                  <input type="number" required min={1} value={form.capacidad} onChange={(e) => setForm({ ...form, capacidad: Number(e.target.value) })}
                    className="input-standard" />
                </div>
                <div>
                  <label className="label-standard">Edificio</label>
                  <input type="text" required value={form.edificio} onChange={(e) => setForm({ ...form, edificio: e.target.value })}
                    className="input-standard" />
                </div>
                <div>
                  <label className="label-standard">Piso</label>
                  <input type="number" required min={0} value={form.piso} onChange={(e) => setForm({ ...form, piso: Number(e.target.value) })}
                    className="input-standard" />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t border-border">
                <button type="button" onClick={closeModal} className="btn-secondary">Cancelar</button>
                <button type="submit" className="btn-primary">
                  {editId ? 'Actualizar' : 'Registrar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
