import 'dotenv/config';
import { PrismaClient, CategoriaDocente, TipoDocente, ModalidadDocente, TipoAula, DiaSemana, TipoAsignacion } from '../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

const connectionString = process.env.DATABASE_URL!;
const pool = new pg.Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🌱 Actualizando primer ciclo (2026-I)...');

  // 1. Obtener datos base
  const periodo2026I = await prisma.periodoAcademico.findUniqueOrThrow({ where: { nombre: '2026-I' } });
  const franjas = await prisma.franjaHoraria.findMany();
  const getFranja = (dia: DiaSemana, horaInicio: string) => franjas.find(f => f.dia === dia && f.horaInicio === horaInicio);
  const deptoSistemas = await prisma.departamento.findFirstOrThrow({ where: { nombre: 'Departamento de Ingeniería de Sistemas' } });
  const deptoEstadistica = await prisma.departamento.findFirstOrThrow({ where: { nombre: 'Departamento de Estadística' } });
  const deptoPsicologia = await prisma.departamento.findFirstOrThrow({ where: { nombre: 'Departamento de Ciencias Psicológicas' } });
  const deptoLengua = await prisma.departamento.findFirstOrThrow({ where: { nombre: 'Departamento de Lengua y Literatura' } });
  const deptoMatematicas = await prisma.departamento.findFirstOrThrow({ where: { nombre: 'Departamento de Matemáticas' } });

  // 2. Añadir docentes faltantes
  const docentesData = [
    { nombre: 'Paul Cotrina Castellanos', email: 'pcotrina@unitru.edu.pe', categoria: CategoriaDocente.ASOCIADO, tipo: TipoDocente.NOMBRADO, antiguedad: new Date('2010-01-01'), dni: '11223344', codigoIBM: 'IBM018', modalidad: ModalidadDocente.TIEMPO_COMPLETO, horasContrato: 40, departamentoId: deptoSistemas.id, gradoAcademico: 'Magíster', especialidad: 'Programación', experienciaAnios: 15 },
    { nombre: 'Bertha Urtecho Zavaleta', email: 'burtecho@unitru.edu.pe', categoria: CategoriaDocente.ASOCIADO, tipo: TipoDocente.NOMBRADO, antiguedad: new Date('2005-01-01'), dni: '22334455', codigoIBM: 'IBM019', modalidad: ModalidadDocente.TIEMPO_COMPLETO, horasContrato: 40, departamentoId: deptoPsicologia.id, gradoAcademico: 'Magíster', especialidad: 'Desarrollo Personal', experienciaAnios: 20 },
    { nombre: 'Jorge Luis Ríos Gonzales', email: 'jrios@unitru.edu.pe', categoria: CategoriaDocente.ASOCIADO, tipo: TipoDocente.NOMBRADO, antiguedad: new Date('2008-01-01'), dni: '44556677', codigoIBM: 'IBM021', modalidad: ModalidadDocente.TIEMPO_COMPLETO, horasContrato: 40, departamentoId: deptoLengua.id, gradoAcademico: 'Magíster', especialidad: 'Lectura y Redacción', experienciaAnios: 17 },
    { nombre: 'Segundo Guíbar Obeso', email: 'sguibar@unitru.edu.pe', categoria: CategoriaDocente.PRINCIPAL, tipo: TipoDocente.NOMBRADO, antiguedad: new Date('1990-01-01'), dni: '55667788', codigoIBM: 'IBM022', modalidad: ModalidadDocente.TIEMPO_COMPLETO, horasContrato: 40, departamentoId: deptoMatematicas.id, gradoAcademico: 'Doctor', especialidad: 'Análisis Matemático', experienciaAnios: 35 },
    { nombre: 'Miguel Ipanaque Zapata', email: 'mipanaque@unitru.edu.pe', categoria: CategoriaDocente.ASOCIADO, tipo: TipoDocente.NOMBRADO, antiguedad: new Date('2012-01-01'), dni: '66778899', codigoIBM: 'IBM023', modalidad: ModalidadDocente.TIEMPO_COMPLETO, horasContrato: 40, departamentoId: deptoEstadistica.id, gradoAcademico: 'Magíster', especialidad: 'Estadística', experienciaAnios: 13 },
    { nombre: 'Martha Cardoso', email: 'mcardoso@unitru.edu.pe', categoria: CategoriaDocente.PRINCIPAL, tipo: TipoDocente.NOMBRADO, antiguedad: new Date('2000-01-01'), dni: '77889900', codigoIBM: 'IBM024', modalidad: ModalidadDocente.TIEMPO_COMPLETO, horasContrato: 40, departamentoId: deptoEstadistica.id, gradoAcademico: 'Doctor', especialidad: 'Estadística General', experienciaAnios: 25 },
  ];

  const docentesCreados = await Promise.all(
    docentesData.map(async d => {
      const existing = await prisma.docente.findUnique({ where: { email: d.email } });
      if (existing) return existing;
      return prisma.docente.create({ data: d });
    })
  );
  console.log(`  ✅ ${docentesCreados.length} docentes procesados`);

  // Obtener todos los docentes
  const marcelino = await prisma.docente.findUniqueOrThrow({ where: { email: 'mtorres@unitru.edu.pe' } });
  const alberto = await prisma.docente.findUniqueOrThrow({ where: { email: 'amendoza@unitru.edu.pe' } });
  const paul = await prisma.docente.findUniqueOrThrow({ where: { email: 'pcotrina@unitru.edu.pe' } });
  const bertha = await prisma.docente.findUniqueOrThrow({ where: { email: 'burtecho@unitru.edu.pe' } });
  const jorge = await prisma.docente.findUniqueOrThrow({ where: { email: 'jrios@unitru.edu.pe' } });
  const segundo = await prisma.docente.findUniqueOrThrow({ where: { email: 'sguibar@unitru.edu.pe' } });
  const miguel = await prisma.docente.findUniqueOrThrow({ where: { email: 'mipanaque@unitru.edu.pe' } });
  const martha = await prisma.docente.findUniqueOrThrow({ where: { email: 'mcardoso@unitru.edu.pe' } });

  // 3. Añadir aula faltante
  let tallerConfecciones = await prisma.aula.findUnique({ where: { codigo: 'TALLER-CONFECCIONES' } });
  if (!tallerConfecciones) {
    tallerConfecciones = await prisma.aula.create({
      data: {
        codigo: 'TALLER-CONFECCIONES',
        nombre: 'Taller de Confecciones de Ingeniería Industrial',
        capacidad: 30,
        tipo: TipoAula.LABORATORIO,
        edificio: 'Pabellón de Ingeniería Industrial',
        piso: 1,
      },
    });
    console.log('  ✅ Aula Taller de Confecciones creada');
  }

  // 4. Obtener aulas necesarias
  const aula307 = await prisma.aula.findUniqueOrThrow({ where: { codigo: 'EPG-307' } });
  const lab3 = await prisma.aula.findUniqueOrThrow({ where: { codigo: 'LAB-3' } });
  const lab4 = await prisma.aula.findUniqueOrThrow({ where: { codigo: 'LAB-4' } });
  const aula303 = await prisma.aula.findUniqueOrThrow({ where: { codigo: 'EPG-303' } });

  // 5. Obtener cursos del primer ciclo
  const cursoIntroProg = await prisma.curso.findUniqueOrThrow({ where: { codigo: 'EE-102' } }); // Introducción a la Programación
  const cursoIntroIngSist = await prisma.curso.findUniqueOrThrow({ where: { codigo: 'EE-101' } }); // Introducción a la Ingeniería de Sistemas
  const cursoDesarrolloPersonal = await prisma.curso.findUniqueOrThrow({ where: { codigo: 'EG-103' } }); // Desarrollo Personal
  const cursoPensamientoLogico = await prisma.curso.findUniqueOrThrow({ where: { codigo: 'EG-101' } }); // Desarrollo del Pensamiento Lógico Matemático
  const cursoLecturaRedaccion = await prisma.curso.findUniqueOrThrow({ where: { codigo: 'EG-102' } }); // Lectura Crítica y Redacción de Textos Académicos
  const cursoIntroAnalisis = await prisma.curso.findUniqueOrThrow({ where: { codigo: 'EG-104' } }); // Introducción al Análisis Matemático
  const cursoEstadistica = await prisma.curso.findUniqueOrThrow({ where: { codigo: 'EG-105' } }); // Estadística General

  // 6. Primero, ELIMINAR todas las asignaciones, asignaciones de carga lectiva, docente-grupo y grupos existentes para este ciclo
  console.log('  🗑️  Limpiando datos existentes del primer ciclo...');
  await prisma.asignacion.deleteMany({ where: { periodoId: periodo2026I.id } });
  await prisma.asignacionCargaLectiva.deleteMany({ where: { periodoId: periodo2026I.id } });
  await prisma.docenteGrupo.deleteMany({ where: { grupo: { periodoAcademicoId: periodo2026I.id, curso: { ciclo: 1 } } } });
  await prisma.grupo.deleteMany({ where: { periodoAcademicoId: periodo2026I.id, curso: { ciclo: 1 } } });

  // 7. Crear grupos para sección A (nuevos)
  const crearGrupo = async (curso: any) => {
    return prisma.grupo.create({
      data: {
        nombre: 'A',
        seccion: 'A',
        cursoId: curso.id,
        periodoAcademicoId: periodo2026I.id,
        numAlumnos: 30,
      },
    });
  };

  const grupoIntroProg = await crearGrupo(cursoIntroProg);
  const grupoIntroIngSist = await crearGrupo(cursoIntroIngSist);
  const grupoDesarrolloPersonal = await crearGrupo(cursoDesarrolloPersonal);
  const grupoPensamientoLogico = await crearGrupo(cursoPensamientoLogico);
  const grupoLecturaRedaccion = await crearGrupo(cursoLecturaRedaccion);
  const grupoIntroAnalisis = await crearGrupo(cursoIntroAnalisis);
  const grupoEstadistica = await crearGrupo(cursoEstadistica);
  console.log('  ✅ Grupos creados');

  // 8. Crear AsignacionCargaLectiva
  const crearAsignacionCarga = async (docente: any, grupo: any, tipo: TipoAsignacion, horas: number, grupoLaboratorio?: number) => {
    return prisma.asignacionCargaLectiva.create({
      data: {
        docenteId: docente.id,
        grupoId: grupo.id,
        periodoId: periodo2026I.id,
        tipo,
        horasAsignadas: horas,
        grupoLaboratorio,
      },
    });
  };

  // Marcelino Torres: Intro a la Programación (Teoría: 2h, Lab: 2h (grupo 1 y 2)
  await crearAsignacionCarga(marcelino, grupoIntroProg, TipoAsignacion.TEORIA, 2);
  await crearAsignacionCarga(marcelino, grupoIntroProg, TipoAsignacion.LABORATORIO, 2, 1);
  await crearAsignacionCarga(marcelino, grupoIntroProg, TipoAsignacion.LABORATORIO, 2, 2);
  
  // Alberto Mendoza: Intro a la Ingeniería de Sistemas (Teoría: 3h)
  await crearAsignacionCarga(alberto, grupoIntroIngSist, TipoAsignacion.TEORIA, 3);
  
  // Paul Cotrina: Intro a la Programación (Lab: 2h (grupo 1), 2h (grupo 2))
  await crearAsignacionCarga(paul, grupoIntroProg, TipoAsignacion.LABORATORIO, 2, 1);
  await crearAsignacionCarga(paul, grupoIntroProg, TipoAsignacion.LABORATORIO, 2, 2);
  
  // Bertha Urtecho: Desarrollo Personal (4h)
  await crearAsignacionCarga(bertha, grupoDesarrolloPersonal, TipoAsignacion.TEORIA, 4);
  
  // Jorge Ríos: Pensamiento Lógico (3h + 2h = 5h)
  await crearAsignacionCarga(jorge, grupoPensamientoLogico, TipoAsignacion.TEORIA, 5);
  
  // Jorge Ríos: Lectura y Redacción (4h)
  await crearAsignacionCarga(jorge, grupoLecturaRedaccion, TipoAsignacion.TEORIA, 4);
  
  // Segundo Guíbar: Intro al Análisis (4h + 2h = 6h)
  await crearAsignacionCarga(segundo, grupoIntroAnalisis, TipoAsignacion.TEORIA, 6);
  
  // Miguel Ipanaque: Estadística (Práctica: 2h)
  await crearAsignacionCarga(miguel, grupoEstadistica, TipoAsignacion.PRACTICA, 2);
  
  // Martha Cardoso: Estadística (Teoría: 2h, Laboratorio: 2h)
  await crearAsignacionCarga(martha, grupoEstadistica, TipoAsignacion.TEORIA, 2);
  await crearAsignacionCarga(martha, grupoEstadistica, TipoAsignacion.LABORATORIO, 2);
  
  console.log('  ✅ Asignaciones de carga lectiva creadas');

  // 9. Crear docenteGrupo
  const crearDocenteGrupo = async (docente: any, grupo: any) => {
    return prisma.docenteGrupo.create({
      data: { docenteId: docente.id, grupoId: grupo.id },
    });
  };

  await crearDocenteGrupo(marcelino, grupoIntroProg);
  await crearDocenteGrupo(alberto, grupoIntroIngSist);
  await crearDocenteGrupo(paul, grupoIntroProg);
  await crearDocenteGrupo(bertha, grupoDesarrolloPersonal);
  await crearDocenteGrupo(jorge, grupoPensamientoLogico);
  await crearDocenteGrupo(jorge, grupoLecturaRedaccion);
  await crearDocenteGrupo(segundo, grupoIntroAnalisis);
  await crearDocenteGrupo(miguel, grupoEstadistica);
  await crearDocenteGrupo(martha, grupoEstadistica);
  console.log('  ✅ Vinculaciones docente-grupo creadas');

  // 10. Crear Asignaciones (horario real)
  const crearAsignacion = async (grupo: any, docente: any, aula: any, franja: any, tipo: TipoAsignacion) => {
    if (!franja) {
      console.warn(`  ⚠️ No se encontró franja para la hora indicada`);
      return;
    }
    return prisma.asignacion.upsert({
      where: {
        grupoId_franjaHorariaId_periodoId: {
          grupoId: grupo.id,
          franjaHorariaId: franja.id,
          periodoId: periodo2026I.id,
        },
      },
      create: {
        grupoId: grupo.id,
        docenteId: docente.id,
        aulaId: aula.id,
        franjaHorariaId: franja.id,
        periodoId: periodo2026I.id,
        tipo,
      },
      update: {
        docenteId: docente.id,
        aulaId: aula.id,
        tipo,
      },
    });
  };

  // --- Marcelino Torres
  // Introducción a la Programación (Teoría): Lunes 07:00 – 09:00 (Posgrado A-307)
  for (let i = 7; i < 9; i++) {
    const hora = String(i).padStart(2, '0') + ':00';
    await crearAsignacion(grupoIntroProg, marcelino, aula307, getFranja(DiaSemana.LUNES, hora), TipoAsignacion.TEORIA);
  }
  // Introducción a la Programación (Laboratorio) - GRUPO 1: Lunes 14:00 – 16:00 (Lab. 3)
  for (let i = 14; i < 16; i++) {
    const hora = String(i).padStart(2, '0') + ':00';
    await crearAsignacion(grupoIntroProg, marcelino, lab3, getFranja(DiaSemana.LUNES, hora), TipoAsignacion.LABORATORIO);
  }
  // Introducción a la Programación (Laboratorio) - GRUPO 2: Lunes 16:00 – 18:00 (Lab. 3)
  for (let i = 16; i < 18; i++) {
    const hora = String(i).padStart(2, '0') + ':00';
    await crearAsignacion(grupoIntroProg, marcelino, lab3, getFranja(DiaSemana.LUNES, hora), TipoAsignacion.LABORATORIO);
  }

  // --- Alberto Mendoza
  // Introducción a la Ingeniería de Sistemas: Martes 07:00 – 10:00 (Posgrado A-307)
  for (let i = 7; i < 10; i++) {
    const hora = String(i).padStart(2, '0') + ':00';
    await crearAsignacion(grupoIntroIngSist, alberto, aula307, getFranja(DiaSemana.MARTES, hora), TipoAsignacion.TEORIA);
  }

  // --- Bertha Urtecho
  // Desarrollo Personal: Viernes 09:00 – 13:00 (Taller de confecciones)
  for (let i = 9; i < 13; i++) {
    const hora = String(i).padStart(2, '0') + ':00';
    await crearAsignacion(grupoDesarrolloPersonal, bertha, tallerConfecciones, getFranja(DiaSemana.VIERNES, hora), TipoAsignacion.TEORIA);
  }

  // --- Paul Cotrina
  // Introducción a la Programación (Laboratorio) - GRUPO 1: Jueves 09:00 – 11:00 (LAB. 4)
  for (let i = 9; i < 11; i++) {
    const hora = String(i).padStart(2, '0') + ':00';
    await crearAsignacion(grupoIntroProg, paul, lab4, getFranja(DiaSemana.JUEVES, hora), TipoAsignacion.LABORATORIO);
  }
  // Introducción a la Programación (Laboratorio) - GRUPO 2: Jueves 11:00 – 13:00 (LAB. 4)
  for (let i = 11; i < 13; i++) {
    const hora = String(i).padStart(2, '0') + ':00';
    await crearAsignacion(grupoIntroProg, paul, lab4, getFranja(DiaSemana.JUEVES, hora), TipoAsignacion.LABORATORIO);
  }

  // --- Jorge Luis Ríos Gonzales
  // Desarrollo del pensamiento lógico matemático: Martes 10:00 – 13:00 (Posgrado 307)
  for (let i = 10; i < 13; i++) {
    const hora = String(i).padStart(2, '0') + ':00';
    await crearAsignacion(grupoPensamientoLogico, jorge, aula307, getFranja(DiaSemana.MARTES, hora), TipoAsignacion.TEORIA);
  }
  // Desarrollo del pensamiento lógico matemático: Viernes 07:00 – 09:00 (Posgrado 307)
  for (let i = 7; i < 9; i++) {
    const hora = String(i).padStart(2, '0') + ':00';
    await crearAsignacion(grupoPensamientoLogico, jorge, aula307, getFranja(DiaSemana.VIERNES, hora), TipoAsignacion.TEORIA);
  }
  // Lectura Crítica y Redacción de Textos Académicos: Jueves 14:00 – 18:00 (Posgrado A-303)
  for (let i = 14; i < 18; i++) {
    const hora = String(i).padStart(2, '0') + ':00';
    await crearAsignacion(grupoLecturaRedaccion, jorge, aula303, getFranja(DiaSemana.JUEVES, hora), TipoAsignacion.TEORIA);
  }

  // --- Segundo Guíbar Obeso
  // Introducción al Análisis Matemático: Lunes 09:00 – 13:00 (EPG-307)
  for (let i = 9; i < 13; i++) {
    const hora = String(i).padStart(2, '0') + ':00';
    await crearAsignacion(grupoIntroAnalisis, segundo, aula307, getFranja(DiaSemana.LUNES, hora), TipoAsignacion.TEORIA);
  }
  // Introducción al Análisis Matemático: Martes 16:00 – 18:00 (EPG-307)
  for (let i = 16; i < 18; i++) {
    const hora = String(i).padStart(2, '0') + ':00';
    await crearAsignacion(grupoIntroAnalisis, segundo, aula307, getFranja(DiaSemana.MARTES, hora), TipoAsignacion.TEORIA);
  }

  // --- Miguel Ipanaqué Zapata
  // Estadística General (Práctica): Jueves 07:00 – 09:00 (Taller de confecciones)
  for (let i = 7; i < 9; i++) {
    const hora = String(i).padStart(2, '0') + ':00';
    await crearAsignacion(grupoEstadistica, miguel, tallerConfecciones, getFranja(DiaSemana.JUEVES, hora), TipoAsignacion.PRACTICA);
  }

  // --- Martha Cardoso
  // Estadística General (Teoría): Viernes 14:00 – 16:00 (EPG-303)
  for (let i = 14; i < 16; i++) {
    const hora = String(i).padStart(2, '0') + ':00';
    await crearAsignacion(grupoEstadistica, martha, aula303, getFranja(DiaSemana.VIERNES, hora), TipoAsignacion.TEORIA);
  }
  // Estadística General (Laboratorio): Viernes 16:00 – 18:00 (Taller de Confecciones – Ing. Industrial)
  for (let i = 16; i < 18; i++) {
    const hora = String(i).padStart(2, '0') + ':00';
    await crearAsignacion(grupoEstadistica, martha, tallerConfecciones, getFranja(DiaSemana.VIERNES, hora), TipoAsignacion.LABORATORIO);
  }

  console.log('  ✅ Asignaciones de horario creadas');

  console.log('✅ Primer ciclo actualizado exitosamente!');
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
