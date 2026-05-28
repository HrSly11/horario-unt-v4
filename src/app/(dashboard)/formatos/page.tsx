'use client';

import { useTRPC } from '@/trpc/client';
import { useQuery, useMutation } from '@tanstack/react-query';
import { FileDown, FileText, Download } from 'lucide-react';
import { useState } from 'react';

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

export default function FormatosPage() {
  const trpc = useTRPC();
  const { data: user } = useQuery({ ...trpc.auth.me.queryOptions() });
  const { data: periodos = [] } = useQuery({ ...trpc.periodo.list.queryOptions() });
  const periodoId = periodos.length > 0 ? periodos[0].id : '';
  const docenteId = user?.docenteId || '';
  const [loading, setLoading] = useState<string | null>(null);

  const { data: declaracion } = useQuery({
    ...trpc.declaracion.byDocente.queryOptions({ docenteId, periodoId }),
    enabled: !!docenteId && !!periodoId,
  });

  const generatePDFMutation = useMutation(
    trpc.declaracionPDF.generate.mutationOptions({
      onSuccess: (data) => {
        downloadBase64PDF(data.pdfBase64, data.filename);
        setLoading(null);
      },
      onError: () => {
        setLoading(null);
        alert('Error al generar el PDF. Verifique que la declaración tenga carga asignada.');
      },
    })
  );

  const handleDownload = (formato: 'N1' | 'N2' | 'N3') => {
    if (!declaracion) return;
    setLoading(formato);
    generatePDFMutation.mutate({ declaracionId: declaracion.id, formato });
  };

  if (!docenteId) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-6 text-center">
          <h2 className="text-lg font-semibold text-amber-400">Acceso Restringido</h2>
          <p className="text-zinc-400 mt-2">Solo los docentes pueden acceder a los formatos PDF.</p>
        </div>
      </div>
    );
  }

  const formatos = [
    { key: 'N1', label: 'Formato N° 1', desc: 'Declaración de Carga Horaria Asignada' },
    { key: 'N2', label: 'Formato N° 2', desc: 'Declaración Jurada — Sede Central' },
    { key: 'N3', label: 'Formato N° 3', desc: 'Declaración Jurada — Sedes Descentralizadas' },
  ];

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Formatos y Documentos</h1>
        <p className="text-zinc-400 text-sm mt-1">Descarga de formatos institucionales en PDF</p>
      </div>

      {!declaracion ? (
        <div className="bg-zinc-900/80 border border-zinc-800 rounded-lg p-8 text-center">
          <FileText className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
          <p className="text-zinc-400">No tienes una declaración para el periodo actual.</p>
          <p className="text-zinc-500 text-sm mt-1">Crea tu declaración para generar los formatos PDF.</p>
        </div>
      ) : (
        <>
          <div className="bg-zinc-900/80 border border-zinc-800 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-white font-medium">{declaracion.docente.nombre}</div>
                <div className="text-zinc-400 text-sm">Periodo: {declaracion.periodo.nombre}</div>
              </div>
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                declaracion.estado === 'FINALIZADA' ? 'bg-emerald-500/20 text-emerald-400' :
                declaracion.estado === 'RECHAZADA' ? 'bg-red-500/20 text-red-400' :
                'bg-blue-500/20 text-blue-400'
              }`}>
                {declaracion.estado.replace(/_/g, ' ')}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {formatos.map((formato) => (
              <div key={formato.key} className="bg-zinc-900/80 border border-zinc-800 rounded-lg p-4 hover:border-zinc-700 transition-colors">
                <FileDown className="w-8 h-8 text-blue-400 mb-3" />
                <h3 className="text-white font-medium">{formato.label}</h3>
                <p className="text-zinc-400 text-sm mt-1 mb-4">{formato.desc}</p>
                <button
                  onClick={() => handleDownload(formato.key as 'N1' | 'N2' | 'N3')}
                  disabled={loading === formato.key}
                  className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg px-4 py-2 text-sm transition-colors"
                >
                  {loading === formato.key ? (
                    'Generando...'
                  ) : (
                    <>
                      <Download className="w-4 h-4" />
                      Descargar PDF
                    </>
                  )}
                </button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
