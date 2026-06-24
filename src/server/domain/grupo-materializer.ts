import type { PrismaClient } from '@/generated/prisma/client';

/**
 * Tipo compatible con el cliente Prisma raíz y con clientes transaccionales.
 * Ambos exponen el mismo delegado `grupo` con la API necesaria.
 */
type PrismaExecutor = Pick<PrismaClient, 'grupo'>;

/**
 * Materializa los `Grupo` necesarios para un curso en un periodo académico.
 *
 * Semántica del modelo (alineada con el comentario de producto):
 * - GRUPO define el número de secciones para teoría y práctica. Por defecto
 *   se crea una sección "A".
 * - `numGruposLaboratorio` define los turnos de laboratorio POR sección,
 *   materializados como "Lab-1", "Lab-2", ..., "Lab-N".
 *
 * Idempotente: respeta el unique `@@unique([cursoId, nombre, periodoAcademicoId])`
 * y nunca duplica filas existentes. Si se pasa `demandaLineaId`, asocia los
 * grupos a esa línea cuando aún no estén vinculados.
 */
export async function materializeGruposForCurso(
  prisma: PrismaExecutor,
  args: {
    cursoId: string;
    periodoId: string;
    numGruposLaboratorio: number;
    demandaLineaId?: string | null;
  }
): Promise<Array<{ id: string; nombre: string; seccion: string | null }>> {
  const { cursoId, periodoId, numGruposLaboratorio, demandaLineaId } = args;
  const safeNumGrupos =
    Number.isFinite(numGruposLaboratorio) && numGruposLaboratorio > 0
      ? Math.floor(numGruposLaboratorio)
      : 1;

  const existing = await prisma.grupo.findMany({
    where: { cursoId, periodoAcademicoId: periodoId },
    select: { id: true, nombre: true, seccion: true },
    orderBy: { nombre: 'asc' },
  });

  const existingNames = new Set(existing.map((g) => g.nombre));
  const created: Array<{ id: string; nombre: string; seccion: string | null }> = [];

  // 1. Sección principal "A" (teoría y práctica)
  if (!existingNames.has('A')) {
    const grupo = await prisma.grupo.create({
      data: {
        nombre: 'A',
        seccion: 'A',
        cursoId,
        periodoAcademicoId: periodoId,
        demandaLineaId: demandaLineaId ?? null,
      },
      select: { id: true, nombre: true, seccion: true },
    });
    created.push(grupo);
    existingNames.add('A');
  } else if (demandaLineaId) {
    // Vincular a la línea de demanda si aún no lo está
    await prisma.grupo.updateMany({
      where: {
        cursoId,
        periodoAcademicoId: periodoId,
        nombre: 'A',
        demandaLineaId: null,
      },
      data: { demandaLineaId },
    });
  }

  // 2. Turnos de laboratorio: "Lab-1", "Lab-2", ..., "Lab-N"
  if (safeNumGrupos > 1) {
    for (let i = 1; i <= safeNumGrupos; i++) {
      const labNombre = `Lab-${i}`;
      if (!existingNames.has(labNombre)) {
        const grupo = await prisma.grupo.create({
          data: {
            nombre: labNombre,
            seccion: labNombre,
            cursoId,
            periodoAcademicoId: periodoId,
            demandaLineaId: demandaLineaId ?? null,
          },
          select: { id: true, nombre: true, seccion: true },
        });
        created.push(grupo);
        existingNames.add(labNombre);
      } else if (demandaLineaId) {
        await prisma.grupo.updateMany({
          where: {
            cursoId,
            periodoAcademicoId: periodoId,
            nombre: labNombre,
            demandaLineaId: null,
          },
          data: { demandaLineaId },
        });
      }
    }
  }

  return created;
}

/**
 * Materializa los `Grupo` para todas las líneas de demanda de un periodo que
 * aún no tengan grupos asociados. Pensado para scripts de remediación.
 */
export async function materializeGruposForPeriodoDemandas(
  prisma: PrismaClient,
  periodoId: string
): Promise<{ lineasEvaluadas: number; lineasRemediadas: number; gruposCreados: number }> {
  const lineas = await prisma.demandaLinea.findMany({
    where: { demanda: { periodoId } },
    select: {
      id: true,
      cursoId: true,
      numGruposLaboratorio: true,
    },
  });

  let lineasRemediadas = 0;
  let gruposCreados = 0;

  for (const linea of lineas) {
    const existing = await prisma.grupo.count({
      where: { cursoId: linea.cursoId, periodoAcademicoId: periodoId },
    });
    if (existing > 0) continue;

    const created = await materializeGruposForCurso(prisma, {
      cursoId: linea.cursoId,
      periodoId,
      numGruposLaboratorio: linea.numGruposLaboratorio,
      demandaLineaId: linea.id,
    });
    gruposCreados += created.length;
    lineasRemediadas += 1;
  }

  return { lineasEvaluadas: lineas.length, lineasRemediadas, gruposCreados };
}
