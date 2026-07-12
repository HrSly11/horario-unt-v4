import 'dotenv/config';
import { PrismaClient } from '../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

async function main() {
  const d = await prisma.docente.findFirst({ where: { nombre: { contains: 'Cesar Arellano' } } });
  if (!d) { console.log('No encontrado'); return; }

  // 2026-I tiene: 7h lect + 19h no lect = 26h. Faltan 14h.
  // Ajustes:
  // - INVESTIGACION: 8h -> 16h (+8h)
  // - PREPARACION_EVALUACION: 6h -> 10h (+4h)  
  // - CONSEJERIA: 3h -> 5h (+2h)
  // Total: +14h -> 40h (100%)

  const noLectivas = await prisma.cargaNoLectiva.findMany({
    where: { docenteId: d.id, periodo: { nombre: '2026-I' } }
  });

  for (const n of noLectivas) {
    if (n.tipo === 'INVESTIGACION') {
      await prisma.cargaNoLectiva.update({ where: { id: n.id }, data: { horas: 16 } });
      console.log('INVESTIGACION: 8h -> 16h (+8h)');
    } else if (n.tipo === 'PREPARACION_EVALUACION') {
      await prisma.cargaNoLectiva.update({ where: { id: n.id }, data: { horas: 10 } });
      console.log('PREPARACION_EVALUACION: 6h -> 10h (+4h)');
    } else if (n.tipo === 'CONSEJERIA') {
      await prisma.cargaNoLectiva.update({ where: { id: n.id }, data: { horas: 5 } });
      console.log('CONSEJERIA: 3h -> 5h (+2h)');
    }
  }

  // Verificar
  const lectivas = await prisma.asignacionCargaLectiva.findMany({
    where: { docenteId: d.id, periodo: { nombre: '2026-I' } }
  });
  const nl = await prisma.cargaNoLectiva.findMany({
    where: { docenteId: d.id, periodo: { nombre: '2026-I' } }
  });
  const tl = lectivas.reduce((s: number, a: { horasAsignadas: number }) => s + a.horasAsignadas, 0);
  const tn = nl.reduce((s: number, n: { horas: number }) => s + n.horas, 0);
  console.log(`\n=== RESULTADO 2026-I ===`);
  console.log(`Lectivas: ${tl}h | No Lectivas: ${tn}h | Total: ${tl + tn}h/40h (${Math.round((tl+tn)/40*100)}%)`);
  console.log(`\nLogin: carellano@unitru.edu.pe / docente123`);

  await prisma.$disconnect();
}
main();
