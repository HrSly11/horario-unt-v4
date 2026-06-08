'use client';

import { useTRPC } from '@/trpc/client';
import { useQuery, useMutation } from '@tanstack/react-query';
import { History, User as UserIcon, Calendar, Clock, FileDown } from 'lucide-react';

export default function BitacoraPage() {
  const trpc = useTRPC();
  const { data, isLoading } = useQuery({ ...trpc.auth.getLogs.queryOptions() });
  const logs = (data as any[]) || [];

  const downloadBase64PDF = (base64: string, filename: string) => {
    const link = document.createElement('a');
    link.href = `data:application/pdf;base64,${base64}`;
    link.download = filename;
    link.click();
  };

  const generateReportMutation = useMutation(
    trpc.reporte.generateAuditReport.mutationOptions({
      onSuccess: (data) => downloadBase64PDF(data.pdf, data.filename),
      onError: () => alert('Error al generar el reporte PDF'),
    })
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Bitácora del Sistema</h1>
          <p className="text-sm text-gray-500 mt-1">Registro de accesos y actividades críticas de los usuarios</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => generateReportMutation.mutate()}
            disabled={generateReportMutation.isPending}
            className="flex items-center gap-2 rounded-xl bg-gray-800 px-4 py-2 text-sm font-bold text-white hover:bg-gray-700 transition-all border border-gray-700 shadow-lg"
          >
            {generateReportMutation.isPending ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : (
              <FileDown className="h-4 w-4" />
            )}
            Descargar Reporte PDF
          </button>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-900 border border-gray-800">
            <History className="h-5 w-5 text-gray-400" />
          </div>
        </div>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-900/50 border-b border-gray-800">
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Usuario</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Acción</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Detalles</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Fecha y Hora</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-gray-500">
                    No hay registros en la bitácora aún.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-800/40 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-lg bg-indigo-500/10 flex items-center justify-center">
                          <UserIcon className="h-4 w-4 text-indigo-400" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-white">{log.user?.nombre || 'Sistema'}</p>
                          <p className="text-[10px] text-gray-500">{log.user?.email || '-'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider border ${
                        log.accion === 'LOGIN' 
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                          : 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'
                      }`}>
                        {log.accion}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm text-gray-300 max-w-md truncate">{log.detalles}</p>
                    </td>
                    <td className="px-6 py-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5 text-xs text-gray-400">
                          <Calendar className="h-3 w-3" />
                          {new Date(log.createdAt).toLocaleDateString()}
                        </div>
                        <div className="flex items-center gap-1.5 text-[11px] text-gray-500">
                          <Clock className="h-3 w-3" />
                          {new Date(log.createdAt).toLocaleTimeString()}
                        </div>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
