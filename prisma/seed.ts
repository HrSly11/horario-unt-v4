import 'dotenv/config';
import { PrismaClient, CategoriaDocente, TipoDocente, ModalidadDocente, TipoAula, DiaSemana, UserRole, EstadoDeclaracion, TipoCargaNoLectiva, TipoAsignacion, EstadoPeriodo } from '../src/generated/prisma/client';
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
  await prisma.declaracionCarga.deleteMany();
  await prisma.cargaNoLectiva.deleteMany();
  await prisma.asignacionCargaLectiva.deleteMany();
  await prisma.cursoCurricula.deleteMany();
  await prisma.curricula.deleteMany();
  await prisma.escuela.deleteMany();
  await prisma.departamento.deleteMany();
  await prisma.facultad.deleteMany();
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
      estado: 'ASIGNACION',
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

  // ── Estructura Organizacional ─────────────────────
  const facultad = await prisma.facultad.create({
    data: {
      nombre: 'Facultad de Ingeniería',
      siglas: 'FI',
    },
  });

  const deptoSistemas = await prisma.departamento.create({
    data: {
      nombre: 'Departamento de Ingeniería de Sistemas',
      facultadId: facultad.id,
    },
  });

  const deptoInformatica = await prisma.departamento.create({
    data: {
      nombre: 'Departamento de Ingeniería Informática',
      facultadId: facultad.id,
    },
  });

  const escuelaSistemas = await prisma.escuela.create({
    data: {
      nombre: 'Escuela de Ingeniería de Sistemas',
      facultadId: facultad.id,
    },
  });

  const curricula2018 = await prisma.curricula.create({
    data: {
      codigo: '2018',
      escuelaId: escuelaSistemas.id,
      vigente: true,
      anio: 2018,
    },
  });

  // Vincular cursos a la curricula
  const cursosCurriculaData = [
    { cursoId: cursos[0].id, curriculaId: curricula2018.id, ciclo: 1, esElectivo: false },
    { cursoId: cursos[1].id, curriculaId: curricula2018.id, ciclo: 1, esElectivo: false },
    { cursoId: cursos[2].id, curriculaId: curricula2018.id, ciclo: 3, esElectivo: false },
    { cursoId: cursos[3].id, curriculaId: curricula2018.id, ciclo: 3, esElectivo: false },
    { cursoId: cursos[4].id, curriculaId: curricula2018.id, ciclo: 5, esElectivo: false },
    { cursoId: cursos[5].id, curriculaId: curricula2018.id, ciclo: 5, esElectivo: false },
    { cursoId: cursos[6].id, curriculaId: curricula2018.id, ciclo: 7, esElectivo: false },
    { cursoId: cursos[7].id, curriculaId: curricula2018.id, ciclo: 7, esElectivo: false },
    { cursoId: cursos[8].id, curriculaId: curricula2018.id, ciclo: 9, esElectivo: false },
    { cursoId: cursos[9].id, curriculaId: curricula2018.id, ciclo: 9, esElectivo: false },
    { cursoId: cursos[10].id, curriculaId: curricula2018.id, ciclo: 5, esElectivo: false },
    { cursoId: cursos[11].id, curriculaId: curricula2018.id, ciclo: 3, esElectivo: false },
    { cursoId: cursos[12].id, curriculaId: curricula2018.id, ciclo: 7, esElectivo: false },
  ];

  await prisma.cursoCurricula.createMany({ data: cursosCurriculaData });
  console.log(`  ✅ ${cursosCurriculaData.length} cursos vinculados a curricula`);

  // ── Docentes ───────────────────────────────────────
  const docentesData = [
    // Nombrados - Principales (DE)
    { nombre: 'Dr. Carlos Méndez Ruiz', email: 'cmendez@unitru.edu.pe', categoria: CategoriaDocente.PRINCIPAL, tipo: TipoDocente.NOMBRADO, antiguedad: new Date('1995-03-15'), dni: '17890123', codigoIBM: 'IBM001', modalidad: ModalidadDocente.DEDICACION_EXCLUSIVA, horasContrato: 40, dictaOtraUniversidad: false, departamentoId: deptoSistemas.id, gradoAcademico: 'Doctor', especialidad: 'Ingeniería de Software', experienciaAnios: 30 },
    { nombre: 'Dra. María López Vega', email: 'mlopez@unitru.edu.pe', categoria: CategoriaDocente.PRINCIPAL, tipo: TipoDocente.NOMBRADO, antiguedad: new Date('1998-08-20'), dni: '18234567', codigoIBM: 'IBM002', modalidad: ModalidadDocente.DEDICACION_EXCLUSIVA, horasContrato: 40, dictaOtraUniversidad: false, departamentoId: deptoSistemas.id, gradoAcademico: 'Doctora', especialidad: 'Inteligencia Artificial', experienciaAnios: 27 },
    { nombre: 'Dr. Jorge Fernández Castro', email: 'jfernandez@unitru.edu.pe', categoria: CategoriaDocente.PRINCIPAL, tipo: TipoDocente.NOMBRADO, antiguedad: new Date('2000-01-10'), dni: '19345678', codigoIBM: 'IBM003', modalidad: ModalidadDocente.TIEMPO_COMPLETO, horasContrato: 40, dictaOtraUniversidad: false, departamentoId: deptoInformatica.id, gradoAcademico: 'Doctor', especialidad: 'Redes y Comunicaciones', experienciaAnios: 26 },
    // Nombrados - Asociados (TC)
    { nombre: 'Mg. Ana Torres Silva', email: 'atorres@unitru.edu.pe', categoria: CategoriaDocente.ASOCIADO, tipo: TipoDocente.NOMBRADO, antiguedad: new Date('2005-06-01'), dni: '20456789', codigoIBM: 'IBM004', modalidad: ModalidadDocente.TIEMPO_COMPLETO, horasContrato: 40, dictaOtraUniversidad: false, departamentoId: deptoSistemas.id, gradoAcademico: 'Magíster', especialidad: 'Base de Datos', experienciaAnios: 20 },
    { nombre: 'Mg. Roberto Guzmán Díaz', email: 'rguzman@unitru.edu.pe', categoria: CategoriaDocente.ASOCIADO, tipo: TipoDocente.NOMBRADO, antiguedad: new Date('2007-03-22'), dni: '21567890', codigoIBM: 'IBM005', modalidad: ModalidadDocente.TIEMPO_COMPLETO, horasContrato: 40, dictaOtraUniversidad: false, departamentoId: deptoSistemas.id, gradoAcademico: 'Magíster', especialidad: 'Sistemas Operativos', experienciaAnios: 19 },
    { nombre: 'Mg. Patricia Vargas Luna', email: 'pvargas@unitru.edu.pe', categoria: CategoriaDocente.ASOCIADO, tipo: TipoDocente.NOMBRADO, antiguedad: new Date('2008-11-15'), dni: '22678901', codigoIBM: 'IBM006', modalidad: ModalidadDocente.TIEMPO_COMPLETO, horasContrato: 40, dictaOtraUniversidad: false, departamentoId: deptoInformatica.id, gradoAcademico: 'Magíster', especialidad: 'Gestión de Proyectos', experienciaAnios: 17 },
    // Nombrados - Auxiliares (TC)
    { nombre: 'Ing. Luis Ramírez Ortega', email: 'lramirez@unitru.edu.pe', categoria: CategoriaDocente.AUXILIAR, tipo: TipoDocente.NOMBRADO, antiguedad: new Date('2012-04-10'), dni: '23789012', codigoIBM: 'IBM007', modalidad: ModalidadDocente.TIEMPO_COMPLETO, horasContrato: 40, dictaOtraUniversidad: false, departamentoId: deptoSistemas.id, gradoAcademico: 'Ingeniero', especialidad: 'Programación', experienciaAnios: 14 },
    { nombre: 'Ing. Sandra Huamán Ríos', email: 'shuaman@unitru.edu.pe', categoria: CategoriaDocente.AUXILIAR, tipo: TipoDocente.NOMBRADO, antiguedad: new Date('2014-07-20'), dni: '24890123', codigoIBM: 'IBM008', modalidad: ModalidadDocente.TIEMPO_COMPLETO, horasContrato: 40, dictaOtraUniversidad: false, departamentoId: deptoSistemas.id, gradoAcademico: 'Ingeniera', especialidad: 'Estructura de Datos', experienciaAnios: 11 },
    { nombre: 'Ing. Miguel Castillo Peña', email: 'mcastillo@unitru.edu.pe', categoria: CategoriaDocente.AUXILIAR, tipo: TipoDocente.NOMBRADO, antiguedad: new Date('2015-02-28'), dni: '25901234', codigoIBM: 'IBM009', modalidad: ModalidadDocente.TIEMPO_COMPLETO, horasContrato: 40, dictaOtraUniversidad: false, departamentoId: deptoInformatica.id, gradoAcademico: 'Ingeniero', especialidad: 'Arquitectura de Computadoras', experienciaAnios: 11 },
    // Nombrados - Jefes de Práctica (TP 20h)
    { nombre: 'Ing. Rosa Medina Chávez', email: 'rmedina@unitru.edu.pe', categoria: CategoriaDocente.JEFE_PRACTICA, tipo: TipoDocente.NOMBRADO, antiguedad: new Date('2018-08-01'), dni: '26012345', codigoIBM: 'IBM010', modalidad: ModalidadDocente.TIEMPO_PARCIAL, horasContrato: 20, dictaOtraUniversidad: false, departamentoId: deptoSistemas.id, gradoAcademico: 'Ingeniera', especialidad: 'Laboratorio de Cómputo', experienciaAnios: 7 },
    { nombre: 'Ing. Pedro Sánchez Morales', email: 'psanchez@unitru.edu.pe', categoria: CategoriaDocente.JEFE_PRACTICA, tipo: TipoDocente.NOMBRADO, antiguedad: new Date('2019-03-15'), dni: '27123456', codigoIBM: 'IBM011', modalidad: ModalidadDocente.TIEMPO_PARCIAL, horasContrato: 20, dictaOtraUniversidad: false, departamentoId: deptoSistemas.id, gradoAcademico: 'Ingeniero', especialidad: 'Redes', experienciaAnios: 7 },
    // Contratados - Asociados (TC)
    { nombre: 'Mg. Diana Flores Quispe', email: 'dflores@unitru.edu.pe', categoria: CategoriaDocente.ASOCIADO, tipo: TipoDocente.CONTRATADO, antiguedad: new Date('2020-03-01'), dni: '28234567', codigoIBM: 'IBM012', modalidad: ModalidadDocente.TIEMPO_COMPLETO, horasContrato: 40, dictaOtraUniversidad: false, departamentoId: deptoInformatica.id, gradoAcademico: 'Magíster', especialidad: 'Ingeniería de Software II', experienciaAnios: 6 },
    // Contratados - Auxiliares (TC)
    { nombre: 'Ing. Fernando Ríos Avalos', email: 'frios@unitru.edu.pe', categoria: CategoriaDocente.AUXILIAR, tipo: TipoDocente.CONTRATADO, antiguedad: new Date('2021-08-15'), dni: '29345678', codigoIBM: 'IBM013', modalidad: ModalidadDocente.TIEMPO_COMPLETO, horasContrato: 40, dictaOtraUniversidad: false, departamentoId: deptoSistemas.id, gradoAcademico: 'Ingeniero', especialidad: 'Desarrollo Web', experienciaAnios: 4 },
    { nombre: 'Ing. Carmen Vásquez León', email: 'cvasquez@unitru.edu.pe', categoria: CategoriaDocente.AUXILIAR, tipo: TipoDocente.CONTRATADO, antiguedad: new Date('2022-03-01'), dni: '30456789', codigoIBM: 'IBM014', modalidad: ModalidadDocente.TIEMPO_COMPLETO, horasContrato: 40, dictaOtraUniversidad: false, departamentoId: deptoSistemas.id, gradoAcademico: 'Ingeniera', especialidad: 'Matemática', experienciaAnios: 4 },
    // Contratados - Jefes de Práctica (TP 20h)
    { nombre: 'Bach. Andrés Mendoza Cruz', email: 'amendoza@unitru.edu.pe', categoria: CategoriaDocente.JEFE_PRACTICA, tipo: TipoDocente.CONTRATADO, antiguedad: new Date('2023-03-15'), dni: '41567890', codigoIBM: 'IBM015', modalidad: ModalidadDocente.TIEMPO_PARCIAL, horasContrato: 20, dictaOtraUniversidad: false, departamentoId: deptoSistemas.id, gradoAcademico: 'Bachiller', especialidad: 'Laboratorio', experienciaAnios: 3 },
    { nombre: 'Bach. Lucía Paredes Rojas', email: 'lparedes@unitru.edu.pe', categoria: CategoriaDocente.JEFE_PRACTICA, tipo: TipoDocente.CONTRATADO, antiguedad: new Date('2024-03-01'), dni: '42678901', codigoIBM: 'IBM016', modalidad: ModalidadDocente.TIEMPO_PARCIAL, horasContrato: 20, dictaOtraUniversidad: false, departamentoId: deptoSistemas.id, gradoAcademico: 'Bachiller', especialidad: 'Matemática', experienciaAnios: 2 },
  ];

  const docentes = await Promise.all(
    docentesData.map((d) => prisma.docente.create({ data: d }))
  );
  console.log(`  ✅ ${docentes.length} docentes creados`);

  // ── Grupos ─────────────────────────────────────────
  const gruposCreated = [];
  for (const curso of cursos) {
    const numGrupos = curso.ciclo <= 3 ? 2 : 1;
    for (let i = 0; i < numGrupos; i++) {
      const seccion = String.fromCharCode(65 + i);
      const grupo = await prisma.grupo.create({
        data: {
          nombre: seccion,
          seccion: seccion,
          cursoId: curso.id,
          periodoAcademicoId: periodo.id,
          numAlumnos: curso.ciclo <= 3 ? 35 : 25,
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

  const decano = await prisma.user.create({
    data: {
      email: 'decano@unt.edu.pe',
      password: hashedPassword,
      nombre: 'Dr. Decano Ingeniería',
      role: UserRole.DECANO,
    },
  });

  const dirDeptoSistemas = await prisma.user.create({
    data: {
      email: 'dirsistemas@unt.edu.pe',
      password: hashedPassword,
      nombre: 'Director Depto. Sistemas',
      role: UserRole.DIRECTOR_DEPARTAMENTO,
    },
  });

  const dirDeptoInformatica = await prisma.user.create({
    data: {
      email: 'dirinformatica@unt.edu.pe',
      password: hashedPassword,
      nombre: 'Director Depto. Informática',
      role: UserRole.DIRECTOR_DEPARTAMENTO,
    },
  });

  const secDeptoSistemas = await prisma.user.create({
    data: {
      email: 'secsistemas@unt.edu.pe',
      password: hashedPassword,
      nombre: 'Secretaria Depto. Sistemas',
      role: UserRole.SECRETARIA_DEPARTAMENTO,
    },
  });

  const secDeptoInformatica = await prisma.user.create({
    data: {
      email: 'secinformatica@unt.edu.pe',
      password: hashedPassword,
      nombre: 'Secretaria Depto. Informática',
      role: UserRole.SECRETARIA_DEPARTAMENTO,
    },
  });

  const directorEscuela = await prisma.user.create({
    data: {
      email: 'director@unt.edu.pe',
      password: hashedPassword,
      nombre: 'Director de Escuela',
      role: UserRole.DIRECTOR_ESCUELA,
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

  const docenteUser3 = await prisma.user.create({
    data: {
      email: 'jfernandez@unitru.edu.pe',
      password: docentePassword,
      nombre: 'Dr. Jorge Fernández Castro',
      role: UserRole.DOCENTE,
      docenteId: docentes[2].id,
    },
  });

  // Vincular directores y secretarias a departamentos
  await prisma.departamento.update({
    where: { id: deptoSistemas.id },
    data: { directorId: dirDeptoSistemas.id, secretariaId: secDeptoSistemas.id, designadoPorId: decano.id, fechaDesignacion: new Date('2026-01-15') },
  });

  await prisma.departamento.update({
    where: { id: deptoInformatica.id },
    data: { directorId: dirDeptoInformatica.id, secretariaId: secDeptoInformatica.id, designadoPorId: decano.id, fechaDesignacion: new Date('2026-01-15') },
  });

  await prisma.escuela.update({
    where: { id: escuelaSistemas.id },
    data: { directorId: directorEscuela.id, designadoPorId: decano.id, fechaDesignacion: new Date('2026-01-15') },
  });

  console.log('  ✅ 10 usuarios creados (admin, decano, 2 dir depto, 2 sec depto, dir escuela, secretaria, 3 docentes)');

  // ── Asignaciones de Carga Lectiva ─────────────────
  const cargasLectivas = [
    // Docente 0 (Dr. Méndez - DE): IS-501 Base de Datos I (Teoría 2h + Práctica 2h)
    { docenteId: docentes[0].id, grupoId: gruposCreated.find(g => g.curso.codigo === 'IS-501' && g.nombre === 'A')!.id, periodoId: periodo.id, tipo: 'TEORIA' as TipoAsignacion, horasAsignadas: 2, compartido: false },
    { docenteId: docentes[0].id, grupoId: gruposCreated.find(g => g.curso.codigo === 'IS-501' && g.nombre === 'A')!.id, periodoId: periodo.id, tipo: 'PRACTICA' as TipoAsignacion, horasAsignadas: 2, compartido: false },
    // Docente 0 también comparte IS-101 LAB con docente 9
    { docenteId: docentes[0].id, grupoId: gruposCreated.find(g => g.curso.codigo === 'IS-101' && g.nombre === 'A')!.id, periodoId: periodo.id, tipo: 'LABORATORIO' as TipoAsignacion, horasAsignadas: 2, compartido: false },
    // Docente 1 (Dra. López - DE): IS-901 IA (Teoría 2h + Laboratorio 4h)
    { docenteId: docentes[1].id, grupoId: gruposCreated.find(g => g.curso.codigo === 'IS-901' && g.nombre === 'A')!.id, periodoId: periodo.id, tipo: 'TEORIA' as TipoAsignacion, horasAsignadas: 2, compartido: false },
    { docenteId: docentes[1].id, grupoId: gruposCreated.find(g => g.curso.codigo === 'IS-901' && g.nombre === 'A')!.id, periodoId: periodo.id, tipo: 'LABORATORIO' as TipoAsignacion, horasAsignadas: 4, compartido: false },
    // Docente 2 (Dr. Fernández - TC): IS-902 Gestión Proyectos (Teoría 3h)
    { docenteId: docentes[2].id, grupoId: gruposCreated.find(g => g.curso.codigo === 'IS-902' && g.nombre === 'A')!.id, periodoId: periodo.id, tipo: 'TEORIA' as TipoAsignacion, horasAsignadas: 3, compartido: false },
    // Docente 2 también comparte IS-701 con docente 4 (Teoría 2h + Laboratorio compartido)
    { docenteId: docentes[2].id, grupoId: gruposCreated.find(g => g.curso.codigo === 'IS-701' && g.nombre === 'A')!.id, periodoId: periodo.id, tipo: 'TEORIA' as TipoAsignacion, horasAsignadas: 2, compartido: true, docenteCompartidoId: docentes[4].id },
    { docenteId: docentes[2].id, grupoId: gruposCreated.find(g => g.curso.codigo === 'IS-701' && g.nombre === 'A')!.id, periodoId: periodo.id, tipo: 'LABORATORIO' as TipoAsignacion, horasAsignadas: 2, compartido: true, docenteCompartidoId: docentes[4].id },
    // Docente 3 (Mg. Torres - TC): IS-502 IS I (Teoría 2h + Práctica 2h)
    { docenteId: docentes[3].id, grupoId: gruposCreated.find(g => g.curso.codigo === 'IS-502' && g.nombre === 'A')!.id, periodoId: periodo.id, tipo: 'TEORIA' as TipoAsignacion, horasAsignadas: 2, compartido: false },
    { docenteId: docentes[3].id, grupoId: gruposCreated.find(g => g.curso.codigo === 'IS-502' && g.nombre === 'A')!.id, periodoId: periodo.id, tipo: 'PRACTICA' as TipoAsignacion, horasAsignadas: 2, compartido: false },
    // Docente 4 (Mg. Guzmán - TC): IS-701 Redes (Teoría 2h + Laboratorio 2h compartido con docente 2)
    { docenteId: docentes[4].id, grupoId: gruposCreated.find(g => g.curso.codigo === 'IS-701' && g.nombre === 'A')!.id, periodoId: periodo.id, tipo: 'TEORIA' as TipoAsignacion, horasAsignadas: 2, compartido: true, docenteCompartidoId: docentes[2].id },
    { docenteId: docentes[4].id, grupoId: gruposCreated.find(g => g.curso.codigo === 'IS-701' && g.nombre === 'A')!.id, periodoId: periodo.id, tipo: 'LABORATORIO' as TipoAsignacion, horasAsignadas: 2, compartido: true, docenteCompartidoId: docentes[2].id },
    // Docente 4 también IS-702 SO (Teoría 2h + Lab 2h)
    { docenteId: docentes[4].id, grupoId: gruposCreated.find(g => g.curso.codigo === 'IS-702' && g.nombre === 'A')!.id, periodoId: periodo.id, tipo: 'TEORIA' as TipoAsignacion, horasAsignadas: 2, compartido: false },
    { docenteId: docentes[4].id, grupoId: gruposCreated.find(g => g.curso.codigo === 'IS-702' && g.nombre === 'A')!.id, periodoId: periodo.id, tipo: 'LABORATORIO' as TipoAsignacion, horasAsignadas: 2, compartido: false },
    // Docente 5 (Mg. Vargas - TC): IS-503 Estructura Datos (Teoría 2h + Lab 4h)
    { docenteId: docentes[5].id, grupoId: gruposCreated.find(g => g.curso.codigo === 'IS-503' && g.nombre === 'A')!.id, periodoId: periodo.id, tipo: 'TEORIA' as TipoAsignacion, horasAsignadas: 2, compartido: false },
    { docenteId: docentes[5].id, grupoId: gruposCreated.find(g => g.curso.codigo === 'IS-503' && g.nombre === 'A')!.id, periodoId: periodo.id, tipo: 'LABORATORIO' as TipoAsignacion, horasAsignadas: 4, compartido: false },
    // Docente 6 (Ing. Ramírez - TC): IS-301 Prog I A (Teoría 2h + Lab 4h)
    { docenteId: docentes[6].id, grupoId: gruposCreated.find(g => g.curso.codigo === 'IS-301' && g.nombre === 'A')!.id, periodoId: periodo.id, tipo: 'TEORIA' as TipoAsignacion, horasAsignadas: 2, compartido: false },
    { docenteId: docentes[6].id, grupoId: gruposCreated.find(g => g.curso.codigo === 'IS-301' && g.nombre === 'A')!.id, periodoId: periodo.id, tipo: 'LABORATORIO' as TipoAsignacion, horasAsignadas: 4, compartido: false },
    // Docente 6 también IS-302 Mat Discreta A (Teoría 3h)
    { docenteId: docentes[6].id, grupoId: gruposCreated.find(g => g.curso.codigo === 'IS-302' && g.nombre === 'A')!.id, periodoId: periodo.id, tipo: 'TEORIA' as TipoAsignacion, horasAsignadas: 3, compartido: false },
    // Docente 7 (Ing. Huamán - TC): IS-301 Prog I B (Teoría 2h + Lab 4h)
    { docenteId: docentes[7].id, grupoId: gruposCreated.find(g => g.curso.codigo === 'IS-301' && g.nombre === 'B')!.id, periodoId: periodo.id, tipo: 'TEORIA' as TipoAsignacion, horasAsignadas: 2, compartido: false },
    { docenteId: docentes[7].id, grupoId: gruposCreated.find(g => g.curso.codigo === 'IS-301' && g.nombre === 'B')!.id, periodoId: periodo.id, tipo: 'LABORATORIO' as TipoAsignacion, horasAsignadas: 4, compartido: false },
    // Docente 8 (Ing. Castillo - TC): IS-303 Arq Comp A y B (Teoría 2h c/u + Lab 2h c/u)
    { docenteId: docentes[8].id, grupoId: gruposCreated.find(g => g.curso.codigo === 'IS-303' && g.nombre === 'A')!.id, periodoId: periodo.id, tipo: 'TEORIA' as TipoAsignacion, horasAsignadas: 2, compartido: false },
    { docenteId: docentes[8].id, grupoId: gruposCreated.find(g => g.curso.codigo === 'IS-303' && g.nombre === 'A')!.id, periodoId: periodo.id, tipo: 'LABORATORIO' as TipoAsignacion, horasAsignadas: 2, compartido: false },
    { docenteId: docentes[8].id, grupoId: gruposCreated.find(g => g.curso.codigo === 'IS-303' && g.nombre === 'B')!.id, periodoId: periodo.id, tipo: 'TEORIA' as TipoAsignacion, horasAsignadas: 2, compartido: false },
    { docenteId: docentes[8].id, grupoId: gruposCreated.find(g => g.curso.codigo === 'IS-303' && g.nombre === 'B')!.id, periodoId: periodo.id, tipo: 'LABORATORIO' as TipoAsignacion, horasAsignadas: 2, compartido: false },
    // Docente 9 (Ing. Medina - TP 20h): IS-101 Lab A
    { docenteId: docentes[9].id, grupoId: gruposCreated.find(g => g.curso.codigo === 'IS-101' && g.nombre === 'A')!.id, periodoId: periodo.id, tipo: 'LABORATORIO' as TipoAsignacion, horasAsignadas: 2, compartido: false },
    // Docente 9: IS-102 Mat I A (Teoría 4h)
    { docenteId: docentes[9].id, grupoId: gruposCreated.find(g => g.curso.codigo === 'IS-102' && g.nombre === 'A')!.id, periodoId: periodo.id, tipo: 'TEORIA' as TipoAsignacion, horasAsignadas: 4, compartido: false },
    // Docente 10 (Ing. Sánchez - TP 20h): IS-101 Lab B + IS-102 Mat I B (total 20h)
    { docenteId: docentes[10].id, grupoId: gruposCreated.find(g => g.curso.codigo === 'IS-101' && g.nombre === 'B')!.id, periodoId: periodo.id, tipo: 'TEORIA' as TipoAsignacion, horasAsignadas: 2, compartido: false },
    { docenteId: docentes[10].id, grupoId: gruposCreated.find(g => g.curso.codigo === 'IS-101' && g.nombre === 'B')!.id, periodoId: periodo.id, tipo: 'LABORATORIO' as TipoAsignacion, horasAsignadas: 2, compartido: false },
    { docenteId: docentes[10].id, grupoId: gruposCreated.find(g => g.curso.codigo === 'IS-102' && g.nombre === 'B')!.id, periodoId: periodo.id, tipo: 'TEORIA' as TipoAsignacion, horasAsignadas: 4, compartido: false },
  ];

  let cargaLectivaCount = 0;
  for (const carga of cargasLectivas) {
    await prisma.asignacionCargaLectiva.create({ data: carga });
    cargaLectivaCount++;
  }
  console.log(`  ✅ ${cargaLectivaCount} asignaciones de carga lectiva creadas`);

  // ── Carga No Lectiva ────────────────────────────────
  const cargasNoLectivasData = [
    {
      docenteId: docentes[0].id,
      periodoId: periodo.id,
      tipo: 'PREPARACION_EVALUACION' as TipoCargaNoLectiva,
      horas: 3,
      descripcion: 'Preparación de material didáctico y exámenes para BD I',
      horarios: {
        create: [
          { dia: 'LUNES' as DiaSemana, horaInicio: '08:00', horaFin: '11:00', lugar: 'F11', aula: 'CUBICULO DOCENTE' },
        ],
      },
    },
    {
      docenteId: docentes[0].id,
      periodoId: periodo.id,
      tipo: 'INVESTIGACION' as TipoCargaNoLectiva,
      horas: 6,
      descripcion: 'Proyecto de investigación en bases de datos espaciales',
      codigoProyecto: 'PI-2026-001',
      nombreProyecto: 'SpatialDB: Bases de Datos Espaciales',
      horarios: {
        create: [
          { dia: 'MARTES' as DiaSemana, horaInicio: '08:00', horaFin: '11:00', lugar: 'F11', aula: 'LAB INVST' },
          { dia: 'MIERCOLES' as DiaSemana, horaInicio: '14:00', horaFin: '17:00', lugar: 'F11', aula: 'LAB INVST' },
        ],
      },
    },
    {
      docenteId: docentes[0].id,
      periodoId: periodo.id,
      tipo: 'COMITES_COMISIONES' as TipoCargaNoLectiva,
      horas: 2,
      descripcion: 'Comité de Curricula',
      horarios: {
        create: [
          { dia: 'JUEVES' as DiaSemana, horaInicio: '10:00', horaFin: '12:00', lugar: 'F11', aula: 'SALA REUNIONES' },
        ],
      },
    },
    {
      docenteId: docentes[1].id,
      periodoId: periodo.id,
      tipo: 'PREPARACION_EVALUACION' as TipoCargaNoLectiva,
      horas: 3,
      descripcion: 'Preparación de exámenes y laboratorios de IA',
      horarios: {
        create: [
          { dia: 'LUNES' as DiaSemana, horaInicio: '09:00', horaFin: '12:00', lugar: 'F11', aula: 'CUBICULO' },
        ],
      },
    },
    {
      docenteId: docentes[1].id,
      periodoId: periodo.id,
      tipo: 'ASESORIA_TESIS' as TipoCargaNoLectiva,
      horas: 4,
      descripcion: 'Asesoría de tesis de pregrado',
      numAlumnos: 2,
      horarios: {
        create: [
          { dia: 'MARTES' as DiaSemana, horaInicio: '14:00', horaFin: '16:00', lugar: 'F11', aula: 'CUBICULO' },
          { dia: 'JUEVES' as DiaSemana, horaInicio: '14:00', horaFin: '16:00', lugar: 'F11', aula: 'CUBICULO' },
        ],
      },
    },
    {
      docenteId: docentes[1].id,
      periodoId: periodo.id,
      tipo: 'GOBIERNO' as TipoCargaNoLectiva,
      horas: 3,
      descripcion: 'Coordinación académica del departamento',
      horarios: {
        create: [
          { dia: 'MIERCOLES' as DiaSemana, horaInicio: '09:00', horaFin: '12:00', lugar: 'F11', aula: 'DEPTO' },
        ],
      },
    },
    {
      docenteId: docentes[2].id,
      periodoId: periodo.id,
      tipo: 'PREPARACION_EVALUACION' as TipoCargaNoLectiva,
      horas: 2,
      descripcion: 'Preparación de exámenes de Gestión de Proyectos y Redes',
      horarios: {
        create: [
          { dia: 'LUNES' as DiaSemana, horaInicio: '14:00', horaFin: '16:00', lugar: 'F11', aula: 'CUBICULO' },
        ],
      },
    },
    {
      docenteId: docentes[2].id,
      periodoId: periodo.id,
      tipo: 'CAPACITACION' as TipoCargaNoLectiva,
      horas: 3,
      descripcion: 'Certificación Cisco CCNA',
      horarios: {
        create: [
          { dia: 'JUEVES' as DiaSemana, horaInicio: '15:00', horaFin: '18:00', lugar: 'F11', aula: 'LAB REDES' },
        ],
      },
    },
    {
      docenteId: docentes[4].id,
      periodoId: periodo.id,
      tipo: 'PREPARACION_EVALUACION' as TipoCargaNoLectiva,
      horas: 4,
      descripcion: 'Preparación de material para Redes y SO',
      horarios: {
        create: [
          { dia: 'MARTES' as DiaSemana, horaInicio: '09:00', horaFin: '11:00', lugar: 'F11', aula: 'CUBICULO' },
          { dia: 'JUEVES' as DiaSemana, horaInicio: '09:00', horaFin: '11:00', lugar: 'F11', aula: 'CUBICULO' },
        ],
      },
    },
    {
      docenteId: docentes[4].id,
      periodoId: periodo.id,
      tipo: 'ADMINISTRACION' as TipoCargaNoLectiva,
      horas: 2,
      descripcion: 'Administración de laboratorio de redes',
      horarios: {
        create: [
          { dia: 'MIERCOLES' as DiaSemana, horaInicio: '11:00', horaFin: '13:00', lugar: 'F11', aula: 'LAB REDES' },
        ],
      },
    },
  ];

  let cargaNoLectivaCount = 0;
  for (const carga of cargasNoLectivasData) {
    await prisma.cargaNoLectiva.create({ data: carga });
    cargaNoLectivaCount++;
  }
  console.log(`  ✅ ${cargaNoLectivaCount} cargas no lectivas creadas`);

  // ── Declaraciones de Carga ──────────────────────────
  const declaracionesData = [
    {
      docenteId: docentes[0].id, periodoId: periodo.id, estado: 'FINALIZADA' as EstadoDeclaracion,
      totalHorasLectivas: 6, totalHorasNoLectivas: 11, totalHoras: 17,
      aprobadoDepartamentoId: dirDeptoSistemas.id, fechaAprobacionDepto: new Date('2026-04-15'),
      aprobadoEscuelaId: directorEscuela.id, fechaAprobacionEscuela: new Date('2026-04-20'),
      vistoBuenoDecanoId: decano.id, fechaVistoBueno: new Date('2026-04-25'),
    },
    {
      docenteId: docentes[1].id, periodoId: periodo.id, estado: 'APROBADA_ESCUELA' as EstadoDeclaracion,
      totalHorasLectivas: 6, totalHorasNoLectivas: 10, totalHoras: 16,
      aprobadoDepartamentoId: dirDeptoSistemas.id, fechaAprobacionDepto: new Date('2026-04-15'),
      aprobadoEscuelaId: directorEscuela.id, fechaAprobacionEscuela: new Date('2026-04-20'),
    },
    {
      docenteId: docentes[2].id, periodoId: periodo.id, estado: 'ENVIADA' as EstadoDeclaracion,
      totalHorasLectivas: 9, totalHorasNoLectivas: 5, totalHoras: 14,
    },
    {
      docenteId: docentes[4].id, periodoId: periodo.id, estado: 'BORRADOR' as EstadoDeclaracion,
      totalHorasLectivas: 12, totalHorasNoLectivas: 6, totalHoras: 18,
    },
    {
      docenteId: docentes[3].id, periodoId: periodo.id, estado: 'RECHAZADA' as EstadoDeclaracion,
      totalHorasLectivas: 4, totalHorasNoLectivas: 0, totalHoras: 4,
      aprobadoDepartamentoId: dirDeptoSistemas.id, fechaAprobacionDepto: new Date('2026-04-16'),
      observaciones: 'Faltan horas no lectivas. Completar carga.',
    },
  ];

  let declaracionCount = 0;
  for (const dec of declaracionesData) {
    await prisma.declaracionCarga.create({ data: dec });
    declaracionCount++;
  }
  console.log(`  ✅ ${declaracionCount} declaraciones de carga creadas`);

  // ── Summary ────────────────────────────────────────
  console.log('\n🎉 Seed completo!');
  console.log(`   Periodo: ${periodo.nombre}`);
  console.log(`   Franjas: ${franjasData.length} (Lun-Vie, 7:00-22:00)`);
  console.log(`   Aulas: ${aulasData.length}`);
  console.log(`   Facultad: 1 (Ingeniería), Deptos: 2, Escuelas: 1, Curricula: 1`);
  console.log(`   CursosCurricula: ${cursosCurriculaData.length}`);
  console.log(`   Docentes: ${docentes.length}`);
  console.log(`   Cursos: ${cursos.length}`);
  console.log(`   Grupos: ${gruposCreated.length}`);
  console.log(`   Docente-Grupo: ${docenteGrupoCount}`);
  console.log(`   Carga Lectiva: ${cargaLectivaCount} asigs`);
  console.log(`   Carga No Lectiva: ${cargaNoLectivaCount}`);
  console.log(`   Declaraciones: ${declaracionCount}`);
  console.log(`   Feriados: ${feriadosData.length}`);
  console.log(`   Usuarios: 10 (admin, decano, 2 dir depto, 2 sec depto, dir escuela, sec academica, 3 docentes)`);
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
