'use client';

import { useState, useMemo, useEffect } from 'react';
import { useTRPC } from '@/trpc/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import {
  AlertCircle,
  Clock,
  BookOpen,
  Plus,
  Trash2,
  X,
  Search,
  Check,
  ChevronDown,
  Info,
  Calendar,
  AlertTriangle,
  User as UserIcon,
} from 'lucide-react';
import { CategoriaDocente, TipoDocente, ModalidadDocente, TipoCargaNoLectiva } from '@/generated/prisma/client';

export default function CargaHorariaPage() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const router = useRouter();

  // ── Session & Global Queries ────────────────────────────
  const { data: user } = useQuery({ ...trpc.auth.me.queryOptions() });
  const { data: periodos = [] } = useQuery({ ...trpc.periodo.list.queryOptions() });

  const activePeriod = periodos.find((p) => p.activo);
  const [selectedPeriodoId, setSelectedPeriodoId] = useState('');
  const periodoId = selectedPeriodoId || activePeriod?.id || (periodos.length > 0 ? periodos[0].id : '');

  // ── Selected Docente State ──────────────────────────────
  const [selectedDocenteId, setSelectedDocenteId] = useState('');

  // Auto-select user if they are a DOCENTE
  useEffect(() => {
    if (user?.role === 'DOCENTE' && user.docenteId) {
      setSelectedDocenteId(user.docenteId);
    }
  }, [user]);

  // Is the logged-in user admin or secretary?
  const showTeacherSearch = useMemo(() => {
    return (
      user?.role === 'ADMIN' ||
      user?.role === 'SECRETARIA_ACADEMICA' ||
      user?.role === 'SECRETARIA_DEPARTAMENTO' ||
      user?.role === 'DIRECTOR_DEPARTAMENTO'
    );
  }, [user]);

  // ── Docentes list for search ────────────────────────────
  const { data: docentes = [] } = useQuery({
    ...trpc.docente.list.queryOptions({}),
    enabled: showTeacherSearch,
  });

  const filteredDocentes = useMemo(() => {
    const seen = new Set();
    return docentes.filter((d) => {
      if (seen.has(d.id)) return false;
      seen.add(d.id);
      return true;
    });
  }, [docentes]);

  // ── Selected Docente Details ────────────────────────────
  const { data: docente, isLoading: isLoadingDocente } = useQuery({
    ...trpc.docente.byId.queryOptions({ id: selectedDocenteId }),
    enabled: !!selectedDocenteId,
  });

  // ── Declaration Query ───────────────────────────────────
  const { data: declaracion, isLoading: isLoadingDeclaracion } = useQuery({
    ...trpc.declaracion.byDocente.queryOptions({ docenteId: selectedDocenteId, periodoId }),
    enabled: !!selectedDocenteId && !!periodoId,
  });

  // Is editing locked? (Only allowed in BORRADOR or OBSERVADA states)
  const isLocked = useMemo(() => {
    if (!declaracion) return false;
    return declaracion.estado !== 'BORRADOR' && declaracion.estado !== 'OBSERVADA';
  }, [declaracion]);

  // ── Workload Queries ────────────────────────────────────
  const { data: cargasLectivas = [], isLoading: isLoadingLectivas } = useQuery({
    ...trpc.cargaLectiva.list.queryOptions({ docenteId: selectedDocenteId, periodoId }),
    enabled: !!selectedDocenteId && !!periodoId,
  });

  const { data: cargasNoLectivasData, isLoading: isLoadingNoLectivas } = useQuery({
    ...trpc.cargaNoLectiva.byDocente.queryOptions({ docenteId: selectedDocenteId, periodoId }),
    enabled: !!selectedDocenteId && !!periodoId,
  });

  const cargasNoLectivas = cargasNoLectivasData?.cargas || [];
  const totalLectivas = cargasLectivas.reduce((acc, c) => acc + c.horasAsignadas, 0);

  // ── Docente Situational Status Form State ────────────────
  const [modalidad, setModalidad] = useState<ModalidadDocente>('TIEMPO_COMPLETO');
  const [horasContrato, setHorasContrato] = useState(40);

  useEffect(() => {
    if (docente) {
      setModalidad(docente.modalidad);
      setHorasContrato(docente.horasContrato);
    }
  }, [docente]);

  // Mapped Facultad and Departamento — read directly from the byId response
  const docenteFacultadYDepartamento = useMemo(() => {
    if (!docente) return { facultad: '-', departamento: '-' };
    const dept = (docente as any).departamento;
    return {
      facultad: dept?.facultad?.nombre || '-',
      departamento: dept?.nombre || '-',
    };
  }, [docente]);

  // ── Preparacion y Evaluacion State ─────────────────────
  const preparacionCarga = useMemo(() => {
    return cargasNoLectivas.find((c) => c.tipo === 'PREPARACION_EVALUACION');
  }, [cargasNoLectivas]);

  const [prepHoras, setPrepHoras] = useState(0);
  const [prepDescripcion, setPrepDescripcion] = useState('');

  useEffect(() => {
    if (preparacionCarga) {
      setPrepHoras(preparacionCarga.horas);
      setPrepDescripcion(preparacionCarga.descripcion || '');
    } else {
      setPrepHoras(0);
      setPrepDescripcion('');
    }
  }, [preparacionCarga]);

  // 50% limit helper
  const prepLimit = Math.floor(totalLectivas * 0.5);
  const isPrepOverLimit = prepHoras > prepLimit;

  // ── Other Non-Lective State ─────────────────────────────
  const otrasNoLectivas = useMemo(() => {
    return cargasNoLectivas.filter((c) => c.tipo !== 'PREPARACION_EVALUACION');
  }, [cargasNoLectivas]);

  const [newNonLectiveTipo, setNewNonLectiveTipo] = useState<TipoCargaNoLectiva>('CONSEJERIA');
  const [newNonLectiveHoras, setNewNonLectiveHoras] = useState(2);
  const [newNonLectiveDesc, setNewNonLectiveDesc] = useState('');
  const [newNonLectiveProjCode, setNewNonLectiveProjCode] = useState('');
  const [newNonLectiveProjName, setNewNonLectiveProjName] = useState('');
  const [newNonLectiveAlumnos, setNewNonLectiveAlumnos] = useState(0);
  const [newNonLectiveCiclo, setNewNonLectiveCiclo] = useState('');

  // Reset other non-lective inputs
  const resetNewNonLective = () => {
    setNewNonLectiveHoras(2);
    setNewNonLectiveDesc('');
    setNewNonLectiveProjCode('');
    setNewNonLectiveProjName('');
    setNewNonLectiveAlumnos(0);
    setNewNonLectiveCiclo('');
  };

  // ── Course Assignment Modal State ───────────────────────
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedGrupoId, setSelectedGrupoId] = useState('');
  
  // Theory Form State
  const [teoriaHoras, setTeoriaHoras] = useState(0);
  const [teoriaCompartido, setTeoriaCompartido] = useState(false);
  const [teoriaDocenteCompartidoId, setTeoriaDocenteCompartidoId] = useState('');
  const [horasTeoriaCompartido, setHorasTeoriaCompartido] = useState(0);

  // Practice Form State
  const [practicaHoras, setPracticaHoras] = useState(0);
  const [practicaCompartido, setPracticaCompartido] = useState(false);
  const [practicaDocenteCompartidoId, setPracticaDocenteCompartidoId] = useState('');
  const [horasPracticaCompartido, setHorasPracticaCompartido] = useState(0);

  // Laboratory Form State
  const [labHoras, setLabHoras] = useState(0);
  const [labCompartido, setLabCompartido] = useState(false);
  const [labDocenteCompartidoId, setLabDocenteCompartidoId] = useState('');
  const [horasLabCompartido, setHorasLabCompartido] = useState(0);
  const [selectedLabGroups, setSelectedLabGroups] = useState<number[]>([]);
  const [selectedLabGroupsCompartido, setSelectedLabGroupsCompartido] = useState<number[]>([]);

  // Grouped assignments for display
  const groupedAssignments = useMemo(() => {
    const map: Record<string, {
      grupoId: string;
      cursoNombre: string;
      cursoCodigo: string;
      seccion: string;
      numAlumnos: number;
      ciclo: number;
      teoria: { id?: string; horas: number; compartido: boolean; docenteCompartidoId?: string | null };
      practica: { id?: string; horas: number; compartido: boolean; docenteCompartidoId?: string | null };
      laboratorio: { id?: string; horas: number; compartido: boolean; docenteCompartidoId?: string | null; grupoLaboratorio?: number | null };
      allIds: string[];
    }> = {};

    cargasLectivas.forEach((a) => {
      const key = a.grupoId;
      if (!map[key]) {
        map[key] = {
          grupoId: a.grupoId,
          cursoNombre: a.grupo.curso.nombre,
          cursoCodigo: a.grupo.curso.codigo,
          seccion: a.grupo.seccion || a.grupo.nombre || 'A',
          numAlumnos: a.grupo.numAlumnos || 0,
          ciclo: a.grupo.curso.ciclo,
          teoria: { horas: 0, compartido: false },
          practica: { horas: 0, compartido: false },
          laboratorio: { horas: 0, compartido: false },
          allIds: [],
        };
      }

      const g = map[key];
      g.allIds.push(a.id);
      if (a.tipo === 'TEORIA') {
        g.teoria = { id: a.id, horas: a.horasAsignadas, compartido: a.compartido, docenteCompartidoId: a.docenteCompartidoId };
      } else if (a.tipo === 'PRACTICA') {
        g.practica = { id: a.id, horas: a.horasAsignadas, compartido: a.compartido, docenteCompartidoId: a.docenteCompartidoId };
      } else if (a.tipo === 'LABORATORIO') {
        g.laboratorio = { id: a.id, horas: a.horasAsignadas, compartido: a.compartido, docenteCompartidoId: a.docenteCompartidoId, grupoLaboratorio: a.grupoLaboratorio };
      }
    });

    return Object.values(map);
  }, [cargasLectivas]);

  // Available groups query
  const { data: gruposDisponibles = [] } = useQuery({
    ...trpc.cargaLectiva.gruposDisponibles.queryOptions({ periodoId }),
    enabled: !!periodoId && showAssignModal,
  });

  const selectedGrupoObj = useMemo(() => {
    return gruposDisponibles.find((g) => g.id === selectedGrupoId);
  }, [gruposDisponibles, selectedGrupoId]);

  // Populate hours on group selection
  useEffect(() => {
    if (selectedGrupoObj) {
      setTeoriaHoras(selectedGrupoObj.curso.horasTeoria);
      setPracticaHoras(selectedGrupoObj.curso.horasPractica);
      setLabHoras(selectedGrupoObj.curso.horasLaboratorio);
      setSelectedLabGroups([]);
      setSelectedLabGroupsCompartido([]);
      setTeoriaCompartido(false);
      setPracticaCompartido(false);
      setLabCompartido(false);
      setTeoriaDocenteCompartidoId('');
      setPracticaDocenteCompartidoId('');
      setLabDocenteCompartidoId('');
    }
  }, [selectedGrupoObj]);

  // ── Mutations ───────────────────────────────────────────
  const updateDocenteMutation = useMutation(
    trpc.docente.update.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: trpc.docente.byId.queryKey({ id: selectedDocenteId }) });
        alert('Datos del docente actualizados correctamente.');
      },
      onError: (err) => alert(err.message),
    })
  );

  const assignCursoCompletoMutation = useMutation(
    trpc.cargaLectiva.assignCursoCompleto.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: trpc.cargaLectiva.list.queryKey() });
        queryClient.invalidateQueries({ queryKey: trpc.cargaNoLectiva.byDocente.queryKey() });
        setShowAssignModal(false);
        setSelectedGrupoId('');
        alert('Asignación registrada correctamente.');
      },
      onError: (err) => alert(err.message),
    })
  );

  const unassignMutation = useMutation(
    trpc.cargaLectiva.unassign.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: trpc.cargaLectiva.list.queryKey() });
        queryClient.invalidateQueries({ queryKey: trpc.cargaNoLectiva.byDocente.queryKey() });
      },
      onError: (err) => alert(err.message),
    })
  );

  const createCargaNoLectivaMutation = useMutation(
    trpc.cargaNoLectiva.create.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: trpc.cargaNoLectiva.byDocente.queryKey() });
      },
      onError: (err) => alert(err.message),
    })
  );

  const updateCargaNoLectivaMutation = useMutation(
    trpc.cargaNoLectiva.update.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: trpc.cargaNoLectiva.byDocente.queryKey() });
        alert('Actividad guardada correctamente.');
      },
      onError: (err) => alert(err.message),
    })
  );

  const deleteCargaNoLectivaMutation = useMutation(
    trpc.cargaNoLectiva.delete.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: trpc.cargaNoLectiva.byDocente.queryKey() });
      },
      onError: (err) => alert(err.message),
    })
  );

  const createDeclaracionMutation = useMutation(
    trpc.declaracion.create.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: trpc.declaracion.byDocente.queryKey() });
      },
      onError: (err) => alert(err.message),
    })
  );

  // ── Event Handlers ──────────────────────────────────────
  const handleSaveDocente = () => {
    if (!docente) return;
    updateDocenteMutation.mutate({
      id: docente.id,
      nombre: docente.nombre,
      email: docente.email,
      categoria: docente.categoria,
      tipo: docente.tipo,
      antiguedad: new Date(docente.antiguedad),
      activo: docente.activo,
      gradoAcademico: docente.gradoAcademico || undefined,
      especialidad: docente.especialidad || undefined,
      experienciaAnios: docente.experienciaAnios,
      perfilAcademico: docente.perfilAcademico || undefined,
      departamentoId: docente.departamentoId,
      modalidad,
      horasContrato,
    });
  };

  const handleSavePreparacion = () => {
    if (isPrepOverLimit) {
      alert('Error: Las horas de preparación y evaluación exceden el 50% de las horas lectivas.');
      return;
    }

    if (preparacionCarga) {
      updateCargaNoLectivaMutation.mutate({
        id: preparacionCarga.id,
        horas: prepHoras,
        descripcion: prepDescripcion,
      });
    } else {
      createCargaNoLectivaMutation.mutate({
        docenteId: selectedDocenteId,
        periodoId,
        tipo: 'PREPARACION_EVALUACION',
        horas: prepHoras,
        descripcion: prepDescripcion,
      });
    }
  };

  const handleAddOtherNoLective = () => {
    createCargaNoLectivaMutation.mutate(
      {
        docenteId: selectedDocenteId,
        periodoId,
        tipo: newNonLectiveTipo,
        horas: newNonLectiveHoras,
        descripcion: newNonLectiveDesc || undefined,
        codigoProyecto: newNonLectiveProjCode || undefined,
        nombreProyecto: newNonLectiveProjName || undefined,
        numAlumnos: newNonLectiveAlumnos || undefined,
        cicloConsejeria: newNonLectiveCiclo || undefined,
      },
      {
        onSuccess: () => {
          resetNewNonLective();
          alert('Actividad no lectiva agregada correctamente.');
        },
      }
    );
  };

  const handleDeleteOtherNoLective = (id: string) => {
    if (confirm('¿Está seguro de eliminar esta actividad no lectiva?')) {
      deleteCargaNoLectivaMutation.mutate({ id });
    }
  };

  const handleDeleteGroupedAssignment = async (allIds: string[]) => {
    if (confirm('¿Está seguro de eliminar todas las asignaciones para este curso?')) {
      try {
        for (const id of allIds) {
          await unassignMutation.mutateAsync({ id });
        }
        alert('Asignación eliminada correctamente.');
      } catch (err: any) {
        alert(err.message);
      }
    }
  };

  const handleSaveAssignCursoCompleto = () => {
    if (!selectedGrupoId) return;

    assignCursoCompletoMutation.mutate({
      docenteId: selectedDocenteId,
      grupoId: selectedGrupoId,
      periodoId,
      teoria: {
        horas: teoriaHoras,
        compartido: teoriaCompartido,
        docenteCompartidoId: teoriaCompartido ? teoriaDocenteCompartidoId || null : null,
        horasCompartido: teoriaCompartido ? horasTeoriaCompartido : 0,
      },
      practica: {
        horas: practicaHoras,
        compartido: practicaCompartido,
        docenteCompartidoId: practicaCompartido ? practicaDocenteCompartidoId || null : null,
        horasCompartido: practicaCompartido ? horasPracticaCompartido : 0,
      },
      laboratorio: {
        horas: labHoras,
        compartido: labCompartido,
        docenteCompartidoId: labCompartido ? labDocenteCompartidoId || null : null,
        horasCompartido: labCompartido ? horasLabCompartido : 0,
        gruposLaboratorio: selectedLabGroups,
        gruposLaboratorioCompartido: selectedLabGroupsCompartido,
      },
    });
  };

  // Toggle Laboratory group selection
  const handleToggleLabGroup = (num: number, isShared: boolean) => {
    if (isShared) {
      setSelectedLabGroupsCompartido((prev) =>
        prev.includes(num) ? prev.filter((n) => n !== num) : [...prev, num]
      );
    } else {
      setSelectedLabGroups((prev) =>
        prev.includes(num) ? prev.filter((n) => n !== num) : [...prev, num]
      );
    }
  };

  // Pre-fill form for editing
  const handleEditGroupedAssignment = (item: any) => {
    setSelectedGrupoId(item.grupoId);
    setTeoriaHoras(item.teoria.horas);
    setTeoriaCompartido(item.teoria.compartido);
    setTeoriaDocenteCompartidoId(item.teoria.docenteCompartidoId || '');
    setPracticaHoras(item.practica.horas);
    setPracticaCompartido(item.practica.compartido);
    setPracticaDocenteCompartidoId(item.practica.docenteCompartidoId || '');

    setLabHoras(item.laboratorio.horas);
    setLabCompartido(item.laboratorio.compartido);
    setLabDocenteCompartidoId(item.laboratorio.docenteCompartidoId || '');
    if (item.laboratorio.grupoLaboratorio) {
      setSelectedLabGroups([item.laboratorio.grupoLaboratorio]);
    } else {
      setSelectedLabGroups([]);
    }
    setSelectedLabGroupsCompartido([]);
    setShowAssignModal(true);
  };

  return (
    <div className="space-y-6 p-6 max-w-7xl mx-auto">
      {/* ── Steps Header ───────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-black text-slate-800">Nueva Carga Horaria</h1>
          <p className="text-sm text-slate-500 font-medium mt-1">Paso 1 de 3: Rellene la carga horaria general</p>
        </div>
        <div className="mt-4 sm:mt-0 flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="btn-secondary flex items-center gap-2"
          >
            Volver
          </button>
        </div>
      </div>

      {/* ── Warning Banner ─────────────────────────────────── */}
      {declaracion && isLocked && (
        <div className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded-r-xl shadow-sm">
          <div className="flex">
            <div className="flex-shrink-0">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
            </div>
            <div className="ml-3">
              <p className="text-sm text-amber-800 font-bold">
                Carga Horaria Bloqueada: La declaración se encuentra en estado{' '}
                <span className="uppercase underline">{declaracion.estado}</span>.
              </p>
              <p className="text-xs text-amber-700 mt-1">
                Solo se permiten modificaciones cuando la declaración está en estado BORRADOR u OBSERVADA.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── Period Selector & Search Dropdown ───────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">
            Periodo Académico
          </label>
          <select
            value={periodoId}
            onChange={(e) => setSelectedPeriodoId(e.target.value)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary/20 bg-white"
          >
            {periodos.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre} {p.activo ? '(Activo)' : ''}
              </option>
            ))}
          </select>
        </div>

        {showTeacherSearch && (
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">
              Buscar Docente
            </label>
            <select
              value={selectedDocenteId}
              onChange={(e) => setSelectedDocenteId(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary/20 bg-white"
            >
              <option value="">-- Seleccione un Docente --</option>
              {filteredDocentes.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.nombre} ({d.email})
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* If no teacher is selected */}
      {!selectedDocenteId && (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-8 text-center text-slate-500 font-medium">
          <UserIcon className="h-10 w-10 mx-auto text-slate-400 mb-3" />
          Por favor, seleccione un docente para visualizar y rellenar su carga horaria.
        </div>
      )}

      {selectedDocenteId && !docente && isLoadingDocente && (
        <div className="text-center py-6 text-slate-500">Cargando datos del docente...</div>
      )}

      {selectedDocenteId && docente && (
        <>
          {/* If declaration does not exist, provide button to create it */}
          {!declaracion && !isLoadingDeclaracion && (
            <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-6 text-center">
              <p className="text-indigo-900 font-bold text-sm mb-3">
                No existe una declaración de carga horaria activa para este docente en el periodo seleccionado.
              </p>
              <button
                onClick={() => createDeclaracionMutation.mutate({ docenteId: selectedDocenteId, periodoId })}
                className="btn-primary"
                disabled={createDeclaracionMutation.isPending}
              >
                {createDeclaracionMutation.isPending ? 'Iniciando...' : 'Iniciar Carga Horaria (Borrador)'}
              </button>
            </div>
          )}

          {/* ── Situational Status Form ────────────────────────── */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
            <h2 className="text-base font-bold text-slate-800 border-b border-slate-100 pb-2">
              Datos Situacionales del Docente
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase">Facultad</label>
                <div className="text-sm font-semibold text-slate-800 mt-1 bg-slate-50 px-3 py-2 rounded-lg border border-slate-100">
                  {docenteFacultadYDepartamento.facultad}
                </div>
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase">Departamento Académico</label>
                <div className="text-sm font-semibold text-slate-800 mt-1 bg-slate-50 px-3 py-2 rounded-lg border border-slate-100">
                  {docenteFacultadYDepartamento.departamento}
                </div>
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase">Nombre Completo</label>
                <div className="text-sm font-semibold text-slate-800 mt-1 bg-slate-50 px-3 py-2 rounded-lg border border-slate-100">
                  {docente.nombre}
                </div>
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase">Condición</label>
                <div className="text-sm font-semibold text-slate-800 mt-1 bg-slate-50 px-3 py-2 rounded-lg border border-slate-100">
                  {docente.tipo === 'NOMBRADO' ? 'Nombrado' : 'Contratado'}
                </div>
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase">Categoría</label>
                <div className="text-sm font-semibold text-slate-800 mt-1 bg-slate-50 px-3 py-2 rounded-lg border border-slate-100">
                  {docente.categoria === 'PRINCIPAL'
                    ? 'Principal'
                    : docente.categoria === 'ASOCIADO'
                    ? 'Asociado'
                    : docente.categoria === 'AUXILIAR'
                    ? 'Auxiliar'
                    : docente.categoria}
                </div>
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase">Modalidad</label>
                <select
                  value={modalidad}
                  onChange={(e) => setModalidad(e.target.value as ModalidadDocente)}
                  disabled={isLocked || updateDocenteMutation.isPending}
                  className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary/20 bg-white mt-1"
                >
                  <option value="TIEMPO_COMPLETO">Tiempo Completo</option>
                  <option value="DEDICACION_EXCLUSIVA">Dedicación Exclusiva</option>
                  <option value="TIEMPO_PARCIAL">Tiempo Parcial</option>
                </select>
              </div>
              <div className="sm:col-span-2 md:col-span-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase">Horas de Contrato</label>
                <div className="flex gap-2 mt-1">
                  <input
                    type="number"
                    value={horasContrato}
                    onChange={(e) => setHorasContrato(Number(e.target.value))}
                    disabled={isLocked || updateDocenteMutation.isPending}
                    className="flex-1 rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary/20 bg-white"
                  />
                  {!isLocked && (
                    <button
                      onClick={handleSaveDocente}
                      disabled={updateDocenteMutation.isPending}
                      className="btn-primary py-1 px-4 text-xs shrink-0"
                    >
                      {updateDocenteMutation.isPending ? 'Guardando...' : 'Guardar'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* ── Trabajos Lectivos Table ────────────────────────── */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-2">
              <h2 className="text-base font-bold text-slate-800">
                1. Trabajos Lectivos (Clases)
              </h2>
              {!isLocked && (
                <button
                  onClick={() => setShowAssignModal(true)}
                  className="btn-primary py-1 px-3 text-xs flex items-center gap-1 mt-2 sm:mt-0"
                >
                  <Plus className="h-3.5 w-3.5" /> Agregar Asignación
                </button>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-600 border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 text-slate-400 text-xs font-bold uppercase">
                    <th className="py-3 px-2">Curso</th>
                    <th className="py-3 px-2">Sección</th>
                    <th className="py-3 px-2">Escuela</th>
                    <th className="py-3 px-2 text-center">Año / Ciclo</th>
                    <th className="py-3 px-2 text-center">Alumnos</th>
                    <th className="py-3 px-2 text-center">Teoría</th>
                    <th className="py-3 px-2 text-center">Práctica</th>
                    <th className="py-3 px-2 text-center">Laboratorio</th>
                    {!isLocked && <th className="py-3 px-2 text-right">Acciones</th>}
                  </tr>
                </thead>
                <tbody>
                  {groupedAssignments.length === 0 ? (
                    <tr>
                      <td colSpan={isLocked ? 8 : 9} className="text-center py-6 text-slate-400 font-medium">
                        No hay trabajos lectivos registrados para este periodo.
                      </td>
                    </tr>
                  ) : (
                    groupedAssignments.map((item) => (
                      <tr key={item.grupoId} className="border-b border-slate-50 hover:bg-slate-50/50">
                        <td className="py-3 px-2">
                          <p className="font-bold text-slate-800">{item.cursoNombre}</p>
                          <p className="text-xs text-slate-400 font-semibold">{item.cursoCodigo}</p>
                        </td>
                        <td className="py-3 px-2 font-semibold text-slate-700">{item.seccion}</td>
                        <td className="py-3 px-2 font-medium text-slate-500">
                          {docenteFacultadYDepartamento.departamento}
                        </td>
                        <td className="py-3 px-2 text-center font-medium">
                          {Math.ceil(item.ciclo / 2)}° Año (Ciclo {item.ciclo})
                        </td>
                        <td className="py-3 px-2 text-center font-bold text-slate-700">{item.numAlumnos}</td>
                        <td className="py-3 px-2 text-center font-medium">
                          {item.teoria.horas > 0 ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700">
                              {item.teoria.horas}h
                              {item.teoria.compartido && <span className="text-[10px] opacity-75">(Comp)</span>}
                            </span>
                          ) : (
                            <span className="text-slate-300">-</span>
                          )}
                        </td>
                        <td className="py-3 px-2 text-center font-medium">
                          {item.practica.horas > 0 ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700">
                              {item.practica.horas}h
                              {item.practica.compartido && <span className="text-[10px] opacity-75">(Comp)</span>}
                            </span>
                          ) : (
                            <span className="text-slate-300">-</span>
                          )}
                        </td>
                        <td className="py-3 px-2 text-center font-medium">
                          {item.laboratorio.horas > 0 ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700">
                              {item.laboratorio.horas}h
                              {item.laboratorio.compartido && <span className="text-[10px] opacity-75">(Comp)</span>}
                              {item.laboratorio.grupoLaboratorio && (
                                <span className="text-[10px] opacity-75">(G{item.laboratorio.grupoLaboratorio})</span>
                              )}
                            </span>
                          ) : (
                            <span className="text-slate-300">-</span>
                          )}
                        </td>
                        {!isLocked && (
                          <td className="py-3 px-2 text-right">
                            <div className="flex justify-end gap-2">
                              <button
                                onClick={() => handleEditGroupedAssignment(item)}
                                className="p-1 text-slate-400 hover:text-primary transition"
                                title="Editar"
                              >
                                <Info className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteGroupedAssignment(item.allIds)}
                                className="p-1 text-slate-400 hover:text-red-500 transition"
                                title="Eliminar"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Teaching Hours summary */}
            <div className="flex justify-end font-bold text-slate-800 text-sm bg-slate-50 p-3 rounded-lg border border-slate-100">
              Total Horas Lectivas: {totalLectivas}h
            </div>
          </div>

          {/* ── Preparacion y Evaluacion Section ────────────────── */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
            <h2 className="text-base font-bold text-slate-800 border-b border-slate-100 pb-2">
              2. Preparación y Evaluación (Carga Académica No Lectiva Directa)
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
              <div className="md:col-span-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase">
                  Descripción de Actividades de Preparación
                </label>
                <textarea
                  value={prepDescripcion}
                  onChange={(e) => setPrepDescripcion(e.target.value)}
                  disabled={isLocked}
                  placeholder="Ej: Preparación de clases, diseño de evaluaciones, revisión de exámenes y portafolios de teoría/práctica."
                  rows={2}
                  className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary/20 bg-white mt-1 resize-none"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase">
                  Horas Semanales (Límite 50%: {prepLimit}h)
                </label>
                <div className="flex gap-2 mt-1">
                  <input
                    type="number"
                    value={prepHoras}
                    onChange={(e) => setPrepHoras(Number(e.target.value))}
                    disabled={isLocked}
                    className={`flex-1 rounded-lg border px-3 py-1.5 text-sm text-slate-800 focus:outline-none focus:ring-2 bg-white ${
                      isPrepOverLimit
                        ? 'border-red-500 focus:ring-red-100 text-red-700'
                        : 'border-slate-200 focus:ring-primary/20'
                    }`}
                  />
                  {!isLocked && (
                    <button
                      onClick={handleSavePreparacion}
                      disabled={isPrepOverLimit}
                      className="btn-primary py-1 px-4 text-xs shrink-0"
                    >
                      Guardar
                    </button>
                  )}
                </div>
              </div>
            </div>
            {isPrepOverLimit && (
              <p className="text-xs text-red-600 font-semibold mt-1">
                ⚠️ Las horas de preparación ({prepHoras}h) exceden el límite permitido del 50% de las horas lectivas
                asignadas ({prepLimit}h).
              </p>
            )}
          </div>

          {/* ── Other Non-Teaching Activities ──────────────────── */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
            <h2 className="text-base font-bold text-slate-800 border-b border-slate-100 pb-2">
              3. Trabajos No Lectivos Adicionales (Consejería, Investigación, Gestión, etc.)
            </h2>

            {/* List */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-600 border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 text-slate-400 text-xs font-bold uppercase">
                    <th className="py-2 px-1">Actividad</th>
                    <th className="py-2 px-1">Descripción</th>
                    <th className="py-2 px-1 text-center font-bold">Horas</th>
                    <th className="py-2 px-1 text-center">Detalles Adicionales</th>
                    {!isLocked && <th className="py-2 px-1 text-right">Acción</th>}
                  </tr>
                </thead>
                <tbody>
                  {otrasNoLectivas.length === 0 ? (
                    <tr>
                      <td colSpan={isLocked ? 4 : 5} className="text-center py-4 text-slate-400 font-medium">
                        No hay otras actividades no lectivas registradas.
                      </td>
                    </tr>
                  ) : (
                    otrasNoLectivas.map((act) => (
                      <tr key={act.id} className="border-b border-slate-50 text-xs">
                        <td className="py-2 px-1 font-bold text-slate-800">{act.tipo.replace(/_/g, ' ')}</td>
                        <td className="py-2 px-1 font-medium text-slate-500">{act.descripcion || '-'}</td>
                        <td className="py-2 px-1 text-center font-bold text-slate-700">{act.horas}h</td>
                        <td className="py-2 px-1 text-center font-medium text-slate-400">
                          {act.tipo === 'INVESTIGACION' && act.nombreProyecto
                            ? `Proyecto: ${act.nombreProyecto} (${act.codigoProyecto || '-'})`
                            : act.tipo === 'CONSEJERIA' && act.cicloConsejeria
                            ? `Ciclo: ${act.cicloConsejeria} | ${act.numAlumnos || 0} alumnos`
                            : '-'}
                        </td>
                        {!isLocked && (
                          <td className="py-2 px-1 text-right">
                            <button
                              onClick={() => handleDeleteOtherNoLective(act.id)}
                              className="p-1 text-slate-400 hover:text-red-500 transition"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </td>
                        )}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Add Form */}
            {!isLocked && (
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-3">
                <p className="text-xs font-bold text-slate-700">Agregar Actividad</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 items-end">
                  <div>
                    <label className="text-[9px] font-bold text-slate-400 uppercase">Tipo</label>
                    <select
                      value={newNonLectiveTipo}
                      onChange={(e) => setNewNonLectiveTipo(e.target.value as TipoCargaNoLectiva)}
                      className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-800 bg-white mt-1"
                    >
                      <option value="CONSEJERIA">Consejería Académica</option>
                      <option value="INVESTIGACION">Investigación</option>
                      <option value="CAPACITACION">Capacitación Docente</option>
                      <option value="GOBIERNO">Órganos de Gobierno</option>
                      <option value="ADMINISTRACION">Cargos Administrativos</option>
                      <option value="ASESORIA_TESIS">Asesoría de Tesis</option>
                      <option value="RESPONSABILIDAD_SOCIAL">Responsabilidad Social</option>
                      <option value="COMITES_COMISIONES">Comités y Comisiones</option>
                      <option value="JURADOS">Jurados Evaluadores</option>
                      <option value="AUTOEVALUACION_ACREDITACION">Acreditación</option>
                      <option value="OTRAS_AUTORIZADAS">Otras Actividades</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[9px] font-bold text-slate-400 uppercase">Horas Semanales</label>
                    <input
                      type="number"
                      value={newNonLectiveHoras}
                      onChange={(e) => setNewNonLectiveHoras(Number(e.target.value))}
                      className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-800 bg-white mt-1"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="text-[9px] font-bold text-slate-400 uppercase">Descripción</label>
                    <input
                      type="text"
                      value={newNonLectiveDesc}
                      onChange={(e) => setNewNonLectiveDesc(e.target.value)}
                      placeholder="Ej: Consejería a alumnos de la escuela de Sistemas"
                      className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-800 bg-white mt-1"
                    />
                  </div>
                </div>

                {/* Conditional Fields: INVESTIGACION */}
                {newNonLectiveTipo === 'INVESTIGACION' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-white p-3 rounded-lg border border-slate-100">
                    <div>
                      <label className="text-[9px] font-bold text-slate-400 uppercase">Código del Proyecto</label>
                      <input
                        type="text"
                        value={newNonLectiveProjCode}
                        onChange={(e) => setNewNonLectiveProjCode(e.target.value)}
                        placeholder="Ej: PROY-0012"
                        className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-800 mt-1"
                      />
                    </div>
                    <div>
                      <label className="text-[9px] font-bold text-slate-400 uppercase">Nombre del Proyecto</label>
                      <input
                        type="text"
                        value={newNonLectiveProjName}
                        onChange={(e) => setNewNonLectiveProjName(e.target.value)}
                        placeholder="Ej: Inteligencia Artificial en Horarios"
                        className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-800 mt-1"
                      />
                    </div>
                  </div>
                )}

                {/* Conditional Fields: CONSEJERIA / ASESORIA_TESIS */}
                {(newNonLectiveTipo === 'CONSEJERIA' || newNonLectiveTipo === 'ASESORIA_TESIS') && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-white p-3 rounded-lg border border-slate-100">
                    <div>
                      <label className="text-[9px] font-bold text-slate-400 uppercase">Semestre al que corresponde</label>
                      <input
                        type="text"
                        value={newNonLectiveCiclo}
                        onChange={(e) => setNewNonLectiveCiclo(e.target.value)}
                        placeholder={activePeriod?.nombre ?? 'Ej: 2026-I'}
                        className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-800 mt-1"
                      />
                      <p className="text-[9px] text-slate-400 mt-1">
                        Ingrese el semestre académico de la actividad (el periodo activo es{' '}
                        <span className="font-semibold">{activePeriod?.nombre ?? '—'}</span>).
                      </p>
                    </div>
                    <div>
                      <label className="text-[9px] font-bold text-slate-400 uppercase">Número de Alumnos</label>
                      <input
                        type="number"
                        value={newNonLectiveAlumnos}
                        onChange={(e) => setNewNonLectiveAlumnos(Number(e.target.value))}
                        className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-800 mt-1"
                      />
                    </div>
                  </div>
                )}

                <div className="flex justify-end pt-2">
                  <button
                    onClick={handleAddOtherNoLective}
                    className="btn-primary py-1 px-4 text-xs"
                    disabled={createCargaNoLectivaMutation.isPending}
                  >
                    Agregar Actividad
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* ── Assign Course Modal ────────────────────────────────── */}
      {showAssignModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-2xl p-6 relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => {
                setShowAssignModal(false);
                setSelectedGrupoId('');
              }}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition"
            >
              <X className="h-5 w-5" />
            </button>

            <h3 className="text-lg font-bold text-slate-800 mb-4 border-b border-slate-100 pb-2">
              Asignación de Trabajo Lectivo Completo
            </h3>

            <div className="space-y-4">
              {/* Group Selector */}
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                  Curso / Grupo
                </label>
                <select
                  value={selectedGrupoId}
                  onChange={(e) => setSelectedGrupoId(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 bg-white"
                >
                  <option value="">-- Seleccione un Curso/Grupo --</option>
                  {gruposDisponibles.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.curso.codigo} - {g.curso.nombre} ({g.nombre})
                    </option>
                  ))}
                </select>
              </div>

              {selectedGrupoObj && (
                <div className="bg-slate-50 p-4 rounded-lg border border-slate-100 space-y-3">
                  <p className="text-xs font-bold text-slate-700">Detalles de Asignación por Componente</p>

                  {/* 1. TEORÍA */}
                  {selectedGrupoObj.curso.horasTeoria > 0 && (
                    <div className="border-b border-slate-100 pb-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-800">Teoría ({selectedGrupoObj.curso.horasTeoria}h)</span>
                        <label className="flex items-center gap-1.5 text-xs text-slate-600 font-semibold cursor-pointer">
                          <input
                            type="checkbox"
                            checked={teoriaCompartido}
                            onChange={(e) => setTeoriaCompartido(e.target.checked)}
                            className="rounded text-primary border-slate-300"
                          />
                          ¿Compartido?
                        </label>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
                        <div>
                          <label className="text-[9px] font-bold text-slate-400 uppercase">Horas Principal</label>
                          <input
                            type="number"
                            value={teoriaHoras}
                            onChange={(e) => setTeoriaHoras(Number(e.target.value))}
                            className="w-full rounded border border-slate-200 px-2 py-1 text-xs mt-1"
                          />
                        </div>
                        {teoriaCompartido && (
                          <div className="space-y-2">
                            <div>
                              <label className="text-[9px] font-bold text-slate-400 uppercase">Docente Compartido</label>
                              <select
                                value={teoriaDocenteCompartidoId}
                                onChange={(e) => setTeoriaDocenteCompartidoId(e.target.value)}
                                className="w-full rounded border border-slate-200 px-2 py-1 text-xs mt-1 bg-white"
                              >
                                <option value="">Seleccione Docente</option>
                                {filteredDocentes.map((d) => (
                                  <option key={d.id} value={d.id}>
                                    {d.nombre}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label className="text-[9px] font-bold text-slate-400 uppercase">Horas Compartido</label>
                              <input
                                type="number"
                                value={horasTeoriaCompartido}
                                onChange={(e) => setHorasTeoriaCompartido(Number(e.target.value))}
                                className="w-full rounded border border-slate-200 px-2 py-1 text-xs mt-1"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* 2. PRÁCTICA */}
                  {selectedGrupoObj.curso.horasPractica > 0 && (
                    <div className="border-b border-slate-100 pb-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-800">Práctica ({selectedGrupoObj.curso.horasPractica}h)</span>
                        <label className="flex items-center gap-1.5 text-xs text-slate-600 font-semibold cursor-pointer">
                          <input
                            type="checkbox"
                            checked={practicaCompartido}
                            onChange={(e) => setPracticaCompartido(e.target.checked)}
                            className="rounded text-primary border-slate-300"
                          />
                          ¿Compartido?
                        </label>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
                        <div>
                          <label className="text-[9px] font-bold text-slate-400 uppercase">Horas Principal</label>
                          <input
                            type="number"
                            value={practicaHoras}
                            onChange={(e) => setPracticaHoras(Number(e.target.value))}
                            className="w-full rounded border border-slate-200 px-2 py-1 text-xs mt-1"
                          />
                        </div>
                        {practicaCompartido && (
                          <div className="space-y-2">
                            <div>
                              <label className="text-[9px] font-bold text-slate-400 uppercase">Docente Compartido</label>
                              <select
                                value={practicaDocenteCompartidoId}
                                onChange={(e) => setPracticaDocenteCompartidoId(e.target.value)}
                                className="w-full rounded border border-slate-200 px-2 py-1 text-xs mt-1 bg-white"
                              >
                                <option value="">Seleccione Docente</option>
                                {filteredDocentes.map((d) => (
                                  <option key={d.id} value={d.id}>
                                    {d.nombre}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label className="text-[9px] font-bold text-slate-400 uppercase">Horas Compartido</label>
                              <input
                                type="number"
                                value={horasPracticaCompartido}
                                onChange={(e) => setHorasPracticaCompartido(Number(e.target.value))}
                                className="w-full rounded border border-slate-200 px-2 py-1 text-xs mt-1"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* 3. LABORATORIO */}
                  {selectedGrupoObj.curso.horasLaboratorio > 0 && (
                    <div className="pb-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-800">
                          Laboratorio ({selectedGrupoObj.curso.horasLaboratorio}h por grupo)
                        </span>
                        <label className="flex items-center gap-1.5 text-xs text-slate-600 font-semibold cursor-pointer">
                          <input
                            type="checkbox"
                            checked={labCompartido}
                            onChange={(e) => setLabCompartido(e.target.checked)}
                            className="rounded text-primary border-slate-300"
                          />
                          ¿Compartido?
                        </label>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
                        <div>
                          <label className="text-[9px] font-bold text-slate-400 uppercase">Horas Principal</label>
                          <input
                            type="number"
                            value={labHoras}
                            onChange={(e) => setLabHoras(Number(e.target.value))}
                            className="w-full rounded border border-slate-200 px-2 py-1 text-xs mt-1"
                          />
                        </div>
                        {labCompartido && (
                          <div className="space-y-2">
                            <div>
                              <label className="text-[9px] font-bold text-slate-400 uppercase">Docente Compartido</label>
                              <select
                                value={labDocenteCompartidoId}
                                onChange={(e) => setLabDocenteCompartidoId(e.target.value)}
                                className="w-full rounded border border-slate-200 px-2 py-1 text-xs mt-1 bg-white"
                              >
                                <option value="">Seleccione Docente</option>
                                {filteredDocentes.map((d) => (
                                  <option key={d.id} value={d.id}>
                                    {d.nombre}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label className="text-[9px] font-bold text-slate-400 uppercase">Horas Compartido</label>
                              <input
                                type="number"
                                value={horasLabCompartido}
                                onChange={(e) => setHorasLabCompartido(Number(e.target.value))}
                                className="w-full rounded border border-slate-200 px-2 py-1 text-xs mt-1"
                              />
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Lab Group splits checkbox selection (if numGruposLaboratorio > 1) */}
                      {selectedGrupoObj.curso.numGruposLaboratorio > 1 && (
                        <div className="mt-3 bg-white p-3 rounded-lg border border-slate-100 space-y-2">
                          <p className="text-[10px] font-bold text-slate-400 uppercase">
                            Selección de Grupos de Laboratorio (Total: {selectedGrupoObj.curso.numGruposLaboratorio})
                          </p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                              <span className="text-xs font-semibold text-slate-700">Docente Principal:</span>
                              <div className="flex gap-2 mt-1">
                                {Array.from({ length: selectedGrupoObj.curso.numGruposLaboratorio }).map((_, i) => {
                                  const num = i + 1;
                                  return (
                                    <label key={num} className="flex items-center gap-1 text-xs font-medium cursor-pointer">
                                      <input
                                        type="checkbox"
                                        checked={selectedLabGroups.includes(num)}
                                        onChange={() => handleToggleLabGroup(num, false)}
                                        className="rounded text-primary border-slate-300"
                                      />
                                      G{num}
                                    </label>
                                  );
                                })}
                              </div>
                            </div>
                            {labCompartido && (
                              <div>
                                <span className="text-xs font-semibold text-slate-700">Docente Compartido:</span>
                                <div className="flex gap-2 mt-1">
                                  {Array.from({ length: selectedGrupoObj.curso.numGruposLaboratorio }).map((_, i) => {
                                    const num = i + 1;
                                    return (
                                      <label key={num} className="flex items-center gap-1 text-xs font-medium cursor-pointer">
                                        <input
                                          type="checkbox"
                                          checked={selectedLabGroupsCompartido.includes(num)}
                                          onChange={() => handleToggleLabGroup(num, true)}
                                          className="rounded text-primary border-slate-300"
                                        />
                                        G{num}
                                      </label>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 border-t border-slate-100 pt-4 mt-6">
              <button
                onClick={() => {
                  setShowAssignModal(false);
                  setSelectedGrupoId('');
                }}
                className="btn-secondary"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveAssignCursoCompleto}
                disabled={!selectedGrupoId || assignCursoCompletoMutation.isPending}
                className="btn-primary"
              >
                {assignCursoCompletoMutation.isPending ? 'Guardando...' : 'Asignar Carga'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
