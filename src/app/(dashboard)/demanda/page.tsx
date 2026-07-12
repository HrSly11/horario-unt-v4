'use client';

import { useState, useMemo } from 'react';
import { useTRPC } from '@/trpc/client';
import { useQuery } from '@tanstack/react-query';
import DemandaEscuelaPage from '../demanda-escuela/page';
import DemandaDepartamentoPage from '../demanda-departamento/page';
import { FileText } from 'lucide-react';

export default function DemandaPage() {
  const trpc = useTRPC();
  const { data: user } = useQuery({ ...trpc.auth.me.queryOptions() });

  const role = user?.role;

  // Determine default tab and available tabs based on role
  const defaultTab = useMemo(() => {
    if (role === 'DIRECTOR_ESCUELA' || role === 'SECRETARIA_ACADEMICA') {
      return 'escuela';
    } else if (role === 'DIRECTOR_DEPARTAMENTO' || role === 'SECRETARIA_DEPARTAMENTO') {
      return 'departamento';
    }
    // Admin and others default to escuela
    return 'escuela';
  }, [role]);

  const [activeTab, setActiveTab] = useState(defaultTab);

  // Determine which tabs are visible
  const showEscuelaTab = 
    role === 'ADMIN' || 
    role === 'DIRECTOR_ESCUELA' || 
    role === 'SECRETARIA_ACADEMICA';

  const showDepartamentoTab = 
    role === 'ADMIN' || 
    role === 'DIRECTOR_DEPARTAMENTO' || 
    role === 'SECRETARIA_DEPARTAMENTO';

  return (
    <div className="space-y-6">
      {/* Tabs Navigation */}
      <div className="flex gap-2 border-b border-border">
        {showEscuelaTab && (
          <button
            onClick={() => setActiveTab('escuela')}
            className={`
              px-4 py-3 text-sm font-medium border-b-2 transition-colors
              ${activeTab === 'escuela'
                ? 'border-primary text-primary'
                : 'border-transparent text-text-sub hover:text-text-main hover:border-border'
              }
            `}
          >
            Demanda Escolar
          </button>
        )}
        {showDepartamentoTab && (
          <button
            onClick={() => setActiveTab('departamento')}
            className={`
              px-4 py-3 text-sm font-medium border-b-2 transition-colors
              ${activeTab === 'departamento'
                ? 'border-primary text-primary'
                : 'border-transparent text-text-sub hover:text-text-main hover:border-border'
              }
            `}
          >
            Demanda Departamento
          </button>
        )}
      </div>

      {/* Tab Content */}
      <div>
        {activeTab === 'escuela' && <DemandaEscuelaPage />}
        {activeTab === 'departamento' && <DemandaDepartamentoPage />}
      </div>
    </div>
  );
}
