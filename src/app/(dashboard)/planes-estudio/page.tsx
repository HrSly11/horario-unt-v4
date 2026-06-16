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
  role === 'ADMIN' || role === 'SECRETARIA_DEPARTAMENTO';

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
      alert('Please select a course to link.');
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
    if (!confirm('¿Are you sure you want to delete this curriculum? This action cannot be undone.')) return;
    deleteMutation.mutate({ id });
  }

  function handleUnlink(curriculaId: string, cursoId: string) {
    if (!confirm('¿Remove this course from the curriculum?')) return;
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
            Manage academic curricula and their course assignments
          </p>
        </div>
        {userCanWrite && (
          <button
            onClick={() => { setEditId(null); setCurriculaForm(emptyCurriculaForm); setShowCurriculaModal(true); }}
            className="btn-primary"
          >
            <Plus className="h-4 w-4" /> New Curriculum
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-text-sub" />
          <input
            type="text"
            placeholder="Search by code, year or school..."
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
          <option value="">All schools</option>
          {escuelas.map((e) => (
            <option key={e.id} value={e.id}>{e.nombre}</option>
          ))}
        </select>
      </div>

      {/* Curricula list */}
      <div className="space-y-3">
        {isLoading ? (
          <div className="table-standard">
            <div className="px-6 py-12 text-center text-text-sub">Loading curricula...</div>
          </div>
        ) : filteredCurriculas.length === 0 ? (
          <div className="table-standard">
            <div className="px-6 py-12 text-center text-text-sub">
              No curricula found
            </div>
          </div>
        ) : (
          filteredCurriculas.map((curricula) => {
            const isExpanded = expandedId === curricula.id;
            const linkedCourses = curricula.cursos ?? [];

            return (
              <div key={curricula.id} className="table-standard overflow-hidden">
                {/* Curricula row */}
                <div className="flex items-center justify-between px-6 py-4 hover:bg-slate-50 transition-colors">
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    {/* Expand toggle */}
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : curricula.id)}
                      className="p-1 rounded-lg text-text-sub hover:bg-slate-100 hover:text-text-main transition-all shrink-0"
                      title={isExpanded ? 'Collapse' : 'Expand courses'}
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
                        <span className="badge badge-gray">Year {curricula.anio}</span>
                        {curricula.vigente ? (
                          <span className="badge badge-success">Active</span>
                        ) : (
                          <span className="badge badge-gray text-slate-400">Inactive</span>
                        )}
                      </div>
                      <p className="text-xs text-text-sub font-medium truncate mt-0.5">
                        {curricula.escuela.nombre}
                        <span className="mx-2 text-border">•</span>
                        {linkedCourses.length} course{linkedCourses.length !== 1 ? 's' : ''} linked
                      </p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    {userCanWrite && (
                      <>
                        <button
                          onClick={() => openLinkModal(curricula.id)}
                          className="p-2 rounded-lg text-text-sub hover:bg-primary-light hover:text-primary transition-all"
                          title="Link course"
                        >
                          <Link2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => openEdit(curricula)}
                          className="p-2 rounded-lg text-text-sub hover:bg-primary-light hover:text-primary transition-all"
                          title="Edit curriculum"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(curricula.id)}
                          disabled={deleteMutation.isPending}
                          className="p-2 rounded-lg text-text-sub hover:bg-red-50 hover:text-danger transition-all"
                          title="Delete curriculum"
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
                        No courses linked yet.
                        {userCanWrite && (
                          <button
                            onClick={() => openLinkModal(curricula.id)}
                            className="ml-2 text-primary font-bold hover:underline"
                          >
                            Link a course
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="px-6 py-3">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-text-sub mb-3">
                          Linked Courses
                        </p>
                        <div className="grid gap-2">
                          {linkedCourses.map((cc) => (
                            <div
                              key={cc.curso.id}
                              className="flex items-center justify-between p-3 rounded-xl bg-white border border-border hover:border-primary/30 transition-all group"
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <div className="p-1.5 rounded-lg bg-primary/5 shrink-0">
                                  <BookOpen className="h-3.5 w-3.5 text-primary" />
                                </div>
                                <div className="min-w-0">
                                  <p className="text-sm font-bold text-text-main truncate">
                                    {cc.curso.nombre}
                                  </p>
                                  <p className="text-[10px] text-text-sub font-bold uppercase tracking-wider">
                                    {cc.curso.codigo}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <span className="badge badge-info">Ciclo {cc.ciclo}</span>
                                {cc.esElectivo && (
                                  <span className="badge badge-warning">Elective</span>
                                )}
                                <span className="text-xs text-text-sub font-medium">
                                  {cc.curso.creditos} cr.
                                </span>
                                {userCanWrite && (
                                  <button
                                    onClick={() => handleUnlink(curricula.id, cc.curso.id)}
                                    disabled={unlinkCourseMutation.isPending}
                                    className="p-1.5 rounded-lg text-text-sub hover:bg-red-50 hover:text-danger transition-all opacity-0 group-hover:opacity-100"
                                    title="Remove course from curriculum"
                                  >
                                    <Link2Off className="h-3.5 w-3.5" />
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
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
                {editId ? 'Edit Curriculum' : 'New Curriculum'}
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
                  <label className="label-standard">Code</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. PE-2018"
                    value={curriculaForm.codigo}
                    onChange={(e) => setCurriculaForm({ ...curriculaForm, codigo: e.target.value })}
                    className="input-standard"
                  />
                </div>
                <div>
                  <label className="label-standard">Academic Year</label>
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
                <label className="label-standard">School</label>
                <select
                  required
                  value={curriculaForm.escuelaId}
                  onChange={(e) => setCurriculaForm({ ...curriculaForm, escuelaId: e.target.value })}
                  className="input-standard"
                >
                  <option value="">Select a school…</option>
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
                  Active (vigente)
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-border">
                <button type="button" onClick={closeCurriculaModal} className="btn-secondary">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="btn-primary"
                >
                  {createMutation.isPending || updateMutation.isPending
                    ? 'Saving...'
                    : editId
                    ? 'Update'
                    : 'Create'}
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
                <h2 className="text-lg font-bold text-text-main">Link Course to Curriculum</h2>
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
                <label className="label-standard">Course</label>
                <div className="relative mb-2">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-sub" />
                  <input
                    type="text"
                    placeholder="Search courses..."
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
                  <option value="" disabled>— select a course —</option>
                  {filteredCourses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.codigo} — {c.nombre}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label-standard">Semester (Ciclo)</label>
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
                      Elective course
                    </label>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-border">
                <button type="button" onClick={closeLinkModal} className="btn-secondary">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={linkCourseMutation.isPending || !linkForm.cursoId}
                  className="btn-primary"
                >
                  {linkCourseMutation.isPending ? 'Linking...' : 'Link Course'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
