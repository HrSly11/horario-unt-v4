'use client';

import { useTRPC } from '@/trpc/client';
import { useQuery } from '@tanstack/react-query';
import { Building2, School, GraduationCap, BookOpen } from 'lucide-react';

export default function OrganizacionPage() {
  const trpc = useTRPC();
  const { data: user } = useQuery({ ...trpc.auth.me.queryOptions() });
  const { data: facultades = [] } = useQuery({ ...trpc.facultad.list.queryOptions() });
  const { data: departamentos = [] } = useQuery({ ...trpc.departamento.list.queryOptions() });
  const { data: escuelas = [] } = useQuery({ ...trpc.escuela.list.queryOptions() });

  if (!user || user.role !== 'ADMIN') {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-6 text-center">
          <h2 className="text-lg font-semibold text-amber-400">Acceso Restringido</h2>
          <p className="text-zinc-400 mt-2">Solo administradores pueden gestionar la estructura organizacional.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Estructura Organizacional</h1>
        <p className="text-zinc-400 text-sm mt-1">Gestión de facultades, departamentos y escuelas</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="bg-zinc-900/80 border border-zinc-800 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <Building2 className="w-5 h-5 text-blue-400" />
            <h2 className="text-lg font-semibold text-white">Facultades</h2>
          </div>
          {facultades.map((f) => (
            <div key={f.id} className="border border-zinc-800 rounded p-3 mb-2">
              <div className="font-medium text-white">{f.nombre}</div>
              <div className="text-xs text-zinc-400 mt-1">
                {f._count.departamentos} deptos · {f._count.escuelas} escuelas
              </div>
            </div>
          ))}
        </div>

        <div className="bg-zinc-900/80 border border-zinc-800 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <School className="w-5 h-5 text-green-400" />
            <h2 className="text-lg font-semibold text-white">Departamentos</h2>
          </div>
          {departamentos.map((d) => (
            <div key={d.id} className="border border-zinc-800 rounded p-3 mb-2">
              <div className="font-medium text-white">{d.nombre}</div>
              <div className="text-xs text-zinc-400 mt-1">
                {d._count.docentes} docentes
                {d.director && <span className="ml-2">• Dir: {d.director.nombre}</span>}
              </div>
            </div>
          ))}
        </div>

        <div className="bg-zinc-900/80 border border-zinc-800 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <GraduationCap className="w-5 h-5 text-purple-400" />
            <h2 className="text-lg font-semibold text-white">Escuelas</h2>
          </div>
          {escuelas.map((e) => (
            <div key={e.id} className="border border-zinc-800 rounded p-3 mb-2">
              <div className="font-medium text-white">{e.nombre}</div>
              <div className="text-xs text-zinc-400 mt-1">
                {e._count.curriculas} curriculas
                {e.director && <span className="ml-2">• Dir: {e.director.nombre}</span>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
