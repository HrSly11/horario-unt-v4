import 'dotenv/config';
import { PrismaClient } from '../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

async function main() {
  const users = await prisma.user.findMany({
    include: { docente: true }
  });

  console.log('Usuarios en el sistema:\n');
  for (const u of users) {
    console.log(`Email: ${u.email}`);
    console.log(`  Role: ${u.role}`);
    console.log(`  Nombre: ${u.nombre}`);
    console.log(`  DocenteId: ${u.docenteId ?? 'N/A'}`);
    if (u.docente) console.log(`  Docente: ${u.docente.nombre}`);
    console.log('');
  }

  if (users.length === 0) console.log('NO HAY USUARIOS en la BD.');

  await prisma.$disconnect();
}
main();
