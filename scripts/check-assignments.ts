
import 'dotenv/config';
import { PrismaClient } from '../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

const connectionString = process.env.DATABASE_URL!;
const pool = new pg.Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Checking Asignacions for period 2026-I...');
  
  // First, find 2026-I period
  const period = await prisma.periodoAcademico.findFirst({ where: { nombre: '2026-I' } });
  if (!period) {
    console.log('Periodo 2026-I not found!');
    return;
  }

  console.log('Period 2026-I ID:', period.id);

  // Get all assignments for this period
  const assignments = await prisma.asignacion.findMany({
    where: { periodoId: period.id },
    include: {
      docente: true,
      aula: true,
      grupo: { include: { curso: true } },
      franjaHoraria: true,
    },
  });

  console.log('\n=== Found', assignments.length, 'Asignacions! ===');
  assignments.forEach(a => {
    console.log(`
Curso: ${a.grupo?.curso?.nombre} (${a.grupo?.curso?.codigo}) Grupo: ${a.grupo?.nombre}
Docente: ${a.docente?.nombre}
Aula: ${a.aula?.nombre} (${a.aula?.codigo})
Franja: ${a.franjaHoraria?.dia} ${a.franjaHoraria?.horaInicio} - ${a.franjaHoraria?.horaFin}
Tipo: ${a.tipo}
Confirmado: ${a.confirmado}`);
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
