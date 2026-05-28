'use client';

import { useMemo } from 'react';

const DIAS = ['LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO'];
const LABEL_DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const HORAS = Array.from({ length: 15 }, (_, i) => `${(7 + i).toString().padStart(2, '0')}:00`);

interface Slot {
  dia: string;
  horaInicio: string;
  ocupado: boolean;
  tipo?: string;
  label?: string;
  color?: string;
  readonly?: boolean;
  onClick?: () => void;
}

interface WeeklyGridProps {
  slots: Slot[];
  dailyTotals: Record<string, number>;
}

const TYPE_COLORS: Record<string, string> = {
  TEORIA: 'bg-blue-100 border-blue-400 text-blue-800',
  PRACTICA: 'bg-green-100 border-green-400 text-green-800',
  LABORATORIO: 'bg-purple-100 border-purple-400 text-purple-800',
  PREPARACION_EVALUACION: 'bg-yellow-100 border-yellow-400 text-yellow-800',
  CONSEJERIA: 'bg-pink-100 border-pink-400 text-pink-800',
  INVESTIGACION: 'bg-indigo-100 border-indigo-400 text-indigo-800',
  CAPACITACION: 'bg-orange-100 border-orange-400 text-orange-800',
  GOBIERNO: 'bg-red-100 border-red-400 text-red-800',
  ADMINISTRACION: 'bg-gray-200 border-gray-400 text-gray-800',
  ASESORIA_TESIS: 'bg-teal-100 border-teal-400 text-teal-800',
  RESPONSABILIDAD_SOCIAL: 'bg-lime-100 border-lime-400 text-lime-800',
  COMITES_COMISIONES: 'bg-cyan-100 border-cyan-400 text-cyan-800',
};

export function WeeklyGrid({ slots, dailyTotals }: WeeklyGridProps) {
  const slotMap = useMemo(() => {
    const map = new Map<string, Slot>();
    slots.forEach((s) => map.set(`${s.dia}-${s.horaInicio}`, s));
    return map;
  }, [slots]);

  return (
    <div className="overflow-x-auto border rounded-lg">
      <div className="grid grid-cols-[60px_repeat(6,1fr)] min-w-[700px]">
        <div className="border p-1 bg-gray-50 font-bold text-xs text-center"></div>
        {LABEL_DIAS.map((d, i) => (
          <div key={d} className={`border p-2 bg-gray-50 font-bold text-xs text-center ${i === 5 ? 'bg-yellow-50' : ''}`}>
            {d}
            {dailyTotals[DIAS[i]] > 0 && (
              <span className={`block text-[10px] font-normal ${dailyTotals[DIAS[i]] > 8 ? 'text-red-600' : 'text-green-600'}`}>
                {dailyTotals[DIAS[i]]}h
              </span>
            )}
          </div>
        ))}

        {HORAS.map((hora) => (
          <div key={hora} className="contents">
            <div className="border p-1 bg-gray-50 text-[10px] text-center text-gray-500">{hora}</div>
            {DIAS.map((dia) => {
              const key = `${dia}-${hora}`;
              const slot = slotMap.get(key);
              const colorClass = slot?.tipo ? TYPE_COLORS[slot.tipo] || 'bg-gray-50 border-gray-200' : 'bg-gray-50 border-gray-200';
              return (
                <div
                  key={key}
                  className={`border p-1 min-h-[28px] cursor-pointer transition-colors hover:opacity-80 text-[9px] leading-tight ${
                    slot?.ocupado ? colorClass : 'bg-gray-50 border-gray-200'
                  } ${slot?.readonly ? 'opacity-60 cursor-default' : ''}`}
                  onClick={slot?.readonly ? undefined : slot?.onClick}
                  title={slot?.label || ''}
                >
                  {slot?.ocupado && <span className="truncate block">{slot?.label}</span>}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
