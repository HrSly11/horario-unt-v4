'use client';

import { useTRPC } from '@/trpc/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Calendar, Save, Loader2, CheckCircle2, AlertCircle, BookOpen, ChevronDown, Clock, FlaskConical, Presentation, Users } from 'lucide-react';

const DIAS = ['LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO'] as const;
const HORAS = Array.from({ length: 15 }, (_, i) => {
  const h = i + 7;
  return `${String(h).padStart(2, '0')}:00`;
});

const TIPO_LABELS = {
  TEORIA: { label: 'Teoría', icon: Presentation, color: 'text-blue-400', bg: 'bg-blue-400/10', border: 'border-blue-400/20' },
  PRACTICA: { label: 'Práctica', icon: Users, color: 'text-emerald-400', bg: 'bg-emerald-400/10', border: 'border-emerald-400/20' },
  LABORATORIO: { label: 'Laboratorio', icon: FlaskConical, color: 'text-amber-400', bg: 'bg-amber-400/10', border: 'border-amber-400/20' },
};

export default function DisponibilidadPage() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [selectedGrupoId, setSelectedGrupoId] = useState<string>('');
  const [selectedTipo, setSelectedTipo] = useState<'TEORIA' | 'PRACTICA' | 'LABORATORIO'>('TEORIA');

  const { data: user } = useQuery({ ...trpc.auth.me.queryOptions() });
  const docenteId = user?.docenteId || '';

  const { data: periodos = [] } = useQuery({
    ...trpc.periodo.list.queryOptions(),
  });

  const activePeriodo = periodos.find(p => p.activo) || (periodos.length > 0 ? periodos[0] : null);

  const { data: cargaLectiva } = useQuery({
    ...trpc.cargaLectiva.byDocente.queryOptions({
      docenteId,
      periodoId: activePeriodo?.id || '',
    }),
    enabled: !!docenteId && !!activePeriodo?.id,
  });

  const { data: franjas = [], isLoading: loadingFranjas } = useQuery({
    ...trpc.periodo.franjas.queryOptions()
  });

  const { data: currentAvail = [], isLoading: loadingAvail } = useQuery({
    ...trpc.docente.getDisponibilidad.queryOptions({
      periodoId: activePeriodo?.id,
      grupoId: selectedGrupoId || undefined,
      tipo: selectedGrupoId ? selectedTipo : undefined,
    }),
    enabled: !!activePeriodo?.id,
  });

  // Effect-like initialization
  const [initializedMap, setInitializedMap] = useState<Record<string, boolean>>({});
  
  const currentKey = `${selectedGrupoId || 'general'}-${selectedGrupoId ? selectedTipo : 'none'}`;
  if (!loadingAvail && !initializedMap[currentKey]) {
    setSelectedIds(new Set(currentAvail.map((d: any) => d.franjaHorariaId)));
    setInitializedMap(prev => ({ ...prev, [currentKey]: true }));
  }

  const saveMutation = useMutation(
    trpc.docente.saveAvailability.mutationOptions({
      onSuccess: () => {
        setMessage({ type: 'success', text: `Sugerencia de ${selectedTipo.toLowerCase()} guardada correctamente` });
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
    saveMutation.mutate({ 
      franjaIds: Array.from(selectedIds),
      grupoId: selectedGrupoId || undefined,
      tipo: selectedGrupoId ? selectedTipo : undefined,
      periodoId: activePeriodo?.id
    });
  };

  const handleSelectionChange = (grupoId: string, tipo: 'TEORIA' | 'PRACTICA' | 'LABORATORIO') => {
    setSelectedGrupoId(grupoId);
    setSelectedTipo(tipo);
    const key = `${grupoId}-${tipo}`;
    setInitializedMap(prev => ({ ...prev, [key]: false }));
  };

  if (loadingFranjas || (loadingAvail && !initializedMap[currentKey])) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  const assignedCursos = cargaLectiva?.asignaciones || [];
  // Group by group
  const groupedCursos = assignedCursos.reduce((acc: any, asig: any) => {
    if (!acc[asig.grupoId]) {
      acc[asig.grupoId] = {
        grupo: asig.grupo,
        tipos: [],
      };
    }
    acc[asig.grupoId].tipos.push({
      tipo: asig.tipo,
      horas: asig.horasAsignadas,
    });
    return acc;
  }, {});

  const selectedCarga = assignedCursos.find(a => a.grupoId === selectedGrupoId && a.tipo === selectedTipo);

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Calendar className="h-7 w-7 text-indigo-500" />
            Sugerencia de Horario Detallada
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Propón los horarios para cada curso y tipo de hora (Teoría, Práctica, Laboratorio)
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
           <button
             onClick={handleSave}
             disabled={saveMutation.isPending || !activePeriodo || !selectedGrupoId}
             className="flex items-center gap-2 rounded-lg bg-indigo-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50 shadow-lg shadow-indigo-500/20 w-full md:w-auto justify-center"
           >
             {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
             Guardar Sugerencia de {TIPO_LABELS[selectedTipo]?.label || ''}
           </button>
        </div>
      </div>

      {/* Selector de Curso y Tipo */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 mb-8 shadow-xl">
        <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-indigo-400" />
          Tus cursos y horas asignadas
        </label>
        <div className="space-y-4">
          {Object.values(groupedCursos).map((groupInfo: any) => (
            <div key={groupInfo.grupo.id} className="bg-gray-800/20 border border-gray-800 rounded-xl p-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                <div>
                  <h3 className="text-white font-bold">{groupInfo.grupo.curso.nombre}</h3>
                  <p className="text-xs text-gray-500 font-medium">{groupInfo.grupo.curso.codigo} • Grupo {groupInfo.grupo.nombre}</p>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {groupInfo.tipos.map((t: any) => {
                  const config = TIPO_LABELS[t.tipo as keyof typeof TIPO_LABELS];
                  const Icon = config.icon;
                  const isSelected = selectedGrupoId === groupInfo.grupo.id && selectedTipo === t.tipo;

                  return (
                    <button
                      key={t.tipo}
                      onClick={() => handleSelectionChange(groupInfo.grupo.id, t.tipo)}
                      className={`flex items-center justify-between p-3 rounded-lg border-2 transition-all ${
                        isSelected
                          ? `bg-indigo-600/20 border-indigo-500 shadow-lg shadow-indigo-500/10`
                          : `bg-gray-800/40 border-gray-700 hover:border-gray-600`
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-md ${config.bg} ${config.color}`}>
                          <Icon size={16} />
                        </div>
                        <div className="flex flex-col text-left">
                          <span className={`text-xs font-bold ${isSelected ? 'text-white' : 'text-gray-300'}`}>
                            {config.label}
                          </span>
                          <span className="text-[10px] text-gray-500 font-bold uppercase">
                            {t.horas} horas
                          </span>
                        </div>
                      </div>
                      {isSelected && <CheckCircle2 size={16} className="text-indigo-400" />}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          {Object.keys(groupedCursos).length === 0 && (
            <div className="py-12 text-center bg-gray-800/20 border-2 border-dashed border-gray-800 rounded-2xl">
              <AlertCircle className="h-10 w-10 text-gray-700 mx-auto mb-3" />
              <p className="text-gray-500 font-medium">No tienes cursos asignados para este periodo</p>
            </div>
          )}
        </div>
      </div>

      {selectedGrupoId ? (
        <>
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
            <div className="px-6 py-5 bg-gray-950/50 border-b border-gray-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className={`p-2.5 rounded-xl ${TIPO_LABELS[selectedTipo].bg} ${TIPO_LABELS[selectedTipo].color} border ${TIPO_LABELS[selectedTipo].border}`}>
                   {(() => {
                     const Icon = TIPO_LABELS[selectedTipo].icon;
                     return <Icon size={20} />;
                   })()}
                </div>
                <div>
                  <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                    Sugerencia para {TIPO_LABELS[selectedTipo].label}
                  </h2>
                  <p className="text-[10px] text-gray-500 font-bold uppercase mt-0.5">
                    {assignedCursos.find(a => a.grupoId === selectedGrupoId)?.grupo.curso.nombre}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-6">
                <div className="flex flex-col items-end">
                   <span className="text-[10px] text-gray-500 font-black uppercase tracking-widest mb-1">Estado de horas</span>
                   <div className="flex items-center gap-2">
                     <span className={`text-sm font-black ${selectedIds.size === selectedCarga?.horasAsignadas ? 'text-emerald-400' : 'text-indigo-400'}`}>
                       {selectedIds.size} / {selectedCarga?.horasAsignadas || 0}
                     </span>
                     <div className="h-1.5 w-24 bg-gray-800 rounded-full overflow-hidden">
                        <div 
                          className={`h-full transition-all duration-500 ${selectedIds.size === selectedCarga?.horasAsignadas ? 'bg-emerald-500' : 'bg-indigo-500'}`}
                          style={{ width: `${Math.min(100, (selectedIds.size / (selectedCarga?.horasAsignadas || 1)) * 100)}%` }}
                        />
                     </div>
                   </div>
                </div>
              </div>
            </div>
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
        </>
      ) : Object.keys(groupedCursos).length > 0 ? (
        <div className="flex flex-col items-center justify-center py-20 bg-gray-900/50 border-2 border-dashed border-gray-800 rounded-3xl">
          <BookOpen className="h-12 w-12 text-gray-700 mb-4" />
          <p className="text-gray-400 font-medium">Selecciona un tipo de hora de tus cursos arriba para comenzar</p>
        </div>
      ) : null}
    </div>
  );
}
