'use client';

import { useTRPC } from '@/trpc/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import {
  Users,
  BookOpen,
  Calendar,
  TrendingUp,
  AlertTriangle,
  Clock,
  ArrowRight,
  FileText,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

const COLORS = ['#4f46e5', '#0891b2', '#047857', '#b45309', '#dc2626', '#7e22ce'];
const CHART_GRID_COLOR = '#d7dee8';
const CHART_AXIS_COLOR = '#64748b';
const CHART_TOOLTIP_STYLE = {
  backgroundColor: '#ffffff',
  border: '1px solid #d7dee8',
  borderRadius: '10px',
  boxShadow: '0 18px 40px rgb(15 23 42 / 0.08)',
  color: '#0f172a',
};
const CHART_TOOLTIP_LABEL_STYLE = { color: '#334155' };

function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  color = 'indigo',
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ElementType;
  color?: string;
}) {
  const colorMap: Record<string, string> = {
    indigo: 'from-indigo-600/20 to-indigo-600/5 border-indigo-500/30 text-indigo-400',
    cyan: 'from-cyan-600/20 to-cyan-600/5 border-cyan-500/30 text-cyan-400',
    emerald: 'from-emerald-600/20 to-emerald-600/5 border-emerald-500/30 text-emerald-400',
    amber: 'from-amber-600/20 to-amber-600/5 border-amber-500/30 text-amber-400',
    red: 'from-red-600/20 to-red-600/5 border-red-500/30 text-red-400',
  };

  return (
    <div className={`rounded-xl border bg-gradient-to-br p-5 ${colorMap[color]}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">{title}</p>
          <p className="mt-2 text-3xl font-bold text-white">{value}</p>
          {subtitle && <p className="mt-1 text-xs text-gray-500">{subtitle}</p>}
        </div>
        <Icon className="h-8 w-8 opacity-60" />
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { data: user } = useQuery({ ...trpc.auth.me.queryOptions() });
  const { data: docenteStats } = useQuery({ ...trpc.docente.stats.queryOptions() });
  const { data: periodoActivo } = useQuery({ ...trpc.periodo.active.queryOptions() });
  const { data: personalDocente } = useQuery({
    ...trpc.docente.personalStats.queryOptions(),
    enabled: user?.role === 'DOCENTE',
  });

  const isSecretaria = user?.role === 'SECRETARIA_ACADEMICA';
  const isDirector = user?.role === 'DIRECTOR_ESCUELA';
  const isAdmin = user?.role === 'ADMIN';
  const isDecano = user?.role === 'DECANO';

  const horarioStats = useQuery({
    ...trpc.horario.stats.queryOptions({ periodoId: periodoActivo?.id ?? '' }),
    enabled: !!periodoActivo?.id,
  });

  const aulaStats = useQuery({
    ...trpc.aula.stats.queryOptions({ periodoId: periodoActivo?.id ?? '' }),
    enabled: !!periodoActivo?.id,
  });

  const stats = horarioStats.data;
  const aulasData = aulaStats.data?.ocupacionPorAula;

  // Chart data
  const categoriaData = docenteStats
    ? [
        { name: 'Principal', value: docenteStats.porCategoria.PRINCIPAL },
        { name: 'Asociado', value: docenteStats.porCategoria.ASOCIADO },
        { name: 'Auxiliar', value: docenteStats.porCategoria.AUXILIAR },
        { name: 'J. Práctica', value: docenteStats.porCategoria.JEFE_PRACTICA },
      ]
    : [];

  const cargaDocenteData = stats?.cargaDocente
    ?.filter((d) => d.horasAsignadas > 0)
    .sort((a, b) => b.horasAsignadas - a.horasAsignadas)
    .slice(0, isAdmin || isSecretaria ? 15 : 10)
    .map((d) => ({
      nombre: d.nombre.split(' ').slice(0, 2).join(' '),
      horas: d.horasAsignadas,
    })) ?? [];

  const ocupacionData = (aulasData ?? [])
    .sort((a, b) => b.ocupacion - a.ocupacion)
    .slice(0, isAdmin || isSecretaria ? 12 : 8)
    .map((a) => ({
      nombre: a.codigo,
      ocupacion: a.ocupacion,
    }));

  const startAssignmentProcessMutation = useMutation(
    trpc.periodo.startAssignmentProcess.mutationOptions({
       onSuccess: () => {
         alert('Proceso de asignación iniciado');
        queryClient.invalidateQueries({ queryKey: trpc.periodo.active.queryKey() });
      },
    })
  );

  // --- Dashboard para Secretaria Académica ---
  if (isSecretaria) {
    return (
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Panel de Secretaría Académica</h1>
            <p className="text-sm text-gray-500 mt-1">Gestión operativa del semestre</p>
          </div>
          <div className="flex gap-3">
             <Link href="/reportes" className="px-4 py-2 bg-gray-800 text-white rounded-lg text-sm font-semibold hover:bg-gray-700">
               Ver Reportes
             </Link>
             <Link href="/asignacion" className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-500 shadow-lg shadow-indigo-600/25">
               Módulo de Asignación
             </Link>
          </div>
        </div>

        {/* KPI Cards for Secretary */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Docentes Activos"
            value={docenteStats?.total ?? 0}
            subtitle={`${docenteStats?.nombrados ?? 0} nombrados · ${docenteStats?.contratados ?? 0} contratados`}
            icon={Users}
            color="indigo"
          />
          <StatCard
            title="Grupos Asignados"
            value={stats?.gruposAsignados ?? 0}
            subtitle={`de ${stats?.totalGrupos ?? 0} total`}
            icon={BookOpen}
            color="cyan"
          />
          <StatCard
            title="Total Asignaciones"
            value={stats?.totalAsignaciones ?? 0}
            subtitle={`${stats?.docentesConCarga ?? 0} docentes con carga`}
            icon={Calendar}
            color="emerald"
          />
          <StatCard
            title="Grupos sin Asignar"
            value={stats?.gruposSinAsignar ?? 0}
            subtitle={stats?.gruposSinAsignar && stats.gruposSinAsignar > 0 ? '⚠ Requiere atención' : 'Todo asignado'}
            icon={stats?.gruposSinAsignar && stats.gruposSinAsignar > 0 ? AlertTriangle : TrendingUp}
            color={stats?.gruposSinAsignar && stats.gruposSinAsignar > 0 ? 'red' : 'amber'}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Stats Charts */}
          <div className="lg:col-span-2 space-y-6">
            <div className="rounded-xl border border-gray-800 bg-gray-900 p-6">
              <h2 className="text-sm font-semibold text-gray-300 mb-4">Ocupación de Aulas (%)</h2>
              {ocupacionData.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={ocupacionData}>
                    <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID_COLOR} />
                    <XAxis dataKey="nombre" stroke={CHART_AXIS_COLOR} fontSize={11} />
                    <YAxis stroke={CHART_AXIS_COLOR} fontSize={11} domain={[0, 100]} />
                    <Tooltip
                      contentStyle={CHART_TOOLTIP_STYLE}
                      labelStyle={CHART_TOOLTIP_LABEL_STYLE}
                    />
                    <Bar dataKey="ocupacion" fill="#6366f1" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[250px] flex items-center justify-center text-gray-600">
                  Sin datos de ocupación
                </div>
              )}
            </div>

            <div className="rounded-xl border border-gray-800 bg-gray-900 p-6">
              <h2 className="text-sm font-semibold text-gray-300 mb-4">Carga Docente (Top 15)</h2>
              {cargaDocenteData.length > 0 ? (
                <ResponsiveContainer width="100%" height={350}>
                  <BarChart data={cargaDocenteData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID_COLOR} />
                    <XAxis type="number" stroke={CHART_AXIS_COLOR} fontSize={11} />
                    <YAxis type="category" dataKey="nombre" stroke={CHART_AXIS_COLOR} fontSize={11} width={120} />
                    <Tooltip
                      contentStyle={CHART_TOOLTIP_STYLE}
                      labelStyle={CHART_TOOLTIP_LABEL_STYLE}
                    />
                    <Bar dataKey="horas" fill="#06b6d4" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-gray-600">
                  Sin carga docente
                </div>
              )}
            </div>
          </div>

          {/* Side Module Info */}
          <div className="space-y-6">
            <div className="rounded-xl border border-gray-800 bg-gray-900 p-6">
              <h2 className="text-sm font-semibold text-gray-300 mb-4">Docentes por Categoría</h2>
              {categoriaData.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={categoriaData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {categoriaData.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={CHART_TOOLTIP_STYLE}
                      labelStyle={CHART_TOOLTIP_LABEL_STYLE}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[250px] flex items-center justify-center text-gray-600">
                  Sin datos
                </div>
              )}
            </div>

            <div className="rounded-xl border border-indigo-500/30 bg-indigo-500/5 p-6">
              <AlertTriangle className="h-8 w-8 text-indigo-500 mb-4" />
              <h2 className="text-lg font-bold text-white mb-2">Módulo de Asignación</h2>
              <p className="text-xs text-gray-400 leading-relaxed mb-4">
                Usted es el responsable de completar el proceso de asignación siguiendo la jerarquía y disponibilidad.
              </p>
              <Link 
                href="/asignacion" 
                className="flex items-center justify-center w-full px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-500 transition-colors"
              >
                Ir a Asignación &rarr;
              </Link>
            </div>
            
            <div className="p-5 rounded-xl bg-gray-800/50 border border-gray-700 text-left">
               <p className="text-[10px] font-bold text-indigo-400 uppercase mb-1">Recordatorio</p>
               <p className="text-xs text-gray-400">Verifique la disponibilidad de los docentes antes de iniciar cualquier cambio en el módulo de asignación.</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // --- Dashboard para Director de Escuela ---
  if (isDirector) {
    return (
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Panel de Dirección de Escuela</h1>
            <p className="text-sm text-gray-500 mt-1">Supervisión y aprobación de horarios</p>
          </div>
          <div className="flex gap-3">
             {periodoActivo?.estado === 'PLANIFICACION' && (
               <button 
                 onClick={() => {
                   if (confirm('¿Desea iniciar el proceso de asignación? Esto notificará a los docentes para ingresar su disponibilidad.')) {
                     startAssignmentProcessMutation.mutate({ id: periodoActivo.id });
                   }
                 }}
                 disabled={startAssignmentProcessMutation.isPending}
                 className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-bold hover:bg-emerald-500 shadow-lg shadow-emerald-500/25 disabled:opacity-50"
               >
                 {startAssignmentProcessMutation.isPending ? 'Iniciando...' : 'Iniciar Proceso de Asignación'}
               </button>
             )}
             <Link href="/reportes" className="px-4 py-2 bg-gray-800 text-white rounded-lg text-sm font-semibold hover:bg-gray-700">
               Ver Reportes
             </Link>
             <Link href="/horarios" className="px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-semibold hover:bg-amber-500 shadow-lg shadow-amber-600/25">
               Revisar Horarios
             </Link>
          </div>
        </div>

        {/* KPI Cards for Director */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Estado Semestre"
            value={periodoActivo?.estado || '---'}
            subtitle={periodoActivo?.nombre}
            icon={TrendingUp}
            color="amber"
          />
          <StatCard
            title="Cobertura Total"
            value={stats?.totalGrupos ? `${Math.round((stats.gruposAsignados / stats.totalGrupos) * 100)}%` : '0%'}
            subtitle={`${stats?.gruposAsignados || 0} de ${stats?.totalGrupos || 0} grupos`}
            icon={Calendar}
            color="indigo"
          />
          <StatCard
            title="Docentes con Carga"
            value={stats?.docentesConCarga || 0}
            subtitle={`Total: ${docenteStats?.total || 0}`}
            icon={Users}
            color="emerald"
          />
          <StatCard
            title="Sesiones Programadas"
            value={stats?.totalAsignaciones || 0}
            subtitle="Horas académicas"
            icon={Clock}
            color="cyan"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Charts for Director */}
          <div className="rounded-xl border border-gray-800 bg-gray-900 p-6">
            <h2 className="text-sm font-semibold text-gray-300 mb-4">Ocupación de Ambientes Académicos (%)</h2>
            {ocupacionData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={ocupacionData}>
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID_COLOR} />
                  <XAxis dataKey="nombre" stroke={CHART_AXIS_COLOR} fontSize={11} />
                  <YAxis stroke={CHART_AXIS_COLOR} fontSize={11} domain={[0, 100]} />
                  <Tooltip
                    contentStyle={CHART_TOOLTIP_STYLE}
                    labelStyle={CHART_TOOLTIP_LABEL_STYLE}
                  />
                  <Bar dataKey="ocupacion" fill="#6366f1" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-gray-600">
                Sin datos de ocupación disponibles
              </div>
            )}
          </div>

          <div className="rounded-xl border border-gray-800 bg-gray-900 p-6">
            <h2 className="text-sm font-semibold text-gray-300 mb-4">Docentes por Categoría</h2>
            {categoriaData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={categoriaData}
                    cx="50%"
                    cy="50%"
                    innerRadius={70}
                    outerRadius={100}
                    paddingAngle={4}
                    dataKey="value"
                    label={({ name, value }) => `${name}: ${value}`}
                  >
                    {categoriaData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={CHART_TOOLTIP_STYLE}
                    labelStyle={CHART_TOOLTIP_LABEL_STYLE}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-gray-600">
                Sin datos de docentes
              </div>
            )}
          </div>

          <div className="lg:col-span-2 rounded-xl border border-gray-800 bg-gray-900 p-6">
            <h2 className="text-sm font-semibold text-gray-300 mb-4">Carga Lectiva Detallada</h2>
            {cargaDocenteData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={cargaDocenteData}>
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID_COLOR} />
                  <XAxis dataKey="nombre" stroke={CHART_AXIS_COLOR} fontSize={10} angle={-45} textAnchor="end" height={60} />
                  <YAxis stroke={CHART_AXIS_COLOR} fontSize={11} />
                  <Tooltip
                    contentStyle={CHART_TOOLTIP_STYLE}
                    labelStyle={CHART_TOOLTIP_LABEL_STYLE}
                  />
                  <Bar dataKey="horas" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-gray-600">
                Sin carga docente registrada
              </div>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-8 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-white mb-2">Estado de la Programación</h2>
            <p className="text-gray-400">
              Supervise el avance de las asignaciones y revise la propuesta final de horarios para su aprobación.
            </p>
          </div>
          <Link 
            href="/horarios"
            className="inline-flex items-center gap-2 px-6 py-3 bg-amber-600 text-white rounded-lg font-bold hover:bg-amber-500 transition-colors shadow-lg shadow-amber-600/20"
          >
            Ver Programación Completa <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    );
  }

  // --- Dashboard para Decano ---
  if (isDecano) {
    return (
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Panel del Decanato</h1>
            <p className="text-sm text-gray-500 mt-1">Supervisión de cargas académicas</p>
          </div>
          <div className="flex gap-3">
            <Link href="/declaraciones" className="px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-semibold hover:bg-amber-500 shadow-lg shadow-amber-600/25">
              VB Pendientes
            </Link>
            <Link href="/reportes" className="px-4 py-2 bg-gray-800 text-white rounded-lg text-sm font-semibold hover:bg-gray-700">
              Reportes
            </Link>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard title="Docentes Totales" value={docenteStats?.total ?? 0} subtitle="Plana completa" icon={Users} color="indigo" />
          <StatCard title="Declaraciones Pendientes" value="—" subtitle="VB Decano" icon={FileText} color="amber" />
          <StatCard title="Periodo Activo" value={periodoActivo?.nombre || '---'} subtitle={periodoActivo?.estado} icon={Calendar} color="emerald" />
          <StatCard title="Cobertura Carga" value={stats?.totalGrupos ? `${Math.round((stats.gruposAsignados / stats.totalGrupos) * 100)}%` : '0%'} subtitle="Grupos asignados" icon={TrendingUp} color="cyan" />
        </div>
      </div>
    );
  }

  const isDirectorDepto = user?.role === 'DIRECTOR_DEPARTAMENTO';
  const isSecretariaDepto = user?.role === 'SECRETARIA_DEPARTAMENTO';

  // --- Dashboard para Director de Departamento ---
  if (isDirectorDepto) {
    return (
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Panel de Dirección de Departamento</h1>
            <p className="text-sm text-gray-500 mt-1">Gestión de carga lectiva</p>
          </div>
          <div className="flex gap-3">
            <Link href="/carga-lectiva" className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-500">
              Carga Lectiva
            </Link>
            <Link href="/declaraciones" className="px-4 py-2 bg-gray-800 text-white rounded-lg text-sm font-semibold hover:bg-gray-700">
              Declaraciones
            </Link>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard title="Docentes Depto" value={docenteStats?.total ?? 0} subtitle="Asignados" icon={Users} color="indigo" />
          <StatCard title="Carga Asignada" value={stats?.totalAsignaciones ?? 0} subtitle="Horas lectivas" icon={BookOpen} color="emerald" />
          <StatCard title="Declaraciones Pendientes" value="—" subtitle="Por aprobar" icon={FileText} color="amber" />
          <StatCard title="Cobertura" value={stats?.totalGrupos ? `${Math.round((stats.gruposAsignados / stats.totalGrupos) * 100)}%` : '0%'} subtitle="Grupos" icon={TrendingUp} color="cyan" />
        </div>
      </div>
    );
  }

  // --- Dashboard para Secretaria de Departamento ---
  if (isSecretariaDepto) {
    return (
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Panel de Secretaría de Departamento</h1>
            <p className="text-sm text-gray-500 mt-1">Gestión de carga académica departamental</p>
          </div>
          <div className="flex gap-3">
            <Link href="/carga-lectiva" className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-500">
              Asignar Carga
            </Link>
            <Link href="/asignacion" className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-semibold hover:bg-emerald-500">
              Asignar Horarios
            </Link>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard title="Docentes Activos" value={docenteStats?.total ?? 0} subtitle={docenteStats ? `${docenteStats.nombrados} nombrados · ${docenteStats.contratados} contratados` : ''} icon={Users} color="indigo" />
          <StatCard title="Carga Asignada" value={stats?.totalAsignaciones ?? 0} subtitle="Asignaciones" icon={BookOpen} color="emerald" />
          <StatCard title="Grupos Asignados" value={stats?.gruposAsignados ?? 0} subtitle={`de ${stats?.totalGrupos ?? 0}`} icon={Calendar} color="cyan" />
          <StatCard title="Horas Totales" value={stats?.totalAsignaciones ?? 0} subtitle="Horas/semana" icon={Clock} color="amber" />
        </div>
      </div>
    );
  }

  // --- Dashboard para Docente ---
  if (user?.role === 'DOCENTE' && personalDocente) {
    return ( 
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Mi Panel Docente</h1>
            <p className="text-sm text-gray-500 mt-1">Hola, {user.nombre} · {personalDocente.docente.tipo}</p>
          </div>
          <div className="flex gap-3">
             <Link href="/disponibilidad" className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-500 shadow-lg shadow-indigo-600/25">
               Gestionar Disponibilidad
             </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <StatCard
            title="Carga Lectiva"
            value={`${personalDocente.workload} hrs`}
            subtitle={`${personalDocente.limits.min}-${personalDocente.limits.max} hrs requeridas`}
            icon={Clock}
            color="indigo"
          />
          <StatCard
            title="Cursos Asignados"
            value={personalDocente.coursesCount}
            subtitle="Semestre actual"
            icon={BookOpen}
            color="emerald"
          />
          <StatCard
            title="Estado Carga"
            value={personalDocente.workload >= personalDocente.limits.min ? 'Completa' : 'Pendiente'}
            subtitle={personalDocente.workload >= personalDocente.limits.min ? 'Cumple con el mínimo' : 'Faltan horas'}
            icon={TrendingUp}
            color={personalDocente.workload >= personalDocente.limits.min ? 'emerald' : 'amber'}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 rounded-xl border border-gray-800 bg-gray-900 p-6">
            <h2 className="text-sm font-semibold text-gray-300 mb-4">Mis Horarios Asignados</h2>
            {personalDocente.assignments.length > 0 ? (
              <div className="space-y-3">
                {personalDocente.assignments.map((a: any) => (
                  <div key={a.id} className="flex items-center justify-between p-3 rounded-lg bg-gray-800/50 border border-gray-700/50">
                    <div>
                      <p className="text-sm font-medium text-white">{a.grupo?.curso?.nombre || 'Curso sin nombre'}</p>
                      <p className="text-xs text-gray-500">Grupo {a.grupo?.nombre || '-'} · {a.aula?.codigo || 'Sin aula'}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-medium text-indigo-400">{a.franjaHoraria?.dia}</p>
                      <p className="text-[10px] text-gray-500">{a.franjaHoraria?.horaInicio}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-12 text-center text-gray-600">No tienes horarios registrados</div>
            )}
          </div>
          
          <div className="rounded-xl border border-gray-800 bg-gray-900 p-6 flex flex-col items-center justify-center text-center">
             <TrendingUp className="h-12 w-12 text-indigo-500/20 mb-4" />
             <h3 className="text-white font-medium">¿Buscas más cursos?</h3>
             <p className="text-sm text-gray-500 mt-2 max-w-xs">
               Recuerda que puedes postular a nuevos cursos en el módulo de Cursos según tu categoría docente.
             </p>
          </div>
        </div>
      </div>
    );
  }

  // --- Dashboard para Invitado (Sin Loguear) ---
  if (!user) {
    return (
      <div className="space-y-8">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold text-white tracking-tight">Sistema de Gestión de Horarios</h1>
            <p className="text-gray-400 mt-2 max-w-2xl">
              Bienvenido a la plataforma de horarios de la Escuela de Ingeniería de Sistemas — UNT. 
              Como invitado, puede consultar la programación académica, docentes y disponibilidad de ambientes.
            </p>
          </div>
          <Link href="/login" className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-500 shadow-xl shadow-indigo-600/20 transition-all flex items-center gap-2">
            Iniciar Sesión <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        {/* Guest KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Periodo Lectivo"
            value={periodoActivo?.nombre || '---'}
            subtitle={periodoActivo?.estado || 'Semestre Actual'}
            icon={Calendar}
            color="indigo"
          />
          <StatCard
            title="Plana Docente"
            value={docenteStats?.total || 0}
            subtitle="Docentes registrados"
            icon={Users}
            color="cyan"
          />
          <StatCard
            title="Cursos Aperturados"
            value={stats?.totalGrupos || 0}
            subtitle="Grupos programados"
            icon={BookOpen}
            color="emerald"
          />
          <StatCard
            title="Estado Programación"
            value={stats?.totalGrupos ? `${Math.round((stats.gruposAsignados / stats.totalGrupos) * 100)}%` : '0%'}
            subtitle="Avance de horarios"
            icon={TrendingUp}
            color="amber"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="rounded-2xl border border-gray-800 bg-gray-900/50 p-8">
              <h2 className="text-xl font-bold text-white mb-6">Módulos Disponibles para Consulta</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[
                  { title: 'Horarios', desc: 'Consulte el horario por ciclo, aula o docente.', icon: Calendar, href: '/horarios', color: 'bg-indigo-500/10 text-indigo-400' },
                  { title: 'Docentes', desc: 'Directorio y perfiles académicos.', icon: Users, href: '/docentes', color: 'bg-cyan-500/10 text-cyan-400' },
                  { title: 'Cursos', desc: 'Mallas curriculares y sílabos.', icon: BookOpen, href: '/cursos', color: 'bg-emerald-500/10 text-emerald-400' },
                  { title: 'Aulas', desc: 'Ubicación y aforo de ambientes.', icon: Clock, href: '/aulas', color: 'bg-amber-500/10 text-amber-400' },
                ].map((mod) => (
                  <Link key={mod.title} href={mod.href} className="group p-5 rounded-xl border border-gray-800 bg-gray-900 hover:border-gray-700 transition-all">
                    <div className={`h-10 w-10 ${mod.color} rounded-lg flex items-center justify-center mb-4`}>
                      <mod.icon className="h-5 w-5" />
                    </div>
                    <h3 className="text-white font-bold group-hover:text-indigo-400 transition-colors">{mod.title}</h3>
                    <p className="text-sm text-gray-500 mt-1">{mod.desc}</p>
                  </Link>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-gray-800 bg-gray-900/50 p-6">
            <h2 className="text-lg font-bold text-white mb-4">Información de Contacto</h2>
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-gray-800/30 border border-gray-700/50">
                <p className="text-xs font-bold text-gray-500 uppercase mb-1">Secretaría Académica</p>
                <p className="text-sm text-gray-300">Pabellón de Ingeniería de Sistemas</p>
                <p className="text-sm text-indigo-400 mt-1">secretaria.sistemas@unt.edu.pe</p>
              </div>
              <div className="p-4 rounded-xl bg-gray-800/30 border border-gray-700/50">
                <p className="text-xs font-bold text-gray-500 uppercase mb-1">Horario de Atención</p>
                <p className="text-sm text-gray-300">Lunes a Viernes</p>
                <p className="text-sm text-gray-300">08:00 AM - 02:00 PM</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // --- Dashboard para Admin o Público ---
  
  return (
    <div>
      {/* Header */}
      <div className="mb-8 flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-white">
            {isAdmin ? 'Panel de Administración' : 'Dashboard General'}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Periodo activo: {periodoActivo?.nombre ?? 'Ninguno configurado'}
          </p>
        </div>
        {isAdmin && (
          <div className="flex gap-2">
            <Link href="/asignacion" className="px-3 py-1 bg-indigo-600 text-white rounded-lg text-[10px] font-bold uppercase hover:bg-indigo-500 transition-colors">
              Módulo de Asignación
            </Link>
            <span className="px-3 py-1 bg-purple-500/10 border border-purple-500/20 rounded-full text-[10px] font-bold text-purple-400 uppercase tracking-widest">
              Vista Avanzada
            </span>
          </div>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          title="Docentes Activos"
          value={docenteStats?.total ?? 0}
          subtitle={isAdmin ? `${docenteStats?.nombrados ?? 0} nombrados · ${docenteStats?.contratados ?? 0} contratados` : undefined}
          icon={Users}
          color="indigo"
        />
        <StatCard
          title="Grupos Asignados"
          value={stats?.gruposAsignados ?? 0}
          subtitle={isAdmin ? `de ${stats?.totalGrupos ?? 0} total` : undefined}
          icon={BookOpen}
          color="cyan"
        />
        <StatCard
          title="Total Asignaciones"
          value={stats?.totalAsignaciones ?? 0}
          subtitle={isAdmin ? `${stats?.docentesConCarga ?? 0} docentes con carga` : undefined}
          icon={Calendar}
          color="emerald"
        />
        <StatCard
          title={isAdmin ? "Grupos sin Asignar" : "Estado Cobertura"}
          value={isAdmin ? (stats?.gruposSinAsignar ?? 0) : (stats?.totalGrupos ? `${Math.round((stats.gruposAsignados / stats.totalGrupos) * 100)}%` : '0%')}
          subtitle={isAdmin ? (stats?.gruposSinAsignar && stats.gruposSinAsignar > 0 ? '⚠ Requiere atención' : 'Todo asignado') : 'Avance del semestre'}
          icon={isAdmin && stats?.gruposSinAsignar && stats.gruposSinAsignar > 0 ? AlertTriangle : TrendingUp}
          color={isAdmin && stats?.gruposSinAsignar && stats.gruposSinAsignar > 0 ? 'red' : 'amber'}
        />
      </div>

      {isAdmin && (
         <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
            <div className="p-4 rounded-xl border border-indigo-500/20 bg-indigo-500/5">
               <h4 className="text-xs font-bold text-indigo-400 uppercase mb-2">Resumen Operativo</h4>
               <p className="text-sm text-gray-400">
                  Sistema operando al {(stats?.totalGrupos ? (stats.gruposAsignados / stats.totalGrupos * 100).toFixed(1) : 0)}% de capacidad. 
                  Se han registrado {stats?.totalAsignaciones} sesiones de clase.
               </p>
            </div>
            <div className="p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5">
               <h4 className="text-xs font-bold text-emerald-400 uppercase mb-2">Ambientes</h4>
               <p className="text-sm text-gray-400">
                  Promedio de ocupación general: {aulasData?.length ? (aulasData.reduce((acc: number, curr: any) => acc + curr.ocupacion, 0) / aulasData.length).toFixed(1) : 0}% 
                  en {aulasData?.length} aulas activas.
               </p>
            </div>
         </div>
      )}

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Distribución por Categoría */}
        <div className="rounded-xl border border-gray-800 bg-gray-900 p-6">
          <h2 className="text-sm font-semibold text-gray-300 mb-4">Docentes por Categoría</h2>
          {categoriaData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={categoriaData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={4}
                  dataKey="value"
                  label={({ name, value }) => `${name}: ${value}`}
                >
                  {categoriaData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={CHART_TOOLTIP_STYLE}
                  labelStyle={CHART_TOOLTIP_LABEL_STYLE}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[250px] flex items-center justify-center text-gray-600">
              Sin datos
            </div>
          )}
        </div>

        {/* Ocupación de Aulas */}
        <div className="rounded-xl border border-gray-800 bg-gray-900 p-6">
          <h2 className="text-sm font-semibold text-gray-300 mb-4">Ocupación de Aulas (%)</h2>
          {ocupacionData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={ocupacionData}>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID_COLOR} />
                <XAxis dataKey="nombre" stroke={CHART_AXIS_COLOR} fontSize={11} />
                <YAxis stroke={CHART_AXIS_COLOR} fontSize={11} domain={[0, 100]} />
                <Tooltip
                  contentStyle={CHART_TOOLTIP_STYLE}
                  labelStyle={CHART_TOOLTIP_LABEL_STYLE}
                />
                <Bar dataKey="ocupacion" fill="#6366f1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[250px] flex items-center justify-center text-gray-600">
              Genere un horario para ver la ocupación
            </div>
          )}
        </div>

        {/* Carga Docente */}
        <div className="rounded-xl border border-gray-800 bg-gray-900 p-6 lg:col-span-2">
          <h2 className="text-sm font-semibold text-gray-300 mb-4">
             {isAdmin ? 'Carga Docente Detallada (Top 15)' : 'Carga Docente (Top 10)'}
          </h2>
          {cargaDocenteData.length > 0 ? (
            <ResponsiveContainer width="100%" height={isAdmin ? 400 : 300}>
              <BarChart data={cargaDocenteData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID_COLOR} />
                <XAxis type="number" stroke={CHART_AXIS_COLOR} fontSize={11} />
                <YAxis type="category" dataKey="nombre" stroke={CHART_AXIS_COLOR} fontSize={11} width={120} />
                <Tooltip
                  contentStyle={CHART_TOOLTIP_STYLE}
                  labelStyle={CHART_TOOLTIP_LABEL_STYLE}
                />
                <Bar dataKey="horas" fill="#06b6d4" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-gray-600">
              Genere un horario para ver la carga docente
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
