'use client';

import { useState, useMemo } from 'react';
import { useTRPC } from '@/trpc/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  BookOpen,
  Clock,
  Users,
  Plus,
  Trash2,
  Pencil,
  X,
  Search,
  ChevronDown,
} from 'lucide-react';

const TIPO_OPTIONS = ['TEORIA', 'PRACTICA', 'LABORATORIO'] as const;

const TIPO_COLORS: Record<string, string> = {
  TEORIA: 'badge-info',
  PRACTICA: 'badge-success',
  LABORATORIO: 'badge-warning',
};

const canManage = (role?: string) =>
  role === 'ADMIN' || role === 'SECRETARIA_DEPARTAMENTO' || role === 'DIRECTOR_DEPARTAMENTO';

export default function CargaLectivaPage() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  // ── state ──────────────────────────────────────────────
  const [selectedPeriodoId, setSelectedPeriodoId] = useState('');
  const [filterDocenteId, setFilterDocenteId] = useState('');
  const [docenteSearch, setDocenteSearch] = useState('');
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // ── edit form state ────────────────────────────────────
  const [editHoras, setEditHoras] = useState(1);
  const [editCompartido, setEditCompartido] = useState(false);
  const [editDocenteCompartidoId, setEditDocenteCompartidoId] = useState('');

  // ── assign form state ──────────────────────────────────
  const [assignDocenteId, setAssignDocenteId] = useState('');
  const [assignGrupoId, setAssignGrupoId] = useState('');
  const [assignTipo, setAssignTipo] = useState<(typeof TIPO_OPTIONS)[number]>('TEORIA');
  const [assignHoras, setAssignHoras] = useState(4);
  const [assignCompartido, setAssignCompartido] = useState(false);
  const [assignDocenteCompartidoId, setAssignDocenteCompartidoId] = useState('');

  // ── queries ────────────────────────────────────────────
  const { data: user } = useQuery({ ...trpc.auth.me.queryOptions() });
  const { data: periodos = [] } = useQuery({ ...trpc.periodo.list.queryOptions() });

  const periodoId = selectedPeriodoId || (periodos.length > 0 ? periodos[0].id : '');

  const { data: cargasLectivas = [], isLoading } = useQuery({
    ...trpc.cargaLectiva.list.queryOptions({
      periodoId,
      docenteId: filterDocenteId || undefined,
    }),
    enabled: !!periodoId,
  });

  const { data: docentes = [] } = useQuery({
    ...trpc.docente.list.queryOptions({}),
  });

  const { data: cursos = [] } = useQuery({
    ...trpc.curso.list.queryOptions({}),
  });

  // ── derived ────────────────────────────────────────────
  const filteredDocentes = useMemo(() => {
    if (!docenteSearch) return docentes;
    const term = docenteSearch.toLowerCase();
    return docentes.filter(
      (d) =>
        d.nombre.toLowerCase().includes(term) || d.email.toLowerCase().includes(term)
    );
  }, [docentes, docenteSearch]);

  // Build a flat list of grupos with curso info for the active period
  const gruposForPeriod = useMemo(() => {
    const items: { grupoId: string; label: string }[] = [];
    for (const curso of cursos) {
      for (const grupo of curso.grupos ?? []) {
        if (grupo.periodoAcademicoId === periodoId) {
          items.push({
            grupoId: grupo.id,
            label: `${curso.codigo} - ${curso.nombre} - ${grupo.nombre}`,
          });
        }
      }
    }
    return items.sort((a, b) => a.label.localeCompare(b.label));
  }, [cursos, periodoId]);

  const totalHoras = cargasLectivas.reduce((s, c) => s + c.horasAsignadas, 0);
  const uniqueDocentes = new Set(cargasLectivas.map((c) => c.docenteId)).size;

  const isManager = canManage(user?.role);

  // For DOCENTE role — they only see their own
  const isDocente = user?.role === 'DOCENTE';

  // ── mutations ──────────────────────────────────────────
  const assignMutation = useMutation(
    trpc.cargaLectiva.assign.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: trpc.cargaLectiva.list.queryKey() });
        resetAssignForm();
        setShowAssignModal(false);
      },
      onError: (err) => {
        alert(err.message);
      },
    })
  );

  const unassignMutation = useMutation(
    trpc.cargaLectiva.unassign.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: trpc.cargaLectiva.list.queryKey() });
        setDeletingId(null);
      },
      onError: (err) => {
        alert(err.message);
      },
    })
  );

  const updateMutation = useMutation(
    trpc.cargaLectiva.update.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: trpc.cargaLectiva.list.queryKey() });
        setEditingId(null);
      },
      onError: (err) => {
        alert(err.message);
      },
    })
  );

  // ── helpers ────────────────────────────────────────────
  function resetAssignForm() {
    setAssignDocenteId('');
    setAssignGrupoId('');
    setAssignTipo('TEORIA');
    setAssignHoras(4);
    setAssignCompartido(false);
    setAssignDocenteCompartidoId('');
  }

  function openEditModal(carga: (typeof cargasLectivas)[number]) {
    setEditingId(carga.id);
    setEditHoras(carga.horasAsignadas);
    setEditCompartido(carga.compartido);
    setEditDocenteCompartidoId(carga.docenteCompartidoId ?? '');
  }

  function handleAssign() {
    if (!assignDocenteId || !assignGrupoId || !periodoId) return;
    assignMutation.mutate({
      docenteId: assignDocenteId,
      grupoId: assignGrupoId,
      periodoId,
      tipo: assignTipo,
      horasAsignadas: assignHoras,
      compartido: assignCompartido,
      docenteCompartidoId: assignCompartido ? assignDocenteCompartidoId || undefined : undefined,
    });
  }

  function handleUpdate() {
    if (!editingId) return;
    updateMutation.mutate({
      id: editingId,
      horasAsignadas: editHoras,
      compartido: editCompartido,
      docenteCompartidoId: editCompartido ? editDocenteCompartidoId || null : null,
    });
  }

  // ── DOCENTE view (read-only own loads) ─────────────────
  if (isDocente) {
    const docenteCargas = cargasLectivas.filter((c) => c.docenteId === user?.docenteId);

    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-text-main">Mi Carga Lectiva</h1>
          <p className="text-text-sub text-sm mt-1">
            Cursos asignados en el periodo actual
          </p>
        </div>

        <div className="table-standard">
          <table className="w-full text-left border-separate border-spacing-0">
            <thead>
              <tr>
                <th>Curso</th>
                <th>Grupo</th>
                <th>Tipo</th>
                <th className="text-center">Horas</th>
                <th className="text-center">Compartido</th>
              </tr>
            </thead>
            <tbody>
              {docenteCargas.map((carga) => (
                <tr key={carga.id} className="group transition-colors">
                  <td>
                    <p className="font-bold text-text-main group-hover:text-primary transition-colors">{carga.grupo.curso.codigo} - {carga.grupo.curso.nombre}</p>
                  </td>
                  <td>
                    <span className="badge badge-gray">{carga.grupo.nombre}</span>
                  </td>
                  <td>
                    <span className={`badge ${TIPO_COLORS[carga.tipo]}`}>
                      {carga.tipo}
                    </span>
                  </td>
                  <td className="text-center">
                    <span className="text-xs font-bold text-primary bg-primary-light px-2 py-1 rounded-md border border-primary/10">{carga.horasAsignadas}h</span>
                  </td>
                  <td className="text-center">
                    {carga.compartido ? (
                      <span className="badge badge-info">
                        Con {carga.docenteCompartido?.nombre}
                      </span>
                    ) : (
                      <span className="text-text-sub/50">—</span>
                    )}
                  </td>
                </tr>
              ))}
              {docenteCargas.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-12 text-center text-text-sub">
                    No tienes carga lectiva asignada en este periodo
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // ── access guard ───────────────────────────────────────
  if (!user || !isManager) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-6 text-center">
          <h2 className="text-lg font-semibold text-amber-400">Acceso Restringido</h2>
          <p className="text-zinc-400 mt-2">
            Solo administradores y secretarias de departamento pueden gestionar la carga
            lectiva.
          </p>
        </div>
      </div>
    );
  }

  // ── main management view ───────────────────────────────
  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Gestión de Carga Lectiva</h1>
          <p className="text-zinc-400 text-sm mt-1">
            Asignación de cursos a docentes por departamento
          </p>
        </div>
        <button
          onClick={() => {
            resetAssignForm();
            setShowAssignModal(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
        >
          <Plus size={16} />
          Asignar Carga
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        {/* Period selector */}
        <div className="relative">
          <select
            value={periodoId}
            onChange={(e) => setSelectedPeriodoId(e.target.value)}
            className="appearance-none bg-zinc-900/80 border border-zinc-800 text-white rounded-lg px-4 py-2 pr-10 text-sm focus:outline-none focus:border-blue-500"
          >
            {periodos.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
              </option>
            ))}
          </select>
          <ChevronDown
            size={14}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none"
          />
        </div>

        {/* Docente filter */}
        <div className="relative">
          <select
            value={filterDocenteId}
            onChange={(e) => setFilterDocenteId(e.target.value)}
            className="appearance-none bg-zinc-900/80 border border-zinc-800 text-white rounded-lg px-4 py-2 pr-10 text-sm focus:outline-none focus:border-blue-500 min-w-[220px]"
          >
            <option value="">Todos los docentes</option>
            {docentes.map((d) => (
              <option key={d.id} value={d.id}>
                {d.nombre}
              </option>
            ))}
          </select>
          <ChevronDown
            size={14}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none"
          />
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-zinc-900/80 border border-zinc-800 rounded-lg p-4 flex items-center gap-3">
          <div className="p-2 bg-blue-500/10 rounded-lg">
            <BookOpen size={20} className="text-blue-400" />
          </div>
          <div>
            <div className="text-zinc-400 text-sm">Asignaciones</div>
            <div className="text-2xl font-bold text-white">{cargasLectivas.length}</div>
          </div>
        </div>
        <div className="bg-zinc-900/80 border border-zinc-800 rounded-lg p-4 flex items-center gap-3">
          <div className="p-2 bg-emerald-500/10 rounded-lg">
            <Clock size={20} className="text-emerald-400" />
          </div>
          <div>
            <div className="text-zinc-400 text-sm">Total Horas</div>
            <div className="text-2xl font-bold text-white">{totalHoras}h</div>
          </div>
        </div>
        <div className="bg-zinc-900/80 border border-zinc-800 rounded-lg p-4 flex items-center gap-3">
          <div className="p-2 bg-purple-500/10 rounded-lg">
            <Users size={20} className="text-purple-400" />
          </div>
          <div>
            <div className="text-zinc-400 text-sm">Docentes</div>
            <div className="text-2xl font-bold text-white">{uniqueDocentes}</div>
          </div>
        </div>
      </div>

      {/* Table */}
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
                <th className="text-center p-3 text-zinc-400 font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {cargasLectivas.map((carga) => (
                <tr
                  key={carga.id}
                  className="border-t border-zinc-800 hover:bg-zinc-800/50"
                >
                  <td className="p-3 text-white">{carga.docente.nombre}</td>
                  <td className="p-3 text-zinc-300">
                    {carga.grupo.curso.codigo} - {carga.grupo.curso.nombre}
                  </td>
                  <td className="p-3 text-zinc-300">{carga.grupo.nombre}</td>
                  <td className="p-3">
                    <span
                      className={`px-2 py-0.5 rounded text-xs ${TIPO_COLORS[carga.tipo]}`}
                    >
                      {carga.tipo}
                    </span>
                  </td>
                  <td className="p-3 text-center text-white font-mono">
                    {carga.horasAsignadas}h
                  </td>
                  <td className="p-3 text-center">
                    {carga.compartido ? (
                      <span className="px-2 py-0.5 rounded text-xs bg-purple-500/20 text-purple-400">
                        Con {carga.docenteCompartido?.nombre}
                      </span>
                    ) : (
                      <span className="text-zinc-600">—</span>
                    )}
                  </td>
                  <td className="p-3 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        onClick={() => openEditModal(carga)}
                        className="p-1.5 text-zinc-400 hover:text-blue-400 hover:bg-blue-500/10 rounded transition-colors"
                        title="Editar"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => setDeletingId(carga.id)}
                        className="p-1.5 text-zinc-400 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"
                        title="Eliminar"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {cargasLectivas.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-6 text-center text-zinc-500">
                    No hay asignaciones de carga lectiva para este periodo
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Assign Modal ────────────────────────────────── */}
      {showAssignModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl w-full max-w-lg mx-4 shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-zinc-800">
              <h2 className="text-lg font-semibold text-white">Asignar Carga Lectiva</h2>
              <button
                onClick={() => setShowAssignModal(false)}
                className="text-zinc-400 hover:text-white transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Body */}
            <div className="p-5 space-y-4">
              {/* Docente */}
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1">
                  Docente
                </label>
                <div className="relative mb-2">
                  <Search
                    size={14}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500"
                  />
                  <input
                    type="text"
                    placeholder="Buscar docente..."
                    value={docenteSearch}
                    onChange={(e) => setDocenteSearch(e.target.value)}
                    className="w-full bg-zinc-800 border border-zinc-700 text-white rounded-lg pl-9 pr-3 py-2 text-sm placeholder:text-zinc-500 focus:outline-none focus:border-blue-500"
                  />
                </div>
                <select
                  value={assignDocenteId}
                  onChange={(e) => setAssignDocenteId(e.target.value)}
                  className="w-full bg-zinc-800 border border-zinc-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                >
                  <option value="">Seleccionar docente</option>
                  {filteredDocentes.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.nombre}
                    </option>
                  ))}
                </select>
              </div>

              {/* Grupo */}
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1">
                  Grupo (Curso)
                </label>
                <select
                  value={assignGrupoId}
                  onChange={(e) => setAssignGrupoId(e.target.value)}
                  className="w-full bg-zinc-800 border border-zinc-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                >
                  <option value="">Seleccionar grupo</option>
                  {gruposForPeriod.map((g) => (
                    <option key={g.grupoId} value={g.grupoId}>
                      {g.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Tipo + Horas */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-1">
                    Tipo
                  </label>
                  <select
                    value={assignTipo}
                    onChange={(e) =>
                      setAssignTipo(e.target.value as (typeof TIPO_OPTIONS)[number])
                    }
                    className="w-full bg-zinc-800 border border-zinc-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                  >
                    {TIPO_OPTIONS.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-1">
                    Horas
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={40}
                    value={assignHoras}
                    onChange={(e) => setAssignHoras(Number(e.target.value))}
                    className="w-full bg-zinc-800 border border-zinc-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Compartido */}
              <div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={assignCompartido}
                    onChange={(e) => setAssignCompartido(e.target.checked)}
                    className="w-4 h-4 rounded border-zinc-600 bg-zinc-800 text-blue-500 focus:ring-blue-500 focus:ring-offset-0"
                  />
                  <span className="text-sm text-zinc-300">Compartido con otro docente</span>
                </label>
              </div>

              {assignCompartido && (
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-1">
                    Docente compartido
                  </label>
                  <select
                    value={assignDocenteCompartidoId}
                    onChange={(e) => setAssignDocenteCompartidoId(e.target.value)}
                    className="w-full bg-zinc-800 border border-zinc-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                  >
                    <option value="">Seleccionar docente</option>
                    {docentes
                      .filter((d) => d.id !== assignDocenteId)
                      .map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.nombre}
                        </option>
                      ))}
                  </select>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 p-5 border-t border-zinc-800">
              <button
                onClick={() => setShowAssignModal(false)}
                className="px-4 py-2 text-sm text-zinc-400 hover:text-white transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleAssign}
                disabled={
                  !assignDocenteId ||
                  !assignGrupoId ||
                  assignHoras < 1 ||
                  assignMutation.isPending
                }
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors"
              >
                {assignMutation.isPending ? 'Asignando...' : 'Asignar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit Modal ──────────────────────────────────── */}
      {editingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl w-full max-w-md mx-4 shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-zinc-800">
              <h2 className="text-lg font-semibold text-white">Editar Asignación</h2>
              <button
                onClick={() => setEditingId(null)}
                className="text-zinc-400 hover:text-white transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Body */}
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1">
                  Horas asignadas
                </label>
                <input
                  type="number"
                  min={1}
                  max={40}
                  value={editHoras}
                  onChange={(e) => setEditHoras(Number(e.target.value))}
                  className="w-full bg-zinc-800 border border-zinc-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editCompartido}
                    onChange={(e) => setEditCompartido(e.target.checked)}
                    className="w-4 h-4 rounded border-zinc-600 bg-zinc-800 text-blue-500 focus:ring-blue-500 focus:ring-offset-0"
                  />
                  <span className="text-sm text-zinc-300">Compartido con otro docente</span>
                </label>
              </div>

              {editCompartido && (
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-1">
                    Docente compartido
                  </label>
                  <select
                    value={editDocenteCompartidoId}
                    onChange={(e) => setEditDocenteCompartidoId(e.target.value)}
                    className="w-full bg-zinc-800 border border-zinc-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                  >
                    <option value="">Seleccionar docente</option>
                    {docentes.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.nombre}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 p-5 border-t border-zinc-800">
              <button
                onClick={() => setEditingId(null)}
                className="px-4 py-2 text-sm text-zinc-400 hover:text-white transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleUpdate}
                disabled={editHoras < 1 || updateMutation.isPending}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors"
              >
                {updateMutation.isPending ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Confirmation Modal ───────────────────── */}
      {deletingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl w-full max-w-sm mx-4 shadow-2xl">
            <div className="p-5 space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-500/10 rounded-lg">
                  <Trash2 size={20} className="text-red-400" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-white">Eliminar Asignación</h2>
                  <p className="text-zinc-400 text-sm">
                    ¿Estás seguro? Esta acción no se puede deshacer.
                  </p>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 p-5 border-t border-zinc-800">
              <button
                onClick={() => setDeletingId(null)}
                className="px-4 py-2 text-sm text-zinc-400 hover:text-white transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => unassignMutation.mutate({ id: deletingId })}
                disabled={unassignMutation.isPending}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
              >
                {unassignMutation.isPending ? 'Eliminando...' : 'Eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
