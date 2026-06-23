'use client';

import { useState, useMemo, useEffect } from 'react';
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
  const [tableSearch, setTableSearch] = useState('');
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'docentes' | 'cursos'>('docentes');

  // Unified modal states ───────────────────────────────
  const [docenteId, setDocenteId] = useState('');
  const [grupoId, setGrupoId] = useState('');
  const [modalCurriculaId, setModalCurriculaId] = useState<string>('');
  const [modalCiclo, setModalCiclo] = useState<string>('');

  // Teoría
  const [horasTeoria, setHorasTeoria] = useState(0);
  const [teoriaCompartido, setTeoriaCompartido] = useState(false);
  const [teoriaDocenteCompartidoId, setTeoriaDocenteCompartidoId] = useState('');
  const [horasTeoriaCompartido, setHorasTeoriaCompartido] = useState(0);

  // Práctica
  const [horasPractica, setHorasPractica] = useState(0);
  const [practicaCompartido, setPracticaCompartido] = useState(false);
  const [practicaDocenteCompartidoId, setPracticaDocenteCompartidoId] = useState('');
  const [horasPracticaCompartido, setHorasPracticaCompartido] = useState(0);

  // Laboratorio
  const [horasLaboratorioRaw, setHorasLaboratorioRaw] = useState(0);
  const [laboratorioCompartido, setLaboratorioCompartido] = useState(false);
  const [laboratorioDocenteCompartidoId, setLaboratorioDocenteCompartidoId] = useState('');
  const [horasLaboratorioCompartidoRaw, setHorasLaboratorioCompartidoRaw] = useState(0);
  const [gruposLaboratorio, setGruposLaboratorio] = useState<number[]>([]);
  const [gruposLaboratorioCompartido, setGruposLaboratorioCompartido] = useState<number[]>([]);

  // ── queries ────────────────────────────────────────────
  const { data: user } = useQuery({ ...trpc.auth.me.queryOptions() });
  const { data: periodos = [] } = useQuery({ ...trpc.periodo.list.queryOptions() });

  const activePeriod = periodos.find((p) => p.activo);
  const periodoId = selectedPeriodoId || activePeriod?.id || (periodos.length > 0 ? periodos[0].id : '');

  const { data: cargasLectivas = [], isLoading } = useQuery({
    ...trpc.cargaLectiva.list.queryOptions({
      periodoId,
      docenteId: filterDocenteId || undefined,
    }),
    enabled: !!periodoId,
  });

  const { data: postulantes = [], isLoading: isLoadingPostulantes } = useQuery({
    ...trpc.cargaLectiva.postulantesByGrupo.queryOptions({ 
      grupoId 
    }),
    enabled: !!grupoId && showAssignModal,
  });

  const { data: docentes = [] } = useQuery({
    ...trpc.docente.list.queryOptions({}),
  });
  const { data: curriculaList = [] } = useQuery({
    ...trpc.curricula.list.queryOptions({ vigente: true }),
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

  const { data: gruposDisponibles = [] } = useQuery({
    ...trpc.cargaLectiva.gruposDisponibles.queryOptions({ periodoId }),
    enabled: !!periodoId,
  });

  // Dynamic calculated hours based on numGruposLaboratorio
  const selectedCursoForAssign = useMemo(() => {
    if (!grupoId) return null;
    const g = gruposDisponibles.find((g) => g.id === grupoId);
    return g ? g.curso : null;
  }, [gruposDisponibles, grupoId]);

  const horasLaboratorio = useMemo(() => {
    if (selectedCursoForAssign && selectedCursoForAssign.numGruposLaboratorio > 1) {
      return gruposLaboratorio.length * selectedCursoForAssign.horasLaboratorio;
    }
    return horasLaboratorioRaw;
  }, [gruposLaboratorio, horasLaboratorioRaw, selectedCursoForAssign]);

  const horasLaboratorioCompartido = useMemo(() => {
    if (selectedCursoForAssign && selectedCursoForAssign.numGruposLaboratorio > 1) {
      return gruposLaboratorioCompartido.length * selectedCursoForAssign.horasLaboratorio;
    }
    return horasLaboratorioCompartidoRaw;
  }, [gruposLaboratorioCompartido, horasLaboratorioCompartidoRaw, selectedCursoForAssign]);

  // ── derived ────────────────────────────────────────────
  const filteredDocentes = useMemo(() => {
    if (!docenteSearch) return uniqueDocentesList;
    const term = docenteSearch.toLowerCase();
    return uniqueDocentesList.filter(
      (d) =>
        d.nombre.toLowerCase().includes(term) || d.email.toLowerCase().includes(term)
    );
  }, [uniqueDocentesList, docenteSearch]);

  // Auto-populate curricula and cycle if a group is pre-selected
  useEffect(() => {
    if (grupoId && gruposDisponibles.length > 0) {
      const g = gruposDisponibles.find((x) => x.id === grupoId);
      if (g && g.curso) {
        const firstCurriculaId = g.curso.cursoCurriculas?.[0]?.curriculaId || '';
        setModalCurriculaId(firstCurriculaId);
        setModalCiclo(String(g.curso.ciclo));
      }
    }
  }, [grupoId, gruposDisponibles]);

  // Build a flat list of unique cursos (using their first available group) for the active period
  const gruposForPeriod = useMemo(() => {
    const seenCursos = new Set();
    const uniqueGroups: typeof gruposDisponibles = [];
    gruposDisponibles.forEach((g) => {
      if (!seenCursos.has(g.curso.id)) {
        seenCursos.add(g.curso.id);
        uniqueGroups.push(g);
      }
    });
    return uniqueGroups.map((g) => ({
      grupoId: g.id,
      label: `${g.curso.codigo} - ${g.curso.nombre}`,
      ciclo: g.curso.ciclo,
      curriculaIds: g.curso.cursoCurriculas?.map((cc: any) => cc.curriculaId) || [],
      departamentoId: g.curso.departamentoId,
    }));
  }, [gruposDisponibles]);

  const filteredGruposForModal = useMemo(() => {
    return gruposForPeriod.filter((g) => {
      if (modalCurriculaId && !g.curriculaIds.includes(modalCurriculaId)) {
        return false;
      }
      if (modalCiclo && g.ciclo !== Number(modalCiclo)) {
        return false;
      }
      return true;
    });
  }, [gruposForPeriod, modalCurriculaId, modalCiclo]);

  const filteredDocentesForAssign = useMemo(() => {
    if (!selectedCursoForAssign || !selectedCursoForAssign.departamentoId) {
      return filteredDocentes;
    }
    return filteredDocentes.filter((d) => d.departamentoId === selectedCursoForAssign.departamentoId);
  }, [filteredDocentes, selectedCursoForAssign]);

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

  // Filter grouped charges by the table search (applies to docente view)
  const filteredGroupedCargas = useMemo(() => {
    if (!tableSearch.trim()) return groupedCargas;
    const term = tableSearch.toLowerCase();
    return groupedCargas
      .map((group) => {
        const docenteMatch =
          group.docente.nombre.toLowerCase().includes(term) ||
          group.docente.email.toLowerCase().includes(term);
        const matchingAsignaciones = group.asignaciones.filter((c) => {
          return (
            c.grupo.curso.codigo.toLowerCase().includes(term) ||
            c.grupo.curso.nombre.toLowerCase().includes(term) ||
            c.grupo.nombre.toLowerCase().includes(term) ||
            c.tipo.toLowerCase().includes(term)
          );
        });
        if (docenteMatch) return group;
        if (matchingAsignaciones.length > 0) {
          const totalHoras = matchingAsignaciones.reduce((s, c) => s + c.horasAsignadas, 0);
          return { ...group, asignaciones: matchingAsignaciones, totalHoras };
        }
        return null;
      })
      .filter((g): g is (typeof groupedCargas)[number] => g !== null);
  }, [groupedCargas, tableSearch]);

  // Filter cursos view by the table search
  const filteredGruposDisponibles = useMemo(() => {
    if (!tableSearch.trim()) return gruposDisponibles;
    const term = tableSearch.toLowerCase();
    return gruposDisponibles.filter(
      (g) =>
        g.curso.codigo.toLowerCase().includes(term) ||
        g.curso.nombre.toLowerCase().includes(term) ||
        g.nombre.toLowerCase().includes(term) ||
        String(g.curso.ciclo).includes(term)
    );
  }, [gruposDisponibles, tableSearch]);

  const isManager = canManage(user?.role);

  // For DOCENTE role — they only see their own
  const isDocente = user?.role === 'DOCENTE';

  // Whenever selectedCursoForAssign changes, default the input hours to course max hours if it's a new assignment (not editing)
  useEffect(() => {
    if (selectedCursoForAssign && !editingId) {
      setHorasTeoria(selectedCursoForAssign.horasTeoria);
      setHorasPractica(selectedCursoForAssign.horasPractica);
      if (selectedCursoForAssign.numGruposLaboratorio > 1) {
        // Default to select group 1 for the primary teacher
        setGruposLaboratorio([1]);
        setGruposLaboratorioCompartido([]);
        setHorasLaboratorioRaw(0);
        setHorasLaboratorioCompartidoRaw(0);
      } else {
        setGruposLaboratorio([]);
        setGruposLaboratorioCompartido([]);
        setHorasLaboratorioRaw(selectedCursoForAssign.horasLaboratorio);
        setHorasLaboratorioCompartidoRaw(0);
      }
    }
  }, [selectedCursoForAssign, editingId]);

  // ── mutations ──────────────────────────────────────────
  const assignCursoCompletoMutation = useMutation(
    trpc.cargaLectiva.assignCursoCompleto.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: trpc.cargaLectiva.list.queryKey() });
        setShowAssignModal(false);
        resetModalForm();
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

  // ── helpers ────────────────────────────────────────────
  function resetModalForm() {
    setEditingId(null);
    setDocenteId('');
    setGrupoId('');
    setModalCurriculaId('');
    setModalCiclo('');
    setHorasTeoria(0);
    setTeoriaCompartido(false);
    setTeoriaDocenteCompartidoId('');
    setHorasTeoriaCompartido(0);
    setHorasPractica(0);
    setPracticaCompartido(false);
    setPracticaDocenteCompartidoId('');
    setHorasPracticaCompartido(0);
    setHorasLaboratorioRaw(0);
    setLaboratorioCompartido(false);
    setLaboratorioDocenteCompartidoId('');
    setHorasLaboratorioCompartidoRaw(0);
    setGruposLaboratorio([]);
    setGruposLaboratorioCompartido([]);
  }

  function openAssignModal() {
    resetModalForm();
    setShowAssignModal(true);
  }

  function openEditModal(carga: (typeof cargasLectivas)[number]) {
    const primaryDocenteId = carga.docenteId;
    setEditingId(carga.id);
    setDocenteId(primaryDocenteId);
    setGrupoId(carga.grupoId);
    setShowAssignModal(true);

    const groupCargas = cargasLectivas.filter(c => c.grupoId === carga.grupoId);
    
    // Teoría
    const teoriaPrim = groupCargas.find(c => c.tipo === 'TEORIA' && c.docenteId === primaryDocenteId);
    const teoriaComp = groupCargas.find(c => c.tipo === 'TEORIA' && c.docenteId !== primaryDocenteId);
    setHorasTeoria(teoriaPrim ? teoriaPrim.horasAsignadas : 0);
    setTeoriaCompartido(!!teoriaComp || (teoriaPrim?.compartido ?? false));
    setTeoriaDocenteCompartidoId(teoriaComp?.docenteId ?? teoriaPrim?.docenteCompartidoId ?? '');
    setHorasTeoriaCompartido(teoriaComp ? teoriaComp.horasAsignadas : 0);

    // Práctica
    const practicaPrim = groupCargas.find(c => c.tipo === 'PRACTICA' && c.docenteId === primaryDocenteId);
    const practicaComp = groupCargas.find(c => c.tipo === 'PRACTICA' && c.docenteId !== primaryDocenteId);
    setHorasPractica(practicaPrim ? practicaPrim.horasAsignadas : 0);
    setPracticaCompartido(!!practicaComp || (practicaPrim?.compartido ?? false));
    setPracticaDocenteCompartidoId(practicaComp?.docenteId ?? practicaPrim?.docenteCompartidoId ?? '');
    setHorasPracticaCompartido(practicaComp ? practicaComp.horasAsignadas : 0);

    // Laboratorio
    const labPrimRecords = groupCargas.filter(c => c.tipo === 'LABORATORIO' && c.docenteId === primaryDocenteId);
    const labCompRecords = groupCargas.filter(c => c.tipo === 'LABORATORIO' && c.docenteId !== primaryDocenteId);
    
    const labPrim = labPrimRecords[0];
    const labComp = labCompRecords[0];

    const currentCurso = gruposDisponibles.find((g) => g.id === carga.grupoId)?.curso;
    setLaboratorioCompartido(!!labComp || (labPrim?.compartido ?? false));
    setLaboratorioDocenteCompartidoId(labComp?.docenteId ?? labPrim?.docenteCompartidoId ?? '');

    if (currentCurso && currentCurso.numGruposLaboratorio > 1) {
      setGruposLaboratorio(labPrimRecords.map(c => c.grupoLaboratorio).filter(Boolean) as number[]);
      setGruposLaboratorioCompartido(labCompRecords.map(c => c.grupoLaboratorio).filter(Boolean) as number[]);
      setHorasLaboratorioRaw(0);
      setHorasLaboratorioCompartidoRaw(0);
    } else {
      setGruposLaboratorio([]);
      setGruposLaboratorioCompartido([]);
      setHorasLaboratorioRaw(labPrim ? labPrim.horasAsignadas : 0);
      setHorasLaboratorioCompartidoRaw(labComp ? labComp.horasAsignadas : 0);
    }
  }

  function handleSave() {
    if (!docenteId || !grupoId || !periodoId) return;

    assignCursoCompletoMutation.mutate({
      docenteId,
      grupoId,
      periodoId,
      teoria: {
        horas: horasTeoria,
        compartido: teoriaCompartido,
        docenteCompartidoId: teoriaCompartido ? teoriaDocenteCompartidoId || null : null,
        horasCompartido: teoriaCompartido ? horasTeoriaCompartido : 0,
      },
      practica: {
        horas: horasPractica,
        compartido: practicaCompartido,
        docenteCompartidoId: practicaCompartido ? practicaDocenteCompartidoId || null : null,
        horasCompartido: practicaCompartido ? horasPracticaCompartido : 0,
      },
      laboratorio: {
        horas: horasLaboratorio,
        compartido: laboratorioCompartido,
        docenteCompartidoId: laboratorioCompartido ? laboratorioDocenteCompartidoId || null : null,
        horasCompartido: laboratorioCompartido ? horasLaboratorioCompartido : 0,
        gruposLaboratorio,
        gruposLaboratorioCompartido: laboratorioCompartido ? gruposLaboratorioCompartido : [],
      },
    });
  }

  // ── DOCENTE view (read-only own loads) ─────────────────
  if (isDocente) {
    const docenteCargas = cargasLectivas.filter(
      (c) => c.docenteId === user?.docenteId || c.docenteCompartidoId === user?.docenteId
    );

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
                        Con {carga.docenteId === user?.docenteId ? carga.docenteCompartido?.nombre : carga.docente?.nombre}
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
          onClick={openAssignModal}
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

        {/* Table search */}
        <div className="relative flex-1 min-w-[240px] max-w-md">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500"
          />
          <input
            type="text"
            placeholder={
              activeTab === 'docentes'
                ? 'Buscar docente, curso, código, tipo...'
                : 'Buscar curso, código, ciclo...'
            }
            value={tableSearch}
            onChange={(e) => setTableSearch(e.target.value)}
            className="w-full bg-zinc-900/80 border border-zinc-800 text-white rounded-lg pl-9 pr-3 py-2 text-sm placeholder:text-zinc-500 focus:outline-none focus:border-blue-500"
          />
          {tableSearch && (
            <button
              onClick={() => setTableSearch('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-zinc-500 hover:text-white"
              title="Limpiar"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-zinc-800">
        <button
          onClick={() => setActiveTab('docentes')}
          className={`px-5 py-2.5 text-sm font-semibold border-b-2 transition-all -mb-px ${
            activeTab === 'docentes'
              ? 'border-blue-500 text-blue-400'
              : 'border-transparent text-zinc-400 hover:text-zinc-200'
          }`}
        >
          Vista por Docentes
        </button>
        <button
          onClick={() => setActiveTab('cursos')}
          className={`px-5 py-2.5 text-sm font-semibold border-b-2 transition-all -mb-px ${
            activeTab === 'cursos'
              ? 'border-blue-500 text-blue-400'
              : 'border-transparent text-zinc-400 hover:text-zinc-200'
          }`}
        >
          Vista por Cursos
        </button>
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
      ) : activeTab === 'docentes' ? (
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
              {filteredGroupedCargas.map((group) => (
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
                              {carga.grupoLaboratorio && (
                                <span className="text-[9.5px] bg-zinc-800 text-zinc-400 px-1 rounded ml-1 font-semibold">
                                  Grupo Lab {carga.grupoLaboratorio}
                                </span>
                              )}
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
              {groupedCargas.length > 0 && filteredGroupedCargas.length === 0 && (
                <tr>
                  <td colSpan={3} className="p-12 text-center">
                    <div className="flex flex-col items-center gap-2 text-zinc-500">
                      <Search size={32} className="opacity-20" />
                      <p>No se encontraron resultados para "{tableSearch}"</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="bg-zinc-900/80 border border-zinc-800 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-zinc-800">
                <tr>
                  <th className="text-left p-3 text-zinc-400 font-medium">Curso / Grupo</th>
                  <th className="text-left p-3 text-zinc-400 font-medium text-xs">Teoría</th>
                  <th className="text-left p-3 text-zinc-400 font-medium text-xs">Práctica</th>
                  <th className="text-left p-3 text-zinc-400 font-medium text-xs">Laboratorio</th>
                  <th className="text-center p-3 text-zinc-400 font-medium text-xs">Total (Asig/Req)</th>
                  <th className="text-center p-3 text-zinc-400 font-medium text-xs">Faltan / Estado</th>
                  <th className="text-center p-3 text-zinc-400 font-medium text-xs">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {filteredGruposDisponibles.map((grupo) => {
                  const groupCargas = cargasLectivas.filter((c) => c.grupoId === grupo.id);
                  
                  // Teoría
                  const teoriaAssignments = groupCargas.filter((c) => c.tipo === 'TEORIA');
                  const teoriaAssigned = teoriaAssignments.reduce((sum, c) => sum + c.horasAsignadas, 0);
                  const teoriaRequired = grupo.curso.horasTeoria;
                  
                  // Práctica
                  const practicaAssignments = groupCargas.filter((c) => c.tipo === 'PRACTICA');
                  const practicaAssigned = practicaAssignments.reduce((sum, c) => sum + c.horasAsignadas, 0);
                  const practicaRequired = grupo.curso.horasPractica;
                  
                  // Laboratorio
                  const labAssignments = groupCargas.filter((c) => c.tipo === 'LABORATORIO');
                  const labAssigned = labAssignments.reduce((sum, c) => sum + c.horasAsignadas, 0);
                  const labRequired = (grupo.curso.numGruposLaboratorio || 1) * grupo.curso.horasLaboratorio;
                  
                  const totalRequired = teoriaRequired + practicaRequired + labRequired;
                  const totalAssigned = teoriaAssigned + practicaAssigned + labAssigned;
                  const pendingHours = totalRequired - totalAssigned;
                  
                  return (
                    <tr key={grupo.id} className="hover:bg-zinc-800/30 transition-colors border-t border-zinc-800">
                      <td className="p-3 align-middle">
                        <div className="flex flex-col">
                          <span className="text-white font-semibold">{grupo.curso.codigo} - {grupo.curso.nombre}</span>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="badge badge-gray text-[10px]">{grupo.nombre}</span>
                            <span className="text-[10px] text-zinc-500">Ciclo {grupo.curso.ciclo}</span>
                          </div>
                        </div>
                      </td>
                      
                      {/* Teoría */}
                      <td className="p-3 align-middle">
                        {teoriaRequired > 0 ? (
                          <div className="space-y-1">
                            <div className="flex items-center gap-1.5 text-xs">
                              <span className="text-zinc-500 font-medium">Asig:</span>
                              <span className={`font-bold ${teoriaAssigned === teoriaRequired ? 'text-emerald-400' : 'text-amber-400'}`}>
                                {teoriaAssigned}h / {teoriaRequired}h
                              </span>
                            </div>
                            {teoriaAssignments.map((a) => (
                              <p key={a.id} className="text-[10.5px] text-zinc-400 leading-tight">
                                • {a.docente.nombre} ({a.horasAsignadas}h)
                              </p>
                            ))}
                          </div>
                        ) : (
                          <span className="text-zinc-600 text-xs">—</span>
                        )}
                      </td>
                      
                      {/* Práctica */}
                      <td className="p-3 align-middle">
                        {practicaRequired > 0 ? (
                          <div className="space-y-1">
                            <div className="flex items-center gap-1.5 text-xs">
                              <span className="text-zinc-500 font-medium">Asig:</span>
                              <span className={`font-bold ${practicaAssigned === practicaRequired ? 'text-emerald-400' : 'text-amber-400'}`}>
                                {practicaAssigned}h / {practicaRequired}h
                              </span>
                            </div>
                            {practicaAssignments.map((a) => (
                              <p key={a.id} className="text-[10.5px] text-zinc-400 leading-tight">
                                • {a.docente.nombre} ({a.horasAsignadas}h)
                              </p>
                            ))}
                          </div>
                        ) : (
                          <span className="text-zinc-600 text-xs">—</span>
                        )}
                      </td>
                      
                      {/* Laboratorio */}
                      <td className="p-3 align-middle">
                        {labRequired > 0 ? (
                          <div className="space-y-1">
                            <div className="flex items-center gap-1.5 text-xs">
                              <span className="text-zinc-500 font-medium">Asig:</span>
                              <span className={`font-bold ${labAssigned === labRequired ? 'text-emerald-400' : 'text-amber-400'}`}>
                                {labAssigned}h / {labRequired}h
                              </span>
                            </div>
                            {labAssignments.map((a) => (
                              <p key={a.id} className="text-[10.5px] text-zinc-400 leading-tight">
                                • {a.docente.nombre} ({a.horasAsignadas}h)
                                {a.grupoLaboratorio && (
                                  <span className="text-[9.5px] bg-zinc-800 text-zinc-500 px-1 rounded ml-1 font-semibold">
                                    G{a.grupoLaboratorio}
                                  </span>
                                )}
                              </p>
                            ))}
                          </div>
                        ) : (
                          <span className="text-zinc-600 text-xs">—</span>
                        )}
                      </td>
                      
                      {/* Total (Asig/Req) */}
                      <td className="p-3 text-center align-middle font-medium text-white">
                        {totalAssigned}h / {totalRequired}h
                      </td>
                      
                      {/* Faltan / Estado */}
                      <td className="p-3 text-center align-middle">
                        {pendingHours === 0 ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            Completado
                          </span>
                        ) : pendingHours > 0 ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                            Faltan {pendingHours}h
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-red-500/10 text-red-400 border border-red-500/20">
                            Excedido {Math.abs(pendingHours)}h
                          </span>
                        )}
                      </td>
                      
                      {/* Acciones */}
                      <td className="p-3 text-center align-middle">
                        <div className="flex items-center justify-center gap-2">
                          {groupCargas.length > 0 ? (
                            <button
                              onClick={() => openEditModal(groupCargas[0])}
                              className="p-1.5 text-zinc-400 hover:text-blue-400 hover:bg-blue-500/10 rounded transition-colors"
                              title="Editar Asignación"
                            >
                              <Pencil size={15} />
                            </button>
                          ) : (
                            <button
                              onClick={() => {
                                resetModalForm();
                                setGrupoId(grupo.id);
                                setShowAssignModal(true);
                              }}
                              className="flex items-center gap-1 px-2.5 py-1 bg-blue-600/10 hover:bg-blue-600 text-blue-400 hover:text-white rounded text-[11px] font-semibold transition-all border border-blue-500/20"
                            >
                              <Plus size={12} /> Asignar
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {gruposDisponibles.length === 0 && (
                  <tr>
                    <td colSpan={7} className="p-12 text-center">
                      <div className="flex flex-col items-center gap-2 text-zinc-500">
                        <BookOpen size={32} className="opacity-20" />
                        <p>No hay cursos ni grupos en este periodo</p>
                      </div>
                    </td>
                  </tr>
                )}
                {gruposDisponibles.length > 0 && filteredGruposDisponibles.length === 0 && (
                  <tr>
                    <td colSpan={7} className="p-12 text-center">
                      <div className="flex flex-col items-center gap-2 text-zinc-500">
                        <Search size={32} className="opacity-20" />
                        <p>No se encontraron cursos para "{tableSearch}"</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Assign Modal ────────────────────────────────── */}
      {showAssignModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl w-full max-w-xl mx-4 shadow-2xl overflow-y-auto max-h-[90vh]">
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-zinc-800">
              <h2 className="text-lg font-semibold text-white">
                {editingId ? 'Editar Carga Lectiva' : 'Asignar Carga Lectiva'}
              </h2>
              <button
                onClick={() => setShowAssignModal(false)}
                className="text-zinc-400 hover:text-white transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Body */}
            <div className="p-5 space-y-4">
              {/* Plan de estudio */}
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1">
                  Plan de estudio
                </label>
                <select
                  value={modalCurriculaId}
                  onChange={(e) => {
                    setModalCurriculaId(e.target.value);
                    setGrupoId('');
                  }}
                  disabled={!!editingId}
                  className="w-full bg-zinc-800 border border-zinc-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 disabled:opacity-50"
                >
                  <option value="">Seleccionar plan</option>
                  {curriculaList.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.codigo} ({c.anio}) - {c.escuela?.nombre}
                    </option>
                  ))}
                </select>
              </div>

              {/* Ciclo / Semestre */}
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1">
                  Ciclo / Semestre
                </label>
                <select
                  value={modalCiclo}
                  onChange={(e) => {
                    setModalCiclo(e.target.value);
                    setGrupoId('');
                  }}
                  disabled={!!editingId}
                  className="w-full bg-zinc-800 border border-zinc-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 disabled:opacity-50"
                >
                  <option value="">Seleccionar ciclo</option>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((c) => (
                    <option key={c} value={c}>
                      Ciclo {c}
                    </option>
                  ))}
                </select>
              </div>

              {/* Curso */}
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1">
                  Curso
                </label>
                <select
                  value={grupoId}
                  onChange={(e) => setGrupoId(e.target.value)}
                  disabled={!!editingId}
                  className="w-full bg-zinc-800 border border-zinc-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 disabled:opacity-50"
                >
                  <option value="">Seleccionar curso</option>
                  {filteredGruposForModal.map((g) => (
                    <option key={g.grupoId} value={g.grupoId}>
                      {g.label} (Ciclo {g.ciclo})
                    </option>
                  ))}
                </select>
              </div>

              {/* Docente Principal */}
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1">
                  Docente Principal
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
                  value={docenteId}
                  onChange={(e) => setDocenteId(e.target.value)}
                  className="w-full bg-zinc-800 border border-zinc-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                >
                  <option value="">Seleccionar docente</option>
                  {filteredDocentesForAssign.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.nombre} ({d.departamento?.nombre || 'Sin dpto'})
                    </option>
                  ))}
                </select>
              </div>

              {/* Postulantes al curso */}
              {grupoId && !editingId && (
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
                  <div className="max-h-[140px] overflow-y-auto">
                    {postulantes.length > 0 ? (
                      <div className="divide-y divide-zinc-800">
                        {postulantes.map((p) => (
                          <div 
                             key={p.docente.id} 
                             className={`p-2.5 flex items-center justify-between hover:bg-zinc-800 transition-colors ${docenteId === p.docente.id ? 'bg-blue-500/5' : ''}`}
                          >
                            <div className="flex flex-col gap-0.5 min-w-0">
                              <span className={`text-xs font-medium truncate ${docenteId === p.docente.id ? 'text-blue-400' : 'text-zinc-200'}`}>
                                {p.docente.nombre}
                              </span>
                              <div className="flex items-center gap-2">
                                <span className="text-[9px] text-zinc-500 uppercase font-bold">Prioridad {p.prioridad}</span>
                                <span className="text-[9px] text-emerald-500 font-bold bg-emerald-500/10 px-1 py-0.5 rounded border border-emerald-500/20">
                                  {p.compatibilidad.toFixed(0)}% compatibilidad
                                </span>
                              </div>
                            </div>
                            <button
                              onClick={() => setDocenteId(p.docente.id)}
                              className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold transition-all ${
                                docenteId === p.docente.id
                                  ? 'bg-blue-600 text-white shadow-lg'
                                  : 'bg-zinc-700 hover:bg-zinc-600 text-zinc-300'
                              }`}
                            >
                              {docenteId === p.docente.id ? 'Seleccionado' : 'Seleccionar'}
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : !isLoadingPostulantes ? (
                      <div className="p-4 text-center">
                        <p className="text-[11px] text-zinc-500">No hay docentes postulados para este curso</p>
                      </div>
                    ) : null}
                  </div>
                </div>
              )}

              {/* Asignación de Horas HT / HP / HL */}
              {selectedCursoForAssign && (
                <div className="space-y-3 pt-2">
                  <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Asignación de Horas por Tipo</p>

                  {/* Teoría */}
                  {selectedCursoForAssign.horasTeoria > 0 && (
                    <div className="bg-zinc-800/30 border border-zinc-800 rounded-lg p-3 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-zinc-300">Horas de Teoría (Límite: {selectedCursoForAssign.horasTeoria}h)</span>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-zinc-500">Principal:</span>
                          <input
                            type="number"
                            min={0}
                            max={selectedCursoForAssign.horasTeoria}
                            value={horasTeoria}
                            onChange={(e) => setHorasTeoria(Number(e.target.value))}
                            className="w-16 bg-zinc-800 border border-zinc-700 text-white rounded px-2 py-0.5 text-center text-xs focus:outline-none focus:border-blue-500"
                          />
                        </div>
                      </div>
                      <div className="flex flex-col gap-1.5 pt-2 border-t border-zinc-800/40">
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={teoriaCompartido}
                            onChange={(e) => setTeoriaCompartido(e.target.checked)}
                            className="w-3.5 h-3.5 rounded border-zinc-600 bg-zinc-800 text-blue-500 focus:ring-blue-500 focus:ring-offset-0"
                          />
                          <span className="text-[11px] text-zinc-400">Compartido con otro docente</span>
                        </label>
                        {teoriaCompartido && (
                          <div className="space-y-2 pl-5 pt-1">
                            <select
                              value={teoriaDocenteCompartidoId}
                              onChange={(e) => setTeoriaDocenteCompartidoId(e.target.value)}
                              className="w-full bg-zinc-800 border border-zinc-700 text-white rounded px-2 py-1 text-xs focus:outline-none focus:border-blue-500"
                            >
                              <option value="">Seleccionar docente compartido</option>
                              {filteredDocentesForAssign
                                .filter((d) => d.id !== docenteId)
                                .map((d) => (
                                  <option key={d.id} value={d.id}>
                                    {d.nombre} ({d.departamento?.nombre || 'Sin dpto'})
                                  </option>
                                ))}
                            </select>
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] text-zinc-400">Horas Docente Compartido:</span>
                              <input
                                type="number"
                                min={0}
                                max={selectedCursoForAssign.horasTeoria}
                                value={horasTeoriaCompartido}
                                onChange={(e) => setHorasTeoriaCompartido(Number(e.target.value))}
                                className="w-16 bg-zinc-800 border border-zinc-700 text-white rounded px-2 py-0.5 text-center text-xs focus:outline-none focus:border-blue-500"
                              />
                            </div>
                            {horasTeoria + horasTeoriaCompartido > selectedCursoForAssign.horasTeoria && (
                              <p className="text-[10px] text-red-400 font-semibold flex items-center gap-1">
                                <AlertCircle size={10} /> La suma ({horasTeoria + horasTeoriaCompartido}h) excede el límite ({selectedCursoForAssign.horasTeoria}h)
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Práctica */}
                  {selectedCursoForAssign.horasPractica > 0 && (
                    <div className="bg-zinc-800/30 border border-zinc-800 rounded-lg p-3 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-zinc-300">Horas de Práctica (Límite: {selectedCursoForAssign.horasPractica}h)</span>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-zinc-500">Principal:</span>
                          <input
                            type="number"
                            min={0}
                            max={selectedCursoForAssign.horasPractica}
                            value={horasPractica}
                            onChange={(e) => setHorasPractica(Number(e.target.value))}
                            className="w-16 bg-zinc-800 border border-zinc-700 text-white rounded px-2 py-0.5 text-center text-xs focus:outline-none focus:border-blue-500"
                          />
                        </div>
                      </div>
                      <div className="flex flex-col gap-1.5 pt-2 border-t border-zinc-800/40">
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={practicaCompartido}
                            onChange={(e) => setPracticaCompartido(e.target.checked)}
                            className="w-3.5 h-3.5 rounded border-zinc-600 bg-zinc-800 text-blue-500 focus:ring-blue-500 focus:ring-offset-0"
                          />
                          <span className="text-[11px] text-zinc-400">Compartido con otro docente</span>
                        </label>
                        {practicaCompartido && (
                          <div className="space-y-2 pl-5 pt-1">
                            <select
                              value={practicaDocenteCompartidoId}
                              onChange={(e) => setPracticaDocenteCompartidoId(e.target.value)}
                              className="w-full bg-zinc-800 border border-zinc-700 text-white rounded px-2 py-1 text-xs focus:outline-none focus:border-blue-500"
                            >
                              <option value="">Seleccionar docente compartido</option>
                              {filteredDocentesForAssign
                                .filter((d) => d.id !== docenteId)
                                .map((d) => (
                                  <option key={d.id} value={d.id}>
                                    {d.nombre} ({d.departamento?.nombre || 'Sin dpto'})
                                  </option>
                                ))}
                            </select>
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] text-zinc-400">Horas Docente Compartido:</span>
                              <input
                                type="number"
                                min={0}
                                max={selectedCursoForAssign.horasPractica}
                                value={horasPracticaCompartido}
                                onChange={(e) => setHorasPracticaCompartido(Number(e.target.value))}
                                className="w-16 bg-zinc-800 border border-zinc-700 text-white rounded px-2 py-0.5 text-center text-xs focus:outline-none focus:border-blue-500"
                              />
                            </div>
                            {horasPractica + horasPracticaCompartido > selectedCursoForAssign.horasPractica && (
                              <p className="text-[10px] text-red-400 font-semibold flex items-center gap-1">
                                <AlertCircle size={10} /> La suma ({horasPractica + horasPracticaCompartido}h) excede el límite ({selectedCursoForAssign.horasPractica}h)
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Laboratorio */}
                  {selectedCursoForAssign.horasLaboratorio > 0 && (
                    <div className="bg-zinc-800/30 border border-zinc-800 rounded-lg p-3 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-zinc-300">
                          Horas de Lab (Límite: {selectedCursoForAssign.horasLaboratorio}h • {selectedCursoForAssign.numGruposLaboratorio} grupos)
                        </span>
                        
                        {selectedCursoForAssign.numGruposLaboratorio <= 1 ? (
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-zinc-500">Principal:</span>
                            <input
                              type="number"
                              min={0}
                              max={selectedCursoForAssign.horasLaboratorio}
                              value={horasLaboratorioRaw}
                              onChange={(e) => setHorasLaboratorioRaw(Number(e.target.value))}
                              className="w-16 bg-zinc-800 border border-zinc-700 text-white rounded px-2 py-0.5 text-center text-xs focus:outline-none focus:border-blue-500"
                            />
                          </div>
                        ) : (
                          <span className="text-xs font-bold text-blue-400">
                            Principal: {horasLaboratorio}h ({gruposLaboratorio.length} grupo(s))
                          </span>
                        )}
                      </div>

                      {/* Checkboxes for primary lab groups */}
                      {selectedCursoForAssign.numGruposLaboratorio > 1 && (
                        <div className="space-y-1.5 pl-2">
                          <span className="text-[11px] font-medium text-zinc-400 block mb-1">
                            Grupos Lab (Principal):
                          </span>
                          <div className="flex flex-wrap gap-2">
                            {Array.from({ length: selectedCursoForAssign.numGruposLaboratorio }, (_, i) => {
                              const gNum = i + 1;
                              const isChecked = gruposLaboratorio.includes(gNum);
                              const isSharedOwned = laboratorioCompartido && gruposLaboratorioCompartido.includes(gNum);
                              return (
                                <label 
                                  key={gNum} 
                                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs font-medium transition-colors ${
                                    isSharedOwned 
                                      ? 'bg-zinc-900/40 border-zinc-800 text-zinc-600 cursor-not-allowed opacity-50' 
                                      : isChecked 
                                        ? 'bg-blue-500/10 border-blue-500/40 text-blue-400 cursor-pointer' 
                                        : 'bg-zinc-800/50 border-zinc-700/60 text-zinc-400 hover:border-zinc-600 cursor-pointer'
                                  }`}
                                >
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    disabled={isSharedOwned}
                                    onChange={(e) => {
                                      if (isSharedOwned) return;
                                      if (e.target.checked) {
                                        setGruposLaboratorio([...gruposLaboratorio, gNum]);
                                      } else {
                                        setGruposLaboratorio(gruposLaboratorio.filter(g => g !== gNum));
                                      }
                                    }}
                                    className="hidden"
                                  />
                                  <span>Grupo {gNum}</span>
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      <div className="flex flex-col gap-1.5 pt-2 border-t border-zinc-800/40">
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={laboratorioCompartido}
                            onChange={(e) => setLaboratorioCompartido(e.target.checked)}
                            className="w-3.5 h-3.5 rounded border-zinc-600 bg-zinc-800 text-blue-500 focus:ring-blue-500 focus:ring-offset-0"
                          />
                          <span className="text-[11px] text-zinc-400">Compartido con otro docente</span>
                        </label>
                        {laboratorioCompartido && (
                          <div className="space-y-2.5 pl-5 pt-1">
                            <select
                              value={laboratorioDocenteCompartidoId}
                              onChange={(e) => setLaboratorioDocenteCompartidoId(e.target.value)}
                              className="w-full bg-zinc-800 border border-zinc-700 text-white rounded px-2 py-1 text-xs focus:outline-none focus:border-blue-500"
                            >
                              <option value="">Seleccionar docente compartido</option>
                              {filteredDocentesForAssign
                                .filter((d) => d.id !== docenteId)
                                .map((d) => (
                                  <option key={d.id} value={d.id}>
                                    {d.nombre} ({d.departamento?.nombre || 'Sin dpto'})
                                  </option>
                                ))}
                            </select>
                            
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] text-zinc-400">
                                {selectedCursoForAssign.numGruposLaboratorio <= 1 ? "Horas Docente Compartido:" : `Horas Compartido: ${horasLaboratorioCompartido}h (${gruposLaboratorioCompartido.length} grupo(s))`}
                              </span>
                              {selectedCursoForAssign.numGruposLaboratorio <= 1 && (
                                <input
                                  type="number"
                                  min={0}
                                  max={selectedCursoForAssign.horasLaboratorio}
                                  value={horasLaboratorioCompartidoRaw}
                                  onChange={(e) => setHorasLaboratorioCompartidoRaw(Number(e.target.value))}
                                  className="w-16 bg-zinc-800 border border-zinc-700 text-white rounded px-2 py-0.5 text-center text-xs focus:outline-none focus:border-blue-500"
                                />
                              )}
                            </div>

                            {/* Checkboxes for shared lab groups */}
                            {selectedCursoForAssign.numGruposLaboratorio > 1 && (
                              <div className="space-y-1.5 pt-0.5">
                                <span className="text-[11px] font-medium text-zinc-400 block mb-1">
                                  Grupos Lab (Docente Compartido):
                                </span>
                                <div className="flex flex-wrap gap-2">
                                  {Array.from({ length: selectedCursoForAssign.numGruposLaboratorio }, (_, i) => {
                                    const gNum = i + 1;
                                    const isPrimaryOwned = gruposLaboratorio.includes(gNum);
                                    const isChecked = gruposLaboratorioCompartido.includes(gNum);
                                    return (
                                      <label 
                                        key={gNum} 
                                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs font-medium transition-colors ${
                                          isPrimaryOwned 
                                            ? 'bg-zinc-900/40 border-zinc-800 text-zinc-600 cursor-not-allowed opacity-50' 
                                            : isChecked 
                                              ? 'bg-purple-500/10 border-purple-500/40 text-purple-400 cursor-pointer' 
                                              : 'bg-zinc-800/50 border-zinc-700/60 text-zinc-400 hover:border-zinc-600 cursor-pointer'
                                        }`}
                                      >
                                        <input
                                          type="checkbox"
                                          checked={isChecked}
                                          disabled={isPrimaryOwned}
                                          onChange={(e) => {
                                            if (isPrimaryOwned) return;
                                            if (e.target.checked) {
                                              setGruposLaboratorioCompartido([...gruposLaboratorioCompartido, gNum]);
                                            } else {
                                              setGruposLaboratorioCompartido(gruposLaboratorioCompartido.filter(g => g !== gNum));
                                            }
                                          }}
                                          className="hidden"
                                        />
                                        <span>Grupo {gNum}</span>
                                      </label>
                                    );
                                  })}
                                </div>
                              </div>
                            )}

                            {/* Validate lab limit for single group */}
                            {selectedCursoForAssign.numGruposLaboratorio === 1 && horasLaboratorio + horasLaboratorioCompartido > selectedCursoForAssign.horasLaboratorio && (
                              <p className="text-[10px] text-red-400 font-semibold flex items-center gap-1">
                                <AlertCircle size={10} /> La suma ({horasLaboratorio + horasLaboratorioCompartido}h) excede el límite ({selectedCursoForAssign.horasLaboratorio}h)
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                      {selectedCursoForAssign.numGruposLaboratorio > 1 && (gruposLaboratorio.length + (laboratorioCompartido ? gruposLaboratorioCompartido.length : 0) !== selectedCursoForAssign.numGruposLaboratorio) && (
                        <p className="text-[11px] text-amber-400/90 font-medium flex items-center gap-1.5 bg-amber-500/5 border border-amber-500/20 rounded-md p-2 mt-1">
                          <AlertCircle size={14} className="shrink-0" />
                          <span>Falta asignar {selectedCursoForAssign.numGruposLaboratorio - (gruposLaboratorio.length + (laboratorioCompartido ? gruposLaboratorioCompartido.length : 0))} grupo(s) de laboratorio.</span>
                        </p>
                      )}
                    </div>
                  )}

                  {/* Calculated Hours Summary */}
                  <div className="bg-blue-600/10 border border-blue-500/20 rounded-xl p-4 mt-2 text-xs space-y-1.5">
                    <div className="flex items-center justify-between font-semibold">
                      <span className="text-zinc-400">LECTIVAS Totales Requeridas:</span>
                      <span className="text-white">
                        {selectedCursoForAssign.horasTeoria + selectedCursoForAssign.horasPractica + ((selectedCursoForAssign.numGruposLaboratorio ?? 1) * selectedCursoForAssign.horasLaboratorio)}h
                      </span>
                    </div>
                    <div className="border-t border-zinc-800/40 my-1 pt-1.5 space-y-1">
                      <div className="flex items-center justify-between text-zinc-400">
                        <span>Horas Docente Principal:</span>
                        <span className="text-white font-medium">
                          {horasTeoria + horasPractica + horasLaboratorio}h
                        </span>
                      </div>
                      {(teoriaCompartido || practicaCompartido || laboratorioCompartido) && (
                        <div className="flex items-center justify-between text-zinc-400">
                          <span>Horas Docente Compartido:</span>
                          <span className="text-white font-medium">
                            {horasTeoriaCompartido + horasPracticaCompartido + horasLaboratorioCompartido}h
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center justify-between font-bold mt-2 pt-2 border-t border-zinc-800">
                      <span className="text-blue-400">LECTIVAS a Asignar en esta Carga:</span>
                      <span className="text-blue-400">
                        {horasTeoria + horasPractica + horasLaboratorio + (teoriaCompartido ? horasTeoriaCompartido : 0) + (practicaCompartido ? horasPracticaCompartido : 0) + (laboratorioCompartido ? horasLaboratorioCompartido : 0)}h
                      </span>
                    </div>
                  </div>
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
                onClick={handleSave}
                disabled={
                  !docenteId ||
                  !grupoId ||
                  (horasTeoria === 0 && horasPractica === 0 && horasLaboratorio === 0 &&
                   horasTeoriaCompartido === 0 && horasPracticaCompartido === 0 && horasLaboratorioCompartido === 0) ||
                  (teoriaCompartido && !teoriaDocenteCompartidoId) ||
                  (practicaCompartido && !practicaDocenteCompartidoId) ||
                  (laboratorioCompartido && !laboratorioDocenteCompartidoId) ||
                  horasTeoria + (teoriaCompartido ? horasTeoriaCompartido : 0) > (selectedCursoForAssign?.horasTeoria ?? 0) ||
                  horasPractica + (practicaCompartido ? horasPracticaCompartido : 0) > (selectedCursoForAssign?.horasPractica ?? 0) ||
                  (selectedCursoForAssign?.numGruposLaboratorio && selectedCursoForAssign.numGruposLaboratorio > 1 ?
                    (selectedCursoForAssign.horasLaboratorio > 0 && (gruposLaboratorio.length + (laboratorioCompartido ? gruposLaboratorioCompartido.length : 0) !== selectedCursoForAssign.numGruposLaboratorio)) :
                    horasLaboratorio + (laboratorioCompartido ? horasLaboratorioCompartido : 0) > (selectedCursoForAssign?.horasLaboratorio ?? 0)
                  ) ||
                  assignCursoCompletoMutation.isPending
                }
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors"
              >
                {assignCursoCompletoMutation.isPending ? 'Guardando...' : 'Guardar Carga'}
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
