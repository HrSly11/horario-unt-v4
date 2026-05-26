import 'dotenv/config';
import { PrismaClient, CategoriaDocente, TipoDocente, TipoAula, DiaSemana, UserRole } from '../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import bcrypt from 'bcryptjs';

const connectionString = process.env.DATABASE_URL!;
const pool = new pg.Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🌱 Seeding database...');

  // Limpiar base de datos antes de sembrar (en orden inverso de relaciones)
  await prisma.notification.deleteMany();
  await prisma.log.deleteMany();
  await prisma.user.deleteMany();
  await prisma.asignacion.deleteMany();
  await prisma.preasignacion.deleteMany();
  await prisma.restriccionDocente.deleteMany();
  await prisma.mantenimientoAula.deleteMany();
  await prisma.docenteGrupo.deleteMany();
  await prisma.grupo.deleteMany();
  await prisma.curso.deleteMany();
  await prisma.aula.deleteMany();
  await prisma.franjaHoraria.deleteMany();
  await prisma.feriado.deleteMany();
  await prisma.periodoAcademico.deleteMany();
  await prisma.docente.deleteMany();

  console.log('  🗑️  Base de datos limpiada');

  // ── Periodo Académico ──────────────────────────────
  const periodo = await prisma.periodoAcademico.create({
    data: {
      nombre: '2026-I',
      fechaInicio: new Date('2026-04-01'),
      fechaFin: new Date('2026-07-31'),
      activo: true,
    },
  });

  // ── Franjas Horarias (Lun-Vie, 7am-9pm, bloques de 1h) ──
  const dias: DiaSemana[] = ['LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES'];
  const horas = Array.from({ length: 14 }, (_, i) => ({
    inicio: `${String(7 + i).padStart(2, '0')}:00`,
    fin: `${String(8 + i).padStart(2, '0')}:00`,
    bloque: i + 1,
  }));

  const franjasData = dias.flatMap((dia) =>
    horas.map((h) => ({
      dia,
      horaInicio: h.inicio,
      horaFin: h.fin,
      numeroBloque: h.bloque,
    }))
  );

  await prisma.franjaHoraria.createMany({ data: franjasData });
  console.log(`  ✅ ${franjasData.length} franjas horarias creadas`);

  // ── Aulas ──────────────────────────────────────────
  const aulasData = [
    { codigo: 'A-101', nombre: 'Aula 101', capacidad: 40, tipo: TipoAula.TEORIA, edificio: 'Pabellón A', piso: 1 },
    { codigo: 'A-102', nombre: 'Aula 102', capacidad: 40, tipo: TipoAula.TEORIA, edificio: 'Pabellón A', piso: 1 },
    { codigo: 'A-201', nombre: 'Aula 201', capacidad: 35, tipo: TipoAula.TEORIA, edificio: 'Pabellón A', piso: 2 },
    { codigo: 'A-202', nombre: 'Aula 202', capacidad: 35, tipo: TipoAula.TEORIA, edificio: 'Pabellón A', piso: 2 },
    { codigo: 'A-301', nombre: 'Aula 301', capacidad: 50, tipo: TipoAula.TEORIA, edificio: 'Pabellón A', piso: 3 },
    { codigo: 'B-101', nombre: 'Aula Magna', capacidad: 80, tipo: TipoAula.TEORIA, edificio: 'Pabellón B', piso: 1 },
    { codigo: 'LAB-01', nombre: 'Lab. Cómputo 1', capacidad: 30, tipo: TipoAula.LABORATORIO, edificio: 'Pabellón C', piso: 1 },
    { codigo: 'LAB-02', nombre: 'Lab. Cómputo 2', capacidad: 30, tipo: TipoAula.LABORATORIO, edificio: 'Pabellón C', piso: 1 },
    { codigo: 'LAB-03', nombre: 'Lab. Redes', capacidad: 25, tipo: TipoAula.LABORATORIO, edificio: 'Pabellón C', piso: 2 },
    { codigo: 'LAB-04', nombre: 'Lab. Electrónica', capacidad: 20, tipo: TipoAula.LABORATORIO, edificio: 'Pabellón C', piso: 2 },
  ];

  await prisma.aula.createMany({ data: aulasData });
  console.log(`  ✅ ${aulasData.length} aulas creadas`);

  // ── Docentes ───────────────────────────────────────
  const docentesData = [
    // Nombrados - Principales
    { nombre: 'Dr. Carlos Méndez Ruiz', email: 'cmendez@unitru.edu.pe', categoria: CategoriaDocente.PRINCIPAL, tipo: TipoDocente.NOMBRADO, antiguedad: new Date('1995-03-15') },
    { nombre: 'Dra. María López Vega', email: 'mlopez@unitru.edu.pe', categoria: CategoriaDocente.PRINCIPAL, tipo: TipoDocente.NOMBRADO, antiguedad: new Date('1998-08-20') },
    { nombre: 'Dr. Jorge Fernández Castro', email: 'jfernandez@unitru.edu.pe', categoria: CategoriaDocente.PRINCIPAL, tipo: TipoDocente.NOMBRADO, antiguedad: new Date('2000-01-10') },
    // Nombrados - Asociados
    { nombre: 'Mg. Ana Torres Silva', email: 'atorres@unitru.edu.pe', categoria: CategoriaDocente.ASOCIADO, tipo: TipoDocente.NOMBRADO, antiguedad: new Date('2005-06-01') },
    { nombre: 'Mg. Roberto Guzmán Díaz', email: 'rguzman@unitru.edu.pe', categoria: CategoriaDocente.ASOCIADO, tipo: TipoDocente.NOMBRADO, antiguedad: new Date('2007-03-22') },
    { nombre: 'Mg. Patricia Vargas Luna', email: 'pvargas@unitru.edu.pe', categoria: CategoriaDocente.ASOCIADO, tipo: TipoDocente.NOMBRADO, antiguedad: new Date('2008-11-15') },
    // Nombrados - Auxiliares
    { nombre: 'Ing. Luis Ramírez Ortega', email: 'lramirez@unitru.edu.pe', categoria: CategoriaDocente.AUXILIAR, tipo: TipoDocente.NOMBRADO, antiguedad: new Date('2012-04-10') },
    { nombre: 'Ing. Sandra Huamán Ríos', email: 'shuaman@unitru.edu.pe', categoria: CategoriaDocente.AUXILIAR, tipo: TipoDocente.NOMBRADO, antiguedad: new Date('2014-07-20') },
    { nombre: 'Ing. Miguel Castillo Peña', email: 'mcastillo@unitru.edu.pe', categoria: CategoriaDocente.AUXILIAR, tipo: TipoDocente.NOMBRADO, antiguedad: new Date('2015-02-28') },
    // Nombrados - Jefes de Práctica
    { nombre: 'Ing. Rosa Medina Chávez', email: 'rmedina@unitru.edu.pe', categoria: CategoriaDocente.JEFE_PRACTICA, tipo: TipoDocente.NOMBRADO, antiguedad: new Date('2018-08-01') },
    { nombre: 'Ing. Pedro Sánchez Morales', email: 'psanchez@unitru.edu.pe', categoria: CategoriaDocente.JEFE_PRACTICA, tipo: TipoDocente.NOMBRADO, antiguedad: new Date('2019-03-15') },
    // Contratados - Asociados
    { nombre: 'Mg. Diana Flores Quispe', email: 'dflores@unitru.edu.pe', categoria: CategoriaDocente.ASOCIADO, tipo: TipoDocente.CONTRATADO, antiguedad: new Date('2020-03-01') },
    // Contratados - Auxiliares
    { nombre: 'Ing. Fernando Ríos Avalos', email: 'frios@unitru.edu.pe', categoria: CategoriaDocente.AUXILIAR, tipo: TipoDocente.CONTRATADO, antiguedad: new Date('2021-08-15') },
    { nombre: 'Ing. Carmen Vásquez León', email: 'cvasquez@unitru.edu.pe', categoria: CategoriaDocente.AUXILIAR, tipo: TipoDocente.CONTRATADO, antiguedad: new Date('2022-03-01') },
    // Contratados - Jefes de Práctica
    { nombre: 'Bach. Andrés Mendoza Cruz', email: 'amendoza@unitru.edu.pe', categoria: CategoriaDocente.JEFE_PRACTICA, tipo: TipoDocente.CONTRATADO, antiguedad: new Date('2023-03-15') },
    { nombre: 'Bach. Lucía Paredes Rojas', email: 'lparedes@unitru.edu.pe', categoria: CategoriaDocente.JEFE_PRACTICA, tipo: TipoDocente.CONTRATADO, antiguedad: new Date('2024-03-01') },
  ];

  const docentes = await Promise.all(
    docentesData.map((d) => prisma.docente.create({ data: d }))
  );
  console.log(`  ✅ ${docentes.length} docentes creados`);

  // ── Cursos (Plan de Estudios ISI) ──────────────────
  const cursosData = [
    // Ciclo 1
    { codigo: 'IS-101', nombre: 'Introducción a la Ingeniería de Sistemas', creditos: 3, horasTeoria: 2, horasLaboratorio: 2, ciclo: 1, requiereLaboratorio: true },
    { codigo: 'IS-102', nombre: 'Matemática I', creditos: 4, horasTeoria: 4, horasLaboratorio: 0, ciclo: 1, requiereLaboratorio: false },
    // Ciclo 3
    { codigo: 'IS-301', nombre: 'Programación I', creditos: 4, horasTeoria: 2, horasLaboratorio: 4, ciclo: 3, requiereLaboratorio: true },
    { codigo: 'IS-302', nombre: 'Matemática Discreta', creditos: 3, horasTeoria: 3, horasLaboratorio: 0, ciclo: 3, requiereLaboratorio: false },
    // Ciclo 5
    { codigo: 'IS-501', nombre: 'Base de Datos I', creditos: 4, horasTeoria: 2, horasLaboratorio: 4, ciclo: 5, requiereLaboratorio: true },
    { codigo: 'IS-502', nombre: 'Ingeniería de Software I', creditos: 3, horasTeoria: 2, horasLaboratorio: 2, ciclo: 5, requiereLaboratorio: true },
    // Ciclo 7
    { codigo: 'IS-701', nombre: 'Redes de Computadoras', creditos: 4, horasTeoria: 2, horasLaboratorio: 4, ciclo: 7, requiereLaboratorio: true },
    { codigo: 'IS-702', nombre: 'Sistemas Operativos', creditos: 3, horasTeoria: 2, horasLaboratorio: 2, ciclo: 7, requiereLaboratorio: true },
    // Ciclo 9
    { codigo: 'IS-901', nombre: 'Inteligencia Artificial', creditos: 4, horasTeoria: 2, horasLaboratorio: 4, ciclo: 9, requiereLaboratorio: true },
    { codigo: 'IS-902', nombre: 'Gestión de Proyectos de TI', creditos: 3, horasTeoria: 3, horasLaboratorio: 0, ciclo: 9, requiereLaboratorio: false },
    // Additional courses
    { codigo: 'IS-503', nombre: 'Estructura de Datos', creditos: 4, horasTeoria: 2, horasLaboratorio: 4, ciclo: 5, requiereLaboratorio: true },
    { codigo: 'IS-303', nombre: 'Arquitectura de Computadoras', creditos: 3, horasTeoria: 2, horasLaboratorio: 2, ciclo: 3, requiereLaboratorio: true },
    { codigo: 'IS-703', nombre: 'Ingeniería de Software II', creditos: 3, horasTeoria: 2, horasLaboratorio: 2, ciclo: 7, requiereLaboratorio: true },
  ];

  const cursos = await Promise.all(
    cursosData.map((c) => prisma.curso.create({ data: c }))
  );
  console.log(`  ✅ ${cursos.length} cursos creados`);

  // ── Grupos ─────────────────────────────────────────
  const gruposCreated = [];
  for (const curso of cursos) {
    const numGrupos = curso.ciclo <= 3 ? 2 : 1;
    for (let i = 0; i < numGrupos; i++) {
      const grupo = await prisma.grupo.create({
        data: {
          nombre: String.fromCharCode(65 + i),
          cursoId: curso.id,
          periodoAcademicoId: periodo.id,
        },
      });
      gruposCreated.push({ ...grupo, curso });
    }
  }
  console.log(`  ✅ ${gruposCreated.length} grupos creados`);

  // ── Docente-Grupo (Asignaciones de carga académica) ────
  // Each docente gets 1-2 courses based on their position
  const assignments: { docenteIdx: number; cursoCode: string; grupo: string }[] = [
    // Principales — 1 course each (senior, less load)
    { docenteIdx: 0, cursoCode: 'IS-501', grupo: 'A' },
    { docenteIdx: 1, cursoCode: 'IS-901', grupo: 'A' },
    { docenteIdx: 2, cursoCode: 'IS-902', grupo: 'A' },
    // Asociados — 1-2 courses
    { docenteIdx: 3, cursoCode: 'IS-502', grupo: 'A' },
    { docenteIdx: 4, cursoCode: 'IS-701', grupo: 'A' },
    { docenteIdx: 5, cursoCode: 'IS-702', grupo: 'A' },
    { docenteIdx: 11, cursoCode: 'IS-703', grupo: 'A' },
    // Auxiliares — 1-2 courses
    { docenteIdx: 6, cursoCode: 'IS-301', grupo: 'A' },
    { docenteIdx: 6, cursoCode: 'IS-302', grupo: 'A' },
    { docenteIdx: 7, cursoCode: 'IS-301', grupo: 'B' },
    { docenteIdx: 8, cursoCode: 'IS-303', grupo: 'A' },
    { docenteIdx: 8, cursoCode: 'IS-303', grupo: 'B' },
    { docenteIdx: 12, cursoCode: 'IS-503', grupo: 'A' },
    { docenteIdx: 13, cursoCode: 'IS-302', grupo: 'B' },
    // JP — lab-heavy courses
    { docenteIdx: 9, cursoCode: 'IS-101', grupo: 'A' },
    { docenteIdx: 10, cursoCode: 'IS-101', grupo: 'B' },
    { docenteIdx: 14, cursoCode: 'IS-102', grupo: 'A' },
    { docenteIdx: 15, cursoCode: 'IS-102', grupo: 'B' },
  ];

  let docenteGrupoCount = 0;
  for (const { docenteIdx, cursoCode, grupo: grupoNombre } of assignments) {
    const docente = docentes[docenteIdx];
    const grupoRecord = gruposCreated.find(
      (g) => g.curso.codigo === cursoCode && g.nombre === grupoNombre
    );
    if (docente && grupoRecord) {
      await prisma.docenteGrupo.create({
        data: { docenteId: docente.id, grupoId: grupoRecord.id },
      });
      docenteGrupoCount++;
    }
  }
  console.log(`  ✅ ${docenteGrupoCount} asignaciones docente-grupo creadas`);

  // ── Feriados 2026 ──────────────────────────────────
  const feriadosData = [
    { fecha: new Date('2026-05-01'), nombre: 'Día del Trabajo' },
    { fecha: new Date('2026-06-29'), nombre: 'San Pedro y San Pablo' },
    { fecha: new Date('2026-07-28'), nombre: 'Fiestas Patrias' },
    { fecha: new Date('2026-07-29'), nombre: 'Fiestas Patrias' },
  ];

  await prisma.feriado.createMany({ data: feriadosData });
  console.log(`  ✅ ${feriadosData.length} feriados creados`);

  // ── Usuarios de Prueba ──────────────────────────────
  const hashedPassword = await bcrypt.hash('admin123', 10);
  const docentePassword = await bcrypt.hash('docente123', 10);

  const admin = await prisma.user.create({
    data: {
      email: 'admin@unt.edu.pe',
      password: hashedPassword,
      nombre: 'Administrador del Sistema',
      role: UserRole.ADMIN,
    },
  });

  const secretaria = await prisma.user.create({
    data: {
      email: 'secretaria@unt.edu.pe',
      password: hashedPassword,
      nombre: 'Secretaria Académica',
      role: UserRole.SECRETARIA_ACADEMICA,
    },
  });

  const director = await prisma.user.create({
    data: {
      email: 'director@unt.edu.pe',
      password: hashedPassword,
      nombre: 'Director de Escuela',
      role: UserRole.DIRECTOR_ESCUELA,
    },
  });

  const docenteUser = await prisma.user.create({
    data: {
      email: 'cmendez@unitru.edu.pe',
      password: docentePassword,
      nombre: 'Dr. Carlos Méndez Ruiz',
      role: UserRole.DOCENTE,
      docenteId: docentes[0].id,
    },
  });

  const docenteUser2 = await prisma.user.create({
    data: {
      email: 'mlopez@unitru.edu.pe',
      password: docentePassword,
      nombre: 'Dra. María López Vega',
      role: UserRole.DOCENTE,
      docenteId: docentes[1].id,
    },
  });

  console.log('  ✅ Usuarios de prueba creados (admin, 2 docentes)');

  // ── Summary ────────────────────────────────────────
  console.log('\n🎉 Seed completo!');
  console.log(`   Periodo: ${periodo.nombre}`);
  console.log(`   Franjas: ${franjasData.length} (Lun-Vie, 7:00-22:00)`);
  console.log(`   Aulas: ${aulasData.length}`);
  console.log(`   Docentes: ${docentes.length}`);
  console.log(`   Cursos: ${cursos.length}`);
  console.log(`   Grupos: ${gruposCreated.length}`);
  console.log(`   Docente-Grupo: ${docenteGrupoCount}`);
  console.log(`   Feriados: ${feriadosData.length}`);
  console.log(`   Usuarios: 4 (admin@unt.edu.pe, secretaria@unt.edu.pe, director@unt.edu.pe, cmendez@unitru.edu.pe, mlopez@unitru.edu.pe)`);
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
