'use client';

import { useTRPC } from '@/trpc/client';
import { useQuery } from '@tanstack/react-query';
import { ClipboardList, PieChart } from 'lucide-react';

const TIPO_LABELS: Record<string, string> = {
  PREPARACION_EVALUACION: 'Preparación y Evaluación',
  CONSEJERIA: 'Consejería',
  INVESTIGACION: 'Investigación',
  CAPACITACION: 'Capacitación',
  GOBIERNO: 'Gobierno',
  ADMINISTRACION: 'Administración',
  ASESORIA_TESIS: 'Asesoría de Tesis',
  RESPONSABILIDAD_SOCIAL: 'Resp. Social',
  COMITES_COMISIONES: 'Comités/Comisiones',
};

export default function CargaNoLectivaPage() {
  const trpc = useTRPC();

  const { data: user } = useQuery({ ...trpc.auth.me.queryOptions() });
  const { data: periodos = [] } = useQuery({ ...trpc.periodo.list.queryOptions() });

  const periodoId = periodos.length > 0 ? periodos[0].id : '';
  const docenteId = user?.docenteId || '';

  const { data: cargaData } = useQuery({
    ...trpc.cargaNoLectiva.byDocente.queryOptions({ docenteId, periodoId }),
    enabled: !!docenteId && !!periodoId,
  });

  const { data: cargasNoLectivas = [] } = useQuery({
    ...trpc.cargaNoLectiva.list.queryOptions({ docenteId, periodoId }),
    enabled: !!docenteId && !!periodoId,
  });

  const { data: docente } = useQuery({
    ...trpc.docente.byId.queryOptions({ id: docenteId }),
    enabled: !!docenteId,
  });

  if (!docenteId) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-6 text-center">
          <h2 className="text-lg font-semibold text-amber-400">Acceso Restringido</h2>
          <p className="text-zinc-400 mt-2">Solo los docentes pueden gestionar su carga no lectiva.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Carga No Lectiva</h1>
        <p className="text-zinc-400 text-sm mt-1">Registra tus actividades complementarias</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-zinc-900/80 border border-zinc-800 rounded-lg p-4">
          <div className="text-zinc-400 text-sm mb-1">Lectivas</div>
          <div className="text-2xl font-bold text-white">{cargaData?.totalLectivas || 0}h</div>
        </div>
        <div className="bg-zinc-900/80 border border-zinc-800 rounded-lg p-4">
          <div className="text-zinc-400 text-sm mb-1">No Lectivas</div>
          <div className="text-2xl font-bold text-white">{cargaData?.totalNoLectivas || 0}h</div>
        </div>
        <div className="bg-zinc-900/80 border border-zinc-800 rounded-lg p-4">
          <div className="text-zinc-400 text-sm mb-1">Contrato ({docente?.modalidad})</div>
          <div className="text-2xl font-bold text-blue-400">{docente?.horasContrato || 0}h</div>
        </div>
      </div>

      {cargaData && (
        <div className="h-3 bg-zinc-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-green-500 transition-all"
            style={{ width: `${Math.min(100, ((cargaData.totalLectivas + cargaData.totalNoLectivas) / (docente?.horasContrato || 40)) * 100)}%` }}
          />
        </div>
      )}

      <div className="bg-zinc-900/80 border border-zinc-800 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-zinc-800">
            <tr>
              <th className="text-left p-3 text-zinc-400 font-medium">Actividad</th>
              <th className="text-center p-3 text-zinc-400 font-medium">Horas</th>
              <th className="text-left p-3 text-zinc-400 font-medium">Descripción</th>
              <th className="text-left p-3 text-zinc-400 font-medium">Detalles</th>
            </tr>
          </thead>
          <tbody>
            {cargasNoLectivas.map((carga) => (
              <tr key={carga.id} className="border-t border-zinc-800 hover:bg-zinc-800/50">
                <td className="p-3 text-white">{TIPO_LABELS[carga.tipo] || carga.tipo}</td>
                <td className="p-3 text-center text-white font-mono">{carga.horas}h</td>
                <td className="p-3 text-zinc-400">{carga.descripcion || '—'}</td>
                <td className="p-3 text-zinc-500 text-xs">
                  {carga.codigoProyecto && <div>Proyecto: {carga.codigoProyecto}</div>}
                  {carga.numAlumnos && <div>Alumnos: {carga.numAlumnos}</div>}
                  {carga.cicloConsejeria && <div>Ciclo: {carga.cicloConsejeria}</div>}
                </td>
              </tr>
            ))}
            {cargasNoLectivas.length === 0 && (
              <tr>
                <td colSpan={4} className="p-6 text-center text-zinc-500">No hay actividades no lectivas registradas</td>
              </tr>
            )}
            {cargasNoLectivas.length > 0 && (
              <tr className="border-t-2 border-zinc-700 bg-zinc-800/30">
                <td className="p-3 font-bold text-white">Total</td>
                <td className="p-3 text-center font-bold text-white font-mono">{cargaData?.totalNoLectivas}h</td>
                <td colSpan={2}></td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
