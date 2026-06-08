'use client';

import { useTRPC } from '@/trpc/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, Search, X, TrendingUp, CheckCircle2, BookOpen, User } from 'lucide-react';

type FormData = {
  codigo: string;
  nombre: string;
  creditos: number;
  horasTeoria: number;
  horasPractica: number;
  horasLaboratorio: number;
  ciclo: number;
  requiereLaboratorio: boolean;
  perfilRequerido: string;
  gradoRequerido: string;
  experienciaMinima: number;
  especialidadRequerida: string;
  departamento: string;
  requisitos: string;
  condicion: string;
};

const emptyForm: FormData = {
  codigo: '', nombre: '', creditos: 3, horasTeoria: 2, horasPractica: 0, horasLaboratorio: 2, ciclo: 1, requiereLaboratorio: false,
  perfilRequerido: '', gradoRequerido: '', experienciaMinima: 0, especialidadRequerida: '',
  departamento: 'Dpto. de Ing. Sistemas', requisitos: '', condicion: 'O',
};

export default function CursosPage() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedCurso, setSelectedCurso] = useState<any>(null);
  const [editId, setEditId] = useState<string | null>(null);
   const [form, setForm] = useState<FormData>(emptyForm);
   const [search, setSearch] = useState('');
   const [filterCiclo, setFilterCiclo] = useState<number | undefined>();
   const { data: user } = useQuery({ ...trpc.auth.me.queryOptions() });
   const isAdmin = user?.role === 'ADMIN';
   const isDocente = user?.role === 'DOCENTE';
   const isSecretaria = user?.role === 'SECRETARIA_ACADEMICA';
   const isDirector = user?.role === 'DIRECTOR_ESCUELA';

   const [activeTab, setActiveTab] = useState<'MIS_CURSOS' | 'CATALOGO' | 'APERTURA'>('CATALOGO');

   useEffect(() => {
     if (user?.role === 'SECRETARIA_ACADEMICA') setActiveTab('APERTURA');
     else if (user?.role === 'DOCENTE') setActiveTab('MIS_CURSOS');
     else setActiveTab('CATALOGO');
   }, [user?.role]);

   const [showAperturaModal, setShowAperturaModal] = useState(false);
   const [apertureSearch, setApertureSearch] = useState('');

   const { data: allCursos = [] } = useQuery({
     ...trpc.curso.list.queryOptions({ vista: 'CATALOGO' }),
     enabled: showAperturaModal
   });

   const filteredApertureCursos = allCursos.filter(c => 
     c.nombre.toLowerCase().includes(apertureSearch.toLowerCase()) || 
     c.codigo.toLowerCase().includes(apertureSearch.toLowerCase())
   );

   const canCreateEdit = isAdmin;
   const canToggleApertura = isAdmin || isSecretaria;

  const { data: periodoActivo } = useQuery({ ...trpc.periodo.active.queryOptions() });
  const { data: cursos = [], isLoading } = useQuery({
    ...trpc.curso.list.queryOptions({ 
      search: search || undefined, 
      ciclo: filterCiclo,
      vista: activeTab === 'MIS_CURSOS' ? 'MIS_CURSOS' : activeTab === 'APERTURA' ? 'APERTURA' : 'CATALOGO',
      periodoId: periodoActivo?.id || undefined,
      docenteId: activeTab === 'MIS_CURSOS' ? (user?.docenteId || undefined) : undefined
    })
  });
  const { data: ciclos = [] } = useQuery({ ...trpc.curso.ciclos.queryOptions() });

  const { data: matchedCourses = [] } = useQuery({
    ...trpc.docente.matchingCourses.queryOptions(),
    enabled: isDocente && periodoActivo?.estado === 'POSTULACION',
  });

  const { data: myPostulations = [] } = useQuery({
    ...trpc.docente.myPostulations.queryOptions(),
    enabled: isDocente,
  });

  const toggleAperturaMutation = useMutation(
    trpc.curso.toggleApertura.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: trpc.curso.list.queryKey() });
      },
    })
  );

  const { data: personalDocente } = useQuery({
    ...trpc.docente.personalStats.queryOptions(),
    enabled: isDocente,
  });

  const postulateMutation = useMutation(
    trpc.docente.postulateToGroup.mutationOptions({
      onSuccess: () => {
        alert('Postulación al grupo registrada exitosamente');
        setShowAssignModal(false);
        queryClient.invalidateQueries({ queryKey: trpc.docente.matchingCourses.queryKey() });
        queryClient.invalidateQueries({ queryKey: trpc.docente.myPostulations.queryKey() });
      },
      onError: (err) => alert(err.message),
    })
  );

  const postulateCourseMutation = useMutation(
    trpc.docente.postulateToCourse.mutationOptions({
      onSuccess: () => {
        alert('Postulación al curso registrada exitosamente');
        queryClient.invalidateQueries({ queryKey: trpc.docente.matchingCourses.queryKey() });
        queryClient.invalidateQueries({ queryKey: trpc.docente.myPostulations.queryKey() });
      },
      onError: (err) => alert(err.message),
    })
  );

  const [postulatePriority, setPostulatePriority] = useState(1);

  const deleteMutation = useMutation(
    trpc.curso.delete.mutationOptions({
      onSuccess: () => { queryClient.invalidateQueries({ queryKey: trpc.curso.list.queryKey() }); },
    })
  );

  const createMutation = useMutation(
    trpc.curso.create.mutationOptions({
      onSuccess: () => { queryClient.invalidateQueries({ queryKey: trpc.curso.list.queryKey() }); closeModal(); },
    })
  );
  const updateMutation = useMutation(
    trpc.curso.update.mutationOptions({
      onSuccess: () => { queryClient.invalidateQueries({ queryKey: trpc.curso.list.queryKey() }); closeModal(); },
    })
  );

  function closeModal() { setShowModal(false); setEditId(null); setForm(emptyForm); }

  function openEdit(c: (typeof cursos)[0]) {
    setEditId(c.id);
    setForm({
      codigo: c.codigo,
      nombre: c.nombre,
      creditos: c.creditos,
      horasTeoria: c.horasTeoria,
      horasPractica: c.horasPractica || 0,
      horasLaboratorio: c.horasLaboratorio,
      ciclo: c.ciclo,
      requiereLaboratorio: c.requiereLaboratorio,
      perfilRequerido: c.perfilRequerido || '',
      gradoRequerido: c.gradoRequerido || '',
      experienciaMinima: c.experienciaMinima || 0,
      especialidadRequerida: c.especialidadRequerida || '',
      departamento: c.departamento || '',
      requisitos: c.requisitos || '',
      condicion: c.condicion || 'O',
    });
    setShowModal(true);
  }

  const handleToggleApertura = async (c: (typeof cursos)[0]) => {
    const isOpening = !c.aperturado;
    let motivo: string | undefined = undefined;

    if (isOpening && periodoActivo) {
      const esExtraordinario = periodoActivo.nombre.includes('Extraordinario');
      const esImpar = periodoActivo.nombre.endsWith('-I');
      const esPar = periodoActivo.nombre.endsWith('-II');
      const cicloImpar = c.ciclo % 2 !== 0;
      const cicloPar = c.ciclo % 2 === 0;

      let esValido = esExtraordinario;
      if (!esValido) {
        if (esImpar && cicloImpar) esValido = true;
        if (esPar && cicloPar) esValido = true;
      }

      if (!esValido) {
        const inputMotivo = window.prompt(
          `Este curso (Ciclo ${c.ciclo}) no corresponde al semestre actual (${periodoActivo.nombre}).\n\nPor favor, ingrese el motivo de la apertura excepcional:`
        );
        if (inputMotivo === null) return; // Cancelado
        if (!inputMotivo.trim()) {
          alert('El motivo es obligatorio para aperturas excepcionales.');
          return;
        }
        motivo = inputMotivo;
      }
    }

    toggleAperturaMutation.mutate({ 
      id: c.id, 
      aperturado: isOpening,
      motivoAperturaExcepcional: motivo 
    });
  };

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (editId) {
      updateMutation.mutate({ id: editId, ...form });
    } else {
      createMutation.mutate(form);
    }
  }

  const aperturarTodoMutation = useMutation(
    trpc.curso.aperturarTodo.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: trpc.curso.list.queryKey() });
        alert('Todos los cursos correspondientes al semestre han sido aperturados.');
      },
      onError: (e) => alert(e.message),
    })
  );

  const startProcessMutation = useMutation(
    trpc.curso.startProcess.mutationOptions({
      onSuccess: () => {
        alert('Periodo de postulaciones iniciado');
        queryClient.invalidateQueries({ queryKey: trpc.periodo.active.queryKey() });
      },
    })
  );

  const processAssignmentsMutation = useMutation(
    trpc.horario.processAssignments.mutationOptions({
      onSuccess: () => {
        alert('Asignación de cursos completada. Los docentes ahora pueden elegir sus horarios.');
        queryClient.invalidateQueries({ queryKey: trpc.periodo.active.queryKey() });
      },
      onError: (err) => alert(err.message),
    })
  );

  return (
    <div className="space-y-6">
      <div className="flex gap-1 p-1 bg-slate-100 border border-border rounded-xl w-fit">
        {isDocente && (
          <button
            onClick={() => setActiveTab('MIS_CURSOS')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all uppercase tracking-wider ${
              activeTab === 'MIS_CURSOS' 
                ? 'bg-white text-primary shadow-sm' 
                : 'text-text-sub hover:text-text-main'
            }`}
          >
            <User className="h-4 w-4" /> Mis Cursos
          </button>
        )}
        <button
          onClick={() => setActiveTab('CATALOGO')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all uppercase tracking-wider ${
            activeTab === 'CATALOGO' 
              ? 'bg-white text-primary shadow-sm' 
              : 'text-text-sub hover:text-text-main'
          }`}
        >
          <BookOpen className="h-4 w-4" /> Catálogo
        </button>
        {(isAdmin || isSecretaria) && (
          <button
            onClick={() => setActiveTab('APERTURA')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all uppercase tracking-wider ${
              activeTab === 'APERTURA' 
                ? 'bg-white text-primary shadow-sm' 
                : 'text-text-sub hover:text-text-main'
            }`}
          >
            <CheckCircle2 className="h-4 w-4" /> Apertura {periodoActivo?.nombre}
          </button>
        )}
      </div>

      {/* Header section with Stats or Controls */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-main">
            {activeTab === 'MIS_CURSOS' ? 'Mis Cursos y Postulaciones' : 
             activeTab === 'APERTURA' ? `Apertura de Cursos - ${periodoActivo?.nombre || '...'}` :
             'Catálogo de Cursos'}
          </h1>
          <p className="text-sm text-text-sub mt-1">
            {activeTab === 'MIS_CURSOS' ? 'Gestiona tus postulaciones y carga lectiva' : 
             activeTab === 'APERTURA' ? 'Habilita cursos para el presente ciclo académico' :
             'Listado general de cursos de la carrera'}
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          {canCreateEdit && activeTab === 'CATALOGO' && (
            <button onClick={() => { setEditId(null); setForm(emptyForm); setShowModal(true); }} className="btn-primary">
              <Plus className="h-4 w-4" /> Nuevo Curso
            </button>
          )}
          
          {activeTab === 'APERTURA' && (isAdmin || isSecretaria) && (
            <div className="flex items-center gap-3">
              <button 
                onClick={() => {
                  if (confirm('¿Desea aperturar todos los cursos correspondientes a la paridad del semestre actual?')) {
                    aperturarTodoMutation.mutate();
                  }
                }}
                disabled={aperturarTodoMutation.isPending}
                className="btn-secondary text-primary border-primary/30 hover:bg-primary-light"
              >
                {aperturarTodoMutation.isPending ? 'Aperturando...' : <><BookOpen className="h-4 w-4" /> Aperturar Todo</>}
              </button>
              {periodoActivo?.estado === 'PLANIFICACION' && (
                <button 
                  onClick={() => startProcessMutation.mutate()}
                  className="btn-primary bg-indigo-600 hover:bg-indigo-700"
                >
                  <TrendingUp className="h-4 w-4" /> Iniciar Postulaciones
                </button>
              )}
              {periodoActivo?.estado === 'POSTULACION' && (
                <button 
                  onClick={() => processAssignmentsMutation.mutate({ periodoId: periodoActivo.id })}
                  disabled={processAssignmentsMutation.isPending}
                  className="btn-primary bg-success hover:bg-green-800"
                >
                  {processAssignmentsMutation.isPending ? 'Procesando...' : <><CheckCircle2 className="h-4 w-4" /> Procesar Asignaciones</>}
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {activeTab === 'APERTURA' && periodoActivo && (
        <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <BookOpen className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-bold text-text-main">Semestre Actual: {periodoActivo.nombre}</p>
              <p className="text-xs text-text-sub">
                Mostrando cursos de ciclos {periodoActivo.nombre.endsWith('-I') ? 'IMPARES' : 'PARES'} (Plan 2018)
              </p>
            </div>
          </div>
          <button 
            onClick={() => setShowAperturaModal(true)}
            className="px-4 py-2 bg-warning/10 text-warning border border-warning/30 rounded-lg text-xs font-bold hover:bg-warning/20 transition-all"
          >
            Apertura Excepcional
          </button>
        </div>
      )}

      {(activeTab === 'CATALOGO' || activeTab === 'APERTURA') ? (
        <>
          {/* Sección Personalizada para Docentes */}
          {isDocente && matchedCourses.length > 0 && (
        <div className="bg-primary/5 border border-primary/10 rounded-2xl p-6 mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-primary/10">
              <TrendingUp className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-text-main">Cursos sugeridos para tu perfil</h2>
              <p className="text-xs text-primary font-bold uppercase tracking-wider">Compatibilidad mayor al 70%</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {matchedCourses.map((c: any) => {
              const isPostulated = myPostulations.some((p: any) => p.cursoId === c.id);
              
              return (
                <div key={c.id} className={`p-4 rounded-xl bg-white border shadow-sm transition-all ${
                  isPostulated ? 'border-success/50 shadow-success/5' : 'border-border shadow-sm'
                }`}>
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-primary text-white uppercase">{c.codigo}</span>
                    <span className="text-[10px] font-bold text-success">{Math.round(c.compatibility)}% Match</span>
                  </div>
                  <h3 className="text-sm font-bold text-text-main mb-3 line-clamp-1">{c.nombre}</h3>
                  
                  {isPostulated ? (
                    <div className="flex items-center gap-2 text-success text-xs font-bold py-2">
                      <CheckCircle2 className="h-4 w-4" /> Ya postulado
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-[10px] text-text-sub uppercase font-bold">Prioridad:</span>
                        <select 
                          className="bg-slate-50 border border-border rounded px-2 py-0.5 text-[10px] text-text-main focus:border-primary outline-none"
                          value={postulatePriority}
                          onChange={(e) => setPostulatePriority(Number(e.target.value))}
                        >
                          {[1, 2, 3, 4, 5].map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                      </div>

                      <button 
                        onClick={() => postulateCourseMutation.mutate({ cursoId: c.id, prioridad: postulatePriority })}
                        disabled={postulateCourseMutation.isPending}
                        className="w-full py-2 rounded-lg bg-primary/5 text-primary text-xs font-bold border border-primary/10 hover:bg-primary hover:text-white transition-all"
                      >
                        {postulateCourseMutation.isPending ? 'Procesando...' : 'Confirmar Postulación'}
                      </button>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-text-sub" />
          <input type="text" placeholder="Buscar por nombre o código..." value={search} onChange={(e) => setSearch(e.target.value)}
            className="input-standard pl-12" />
          {search && (
            <button 
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-text-sub hover:text-text-main transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <select value={filterCiclo ?? ''} onChange={(e) => setFilterCiclo(e.target.value ? Number(e.target.value) : undefined)}
          className="rounded-lg border border-border bg-white px-3 py-2.5 text-sm text-text-main focus:border-primary focus:ring-1 focus:ring-primary outline-none">
          <option value="">Todos los ciclos</option>
          {ciclos.map((c) => <option key={c} value={c}>Ciclo {c}</option>)}
        </select>
      </div>

      {/* Listado */}
      <div className="table-standard">
        <table className="w-full text-left border-separate border-spacing-0">
          <thead>
            <tr>
              <th className="px-6 py-4">Código / Nombre</th>
              <th className="px-6 py-4 text-center">Ciclo</th>
              <th className="px-6 py-4 text-center">Créditos</th>
              <th className="px-6 py-4">Horas (T/P/L)</th>
              {activeTab === 'APERTURA' && <th className="px-6 py-4">Estado</th>}
              <th className="px-6 py-4 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {isLoading ? (
              <tr><td colSpan={6} className="px-6 py-12 text-center text-text-sub">Cargando catálogo...</td></tr>
            ) : cursos.length === 0 ? (
              <tr><td colSpan={6} className="px-6 py-12 text-center text-text-sub">No se encontraron cursos</td></tr>
            ) : (
              cursos.map((c) => (
                <tr key={c.id} className="group hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4">
                    <div>
                      <p className="font-bold text-text-main group-hover:text-primary transition-colors">{c.nombre}</p>
                      <p className="text-[10px] text-text-sub font-bold uppercase tracking-widest">{c.codigo}</p>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className="badge badge-gray">Ciclo {c.ciclo}</span>
                  </td>
                  <td className="px-6 py-4 text-center font-bold text-text-main">
                    {c.creditos}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex gap-1">
                      <span className="badge badge-info">{c.horasTeoria}T</span>
                      <span className="badge badge-success">{c.horasPractica}P</span>
                      <span className="badge badge-warning">{c.horasLaboratorio}L</span>
                    </div>
                  </td>
                  {activeTab === 'APERTURA' && (
                    <td className="px-6 py-4">
                      {c.aperturado ? (
                        <span className="badge badge-success">Aperturado</span>
                      ) : (
                        <span className="badge badge-gray text-slate-400">Cerrado</span>
                      )}
                    </td>
                  )}
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {activeTab === 'APERTURA' && (isAdmin || isSecretaria) && (
                        <button
                          onClick={() => {
                            if (!c.aperturado) {
                              const esImpar = periodoActivo?.nombre.endsWith('-I');
                              const cicloImpar = c.ciclo % 2 !== 0;
                              const esExtraordinario = periodoActivo?.nombre.includes('Extraordinario');
                              
                              if (!esExtraordinario && esImpar !== cicloImpar) {
                                setAperturaExcepcionalId(c.id);
                                setShowAperturaModal(true);
                                return;
                              }
                            }
                            handleToggleApertura(c);
                          }}
                          className={`p-2 rounded-lg transition-all ${
                            c.aperturado 
                              ? 'text-danger hover:bg-red-50' 
                              : 'text-success hover:bg-green-50'
                          }`}
                          title={c.aperturado ? 'Cerrar Curso' : 'Aperturar Curso'}
                        >
                          {c.aperturado ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                        </button>
                      )}
                      {canCreateEdit && activeTab === 'CATALOGO' && (
                        <>
                          <button onClick={() => openEdit(c)} 
                            className="p-2 rounded-lg text-text-sub hover:bg-primary-light hover:text-primary transition-all">
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button onClick={() => deleteMutation.mutate({ id: c.id })} 
                            className="p-2 rounded-lg text-text-sub hover:bg-red-50 hover:text-danger transition-all">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </>
                      )}
                      {isDocente && (
                        <button 
                          onClick={() => { setSelectedCurso(c); setShowAssignModal(true); }}
                          className="px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-bold hover:bg-primary-hover transition-all"
                        >
                          Ver Grupos
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      </>
      ) : (
        /* Vista Mis Cursos */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {(personalDocente?.docente?.docenteGrupos || []).map((dg: any) => (
            <div key={dg.id} className="bg-white border border-border rounded-2xl overflow-hidden shadow-sm hover:border-primary/50 transition-all group">
              <div className="p-5">
                <div className="flex justify-between items-start mb-4">
                  <span className="text-[10px] font-bold px-2 py-1 rounded bg-primary/10 text-primary uppercase border border-primary/20">
                    {dg.grupo.curso.codigo}
                  </span>
                  <span className="text-[10px] font-bold px-2 py-1 rounded bg-success/10 text-success uppercase border border-success/20">
                    Grupo {dg.grupo.nombre}
                  </span>
                </div>
                
                <h3 className="text-lg font-bold text-text-main mb-2 group-hover:text-primary transition-colors">
                  {dg.grupo.curso.nombre}
                </h3>
                
                <div className="grid grid-cols-2 gap-4 py-4 border-y border-border my-4">
                  <div>
                    <p className="text-[10px] text-text-sub uppercase font-bold mb-1">Carga Horaria</p>
                    <p className="text-sm text-text-main font-semibold">
                      {dg.grupo.curso.horasTeoria + dg.grupo.curso.horasLaboratorio} horas/sem
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-text-sub uppercase font-bold mb-1">Ciclo</p>
                    <p className="text-sm text-text-main font-semibold">Ciclo {dg.grupo.curso.ciclo}</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-text-sub font-medium">Estado Asignación</span>
                    <span className="text-success font-bold">Asignado</span>
                  </div>
                  
                  {dg.grupo.asignaciones && dg.grupo.asignaciones.length > 0 ? (
                    <div className="p-3 rounded-lg bg-slate-50 border border-border">
                      <p className="text-[10px] text-text-sub uppercase font-bold mb-2">Horario Seleccionado</p>
                      <div className="space-y-1.5">
                        {dg.grupo.asignaciones.map((a: any) => (
                          <div key={a.id} className="flex items-center gap-2 text-[11px] text-text-sub">
                            <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                            <span className="font-bold">{a.franjaHoraria.dia}:</span>
                            <span>{a.franjaHoraria.horaInicio} - {a.franjaHoraria.horaFin}</span>
                            <span className="text-text-sub/60">({a.aula.codigo})</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="p-3 rounded-lg bg-warning/5 border border-warning/20 text-center">
                      <p className="text-[11px] text-warning font-bold">Pendiente de seleccionar horario</p>
                    </div>
                  )}
                </div>
              </div>
              
              <div className="p-4 bg-slate-50 border-t border-border flex justify-between items-center">
                <div className="flex flex-col">
                  <span className="text-[9px] text-text-sub uppercase font-bold">Sede/Edificio</span>
                  <span className="text-xs text-text-main">Facultad de Ingeniería</span>
                </div>
                <button className="text-xs font-bold text-primary hover:text-primary-hover">Ver detalles &rarr;</button>
              </div>
            </div>
          ))}
          
          {(personalDocente?.docente?.docenteGrupos || []).length === 0 && (
            <div className="col-span-full py-20 text-center">
              <div className="inline-flex p-4 rounded-full bg-slate-100 mb-4">
                <BookOpen className="h-8 w-8 text-slate-400" />
              </div>
              <h3 className="text-lg font-bold text-text-main">No tienes cursos asignados</h3>
              <p className="text-sm text-text-sub mt-1 max-w-xs mx-auto">
                Una vez que se procesen las postulaciones, tus cursos aparecerán en esta sección.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Modal de Inscripción para Docentes */}
      {showAssignModal && selectedCurso && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-border bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-lg font-bold text-text-main">Inscripción al Curso</h2>
                <p className="text-xs text-text-sub">{selectedCurso.nombre} ({selectedCurso.codigo})</p>
              </div>
              <button onClick={() => setShowAssignModal(false)} className="rounded-lg p-1 text-text-sub hover:bg-slate-100"><X className="h-5 w-5" /></button>
            </div>
            
            <div className="space-y-4">
              <p className="text-sm text-text-sub font-medium">Selecciona el grupo al que deseas inscribirte:</p>
              <div className="grid gap-3">
                {selectedCurso.grupos.map((g: any) => (
                  <div key={g.id} className="flex items-center justify-between p-4 rounded-xl bg-slate-50 border border-border">
                    <div>
                      <p className="font-bold text-text-main">Grupo {g.nombre}</p>
                      <p className="text-xs text-text-sub font-medium">Periodo: {g.periodoAcademico.nombre}</p>
                    </div>
                    <button
                      onClick={() => postulateMutation.mutate({ grupoId: g.id })}
                      disabled={postulateMutation.isPending}
                      className="btn-primary"
                    >
                      {postulateMutation.isPending ? 'Procesando...' : 'Postular'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modales */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content max-w-2xl">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-text-main">
                {editId ? 'Editar Curso' : 'Nuevo Curso'}
              </h2>
              <button onClick={closeModal} className="rounded-lg p-1 text-text-sub hover:bg-slate-100 transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label-standard">Código</label>
                  <input type="text" required value={form.codigo} onChange={e => setForm({...form, codigo: e.target.value})} className="input-standard" />
                </div>
                <div>
                  <label className="label-standard">Nombre</label>
                  <input type="text" required value={form.nombre} onChange={e => setForm({...form, nombre: e.target.value})} className="input-standard" />
                </div>
              </div>

              <div className="grid grid-cols-4 gap-4">
                <div>
                  <label className="label-standard">Créditos</label>
                  <input type="number" required value={form.creditos} onChange={e => setForm({...form, creditos: Number(e.target.value)})} className="input-standard" />
                </div>
                <div>
                  <label className="label-standard">HT</label>
                  <input type="number" required value={form.horasTeoria} onChange={e => setForm({...form, horasTeoria: Number(e.target.value)})} className="input-standard" />
                </div>
                <div>
                  <label className="label-standard">HP</label>
                  <input type="number" required value={form.horasPractica} onChange={e => setForm({...form, horasPractica: Number(e.target.value)})} className="input-standard" />
                </div>
                <div>
                  <label className="label-standard">HL</label>
                  <input type="number" required value={form.horasLaboratorio} onChange={e => setForm({...form, horasLaboratorio: Number(e.target.value)})} className="input-standard" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label-standard">Ciclo</label>
                  <select value={form.ciclo} onChange={e => setForm({...form, ciclo: Number(e.target.value)})} className="input-standard">
                    {[1,2,3,4,5,6,7,8,9,10].map(c => <option key={c} value={c}>Ciclo {c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label-standard">Condición</label>
                  <select value={form.condicion} onChange={e => setForm({...form, condicion: e.target.value})} className="input-standard">
                    <option value="O">Obligatorio</option>
                    <option value="E">Electivo</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-border">
                <button type="button" onClick={closeModal} className="btn-secondary">Cancelar</button>
                <button type="submit" className="btn-primary">
                  {editId ? 'Actualizar' : 'Registrar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Apertura Excepcional */}
      {showAperturaModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-2xl border border-border bg-white p-6 shadow-2xl flex flex-col max-h-[80vh]">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-lg font-bold text-text-main">Apertura Excepcional de Cursos</h2>
                <p className="text-xs text-text-sub font-medium">Busca y selecciona cualquier curso del catálogo para aperturarlo</p>
              </div>
              <button onClick={() => setShowAperturaModal(false)} className="rounded-lg p-1 text-text-sub hover:bg-slate-100"><X className="h-5 w-5" /></button>
            </div>
            
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-sub" />
              <input 
                type="text" 
                placeholder="Buscar curso por nombre o código..." 
                value={apertureSearch} 
                onChange={(e) => setApertureSearch(e.target.value)}
                className="input-standard pl-10"
              />
            </div>

            <div className="flex-1 overflow-y-auto pr-2">
              <div className="grid gap-2">
                {filteredApertureCursos.map((c) => (
                  <div key={c.id} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-border hover:border-primary/30 transition-all">
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">{c.codigo}</span>
                      <div>
                        <p className="text-sm font-bold text-text-main leading-tight">{c.nombre}</p>
                        <p className="text-[10px] text-text-sub font-bold uppercase tracking-wider">Ciclo {c.ciclo} • {c.departamento}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleToggleApertura(c)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                        c.aperturado 
                          ? 'bg-danger/10 text-danger border border-danger/20 hover:bg-danger/20' 
                          : 'bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20'
                      }`}
                    >
                      {c.aperturado ? 'Cerrar' : 'Aperturar'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
