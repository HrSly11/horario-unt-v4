'use client';

import { useTRPC } from '@/trpc/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import {
  User,
  Calendar,
  CheckCircle2,
  TrendingUp,
  AlertTriangle,
  Edit,
  Trash2,
  X,
  Save,
  Plus,
  Clock,
  MapPin,
  GripVertical,
  Building2,
  Layers,
  ChevronRight,
  Info,
  AlertCircle,
} from 'lucide-react';

const DIAS = ['LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO'];
const DIA_LABELS: Record<string, string> = {
  LUNES: 'Lun', MARTES: 'Mar', MIERCOLES: 'Mié',
  JUEVES: 'Jue', VIERNES: 'Vie', SABADO: 'Sáb',
};

const SLOT_COLORS = [
  'bg-primary/10 border-primary/20 text-primary',
  'bg-info/10 border-info/20 text-info',
  'bg-success/10 border-success/20 text-success',
  'bg-warning/10 border-warning/20 text-warning',
  'bg-danger/10 border-danger/20 text-danger',
  'bg-secondary/10 border-secondary/20 text-secondary',
  'bg-blue-100 border-blue-200 text-blue-900',
  'bg-purple-100 border-purple-200 text-purple-900',
  'bg-rose-100 border-rose-200 text-rose-900',
  'bg-teal-100 border-teal-200 text-teal-900',
  'bg-orange-100 border-orange-200 text-orange-900',
  'bg-lime-100 border-lime-200 text-lime-900',
  'bg-pink-100 border-pink-200 text-pink-900',
  'bg-violet-100 border-violet-200 text-violet-900',
  'bg-fuchsia-100 border-fuchsia-200 text-fuchsia-900',
  'bg-sky-100 border-sky-200 text-sky-900',
];

const TIPO_COLORS: Record<string, string> = {
  TEORIA: 'bg-sky-100 text-sky-800 border-sky-200',
  PRACTICA: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  LABORATORIO: 'bg-amber-100 text-amber-800 border-amber-200',
};

type HorarioAsignacion = {
  id: string;
  tipo: 'TEORIA' | 'PRACTICA' | 'LABORATORIO';
  confirmado: boolean;
  docenteId?: string;
  grupo: {
    nombre: string;
    curso: { id: string; codigo: string; nombre: string; ciclo: number };
  };
  docente?: { nombre: string; tipo: string; categoria: string };
  aula?: { id: string; codigo: string; nombre: string; tipo: string };
  franjaHoraria: { id: string; dia: string; horaInicio: string; horaFin: string };
};

type AulaOption = {
  id: string;
  codigo: string;
  nombre: string;
  tipo: string;
  capacidad?: number;
  edificio?: string;
};

type FranjaOption = {
  id: string;
  dia: string;
  horaInicio: string;
  horaFin: string;
};

import { type ManualScheduleOption, resolveManualOptionStatus } from './utils';

// ─── Drop Error Toast ──────────────────────────────────────────────────────────
function DropErrorToast({ message, onClose }: { message: string; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 4000);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <div
      className="fixed bottom-6 right-6 z-[100] flex items-start gap-3 rounded-2xl border border-danger/30 bg-white px-5 py-4 shadow-2xl max-w-sm animate-slide-in-top"
      style={{ animation: 'slideInRight 0.3s ease-out' }}
    >
      <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-danger/10">
        <AlertCircle className="h-5 w-5 text-danger" />
      </div>
      <div className="flex-1">
        <p className="text-sm font-bold text-text-main">Aula no disponible</p>
        <p className="mt-0.5 text-xs text-text-sub">{message}</p>
      </div>
      <button onClick={onClose} className="rounded-lg p-1 text-text-sub hover:bg-slate-100 transition-colors">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

// ─── Drop Success Toast ────────────────────────────────────────────────────────
function DropSuccessToast({ message, onClose }: { message: string; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3000);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <div className="fixed bottom-6 right-6 z-[100] flex items-start gap-3 rounded-2xl border border-success/30 bg-white px-5 py-4 shadow-2xl max-w-sm">
      <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-success/10">
        <CheckCircle2 className="h-5 w-5 text-success" />
      </div>
      <div>
        <p className="text-sm font-bold text-text-main">Bloque asignado</p>
        <p className="mt-0.5 text-xs text-text-sub">{message}</p>
      </div>
    </div>
  );
}

// ─── Draggable Carga Card ──────────────────────────────────────────────────────
function DraggableCargaCard({
  option,
  isSelected,
  isBeingDragged,
  canEdit,
  onSelect,
  onDragStart,
  onDragEnd,
}: {
  option: ManualScheduleOption;
  isSelected: boolean;
  isBeingDragged: boolean;
  canEdit: boolean;
  onSelect: () => void;
  onDragStart: () => void;
  onDragEnd: () => void;
}) {
  const status = resolveManualOptionStatus(option);
  const isComplete = option.remainingBlocks <= 0;

  return (
    <div
      draggable={!isComplete && canEdit}
      onDragStart={(e) => {
        if (isComplete || !canEdit) {
          e.preventDefault();
          return;
        }
        e.dataTransfer.effectAllowed = 'move';
        onDragStart();
        onSelect();
      }}
      onDragEnd={onDragEnd}
      onClick={() => { if (!isComplete && canEdit) onSelect(); }}
      className={`
        rounded-xl border p-3 transition-all select-none
        ${isComplete ? 'opacity-50 cursor-not-allowed bg-slate-50' : canEdit ? 'cursor-grab active:cursor-grabbing hover:shadow-md' : 'cursor-not-allowed opacity-60'}
        ${isBeingDragged ? 'opacity-40 scale-95' : ''}
        ${isSelected && !isComplete ? 'border-primary bg-primary/5 ring-2 ring-primary/15 shadow-sm' : 'border-border bg-white hover:border-slate-300'}
      `}
    >
      <div className="flex items-start gap-2.5">
        {!isComplete && canEdit && (
          <GripVertical className="h-4 w-4 text-slate-400 mt-0.5 flex-shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-1 mb-1.5">
            <div className="min-w-0">
              <p className="text-xs font-black text-text-main truncate leading-tight">
                {option.curso.codigo}
              </p>
              <p className="text-[10px] text-text-sub font-medium truncate leading-snug mt-0.5">
                {option.curso.nombre}
              </p>
            </div>
            <span className={`text-[9px] font-bold border px-1.5 py-0.5 rounded-full whitespace-nowrap flex-shrink-0 ${TIPO_COLORS[option.tipo] || 'bg-slate-100 text-slate-700 border-slate-200'}`}>
              {option.tipo}
            </span>
          </div>
          <div className="flex items-center justify-between mt-2">
            <div className="flex gap-1 flex-wrap">
              <span className="text-[9px] font-bold bg-slate-100 text-text-sub px-1.5 py-0.5 rounded-full">
                G-{option.grupoNombre}
              </span>
              {option.grupoLaboratorio && (
                <span className="text-[9px] font-bold bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded-full">
                  Lab {option.grupoLaboratorio}
                </span>
              )}
            </div>
            <span className={status.badgeClass + ' text-[9px]'}>{status.label}</span>
          </div>
          {isSelected && !isComplete && (
            <div className="mt-2 flex items-center gap-1 text-[9px] text-primary font-bold">
              <GripVertical className="h-3 w-3" />
              Arrastra al horario para asignar
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Calendar Drop Cell ────────────────────────────────────────────────────────
type SlotStatus = 'LIBRE' | 'OCUPADO' | 'MANTENIMIENTO' | 'FERIADO' | 'DOCENTE_OCUPADO' | 'ALMUERZO_REQUERIDO' | 'MAX_HORAS_EXCEDIDO' | 'RESTRICCION_DOCENTE';

type AvailabilityCell = {
  franjaId: string;
  dia: string;
  horaInicio: string;
  horaFin: string;
  status: SlotStatus;
  ocupadoPor?: {
    cursoNombre: string;
    cursoCodigo: string;
    grupoNombre: string;
    docenteNombre: string;
  };
};

function CalendarDropCell({
  dia,
  hora,
  horaFin,
  franjaId,
  availability,
  filterAulaId,
  existingAsignacion,
  isDragActive,
  isDragOver,
  canEdit,
  colorClass,
  onDragOver,
  onDragLeave,
  onDrop,
  onEditClick,
  onDeleteClick,
}: {
  dia: string;
  hora: string;
  horaFin?: string;
  franjaId: string;
  availability: AvailabilityCell | undefined;
  filterAulaId: string;
  existingAsignacion: HorarioAsignacion | undefined;
  isDragActive: boolean;
  isDragOver: boolean;
  canEdit: boolean;
  colorClass: string;
  onDragOver: (e: React.DragEvent, franjaId: string) => void;
  onDragLeave: () => void;
  onDrop: (franjaId: string, dia: string) => void;
  onEditClick: (a: HorarioAsignacion) => void;
  onDeleteClick: (id: string) => void;
}) {
  const hasFilteredAula = !!filterAulaId;
  const slotStatus = availability?.status;

  let cellBg = '';
  let cellBorder = '';
  let dropCursor = '';
  let isDroppable = false;

  if (existingAsignacion) {
    cellBg = colorClass;
    cellBorder = 'border-current/10';
  } else if (!isDragActive) {
    cellBg = 'bg-white';
    cellBorder = 'border-transparent';
  } else if (!hasFilteredAula) {
    cellBg = isDragOver ? 'bg-slate-100' : 'bg-white';
    cellBorder = isDragOver ? 'border-slate-300 border-dashed' : 'border-transparent';
    dropCursor = 'cursor-pointer';
    isDroppable = true;
  } else {
    if (slotStatus === 'LIBRE') {
      cellBg = isDragOver ? 'bg-success/20' : 'bg-success/8';
      cellBorder = isDragOver ? 'border-success border-2' : 'border-success/30 border-dashed';
      dropCursor = 'cursor-copy';
      isDroppable = true;
    } else if (slotStatus === 'OCUPADO' || slotStatus === 'MANTENIMIENTO') {
      cellBg = 'bg-danger/5';
      cellBorder = 'border-danger/20 border-dashed';
      dropCursor = 'cursor-not-allowed';
      isDroppable = false;
    } else if (slotStatus === 'DOCENTE_OCUPADO' || slotStatus === 'RESTRICCION_DOCENTE' || slotStatus === 'MAX_HORAS_EXCEDIDO' || slotStatus === 'ALMUERZO_REQUERIDO') {
      cellBg = 'bg-warning/5';
      cellBorder = 'border-warning/20 border-dashed';
      dropCursor = 'cursor-not-allowed';
      isDroppable = false;
    } else {
      cellBg = isDragOver ? 'bg-success/10' : 'bg-slate-50/50';
      cellBorder = 'border-slate-200/50 border-dashed';
      dropCursor = 'cursor-copy';
      isDroppable = true;
    }
  }

  const tooltipText = availability?.ocupadoPor
    ? `${availability.ocupadoPor.cursoCodigo} - ${availability.ocupadoPor.cursoNombre} (${availability.ocupadoPor.docenteNombre})`
    : slotStatus === 'MANTENIMIENTO'
    ? 'Aula en mantenimiento'
    : slotStatus === 'DOCENTE_OCUPADO'
    ? 'Docente ya tiene clase a esta hora'
    : slotStatus === 'RESTRICCION_DOCENTE'
    ? 'Restricción del docente en este horario'
    : '';

  return (
    <td
      className="px-1 py-1"
      onDragOver={(e) => { e.preventDefault(); if (isDragActive) onDragOver(e, franjaId); }}
      onDragLeave={onDragLeave}
      onDrop={(e) => {
        e.preventDefault();
        if (!isDragActive) return;
        if (!isDroppable && hasFilteredAula && slotStatus && slotStatus !== 'LIBRE') return;
        onDrop(franjaId, dia);
      }}
    >
      {existingAsignacion ? (
        <div
          onClick={() => canEdit && onEditClick(existingAsignacion)}
          title={`${existingAsignacion.grupo.curso.nombre} — ${existingAsignacion.aula?.codigo || 'sin aula'}`}
          className={`p-2 rounded-xl border flex flex-col justify-center min-h-[62px] shadow-sm transition-all hover:scale-[1.02] cursor-pointer ${colorClass} ${!existingAsignacion.confirmado ? 'border-dashed ring-2 ring-primary/20' : 'border-current/10'}`}
        >
          <div className="flex items-center justify-between gap-1 mb-1">
            <p className="font-black text-[10px] leading-tight truncate">
              {existingAsignacion.grupo.curso.codigo}
            </p>
            <div className="flex items-center gap-1.5 shrink-0">
              {!existingAsignacion.confirmado && <span className="text-[7px] bg-white/40 px-1 rounded-sm font-black animate-pulse">SUG</span>}
              {canEdit && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm('¿Eliminar esta asignación?')) {
                      onDeleteClick(existingAsignacion.id);
                    }
                  }}
                  className="rounded p-0.5 hover:bg-black/10 transition-colors text-current opacity-70 hover:opacity-100"
                  title="Eliminar asignación"
                >
                  <Trash2 className="h-2.5 w-2.5" />
                </button>
              )}
              {canEdit && <Edit className="h-2.5 w-2.5 opacity-70" />}
            </div>
          </div>
          <p className="text-[9px] font-bold opacity-80 truncate leading-tight">{existingAsignacion.grupo.curso.nombre}</p>
          <div className="mt-1.5 flex items-center justify-between opacity-70 text-[8px] font-black uppercase tracking-tighter">
            <span className="bg-white/20 px-1 rounded">G{existingAsignacion.grupo.nombre}</span>
            <span className="flex items-center gap-0.5">
              <Building2 className="h-2 w-2" />
              {existingAsignacion.aula?.codigo || '—'}
            </span>
          </div>
        </div>
      ) : (
        <div
          title={tooltipText}
          className={`
            rounded-xl border flex flex-col items-center justify-center min-h-[62px] transition-all
            ${cellBg} ${cellBorder} ${dropCursor}
            ${isDragOver && isDroppable ? 'scale-[1.03] shadow-md' : ''}
          `}
        >
          {isDragActive && hasFilteredAula && slotStatus === 'LIBRE' && (
            <div className="flex flex-col items-center gap-0.5 py-2">
              <Plus className="h-3.5 w-3.5 text-success opacity-80" />
              <span className="text-[8px] font-bold text-success/80">Soltar aquí</span>
            </div>
          )}
          {isDragActive && hasFilteredAula && (slotStatus === 'OCUPADO') && (
            <div className="flex flex-col items-center gap-0.5 py-1 px-1 text-center">
              <AlertCircle className="h-3 w-3 text-danger/70" />
              <span className="text-[8px] font-bold text-danger/70 leading-tight">Ocupado</span>
              {availability?.ocupadoPor && (
                <span className="text-[7px] text-danger/60 font-medium leading-tight truncate max-w-[60px]">
                  {availability.ocupadoPor.cursoCodigo}
                </span>
              )}
            </div>
          )}
          {isDragActive && hasFilteredAula && slotStatus === 'MANTENIMIENTO' && (
            <div className="flex flex-col items-center gap-0.5 py-1">
              <AlertCircle className="h-3 w-3 text-slate-400" />
              <span className="text-[8px] font-bold text-slate-400">Mantenim.</span>
            </div>
          )}
          {isDragActive && !hasFilteredAula && isDragOver && (
            <div className="flex flex-col items-center gap-0.5 py-2 px-1">
              <Info className="h-3 w-3 text-slate-400" />
              <span className="text-[8px] text-slate-400 font-bold text-center leading-tight">Selecciona un aula</span>
            </div>
          )}
        </div>
      )}
    </td>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function AsignacionPage() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  // ── States ────────────────────────────────────────────────────────
  const [selectedDocenteId, setSelectedDocenteId] = useState<string | null>(null);
  const [currentDocenteIdx, setCurrentDocenteIdx] = useState(0);
  const [editingAsignacion, setEditingAsignacion] = useState<HorarioAsignacion | null>(null);
  const [selectedAulaId, setSelectedAulaId] = useState<string>('');
  const [selectedFranjaId, setSelectedFranjaId] = useState<string>('');
  const [selectedManualCargaId, setSelectedManualCargaId] = useState<string>('');

  // ── Drag & Drop state ─────────────────────────────────────────────
  const [draggedOption, setDraggedOption] = useState<ManualScheduleOption | null>(null);
  const [filterAulaId, setFilterAulaId] = useState<string>('');
  const [dragOverFranjaId, setDragOverFranjaId] = useState<string | null>(null);
  const [activeFranjaIdForAulas, setActiveFranjaIdForAulas] = useState<string | null>(null);
  const [dropError, setDropError] = useState<string | null>(null);
  const [dropSuccess, setDropSuccess] = useState<string | null>(null);
  const dragCounter = useRef(0);
  const autoScrollRafRef = useRef<number | null>(null);
  const dragClientY = useRef<number>(0);

  // ── Auto-scroll durante drag ──────────────────────────────────────
  useEffect(() => {
    if (!draggedOption) {
      if (autoScrollRafRef.current !== null) {
        cancelAnimationFrame(autoScrollRafRef.current);
        autoScrollRafRef.current = null;
      }
      return;
    }

    const EDGE_THRESHOLD = 140; // px desde el borde para activar scroll (aumentado para facilitar detección)
    const MAX_SPEED = 24;       // velocidad máxima de scroll aumentada para pantallas de alta resolución
    const MIN_SPEED = 3;        // velocidad mínima inicial

    function getScrollSpeed(clientY: number): number {
      const viewH = window.innerHeight;
      if (clientY < EDGE_THRESHOLD) {
        const ratio = 1 - Math.max(0, clientY) / EDGE_THRESHOLD;
        return -(MIN_SPEED + ratio * (MAX_SPEED - MIN_SPEED));
      }
      if (clientY > viewH - EDGE_THRESHOLD) {
        const ratio = 1 - Math.max(0, viewH - clientY) / EDGE_THRESHOLD;
        return MIN_SPEED + ratio * (MAX_SPEED - MIN_SPEED);
      }
      return 0;
    }

    function tick() {
      const speed = getScrollSpeed(dragClientY.current);
      if (speed !== 0) {
        window.scrollBy({ top: speed, behavior: 'instant' });
      }
      autoScrollRafRef.current = requestAnimationFrame(tick);
    }

    function onDragOver(e: DragEvent) {
      dragClientY.current = e.clientY;
    }

    window.addEventListener('dragover', onDragOver);
    autoScrollRafRef.current = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener('dragover', onDragOver);
      if (autoScrollRafRef.current !== null) {
        cancelAnimationFrame(autoScrollRafRef.current);
        autoScrollRafRef.current = null;
      }
    };
  }, [draggedOption]);

  // ── Queries ───────────────────────────────────────────────────────
  const { data: periodoActivo } = useQuery({ ...trpc.periodo.active.queryOptions() });
  const { data: approvalInfo } = useQuery({
    ...trpc.horario.getApprovalInfo.queryOptions(),
    enabled: !!periodoActivo?.id,
  });
  const { data: docentesHierarchy = [] } = useQuery({
    ...trpc.horario.docentesByHierarchy.queryOptions({ periodoId: periodoActivo?.id ?? '' }),
    enabled: !!periodoActivo?.id,
  });
  const { data: aulas = [] } = useQuery({ ...trpc.aula.list.queryOptions() });
  const { data: franjas = [] } = useQuery({ ...trpc.franjaHoraria.list.queryOptions() });
  const { data: asignacionesData, isLoading: isLoadingAsignaciones } = useQuery({
    ...trpc.horario.byDocente.queryOptions({
      docenteId: selectedDocenteId ?? '',
      periodoId: periodoActivo?.id ?? '',
    }),
    enabled: !!selectedDocenteId && !!periodoActivo?.id,
  });
  const asignaciones = (asignacionesData ?? []) as HorarioAsignacion[];

  const { data: manualOptionsData = [], isLoading: isLoadingManualOptions } = useQuery({
    ...trpc.horario.manualOptions.queryOptions({
      docenteId: selectedDocenteId ?? '',
      periodoId: periodoActivo?.id ?? '',
    }),
    enabled: !!selectedDocenteId && !!periodoActivo?.id,
  });
  const manualOptions = manualOptionsData as ManualScheduleOption[];

  const pendingManualOptions = useMemo(
    () => manualOptions.filter((option) => option.remainingBlocks > 0),
    [manualOptions]
  );

  const selectedManualOption = useMemo(() => {
    return (
      manualOptions.find((option) => option.cargaLectivaId === selectedManualCargaId) ??
      pendingManualOptions[0] ??
      manualOptions[0]
    );
  }, [manualOptions, selectedManualCargaId, pendingManualOptions]);

  const activeCargaForAulas = draggedOption ?? selectedManualOption;

  const { data: availableAulasData } = useQuery({
    ...trpc.horario.availableAulasForFranja.queryOptions({
      periodoId: periodoActivo?.id ?? '',
      franjaHorariaId: activeFranjaIdForAulas ?? '',
      grupoId: activeCargaForAulas?.grupoId ?? '',
      tipo: activeCargaForAulas?.tipo ?? 'TEORIA',
    }),
    enabled: !!activeFranjaIdForAulas && !!activeCargaForAulas && !!periodoActivo?.id,
  });

  const { data: aulaAvailabilityData } = useQuery({
    ...trpc.horario.aulaAvailability.queryOptions({
      periodoId: periodoActivo?.id ?? '',
      aulaId: filterAulaId,
    }),
    enabled: !!filterAulaId && !!periodoActivo?.id,
  });

  const availabilityMap = useMemo(() => {
    const map = new Map<string, AvailabilityCell>();
    if (aulaAvailabilityData?.slots) {
      for (const slot of aulaAvailabilityData.slots as AvailabilityCell[]) {
        map.set(slot.franjaId, slot);
      }
    }
    return map;
  }, [aulaAvailabilityData]);

  const franjaMap = useMemo(() => {
    const map = new Map<string, FranjaOption>();
    for (const f of franjas as FranjaOption[]) {
      map.set(f.id, f);
    }
    return map;
  }, [franjas]);

  const horas = useMemo(() => {
    const h = [...new Set((franjas as FranjaOption[]).map((f) => f.horaInicio))].sort();
    return h;
  }, [franjas]);

  const franjaByDiaHora = useMemo(() => {
    const map = new Map<string, FranjaOption>();
    for (const f of franjas as FranjaOption[]) {
      map.set(`${f.dia}::${f.horaInicio}`, f);
    }
    return map;
  }, [franjas]);

  const compatibleAulas = useMemo(() => {
    const aulasList = aulas as AulaOption[];
    const tipoRef = draggedOption?.tipo ?? selectedManualOption?.tipo;
    if (!tipoRef) return [];
    
    // Filtrar primero por compatibilidad de tipo (Laboratorio vs Teoría)
    const filtered = aulasList.filter((aula) =>
      tipoRef === 'LABORATORIO'
        ? aula.tipo === 'LABORATORIO'
        : aula.tipo !== 'LABORATORIO'
    );

    // Si disponemos de datos de disponibilidad para una franja concreta, enriquecemos y ordenamos
    if (availableAulasData && availableAulasData.length > 0) {
      const availMap = new Map(availableAulasData.map(a => [a.id, a.status]));
      const enriched = filtered.map((aula) => ({
        ...aula,
        status: availMap.get(aula.id) || 'LIBRE',
      }));

      // Ordenar: LIBRE primero, luego CAPACIDAD_INSUFICIENTE, y final OCUPADA
      return enriched.sort((a, b) => {
        const score = { LIBRE: 1, CAPACIDAD_INSUFICIENTE: 2, OCUPADA: 3 };
        return (score[a.status] || 1) - (score[b.status] || 1);
      });
    }

    return filtered;
  }, [aulas, draggedOption, selectedManualOption, availableAulasData]);

  const uniqueCourseIds = Array.from(new Set(asignaciones.map((a) => a.grupo.curso.id))).sort();
  const cursoColorMap = new Map<string, string>();
  uniqueCourseIds.forEach((id, i) => {
    cursoColorMap.set(id, SLOT_COLORS[i % SLOT_COLORS.length]);
  });

  // ── Mutations ─────────────────────────────────────────────────────
  const confirmTeacherScheduleMutation = useMutation(
    trpc.horario.confirmTeacherSchedule.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries();
        alert('Horario del docente confirmado');
        if (currentDocenteIdx < docentesHierarchy.length - 1) {
          const nextIdx = currentDocenteIdx + 1;
          setCurrentDocenteIdx(nextIdx);
          setSelectedDocenteId(docentesHierarchy[nextIdx].id);
        }
      },
      onError: (err) => alert(err.message),
    })
  );

  const applySuggestionsMutation = useMutation(
    trpc.horario.applySuggestions.mutationOptions({
      onSuccess: () => { queryClient.invalidateQueries(); },
    })
  );

  const suggestAssignmentsMutation = useMutation(
    trpc.horario.suggestDocenteAssignments.mutationOptions({
      onSuccess: (data) => {
        if (data.assignments.length === 0) {
          const reason = data.unassigned[0]?.reason || 'No se pudieron generar sugerencias.';
          alert(`Aviso: ${reason}`);
          return;
        }
        if (confirm(`Se han generado ${data.assignments.length} sugerencias. ¿Desea aplicarlas?`)) {
          applySuggestionsMutation.mutate({
            periodoId: periodoActivo!.id,
            docenteId: selectedDocenteId!,
            assignments: data.assignments.map((a) => ({
              grupoId: a.grupoId,
              aulaId: a.aulaId,
              franjaHorariaId: a.franjaHorariaId,
              tipo: a.tipo as HorarioAsignacion['tipo'],
            })),
          });
        }
      },
      onError: (err) => alert(`Error al generar sugerencias: ${err.message}`),
    })
  );

  const sendToRevisionMutation = useMutation(
    trpc.horario.sendToRevision.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: trpc.periodo.active.queryKey() });
        alert('Todo el horario ha sido enviado a revisión del Director');
      },
      onError: (err) => alert(err.message),
    })
  );

  const updateAsignacionMutation = useMutation(
    trpc.horario.update.mutationOptions({
      onSuccess: () => { queryClient.invalidateQueries(); setEditingAsignacion(null); },
      onError: (err) => alert(err.message),
    })
  );

  const dragCreateMutation = useMutation(
    trpc.horario.create.mutationOptions({
      onSuccess: (_data, variables) => {
        queryClient.invalidateQueries();
        const aula = (aulas as AulaOption[]).find((a) => a.id === variables.aulaId);
        const franja = franjaMap.get(variables.franjaHorariaId);
        setDropSuccess(
          `${draggedOption?.curso.codigo} asignado${aula ? ` en ${aula.codigo}` : ''}${franja ? ` — ${DIA_LABELS[franja.dia]} ${franja.horaInicio}` : ''}`
        );
        setDraggedOption(null);
      },
      onError: (err) => {
        setDropError(err.message || 'No se pudo asignar. Verifique disponibilidad.');
        setDraggedOption(null);
      },
    })
  );

  const deleteAsignacionMutation = useMutation(
    trpc.horario.delete.mutationOptions({
      onSuccess: () => { queryClient.invalidateQueries(); setEditingAsignacion(null); },
      onError: (err) => alert(err.message),
    })
  );

  const clearDocenteMutation = useMutation(
    trpc.horario.clearDocente.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries();
      },
      onError: (err) => alert(err.message),
    })
  );

  const autoGenerateMutation = useMutation(
    trpc.horario.autoGenerate.mutationOptions({
      onSuccess: (data) => {
        if (data.success) {
          alert(`Éxito: ${data.createdCount} asignaciones generadas.`);
        } else {
          alert(`No se pudo generar el horario: ${data.reason}`);
        }
        queryClient.invalidateQueries();
      },
      onError: (err) => alert(`Error crítico al autogenerar: ${err.message}`),
    })
  );

  // ── Handlers ──────────────────────────────────────────────────────
  function handleEdit(asignacion: HorarioAsignacion) {
    setEditingAsignacion(asignacion);
    setSelectedAulaId(asignacion.aula?.id || '');
    setSelectedFranjaId(asignacion.franjaHoraria.id || '');
  }

  function handleSave() {
    if (!editingAsignacion) return;
    updateAsignacionMutation.mutate({
      id: editingAsignacion.id,
      aulaId: selectedAulaId,
      franjaHorariaId: selectedFranjaId,
    });
  }

  function handleDelete() {
    if (!editingAsignacion) return;
    if (confirm('¿Está seguro de eliminar esta asignación?')) {
      deleteAsignacionMutation.mutate({ id: editingAsignacion.id });
    }
  }

  const handleDragOver = useCallback((e: React.DragEvent, franjaId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverFranjaId(franjaId);
    setActiveFranjaIdForAulas(franjaId);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOverFranjaId(null);
  }, []);

  const handleDrop = useCallback((franjaId: string, _dia: string) => {
    setDragOverFranjaId(null);
    setActiveFranjaIdForAulas(null);
    if (!draggedOption || !selectedDocenteId || !periodoActivo?.id) return;

    if (!filterAulaId) {
      setDropError('Selecciona un aula en el filtro antes de asignar. El aula determina la disponibilidad del horario.');
      setDraggedOption(null);
      return;
    }

    const availability = availabilityMap.get(franjaId);
    if (availability && availability.status !== 'LIBRE') {
      const msgs: Record<string, string> = {
        OCUPADO: `El aula está ocupada en este horario${availability.ocupadoPor ? ` por ${availability.ocupadoPor.cursoCodigo} (${availability.ocupadoPor.docenteNombre})` : ''}. Elija otra aula u otro horario.`,
        MANTENIMIENTO: 'El aula está en mantenimiento en este horario. Seleccione otro horario.',
        DOCENTE_OCUPADO: 'El docente ya tiene una clase asignada en esta franja horaria.',
        RESTRICCION_DOCENTE: 'El docente tiene una restricción registrada para este horario.',
        MAX_HORAS_EXCEDIDO: 'Se superaría el máximo de horas continuas permitidas para el docente.',
        ALMUERZO_REQUERIDO: 'El docente requiere una ventana de almuerzo antes de este bloque.',
      };
      setDropError(msgs[availability.status] || 'Este horario no está disponible. Seleccione otro aula o franja.');
      setDraggedOption(null);
      return;
    }

    dragCreateMutation.mutate({
      docenteId: selectedDocenteId,
      grupoId: draggedOption.grupoId,
      periodoId: periodoActivo.id,
      tipo: draggedOption.tipo,
      aulaId: filterAulaId,
      franjaHorariaId: franjaId,
    });
  }, [draggedOption, selectedDocenteId, periodoActivo, filterAulaId, availabilityMap, dragCreateMutation]);

  if (!periodoActivo) return <div className="p-8 text-gray-500">Cargando periodo activo...</div>;

  const estado = periodoActivo?.estado ?? 'PLANIFICACION';
  const canEdit = estado === 'PLANIFICACION' || estado === 'POSTULACION' || estado === 'ASIGNACION';
  const isDragActive = !!draggedOption;

  return (
    <div className="space-y-6">
      {/* Toasts */}
      {dropError && <DropErrorToast message={dropError} onClose={() => setDropError(null)} />}
      {dropSuccess && <DropSuccessToast message={dropSuccess} onClose={() => setDropSuccess(null)} />}

      {/* ===== DIRECTOR REJECTION FEEDBACK ===== */}
      {estado === 'ASIGNACION' && approvalInfo?.comentariosDirector && (
        <div className="rounded-xl border border-warning/30 bg-warning/10 p-5">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-warning mt-0.5 shrink-0" />
            <div>
              <h2 className="text-lg font-bold text-text-main">Horario devuelto por el director</h2>
              <p className="text-sm text-text-main mt-1 font-medium">
                El director ha solicitado modificaciones. Realice los ajustes y vuelva a enviar.
              </p>
              <div className="mt-3 rounded-lg border border-warning/20 bg-white p-4">
                <p className="text-xs font-bold text-warning uppercase tracking-wider mb-1">Observaciones del director:</p>
                <p className="text-sm text-text-main font-semibold">{approvalInfo.comentariosDirector}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===== ALREADY IN REVISION ===== */}
      {estado === 'REVISION' && (
        <div className="rounded-xl border border-info/30 bg-info/10 p-5">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-info mt-0.5 shrink-0" />
            <div>
              <h2 className="text-lg font-bold text-text-main">Horario en revisión</h2>
              <p className="text-sm text-text-main mt-1 font-medium">
                La asignación ya fue enviada al director. No se pueden realizar modificaciones.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ===== APPROVED OR FINALIZED ===== */}
      {(estado === 'APROBADO' || estado === 'FINALIZADO') && (
        <div className="rounded-xl border border-success/30 bg-success/10 p-5">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="h-5 w-5 text-success mt-0.5 shrink-0" />
            <div>
              <h2 className="text-lg font-bold text-text-main">
                {estado === 'FINALIZADO' ? 'Horario publicado' : 'Horario aprobado'}
              </h2>
              <p className="text-sm text-text-main mt-1 font-medium">
                {estado === 'FINALIZADO'
                  ? 'El horario ya está publicado y visible para todos los usuarios.'
                  : 'El director ha aprobado el horario. Ya no se pueden realizar modificaciones.'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ===== HEADER ===== */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-main">Módulo de Asignación de Horarios</h1>
          <p className="text-sm text-text-sub mt-1">
            Proceso secuencial por jerarquía — {periodoActivo.nombre}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => {
              if (confirm('¿Desea autogenerar TODO el horario? Esto sobreescribirá asignaciones actuales.')) {
                autoGenerateMutation.mutate({ periodoId: periodoActivo.id });
              }
            }}
            disabled={!canEdit}
            className="px-4 py-2 rounded-lg bg-primary/10 text-primary text-xs font-bold border border-primary/20 hover:bg-primary/20 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Autogenerar Todo
          </button>
          {canEdit && (
            <button
              onClick={() => {
                if (confirm('¿Desea enviar todo el horario consolidado al Director para su aprobación final?')) {
                  sendToRevisionMutation.mutate({ periodoId: periodoActivo.id });
                }
              }}
              className="btn-primary"
            >
              Enviar a Revisión
            </button>
          )}
        </div>
      </div>

      {/* ===== SEQUENTIAL PROGRESS ===== */}
      <div className="rounded-xl border border-warning/30 bg-warning/5 p-6 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-warning text-white text-xl font-black shadow-lg shadow-warning/20">
              {currentDocenteIdx + 1}
            </div>
            <div>
              <h3 className="text-lg font-bold text-text-main tracking-tight">
                {selectedDocenteId ? docentesHierarchy[currentDocenteIdx]?.nombre : 'Seleccione un docente'}
              </h3>
              <div className="flex gap-2 mt-1">
                <span className="text-[10px] bg-warning/10 text-warning px-2 py-0.5 rounded-full font-bold uppercase border border-warning/20">
                  {docentesHierarchy[currentDocenteIdx]?.categoria}
                </span>
                <span className="text-[10px] bg-slate-100 text-text-sub px-2 py-0.5 rounded-full font-bold uppercase border border-border">
                  {docentesHierarchy[currentDocenteIdx]?.tipo}
                </span>
              </div>
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => {
                if (!selectedDocenteId) return;
                if (confirm('¿Está seguro de eliminar TODOS los horarios asignados para este docente?')) {
                  clearDocenteMutation.mutate({ docenteId: selectedDocenteId, periodoId: periodoActivo.id });
                }
              }}
              disabled={!selectedDocenteId || !canEdit || clearDocenteMutation.isPending || asignaciones.length === 0}
              className="flex items-center gap-2 rounded-lg bg-danger/10 px-6 py-2.5 text-sm font-bold text-danger hover:bg-danger/20 disabled:opacity-50 transition-all border border-danger/20"
            >
              <Trash2 className="h-4 w-4" />
              {clearDocenteMutation.isPending ? 'Eliminando...' : 'Limpiar Horario'}
            </button>
            <button
              onClick={() => {
                if (!selectedDocenteId) return;
                suggestAssignmentsMutation.mutate({ periodoId: periodoActivo.id, docenteId: selectedDocenteId });
              }}
              disabled={!selectedDocenteId || !canEdit || suggestAssignmentsMutation.isPending}
              className="flex items-center gap-2 rounded-lg bg-primary/10 px-6 py-2.5 text-sm font-bold text-primary hover:bg-primary/20 disabled:opacity-50 transition-all border border-primary/20"
            >
              <TrendingUp className="h-4 w-4" />
              {suggestAssignmentsMutation.isPending ? 'Procesando...' : 'Sugerir Horario'}
            </button>
            <button
              onClick={() => {
                if (!selectedDocenteId) return;
                confirmTeacherScheduleMutation.mutate({ docenteId: selectedDocenteId, periodoId: periodoActivo.id });
              }}
              disabled={!selectedDocenteId || !canEdit || confirmTeacherScheduleMutation.isPending || asignaciones.length === 0}
              className="flex items-center gap-2 rounded-lg bg-success px-6 py-2.5 text-sm font-bold text-white hover:bg-green-700 disabled:opacity-50 transition-all shadow-lg shadow-success/20"
            >
              <CheckCircle2 className="h-4 w-4" />
              Confirmar y Siguiente
            </button>
          </div>
        </div>
        <div className="space-y-2">
          <div className="flex justify-between text-[10px] font-black text-text-sub uppercase tracking-widest">
            <span>Progreso de Asignación Jerárquica</span>
            <span>{Math.round(((currentDocenteIdx + 1) / docentesHierarchy.length) * 100)}%</span>
          </div>
          <div className="h-2 w-full rounded-full bg-slate-200 overflow-hidden">
            <div
              className="h-full bg-warning transition-all duration-700 ease-out"
              style={{ width: `${((currentDocenteIdx + 1) / docentesHierarchy.length) * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* ===== MAIN GRID: Docentes + Calendar ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Docentes List */}
        <div className="lg:col-span-1 space-y-2 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
          <h4 className="text-[10px] font-black text-text-sub uppercase mb-4 sticky top-0 bg-page py-2 tracking-widest">Lista Jerárquica</h4>
          {docentesHierarchy.map((d, idx) => (
            <button
              key={d.id}
              onClick={() => {
                setSelectedDocenteId(d.id);
                setCurrentDocenteIdx(idx);
                setDraggedOption(null);
                setFilterAulaId('');
              }}
              className={`w-full text-left p-3 rounded-xl border transition-all ${
                selectedDocenteId === d.id
                  ? 'border-primary bg-primary/10 text-primary shadow-sm'
                  : 'border-border bg-white text-text-sub hover:border-slate-300'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <p className={`text-sm font-bold truncate ${selectedDocenteId === d.id ? 'text-primary' : 'text-text-main'}`}>{d.nombre}</p>
                {d._count?.asignaciones > 0 && (
                  <div className="h-1.5 w-1.5 rounded-full bg-success flex-shrink-0" title="Ya tiene asignaciones" />
                )}
              </div>
              <p className="text-[10px] mt-0.5 font-bold uppercase opacity-60 tracking-tight">{d.categoria} · {d.tipo}</p>
            </button>
          ))}
        </div>

        {/* Calendar + DnD Area */}
        <div className="lg:col-span-3 space-y-4">

          {/* ===== DRAG & DROP PANEL ===== */}
          {selectedDocenteId && canEdit && (
            <div className="rounded-2xl border border-border bg-white p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Layers className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-text-main">Asignación Drag & Drop</h3>
                  <p className="text-[10px] text-text-sub font-medium">Arrastra una hora lectiva hacia el calendario · Selecciona el aula para ver disponibilidad</p>
                </div>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-[1fr_220px] gap-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[10px] font-black uppercase tracking-widest text-text-sub">
                      Horas Lectivas Pendientes
                    </p>
                    {isLoadingManualOptions && (
                      <span className="text-[10px] text-text-sub font-bold animate-pulse">Cargando...</span>
                    )}
                    {!isLoadingManualOptions && (
                      <span className="text-[10px] font-bold text-text-sub">
                        {pendingManualOptions.length} pendientes · {manualOptions.length - pendingManualOptions.length} completas
                      </span>
                    )}
                  </div>

                  {manualOptions.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-border bg-slate-50 p-4 text-sm font-medium text-text-sub text-center">
                      Sin carga lectiva aprobada para programar.
                    </div>
                  ) : (
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-2">
                      {manualOptions.map((option) => (
                        <DraggableCargaCard
                          key={option.cargaLectivaId}
                          option={option}
                          isSelected={selectedManualCargaId === option.cargaLectivaId || draggedOption?.cargaLectivaId === option.cargaLectivaId}
                          isBeingDragged={draggedOption?.cargaLectivaId === option.cargaLectivaId}
                          canEdit={canEdit}
                          onSelect={() => setSelectedManualCargaId(option.cargaLectivaId)}
                          onDragStart={() => setDraggedOption(option)}
                          onDragEnd={() => {
                            setTimeout(() => setDraggedOption(null), 50);
                          }}
                        />
                      ))}
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  <div className="rounded-xl border border-border bg-slate-50 p-4">
                    <div className="flex items-center gap-1.5 mb-3">
                      <Building2 className="h-3.5 w-3.5 text-text-sub" />
                      <p className="text-[10px] font-black uppercase tracking-widest text-text-sub">Filtrar por Aula</p>
                    </div>
                    <select
                      id="filter-aula-select"
                      value={filterAulaId}
                      onChange={(e) => setFilterAulaId(e.target.value)}
                      className="input-standard text-xs"
                    >
                      <option value="">— Sin filtro de aula —</option>
                      {compatibleAulas.map((aula: any) => {
                        const statusLabel = aula.status === 'LIBRE' ? '✅ LIBRE' : aula.status === 'CAPACIDAD_INSUFICIENTE' ? '⚠️ CAP. INSUF.' : '❌ OCUPADA';
                        return (
                          <option key={aula.id} value={aula.id}>
                            {aula.codigo} — {aula.nombre} ({aula.capacidad}p) {activeFranjaIdForAulas ? `[${statusLabel}]` : ''}
                          </option>
                        );
                      })}
                    </select>
                    {filterAulaId && aulaAvailabilityData && (
                      <p className="mt-2 text-[9px] text-text-sub font-medium">
                        <span className="font-bold">{aulaAvailabilityData.aulaNombre}</span> — Cap. {aulaAvailabilityData.capacidad}
                      </p>
                    )}
                  </div>

                  <div className="rounded-xl border border-border bg-slate-50 p-4">
                    <p className="text-[10px] font-black uppercase tracking-widest text-text-sub mb-3">Leyenda del Calendario</p>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded border-2 border-dashed border-success/60 bg-success/10 flex-shrink-0" />
                        <span className="text-[10px] font-medium text-text-sub">Disponible para asignar</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded border-2 border-dashed border-danger/30 bg-danger/5 flex-shrink-0" />
                        <span className="text-[10px] font-medium text-text-sub">Aula ocupada / bloqueada</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded border bg-primary/10 border-primary/20 flex-shrink-0" />
                        <span className="text-[10px] font-medium text-text-sub">Asignación existente</span>
                      </div>
                    </div>
                  </div>

                  {isDragActive && (
                    <div className="rounded-xl border-2 border-dashed border-primary/40 bg-primary/5 p-3 text-center animate-pulse">
                      <p className="text-[10px] font-black text-primary">
                        {filterAulaId ? '✓ Suelta en una celda verde' : '⚠ Primero selecciona un aula'}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ===== CALENDAR GRID ===== */}
          {isLoadingAsignaciones ? (
            <div className="h-full rounded-2xl border border-border bg-white flex flex-col items-center justify-center p-12 shadow-sm">
              <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4" />
              <p className="text-text-sub text-sm font-bold animate-pulse">Cargando horario...</p>
            </div>
          ) : !selectedDocenteId ? (
            <div className="h-full rounded-2xl border-2 border-dashed border-border flex flex-col items-center justify-center p-12 text-center bg-white/50">
              <User className="h-12 w-12 text-slate-300 mb-4" />
              <h3 className="text-text-sub font-bold">Seleccione un docente para iniciar</h3>
              <p className="text-text-sub/60 text-xs mt-1">Se mostrará su horario y las opciones de asignación.</p>
            </div>
          ) : (
            <div className={`rounded-2xl border bg-white overflow-hidden shadow-sm transition-all ${isDragActive ? 'border-primary/30 shadow-primary/10 shadow-lg' : 'border-border'}`}>
              <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-slate-50/80">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-text-sub" />
                  <span className="text-[11px] font-black text-text-sub uppercase tracking-widest">Horario del docente</span>
                  {asignaciones.length > 0 && (
                    <span className="text-[10px] bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded-full font-bold">
                      {asignaciones.length} bloque{asignaciones.length !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>
                {filterAulaId && aulaAvailabilityData && (
                  <div className="flex items-center gap-1.5 text-[10px] font-bold text-text-sub">
                    <Building2 className="h-3 w-3" />
                    Viendo disponibilidad: <span className="text-primary">{aulaAvailabilityData.aulaCodigo}</span>
                  </div>
                )}
                {isDragActive && (
                  <div className="flex items-center gap-1.5 text-[10px] font-black text-primary animate-pulse">
                    <GripVertical className="h-3 w-3" />
                    Arrastrando: {draggedOption?.curso.codigo} · {draggedOption?.tipo}
                  </div>
                )}
              </div>

              {asignaciones.length === 0 && !isDragActive ? (
                <div className="flex flex-col items-center justify-center p-12 text-center">
                  <AlertTriangle className="h-12 w-12 text-warning/20 mb-4" />
                  <h3 className="text-text-sub font-bold">Sin asignaciones para este docente</h3>
                  <p className="text-text-sub/60 text-xs mt-1">Use el panel drag & drop o haga clic en "Sugerir Horario".</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-[11px]">
                    <thead>
                      <tr className="bg-slate-50 border-b border-border">
                        <th className="px-4 py-4 text-left font-black text-text-sub uppercase tracking-widest w-24 sticky left-0 bg-slate-50 z-10">Hora</th>
                        {DIAS.map((dia) => (
                          <th key={dia} className="px-2 py-4 text-center font-black text-text-sub uppercase tracking-widest min-w-[90px]">
                            {DIA_LABELS[dia]}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {horas.map((hora) => {
                        const sampleFranja = (franjas as FranjaOption[]).find((f) => f.horaInicio === hora);
                        return (
                          <tr key={hora} className="border-t border-border group">
                            <td className="px-4 py-2 font-mono font-bold text-text-sub bg-slate-50/50 sticky left-0 z-10 whitespace-nowrap">
                              <div className="flex flex-col">
                                <span>{hora}</span>
                                {sampleFranja && (
                                  <span className="text-[8px] opacity-60">{sampleFranja.horaFin}</span>
                                )}
                              </div>
                            </td>
                            {DIAS.map((dia) => {
                              const franja = franjaByDiaHora.get(`${dia}::${hora}`);
                              if (!franja) {
                                return <td key={dia} className="px-1 py-1"><div className="min-h-[62px] bg-slate-50/30 rounded-xl" /></td>;
                              }
                              const existingAsignacion = asignaciones.find(
                                (a) => a.franjaHoraria.dia === dia && a.franjaHoraria.horaInicio === hora
                              );
                              const colorClass = existingAsignacion
                                ? (cursoColorMap.get(existingAsignacion.grupo.curso.id) || '')
                                : '';
                              const availability = filterAulaId ? availabilityMap.get(franja.id) : undefined;

                              return (
                                <CalendarDropCell
                                  key={dia}
                                  dia={dia}
                                  hora={hora}
                                  horaFin={franja.horaFin}
                                  franjaId={franja.id}
                                  availability={availability}
                                  filterAulaId={filterAulaId}
                                  existingAsignacion={existingAsignacion}
                                  isDragActive={isDragActive}
                                  isDragOver={dragOverFranjaId === franja.id}
                                  canEdit={canEdit}
                                  colorClass={colorClass}
                                  onDragOver={handleDragOver}
                                  onDragLeave={handleDragLeave}
                                  onDrop={handleDrop}
                                  onEditClick={handleEdit}
                                  onDeleteClick={(id) => deleteAsignacionMutation.mutate({ id })}
                                />
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ===== EDIT MODAL ===== */}
      {editingAsignacion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-border bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-text-main">Editar Asignación</h2>
              <button onClick={() => setEditingAsignacion(null)} className="rounded-lg p-1 text-text-sub hover:bg-slate-100">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mb-4 rounded-xl bg-slate-50 border border-border p-4 space-y-1">
              <p className="text-sm text-text-sub">Curso: <span className="font-bold text-text-main">{editingAsignacion.grupo.curso.nombre} ({editingAsignacion.grupo.curso.codigo})</span></p>
              <p className="text-sm text-text-sub">Grupo: <span className="font-bold text-text-main">{editingAsignacion.grupo.nombre}</span></p>
              <p className="text-sm text-text-sub">Tipo: <span className="font-bold text-text-main">{editingAsignacion.tipo}</span></p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="label-standard">Aula</label>
                <select
                  value={selectedAulaId}
                  onChange={(e) => setSelectedAulaId(e.target.value)}
                  className="input-standard"
                >
                  <option value="">Seleccione una aula</option>
                  {(aulas as AulaOption[]).map((aula) => (
                    <option key={aula.id} value={aula.id}>{aula.codigo} - {aula.nombre} ({aula.tipo})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label-standard">Franja Horaria</label>
                <select
                  value={selectedFranjaId}
                  onChange={(e) => setSelectedFranjaId(e.target.value)}
                  className="input-standard"
                >
                  <option value="">Seleccione una franja</option>
                  {(franjas as FranjaOption[]).map((franja) => (
                    <option key={franja.id} value={franja.id}>
                      {DIA_LABELS[franja.dia] || franja.dia} {franja.horaInicio} - {franja.horaFin}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex gap-3 pt-4 border-t border-border">
                <button onClick={() => setEditingAsignacion(null)} className="btn-secondary flex-1">
                  Cancelar
                </button>
                <button onClick={handleDelete} className="btn-secondary text-danger border-danger/30 hover:bg-danger/10">
                  <Trash2 className="h-4 w-4 mr-2" />
                  Eliminar
                </button>
                <button onClick={handleSave} className="btn-primary flex-1">
                  <Save className="h-4 w-4 mr-2" />
                  Guardar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
