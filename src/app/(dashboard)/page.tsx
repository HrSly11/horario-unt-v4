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
  CheckCircle2,
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

const COLORS = ['#1e40af', '#0284c7', '#15803d', '#b45309', '#b91c1c', '#475569'];
const CHART_GRID_COLOR = '#E2E8F0';
const CHART_AXIS_COLOR = '#64748B';
const CHART_TOOLTIP_STYLE = {
  backgroundColor: '#ffffff',
  border: '1px solid #E2E8F0',
  borderRadius: '12px',
  boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
  color: '#0F172A',
};
const CHART_TOOLTIP_LABEL_STYLE = { color: '#475569', fontWeight: 'bold' };

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
    indigo: 'bg-primary/5 border-primary/20 text-primary',
    cyan: 'bg-info/5 border-info/20 text-info',
    emerald: 'bg-success/5 border-success/20 text-success',
    amber: 'bg-warning/5 border-warning/20 text-warning',
    red: 'bg-danger/5 border-danger/20 text-danger',
  };

  return (
    <div className={`rounded-xl border p-5 bg-white transition-all hover:shadow-md ${colorMap[color] || colorMap.indigo}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] font-bold text-text-sub uppercase tracking-widest">{title}</p>
          <p className="mt-2 text-3xl font-black text-text-main tracking-tight">{value}</p>
          {subtitle && <p className="mt-1 text-xs text-text-sub font-medium">{subtitle}</p>}
        </div>
        <div className="p-3 rounded-xl bg-white border border-border text-current shadow-sm">
          <Icon className="h-6 w-6 opacity-80" />
        </div>
      </div>
    </div>
  );
}



function SecretariaDashboard({
  docenteStats,
  stats,
  ocupacionData,
  cargaDocenteData,
  categoriaData,
}: any) {
  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-main">Panel de Secretaría Académica</h1>
          <p className="text-sm text-text-sub mt-1">Gestión operativa del semestre</p>
        </div>
        <div className="flex gap-3">
          <Link href="/reportes" className="btn-secondary">
            Ver Reportes
          </Link>
          <Link href="/asignacion" className="btn-primary">
            Módulo de Asignación
          </Link>
        </div>
      </div>

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
        <div className="lg:col-span-2 space-y-6">
          <div className="rounded-xl border border-border bg-white p-6 shadow-sm">
            <h2 className="text-sm font-bold text-text-main uppercase tracking-wider mb-4">Ocupación de Aulas (%)</h2>
            <div className="h-[250px] min-h-[250px] w-full">
              {ocupacionData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={ocupacionData}>
                    <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID_COLOR} vertical={false} />
                    <XAxis dataKey="nombre" stroke={CHART_AXIS_COLOR} fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis stroke={CHART_AXIS_COLOR} fontSize={11} domain={[0, 100]} tickLine={false} axisLine={false} />
                    <Tooltip
                      contentStyle={CHART_TOOLTIP_STYLE}
                      labelStyle={CHART_TOOLTIP_LABEL_STYLE}
                      cursor={{ fill: '#F8FAFC' }}
                    />
                    <Bar dataKey="ocupacion" fill="#1e40af" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-text-sub font-medium">
                  Sin datos de ocupación
                </div>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-white p-6 shadow-sm">
            <h2 className="text-sm font-bold text-text-main uppercase tracking-wider mb-4">Carga Docente (Top 15)</h2>
            <div className="h-[350px] min-h-[350px] w-full">
              {cargaDocenteData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={cargaDocenteData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID_COLOR} horizontal={false} />
                    <XAxis type="number" stroke={CHART_AXIS_COLOR} fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis type="category" dataKey="nombre" stroke={CHART_AXIS_COLOR} fontSize={11} width={120} tickLine={false} axisLine={false} />
                    <Tooltip
                      contentStyle={CHART_TOOLTIP_STYLE}
                      labelStyle={CHART_TOOLTIP_LABEL_STYLE}
                      cursor={{ fill: '#F8FAFC' }}
                    />
                    <Bar dataKey="horas" fill="#0284c7" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-text-sub font-medium">
                  Sin carga docente
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-xl border border-border bg-white p-6 shadow-sm">
            <h2 className="text-sm font-bold text-text-main uppercase tracking-wider mb-4">Docentes por Categoría</h2>
            <div className="h-[200px] min-h-[200px] w-full">
              {categoriaData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={categoriaData}
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {categoriaData.map((_: any, index: number) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-text-sub">
                  Sin datos
                </div>
              )}
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              {categoriaData.map((item: any, index: number) => (
                <div key={item.name} className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                  <span className="text-[10px] font-bold text-text-sub uppercase">{item.name}</span>
                  <span className="text-[10px] font-black text-text-main ml-auto">{item.value}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-white p-6 shadow-sm">
            <h2 className="text-sm font-bold text-text-main uppercase tracking-wider mb-4">Acciones Rápidas</h2>
            <div className="grid gap-2">
              <Link href="/docentes" className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-border hover:border-primary/30 transition-all group">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-white border border-border group-hover:text-primary transition-colors">
                    <Users className="h-4 w-4" />
                  </div>
                  <span className="text-xs font-bold text-text-main">Directorio Docente</span>
                </div>
                <ArrowRight className="h-4 w-4 text-text-sub group-hover:text-primary" />
              </Link>
              <Link href="/cursos" className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-border hover:border-primary/30 transition-all group">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-white border border-border group-hover:text-primary transition-colors">
                    <BookOpen className="h-4 w-4" />
                  </div>
                  <span className="text-xs font-bold text-text-main">Catálogo de Cursos</span>
                </div>
                <ArrowRight className="h-4 w-4 text-text-sub group-hover:text-primary" />
              </Link>
              <Link href="/reportes" className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-border hover:border-primary/30 transition-all group">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-white border border-border group-hover:text-primary transition-colors">
                    <FileText className="h-4 w-4" />
                  </div>
                  <span className="text-xs font-bold text-text-main">Reportes de Carga</span>
                </div>
                <ArrowRight className="h-4 w-4 text-text-sub group-hover:text-primary" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function DirectorDashboard({
  periodoActivo,
  stats,
  docenteStats,
  ocupacionData,
  categoriaData,
  cargaDocenteData,
  startAssignmentProcessMutation,
  directorStats,
}: any) {
  const dStats = directorStats;
  
  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-main">Panel de Dirección de Escuela</h1>
          <p className="text-sm text-text-sub mt-1">Supervisión y aprobación de horarios · {dStats?.escuela?.nombre || '---'}</p>
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
              className="btn-primary"
            >
              {startAssignmentProcessMutation.isPending ? 'Iniciando...' : 'Iniciar Proceso de Asignación'}
            </button>
          )}
          <Link href="/reportes" className="btn-secondary">
            Ver Reportes
          </Link>
          <Link href="/horarios" className="px-4 py-2 bg-warning text-white rounded-lg text-sm font-bold hover:bg-amber-600 shadow-lg shadow-warning/25 transition-all">
            Revisar Horarios
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard
          title="Estado Semestre"
          value={periodoActivo?.estado || '---'}
          subtitle={periodoActivo?.nombre}
          icon={TrendingUp}
          color="amber"
        />
        <StatCard
          title="Total Cursos"
          value={dStats?.contadores?.cursos ?? 0}
          subtitle="Programados"
          icon={BookOpen}
          color="indigo"
        />
        <StatCard
          title="Cobertura"
          value={`${dStats?.progresoHorarios ?? 0}%`}
          subtitle={`${dStats?.contadores?.gruposAsignados ?? 0} de ${dStats?.contadores?.grupos ?? 0} grupos`}
          icon={Calendar}
          color="emerald"
        />
        <StatCard
          title="Docentes Activos"
          value={dStats?.contadores?.docentes ?? 0}
          subtitle="Con carga"
          icon={Users}
          color="cyan"
        />
        <StatCard
          title="Sesiones Programadas"
          value={stats?.totalAsignaciones || 0}
          subtitle="Horas académicas"
          icon={Clock}
          color="violet"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="rounded-xl border border-border bg-white p-6 shadow-sm">
            <h2 className="text-sm font-bold text-text-main uppercase tracking-wider mb-4">Ocupación de Ambientes Académicos (%)</h2>
            <div className="h-[300px] min-h-[300px] w-full">
              {dStats?.ocupacionAulas?.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dStats.ocupacionAulas}>
                    <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID_COLOR} vertical={false} />
                    <XAxis dataKey="codigo" stroke={CHART_AXIS_COLOR} fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis stroke={CHART_AXIS_COLOR} fontSize={11} domain={[0, 100]} tickLine={false} axisLine={false} />
                    <Tooltip
                      contentStyle={CHART_TOOLTIP_STYLE}
                      labelStyle={CHART_TOOLTIP_LABEL_STYLE}
                      cursor={{ fill: '#F8FAFC' }}
                    />
                    <Bar dataKey="ocupacion" fill="#1e40af" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-text-sub font-medium">
                  Sin datos de ocupación disponibles
                </div>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-white p-6 shadow-sm">
            <h2 className="text-sm font-bold text-text-main uppercase tracking-wider mb-4">Carga Lectiva por Docente</h2>
            <div className="h-[350px] min-h-[350px] w-full">
              {dStats?.cargaDocente?.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dStats.cargaDocente} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID_COLOR} horizontal={false} />
                    <XAxis type="number" stroke={CHART_AXIS_COLOR} fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis dataKey="nombre" type="category" stroke={CHART_AXIS_COLOR} fontSize={10} width={120} tickLine={false} axisLine={false} />
                    <Tooltip
                      contentStyle={CHART_TOOLTIP_STYLE}
                      labelStyle={CHART_TOOLTIP_LABEL_STYLE}
                    />
                    <Bar dataKey="horas" fill="#15803d" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-text-sub font-medium">
                  Sin carga docente registrada
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-xl border border-border bg-white p-6 shadow-sm">
            <h2 className="text-sm font-bold text-text-main uppercase tracking-wider mb-4">Docentes por Categoría</h2>
            <div className="h-[220px] min-h-[220px] w-full">
              {categoriaData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={categoriaData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {categoriaData.map((_: any, i: number) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-text-sub font-medium">
                  Sin datos de docentes
                </div>
              )}
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              {categoriaData.map((item: any, index: number) => (
                <div key={item.name} className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                  <span className="text-[10px] font-bold text-text-sub uppercase">{item.name}</span>
                  <span className="text-[10px] font-black text-text-main ml-auto">{item.value}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-warning/30 bg-warning/5 p-6">
            <h2 className="text-sm font-bold text-warning mb-4 uppercase tracking-wider">Estado de la Programación</h2>
            <div className="space-y-3">
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-semibold">
                  <span className="text-text-main">Avance</span>
                  <span className="text-text-sub">{dStats?.progresoHorarios ?? 0}%</span>
                </div>
                <div className="relative h-3 w-full bg-slate-100 rounded-full overflow-hidden border border-border">
                  <div 
                    className="absolute top-0 left-0 h-full bg-warning transition-all duration-500"
                    style={{ width: `${dStats?.progresoHorarios ?? 0}%` }}
                  />
                </div>
              </div>
              <Link 
                href="/horarios"
                className="flex items-center justify-between w-full px-4 py-3 bg-white hover:bg-slate-50 text-text-main rounded-xl text-xs font-bold transition-all border border-border"
              >
                Ver Programación Completa
                <ArrowRight className="h-3.5 w-3.5 text-warning" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function DecanoDashboard({
  dStats,
  periodoActivo,
}: {
  dStats: any;
  periodoActivo: any;
}) {
  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-main">Panel de Decanato</h1>
          <p className="text-sm text-text-sub mt-1">Visión global de la Facultad · {dStats?.periodo?.nombre || '---'}</p>
        </div>
        <div className="flex gap-3">
          <Link href="/bitacora" className="btn-secondary">
            Bitácora de Auditoría
          </Link>
          <Link href="/declaraciones" className="btn-primary">
            V°B° Declaraciones
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
        <StatCard
          title="Total Docentes"
          value={dStats?.contadores.docentes ?? 0}
          subtitle={`${dStats?.contadores.departamentos ?? 0} Departamentos`}
          icon={Users}
          color="indigo"
        />
        <StatCard
          title="Declaraciones Finalizadas"
          value={dStats?.contadores.declaracionesFinalizadas ?? 0}
          subtitle={`de ${dStats?.contadores.docentes ?? 0} docentes`}
          icon={CheckCircle2}
          color="emerald"
        />
        <StatCard
          title="Declaraciones Pendientes"
          value={dStats?.contadores.declaracionesPendientes ?? 0}
          subtitle="Acción requerida"
          icon={AlertTriangle}
          color="amber"
        />
        <StatCard
          title="Escuelas Activas"
          value={dStats?.contadores.escuelas ?? 0}
          subtitle="Programación académica"
          icon={BookOpen}
          color="cyan"
        />
        <StatCard
          title="Total Grupos"
          value={dStats?.contadores.grupos ?? 0}
          subtitle="Cursos programados"
          icon={Calendar}
          color="violet"
        />
        <StatCard
          title="Grupos Asignados"
          value={dStats?.contadores.gruposAsignados ?? 0}
          subtitle="Cobertura de horarios"
          icon={Clock}
          color="rose"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="rounded-xl border border-border bg-white p-6 shadow-sm">
            <h2 className="text-sm font-bold text-text-main mb-6 flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              Cumplimiento de Declaraciones por Departamento (%)
            </h2>
            <div className="space-y-5">
              {dStats?.graficos?.progresoDepartamentos?.map((depto: any) => (
                <div key={depto.nombre} className="space-y-2">
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="text-text-main">{depto.nombre}</span>
                    <span className="text-text-sub">{depto.completadas} / {depto.total} docentes</span>
                  </div>
                  <div className="relative h-3 w-full bg-slate-100 rounded-full overflow-hidden border border-border">
                    <div 
                      className="absolute top-0 left-0 h-full bg-primary transition-all duration-500"
                      style={{ width: `${depto.porcentaje}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="rounded-xl border border-border bg-white p-6 shadow-sm">
              <h2 className="text-sm font-bold text-text-main mb-4">Carga Lectiva vs No Lectiva</h2>
              <div className="h-[250px] min-h-[250px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dStats?.graficos?.cargaGlobal || []}>
                    <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID_COLOR} vertical={false} />
                    <XAxis dataKey="name" stroke={CHART_AXIS_COLOR} fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis stroke={CHART_AXIS_COLOR} fontSize={11} tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={CHART_TOOLTIP_STYLE} labelStyle={CHART_TOOLTIP_LABEL_STYLE} />
                    <Bar dataKey="horas" fill="#1e40af" radius={[4, 4, 0, 0]} barSize={60} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-white p-6 shadow-sm">
              <h2 className="text-sm font-bold text-text-main mb-4">Estado de Declaraciones</h2>
              <div className="h-[220px] min-h-[220px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={dStats?.graficos?.distribucionDeclaraciones || []}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      <Cell fill="#15803d" />
                      <Cell fill="#b45309" />
                    </Pie>
                    <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex justify-center gap-4 mt-2">
                <div className="flex items-center gap-1.5">
                  <div className="h-2.5 w-2.5 rounded-full bg-success" />
                  <span className="text-[10px] font-bold text-text-sub uppercase">Finalizadas</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="h-2.5 w-2.5 rounded-full bg-warning" />
                  <span className="text-[10px] font-bold text-text-sub uppercase">Pendientes</span>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-white p-6 shadow-sm">
            <h2 className="text-sm font-bold text-text-main mb-4">Carga Horaria por Departamento</h2>
            <div className="h-[300px] min-h-[300px] w-full">
              {dStats?.graficos?.cargaDocentePorDepto?.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dStats.graficos.cargaDocentePorDepto} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID_COLOR} horizontal={false} />
                    <XAxis type="number" stroke={CHART_AXIS_COLOR} fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis type="category" dataKey="nombre" stroke={CHART_AXIS_COLOR} fontSize={10} width={120} tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={CHART_TOOLTIP_STYLE} labelStyle={CHART_TOOLTIP_LABEL_STYLE} />
                    <Bar dataKey="horasLectivas" name="Lectiva" fill="#1e40af" radius={[0, 4, 4, 0]} stackId="a" />
                    <Bar dataKey="horasNoLectivas" name="No Lectiva" fill="#0ea5e9" radius={[0, 4, 4, 0]} stackId="a" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-text-sub font-medium">
                  Sin datos de carga horaria
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-xl border border-border bg-white p-6 shadow-sm">
            <h2 className="text-sm font-bold text-text-main mb-4">Ocupación de Aulas</h2>
            <div className="h-[300px] min-h-[300px] w-full">
              {dStats?.graficos?.ocupacionAulas?.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dStats.graficos.ocupacionAulas}>
                    <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID_COLOR} vertical={false} />
                    <XAxis dataKey="codigo" stroke={CHART_AXIS_COLOR} fontSize={10} tickLine={false} axisLine={false} angle={-45} textAnchor="end" height={60} />
                    <YAxis stroke={CHART_AXIS_COLOR} fontSize={11} domain={[0, 100]} tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={CHART_TOOLTIP_STYLE} labelStyle={CHART_TOOLTIP_LABEL_STYLE} />
                    <Bar dataKey="ocupacion" fill="#15803d" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-text-sub font-medium">
                  Sin datos de ocupación
                </div>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-white p-6 shadow-sm">
            <h2 className="text-sm font-bold text-text-main mb-4">Avance de Horarios por Escuela</h2>
            <div className="space-y-4">
              {dStats?.graficos?.horariosEscuelas?.map((escuela: any) => (
                <div key={escuela.nombre} className="space-y-2">
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="text-text-main">{escuela.nombre}</span>
                    <span className="text-text-sub">{escuela.gruposAsignados} / {escuela.totalGrupos} grupos</span>
                  </div>
                  <div className="relative h-2.5 w-full bg-slate-100 rounded-full overflow-hidden border border-border">
                    <div 
                      className="absolute top-0 left-0 h-full bg-emerald-500 transition-all duration-500"
                      style={{ width: `${escuela.porcentaje}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-primary/20 bg-primary-light p-6">
            <h2 className="text-sm font-bold text-primary mb-4 uppercase tracking-wider">Supervisión Decanal</h2>
            <div className="space-y-3">
              <p className="text-xs text-text-sub font-medium leading-relaxed">
                Como Decano, su función es validar la carga académica final y asegurar el cumplimiento normativo de la facultad.
              </p>
              <div className="pt-2 space-y-2">
                <Link 
                  href="/reportes"
                  className="flex items-center justify-between w-full px-4 py-3 bg-white hover:bg-slate-50 text-text-main rounded-xl text-xs font-bold transition-all border border-border"
                >
                  Reportes Consolidados
                  <ArrowRight className="h-3.5 w-3.5 text-primary" />
                </Link>
                <Link 
                  href="/declaraciones"
                  className="flex items-center justify-between w-full px-4 py-3 bg-white hover:bg-slate-50 text-text-main rounded-xl text-xs font-bold transition-all border border-border"
                >
                  V°B° Declaraciones
                  <ArrowRight className="h-3.5 w-3.5 text-primary" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function DirectorDeptoDashboard({
  directorDeptoStats,
}: {
  directorDeptoStats: any;
}) {
  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-main">Panel de Dirección de Departamento</h1>
          <p className="text-sm text-text-sub mt-1">Supervisión y control de carga académica · {directorDeptoStats?.departamento?.nombre || '---'}</p>
        </div>
        <div className="flex gap-3">
          <Link href="/carga-lectiva" className="btn-primary">
            Carga Lectiva
          </Link>
          <Link href="/declaraciones" className="btn-secondary">
            Declaraciones
          </Link>
        </div>
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard 
          title="Docentes Depto" 
          value={directorDeptoStats?.contadores?.docentes ?? 0} 
          subtitle="Asignados" 
          icon={Users} 
          color="indigo" 
        />
        <StatCard 
          title="Carga Asignada" 
          value={directorDeptoStats?.contadores?.horasLectivas ?? 0} 
          subtitle="Horas lectivas" 
          icon={BookOpen} 
          color="emerald" 
        />
        <StatCard 
          title="Declaraciones Pendientes" 
          value={directorDeptoStats?.contadores?.declaracionesPendientes ?? 0} 
          subtitle="Por aprobar" 
          icon={FileText} 
          color="amber" 
        />
        <StatCard 
          title="Declaraciones Finalizadas" 
          value={directorDeptoStats?.contadores?.declaracionesFinalizadas ?? 0} 
          subtitle="Aprobadas" 
          icon={CheckCircle2} 
          color="cyan" 
        />
        <StatCard 
          title="Cobertura de Cursos" 
          value={`${directorDeptoStats?.contadores?.gruposAsignados ?? 0}/${directorDeptoStats?.contadores?.grupos ?? 0}`} 
          subtitle="Grupos" 
          icon={TrendingUp} 
          color="violet" 
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-xl border border-border bg-white p-6 shadow-sm">
          <h2 className="text-sm font-bold text-text-main uppercase tracking-wider mb-4">Carga Horaria por Docente</h2>
          <div className="h-[300px] min-h-[300px] w-full">
            {directorDeptoStats?.cargaDocente?.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={directorDeptoStats.cargaDocente}>
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID_COLOR} vertical={false} />
                  <XAxis dataKey="nombre" stroke={CHART_AXIS_COLOR} fontSize={10} tickLine={false} axisLine={false} angle={-45} textAnchor="end" height={60} />
                  <YAxis stroke={CHART_AXIS_COLOR} fontSize={11} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={CHART_TOOLTIP_STYLE} labelStyle={CHART_TOOLTIP_LABEL_STYLE} />
                  <Bar dataKey="horasLectivas" name="Lectiva" fill="#1e40af" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="horasNoLectivas" name="No Lectiva" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-text-sub font-medium">
                Sin datos de carga docente
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-xl border border-border bg-white p-6 shadow-sm">
            <h2 className="text-sm font-bold text-text-main uppercase tracking-wider mb-4">Cumplimiento de Declaraciones</h2>
            <div className="space-y-4">
              {directorDeptoStats?.cargaDocente?.map((docente: any) => (
                <div key={docente.nombre} className="space-y-2">
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="text-text-main">{docente.nombre}</span>
                    <span className={docente.declaracionCompletada ? 'text-emerald-500' : 'text-amber-500'}>
                      {docente.declaracionCompletada ? 'Completada' : 'Pendiente'}
                    </span>
                  </div>
                  <div className="relative h-2 w-full bg-slate-100 rounded-full overflow-hidden border border-border">
                    <div 
                      className={`absolute top-0 left-0 h-full transition-all duration-500 ${docente.declaracionCompletada ? 'bg-emerald-500' : 'bg-amber-500'}`}
                      style={{ width: `${docente.declaracionCompletada ? 100 : 50}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-primary/20 bg-primary-light p-6">
            <h2 className="text-sm font-bold text-primary mb-4 uppercase tracking-wider">Acciones Rápidas</h2>
            <div className="space-y-2">
              <Link 
                href="/carga-lectiva"
                className="flex items-center justify-between w-full px-4 py-3 bg-white hover:bg-slate-50 text-text-main rounded-xl text-xs font-bold transition-all border border-border"
              >
                Asignar Carga Lectiva
                <ArrowRight className="h-3.5 w-3.5 text-primary" />
              </Link>
              <Link 
                href="/declaraciones"
                className="flex items-center justify-between w-full px-4 py-3 bg-white hover:bg-slate-50 text-text-main rounded-xl text-xs font-bold transition-all border border-border"
              >
                Aprobar Declaraciones
                <ArrowRight className="h-3.5 w-3.5 text-primary" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SecretariaDeptoDashboard({
  stats,
  docenteStats,
}: {
  stats: any;
  docenteStats: any;
}) {
  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-main">Panel de Secretaría de Departamento</h1>
          <p className="text-sm text-text-sub mt-1">Gestión de carga académica departamental</p>
        </div>
        <div className="flex gap-3">
          <Link href="/carga-lectiva" className="btn-primary">
            Asignar Carga
          </Link>
          <Link href="/asignacion" className="btn-secondary">
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

function DocenteDashboard({
  user,
  personalDocente,
}: {
  user: any;
  personalDocente: any;
}) {
  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-main">Mi Panel Docente</h1>
          <p className="text-sm text-text-sub mt-1">Hola, {user?.nombre} · {personalDocente?.docente?.tipo ?? 'Docente'}</p>
        </div>
        <div className="flex gap-3">
          <Link href="/disponibilidad" className="btn-primary">
            Gestionar Disponibilidad
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard
          title="Carga Lectiva"
          value={`${personalDocente?.workload ?? 0} hrs`}
          subtitle={`${personalDocente?.limits?.min ?? 0}-${personalDocente?.limits?.max ?? 0} hrs requeridas`}
          icon={Clock}
          color="indigo"
        />
        <StatCard
          title="Cursos Asignados"
          value={personalDocente?.coursesCount ?? 0}
          subtitle="Semestre actual"
          icon={BookOpen}
          color="emerald"
        />
        <StatCard
          title="Estado Carga"
          value={personalDocente && personalDocente.workload >= personalDocente.limits.min ? 'Completa' : 'Pendiente'}
          subtitle={personalDocente && personalDocente.workload >= personalDocente.limits.min ? 'Cumple con el mínimo' : 'Faltan horas'}
          icon={TrendingUp}
          color={personalDocente && personalDocente.workload >= personalDocente.limits.min ? 'emerald' : 'amber'}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 rounded-xl border border-border bg-white p-6 shadow-sm">
          <h2 className="text-sm font-bold text-text-main mb-4">Mis Horarios Asignados</h2>
          {personalDocente?.assignments?.length > 0 ? (
            <div className="space-y-3">
              {personalDocente.assignments.map((a: any) => (
                <div key={a.id} className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-border hover:border-primary/20 transition-all">
                  <div>
                    <p className="text-sm font-bold text-text-main">{a.grupo?.curso?.nombre || 'Curso sin nombre'}</p>
                    <p className="text-xs text-text-sub font-medium">Grupo {a.grupo?.nombre || '-'} · {a.aula?.codigo || 'Sin aula'}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-bold text-primary">{a.franjaHoraria?.dia}</p>
                    <p className="text-[10px] text-text-sub font-semibold">{a.franjaHoraria?.horaInicio}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-12 text-center text-text-sub font-medium">No tienes horarios registrados</div>
          )}
        </div>
        
        <div className="rounded-xl border border-border bg-slate-50 p-6 flex flex-col items-center justify-center text-center">
          <TrendingUp className="h-12 w-12 text-primary/20 mb-4" />
          <h3 className="text-text-main font-bold text-sm">¿Buscas más cursos?</h3>
          <p className="text-xs text-text-sub font-medium mt-2 max-w-xs leading-relaxed">
            Recuerda que puedes postular a nuevos cursos en el módulo de Cursos según tu categoría docente.
          </p>
        </div>
      </div>
    </div>
  );
}

function GuestDashboard({
  periodoActivo,
  docenteStats,
  stats,
}: {
  periodoActivo: any;
  docenteStats: any;
  stats: any;
}) {
  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-text-main tracking-tight">Sistema de Gestión de Horarios</h1>
          <p className="text-text-sub mt-2 max-w-2xl text-sm font-medium">
            Bienvenido a la plataforma de horarios de la Escuela de Ingeniería de Sistemas — UNT. 
            Como invitado, puede consultar la programación académica, docentes y disponibilidad de ambientes.
          </p>
        </div>
        <Link href="/login" className="btn-primary !px-6 !py-3 font-bold flex items-center gap-2">
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
          <div className="rounded-2xl border border-border bg-white p-8 shadow-sm">
            <h2 className="text-xl font-bold text-text-main mb-6">Módulos Disponibles para Consulta</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                { title: 'Horarios', desc: 'Consulte el horario por ciclo, aula o docente.', icon: Calendar, href: '/horarios', color: 'bg-primary/5 text-primary border-primary/10' },
                { title: 'Docentes', desc: 'Directorio y perfiles académicos.', icon: Users, href: '/docentes', color: 'bg-info/5 text-info border-info/10' },
                { title: 'Cursos', desc: 'Mallas curriculares y planes de estudio.', icon: BookOpen, href: '/cursos', color: 'bg-success/5 text-success border-success/10' },
                { title: 'Aulas', desc: 'Ubicación y aforo de ambientes.', icon: Clock, href: '/aulas', color: 'bg-warning/5 text-warning border-warning/10' },
              ].map((mod) => (
                <Link key={mod.title} href={mod.href} className="group p-5 rounded-xl border border-border bg-slate-50 hover:bg-white hover:shadow-md transition-all">
                  <div className={`h-10 w-10 ${mod.color} border rounded-lg flex items-center justify-center mb-4`}>
                    <mod.icon className="h-5 w-5" />
                  </div>
                  <h3 className="text-text-main font-bold group-hover:text-primary transition-colors text-sm">{mod.title}</h3>
                  <p className="text-xs text-text-sub font-medium mt-1 leading-relaxed">{mod.desc}</p>
                </Link>
              ))}
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-white p-6 shadow-sm space-y-6">
          <h2 className="text-lg font-bold text-text-main">Información de Contacto</h2>
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-slate-50 border border-border">
              <p className="text-[10px] font-bold text-text-sub uppercase tracking-wider mb-1">Secretaría Académica</p>
              <p className="text-xs font-bold text-text-main">Pabellón de Ingeniería de Sistemas</p>
              <p className="text-xs font-bold text-primary mt-1">secretaria.sistemas@unt.edu.pe</p>
            </div>
            <div className="p-4 rounded-xl bg-slate-50 border border-border">
              <p className="text-[10px] font-bold text-text-sub uppercase tracking-wider mb-1">Horario de Atención</p>
              <p className="text-xs font-bold text-text-main">Lunes a Viernes</p>
              <p className="text-xs font-bold text-text-main mt-0.5">08:00 AM - 02:00 PM</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function AdminDashboard({
  periodoActivo,
  stats,
  docenteStats,
  ocupacionData,
  cargaDocenteData,
  categoriaData,
}: any) {
  return (
    <div className="space-y-8">
      <div className="flex justify-between items-start flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-main">Panel de Administración</h1>
          <p className="text-sm text-text-sub mt-1">
            Periodo activo: {periodoActivo?.nombre ?? 'Ninguno configurado'}
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/asignacion" className="btn-primary !py-1 !px-3 !text-[10px] uppercase">
            Módulo de Asignación
          </Link>
          <span className="px-3 py-1 bg-secondary/10 border border-secondary/20 rounded-full text-[10px] font-bold text-secondary uppercase tracking-widest">
            Vista Avanzada
          </span>
        </div>
      </div>

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
          title="Estado Cobertura"
          value={stats?.totalGrupos ? `${Math.round((stats.gruposAsignados / stats.totalGrupos) * 100)}%` : '0%'}
          subtitle="Avance del semestre"
          icon={TrendingUp}
          color="amber"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-4 rounded-xl border border-primary/20 bg-primary-light">
          <h4 className="text-xs font-bold text-primary uppercase mb-2">Resumen Operativo</h4>
          <p className="text-sm text-text-sub font-medium">
            Sistema operando al {(stats?.totalGrupos ? (stats.gruposAsignados / stats.totalGrupos * 100).toFixed(1) : 0)}% de capacidad. 
            Se han registrado {stats?.totalAsignaciones} sesiones de clase.
          </p>
        </div>
        <div className="p-4 rounded-xl border border-success/20 bg-success/5">
          <h4 className="text-xs font-bold text-success uppercase mb-2">Ambientes</h4>
          <p className="text-sm text-text-sub font-medium">
            Promedio de ocupación general: {ocupacionData?.length ? (ocupacionData.reduce((acc: number, curr: any) => acc + curr.ocupacion, 0) / ocupacionData.length).toFixed(1) : 0}% 
            en {ocupacionData?.length} aulas activas.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-xl border border-border bg-white p-6 shadow-sm">
          <h2 className="text-sm font-bold text-text-main mb-4">Docentes por Categoría</h2>
          <div className="h-[250px] min-h-[250px] w-full">
            {categoriaData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
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
                    {categoriaData.map((_: any, i: number) => (
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
              <div className="h-full flex items-center justify-center text-text-sub font-medium">
                Sin datos
              </div>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-white p-6 shadow-sm">
          <h2 className="text-sm font-bold text-text-main mb-4">Ocupación de Aulas (%)</h2>
          <div className="h-[250px] min-h-[250px] w-full">
            {ocupacionData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={ocupacionData}>
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID_COLOR} />
                  <XAxis dataKey="nombre" stroke={CHART_AXIS_COLOR} fontSize={11} />
                  <YAxis stroke={CHART_AXIS_COLOR} fontSize={11} domain={[0, 100]} />
                  <Tooltip
                    contentStyle={CHART_TOOLTIP_STYLE}
                    labelStyle={CHART_TOOLTIP_LABEL_STYLE}
                  />
                  <Bar dataKey="ocupacion" fill="#1e40af" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-text-sub font-medium">
                Genere un horario para ver la ocupación
              </div>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-white p-6 shadow-sm lg:col-span-2">
          <h2 className="text-sm font-bold text-text-main mb-4">
             Carga Docente Detallada (Top 15)
          </h2>
          <div className="h-[400px] min-h-[400px] w-full">
            {cargaDocenteData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={cargaDocenteData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID_COLOR} />
                  <XAxis type="number" stroke={CHART_AXIS_COLOR} fontSize={11} />
                  <YAxis type="category" dataKey="nombre" stroke={CHART_AXIS_COLOR} fontSize={11} width={120} />
                  <Tooltip
                    contentStyle={CHART_TOOLTIP_STYLE}
                    labelStyle={CHART_TOOLTIP_LABEL_STYLE}
                  />
                  <Bar dataKey="horas" fill="#0284c7" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-text-sub font-medium">
                Genere un horario para ver la carga docente
              </div>
            )}
          </div>
        </div>
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
  const isDirectorDepto = user?.role === 'DIRECTOR_DEPARTAMENTO';
  const isSecretariaDepto = user?.role === 'SECRETARIA_DEPARTAMENTO';

  const decanoStats = useQuery({
    ...trpc.reporte.getDecanoStats.queryOptions({ periodoId: periodoActivo?.id }),
    enabled: isDecano || isAdmin,
  });

  const directorEscuelaStats = useQuery({
    ...trpc.reporte.getDirectorEscuelaStats.queryOptions({ periodoId: periodoActivo?.id }),
    enabled: isDirector || isAdmin,
  });

  const jefeDeptoStats = useQuery({
    ...trpc.reporte.getJefeDepartamentoStats.queryOptions({ periodoId: periodoActivo?.id }),
    enabled: isDirectorDepto || isAdmin,
  });

  const horarioStats = useQuery({
    ...trpc.horario.stats.queryOptions({ periodoId: periodoActivo?.id ?? '' }),
    enabled: !!periodoActivo?.id && user?.role !== 'DOCENTE' && user?.role !== 'INVITADO',
  });

  const aulaStats = useQuery({
    ...trpc.aula.stats.queryOptions({ periodoId: periodoActivo?.id ?? '' }),
    enabled: !!periodoActivo?.id && user?.role !== 'DOCENTE' && user?.role !== 'INVITADO',
  });

  const stats = horarioStats.data;
  const aulasData = aulaStats.data?.ocupacionPorAula;

  // Chart data formatting
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

  // Guest View
  if (!user) {
    return (
      <GuestDashboard 
        periodoActivo={periodoActivo} 
        docenteStats={docenteStats} 
        stats={stats} 
      />
    );
  }

  // Unified Dashboard Layout
  return (
    <div className="space-y-8">
      {/* Role-Specific Content */}
      {isSecretaria && (
        <SecretariaDashboard
          docenteStats={docenteStats}
          stats={stats}
          ocupacionData={ocupacionData}
          cargaDocenteData={cargaDocenteData}
          categoriaData={categoriaData}
        />
      )}

      {isDirector && (
        <DirectorDashboard
          periodoActivo={periodoActivo}
          stats={stats}
          docenteStats={docenteStats}
          ocupacionData={ocupacionData}
          categoriaData={categoriaData}
          cargaDocenteData={cargaDocenteData}
          startAssignmentProcessMutation={startAssignmentProcessMutation}
          directorStats={directorEscuelaStats.data}
        />
      )}

      {isDecano && (
        <DecanoDashboard
          dStats={decanoStats.data}
          periodoActivo={periodoActivo}
        />
      )}

      {isDirectorDepto && (
        <DirectorDeptoDashboard
          directorDeptoStats={jefeDeptoStats.data}
        />
      )}

      {isSecretariaDepto && (
        <SecretariaDeptoDashboard
          stats={stats}
          docenteStats={docenteStats}
        />
      )}

      {user.role === 'DOCENTE' && (
        <DocenteDashboard
          user={user}
          personalDocente={personalDocente}
        />
      )}

      {isAdmin && (
        <AdminDashboard
          periodoActivo={periodoActivo}
          stats={stats}
          docenteStats={docenteStats}
          ocupacionData={ocupacionData}
          cargaDocenteData={cargaDocenteData}
          categoriaData={categoriaData}
        />
      )}
    </div>
  );
}
