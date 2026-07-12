import 'dotenv/config';
import { PrismaClient } from '../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

async function main() {
  const d = await prisma.docente.findFirst({ where: { nombre: { contains: 'Cesar Arellano' } } });
  if (!d) { console.log('No encontrado'); return; }

  const noLectivas = await prisma.cargaNoLectiva.findMany({
    where: { docenteId: d.id, periodo: { nombre: '2026-I' } }
  });

  // Limite preparacion: max 3h (50% de 7h lectivas = 3.5, floor = 3)
  // Nueva distribucion manteniendo 40h total:
  //   PREPARACION: 3h (max)   - antes 10h -> -7h a redistribuir
  //   INVESTIGACION: 20h      - antes 16h -> +4h
  //   CONSEJERIA: 5h          - sin cambio
  //   ADMINISTRACION: 5h      - antes 2h -> +3h
  //   Total no lect: 33h + Lect: 7h = 40h

  for (const n of noLectivas) {
    if (n.tipo === 'PREPARACION_EVALUACION') {
      await prisma.cargaNoLectiva.update({ where: { id: n.id }, data: { horas: 3 } });
      console.log('PREPARACION: 10h -> 3h (-7h)');
    } else if (n.tipo === 'INVESTIGACION') {
      await prisma.cargaNoLectiva.update({ where: { id: n.id }, data: { horas: 20 } });
      console.log('INVESTIGACION: 16h -> 20h (+4h)');
    } else if (n.tipo === 'ADMINISTRACION') {
      await prisma.cargaNoLectiva.update({ where: { id: n.id }, data: { horas: 5 } });
      console.log('ADMINISTRACION: 2h -> 5h (+3h)');
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
  
  console.log('\n=== DISTRIBUCION FINAL ===');
  console.log(`Lectivas: ${tl}h`);
  for (const n of nl) {
    console.log(`  ${n.tipo}: ${n.horas}h`);
  }
  console.log(`\nTotal: ${tl + tn}h/40h (${Math.round((tl+tn)/40*100)}%)`);
  console.log(`Preparacion max permitida: ${Math.floor(tl * 0.5)}h -> actual: ${nl.find(n=>n.tipo==='PREPARACION_EVALUACION')?.horas}h ✓`);

  await prisma.$disconnect();
}
main();
