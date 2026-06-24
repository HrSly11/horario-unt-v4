/**
 * Script de remediación: materializa los `Grupo` (sección "A" + Lab-1..Lab-N)
 * para todas las `DemandaLinea` existentes que aún no tengan grupos asociados.
 *
 * Ejecutar con:  npx tsx scripts/remediate-grupos.ts [periodoId]
 *
 * - Sin argumentos: procesa TODOS los periodos académicos con líneas de demanda.
 * - Con periodoId: procesa únicamente el periodo indicado.
 *
 * Semántica:
 * - GRUPO define el número de secciones para teoría y práctica. Por defecto
 *   se crea una sección "A".
 * - `numGruposLaboratorio` define los turnos de laboratorio POR sección,
 *   materializados como "Lab-1", "Lab-2", ..., "Lab-N".
 *
 * El script es idempotente: respeta el unique
 *   @@unique([cursoId, nombre, periodoAcademicoId])
 * y nunca duplica filas existentes.
 */
import 'dotenv/config';
import { PrismaClient } from '../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import {
  materializeGruposForPeriodoDemandas,
  materializeGruposForCurso,
} from '../src/server/domain/grupo-materializer';

async function main() {
  const args = process.argv.slice(2);
  const periodoArg = args[0];

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('DATABASE_URL no está definido en el entorno.');
    process.exit(1);
  }
  const pool = new pg.Pool({ connectionString });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  try {
    const periodos = periodoArg
      ? await prisma.periodoAcademico.findMany({ where: { id: periodoArg } })
      : await prisma.periodoAcademico.findMany();

    // Si no se proporcionó periodoId, filtrar a los que tengan líneas de demanda.
    const periodosConLineas = periodoArg
      ? periodos
      : await filterPeriodosConDemanda(prisma, periodos);

    if (periodos.length === 0) {
      console.log('No hay periodos con líneas de demanda para remediar.');
      return;
    }

    let totalLineasEvaluadas = 0;
    let totalLineasRemediadas = 0;
    let totalGruposCreados = 0;

    for (const periodo of periodosConLineas) {
      console.log(`\n[Periodo ${periodo.id} - ${periodo.nombre}] Procesando…`);

      // 1) Remediación por línea de demanda (cubre líneas nuevas tras aprobación)
      const resumen = await materializeGruposForPeriodoDemandas(prisma, periodo.id);
      totalLineasEvaluadas += resumen.lineasEvaluadas;
      totalLineasRemediadas += resumen.lineasRemediadas;
      totalGruposCreados += resumen.gruposCreados;

      // 2) Cursos aperturados sin demanda asociada: crear Grupo "A" + Lab-N
      const cursosAperturados = await prisma.curso.findMany({
        where: {
          aperturado: true,
          grupos: { none: { periodoAcademicoId: periodo.id } },
          departamentoId: { not: null },
        },
        select: {
          id: true,
          codigo: true,
          nombre: true,
          numGruposLaboratorio: true,
          horasLaboratorio: true,
        },
      });

      for (const curso of cursosAperturados) {
        const numGrupos =
          curso.numGruposLaboratorio > 0
            ? curso.numGruposLaboratorio
            : curso.horasLaboratorio > 0
              ? 3
              : 1;
        const created = await materializeGruposForCurso(prisma, {
          cursoId: curso.id,
          periodoId: periodo.id,
          numGruposLaboratorio: numGrupos,
        });
        if (created.length > 0) {
          console.log(
            `  - Curso ${curso.codigo} (${curso.nombre}): ${created.length} Grupo(s) creado(s).`
          );
          totalGruposCreados += created.length;
          totalLineasRemediadas += 1;
        }
      }

      console.log(
        `  → líneas evaluadas: ${resumen.lineasEvaluadas}, remedidadas: ${resumen.lineasRemediadas}, grupos creados: ${resumen.gruposCreados}`
      );
    }

    console.log('\n=== Resumen de remediación ===');
    console.log(`Periodos procesados:     ${periodosConLineas.length}`);
    console.log(`Líneas evaluadas:        ${totalLineasEvaluadas}`);
    console.log(`Líneas remedidadas:      ${totalLineasRemediadas}`);
    console.log(`Grupos materializados:   ${totalGruposCreados}`);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

async function filterPeriodosConDemanda(
  prisma: import('../src/generated/prisma/client').PrismaClient,
  periodos: Array<{ id: string; nombre: string }>
): Promise<Array<{ id: string; nombre: string }>> {
  const result: Array<{ id: string; nombre: string }> = [];
  for (const periodo of periodos) {
    const count = await prisma.demandaLinea.count({
      where: { demanda: { periodoId: periodo.id } },
    });
    if (count > 0) result.push(periodo);
  }
  return result;
}

main().catch((err) => {
  console.error('Error durante la remediación de grupos:', err);
  process.exit(1);
});
