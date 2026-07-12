import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { PrismaClient, UserRole } from '../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

async function main() {
  const d = await prisma.docente.findFirst({ where: { nombre: { contains: 'Juan Pedro' } } });
  if (!d) { console.log('Docente no encontrado'); return; }

  const email = 'jsantos@unitru.edu.pe';
  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) {
    console.log('Ya existe usuario ' + email + ' (password: docente123)');
    return;
  }

  const hash = await bcrypt.hash('docente123', 10);
  await prisma.user.create({
    data: { email, password: hash, nombre: d.nombre, role: UserRole.DOCENTE, docenteId: d.id }
  });
  console.log('Creado: ' + email + ' / docente123 (DOCENTE)');
  console.log('Tambien disponible: dirsistemas@unt.edu.pe / admin123 (DIRECTOR_DEPARTAMENTO)');

  await prisma.$disconnect();
}
main();
