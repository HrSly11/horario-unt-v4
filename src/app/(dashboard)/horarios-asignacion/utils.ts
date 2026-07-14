export type ManualScheduleOption = {
  cargaLectivaId: string;
  docenteId: string;
  docenteNombre: string;
  grupoId: string;
  grupoNombre: string;
  tipo: 'TEORIA' | 'PRACTICA' | 'LABORATORIO';
  horasAsignadas: number;
  grupoLaboratorio?: number | null;
  rol: string;
  scheduledBlocks: number;
  remainingBlocks: number;
  curso: { id: string; codigo: string; nombre: string; ciclo: number };
  escuela?: { id: string; nombre: string } | null;
};

export function resolveManualOptionStatus(option: Pick<ManualScheduleOption, 'remainingBlocks' | 'scheduledBlocks' | 'horasAsignadas'>) {
  if (option.remainingBlocks <= 0) {
    return {
      label: 'Completo',
      badgeClass: 'badge badge-success',
      disabled: true,
    };
  }

  return {
    label: `${option.remainingBlocks} ${option.remainingBlocks === 1 ? 'bloque pendiente' : 'bloques pendientes'}`,
    badgeClass: 'badge badge-warning',
    disabled: false,
  };
}
