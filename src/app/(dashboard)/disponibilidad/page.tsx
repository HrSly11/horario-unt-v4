'use client';

import { useTRPC } from '@/trpc/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Calendar, Save, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';

const DIAS = ['LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO'] as const;
const HORAS = Array.from({ length: 15 }, (_, i) => {
  const h = i + 7;
  return `${String(h).padStart(2, '0')}:00`;
});

export default function DisponibilidadPage() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  const { data: franjas = [], isLoading: loadingFranjas } = useQuery({
    ...trpc.periodo.franjas.queryOptions()
  });

  const { data: currentAvail = [], isLoading: loadingAvail } = useQuery({
    ...trpc.docente.getDisponibilidad.queryOptions(),
  });

  // Effect-like initialization since TanStack Query v5 onSuccess is gone or handled differently
  const [initialized, setInitialized] = useState(false);
  if (!loadingAvail && currentAvail.length > 0 && !initialized) {
    setSelectedIds(new Set(currentAvail.map((d: any) => d.franjaHorariaId)));
    setInitialized(true);
  }

  const saveMutation = useMutation(
    trpc.docente.saveAvailability.mutationOptions({
      onSuccess: () => {
        setMessage({ type: 'success', text: 'Disponibilidad guardada correctamente' });
        queryClient.invalidateQueries({ queryKey: trpc.docente.getDisponibilidad.queryKey() });
        setTimeout(() => setMessage(null), 3000);
      },
      onError: (err) => {
        setMessage({ type: 'error', text: err.message || 'Error al guardar' });
      }
    })
  );

  const toggleFranja = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const handleSave = () => {
    saveMutation.mutate({ franjaIds: Array.from(selectedIds) });
  };

  if (loadingFranjas || loadingAvail) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Calendar className="h-7 w-7 text-indigo-500" />
            Mi Disponibilidad Horaria
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Marca los bloques horarios en los que estás disponible para dictar clases (7:00 AM - 9:00 PM)
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
           <div className="flex items-center gap-2 text-[10px] text-amber-400/80 bg-amber-400/5 px-3 py-1.5 rounded-full border border-amber-400/20">
             <AlertCircle className="h-3 w-3" />
             Si no marca ningún bloque, se considerará disponibilidad completa.
           </div>
           <button
             onClick={handleSave}
             disabled={saveMutation.isPending}
             className="flex items-center gap-2 rounded-lg bg-indigo-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50 shadow-lg shadow-indigo-500/20"
           >
             {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
             Guardar Cambios
           </button>
        </div>
      </div>

      {message && (
        <div className={`mb-6 flex items-center gap-3 rounded-lg p-4 text-sm border ${
          message.type === 'success' 
            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
            : 'bg-red-500/10 text-red-400 border-red-500/20'
        }`}>
          {message.type === 'success' ? <CheckCircle2 className="h-5 w-5" /> : <AlertCircle className="h-5 w-5" />}
          {message.text}
        </div>
      )}

      <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-gray-950/50">
                <th className="p-4 border-b border-r border-gray-800 text-xs font-bold text-gray-500 uppercase">Hora</th>
                {DIAS.map(dia => (
                  <th key={dia} className="p-4 border-b border-gray-800 text-xs font-bold text-gray-400 uppercase tracking-widest">
                    {dia}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {HORAS.map((hora, idx) => (
                <tr key={hora} className="hover:bg-gray-800/20">
                  <td className="p-3 border-r border-b border-gray-800 text-center text-[10px] font-medium text-gray-500 bg-gray-950/20">
                    {hora}
                  </td>
                  {DIAS.map(dia => {
                    const franja = franjas.find(f => f.dia === dia && f.horaInicio === hora);
                    const isSelected = franja && selectedIds.has(franja.id);
                    
                    return (
                      <td 
                        key={`${dia}-${hora}`} 
                        className={`p-1 border-b border-gray-800 transition-all cursor-pointer group ${
                          isSelected ? 'bg-indigo-600/40' : 'hover:bg-indigo-500/10'
                        }`}
                        onClick={() => franja && toggleFranja(franja.id)}
                      >
                        <div className={`h-10 rounded-md flex items-center justify-center border-2 border-transparent transition-all ${
                          isSelected 
                            ? 'border-indigo-400/50 shadow-inner shadow-indigo-400/10' 
                            : 'group-hover:border-indigo-500/20'
                        }`}>
                          {isSelected && <div className="h-2 w-2 rounded-full bg-indigo-400 shadow-lg shadow-indigo-400/50" />}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
