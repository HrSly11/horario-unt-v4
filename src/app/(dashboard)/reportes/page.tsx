'use client';

import { useTRPC } from '@/trpc/client';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import {
  FileText, Download, Building2, FlaskConical, User,
  BarChart3, Loader2,
} from 'lucide-react';

const REPORT_TYPES = [
  {
    id: 'por-aula' as const,
    name: 'Horario por Aulas',
    description: 'Grilla horaria de cada aula de teoría con cursos asignados',
    icon: Building2,
    color: 'indigo',
    type: 'Operacional',
  },
  {
    id: 'por-laboratorio' as const,
    name: 'Horario por Laboratorios',
    description: 'Grilla horaria de cada laboratorio con prácticas asignadas',
    icon: FlaskConical,
    color: 'purple',
    type: 'Operacional',
  },
  {
    id: 'por-docente' as const,
    name: 'Horario por Docente',
    description: 'Horario individual de cada docente con sus cursos y ambientes',
    icon: User,
    color: 'cyan',
    type: 'Operacional',
  },
  {
    id: 'gestion' as const,
    name: 'Reporte de Gestión',
    description: 'Resumen ejecutivo: cobertura, carga docente, ocupación de ambientes',
    icon: BarChart3,
    color: 'emerald',
    type: 'Gestión',
  },
];

const COLOR_MAP: Record<string, string> = {
  indigo: 'bg-indigo-50 border-indigo-200 text-indigo-700 hover:border-indigo-400 hover:bg-indigo-100 shadow-sm',
  purple: 'bg-purple-50 border-purple-200 text-purple-700 hover:border-purple-400 hover:bg-purple-100 shadow-sm',
  cyan: 'bg-cyan-50 border-cyan-200 text-cyan-700 hover:border-cyan-400 hover:bg-cyan-100 shadow-sm',
  emerald: 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:border-emerald-400 hover:bg-emerald-100 shadow-sm',
};

const ICON_BG_MAP: Record<string, string> = {
  indigo: 'bg-indigo-600 text-white',
  purple: 'bg-purple-600 text-white',
  cyan: 'bg-cyan-600 text-white',
  emerald: 'bg-emerald-600 text-white',
};

function downloadBase64PDF(base64: string, filename: string) {
  const byteCharacters = atob(base64);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  const blob = new Blob([byteArray], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export default function ReportesPage() {
  const trpc = useTRPC();
  const [generating, setGenerating] = useState<string | null>(null);

  const { data: user } = useQuery({ ...trpc.auth.me.queryOptions() });
  const { data: periodoActivo } = useQuery({ ...trpc.periodo.active.queryOptions() });

  const generateMutation = useMutation(
    trpc.reporte.generatePDF.mutationOptions({
      onSuccess: (data) => {
        downloadBase64PDF(data.pdf, data.filename);
        setGenerating(null);
      },
      onError: () => {
        setGenerating(null);
        alert('Error al generar el reporte. Verifique que haya asignaciones en el periodo activo.');
      },
    })
  );

  const handleGenerate = (tipo: typeof REPORT_TYPES[number]['id']) => {
    if (!periodoActivo) return;
    setGenerating(tipo);
    generateMutation.mutate({ periodoId: periodoActivo.id, tipo });
  };

  const isAuthorized = user?.role === 'ADMIN' || user?.role === 'SECRETARIA_ACADEMICA' || user?.role === 'DIRECTOR_ESCUELA';

  if (!isAuthorized) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
        <div className="h-16 w-16 bg-red-500/10 rounded-full flex items-center justify-center mb-4">
          <FileText className="h-8 w-8 text-red-400" />
        </div>
        <h2 className="text-xl font-bold text-white">Acceso Restringido</h2>
        <p className="text-gray-500 mt-2 max-w-sm">
          No tiene permisos suficientes para acceder al módulo de reportes institucionales.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Reportes</h1>
        <p className="text-sm text-gray-500 mt-1">
          Genere reportes PDF del periodo {periodoActivo?.nombre ?? '(sin periodo activo)'}
        </p>
      </div>

      {!periodoActivo ? (
        <div className="rounded-xl border border-gray-800 bg-gray-900 p-12 text-center text-gray-600">
          Configure un periodo académico activo para generar reportes
        </div>
      ) : (
        <>
          {/* Operacionales */}
          <div className="mb-8">
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">
              <FileText className="inline h-4 w-4 -mt-0.5 mr-1.5" />
              Reportes Operacionales
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {REPORT_TYPES.filter((r) => r.type === 'Operacional').map((report) => {
                const Icon = report.icon;
                const isGenerating = generating === report.id;

                return (
                  <div
                    key={report.id}
                    className={`rounded-xl border p-6 transition-all cursor-pointer ${COLOR_MAP[report.color]}`}
                    onClick={() => !isGenerating && handleGenerate(report.id)}
                  >
                    <div className="flex items-start justify-between">
                      <div className={`flex h-10 w-10 items-center justify-center rounded-lg shadow-sm ${ICON_BG_MAP[report.color]}`}>
                        <Icon className="h-5 w-5" />
                      </div>
                      {isGenerating ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : (
                        <Download className="h-4 w-4 opacity-70" />
                      )}
                    </div>
                    <h3 className="mt-4 font-bold text-inherit">{report.name}</h3>
                    <p className="mt-1 text-xs text-inherit opacity-80">{report.description}</p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Gestión */}
          <div>
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">
              <BarChart3 className="inline h-4 w-4 -mt-0.5 mr-1.5" />
              Reporte de Gestión
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {REPORT_TYPES.filter((r) => r.type === 'Gestión').map((report) => {
                const Icon = report.icon;
                const isGenerating = generating === report.id;

                return (
                  <div
                    key={report.id}
                    className={`rounded-xl border p-6 transition-all cursor-pointer ${COLOR_MAP[report.color]}`}
                    onClick={() => !isGenerating && handleGenerate(report.id)}
                  >
                    <div className="flex items-start justify-between">
                      <div className={`flex h-10 w-10 items-center justify-center rounded-lg shadow-sm ${ICON_BG_MAP[report.color]}`}>
                        <Icon className="h-5 w-5" />
                      </div>
                      {isGenerating ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : (
                        <Download className="h-4 w-4 opacity-70" />
                      )}
                    </div>
                    <h3 className="mt-4 font-bold text-inherit">{report.name}</h3>
                    <p className="mt-1 text-xs text-inherit opacity-80">{report.description}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
