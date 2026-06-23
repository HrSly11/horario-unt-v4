'use client';

import { useState, useMemo } from 'react';
import { useTRPC } from '@/trpc/client';
import { useQuery } from '@tanstack/react-query';
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
} from 'lucide-react';

export default function DemandaDepartamentoPage() {
  const trpc = useTRPC();

  const [selectedPeriodoId, setSelectedPeriodoId] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const { data: user } = useQuery({ ...trpc.auth.me.queryOptions() });
  const { data: periodos = [] } = useQuery({ ...trpc.periodo.list.queryOptions() });

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
      </div>

      {/* ── Error ──────────────────────────────────────────────────────────── */}
      {error && (
        <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-xl">
          <AlertCircle className="w-5 h-5 text-danger shrink-0" />
          <span className="text-sm font-medium text-danger">Error al cargar: {error.message}</span>
        </div>
      )}

      {/* ── Info banner: what this step means ──────────────────────────────── */}
      <div className="flex items-start gap-3 p-4 bg-primary/5 border border-primary/20 rounded-xl">
        <Info className="w-5 h-5 text-primary shrink-0 mt-0.5" />
        <div className="text-sm text-text-sub">
          <span className="font-bold text-text-main">Paso 2 del flujo: </span>
          Aqui se visualizan los cursos cuya demanda fue{' '}
          <span className="font-bold text-success">aprobada</span> por el Director de Escuela.
          El Jefe de Departamento y la Secretaria de Departamento los usan para proceder
          con la asignacion de carga lectiva (Paso 3).
        </div>
      </div>

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
            {!searchTerm && (
              <div className="flex items-center gap-2 mt-2 text-xs text-text-sub font-medium">
                <ChevronRight className="w-4 h-4 text-primary" />
                <span>Flujo: Secretaria crea demanda <ChevronRight className="inline w-3 h-3" /> Director aprueba <ChevronRight className="inline w-3 h-3" /> <strong className="text-text-main">Aparece aqui</strong></span>
              </div>
            )}
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
                  <th className="px-4 py-3">Plan / Ciclo</th>
                  <th className="px-4 py-3">Excepcion</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredLineas.map((line) => (
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
                        <div className="flex items-start gap-1.5 text-xs bg-amber-50 border border-amber-200 text-amber-800 px-2 py-1 rounded-lg max-w-[200px]">
                          <Info className="w-3.5 h-3.5 shrink-0 text-warning mt-0.5" />
                          <span className="break-words">{line.motivoAperturaExcepcional}</span>
                        </div>
                      ) : (
                        <span className="text-text-sub text-xs">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
