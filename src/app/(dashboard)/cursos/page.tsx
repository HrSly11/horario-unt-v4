'use client';

import { useTRPC } from '@/trpc/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Plus, Pencil, Trash2, Search, X, TrendingUp, CheckCircle2, BookOpen, User } from 'lucide-react';

type FormData = {
  codigo: string;
  nombre: string;
  creditos: number;
  horasTeoria: number;
  horasLaboratorio: number;
  ciclo: number;
  requiereLaboratorio: boolean;
  perfilRequerido: string;
  gradoRequerido: string;
  experienciaMinima: number;
  especialidadRequerida: string;
};

const emptyForm: FormData = {
  codigo: '', nombre: '', creditos: 3, horasTeoria: 2, horasLaboratorio: 2, ciclo: 1, requiereLaboratorio: false,
  perfilRequerido: '', gradoRequerido: '', experienciaMinima: 0, especialidadRequerida: '',
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
  const [activeTab, setActiveTab] = useState<'GENERAL' | 'MIS_CURSOS'>('GENERAL');

  const { data: user } = useQuery({ ...trpc.auth.me.queryOptions() });
  const isAdmin = user?.role === 'ADMIN';
  const isDocente = user?.role === 'DOCENTE';
  const isSecretaria = user?.role === 'SECRETARIA_ACADEMICA';
  const isDirector = user?.role === 'DIRECTOR_ESCUELA';

  const canManage = isAdmin || isSecretaria;

  const { data: cursos = [], isLoading } = useQuery({
    ...trpc.curso.list.queryOptions({ search: search || undefined, ciclo: filterCiclo })
  });
  const { data: ciclos = [] } = useQuery({ ...trpc.curso.ciclos.queryOptions() });
  const { data: periodoActivo } = useQuery({ ...trpc.periodo.active.queryOptions() });

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
      horasLaboratorio: c.horasLaboratorio,
      ciclo: c.ciclo,
      requiereLaboratorio: c.requiereLaboratorio,
      perfilRequerido: c.perfilRequerido || '',
      gradoRequerido: c.gradoRequerido || '',
      experienciaMinima: c.experienciaMinima || 0,
      especialidadRequerida: c.especialidadRequerida || '',
    });
    setShowModal(true);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (editId) {
      updateMutation.mutate({ id: editId, ...form });
    } else {
      createMutation.mutate(form);
    }
  }

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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Catálogo de Cursos</h1>
          <p className="text-sm text-gray-500 mt-1">Gestión de oferta académica e ingeniería de sistemas</p>
        </div>
        <div className="flex gap-3">
           {isSecretaria && periodoActivo?.estado === 'PLANIFICACION' && (
             <button 
               onClick={() => startProcessMutation.mutate({ periodoId: periodoActivo.id })}
               className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-500 shadow-lg shadow-emerald-500/25 transition-all"
             >
               <TrendingUp className="h-4 w-4" /> Iniciar Postulaciones
             </button>
           )}
           {isSecretaria && periodoActivo?.estado === 'POSTULACION' && (
             <button 
               onClick={() => processAssignmentsMutation.mutate({ periodoId: periodoActivo.id })}
               disabled={processAssignmentsMutation.isPending}
               className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-indigo-500 shadow-lg shadow-indigo-500/25 transition-all"
             >
               {processAssignmentsMutation.isPending ? 'Procesando...' : 'Procesar Asignaciones'}
             </button>
           )}
           {canManage && (
             <button onClick={() => { setEditId(null); setForm(emptyForm); setShowModal(true); }}
               className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-500 shadow-lg shadow-indigo-500/25">
               <Plus className="h-4 w-4" /> Nuevo Curso
             </button>
           )}
         </div>
      </div>

      {isDocente && (
        <div className="flex gap-1 p-1 bg-gray-900 border border-gray-800 rounded-xl w-fit">
          <button
            onClick={() => setActiveTab('GENERAL')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${
              activeTab === 'GENERAL' 
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' 
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            <BookOpen className="h-4 w-4" /> Vista General
          </button>
          <button
            onClick={() => setActiveTab('MIS_CURSOS')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${
              activeTab === 'MIS_CURSOS' 
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' 
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            <User className="h-4 w-4" /> Mis Cursos
          </button>
        </div>
      )}

      {activeTab === 'GENERAL' ? (
        <>
          {/* Sección Personalizada para Docentes */}
          {isDocente && matchedCourses.length > 0 && (
        <div className="bg-indigo-500/5 border border-indigo-500/20 rounded-2xl p-6 mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-indigo-600/20">
              <TrendingUp className="h-5 w-5 text-indigo-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Cursos sugeridos para tu perfil</h2>
              <p className="text-xs text-indigo-400 font-medium uppercase tracking-wider">Compatibilidad mayor al 70%</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {matchedCourses.map((c: any) => {
              const isPostulated = myPostulations.some((p: any) => p.cursoId === c.id);
              
              return (
                <div key={c.id} className={`p-4 rounded-xl bg-gray-900 border shadow-lg transition-all ${
                  isPostulated ? 'border-emerald-500/50 shadow-emerald-500/5' : 'border-indigo-500/30 shadow-indigo-500/5'
                }`}>
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-600 text-white uppercase">{c.codigo}</span>
                    <span className="text-[10px] font-bold text-emerald-400">{Math.round(c.compatibility)}% Match</span>
                  </div>
                  <h3 className="text-sm font-bold text-white mb-3 line-clamp-1">{c.nombre}</h3>
                  
                  {isPostulated ? (
                    <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold py-2">
                      <CheckCircle2 className="h-4 w-4" /> Ya postulado
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-[10px] text-gray-500 uppercase font-bold">Prioridad:</span>
                        <select 
                          className="bg-gray-800 border border-gray-700 rounded px-2 py-0.5 text-[10px] text-white"
                          value={postulatePriority}
                          onChange={(e) => setPostulatePriority(Number(e.target.value))}
                        >
                          {[1, 2, 3, 4, 5].map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                      </div>

                      <button 
                        onClick={() => postulateCourseMutation.mutate({ cursoId: c.id, prioridad: postulatePriority })}
                        disabled={postulateCourseMutation.isPending}
                        className="w-full py-2 rounded-lg bg-indigo-600/10 text-indigo-400 text-xs font-bold border border-indigo-500/20 hover:bg-indigo-600 hover:text-white transition-all"
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
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
          <input type="text" placeholder="Buscar por nombre o código..." value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-gray-700 bg-gray-900 py-2.5 pl-10 pr-4 text-sm text-gray-200 placeholder-gray-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
        </div>
        <select value={filterCiclo ?? ''} onChange={(e) => setFilterCiclo(e.target.value ? Number(e.target.value) : undefined)}
          className="rounded-lg border border-gray-700 bg-gray-900 px-3 py-2.5 text-sm text-gray-200 focus:border-indigo-500 focus:outline-none">
          <option value="">Todos los ciclos</option>
          {ciclos.map((c) => <option key={c} value={c}>Ciclo {c}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-gray-800 bg-gray-900 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800 bg-gray-900/50">
              <th className="px-4 py-3 text-left font-medium text-gray-400">Código</th>
              <th className="px-4 py-3 text-left font-medium text-gray-400">Nombre</th>
              <th className="px-4 py-3 text-center font-medium text-gray-400">Ciclo</th>
              <th className="px-4 py-3 text-center font-medium text-gray-400">Créditos</th>
              <th className="px-4 py-3 text-center font-medium text-gray-400">H. Teoría</th>
              <th className="px-4 py-3 text-center font-medium text-gray-400">H. Lab</th>
              <th className="px-4 py-3 text-center font-medium text-gray-400">Grupos</th>
              {canManage && <th className="px-4 py-3 text-center font-medium text-gray-400">Apertura</th>}
              <th className="px-4 py-3 text-right font-medium text-gray-400">Acciones</th>
            </tr>
          </thead>
          <tbody>
              {isLoading ? (
                <tr><td colSpan={canManage ? 9 : 8} className="px-4 py-12 text-center text-gray-600">Cargando...</td></tr>
              ) : cursos.length === 0 ? (
                <tr><td colSpan={canManage ? 9 : 8} className="px-4 py-12 text-center text-gray-600">No se encontraron cursos</td></tr>
              ) : (
              cursos.map((c) => (
                <tr key={c.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                  <td className="px-4 py-3 font-mono text-xs text-indigo-400">{c.codigo}</td>
                  <td className="px-4 py-3 font-medium text-gray-200">{c.nombre}</td>
                  <td className="px-4 py-3 text-center">
                    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-indigo-500/20 text-xs font-bold text-indigo-400">{c.ciclo}</span>
                  </td>
                  <td className="px-4 py-3 text-center text-gray-400">{c.creditos}</td>
                  <td className="px-4 py-3 text-center text-gray-400">{c.horasTeoria}h</td>
                  <td className="px-4 py-3 text-center text-gray-400">{c.horasLaboratorio}h</td>
                  <td className="px-4 py-3 text-center text-gray-400">{c.grupos.length}</td>
                  {canManage && (
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => toggleAperturaMutation.mutate({ id: c.id, aperturado: !c.aperturado })}
                        className={`px-2 py-1 rounded text-[10px] font-bold uppercase transition-all ${
                          c.aperturado 
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
                            : 'bg-gray-800 text-gray-500 border border-gray-700'
                        }`}
                      >
                        {c.aperturado ? 'Aperturado' : 'Cerrado'}
                      </button>
                    </td>
                  )}
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {canManage ? (
                        <>
                          <button onClick={() => openEdit(c)} className="rounded-md p-1.5 text-gray-500 hover:bg-gray-700 hover:text-gray-300"><Pencil className="h-3.5 w-3.5" /></button>
                          <button onClick={() => deleteMutation.mutate({ id: c.id })} className="rounded-md p-1.5 text-gray-500 hover:bg-red-900/30 hover:text-red-400"><Trash2 className="h-3.5 w-3.5" /></button>
                        </>
                      ) : isDocente ? (
                        <button 
                          onClick={() => { setSelectedCurso(c); setShowAssignModal(true); }}
                          className="px-3 py-1 rounded-md bg-indigo-600/20 text-indigo-400 text-xs font-semibold hover:bg-indigo-600/30"
                        >
                          Inscribirse
                        </button>
                      ) : (
                        <span className="text-[10px] text-gray-600 font-medium">Solo lectura</span>
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
            <div key={dg.id} className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden shadow-xl hover:border-indigo-500/50 transition-all group">
              <div className="p-5">
                <div className="flex justify-between items-start mb-4">
                  <span className="text-[10px] font-bold px-2 py-1 rounded bg-indigo-600/20 text-indigo-400 uppercase border border-indigo-500/20">
                    {dg.grupo.curso.codigo}
                  </span>
                  <span className="text-[10px] font-bold px-2 py-1 rounded bg-emerald-600/20 text-emerald-400 uppercase border border-emerald-500/20">
                    Grupo {dg.grupo.nombre}
                  </span>
                </div>
                
                <h3 className="text-lg font-bold text-white mb-2 group-hover:text-indigo-400 transition-colors">
                  {dg.grupo.curso.nombre}
                </h3>
                
                <div className="grid grid-cols-2 gap-4 py-4 border-y border-gray-800/50 my-4">
                  <div>
                    <p className="text-[10px] text-gray-500 uppercase font-bold mb-1">Carga Horaria</p>
                    <p className="text-sm text-gray-200 font-semibold">
                      {dg.grupo.curso.horasTeoria + dg.grupo.curso.horasLaboratorio} horas/sem
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-500 uppercase font-bold mb-1">Ciclo</p>
                    <p className="text-sm text-gray-200 font-semibold">Ciclo {dg.grupo.curso.ciclo}</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-500 font-medium">Estado Asignación</span>
                    <span className="text-emerald-400 font-bold">Asignado</span>
                  </div>
                  
                  {dg.grupo.asignaciones && dg.grupo.asignaciones.length > 0 ? (
                    <div className="p-3 rounded-lg bg-gray-800/50 border border-gray-700/50">
                      <p className="text-[10px] text-gray-500 uppercase font-bold mb-2">Horario Seleccionado</p>
                      <div className="space-y-1.5">
                        {dg.grupo.asignaciones.map((a: any) => (
                          <div key={a.id} className="flex items-center gap-2 text-[11px] text-gray-300">
                            <div className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
                            <span className="font-bold">{a.franjaHoraria.dia}:</span>
                            <span>{a.franjaHoraria.horaInicio} - {a.franjaHoraria.horaFin}</span>
                            <span className="text-gray-500">({a.aula.codigo})</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="p-3 rounded-lg bg-amber-500/5 border border-amber-500/20 text-center">
                      <p className="text-[11px] text-amber-400 font-bold">Pendiente de seleccionar horario</p>
                    </div>
                  )}
                </div>
              </div>
              
              <div className="p-4 bg-gray-800/30 border-t border-gray-800 flex justify-between items-center">
                <div className="flex flex-col">
                  <span className="text-[9px] text-gray-500 uppercase font-bold">Sede/Edificio</span>
                  <span className="text-xs text-gray-300">Facultad de Ingeniería</span>
                </div>
                <button className="text-xs font-bold text-indigo-400 hover:text-indigo-300">Ver detalles &rarr;</button>
              </div>
            </div>
          ))}
          
          {(personalDocente?.docente?.docenteGrupos || []).length === 0 && (
            <div className="col-span-full py-20 text-center">
              <div className="inline-flex p-4 rounded-full bg-gray-800 mb-4">
                <BookOpen className="h-8 w-8 text-gray-600" />
              </div>
              <h3 className="text-lg font-bold text-white">No tienes cursos asignados</h3>
              <p className="text-sm text-gray-500 mt-1 max-w-xs mx-auto">
                Una vez que se procesen las postulaciones, tus cursos aparecerán en esta sección.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Modal de Inscripción para Docentes */}
      {showAssignModal && selectedCurso && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-gray-700 bg-gray-900 p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-lg font-semibold text-white">Inscripción al Curso</h2>
                <p className="text-xs text-gray-500">{selectedCurso.nombre} ({selectedCurso.codigo})</p>
              </div>
              <button onClick={() => setShowAssignModal(false)} className="rounded-lg p-1 text-gray-500 hover:bg-gray-800"><X className="h-5 w-5" /></button>
            </div>
            
            <div className="space-y-4">
              <p className="text-sm text-gray-400">Selecciona el grupo al que deseas inscribirte:</p>
              <div className="grid gap-3">
                {selectedCurso.grupos.map((g: any) => (
                  <div key={g.id} className="flex items-center justify-between p-4 rounded-xl bg-gray-800 border border-gray-700">
                    <div>
                      <p className="font-medium text-white">Grupo {g.nombre}</p>
                      <p className="text-xs text-gray-500">Periodo: {g.periodoAcademico.nombre}</p>
                    </div>
                    <button
                      onClick={() => postulateMutation.mutate({ grupoId: g.id })}
                      disabled={postulateMutation.isPending}
                      className="px-4 py-2 rounded-lg bg-indigo-600 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
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

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-gray-700 bg-gray-900 p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-white">{editId ? 'Editar Curso' : 'Nuevo Curso'}</h2>
              <button onClick={closeModal} className="rounded-lg p-1 text-gray-500 hover:bg-gray-800"><X className="h-5 w-5" /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">Código</label>
                  <input type="text" required value={form.codigo} onChange={(e) => setForm({ ...form, codigo: e.target.value })}
                    className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-200 focus:border-indigo-500 focus:outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">Ciclo</label>
                  <input type="number" required min={1} max={12} value={form.ciclo} onChange={(e) => setForm({ ...form, ciclo: Number(e.target.value) })}
                    className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-200 focus:border-indigo-500 focus:outline-none" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Nombre</label>
                <input type="text" required value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                  className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-200 focus:border-indigo-500 focus:outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">Grado Requerido</label>
                  <input type="text" value={form.gradoRequerido} onChange={(e) => setForm({ ...form, gradoRequerido: e.target.value })}
                    className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-200 focus:border-indigo-500 focus:outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">Especialidad</label>
                  <input type="text" value={form.especialidadRequerida} onChange={(e) => setForm({ ...form, especialidadRequerida: e.target.value })}
                    className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-200 focus:border-indigo-500 focus:outline-none" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Exp. Mínima (años)</label>
                <input type="number" value={form.experienciaMinima} onChange={(e) => setForm({ ...form, experienciaMinima: parseInt(e.target.value) || 0 })}
                  className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-200 focus:border-indigo-500 focus:outline-none" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Perfil Requerido (Keywords)</label>
                <textarea value={form.perfilRequerido} onChange={(e) => setForm({ ...form, perfilRequerido: e.target.value })}
                  placeholder="Ej: software bases de datos sql postgres"
                  className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-200 focus:border-indigo-500 focus:outline-none h-20" />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">Créditos</label>
                  <input type="number" required min={1} max={10} value={form.creditos} onChange={(e) => setForm({ ...form, creditos: Number(e.target.value) })}
                    className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-200 focus:border-indigo-500 focus:outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">H. Teoría</label>
                  <input type="number" required min={0} value={form.horasTeoria} onChange={(e) => setForm({ ...form, horasTeoria: Number(e.target.value) })}
                    className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-200 focus:border-indigo-500 focus:outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">H. Lab</label>
                  <input type="number" required min={0} value={form.horasLaboratorio} onChange={(e) => setForm({ ...form, horasLaboratorio: Number(e.target.value) })}
                    className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-200 focus:border-indigo-500 focus:outline-none" />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-300">
                <input type="checkbox" checked={form.requiereLaboratorio} onChange={(e) => setForm({ ...form, requiereLaboratorio: e.target.checked })}
                  className="rounded border-gray-600 bg-gray-800 text-indigo-500" />
                Requiere laboratorio
              </label>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={closeModal} className="rounded-lg border border-gray-700 px-4 py-2 text-sm text-gray-400 hover:bg-gray-800">Cancelar</button>
                <button type="submit" className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
                  disabled={createMutation.isPending || updateMutation.isPending}>
                  {editId ? 'Guardar' : 'Crear'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
