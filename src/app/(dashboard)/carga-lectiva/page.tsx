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
  Check,
  Award,
  AlertCircle,
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

  const { data: postulantes = [], isLoading: isLoadingPostulantes } = useQuery({
    ...trpc.cargaLectiva.postulantesByGrupo.queryOptions({ 
      grupoId: assignGrupoId 
    }),
    enabled: !!assignGrupoId && showAssignModal,
  });

  const { data: docentes = [] } = useQuery({
    ...trpc.docente.list.queryOptions({}),
  });

  const uniqueDocentesList = useMemo(() => {
    const seen = new Set();
    return docentes.filter((d) => {
      const emailKey = d.email.toLowerCase().trim();
      if (seen.has(d.id) || seen.has(emailKey)) return false;
      seen.add(d.id);
      seen.add(emailKey);
      return true;
    });
  }, [docentes]);

  const { data: cursos = [] } = useQuery({
    ...trpc.curso.list.queryOptions({ 
      periodoId: periodoId || undefined,
      vista: 'CATALOGO'
    }),
    enabled: !!periodoId,
  });

  // ── derived ────────────────────────────────────────────
  const filteredDocentes = useMemo(() => {
    if (!docenteSearch) return uniqueDocentesList;
    const term = docenteSearch.toLowerCase();
    return uniqueDocentesList.filter(
      (d) =>
        d.nombre.toLowerCase().includes(term) || d.email.toLowerCase().includes(term)
    );
  }, [uniqueDocentesList, docenteSearch]);

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
  const uniqueDocentesCount = new Set(cargasLectivas.map((c) => c.docenteId)).size;

  // Group assignments by docente
  const groupedCargas = useMemo(() => {
    const groups: Record<string, {
      docente: (typeof cargasLectivas)[0]['docente'];
      asignaciones: (typeof cargasLectivas);
      totalHoras: number;
    }> = {};

    cargasLectivas.forEach((carga) => {
      const dId = carga.docenteId;
      if (!groups[dId]) {
        groups[dId] = {
          docente: carga.docente,
          asignaciones: [],
          totalHoras: 0,
        };
      }
      groups[dId].asignaciones.push(carga);
      groups[dId].totalHoras += carga.horasAsignadas;
    });

    return Object.values(groups).sort((a, b) => a.docente.nombre.localeCompare(b.docente.nombre));
  }, [cargasLectivas]);

  const isManager = canManage(user?.role);

  // For DOCENTE role — they only see their own
  const isDocente = user?.role === 'DOCENTE';

  const selectedCursoForAssign = useMemo(() => {
    if (!assignGrupoId) return null;
    return cursos.find((c) => c.grupos?.some((g) => g.id === assignGrupoId));
  }, [cursos, assignGrupoId]);

  const selectedCargaForEdit = useMemo(() => {
    if (!editingId) return null;
    return cargasLectivas.find((c) => c.id === editingId);
  }, [cargasLectivas, editingId]);

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
                    <p className="text-[10px] text-text-sub mt-0.5">
                      Horas: {carga.grupo.curso.horasTeoria}T / {carga.grupo.curso.horasPractica}P / {carga.grupo.curso.horasLaboratorio}L ({carga.grupo.curso.numGruposLaboratorio} G. Lab) | LECTIVAS: {carga.grupo.curso.horasTeoria + carga.grupo.curso.horasPractica + (carga.grupo.curso.numGruposLaboratorio * carga.grupo.curso.horasLaboratorio)}h
                    </p>
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
            {uniqueDocentesList.map((d) => (
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
            <div className="text-2xl font-bold text-white">{uniqueDocentesCount}</div>
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
                <th className="text-left p-3 text-zinc-400 font-medium">Cursos Asignados</th>
                <th className="text-center p-3 text-zinc-400 font-medium">Total Horas</th>
              </tr>
            </thead>
            <tbody>
              {groupedCargas.map((group) => (
                <tr
                  key={group.docente.id}
                  className="border-t border-zinc-800 hover:bg-zinc-800/30 transition-colors"
                >
                  <td className="p-3 align-top">
                    <div className="flex flex-col">
                      <span className="text-white font-semibold">{group.docente.nombre}</span>
                      <span className="text-zinc-500 text-xs">{group.docente.email}</span>
                      <span className="text-[10px] text-zinc-600 mt-1 uppercase font-bold tracking-wider">
                        {group.docente.categoria} • {group.docente.modalidad}
                      </span>
                    </div>
                  </td>
                  <td className="p-3">
                    <div className="space-y-2">
                      {group.asignaciones.map((carga) => (
                        <div key={carga.id} className="flex items-center justify-between bg-zinc-800/50 p-2 rounded-lg group/item">
                          <div className="flex flex-col gap-0.5">
                            <div className="flex items-center gap-2">
                              <span className="text-blue-400 font-bold text-xs">{carga.grupo.curso.codigo}</span>
                              <span className="text-zinc-300 text-sm">{carga.grupo.curso.nombre}</span>
                              <span className="badge badge-gray text-[10px]">{carga.grupo.nombre}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${TIPO_COLORS[carga.tipo]}`}>
                                {carga.tipo}
                              </span>
                              <span className="text-zinc-500 text-[10px] font-medium">{carga.horasAsignadas}h</span>
                              {carga.compartido && (
                                <span className="text-[10px] bg-purple-500/10 text-purple-400 px-1.5 py-0.5 rounded border border-purple-500/20">
                                  Compartido con {carga.docenteCompartido?.nombre}
                                </span>
                              )}
                              <span className="text-[10px] text-zinc-500 font-medium">
                                • Curso: {carga.grupo.curso.horasTeoria}T/{carga.grupo.curso.horasPractica}P/{carga.grupo.curso.horasLaboratorio}L ({carga.grupo.curso.numGruposLaboratorio} G. Lab)
                              </span>
                              <span className="text-[10px] text-blue-400 font-bold">
                                • LECTIVAS: {carga.grupo.curso.horasTeoria + carga.grupo.curso.horasPractica + (carga.grupo.curso.numGruposLaboratorio * carga.grupo.curso.horasLaboratorio)}h
                              </span>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-1 opacity-0 group-hover/item:opacity-100 transition-opacity">
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
                        </div>
                      ))}
                    </div>
                  </td>
                  <td className="p-3 text-center align-top">
                    <div className="inline-flex flex-col items-center justify-center bg-blue-500/10 border border-blue-500/20 rounded-lg p-2 min-w-[60px]">
                      <span className="text-xl font-bold text-blue-400 leading-none">{group.totalHoras}</span>
                      <span className="text-[10px] text-blue-400/60 font-bold uppercase tracking-widest mt-1">Horas</span>
                    </div>
                  </td>
                </tr>
              ))}
              {groupedCargas.length === 0 && (
                <tr>
                  <td colSpan={3} className="p-12 text-center">
                    <div className="flex flex-col items-center gap-2 text-zinc-500">
                      <Users size={32} className="opacity-20" />
                      <p>No hay asignaciones de carga lectiva para este periodo</p>
                    </div>
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

              {/* Curso details and computed LECTIVAS */}
              {selectedCursoForAssign && (
                <div className="bg-zinc-800/40 border border-zinc-800 rounded-lg p-3 space-y-2">
                  <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Detalles del Curso</p>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="text-zinc-400">Horas:</div>
                    <div className="text-white font-medium text-right">
                      {selectedCursoForAssign.horasTeoria}T / {selectedCursoForAssign.horasPractica}P / {selectedCursoForAssign.horasLaboratorio}L
                    </div>
                    <div className="text-zinc-400">Grupos de Lab:</div>
                    <div className="text-white font-medium text-right">
                      {selectedCursoForAssign.numGruposLaboratorio}
                    </div>
                    <div className="text-blue-400 font-bold border-t border-zinc-800 pt-1.5 mt-1">Calculado LECTIVAS:</div>
                    <div className="text-blue-400 font-bold border-t border-zinc-800 pt-1.5 mt-1 text-right">
                      {selectedCursoForAssign.horasTeoria + selectedCursoForAssign.horasPractica + (selectedCursoForAssign.numGruposLaboratorio * selectedCursoForAssign.horasLaboratorio)}h
                    </div>
                  </div>
                </div>
              )}

              {/* Postulantes al curso */}
              {assignGrupoId && (
                <div className="bg-zinc-800/50 border border-zinc-700/50 rounded-lg overflow-hidden">
                  <div className="px-3 py-2 bg-zinc-800 border-b border-zinc-700 flex items-center justify-between">
                    <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Award size={14} className="text-amber-500" />
                      Postulantes al curso
                    </span>
                    {isLoadingPostulantes && (
                      <div className="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                    )}
                  </div>
                  <div className="max-h-[160px] overflow-y-auto">
                    {postulantes.length > 0 ? (
                      <div className="divide-y divide-zinc-800">
                        {postulantes.map((p) => (
                          <div 
                            key={p.docente.id} 
                            className={`p-2.5 flex items-center justify-between hover:bg-zinc-800 transition-colors ${assignDocenteId === p.docente.id ? 'bg-blue-500/5' : ''}`}
                          >
                            <div className="flex flex-col gap-0.5 min-w-0">
                              <span className={`text-sm font-medium truncate ${assignDocenteId === p.docente.id ? 'text-blue-400' : 'text-zinc-200'}`}>
                                {p.docente.nombre}
                              </span>
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] text-zinc-500 uppercase font-bold">Prioridad {p.prioridad}</span>
                                <span className="text-[10px] text-emerald-500 font-bold bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                                  {p.compatibilidad.toFixed(0)}% compatibilidad
                                </span>
                              </div>
                            </div>
                            <button
                              onClick={() => setAssignDocenteId(p.docente.id)}
                              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-bold transition-all ${
                                assignDocenteId === p.docente.id
                                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
                                  : 'bg-zinc-700 hover:bg-zinc-600 text-zinc-300'
                              }`}
                            >
                              {assignDocenteId === p.docente.id ? (
                                <>
                                  <Check size={12} strokeWidth={3} />
                                  Seleccionado
                                </>
                              ) : (
                                'Seleccionar'
                              )}
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : !isLoadingPostulantes ? (
                      <div className="p-6 text-center">
                        <div className="flex flex-col items-center gap-2">
                          <AlertCircle size={20} className="text-zinc-600" />
                          <p className="text-xs text-zinc-500 font-medium">No hay docentes postulados para este curso</p>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              )}

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
                    {uniqueDocentesList
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
              {/* Curso details and computed LECTIVAS */}
              {selectedCargaForEdit && (
                <div className="bg-zinc-800/40 border border-zinc-800 rounded-lg p-3 space-y-2 mb-4">
                  <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Detalles del Curso</p>
                  <p className="text-sm font-semibold text-white">{selectedCargaForEdit.grupo.curso.nombre}</p>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="text-zinc-400">Horas:</div>
                    <div className="text-white font-medium text-right">
                      {selectedCargaForEdit.grupo.curso.horasTeoria}T / {selectedCargaForEdit.grupo.curso.horasPractica}P / {selectedCargaForEdit.grupo.curso.horasLaboratorio}L
                    </div>
                    <div className="text-zinc-400">Grupos de Lab:</div>
                    <div className="text-white font-medium text-right">
                      {selectedCargaForEdit.grupo.curso.numGruposLaboratorio}
                    </div>
                    <div className="text-blue-400 font-bold border-t border-zinc-800 pt-1.5 mt-1">Calculado LECTIVAS:</div>
                    <div className="text-blue-400 font-bold border-t border-zinc-800 pt-1.5 mt-1 text-right">
                      {selectedCargaForEdit.grupo.curso.horasTeoria + selectedCargaForEdit.grupo.curso.horasPractica + (selectedCargaForEdit.grupo.curso.numGruposLaboratorio * selectedCargaForEdit.grupo.curso.horasLaboratorio)}h
                    </div>
                  </div>
                </div>
              )}

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
                    {uniqueDocentesList.map((d) => (
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
