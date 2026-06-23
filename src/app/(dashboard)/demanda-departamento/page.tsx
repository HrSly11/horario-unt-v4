'use client';

import { useState, useMemo, useEffect } from 'react';
import { useTRPC } from '@/trpc/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  BookOpen,
  Search,
  School,
  Calendar,
  AlertCircle,
  GraduationCap,
  Info,
  Loader2,
  X,
  ChevronRight,
  Plus,
  User,
  ArrowRight,
  Check,
} from 'lucide-react';
import Link from 'next/link';

const TIPO_COLORS: Record<string, string> = {
  TEORIA: 'badge-info',
  PRACTICA: 'badge-success',
  LABORATORIO: 'badge-warning',
};

export default function DemandaDepartamentoPage() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const [selectedPeriodoId, setSelectedPeriodoId] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedLinea, setSelectedLinea] = useState<any>(null);

  // Modal state (same as carga lectiva)
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

  const { data: user } = useQuery({ ...trpc.auth.me.queryOptions() });
  const { data: periodos = [] } = useQuery({ ...trpc.periodo.list.queryOptions() });
  const { data: docentes = [] } = useQuery({ ...trpc.docente.list.queryOptions() });
  const { data: curriculaList = [] } = useQuery({ ...trpc.curricula.list.queryOptions({ vigente: true }) });

  const activePeriod = periodos.find((p) => p.activo);
  const periodoId = selectedPeriodoId || activePeriod?.id || (periodos.length > 0 ? periodos[0].id : '');

  const isAuthorized =
    user?.role === 'DIRECTOR_DEPARTAMENTO' ||
    user?.role === 'SECRETARIA_DEPARTAMENTO' ||
    user?.role === 'ADMIN';

  const {
    data: lineas = [],
    isLoading,
    error,
  } = useQuery({
    ...trpc.demandaDepartamento.listApproved.queryOptions({ periodoId }),
    enabled: !!periodoId && isAuthorized,
  });

  const { data: gruposDisponibles = [] } = useQuery({
    ...trpc.cargaLectiva.gruposDisponibles.queryOptions({ periodoId }),
    enabled: !!periodoId,
  });

  const { data: cargasLectivas = [] } = useQuery({
    ...trpc.cargaLectiva.list.queryOptions({ periodoId }),
    enabled: !!periodoId,
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

  const filteredDocentes = useMemo(() => {
    return uniqueDocentesList;
  }, [uniqueDocentesList]);

  const filteredDocentesForAssign = useMemo(() => {
    if (!selectedCursoForAssign || !selectedCursoForAssign.departamentoId) {
      return filteredDocentes;
    }
    return filteredDocentes.filter((d) => d.departamentoId === selectedCursoForAssign.departamentoId);
  }, [filteredDocentes, selectedCursoForAssign]);

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

  // Whenever selectedCursoForAssign changes, default the input hours to course max hours
  useEffect(() => {
    if (selectedCursoForAssign) {
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
  }, [selectedCursoForAssign]);

  const assignCursoCompletoMutation = useMutation(
    trpc.cargaLectiva.assignCursoCompleto.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: trpc.cargaLectiva.list.queryKey() });
        queryClient.invalidateQueries({ queryKey: trpc.demandaDepartamento.listApproved.queryKey() });
        setShowAssignModal(false);
        resetModalForm();
      },
      onError: (err) => {
        alert(err.message);
      },
    })
  );

  function resetModalForm() {
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
    setSelectedLinea(null);
  }

  const openAssignModal = (linea: any) => {
    resetModalForm();
    setSelectedLinea(linea);
    // Find the corresponding grupo(s) for this linea
    const gruposForLinea = gruposDisponibles.filter(g => g.curso.id === linea.cursoId);
    if (gruposForLinea.length > 0) {
      setGrupoId(gruposForLinea[0].id);
    }
    setShowAssignModal(true);
  };

  const closeAssignModal = () => {
    setShowAssignModal(false);
    resetModalForm();
  };

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

  const filteredLineas = useMemo(() => {
    if (!searchTerm) return lineas;
    const term = searchTerm.toLowerCase();
    return lineas.filter(
      (line) =>
        line.curso.nombre.toLowerCase().includes(term) ||
        line.curso.codigo.toLowerCase().includes(term) ||
        line.demanda.escuela.nombre.toLowerCase().includes(term)
    );
  }, [lineas, searchTerm]);

  // ── Authorization guard ──
  if (!isAuthorized && user) {
    return (
      <div className="p-6">
        <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-xl text-danger">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span className="text-sm font-medium">
            Acceso restringido: esta pagina esta reservada para el Director o la Secretaria de Departamento.
          </span>
        </div>
      </div>
    );
  }

  // ─── Render ──────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-main flex items-center gap-2.5">
            <School className="w-7 h-7 text-primary" />
            Demanda Academica de Departamento
          </h1>
          <p className="text-sm text-text-sub mt-1">
            Cursos aprobados por las escuelas asignados a este departamento para el periodo seleccionado.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Period Selector */}
          <div className="flex items-center gap-2 bg-white border border-border rounded-lg px-3 py-2 shrink-0">
            <Calendar className="w-4 h-4 text-text-sub" />
            <select
              className="text-sm text-text-main outline-none bg-transparent font-medium"
              value={periodoId}
              onChange={(e) => setSelectedPeriodoId(e.target.value)}
            >
              {periodos.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre} {p.activo ? '(Activo)' : ''}
                </option>
              ))}
            </select>
          </div>

          <Link href="/carga-lectiva">
            <button className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium transition-colors hover:bg-primary/90">
              <ArrowRight className="w-4 h-4" />
              Ir a Gestión de Carga Lectiva
            </button>
          </Link>
        </div>
      </div>

      {/* ── Error ──────────────────────────────────────────────────────────── */}
      {error && (
        <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-xl">
          <AlertCircle className="w-5 h-5 text-danger shrink-0" />
          <span className="text-sm font-medium text-danger">Error al cargar: {error.message}</span>
        </div>
      )}

      {/* ── Stats ──────────────────────────────────────────────────────────── */}
      {!isLoading && lineas.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="card-standard text-center">
            <p className="text-2xl font-bold text-primary">{lineas.length}</p>
            <p className="text-xs text-text-sub font-bold uppercase tracking-wide mt-1">Cursos asignados</p>
          </div>
          <div className="card-standard text-center">
            <p className="text-2xl font-bold text-text-main">
              {new Set(lineas.map((l) => l.demanda.escuela.nombre)).size}
            </p>
            <p className="text-xs text-text-sub font-bold uppercase tracking-wide mt-1">Escuelas</p>
          </div>
          <div className="card-standard text-center">
            <p className="text-2xl font-bold text-warning">
              {lineas.filter((l) => l.numGruposLaboratorio > 0).length}
            </p>
            <p className="text-xs text-text-sub font-bold uppercase tracking-wide mt-1">Con laboratorio</p>
          </div>
          <div className="card-standard text-center">
            <p className="text-2xl font-bold text-info">
              {lineas.reduce((acc, l) => acc + l.horasTeoria + l.horasPractica + l.horasLaboratorio, 0)}
            </p>
            <p className="text-xs text-text-sub font-bold uppercase tracking-wide mt-1">Horas totales</p>
          </div>
        </div>
      )}

      {/* ── Search + Table ─────────────────────────────────────────────────── */}
      <div className="card-standard space-y-4">
        {/* Search */}
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-sub" />
          <input
            type="text"
            placeholder="Buscar por curso, codigo o escuela..."
            className="input-standard pl-10"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-text-sub hover:text-text-main transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="flex justify-center items-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        )}

        {/* Empty state */}
        {!isLoading && filteredLineas.length === 0 && (
          <div className="flex flex-col items-center justify-center py-14 text-center gap-3">
            <div className="p-4 rounded-full bg-slate-100">
              <BookOpen className="w-8 h-8 text-slate-400" />
            </div>
            <div>
              <p className="font-bold text-lg text-text-main">
                {searchTerm ? 'Sin resultados para esa busqueda' : 'No hay asignaturas aprobadas aun'}
              </p>
              <p className="text-sm text-text-sub mt-1 max-w-md">
                {searchTerm
                  ? 'Intenta con otro termino de busqueda.'
                  : 'Para ver cursos aqui, el Director de Escuela debe aprobar la demanda academica (Paso 1). Una vez aprobada, los cursos aparecen automaticamente.'}
              </p>
            </div>
          </div>
        )}

        {/* Table */}
        {!isLoading && filteredLineas.length > 0 && (
          <div className="table-standard">
            <table className="w-full text-left border-separate border-spacing-0">
              <thead>
                <tr>
                  <th className="px-4 py-3">Curso</th>
                  <th className="px-4 py-3">Escuela</th>
                  <th className="px-4 py-3 text-center">Creditos</th>
                  <th className="px-4 py-3 text-center">HT / HP / HL</th>
                  <th className="px-4 py-3 text-center">G. Lab</th>
                  <th className="px-4 py-3">Docente Asignado</th>
                  <th className="px-4 py-3">Plan / Ciclo</th>
                  <th className="px-4 py-3">Excepcion</th>
                  <th className="px-4 py-3 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredLineas.map((line) => {
                  // Get docentes assigned to this demand line's groups
                  const assignedDocentes = line.grupos?.flatMap((g: any) =>
                    g.asignacionesCarga?.map((a: any) => a.docente)
                  ) || [];

                  // Remove duplicates by id
                  const uniqueDocentes = Array.from(new Map(assignedDocentes.map((d: any) => [d.id, d])).values());

                  return (
                    <tr key={line.id} className="hover:bg-slate-50 transition-colors">
                      {/* Course */}
                      <td className="px-4 py-3">
                        <p className="font-semibold text-text-main text-sm">{line.curso.nombre}</p>
                        <p className="text-[10px] font-bold text-text-sub uppercase tracking-widest font-mono mt-0.5">
                          {line.curso.codigo}
                        </p>
                      </td>
                      {/* School */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <School className="w-4 h-4 text-primary/60 shrink-0" />
                          <span className="text-sm text-text-main">{line.demanda.escuela.nombre}</span>
                        </div>
                      </td>
                      {/* Credits */}
                      <td className="px-4 py-3 text-center font-bold text-text-main">
                        {line.curso.creditos}
                      </td>
                      {/* Hours */}
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <span className="badge badge-info">{line.horasTeoria}T</span>
                          <span className="badge badge-success">{line.horasPractica}P</span>
                          <span className="badge badge-warning">{line.horasLaboratorio}L</span>
                        </div>
                      </td>
                      {/* Lab groups */}
                      <td className="px-4 py-3 text-center">
                        {line.numGruposLaboratorio > 0 ? (
                          <span className="badge badge-warning font-bold">{line.numGruposLaboratorio}</span>
                        ) : (
                          <span className="text-text-sub text-xs">—</span>
                        )}
                      </td>
                      {/* Docente */}
                      <td className="px-4 py-3">
                        {uniqueDocentes.length > 0 ? (
                          <div className="flex flex-col gap-1">
                            {uniqueDocentes.map((doc: any) => (
                              <span key={doc.id} className="flex items-center gap-1 text-sm text-text-main">
                                <User className="w-3 h-3 text-primary" />
                                {doc.nombre}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-text-sub text-xs">Sin asignar</span>
                        )}
                      </td>
                      {/* Curricula */}
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1">
                          {line.curriculas.map((lc: any) => (
                            <span key={lc.id} className="badge badge-gray gap-1">
                              <GraduationCap className="w-3 h-3" />
                              {lc.curricula.codigo} – Ciclo {lc.ciclo}
                            </span>
                          ))}
                          {line.curriculas.length === 0 && (
                            <span className="text-text-sub text-xs">Sin plan</span>
                          )}
                        </div>
                      </td>
                      {/* Opening reason */}
                      <td className="px-4 py-3">
                        {line.motivoAperturaExcepcional ? (
                          <div className="flex items-start gap-1.5 text-xs bg-amber-50 border border-amber-200 text-amber-800 px-2 py-1 rounded-xl max-w-[200px]">
                            <Info className="w-3.5 h-3.5 shrink-0 text-warning mt-0.5" />
                            <span className="break-words">{line.motivoAperturaExcepcional}</span>
                          </div>
                        ) : (
                          <span className="text-text-sub text-xs">—</span>
                        )}
                      </td>
                      {/* Acciones */}
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => openAssignModal(line)}
                          className="flex items-center gap-1.5 mx-auto px-3 py-1.5 bg-primary/10 text-primary rounded-md text-sm font-medium transition-colors hover:bg-primary/20"
                        >
                          <Plus className="w-4 h-4" />
                          Asignar
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Assign Modal */}
      {showAssignModal && selectedLinea && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-border">
              <div>
                <h2 className="text-lg font-bold text-text-main">Asignar Docente</h2>
                <p className="text-sm text-text-sub mt-1">
                  {selectedLinea.curso.codigo} - {selectedLinea.curso.nombre}
                </p>
              </div>
              <button
                onClick={closeAssignModal}
                className="p-2 hover:bg-slate-100 rounded-md transition-colors"
              >
                <X className="w-5 h-5 text-text-sub" />
              </button>
            </div>
            <div className="p-5 space-y-6">
              {/* Grupo selector */}
              <div>
                <label className="block text-sm font-medium text-text-main mb-1.5">Grupo</label>
                <select
                  className="input-standard"
                  value={grupoId}
                  onChange={(e) => setGrupoId(e.target.value)}
                >
                  <option value="">Seleccione un grupo</option>
                  {gruposDisponibles
                    .filter((g) => g.curso.id === selectedLinea.cursoId)
                    .map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.nombre}
                      </option>
                    ))}
                </select>
              </div>

              {/* Docente principal */}
              {selectedCursoForAssign && (
                <div>
                  <label className="block text-sm font-medium text-text-main mb-1.5">Docente Principal</label>
                  <select
                    className="input-standard"
                    value={docenteId}
                    onChange={(e) => setDocenteId(e.target.value)}
                  >
                    <option value="">Seleccione un docente</option>
                    {filteredDocentesForAssign.map((doc) => (
                      <option key={doc.id} value={doc.id}>
                        {doc.nombre}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Teoría */}
              {selectedCursoForAssign && selectedCursoForAssign.horasTeoria > 0 && (
                <div className="space-y-3 p-4 bg-slate-50 rounded-lg">
                  <h3 className="font-semibold text-text-main flex items-center gap-2">
                    <span className="badge badge-info">Teoría</span>
                    <span className="text-sm text-text-sub">Máximo: {selectedCursoForAssign.horasTeoria}h</span>
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-text-sub mb-1">Horas para docente principal</label>
                      <input
                        type="number"
                        min="0"
                        max={selectedCursoForAssign.horasTeoria}
                        className="input-standard"
                        value={horasTeoria}
                        onChange={(e) => setHorasTeoria(Math.max(0, Number(e.target.value)))}
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="teoria-compartido"
                        checked={teoriaCompartido}
                        onChange={(e) => setTeoriaCompartido(e.target.checked)}
                        className="w-4 h-4 text-primary"
                      />
                      <label htmlFor="teoria-compartido" className="text-sm text-text-main">
                        Compartir con otro docente
                      </label>
                    </div>
                  </div>
                  {teoriaCompartido && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
                      <div>
                        <label className="block text-sm text-text-sub mb-1">Docente Secundario</label>
                        <select
                          className="input-standard"
                          value={teoriaDocenteCompartidoId}
                          onChange={(e) => setTeoriaDocenteCompartidoId(e.target.value)}
                        >
                          <option value="">Seleccione un docente</option>
                          {filteredDocentesForAssign.filter((d) => d.id !== docenteId).map((doc) => (
                            <option key={doc.id} value={doc.id}>
                              {doc.nombre}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm text-text-sub mb-1">Horas para docente secundario</label>
                        <input
                          type="number"
                          min="0"
                          max={selectedCursoForAssign.horasTeoria}
                          className="input-standard"
                          value={horasTeoriaCompartido}
                          onChange={(e) => setHorasTeoriaCompartido(Math.max(0, Number(e.target.value)))}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Práctica */}
              {selectedCursoForAssign && selectedCursoForAssign.horasPractica > 0 && (
                <div className="space-y-3 p-4 bg-slate-50 rounded-lg">
                  <h3 className="font-semibold text-text-main flex items-center gap-2">
                    <span className="badge badge-success">Práctica</span>
                    <span className="text-sm text-text-sub">Máximo: {selectedCursoForAssign.horasPractica}h</span>
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-text-sub mb-1">Horas para docente principal</label>
                      <input
                        type="number"
                        min="0"
                        max={selectedCursoForAssign.horasPractica}
                        className="input-standard"
                        value={horasPractica}
                        onChange={(e) => setHorasPractica(Math.max(0, Number(e.target.value)))}
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="practica-compartido"
                        checked={practicaCompartido}
                        onChange={(e) => setPracticaCompartido(e.target.checked)}
                        className="w-4 h-4 text-primary"
                      />
                      <label htmlFor="practica-compartido" className="text-sm text-text-main">
                        Compartir con otro docente
                      </label>
                    </div>
                  </div>
                  {practicaCompartido && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
                      <div>
                        <label className="block text-sm text-text-sub mb-1">Docente Secundario</label>
                        <select
                          className="input-standard"
                          value={practicaDocenteCompartidoId}
                          onChange={(e) => setPracticaDocenteCompartidoId(e.target.value)}
                        >
                          <option value="">Seleccione un docente</option>
                          {filteredDocentesForAssign.filter((d) => d.id !== docenteId).map((doc) => (
                            <option key={doc.id} value={doc.id}>
                              {doc.nombre}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm text-text-sub mb-1">Horas para docente secundario</label>
                        <input
                          type="number"
                          min="0"
                          max={selectedCursoForAssign.horasPractica}
                          className="input-standard"
                          value={horasPracticaCompartido}
                          onChange={(e) => setHorasPracticaCompartido(Math.max(0, Number(e.target.value)))}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Laboratorio */}
              {selectedCursoForAssign && selectedCursoForAssign.horasLaboratorio > 0 && (
                <div className="space-y-3 p-4 bg-slate-50 rounded-lg">
                  <h3 className="font-semibold text-text-main flex items-center gap-2">
                    <span className="badge badge-warning">Laboratorio</span>
                    <span className="text-sm text-text-sub">
                      {selectedCursoForAssign.numGruposLaboratorio > 1
                        ? `Grupos disponibles: 1-${selectedCursoForAssign.numGruposLaboratorio}`
                        : `Máximo: ${selectedCursoForAssign.horasLaboratorio}h`}
                    </span>
                  </h3>

                  {selectedCursoForAssign.numGruposLaboratorio > 1 ? (
                    <>
                      {/* Grupos para docente principal */}
                      <div>
                        <label className="block text-sm font-medium text-text-main mb-2">
                          Grupos para docente principal
                        </label>
                        <div className="flex flex-wrap gap-2">
                          {Array.from({ length: selectedCursoForAssign.numGruposLaboratorio }, (_, i) => i + 1).map((num) => (
                            <label
                              key={num}
                              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border cursor-pointer transition-colors ${
                                gruposLaboratorio.includes(num)
                                  ? 'bg-primary text-white border-primary'
                                  : 'bg-white border-border hover:border-primary/50'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={gruposLaboratorio.includes(num)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setGruposLaboratorio([...gruposLaboratorio, num]);
                                  } else {
                                    setGruposLaboratorio(gruposLaboratorio.filter((n) => n !== num));
                                  }
                                }}
                                className="sr-only"
                              />
                              <span className="text-sm font-medium">Grupo {num}</span>
                            </label>
                          ))}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id="laboratorio-compartido"
                          checked={laboratorioCompartido}
                          onChange={(e) => setLaboratorioCompartido(e.target.checked)}
                          className="w-4 h-4 text-primary"
                        />
                        <label htmlFor="laboratorio-compartido" className="text-sm text-text-main">
                          Compartir con otro docente
                        </label>
                      </div>

                      {laboratorioCompartido && (
                        <div className="space-y-3 mt-3">
                          <div>
                            <label className="block text-sm text-text-sub mb-1">Docente Secundario</label>
                            <select
                              className="input-standard"
                              value={laboratorioDocenteCompartidoId}
                              onChange={(e) => setLaboratorioDocenteCompartidoId(e.target.value)}
                            >
                              <option value="">Seleccione un docente</option>
                              {filteredDocentesForAssign.filter((d) => d.id !== docenteId).map((doc) => (
                                <option key={doc.id} value={doc.id}>
                                  {doc.nombre}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-text-main mb-2">
                              Grupos para docente secundario
                            </label>
                            <div className="flex flex-wrap gap-2">
                              {Array.from(
                                { length: selectedCursoForAssign.numGruposLaboratorio },
                                (_, i) => i + 1
                              ).map((num) => (
                                <label
                                  key={num}
                                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border cursor-pointer transition-colors ${
                                    gruposLaboratorioCompartido.includes(num)
                                      ? 'bg-primary text-white border-primary'
                                      : gruposLaboratorio.includes(num)
                                      ? 'opacity-50 cursor-not-allowed bg-gray-100 border-gray-200'
                                      : 'bg-white border-border hover:border-primary/50'
                                  }`}
                                >
                                  <input
                                    type="checkbox"
                                    checked={gruposLaboratorioCompartido.includes(num)}
                                    disabled={gruposLaboratorio.includes(num)}
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        setGruposLaboratorioCompartido([...gruposLaboratorioCompartido, num]);
                                      } else {
                                        setGruposLaboratorioCompartido(
                                          gruposLaboratorioCompartido.filter((n) => n !== num)
                                        );
                                      }
                                    }}
                                    className="sr-only"
                                  />
                                  <span className="text-sm font-medium">Grupo {num}</span>
                                </label>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm text-text-sub mb-1">Horas para docente principal</label>
                          <input
                            type="number"
                            min="0"
                            max={selectedCursoForAssign.horasLaboratorio}
                            className="input-standard"
                            value={horasLaboratorioRaw}
                            onChange={(e) => setHorasLaboratorioRaw(Math.max(0, Number(e.target.value)))}
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            id="laboratorio-compartido"
                            checked={laboratorioCompartido}
                            onChange={(e) => setLaboratorioCompartido(e.target.checked)}
                            className="w-4 h-4 text-primary"
                          />
                          <label htmlFor="laboratorio-compartido" className="text-sm text-text-main">
                            Compartir con otro docente
                          </label>
                        </div>
                      </div>
                      {laboratorioCompartido && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
                          <div>
                            <label className="block text-sm text-text-sub mb-1">Docente Secundario</label>
                            <select
                              className="input-standard"
                              value={laboratorioDocenteCompartidoId}
                              onChange={(e) => setLaboratorioDocenteCompartidoId(e.target.value)}
                            >
                              <option value="">Seleccione un docente</option>
                              {filteredDocentesForAssign.filter((d) => d.id !== docenteId).map((doc) => (
                                <option key={doc.id} value={doc.id}>
                                  {doc.nombre}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="block text-sm text-text-sub mb-1">Horas para docente secundario</label>
                            <input
                              type="number"
                              min="0"
                              max={selectedCursoForAssign.horasLaboratorio}
                              className="input-standard"
                              value={horasLaboratorioCompartidoRaw}
                              onChange={(e) => setHorasLaboratorioCompartidoRaw(Math.max(0, Number(e.target.value)))}
                            />
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              <div className="flex justify-end gap-3 pt-2 border-t border-border">
                <button
                  onClick={closeAssignModal}
                  className="px-4 py-2 text-text-sub hover:text-text-main transition-colors text-sm font-medium"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSave}
                  disabled={!docenteId || !grupoId}
                  className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium transition-colors hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Guardar Asignación
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
