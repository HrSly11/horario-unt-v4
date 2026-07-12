import 'dotenv/config';
import { PrismaClient } from '../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

async function main() {
  const d = await prisma.docente.findFirst({ where: { nombre: { contains: 'Cesar Arellano' } } });
  if (!d) { console.log('No encontrado'); return; }
  console.log('Docente:', d.nombre, '| Contrato:', d.horasContrato, 'h\n');

  // Lectivas por periodo
  const lectivas = await prisma.asignacionCargaLectiva.findMany({
    where: { docenteId: d.id },
    include: { grupo: { include: { curso: true } }, periodo: true }
  });
  
  const lect2026I = lectivas.filter(a => a.periodo.nombre === '2026-I');
  const lect2026II = lectivas.filter(a => a.periodo.nombre === '2026-II');
  
  console.log('--- LECTIVAS 2026-I ---');
  for (const a of lect2026I) console.log(`  ${a.grupo.curso.nombre} | ${a.tipo}: ${a.horasAsignadas}h`);
  console.log(`  Total 2026-I: ${lect2026I.reduce((s,a) => s + a.horasAsignadas, 0)}h`);

  console.log('\n--- LECTIVAS 2026-II ---');
  for (const a of lect2026II) console.log(`  ${a.grupo.curso.nombre} | ${a.tipo}: ${a.horasAsignadas}h`);
  console.log(`  Total 2026-II: ${lect2026II.reduce((s,a) => s + a.horasAsignadas, 0)}h`);

  // No lectivas por periodo
  const noLectivas = await prisma.cargaNoLectiva.findMany({
    where: { docenteId: d.id },
    include: { periodo: true }
  });
  const nl2026I = noLectivas.filter(n => n.periodo.nombre === '2026-I');
  const nl2026II = noLectivas.filter(n => n.periodo.nombre === '2026-II');

  console.log('\n--- NO LECTIVAS 2026-I ---');
  for (const n of nl2026I) console.log(`  ${n.tipo}: ${n.horas}h${n.descripcion ? ' | ' + n.descripcion : ''}`);
  console.log(`  Total 2026-I: ${nl2026I.reduce((s,n) => s + n.horas, 0)}h`);

  console.log('\n--- NO LECTIVAS 2026-II ---');
  for (const n of nl2026II) console.log(`  ${n.tipo}: ${n.horas}h${n.descripcion ? ' | ' + n.descripcion : ''}`);
  console.log(`  Total 2026-II: ${nl2026II.reduce((s,n) => s + n.horas, 0)}h`);

  const tl1 = lect2026I.reduce((s:number,a:{horasAsignadas:number}) => s + a.horasAsignadas, 0);
  const tn1 = nl2026I.reduce((s:number,n:{horas:number}) => s + n.horas, 0);
  const tl2 = lect2026II.reduce((s:number,a:{horasAsignadas:number}) => s + a.horasAsignadas, 0);
  const tn2 = nl2026II.reduce((s:number,n:{horas:number}) => s + n.horas, 0);

  console.log('\n=== RESUMEN ===');
  console.log(`2026-I: ${tl1}h lect + ${tn1}h no lect = ${tl1+tn1}h/40h (${Math.round((tl1+tn1)/40*100)}%)`);
  console.log(`2026-II: ${tl2}h lect + ${tn2}h no lect = ${tl2+tn2}h/40h (${Math.round((tl2+tn2)/40*100)}%)`);

  // Quiero 100% en 2026-I
  const falta = 40 - (tl1 + tn1);
  if (falta > 0) console.log(`\nFaltan ${falta}h en 2026-I para llegar al 100%`);

  // Ver su user
  const user = await prisma.user.findFirst({ where: { docenteId: d.id } });
  if (user) console.log(`\nUser: ${user.email} (${user.role})`);

  await prisma.$disconnect();
}
main();
