import 'dotenv/config';
import { PrismaClient } from '../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL! });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  // Buscar a Juan Pedro
  const docente = await prisma.docente.findFirst({ where: { nombre: { contains: 'Juan Pedro' } } });
  if (!docente) { console.log('Docente no encontrado'); return; }

  console.log('=== DATOS DE ' + docente.nombre + ' ===');
  console.log('Horas de contrato: ' + docente.horasContrato + 'h');
  console.log('');

  // Carga lectiva
  const lectivas = await prisma.asignacionCargaLectiva.findMany({
    where: { docenteId: docente.id },
    include: { grupo: { include: { curso: true } }, periodo: true }
  });
  const totalLectivas = lectivas.reduce((s, a) => s + a.horasAsignadas, 0);
  console.log('--- CARGA LECTIVA (' + totalLectivas + 'h en ' + lectivas.length + ' asignaciones) ---');
  for (const a of lectivas) {
    console.log('  Curso: ' + a.grupo.curso.nombre);
    console.log('    Tipo: ' + a.tipo + ' | Horas: ' + a.horasAsignadas + ' | Periodo: ' + a.periodo.nombre);
  }

  // Carga no lectiva
  const noLectivas = await prisma.cargaNoLectiva.findMany({
    where: { docenteId: docente.id },
    include: { periodo: true }
  });
  const totalNoLectivas = noLectivas.reduce((s, n) => s + n.horas, 0);
  console.log('\n--- CARGA NO LECTIVA (' + totalNoLectivas + 'h en ' + noLectivas.length + ' registros) ---');
  for (const n of noLectivas) {
    console.log('  Tipo: ' + n.tipo + ' | Horas: ' + n.horas + ' | Periodo: ' + n.periodo.nombre);
    if (n.descripcion) console.log('    Descripcion: ' + n.descripcion);
  }

  const total = totalLectivas + totalNoLectivas;
  const pct = Math.round((total / docente.horasContrato) * 100);
  console.log('\n=== RESUMEN ===');
  console.log('Lectivas: ' + totalLectivas + 'h | No Lectivas: ' + totalNoLectivas + 'h | Total: ' + total + 'h');
  console.log('Contrato: ' + docente.horasContrato + 'h -> ' + pct + '%');
  if (total > docente.horasContrato) {
    console.log('EXCEDENTE: +' + (total - docente.horasContrato) + 'h sobre el contrato');
  }

  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
