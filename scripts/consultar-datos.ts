import 'dotenv/config';
import { PrismaClient } from '../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

const connectionString = process.env.DATABASE_URL!;
const pool = new pg.Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('=== CURSOS ===');
  const cursos = await prisma.curso.findMany();
  cursos.forEach(c => console.log(`${c.codigo} - ${c.nombre} (Ciclo ${c.ciclo})`));

  console.log('\n=== DOCENTES ===');
  const docentes = await prisma.docente.findMany();
  docentes.forEach(d => console.log(`${d.email} - ${d.nombre}`));

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
