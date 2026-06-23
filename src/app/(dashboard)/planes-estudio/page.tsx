'use client';

import { useTRPC } from '@/trpc/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import {
  Plus,
  Pencil,
  Trash2,
  Search,
  X,
  GraduationCap,
  ChevronDown,
  ChevronRight,
  BookOpen,
  Link2,
  Link2Off,
} from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────────────

type CurriculaFormData = {
  codigo: string;
  anio: number;
  escuelaId: string;
  vigente: boolean;
};

type LinkCourseFormData = {
  cursoId: string;
  ciclo: number;
  esElectivo: boolean;
};

const emptyCurriculaForm: CurriculaFormData = {
  codigo: '',
  anio: new Date().getFullYear(),
  escuelaId: '',
  vigente: true,
};

const emptyLinkForm: LinkCourseFormData = {
  cursoId: '',
  ciclo: 1,
  esElectivo: false,
};

// ── Helpers ────────────────────────────────────────────────────────────────────

const canWrite = (role?: string) =>
  role === 'ADMIN' || role === 'SECRETARIA_DEPARTAMENTO' || role === 'SECRETARIA_ACADEMICA' || role === 'DIRECTOR_ESCUELA';

// ── Page Component ─────────────────────────────────────────────────────────────

export default function PlanesEstudioPage() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  // ── auth ──
  const { data: user } = useQuery({ ...trpc.auth.me.queryOptions() });
  const userCanWrite = canWrite(user?.role);

  // ── curricula state ──
  const [showCurriculaModal, setShowCurriculaModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [curriculaForm, setCurriculaForm] = useState<CurriculaFormData>(emptyCurriculaForm);
  const [search, setSearch] = useState('');
  const [filterEscuelaId, setFilterEscuelaId] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // ── link course state ──
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [linkTargetCurriculaId, setLinkTargetCurriculaId] = useState('');
  const [linkForm, setLinkForm] = useState<LinkCourseFormData>(emptyLinkForm);
  const [courseSearch, setCourseSearch] = useState('');

  // ── queries ──
  const { data: escuelas = [] } = useQuery({ ...trpc.escuela.list.queryOptions() });

  const { data: curriculas = [], isLoading } = useQuery({
    ...trpc.curricula.list.queryOptions(
      filterEscuelaId ? { escuelaId: filterEscuelaId } : undefined
    ),
  });

  const { data: allCursos = [] } = useQuery({
    ...trpc.curso.list.queryOptions({ vista: 'CATALOGO' }),
    enabled: showLinkModal,
  });

  // ── filtered data ──
  const filteredCurriculas = curriculas.filter((c) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      c.codigo.toLowerCase().includes(q) ||
      String(c.anio).includes(q) ||
      c.escuela.nombre.toLowerCase().includes(q)
    );
  });

  const filteredCourses = allCursos.filter((c) => {
    if (!courseSearch) return true;
    const q = courseSearch.toLowerCase();
    return c.nombre.toLowerCase().includes(q) || c.codigo.toLowerCase().includes(q);
  });

  // ── mutations ──
  const createMutation = useMutation(
    trpc.curricula.create.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: trpc.curricula.list.queryKey() });
        closeCurriculaModal();
      },
      onError: (err) => alert(err.message),
    })
  );

  const updateMutation = useMutation(
    trpc.curricula.update.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: trpc.curricula.list.queryKey() });
        closeCurriculaModal();
      },
      onError: (err) => alert(err.message),
    })
  );

  const deleteMutation = useMutation(
    trpc.curricula.delete.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: trpc.curricula.list.queryKey() });
      },
      onError: (err) => alert(err.message),
    })
  );

  const linkCourseMutation = useMutation(
    trpc.curricula.linkCourse.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: trpc.curricula.list.queryKey() });
        closeLinkModal();
      },
      onError: (err) => alert(err.message),
    })
  );

  const unlinkCourseMutation = useMutation(
    trpc.curricula.unlinkCourse.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: trpc.curricula.list.queryKey() });
      },
      onError: (err) => alert(err.message),
    })
  );

  // ── handlers ──
  function closeCurriculaModal() {
    setShowCurriculaModal(false);
    setEditId(null);
    setCurriculaForm(emptyCurriculaForm);
  }

  function closeLinkModal() {
    setShowLinkModal(false);
    setLinkTargetCurriculaId('');
    setLinkForm(emptyLinkForm);
    setCourseSearch('');
  }

  function openEdit(c: (typeof curriculas)[0]) {
    setEditId(c.id);
    setCurriculaForm({
      codigo: c.codigo,
      anio: c.anio,
      escuelaId: c.escuelaId,
      vigente: c.vigente,
    });
    setShowCurriculaModal(true);
  }

  function openLinkModal(curriculaId: string) {
    setLinkTargetCurriculaId(curriculaId);
    setLinkForm(emptyLinkForm);
    setCourseSearch('');
    setShowLinkModal(true);
  }

  function handleCurriculaSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (editId) {
      updateMutation.mutate({ id: editId, ...curriculaForm });
    } else {
      createMutation.mutate(curriculaForm);
    }
  }

  function handleLinkSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!linkForm.cursoId) {
      alert('Por favor, selecciona un curso para vincular.');
      return;
    }
    linkCourseMutation.mutate({
      curriculaId: linkTargetCurriculaId,
      cursoId: linkForm.cursoId,
      ciclo: linkForm.ciclo,
      esElectivo: linkForm.esElectivo,
    });
  }

  function handleDelete(id: string) {
    if (!confirm('¿Estás seguro de que deseas eliminar este plan de estudio? Esta acción no se puede deshacer.')) return;
    deleteMutation.mutate({ id });
  }

  function handleUnlink(curriculaId: string, cursoId: string) {
    if (!confirm('¿Deseas desvincular este curso del plan de estudio?')) return;
    unlinkCourseMutation.mutate({ curriculaId, cursoId });
  }

  // ── render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-main">Planes de Estudio</h1>
          <p className="text-sm text-text-sub mt-1">
            Gestiona los planes de estudio y sus asignaciones de cursos
          </p>
        </div>
        {userCanWrite && (
          <button
            onClick={() => { setEditId(null); setCurriculaForm(emptyCurriculaForm); setShowCurriculaModal(true); }}
            className="btn-primary"
          >
            <Plus className="h-4 w-4" /> + Nuevo Plan
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-text-sub" />
          <input
            type="text"
            placeholder="Buscar por código, año o escuela..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-standard pl-12"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-text-sub hover:text-text-main transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <select
          value={filterEscuelaId}
          onChange={(e) => setFilterEscuelaId(e.target.value)}
          className="rounded-lg border border-border bg-white px-3 py-2.5 text-sm text-text-main focus:border-primary focus:ring-1 focus:ring-primary outline-none"
        >
          <option value="">Todas las escuelas</option>
          {escuelas.map((e) => (
            <option key={e.id} value={e.id}>{e.nombre}</option>
          ))}
        </select>
      </div>

      {/* Curricula list */}
      <div className="space-y-3">
        {isLoading ? (
          <div className="table-standard">
            <div className="px-6 py-12 text-center text-text-sub">Cargando planes de estudio...</div>
          </div>
        ) : filteredCurriculas.length === 0 ? (
          <div className="table-standard">
            <div className="px-6 py-12 text-center text-text-sub">
              No se encontraron planes de estudio
            </div>
          </div>
        ) : (
          filteredCurriculas.map((curricula) => {
            const isExpanded = expandedId === curricula.id;
            const linkedCourses = curricula.cursos ?? [];

            return (
              <div key={curricula.id} className="table-standard overflow-hidden">
                {/* Curricula row */}
                <div
                  onClick={() => setExpandedId(isExpanded ? null : curricula.id)}
                  className="flex items-center justify-between px-6 py-4 hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    {/* Expand toggle */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setExpandedId(isExpanded ? null : curricula.id);
                      }}
                      className="p-1 rounded-lg text-text-sub hover:bg-slate-100 hover:text-text-main transition-all shrink-0"
                      title={isExpanded ? 'Colapsar' : 'Expandir cursos'}
                    >
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </button>

                    {/* Icon */}
                    <div className="p-2 rounded-lg bg-primary/10 shrink-0">
                      <GraduationCap className="h-4 w-4 text-primary" />
                    </div>

                    {/* Info */}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-bold text-text-main">{curricula.codigo}</p>
                        <span className="badge badge-gray">Año {curricula.anio}</span>
                        {curricula.vigente ? (
                          <span className="badge badge-success">Vigente</span>
                        ) : (
                          <span className="badge badge-gray text-slate-400">No vigente</span>
                        )}
                      </div>
                      <p className="text-xs text-text-sub font-medium truncate mt-0.5">
                        {curricula.escuela.nombre}
                        <span className="mx-2 text-border">•</span>
                        {linkedCourses.length} {linkedCourses.length === 1 ? 'curso vinculado' : 'cursos vinculados'}
                      </p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                    {userCanWrite && (
                      <>
                        <button
                          onClick={() => openLinkModal(curricula.id)}
                          className="p-2 rounded-lg text-text-sub hover:bg-primary-light hover:text-primary transition-all"
                          title="Vincular curso"
                        >
                          <Link2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => openEdit(curricula)}
                          className="p-2 rounded-lg text-text-sub hover:bg-primary-light hover:text-primary transition-all"
                          title="Editar plan de estudio"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(curricula.id)}
                          disabled={deleteMutation.isPending}
                          className="p-2 rounded-lg text-text-sub hover:bg-red-50 hover:text-danger transition-all"
                          title="Eliminar plan de estudio"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Expanded: linked courses */}
                {isExpanded && (
                  <div className="border-t border-border bg-slate-50/60">
                    {linkedCourses.length === 0 ? (
                      <div className="px-8 py-6 text-center text-text-sub text-sm">
                        Aún no hay cursos vinculados.
                        {userCanWrite && (
                          <button
                            onClick={() => openLinkModal(curricula.id)}
                            className="ml-2 text-primary font-bold hover:underline"
                          >
                            Vincular un curso
                          </button>
                        )}
                      </div>
                    ) : (() => {
                      const groupedByCiclo = linkedCourses.reduce((acc, cc) => {
                        const ciclo = cc.ciclo;
                        if (!acc[ciclo]) acc[ciclo] = [];
                        acc[ciclo].push(cc);
                        return acc;
                      }, {} as Record<number, typeof linkedCourses>);

                      const sortedCiclos = Object.keys(groupedByCiclo)
                        .map(Number)
                        .sort((a, b) => a - b);

                      return (
                        <div className="px-6 py-4 space-y-6">
                          <p className="text-xs font-bold uppercase tracking-widest text-text-sub">
                            Estructura del Plan de Estudios
                          </p>
                          
                          {sortedCiclos.map((ciclo) => {
                            const coursesInCiclo = groupedByCiclo[ciclo];
                            const totalCreditos = coursesInCiclo.reduce((sum, cc) => sum + cc.curso.creditos, 0);
                            
                            return (
                              <div key={ciclo} className="border border-border rounded-xl bg-white overflow-hidden shadow-sm">
                                <div className="bg-slate-50 border-b border-border px-4 py-2.5 flex justify-between items-center">
                                  <span className="text-xs font-bold text-text-main uppercase tracking-wider">
                                    Ciclo {ciclo}
                                  </span>
                                  <span className="text-xs font-semibold text-text-sub">
                                    Suma de créditos: <strong className="text-primary">{totalCreditos}</strong>
                                  </span>
                                </div>
                                
                                <div className="overflow-x-auto">
                                  <table className="w-full text-left text-xs border-collapse">
                                    <thead>
                                      <tr className="border-b border-border bg-slate-50/50 text-[10px] font-bold uppercase tracking-wider text-text-sub">
                                        <th className="px-4 py-2 w-20">#</th>
                                        <th className="px-4 py-2 w-16 text-center">Tipo</th>
                                        <th className="px-4 py-2">Curso</th>
                                        <th className="px-3 py-2 text-center w-10">T</th>
                                        <th className="px-3 py-2 text-center w-10">P</th>
                                        <th className="px-3 py-2 text-center w-10">L</th>
                                        <th className="px-3 py-2 text-center w-10">C</th>
                                        <th className="px-4 py-2">Departamento Responsable</th>
                                        {userCanWrite && <th className="px-4 py-2 text-right w-16">Acción</th>}
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {coursesInCiclo.map((cc) => (
                                        <tr 
                                          key={cc.curso.id} 
                                          className="border-b border-border/60 hover:bg-slate-50/50 transition-colors group"
                                        >
                                          <td className="px-4 py-2.5 font-mono text-[11px] text-text-sub">
                                            {cc.curso.codigo}
                                          </td>
                                          <td className="px-4 py-2.5 text-center">
                                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                              cc.curso.condicion === 'OB' || cc.curso.condicion === 'S' || cc.curso.condicion === 'O'
                                                ? 'bg-blue-50 text-blue-600 border border-blue-100'
                                                : 'bg-amber-50 text-amber-600 border border-amber-100'
                                            }`}>
                                              {cc.curso.condicion ?? (cc.esElectivo ? 'EL' : 'OB')}
                                            </span>
                                          </td>
                                          <td className="px-4 py-2.5 font-medium text-text-main">
                                            <div>
                                              {cc.curso.nombre}
                                              {cc.curso.requisitos && (
                                                <p className="text-[10px] text-slate-400 font-normal mt-0.5 italic">
                                                  * Requisito: {cc.curso.requisitos}
                                                </p>
                                              )}
                                            </div>
                                          </td>
                                          <td className="px-3 py-2.5 text-center font-medium text-slate-600">{cc.curso.horasTeoria}</td>
                                          <td className="px-3 py-2.5 text-center font-medium text-slate-600">{cc.curso.horasPractica}</td>
                                          <td className="px-3 py-2.5 text-center font-medium text-slate-600">{cc.curso.horasLaboratorio}</td>
                                          <td className="px-3 py-2.5 text-center font-bold text-primary">{cc.curso.creditos}</td>
                                          <td className="px-4 py-2.5 text-text-sub font-medium">
                                            {cc.curso.departamento ?? '—'}
                                          </td>
                                          {userCanWrite && (
                                            <td className="px-4 py-2.5 text-right">
                                              <button
                                                onClick={() => handleUnlink(curricula.id, cc.curso.id)}
                                                disabled={unlinkCourseMutation.isPending}
                                                className="p-1.5 rounded-lg text-text-sub hover:bg-red-50 hover:text-danger transition-all opacity-0 group-hover:opacity-100"
                                                title="Desvincular curso del plan de estudio"
                                              >
                                                <Trash2 className="h-3.5 w-3.5" />
                                              </button>
                                            </td>
                                          )}
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* ── Create / Edit Curricula Modal ──────────────────────────────────── */}
      {showCurriculaModal && (
        <div className="modal-overlay">
          <div className="modal-content max-w-lg">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-text-main">
                {editId ? 'Editar Plan de Estudio' : 'Nuevo Plan de Estudio'}
              </h2>
              <button
                onClick={closeCurriculaModal}
                className="rounded-lg p-1 text-text-sub hover:bg-slate-100 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCurriculaSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label-standard">Código</label>
                  <input
                    type="text"
                    required
                    placeholder="ej. PE-2018"
                    value={curriculaForm.codigo}
                    onChange={(e) => setCurriculaForm({ ...curriculaForm, codigo: e.target.value })}
                    className="input-standard"
                  />
                </div>
                <div>
                  <label className="label-standard">Año Académico</label>
                  <input
                    type="number"
                    required
                    min={1900}
                    max={2100}
                    value={curriculaForm.anio}
                    onChange={(e) => setCurriculaForm({ ...curriculaForm, anio: Number(e.target.value) })}
                    className="input-standard"
                  />
                </div>
              </div>

              <div>
                <label className="label-standard">Escuela</label>
                <select
                  required
                  value={curriculaForm.escuelaId}
                  onChange={(e) => setCurriculaForm({ ...curriculaForm, escuelaId: e.target.value })}
                  className="input-standard"
                >
                  <option value="">Seleccionar una escuela…</option>
                  {escuelas.map((e) => (
                    <option key={e.id} value={e.id}>{e.nombre}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="vigente"
                  checked={curriculaForm.vigente}
                  onChange={(e) => setCurriculaForm({ ...curriculaForm, vigente: e.target.checked })}
                  className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                />
                <label htmlFor="vigente" className="text-sm font-medium text-text-main cursor-pointer">
                  Vigente
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-border">
                <button type="button" onClick={closeCurriculaModal} className="btn-secondary">
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="btn-primary"
                >
                  {createMutation.isPending || updateMutation.isPending
                    ? 'Guardando...'
                    : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Link Course Modal ──────────────────────────────────────────────── */}
      {showLinkModal && (
        <div className="modal-overlay">
          <div className="modal-content max-w-xl">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-lg font-bold text-text-main">Vincular Curso al Plan</h2>
                <p className="text-xs text-text-sub font-medium">
                  {curriculas.find((c) => c.id === linkTargetCurriculaId)?.codigo}
                </p>
              </div>
              <button
                onClick={closeLinkModal}
                className="rounded-lg p-1 text-text-sub hover:bg-slate-100 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleLinkSubmit} className="space-y-4">
              {/* Course search + select */}
              <div>
                <label className="label-standard">Curso</label>
                <div className="relative mb-2">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-sub" />
                  <input
                    type="text"
                    placeholder="Buscar cursos..."
                    value={courseSearch}
                    onChange={(e) => setCourseSearch(e.target.value)}
                    className="input-standard pl-10"
                  />
                </div>
                <select
                  required
                  value={linkForm.cursoId}
                  onChange={(e) => setLinkForm({ ...linkForm, cursoId: e.target.value })}
                  className="input-standard"
                  size={5}
                >
                  <option value="" disabled>— seleccionar un curso —</option>
                  {filteredCourses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.codigo} — {c.nombre}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label-standard">Ciclo</label>
                  <select
                    value={linkForm.ciclo}
                    onChange={(e) => setLinkForm({ ...linkForm, ciclo: Number(e.target.value) })}
                    className="input-standard"
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((n) => (
                      <option key={n} value={n}>Ciclo {n}</option>
                    ))}
                  </select>
                </div>
                <div className="flex items-end pb-2.5">
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      id="esElectivo"
                      checked={linkForm.esElectivo}
                      onChange={(e) => setLinkForm({ ...linkForm, esElectivo: e.target.checked })}
                      className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                    />
                    <label htmlFor="esElectivo" className="text-sm font-medium text-text-main cursor-pointer">
                      Curso electivo
                    </label>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-border">
                <button type="button" onClick={closeLinkModal} className="btn-secondary">
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={linkCourseMutation.isPending || !linkForm.cursoId}
                  className="btn-primary"
                >
                  {linkCourseMutation.isPending ? 'Vinculando...' : 'Vincular'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
