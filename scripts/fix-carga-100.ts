import 'dotenv/config';
import { PrismaClient } from '../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

async function main() {
  const d = await prisma.docente.findFirst({ where: { nombre: { contains: 'Juan Pedro' } } });
  if (!d) { console.log('No encontrado'); return; }

  // Ajustar investigacion de 12h a 15h para que 2026-I sume 40h exactas
  const inv = await prisma.cargaNoLectiva.findFirst({
    where: { docenteId: d.id, tipo: 'INVESTIGACION' }
  });
  if (inv) {
    await prisma.cargaNoLectiva.update({ where: { id: inv.id }, data: { horas: 15 } });
    console.log('Investigacion: 12h -> 15h');
  }

  // Verificar por periodo
  for (const periodoNombre of ['2026-I', '2026-II']) {
    const lectivas = await prisma.asignacionCargaLectiva.findMany({
      where: { docenteId: d.id, periodo: { nombre: periodoNombre } }
    });
    const noLectivas = await prisma.cargaNoLectiva.findMany({
      where: { docenteId: d.id, periodo: { nombre: periodoNombre } }
    });
    const tl = lectivas.reduce((s: number, a: { horasAsignadas: number }) => s + a.horasAsignadas, 0);
    const tn = noLectivas.reduce((s: number, n: { horas: number }) => s + n.horas, 0);
    const pct = Math.round(((tl + tn) / d.horasContrato) * 100);
    console.log(`${periodoNombre}: ${tl}h lect + ${tn}h no lect = ${tl + tn}h/${d.horasContrato}h (${pct}%)`);
  }

  await prisma.$disconnect();
}
main();
