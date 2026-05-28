'use client';

import { useTRPC } from '@/trpc/client';
import { useQuery } from '@tanstack/react-query';
import { BookOpen, Users, Filter } from 'lucide-react';

export default function CargaLectivaPage() {
  const trpc = useTRPC();

  const { data: user } = useQuery({ ...trpc.auth.me.queryOptions() });
  const { data: periodos = [] } = useQuery({ ...trpc.periodo.list.queryOptions() });

  const periodoId = periodos.length > 0 ? periodos[0].id : '';

  const { data: cargasLectivas = [], isLoading } = useQuery({
    ...trpc.cargaLectiva.list.queryOptions({ periodoId }),
    enabled: !!periodoId,
  });

  const { data: docentes = [] } = useQuery({
    ...trpc.docente.list.queryOptions({ search: undefined }),
  });

  if (!user || (user.role !== 'ADMIN' && user.role !== 'SECRETARIA_DEPARTAMENTO' && user.role !== 'DIRECTOR_DEPARTAMENTO')) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-6 text-center">
          <h2 className="text-lg font-semibold text-amber-400">Acceso Restringido</h2>
          <p className="text-zinc-400 mt-2">Solo administradores y secretarias de departamento pueden gestionar la carga lectiva.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Gestión de Carga Lectiva</h1>
        <p className="text-zinc-400 text-sm mt-1">Asignación de cursos a docentes por departamento</p>
      </div>

      {isLoading ? (
        <div className="text-center text-zinc-400 py-12">Cargando...</div>
      ) : (
        <div className="bg-zinc-900/80 border border-zinc-800 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-zinc-800">
              <tr>
                <th className="text-left p-3 text-zinc-400 font-medium">Docente</th>
                <th className="text-left p-3 text-zinc-400 font-medium">Curso</th>
                <th className="text-left p-3 text-zinc-400 font-medium">Grupo</th>
                <th className="text-left p-3 text-zinc-400 font-medium">Tipo</th>
                <th className="text-center p-3 text-zinc-400 font-medium">Horas</th>
                <th className="text-center p-3 text-zinc-400 font-medium">Compartido</th>
              </tr>
            </thead>
            <tbody>
              {cargasLectivas.map((carga) => (
                <tr key={carga.id} className="border-t border-zinc-800 hover:bg-zinc-800/50">
                  <td className="p-3 text-white">{carga.docente.nombre}</td>
                  <td className="p-3 text-zinc-300">{carga.grupo.curso.codigo} - {carga.grupo.curso.nombre}</td>
                  <td className="p-3 text-zinc-300">{carga.grupo.nombre}</td>
                  <td className="p-3">
                    <span className="px-2 py-0.5 rounded text-xs bg-blue-500/20 text-blue-400">
                      {carga.tipo}
                    </span>
                  </td>
                  <td className="p-3 text-center text-white">{carga.horasAsignadas}h</td>
                  <td className="p-3 text-center">
                    {carga.compartido ? (
                      <span className="text-purple-400 text-xs">Con {carga.docenteCompartido?.nombre}</span>
                    ) : (
                      <span className="text-zinc-600">—</span>
                    )}
                  </td>
                </tr>
              ))}
              {cargasLectivas.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-zinc-500">No hay asignaciones de carga lectiva</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
