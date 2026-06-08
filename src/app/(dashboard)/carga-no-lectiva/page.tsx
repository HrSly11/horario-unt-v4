'use client';

import { useTRPC } from '@/trpc/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Plus, Pencil, Trash2, Clock, Calendar, X, BookOpen, AlertTriangle } from 'lucide-react';

// ── Types ──────────────────────────────────────────────

type TipoCarga =
  | 'PREPARACION_EVALUACION' | 'CONSEJERIA' | 'INVESTIGACION'
  | 'CAPACITACION' | 'GOBIERNO' | 'ADMINISTRACION'
  | 'ASESORIA_TESIS' | 'RESPONSABILIDAD_SOCIAL' | 'COMITES_COMISIONES';

type DiaSemana = 'LUNES' | 'MARTES' | 'MIERCOLES' | 'JUEVES' | 'VIERNES' | 'SABADO';

type HorarioBlock = {
  dia: DiaSemana;
  horaInicio: string;
  horaFin: string;
  lugar: string;
  aula: string;
};

type FormData = {
  tipo: TipoCarga;
  horas: number;
  descripcion: string;
  codigoProyecto: string;
  nombreProyecto: string;
  numAlumnos: number | '';
  cicloConsejeria: string;
  horarios: HorarioBlock[];
};

// ── Constants ──────────────────────────────────────────

const TIPO_OPTIONS: { value: TipoCarga; label: string }[] = [
  { value: 'PREPARACION_EVALUACION', label: 'Preparación y Evaluación' },
  { value: 'CONSEJERIA', label: 'Consejería' },
  { value: 'INVESTIGACION', label: 'Investigación' },
  { value: 'CAPACITACION', label: 'Capacitación' },
  { value: 'GOBIERNO', label: 'Actividades de Gobierno o Autoridad' },
  { value: 'ADMINISTRACION', label: 'Actividades de Administración' },
  { value: 'ASESORIA_TESIS', label: 'Asesoría de Tesis y Exámenes Profesionales' },
  { value: 'RESPONSABILIDAD_SOCIAL', label: 'Responsabilidad Social Universitaria' },
  { value: 'COMITES_COMISIONES', label: 'Comités Técnicos y Comisiones' },
];

const TIPO_LABELS: Record<string, string> = Object.fromEntries(
  TIPO_OPTIONS.map((o) => [o.value, o.label])
);

const TIPO_BADGE: Record<string, string> = {
  PREPARACION_EVALUACION: 'badge-info',
  CONSEJERIA: 'badge-success',
  INVESTIGACION: 'badge-primary',
  CAPACITACION: 'badge-warning',
  GOBIERNO: 'badge-danger',
  ADMINISTRACION: 'badge-gray',
  ASESORIA_TESIS: 'badge-info',
  RESPONSABILIDAD_SOCIAL: 'badge-success',
  COMITES_COMISIONES: 'badge-primary',
};

const DIA_OPTIONS: { value: DiaSemana; label: string }[] = [
  { value: 'LUNES', label: 'Lunes' },
  { value: 'MARTES', label: 'Martes' },
  { value: 'MIERCOLES', label: 'Miércoles' },
  { value: 'JUEVES', label: 'Jueves' },
  { value: 'VIERNES', label: 'Viernes' },
  { value: 'SABADO', label: 'Sábado' },
];

const DIA_SHORT: Record<string, string> = {
  LUNES: 'Lun', MARTES: 'Mar', MIERCOLES: 'Mié',
  JUEVES: 'Jue', VIERNES: 'Vie', SABADO: 'Sáb',
};

const emptyForm: FormData = {
  tipo: 'PREPARACION_EVALUACION',
  horas: 1,
  descripcion: '',
  codigoProyecto: '',
  nombreProyecto: '',
  numAlumnos: '',
  cicloConsejeria: '',
  horarios: [],
};

const emptyBlock: HorarioBlock = {
  dia: 'LUNES',
  horaInicio: '07:00',
  horaFin: '08:00',
  lugar: '',
  aula: '',
};

// ── Helpers ────────────────────────────────────────────

function formatHorarios(horarios: { dia: string; horaInicio: string; horaFin: string }[]): string {
  if (!horarios || horarios.length === 0) return '—';
  return horarios
    .map((h) => `${DIA_SHORT[h.dia] || h.dia} ${h.horaInicio}-${h.horaFin}`)
    .join(', ');
}

// ── Component ──────────────────────────────────────────

export default function CargaNoLectivaPage() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  // UI state
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<FormData>(emptyForm);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [selectedPeriodoId, setSelectedPeriodoId] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  // Queries
  const { data: user } = useQuery({ ...trpc.auth.me.queryOptions() });
  const { data: periodos = [] } = useQuery({ ...trpc.periodo.list.queryOptions() });

  const docenteId = user?.docenteId || '';
  const periodoId = selectedPeriodoId || (periodos.length > 0 ? periodos[0].id : '');

  // Set initial periodo when periodos load
  if (periodos.length > 0 && !selectedPeriodoId) {
    setSelectedPeriodoId(periodos[0].id);
  }

  const { data: cargaData } = useQuery({
    ...trpc.cargaNoLectiva.byDocente.queryOptions({ docenteId, periodoId }),
    enabled: !!docenteId && !!periodoId,
  });

  const { data: cargasNoLectivas = [], isLoading } = useQuery({
    ...trpc.cargaNoLectiva.list.queryOptions({ docenteId, periodoId }),
    enabled: !!docenteId && !!periodoId,
  });

  const { data: docente } = useQuery({
    ...trpc.docente.byId.queryOptions({ id: docenteId }),
    enabled: !!docenteId,
  });

  const { data: horarioLectivo = [] } = useQuery({
    ...trpc.horario.byDocente.queryOptions({ docenteId, periodoId }),
    enabled: !!docenteId && !!periodoId,
  });

  // Helper for time overlap check (local)
  function checkOverlap(
    h1: { dia: string; horaInicio: string; horaFin: string },
    h2: { dia: string; horaInicio: string; horaFin: string }
  ) {
    if (h1.dia !== h2.dia) return false;
    const s1 = h1.horaInicio;
    const e1 = h1.horaFin;
    const s2 = h2.horaInicio;
    const e2 = h2.horaFin;
    return s1 < e2 && e1 > s2;
  }

  function validateLocalHorarios(newHorarios: HorarioBlock[]) {
    // 1. Check overlaps within the new blocks themselves
    for (let i = 0; i < newHorarios.length; i++) {
      for (let j = i + 1; j < newHorarios.length; j++) {
        if (checkOverlap(newHorarios[i], newHorarios[j])) {
          return `Conflicto interno: Los bloques ${i + 1} y ${j + 1} se cruzan.`;
        }
      }
    }

    // 2. Check against lective schedule
    for (const asig of horarioLectivo) {
      if (!asig.franjaHoraria) continue;
      for (const block of newHorarios) {
        if (checkOverlap(block, asig.franjaHoraria)) {
          const curso = asig.grupo?.curso?.nombre || 'Curso';
          return `Cruce con horario lectivo: ${curso} (${asig.franjaHoraria.dia} ${asig.franjaHoraria.horaInicio}-${asig.franjaHoraria.horaFin})`;
        }
      }
    }

    // 3. Check against other non-lective activities
    for (const carga of cargasNoLectivas) {
      if (carga.id === editId) continue;
      const otherHorarios = (carga as any).horarios || [];
      for (const other of otherHorarios) {
        for (const block of newHorarios) {
          if (checkOverlap(block, other)) {
            return `Cruce con ${TIPO_LABELS[carga.tipo]}: ${other.dia} ${other.horaInicio}-${other.horaFin}`;
          }
        }
      }
    }

    return null;
  }

  // Mutations
  const createMutation = useMutation(
    trpc.cargaNoLectiva.create.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: trpc.cargaNoLectiva.list.queryKey({ docenteId, periodoId }) });
        queryClient.invalidateQueries({ queryKey: trpc.cargaNoLectiva.byDocente.queryKey({ docenteId, periodoId }) });
        closeModal();
      },
      onError: (err) => setError(err.message),
    })
  );

  const updateMutation = useMutation(
    trpc.cargaNoLectiva.update.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: trpc.cargaNoLectiva.list.queryKey({ docenteId, periodoId }) });
        queryClient.invalidateQueries({ queryKey: trpc.cargaNoLectiva.byDocente.queryKey({ docenteId, periodoId }) });
        closeModal();
      },
      onError: (err) => setError(err.message),
    })
  );

  const deleteMutation = useMutation(
    trpc.cargaNoLectiva.delete.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: trpc.cargaNoLectiva.list.queryKey({ docenteId, periodoId }) });
        queryClient.invalidateQueries({ queryKey: trpc.cargaNoLectiva.byDocente.queryKey({ docenteId, periodoId }) });
        setDeleteConfirmId(null);
      },
    })
  );

  // Modal handlers
  function closeModal() {
    setShowModal(false);
    setEditId(null);
    setForm(emptyForm);
    setError(null);
  }

  function openCreate() {
    setForm(emptyForm);
    setEditId(null);
    setError(null);
    setShowModal(true);
  }

  function openEdit(carga: (typeof cargasNoLectivas)[0]) {
    setEditId(carga.id);
    setError(null);
    setForm({
      tipo: carga.tipo as TipoCarga,
      horas: carga.horas,
      descripcion: carga.descripcion || '',
      codigoProyecto: carga.codigoProyecto || '',
      nombreProyecto: carga.nombreProyecto || '',
      numAlumnos: carga.numAlumnos ?? '',
      cicloConsejeria: carga.cicloConsejeria || '',
      horarios: ((carga as Record<string, unknown>).horarios as HorarioBlock[] | undefined)?.map((h) => ({
        dia: h.dia,
        horaInicio: h.horaInicio,
        horaFin: h.horaFin,
        lugar: h.lugar || '',
        aula: h.aula || '',
      })) || [],
    });
    setShowModal(true);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const mappedHorarios = form.horarios.map((h) => ({
      dia: h.dia,
      horaInicio: h.horaInicio,
      horaFin: h.horaFin,
      lugar: h.lugar || undefined,
      aula: h.aula || undefined,
    }));

    // Local validation for overlaps
    const localError = validateLocalHorarios(form.horarios);
    if (localError) {
      setError(localError);
      return;
    }

    if (editId) {
      updateMutation.mutate({
        id: editId,
        horas: form.horas,
        descripcion: form.descripcion || '',
        codigoProyecto: form.tipo === 'INVESTIGACION' ? form.codigoProyecto || undefined : undefined,
        nombreProyecto: form.tipo === 'INVESTIGACION' ? form.nombreProyecto || undefined : undefined,
        numAlumnos: form.tipo === 'CONSEJERIA' && form.numAlumnos !== '' ? Number(form.numAlumnos) : undefined,
        cicloConsejeria: form.tipo === 'CONSEJERIA' ? form.cicloConsejeria || undefined : undefined,
        horarios: mappedHorarios,
      });
    } else {
      createMutation.mutate({
        docenteId,
        periodoId,
        tipo: form.tipo,
        horas: form.horas,
        descripcion: form.descripcion || '',
        codigoProyecto: form.tipo === 'INVESTIGACION' ? form.codigoProyecto || undefined : undefined,
        nombreProyecto: form.tipo === 'INVESTIGACION' ? form.nombreProyecto || undefined : undefined,
        numAlumnos: form.tipo === 'CONSEJERIA' && form.numAlumnos !== '' ? Number(form.numAlumnos) : undefined,
        cicloConsejeria: form.tipo === 'CONSEJERIA' ? form.cicloConsejeria || undefined : undefined,
        horarios: mappedHorarios,
      });
    }
  }

  // Horario block handlers
  function addBlock() {
    setForm({ ...form, horarios: [...form.horarios, { ...emptyBlock }] });
  }

  function removeBlock(index: number) {
    setForm({ ...form, horarios: form.horarios.filter((_, i) => i !== index) });
  }

  function updateBlock(index: number, field: keyof HorarioBlock, value: string) {
    const updated = form.horarios.map((b, i) =>
      i === index ? { ...b, [field]: value } : b
    );
    setForm({ ...form, horarios: updated });
  }

  // Derived values
  const horasContrato = docente?.horasContrato || 40;
  const totalLectivas = cargaData?.totalLectivas || 0;
  const totalNoLectivas = cargaData?.totalNoLectivas || 0;
  const totalGeneral = totalLectivas + totalNoLectivas;
  const progressPct = Math.min(100, (totalGeneral / horasContrato) * 100);

  // ── Access guard ─────────────────────────────────────

  if (!docenteId) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-6 text-center">
          <AlertTriangle className="h-8 w-8 text-amber-400 mx-auto mb-3" />
          <h2 className="text-lg font-semibold text-amber-400">Acceso Restringido</h2>
          <p className="text-zinc-400 mt-2">Solo los docentes pueden gestionar su carga no lectiva.</p>
        </div>
      </div>
    );
  }

  // ── Render ───────────────────────────────────────────

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Carga No Lectiva</h1>
          <p className="text-zinc-400 text-sm mt-1">Registra tus actividades complementarias</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Period selector */}
          <select
            value={periodoId}
            onChange={(e) => setSelectedPeriodoId(e.target.value)}
            className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-sm text-zinc-200 focus:border-indigo-500 focus:outline-none"
          >
            {periodos.map((p) => (
              <option key={p.id} value={p.id}>{p.nombre}</option>
            ))}
          </select>
          <button
            onClick={openCreate}
            className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-500 shadow-lg shadow-indigo-500/25"
          >
            <Plus className="h-4 w-4" /> Agregar Actividad
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-zinc-900/80 border border-zinc-800 rounded-lg p-4">
          <div className="flex items-center gap-2 text-zinc-400 text-sm mb-1">
            <BookOpen className="h-4 w-4" /> Lectivas
          </div>
          <div className="text-2xl font-bold text-white">{totalLectivas}h</div>
        </div>
        <div className="bg-zinc-900/80 border border-zinc-800 rounded-lg p-4">
          <div className="flex items-center gap-2 text-zinc-400 text-sm mb-1">
            <Clock className="h-4 w-4" /> No Lectivas
          </div>
          <div className="text-2xl font-bold text-white">{totalNoLectivas}h</div>
        </div>
        <div className="bg-zinc-900/80 border border-zinc-800 rounded-lg p-4">
          <div className="flex items-center gap-2 text-zinc-400 text-sm mb-1">
            <Calendar className="h-4 w-4" /> Contrato ({docente?.modalidad || '—'})
          </div>
          <div className="text-2xl font-bold text-blue-400">{horasContrato}h</div>
          <div className="text-xs text-zinc-500 mt-1">{totalGeneral}h / {horasContrato}h asignadas</div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="space-y-1">
        <div className="h-3 bg-zinc-800 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all rounded-full ${progressPct >= 100 ? 'bg-red-500' : progressPct >= 80 ? 'bg-amber-500' : 'bg-green-500'}`}
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-zinc-500">
          <span>{totalGeneral}h usadas</span>
          <span>{Math.max(0, horasContrato - totalGeneral)}h disponibles</span>
        </div>
      </div>

      {/* Table */}
      <div className="table-standard">
        <table className="w-full text-left border-separate border-spacing-0">
          <thead>
            <tr>
              <th>Actividad / Tipo</th>
              <th className="text-center">Horas</th>
              <th>Horario Asignado</th>
              <th className="text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={4} className="px-6 py-12 text-center text-text-sub">Cargando actividades...</td></tr>
            ) : cargasNoLectivas.length === 0 ? (
              <tr><td colSpan={4} className="px-6 py-12 text-center text-text-sub">No hay actividades registradas</td></tr>
            ) : (
              cargasNoLectivas.map((c) => (
                <tr key={c.id} className="group transition-colors">
                  <td>
                    <div>
                      <p className="font-bold text-text-main group-hover:text-primary transition-colors">{TIPO_LABELS[c.tipo]}</p>
                      <p className="text-[10px] text-text-sub font-bold uppercase tracking-tight line-clamp-1">{c.descripcion}</p>
                    </div>
                  </td>
                  <td className="text-center">
                    <span className="text-xs font-bold text-primary bg-primary-light px-2 py-1 rounded-md border border-primary/10">{c.horas}h</span>
                  </td>
                  <td>
                    <div className="flex items-center gap-2 text-[11px] text-text-sub">
                      <Clock className="h-3 w-3" />
                      <span className="font-bold">{formatHorarios((c as any).horarios)}</span>
                    </div>
                  </td>
                  <td className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => openEdit(c)} 
                        className="p-2 rounded-lg text-text-sub hover:bg-primary-light hover:text-primary transition-all">
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button onClick={() => setDeleteConfirmId(c.id)} 
                        className="p-2 rounded-lg text-text-sub hover:bg-red-50 hover:text-danger transition-all">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
            {cargasNoLectivas.length > 0 && (
              <tr className="border-t-2 border-zinc-700 bg-zinc-800/30">
                <td className="px-4 py-3 font-bold text-white">Total</td>
                <td className="px-4 py-3 text-center font-bold text-white font-mono">{totalNoLectivas}h</td>
                <td colSpan={2} />
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content max-w-2xl overflow-y-auto max-h-[90vh]">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-text-main">
                {editId ? 'Editar Actividad' : 'Nueva Actividad'}
              </h2>
              <button onClick={closeModal} className="rounded-lg p-1 text-text-sub hover:bg-slate-100 transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label-standard">Tipo de Actividad</label>
                  <select
                    value={form.tipo}
                    onChange={(e) => setForm({ ...form, tipo: e.target.value as TipoCarga })}
                    className="input-standard"
                  >
                    {TIPO_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label-standard">Horas Semanales</label>
                  <input
                    type="number"
                    required
                    min={1}
                    max={40}
                    value={form.horas}
                    onChange={(e) => setForm({ ...form, horas: Number(e.target.value) })}
                    className="input-standard"
                  />
                </div>
              </div>

              {form.tipo === 'INVESTIGACION' && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label-standard">Código del Proyecto</label>
                    <input
                      type="text"
                      value={form.codigoProyecto}
                      onChange={(e) => setForm({ ...form, codigoProyecto: e.target.value })}
                      className="input-standard"
                      placeholder="Ej: INV-2024-001"
                    />
                  </div>
                  <div>
                    <label className="label-standard">Nombre del Proyecto</label>
                    <input
                      type="text"
                      value={form.nombreProyecto}
                      onChange={(e) => setForm({ ...form, nombreProyecto: e.target.value })}
                      className="input-standard"
                      placeholder="Título de la investigación..."
                    />
                  </div>
                </div>
              )}

              {form.tipo === 'CONSEJERIA' && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label-standard">Número de Alumnos</label>
                    <input
                      type="number"
                      value={form.numAlumnos}
                      onChange={(e) => setForm({ ...form, numAlumnos: e.target.value === '' ? '' : Number(e.target.value) })}
                      className="input-standard"
                    />
                  </div>
                  <div>
                    <label className="label-standard">Ciclo de Consejería</label>
                    <input
                      type="text"
                      value={form.cicloConsejeria}
                      onChange={(e) => setForm({ ...form, cicloConsejeria: e.target.value })}
                      className="input-standard"
                      placeholder="Ej: 2024-I"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="label-standard">Descripción / Justificación</label>
                <textarea
                  required
                  value={form.descripcion}
                  onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
                  className="input-standard h-20"
                  placeholder="Detalles de la actividad..."
                />
              </div>

              {/* Horarios Section */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="label-standard mb-0">Horario de la Actividad</label>
                  <button
                    type="button"
                    onClick={addBlock}
                    className="text-xs font-bold text-primary hover:text-primary-dark flex items-center gap-1"
                  >
                    <Plus className="h-3 w-3" /> Añadir Bloque
                  </button>
                </div>

                <div className="space-y-2">
                  {form.horarios.length === 0 ? (
                    <p className="text-[11px] text-text-sub italic bg-slate-50 p-3 rounded-lg border border-dashed">
                      No se han asignado bloques horarios aún.
                    </p>
                  ) : (
                    form.horarios.map((block, index) => (
                      <div key={index} className="grid grid-cols-[1fr_1fr_1fr_40px] gap-2 items-end bg-slate-50 p-2 rounded-lg border">
                        <div>
                          <label className="text-[10px] font-bold text-text-sub uppercase">Día</label>
                          <select
                            value={block.dia}
                            onChange={(e) => updateBlock(index, 'dia', e.target.value)}
                            className="input-standard py-1 text-xs"
                          >
                            {DIA_OPTIONS.map((d) => (
                              <option key={d.value} value={d.value}>{d.label}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-text-sub uppercase">Inicio</label>
                          <input
                            type="time"
                            value={block.horaInicio}
                            onChange={(e) => updateBlock(index, 'horaInicio', e.target.value)}
                            className="input-standard py-1 text-xs"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-text-sub uppercase">Fin</label>
                          <input
                            type="time"
                            value={block.horaFin}
                            onChange={(e) => updateBlock(index, 'horaFin', e.target.value)}
                            className="input-standard py-1 text-xs"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => removeBlock(index)}
                          className="p-2 text-danger hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-danger flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  {error}
                </div>
              )}

              <div className="pt-4 flex gap-3 border-t border-border">
                <button type="button" onClick={closeModal} className="btn-secondary flex-1" disabled={createMutation.isPending || updateMutation.isPending}>
                  Cancelar
                </button>
                <button type="submit" className="btn-primary flex-1" disabled={createMutation.isPending || updateMutation.isPending}>
                  {createMutation.isPending || updateMutation.isPending 
                    ? 'Guardando...' 
                    : (editId ? 'Actualizar' : 'Registrar')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete confirm dialog */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-zinc-700 bg-zinc-900 p-6 shadow-2xl">
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10">
                <Trash2 className="h-6 w-6 text-red-400" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">Eliminar Actividad</h3>
              <p className="text-sm text-zinc-400 mb-6">
                ¿Estás seguro de que deseas eliminar esta actividad no lectiva? Esta acción no se puede deshacer.
              </p>
              <div className="flex gap-3 justify-center">
                <button
                  onClick={() => setDeleteConfirmId(null)}
                  className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-400 hover:bg-zinc-800"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => deleteMutation.mutate({ id: deleteConfirmId })}
                  disabled={deleteMutation.isPending}
                  className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500 disabled:opacity-50"
                >
                  {deleteMutation.isPending ? 'Eliminando...' : 'Eliminar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
