'use client';

import { useTRPC } from '@/trpc/client';
import { useQuery } from '@tanstack/react-query';
import { FileCheck, Clock, AlertCircle, CheckCircle, XCircle, RefreshCw } from 'lucide-react';

const ESTADO_BADGES: Record<string, string> = {
  BORRADOR: 'bg-gray-500/20 text-gray-400',
  ENVIADA: 'bg-blue-500/20 text-blue-400',
  APROBADA_DEPARTAMENTO: 'bg-yellow-500/20 text-yellow-400',
  APROBADA_ESCUELA: 'bg-green-500/20 text-green-400',
  RECHAZADA: 'bg-red-500/20 text-red-400',
  FINALIZADA: 'bg-emerald-500/20 text-emerald-400',
};

const ESTADO_ICONS: Record<string, React.ReactNode> = {
  BORRADOR: null,
  ENVIADA: null,
  APROBADA_DEPARTAMENTO: null,
  APROBADA_ESCUELA: null,
  RECHAZADA: null,
  FINALIZADA: null,
};

export default function DeclaracionesPage() {
  const trpc = useTRPC();
  const { data: user } = useQuery({ ...trpc.auth.me.queryOptions() });
  const { data: periodos = [] } = useQuery({ ...trpc.periodo.list.queryOptions() });
  const periodoId = periodos.length > 0 ? periodos[0].id : '';

  const { data: declaraciones = [], isLoading } = useQuery({
    ...trpc.declaracion.list.queryOptions({ periodoId }),
    enabled: !!periodoId,
  });

  const isDirectorDepto = user?.role === 'DIRECTOR_DEPARTAMENTO';
  const isDirectorEscuela = user?.role === 'DIRECTOR_ESCUELA';
  const isDecano = user?.role === 'DECANO';

  const steps = [
    { label: 'Borrador', key: 'BORRADOR' },
    { label: 'Enviada', key: 'ENVIADA' },
    { label: 'Aprob. Depto', key: 'APROBADA_DEPARTAMENTO' },
    { label: 'Aprob. Escuela', key: 'APROBADA_ESCUELA' },
    { label: 'Finalizada', key: 'FINALIZADA' },
  ];

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Declaraciones de Carga</h1>
        <p className="text-zinc-400 text-sm mt-1">Flujo de aprobación de carga académica</p>
      </div>

      {isLoading ? (
        <div className="text-center text-zinc-400 py-12">Cargando...</div>
      ) : (
        <div className="space-y-4">
          {declaraciones.map((dec) => {
            const currentIdx = steps.findIndex((s) => s.key === dec.estado);
            return (
              <div key={dec.id} className="bg-zinc-900/80 border border-zinc-800 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <span className="text-white font-medium">{dec.docente.nombre}</span>
                    <span className="text-zinc-500 text-sm ml-2">{dec.periodo.nombre}</span>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${ESTADO_BADGES[dec.estado] || ''}`}>
                    {dec.estado.replace(/_/g, ' ')}
                  </span>
                </div>

                <div className="flex items-center gap-1 mb-3">
                  {steps.map((step, i) => {
                    const isDone = i <= currentIdx && dec.estado !== 'RECHAZADA';
                    const isCurrent = i === currentIdx;
                    return (
                      <div key={step.key} className="flex items-center flex-1">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] ${
                          dec.estado === 'RECHAZADA' ? 'bg-red-500/20 text-red-400' :
                          isDone ? 'bg-green-500/20 text-green-400' :
                          'bg-zinc-700 text-zinc-500'
                        }`}>
                          {isDone ? '✓' : i + 1}
                        </div>
                        <span className="text-[10px] text-zinc-500 ml-1 hidden sm:inline">{step.label}</span>
                        {i < steps.length - 1 && (
                          <div className={`flex-1 h-0.5 mx-1 ${isDone ? 'bg-green-500/30' : 'bg-zinc-700'}`} />
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="flex items-center gap-2 text-sm text-zinc-400">
                  <span>Lectivas: {dec.totalHorasLectivas}h</span>
                  <span>|</span>
                  <span>No Lectivas: {dec.totalHorasNoLectivas}h</span>
                  <span>|</span>
                  <span className="text-white font-medium">Total: {dec.totalHoras}h</span>
                </div>

                {dec.observaciones && (
                  <div className="mt-2 text-sm text-red-400 bg-red-500/5 border border-red-500/20 rounded p-2">
                    📝 {dec.observaciones}
                  </div>
                )}
              </div>
            );
          })}
          {declaraciones.length === 0 && (
            <div className="bg-zinc-900/80 border border-zinc-800 rounded-lg p-12 text-center text-zinc-500">
              <FileCheck className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>No hay declaraciones de carga para este periodo</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
