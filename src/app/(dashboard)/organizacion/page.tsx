'use client';

import { useTRPC } from '@/trpc/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Building2, School, GraduationCap, BookOpen, Pencil, Trash2, Users, Plus, X } from 'lucide-react';

export default function OrganizacionPage() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState<'facultad' | 'departamento' | 'escuela'>('facultad');
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ nombre: '', sede: '', facultadId: '' });

  const { data: user } = useQuery({ ...trpc.auth.me.queryOptions() });
  const { data: facultades = [] } = useQuery({ ...trpc.facultad.list.queryOptions() });
  const { data: departamentos = [] } = useQuery({ ...trpc.departamento.list.queryOptions() });
  const { data: escuelas = [] } = useQuery({ ...trpc.escuela.list.queryOptions() });

  const deleteFacultad = useMutation(trpc.facultad.delete.mutationOptions({
    onSuccess: () => queryClient.invalidateQueries({ queryKey: trpc.facultad.list.queryKey() })
  }));

  const deleteDepartamento = useMutation(trpc.departamento.delete.mutationOptions({
    onSuccess: () => queryClient.invalidateQueries({ queryKey: trpc.departamento.list.queryKey() })
  }));

  const deleteEscuela = useMutation(trpc.escuela.delete.mutationOptions({
    onSuccess: () => queryClient.invalidateQueries({ queryKey: trpc.escuela.list.queryKey() })
  }));

  const openEdit = (item: any, type: 'facultad' | 'departamento' | 'escuela') => {
    setModalType(type);
    setEditId(item.id);
    setForm({
      nombre: item.nombre,
      sede: item.sede || '',
      facultadId: item.facultadId || ''
    });
    setShowModal(true);
  };

  if (!user || user.role !== 'ADMIN') {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-warning/10 border border-warning/30 rounded-lg p-6 text-center">
          <h2 className="text-lg font-bold text-warning">Acceso Restringido</h2>
          <p className="text-text-sub mt-2">Solo administradores pueden gestionar la estructura organizacional.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-main">Estructura Organizacional</h1>
        <p className="text-text-sub text-sm mt-1">Gestión de facultades, departamentos y escuelas</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="card-standard">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 rounded-lg bg-primary-light border border-primary/10">
              <Building2 className="w-5 h-5 text-primary" />
            </div>
            <h2 className="text-lg font-bold text-text-main tracking-tight">Facultades</h2>
          </div>
          <div className="space-y-3">
            {facultades.map((f) => (
              <div key={f.id} className="rounded-xl border border-border bg-white p-4 transition-all hover:border-primary/30 group">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 border border-border group-hover:bg-primary-light group-hover:border-primary/20 transition-colors">
                      <Building2 className="h-4.5 w-4.5 text-text-sub group-hover:text-primary" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-text-main group-hover:text-primary transition-colors">{f.nombre}</h3>
                      <p className="text-[10px] text-text-sub font-bold uppercase tracking-wider">Sede: {f.sede}</p>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => openEdit(f, 'facultad')} className="rounded-lg p-1.5 text-text-sub hover:bg-primary-light hover:text-primary transition-all">
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button onClick={() => deleteFacultad.mutate({ id: f.id })} className="rounded-lg p-1.5 text-text-sub hover:bg-red-50 hover:text-danger transition-all">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card-standard">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 rounded-lg bg-green-50 border border-green-100">
              <School className="w-5 h-5 text-green-700" />
            </div>
            <h2 className="text-lg font-bold text-text-main tracking-tight">Departamentos</h2>
          </div>
          <div className="space-y-3">
            {departamentos.map((d) => (
              <div key={d.id} className="rounded-xl border border-border bg-white p-4 transition-all hover:border-green-300 group">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 border border-border group-hover:bg-green-50 group-hover:border-green-200 transition-colors">
                      <Users className="h-4.5 w-4.5 text-text-sub group-hover:text-green-700" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-text-main group-hover:text-green-700 transition-colors">{d.nombre}</h3>
                      <p className="text-[10px] text-text-sub font-bold uppercase tracking-wider">Facultad: {d.facultad.nombre}</p>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => openEdit(d, 'departamento')} className="rounded-lg p-1.5 text-text-sub hover:bg-green-50 hover:text-green-700 transition-all">
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button onClick={() => deleteDepartamento.mutate({ id: d.id })} className="rounded-lg p-1.5 text-text-sub hover:bg-red-50 hover:text-danger transition-all">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card-standard">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 rounded-lg bg-amber-50 border border-amber-100">
              <GraduationCap className="w-5 h-5 text-amber-700" />
            </div>
            <h2 className="text-lg font-bold text-text-main tracking-tight">Escuelas</h2>
          </div>
          <div className="space-y-3">
            {escuelas.map((e) => (
              <div key={e.id} className="rounded-xl border border-border bg-white p-4 transition-all hover:border-amber-300 group">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 border border-border group-hover:bg-amber-50 group-hover:border-amber-200 transition-colors">
                      <GraduationCap className="h-4.5 w-4.5 text-text-sub group-hover:text-amber-700" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-text-main group-hover:text-amber-700 transition-colors">{e.nombre}</h3>
                      <p className="text-[10px] text-text-sub font-bold uppercase tracking-wider">Facultad: {e.facultad?.nombre}</p>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => openEdit(e, 'escuela')} className="rounded-lg p-1.5 text-text-sub hover:bg-amber-50 hover:text-amber-700 transition-all">
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button onClick={() => deleteEscuela.mutate({ id: e.id })} className="rounded-lg p-1.5 text-text-sub hover:bg-red-50 hover:text-danger transition-all">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
