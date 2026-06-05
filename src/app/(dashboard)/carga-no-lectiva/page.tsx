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
  PREPARACION_EVALUACION: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  CONSEJERIA: 'bg-green-500/20 text-green-400 border-green-500/30',
  INVESTIGACION: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  CAPACITACION: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  GOBIERNO: 'bg-red-500/20 text-red-400 border-red-500/30',
  ADMINISTRACION: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  ASESORIA_TESIS: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
  RESPONSABILIDAD_SOCIAL: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  COMITES_COMISIONES: 'bg-pink-500/20 text-pink-400 border-pink-500/30',
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

  // Mutations
  const createMutation = useMutation(
    trpc.cargaNoLectiva.create.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: trpc.cargaNoLectiva.list.queryKey() });
        queryClient.invalidateQueries({ queryKey: trpc.cargaNoLectiva.byDocente.queryKey() });
        closeModal();
      },
      onError: (err) => setError(err.message),
    })
  );

  const updateMutation = useMutation(
    trpc.cargaNoLectiva.update.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: trpc.cargaNoLectiva.list.queryKey() });
        queryClient.invalidateQueries({ queryKey: trpc.cargaNoLectiva.byDocente.queryKey() });
        closeModal();
      },
      onError: (err) => setError(err.message),
    })
  );

  const deleteMutation = useMutation(
    trpc.cargaNoLectiva.delete.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: trpc.cargaNoLectiva.list.queryKey() });
        queryClient.invalidateQueries({ queryKey: trpc.cargaNoLectiva.byDocente.queryKey() });
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
      <div className="bg-zinc-900/80 border border-zinc-800 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-800 bg-zinc-900/50">
              <th className="px-4 py-3 text-left font-medium text-zinc-400">Actividad</th>
              <th className="px-4 py-3 text-center font-medium text-zinc-400">Horas</th>
              <th className="px-4 py-3 text-left font-medium text-zinc-400">Horario</th>
              <th className="px-4 py-3 text-left font-medium text-zinc-400">Descripción</th>
              <th className="px-4 py-3 text-right font-medium text-zinc-400">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={5} className="px-4 py-12 text-center text-zinc-600">Cargando...</td></tr>
            ) : cargasNoLectivas.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-12 text-center text-zinc-600">No hay actividades no lectivas registradas</td></tr>
            ) : (
              cargasNoLectivas.map((carga) => {
                const horarios = (carga as Record<string, unknown>).horarios as { dia: string; horaInicio: string; horaFin: string }[] | undefined;
                return (
                  <tr key={carga.id} className="border-t border-zinc-800 hover:bg-zinc-800/30">
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${TIPO_BADGE[carga.tipo] || 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30'}`}>
                        {TIPO_LABELS[carga.tipo] || carga.tipo}
                      </span>
                      {carga.codigoProyecto && (
                        <div className="text-xs text-zinc-500 mt-1">Proyecto: {carga.codigoProyecto}</div>
                      )}
                      {carga.numAlumnos && (
                        <div className="text-xs text-zinc-500 mt-1">{carga.numAlumnos} alumnos · Ciclo {carga.cicloConsejeria}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center text-white font-mono font-medium">{carga.horas}h</td>
                    <td className="px-4 py-3 text-zinc-400 text-xs">
                      {formatHorarios(horarios || [])}
                    </td>
                    <td className="px-4 py-3 text-zinc-400 max-w-[200px] truncate">{carga.descripcion || '—'}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openEdit(carga)}
                          className="rounded-md p-1.5 text-zinc-500 hover:bg-zinc-700 hover:text-zinc-300"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => setDeleteConfirmId(carga.id)}
                          className="rounded-md p-1.5 text-zinc-500 hover:bg-red-900/30 hover:text-red-400"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
            {cargasNoLectivas.length > 0 && (
              <tr className="border-t-2 border-zinc-700 bg-zinc-800/30">
                <td className="px-4 py-3 font-bold text-white">Total</td>
                <td className="px-4 py-3 text-center font-bold text-white font-mono">{totalNoLectivas}h</td>
                <td colSpan={3} />
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-zinc-700 bg-zinc-900 p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-white">
                {editId ? 'Editar Actividad' : 'Nueva Actividad No Lectiva'}
              </h2>
              <button onClick={closeModal} className="rounded-lg p-1 text-zinc-500 hover:bg-zinc-800">
                <X className="h-5 w-5" />
              </button>
            </div>

            {error && (
              <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Tipo */}
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">Tipo de Actividad</label>
                <select
                  value={form.tipo}
                  onChange={(e) => setForm({ ...form, tipo: e.target.value as TipoCarga })}
                  disabled={!!editId}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-200 focus:border-indigo-500 focus:outline-none disabled:opacity-50"
                >
                  {TIPO_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              {/* Horas + Descripción */}
              <div className="grid grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1">Horas</label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={form.horas}
                    onChange={(e) => setForm({ ...form, horas: Number(e.target.value) })}
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-200 focus:border-indigo-500 focus:outline-none"
                  />
                </div>
                <div className="col-span-3">
                  <label className="block text-xs font-medium text-zinc-400 mb-1">Descripción</label>
                  <textarea
                    value={form.descripcion}
                    onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
                    rows={2}
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-200 focus:border-indigo-500 focus:outline-none resize-none"
                    placeholder="Descripción de la actividad..."
                  />
                </div>
              </div>

              {/* Conditional: INVESTIGACION */}
              {form.tipo === 'INVESTIGACION' && (
                <div className="grid grid-cols-2 gap-3 rounded-lg border border-purple-500/20 bg-purple-500/5 p-3">
                  <div>
                    <label className="block text-xs font-medium text-purple-400 mb-1">Código de Proyecto</label>
                    <input
                      type="text"
                      value={form.codigoProyecto}
                      onChange={(e) => setForm({ ...form, codigoProyecto: e.target.value })}
                      className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-200 focus:border-purple-500 focus:outline-none"
                      placeholder="PJ-2026-001"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-purple-400 mb-1">Nombre del Proyecto</label>
                    <input
                      type="text"
                      value={form.nombreProyecto}
                      onChange={(e) => setForm({ ...form, nombreProyecto: e.target.value })}
                      className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-200 focus:border-purple-500 focus:outline-none"
                      placeholder="Nombre del proyecto de investigación"
                    />
                  </div>
                </div>
              )}

              {/* Conditional: CONSEJERIA */}
              {form.tipo === 'CONSEJERIA' && (
                <div className="grid grid-cols-2 gap-3 rounded-lg border border-green-500/20 bg-green-500/5 p-3">
                  <div>
                    <label className="block text-xs font-medium text-green-400 mb-1">Número de Alumnos</label>
                    <input
                      type="number"
                      min={1}
                      value={form.numAlumnos}
                      onChange={(e) => setForm({ ...form, numAlumnos: e.target.value === '' ? '' : Number(e.target.value) })}
                      className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-200 focus:border-green-500 focus:outline-none"
                      placeholder="30"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-green-400 mb-1">Ciclo de Consejería</label>
                    <input
                      type="text"
                      value={form.cicloConsejeria}
                      onChange={(e) => setForm({ ...form, cicloConsejeria: e.target.value })}
                      className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-200 focus:border-green-500 focus:outline-none"
                      placeholder="III"
                    />
                  </div>
                </div>
              )}

              {/* Schedule blocks */}
              <div className="rounded-lg border border-zinc-700 bg-zinc-800/50 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium text-zinc-300 flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-zinc-400" />
                    Horario Asignado
                  </h3>
                  <button
                    type="button"
                    onClick={addBlock}
                    className="flex items-center gap-1 rounded-md border border-zinc-600 px-2 py-1 text-xs text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200"
                  >
                    <Plus className="h-3 w-3" /> Agregar bloque
                  </button>
                </div>

                {form.horarios.length === 0 && (
                  <p className="text-xs text-zinc-500 text-center py-2">
                    No hay bloques horarios asignados. Agrega uno con el botón de arriba.
                  </p>
                )}

                {form.horarios.map((block, idx) => (
                  <div key={idx} className="grid grid-cols-[1fr_1fr_1fr_1fr_1fr_auto] gap-2 items-end">
                    <div>
                      <label className="block text-[10px] font-medium text-zinc-500 mb-0.5">Día</label>
                      <select
                        value={block.dia}
                        onChange={(e) => updateBlock(idx, 'dia', e.target.value)}
                        className="w-full rounded border border-zinc-600 bg-zinc-800 px-2 py-1.5 text-xs text-zinc-200 focus:border-indigo-500 focus:outline-none"
                      >
                        {DIA_OPTIONS.map((d) => (
                          <option key={d.value} value={d.value}>{d.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-medium text-zinc-500 mb-0.5">Inicio</label>
                      <input
                        type="time"
                        value={block.horaInicio}
                        onChange={(e) => updateBlock(idx, 'horaInicio', e.target.value)}
                        className="w-full rounded border border-zinc-600 bg-zinc-800 px-2 py-1.5 text-xs text-zinc-200 focus:border-indigo-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-medium text-zinc-500 mb-0.5">Fin</label>
                      <input
                        type="time"
                        value={block.horaFin}
                        onChange={(e) => updateBlock(idx, 'horaFin', e.target.value)}
                        className="w-full rounded border border-zinc-600 bg-zinc-800 px-2 py-1.5 text-xs text-zinc-200 focus:border-indigo-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-medium text-zinc-500 mb-0.5">Lugar</label>
                      <input
                        type="text"
                        value={block.lugar}
                        onChange={(e) => updateBlock(idx, 'lugar', e.target.value)}
                        placeholder="F01"
                        className="w-full rounded border border-zinc-600 bg-zinc-800 px-2 py-1.5 text-xs text-zinc-200 focus:border-indigo-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-medium text-zinc-500 mb-0.5">Aula</label>
                      <input
                        type="text"
                        value={block.aula}
                        onChange={(e) => updateBlock(idx, 'aula', e.target.value)}
                        placeholder="Lab 01"
                        className="w-full rounded border border-zinc-600 bg-zinc-800 px-2 py-1.5 text-xs text-zinc-200 focus:border-indigo-500 focus:outline-none"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => removeBlock(idx)}
                      className="rounded p-1 text-zinc-500 hover:bg-red-900/30 hover:text-red-400 mb-0.5"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-400 hover:bg-zinc-800"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
                  disabled={createMutation.isPending || updateMutation.isPending}
                >
                  {createMutation.isPending || updateMutation.isPending
                    ? 'Guardando...'
                    : editId ? 'Guardar Cambios' : 'Crear Actividad'}
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
