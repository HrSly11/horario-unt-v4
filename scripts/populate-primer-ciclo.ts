import 'dotenv/config';
import { PrismaClient, CategoriaDocente, TipoDocente, ModalidadDocente, TipoAula, DiaSemana, UserRole, EstadoDeclaracion, TipoCargaNoLectiva, TipoAsignacion, EstadoPeriodo } from '../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

const connectionString = process.env.DATABASE_URL!;
const pool = new pg.Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🌱 Populando primer ciclo (2026-I)...');

  // 1. Obtener datos base
  const periodo2026I = await prisma.periodoAcademico.findUniqueOrThrow({ where: { nombre: '2026-I' } });
  const franjas = await prisma.franjaHoraria.findMany();
  const getFranja = (dia: DiaSemana, horaInicio: string) => franjas.find(f => f.dia === dia && f.horaInicio === horaInicio);
  const deptoSistemas = await prisma.departamento.findFirstOrThrow({ where: { nombre: 'Departamento de Ingeniería de Sistemas' } });
  const deptoMatematicas = await prisma.departamento.findFirstOrThrow({ where: { nombre: 'Departamento de Matemáticas' } });
  const deptoEstadistica = await prisma.departamento.findFirstOrThrow({ where: { nombre: 'Departamento de Estadística' } });
  const deptoPsicologia = await prisma.departamento.findFirstOrThrow({ where: { nombre: 'Departamento de Ciencias Psicológicas' } });
  const deptoLengua = await prisma.departamento.findFirstOrThrow({ where: { nombre: 'Departamento de Lengua y Literatura' } });
  const deptoIndustrial = await prisma.departamento.findFirstOrThrow({ where: { nombre: 'Departamento de Ingeniería Industrial' } });

  // 2. Añadir docentes faltantes
  const docentesData = [
    { nombre: 'Paul Cotrina Castellanos', email: 'pcotrina@unitru.edu.pe', categoria: CategoriaDocente.ASOCIADO, tipo: TipoDocente.NOMBRADO, antiguedad: new Date('2010-01-01'), dni: '11223344', codigoIBM: 'IBM018', modalidad: ModalidadDocente.TIEMPO_COMPLETO, horasContrato: 40, departamentoId: deptoSistemas.id, gradoAcademico: 'Magíster', especialidad: 'Programación', experienciaAnios: 15 },
    { nombre: 'Bertha Urtecho Zavaleta', email: 'burtecho@unitru.edu.pe', categoria: CategoriaDocente.ASOCIADO, tipo: TipoDocente.NOMBRADO, antiguedad: new Date('2005-01-01'), dni: '22334455', codigoIBM: 'IBM019', modalidad: ModalidadDocente.TIEMPO_COMPLETO, horasContrato: 40, departamentoId: deptoPsicologia.id, gradoAcademico: 'Magíster', especialidad: 'Desarrollo Personal', experienciaAnios: 20 },
    { nombre: 'José Luis Ponte Bejarano', email: 'jponte@unitru.edu.pe', categoria: CategoriaDocente.PRINCIPAL, tipo: TipoDocente.NOMBRADO, antiguedad: new Date('1995-01-01'), dni: '33445566', codigoIBM: 'IBM020', modalidad: ModalidadDocente.TIEMPO_COMPLETO, horasContrato: 40, departamentoId: deptoMatematicas.id, gradoAcademico: 'Doctor', especialidad: 'Matemáticas', experienciaAnios: 30 },
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

  // Obtener todos los docentes (incluyendo los ya existentes)
  const marcelino = await prisma.docente.findUniqueOrThrow({ where: { email: 'mtorres@unitru.edu.pe' } });
  const alberto = await prisma.docente.findUniqueOrThrow({ where: { email: 'amendoza@unitru.edu.pe' } });
  const paul = await prisma.docente.findUniqueOrThrow({ where: { email: 'pcotrina@unitru.edu.pe' } });
  const bertha = await prisma.docente.findUniqueOrThrow({ where: { email: 'burtecho@unitru.edu.pe' } });
  const joseLuis = await prisma.docente.findUniqueOrThrow({ where: { email: 'jponte@unitru.edu.pe' } });
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

  // 6. Crear grupos para sección A (si no existen)
  const crearGrupo = async (curso: any) => {
    let grupo = await prisma.grupo.findFirst({
      where: { cursoId: curso.id, periodoAcademicoId: periodo2026I.id, nombre: 'A' },
    });
    if (!grupo) {
      grupo = await prisma.grupo.create({
        data: {
          nombre: 'A',
          seccion: 'A',
          cursoId: curso.id,
          periodoAcademicoId: periodo2026I.id,
          numAlumnos: 30,
        },
      });
    }
    return grupo;
  };

  const grupoIntroProg = await crearGrupo(cursoIntroProg);
  const grupoIntroIngSist = await crearGrupo(cursoIntroIngSist);
  const grupoDesarrolloPersonal = await crearGrupo(cursoDesarrolloPersonal);
  const grupoPensamientoLogico = await crearGrupo(cursoPensamientoLogico);
  const grupoLecturaRedaccion = await crearGrupo(cursoLecturaRedaccion);
  const grupoIntroAnalisis = await crearGrupo(cursoIntroAnalisis);
  const grupoEstadistica = await crearGrupo(cursoEstadistica);
  console.log('  ✅ Grupos creados o verificados');

  // 7. Crear AsignacionCargaLectiva
  const crearAsignacionCarga = async (docente: any, grupo: any, tipo: TipoAsignacion, horas: number, grupoLaboratorio?: number) => {
    const existing = await prisma.asignacionCargaLectiva.findFirst({
      where: { docenteId: docente.id, grupoId: grupo.id, periodoId: periodo2026I.id, tipo, grupoLaboratorio },
    });
    if (!existing) {
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
    }
    return existing;
  };

  // Marcelino Torres: Intro a la Programación (Teoría: 2h, Lab: 2h)
  await crearAsignacionCarga(marcelino, grupoIntroProg, TipoAsignacion.TEORIA, 2);
  await crearAsignacionCarga(marcelino, grupoIntroProg, TipoAsignacion.LABORATORIO, 2, 1);
  
  // Alberto Mendoza: Intro a la Ingeniería de Sistemas (Teoría:1h, Práctica:2h)
  await crearAsignacionCarga(alberto, grupoIntroIngSist, TipoAsignacion.TEORIA, 1);
  await crearAsignacionCarga(alberto, grupoIntroIngSist, TipoAsignacion.PRACTICA, 2);
  
  // Paul Cotrina: Intro a la Programación (Lab: 2h, grupo 2)
  await crearAsignacionCarga(paul, grupoIntroProg, TipoAsignacion.LABORATORIO, 2, 2);
  
  // Bertha Urtecho: Desarrollo Personal (Teoría:2h, Práctica:2h)
  await crearAsignacionCarga(bertha, grupoDesarrolloPersonal, TipoAsignacion.TEORIA, 2);
  await crearAsignacionCarga(bertha, grupoDesarrolloPersonal, TipoAsignacion.PRACTICA, 2);
  
  // José Luis Ponte: Pensamiento Lógico (Teoría:2h, Práctica:2h)
  await crearAsignacionCarga(joseLuis, grupoPensamientoLogico, TipoAsignacion.TEORIA, 2);
  await crearAsignacionCarga(joseLuis, grupoPensamientoLogico, TipoAsignacion.PRACTICA, 2);
  
  // Jorge Ríos: Lectura y Redacción (Teoría:2h, Práctica:2h)
  await crearAsignacionCarga(jorge, grupoLecturaRedaccion, TipoAsignacion.TEORIA, 2);
  await crearAsignacionCarga(jorge, grupoLecturaRedaccion, TipoAsignacion.PRACTICA, 2);
  
  // Segundo Guíbar: Intro al Análisis (Teoría:2h, Práctica:4h)
  await crearAsignacionCarga(segundo, grupoIntroAnalisis, TipoAsignacion.TEORIA, 2);
  await crearAsignacionCarga(segundo, grupoIntroAnalisis, TipoAsignacion.PRACTICA, 4);
  
  // Miguel Ipanaque: Estadística (Práctica:4h)
  await crearAsignacionCarga(miguel, grupoEstadistica, TipoAsignacion.PRACTICA, 4);
  
  // Martha Cardoso: Estadística (Teoría:2h, Práctica:2h)
  await crearAsignacionCarga(martha, grupoEstadistica, TipoAsignacion.TEORIA, 2);
  await crearAsignacionCarga(martha, grupoEstadistica, TipoAsignacion.PRACTICA, 2);
  
  console.log('  ✅ Asignaciones de carga lectiva creadas');

  // 8. Crear docenteGrupo
  const crearDocenteGrupo = async (docente: any, grupo: any) => {
    const existing = await prisma.docenteGrupo.findFirst({
      where: { docenteId: docente.id, grupoId: grupo.id },
    });
    if (!existing) {
      return prisma.docenteGrupo.create({
        data: { docenteId: docente.id, grupoId: grupo.id },
      });
    }
    return existing;
  };

  await crearDocenteGrupo(marcelino, grupoIntroProg);
  await crearDocenteGrupo(alberto, grupoIntroIngSist);
  await crearDocenteGrupo(paul, grupoIntroProg);
  await crearDocenteGrupo(bertha, grupoDesarrolloPersonal);
  await crearDocenteGrupo(joseLuis, grupoPensamientoLogico);
  await crearDocenteGrupo(jorge, grupoLecturaRedaccion);
  await crearDocenteGrupo(segundo, grupoIntroAnalisis);
  await crearDocenteGrupo(miguel, grupoEstadistica);
  await crearDocenteGrupo(martha, grupoEstadistica);
  console.log('  ✅ Vinculaciones docente-grupo creadas');

  // 9. Crear Asignaciones (horario real)
  const crearAsignacion = async (grupo: any, docente: any, aula: any, franja: any, tipo: TipoAsignacion) => {
    // Eliminar cualquier asignación existente que entre en conflicto con las restricciones únicas
    await prisma.asignacion.deleteMany({
      where: {
        OR: [
          { aulaId: aula.id, franjaHorariaId: franja.id, periodoId: periodo2026I.id },
          { docenteId: docente.id, franjaHorariaId: franja.id, periodoId: periodo2026I.id },
          { grupoId: grupo.id, franjaHorariaId: franja.id, periodoId: periodo2026I.id },
        ],
      },
    });
    
    // Crear la nueva asignación
    return prisma.asignacion.create({
      data: {
        grupoId: grupo.id,
        docenteId: docente.id,
        aulaId: aula.id,
        franjaHorariaId: franja.id,
        periodoId: periodo2026I.id,
        tipo,
      },
    });
  };

  // --- Marcelino Torres ---
  // Lunes 7-9 (2h teoría, Posgrado A-307)
  await crearAsignacion(grupoIntroProg, marcelino, aula307, getFranja(DiaSemana.LUNES, '07:00')!, TipoAsignacion.TEORIA);
  await crearAsignacion(grupoIntroProg, marcelino, aula307, getFranja(DiaSemana.LUNES, '08:00')!, TipoAsignacion.TEORIA);
  // Lunes 14-18 (4h laboratorio, Laboratorio 3)
  await crearAsignacion(grupoIntroProg, marcelino, lab3, getFranja(DiaSemana.LUNES, '14:00')!, TipoAsignacion.LABORATORIO);
  await crearAsignacion(grupoIntroProg, marcelino, lab3, getFranja(DiaSemana.LUNES, '15:00')!, TipoAsignacion.LABORATORIO);
  await crearAsignacion(grupoIntroProg, marcelino, lab3, getFranja(DiaSemana.LUNES, '16:00')!, TipoAsignacion.LABORATORIO);
  await crearAsignacion(grupoIntroProg, marcelino, lab3, getFranja(DiaSemana.LUNES, '17:00')!, TipoAsignacion.LABORATORIO);

  // --- Alberto Mendoza ---
  // Martes 7-10 (3h, Posgrado A-307)
  await crearAsignacion(grupoIntroIngSist, alberto, aula307, getFranja(DiaSemana.MARTES, '07:00')!, TipoAsignacion.TEORIA);
  await crearAsignacion(grupoIntroIngSist, alberto, aula307, getFranja(DiaSemana.MARTES, '08:00')!, TipoAsignacion.PRACTICA);
  await crearAsignacion(grupoIntroIngSist, alberto, aula307, getFranja(DiaSemana.MARTES, '09:00')!, TipoAsignacion.PRACTICA);

  // --- Paul Cotrina ---
  // Jueves 9-13 (4h laboratorio, Laboratorio 4)
  await crearAsignacion(grupoIntroProg, paul, lab4, getFranja(DiaSemana.JUEVES, '09:00')!, TipoAsignacion.LABORATORIO);
  await crearAsignacion(grupoIntroProg, paul, lab4, getFranja(DiaSemana.JUEVES, '10:00')!, TipoAsignacion.LABORATORIO);
  await crearAsignacion(grupoIntroProg, paul, lab4, getFranja(DiaSemana.JUEVES, '11:00')!, TipoAsignacion.LABORATORIO);
  await crearAsignacion(grupoIntroProg, paul, lab4, getFranja(DiaSemana.JUEVES, '12:00')!, TipoAsignacion.LABORATORIO);

  // --- Bertha Urtecho ---
  // Viernes 9-13 (4h, Taller de Confecciones)
  await crearAsignacion(grupoDesarrolloPersonal, bertha, tallerConfecciones, getFranja(DiaSemana.VIERNES, '09:00')!, TipoAsignacion.TEORIA);
  await crearAsignacion(grupoDesarrolloPersonal, bertha, tallerConfecciones, getFranja(DiaSemana.VIERNES, '10:00')!, TipoAsignacion.TEORIA);
  await crearAsignacion(grupoDesarrolloPersonal, bertha, tallerConfecciones, getFranja(DiaSemana.VIERNES, '11:00')!, TipoAsignacion.PRACTICA);
  await crearAsignacion(grupoDesarrolloPersonal, bertha, tallerConfecciones, getFranja(DiaSemana.VIERNES, '12:00')!, TipoAsignacion.PRACTICA);

  // --- José Luis Ponte ---
  // Martes 10-13 (3h, Posgrado A-307)
  await crearAsignacion(grupoPensamientoLogico, joseLuis, aula307, getFranja(DiaSemana.MARTES, '10:00')!, TipoAsignacion.TEORIA);
  await crearAsignacion(grupoPensamientoLogico, joseLuis, aula307, getFranja(DiaSemana.MARTES, '11:00')!, TipoAsignacion.TEORIA);
  await crearAsignacion(grupoPensamientoLogico, joseLuis, aula307, getFranja(DiaSemana.MARTES, '12:00')!, TipoAsignacion.PRACTICA);
  // Viernes 7-9 (2h, Posgrado A-307)
  await crearAsignacion(grupoPensamientoLogico, joseLuis, aula307, getFranja(DiaSemana.VIERNES, '07:00')!, TipoAsignacion.PRACTICA);
  await crearAsignacion(grupoPensamientoLogico, joseLuis, aula307, getFranja(DiaSemana.VIERNES, '08:00')!, TipoAsignacion.PRACTICA);

  // --- Jorge Ríos ---
  // Jueves 14-18 (4h, Posgrado A-303)
  await crearAsignacion(grupoLecturaRedaccion, jorge, aula303, getFranja(DiaSemana.JUEVES, '14:00')!, TipoAsignacion.TEORIA);
  await crearAsignacion(grupoLecturaRedaccion, jorge, aula303, getFranja(DiaSemana.JUEVES, '15:00')!, TipoAsignacion.TEORIA);
  await crearAsignacion(grupoLecturaRedaccion, jorge, aula303, getFranja(DiaSemana.JUEVES, '16:00')!, TipoAsignacion.PRACTICA);
  await crearAsignacion(grupoLecturaRedaccion, jorge, aula303, getFranja(DiaSemana.JUEVES, '17:00')!, TipoAsignacion.PRACTICA);

  // --- Segundo Guíbar ---
  // Lunes 9-13 (4h, Posgrado A-307)
  await crearAsignacion(grupoIntroAnalisis, segundo, aula307, getFranja(DiaSemana.LUNES, '09:00')!, TipoAsignacion.TEORIA);
  await crearAsignacion(grupoIntroAnalisis, segundo, aula307, getFranja(DiaSemana.LUNES, '10:00')!, TipoAsignacion.PRACTICA);
  await crearAsignacion(grupoIntroAnalisis, segundo, aula307, getFranja(DiaSemana.LUNES, '11:00')!, TipoAsignacion.PRACTICA);
  await crearAsignacion(grupoIntroAnalisis, segundo, aula307, getFranja(DiaSemana.LUNES, '12:00')!, TipoAsignacion.PRACTICA);
  // Martes 16-18 (2h, Posgrado A-307)
  await crearAsignacion(grupoIntroAnalisis, segundo, aula307, getFranja(DiaSemana.MARTES, '16:00')!, TipoAsignacion.PRACTICA);
  await crearAsignacion(grupoIntroAnalisis, segundo, aula307, getFranja(DiaSemana.MARTES, '17:00')!, TipoAsignacion.PRACTICA);

  // --- Miguel Ipanaque ---
  // Jueves 7-9 (2h, Taller de Confecciones)
  await crearAsignacion(grupoEstadistica, miguel, tallerConfecciones, getFranja(DiaSemana.JUEVES, '07:00')!, TipoAsignacion.PRACTICA);
  await crearAsignacion(grupoEstadistica, miguel, tallerConfecciones, getFranja(DiaSemana.JUEVES, '08:00')!, TipoAsignacion.PRACTICA);

  // --- Martha Cardoso ---
  // Viernes 14-16 (2h teoría, Posgrado A-303)
  await crearAsignacion(grupoEstadistica, martha, aula303, getFranja(DiaSemana.VIERNES, '14:00')!, TipoAsignacion.TEORIA);
  await crearAsignacion(grupoEstadistica, martha, aula303, getFranja(DiaSemana.VIERNES, '15:00')!, TipoAsignacion.TEORIA);
  // Viernes 16-18 (2h práctica, Taller de Confecciones)
  await crearAsignacion(grupoEstadistica, martha, tallerConfecciones, getFranja(DiaSemana.VIERNES, '16:00')!, TipoAsignacion.PRACTICA);
  await crearAsignacion(grupoEstadistica, martha, tallerConfecciones, getFranja(DiaSemana.VIERNES, '17:00')!, TipoAsignacion.PRACTICA);

  console.log('  ✅ Asignaciones de horario creadas');

  console.log('✅ Primer ciclo populado exitosamente!');
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
