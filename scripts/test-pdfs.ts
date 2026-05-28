import 'dotenv/config';
import { PrismaClient } from '../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import { templateFormatoN1, templateFormatoN2, templateFormatoN3 } from '../src/server/services/reports/declaracion-templates';
import { renderPDF } from '../src/server/services/reports';
import * as fs from 'fs';
import * as path from 'path';

async function main() {
  const connectionString = process.env.DATABASE_URL!;
  const pool = new pg.Pool({ connectionString });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  const docente = await prisma.docente.findFirst({
    where: { email: 'cmendez@unitru.edu.pe' },
    select: { id: true, nombre: true, dni: true, codigoIBM: true, categoria: true, modalidad: true },
  });

  if (!docente) { console.log('Docente no encontrado'); return; }
  console.log(`📄 Docente: ${docente.nombre} (${docente.categoria}, ${docente.modalidad})`);

  const periodo = await prisma.periodoAcademico.findFirst({ where: { activo: true } });
  if (!periodo) { console.log('Periodo no encontrado'); return; }

  const declaracion = await prisma.declaracionCarga.findFirst({
    where: { docenteId: docente.id, periodoId: periodo.id },
    include: {
      docente: {
        select: {
          nombre: true, dni: true, codigoIBM: true, categoria: true, modalidad: true,
          departamento: { select: { nombre: true, facultad: { select: { nombre: true } } } },
        },
      },
      periodo: { select: { nombre: true } },
    },
  });

  if (!declaracion) { console.log('Declaración no encontrada'); return; }
  console.log(`📋 Declaración: ${declaracion.estado} | Total: ${declaracion.totalHoras}h`);

  const [asignaciones, cargasNoLectivas] = await Promise.all([
    prisma.asignacionCargaLectiva.findMany({
      where: { docenteId: docente.id, periodoId: periodo.id },
      include: { grupo: { include: { curso: { select: { codigo: true, nombre: true } } } } },
      orderBy: { grupo: { curso: { codigo: 'asc' } } },
    }),
    prisma.cargaNoLectiva.findMany({
      where: { docenteId: docente.id, periodoId: periodo.id },
      orderBy: { tipo: 'asc' },
    }),
  ]);

  const totalLectivas = asignaciones.reduce((sum, a) => sum + a.horasAsignadas, 0);
  const totalNoLectivas = cargasNoLectivas.reduce((sum, c) => sum + c.horas, 0);
  const depto = declaracion.docente.departamento?.nombre || '';
  const facultad = declaracion.docente.departamento?.facultad?.nombre || '';

  const outputDir = path.join(__dirname, '..', 'pdfs-generados');
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  const formatos = [
    {
      key: 'N1',
      html: templateFormatoN1({
        docente: { nombre: declaracion.docente.nombre, dni: declaracion.docente.dni, categoria: declaracion.docente.categoria, modalidad: declaracion.docente.modalidad },
        periodo: declaracion.periodo.nombre,
        facultad,
        departamento: depto,
        asignaciones: asignaciones.map((a) => ({ cursoCodigo: a.grupo.curso.codigo, cursoNombre: a.grupo.curso.nombre, grupo: a.grupo.nombre, tipo: a.tipo, horas: a.horasAsignadas })),
        cargasNoLectivas: cargasNoLectivas.map((c) => ({ tipo: c.tipo, horas: c.horas, descripcion: c.descripcion })),
        totalLectivas,
        totalNoLectivas,
      }),
    },
    {
      key: 'N2',
      html: templateFormatoN2({
        docente: { nombre: declaracion.docente.nombre, dni: declaracion.docente.dni, codigoIBM: declaracion.docente.codigoIBM },
        periodo: declaracion.periodo.nombre, facultad, departamento: depto,
        modalidad: declaracion.docente.modalidad,
      }),
    },
    {
      key: 'N3',
      html: templateFormatoN3({
        docente: { nombre: declaracion.docente.nombre, dni: declaracion.docente.dni, codigoIBM: declaracion.docente.codigoIBM },
        periodo: declaracion.periodo.nombre, facultad, departamento: depto,
        modalidad: declaracion.docente.modalidad,
      }),
    },
  ];

  for (const f of formatos) {
    console.log(`\n🔨 Generando Formato ${f.key}...`);
    try {
      const pdfBuffer = await renderPDF(f.html, { landscape: false });
      const filename = `Declaracion_${f.key}_${declaracion.docente.nombre.replace(/\s+/g, '_')}.pdf`;
      const filepath = path.join(outputDir, filename);
      fs.writeFileSync(filepath, pdfBuffer);
      console.log(`✅ Formato ${f.key}: ${filename} (${(pdfBuffer.length / 1024).toFixed(1)} KB)`);
      console.log(`   📍 ${filepath}`);
    } catch (err) {
      console.log(`❌ Formato ${f.key} ERROR: ${err}`);
    }
  }

  console.log(`\n🎉 PDFs generados en: ${outputDir}`);
  await prisma.$disconnect();
  await pool.end();
}

main().catch(console.error);
