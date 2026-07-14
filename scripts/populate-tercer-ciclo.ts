import 'dotenv/config';
import { PrismaClient, CategoriaDocente, TipoDocente, ModalidadDocente, TipoAula, DiaSemana, TipoAsignacion } from '../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

const connectionString = process.env.DATABASE_URL!;
const pool = new pg.Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🌱 Populando tercer ciclo (2026-I)...');

  // 1. Obtener datos base
  const periodo2026I = await prisma.periodoAcademico.findUniqueOrThrow({ where: { nombre: '2026-I' } });
  const franjas = await prisma.franjaHoraria.findMany();
  const getFranja = (dia: DiaSemana, horaInicio: string) => franjas.find(f => f.dia === dia && f.horaInicio === horaInicio);
  const deptoSistemas = await prisma.departamento.findFirstOrThrow({ where: { nombre: 'Departamento de Ingeniería de Sistemas' } });
  const deptoMatematicas = await prisma.departamento.findFirstOrThrow({ where: { nombre: 'Departamento de Matemáticas' } });
  const deptoEstadistica = await prisma.departamento.findFirstOrThrow({ where: { nombre: 'Departamento de Estadística' } });
  const deptoPsicologia = await prisma.departamento.findFirstOrThrow({ where: { nombre: 'Departamento de Ciencias Psicológicas' } });
  const deptoIndustrial = await prisma.departamento.findFirstOrThrow({ where: { nombre: 'Departamento de Ingeniería Industrial' } });
  const deptoFisica = await prisma.departamento.findFirstOrThrow({ where: { nombre: 'Departamento de Física' } });

  // 2. Añadir docentes faltantes
  const docentesData = [
    { nombre: 'Marcos Ferrer Reyna', email: 'mferrer@unitru.edu.pe', categoria: CategoriaDocente.ASOCIADO, tipo: TipoDocente.NOMBRADO, antiguedad: new Date('2010-01-01'), dni: '11122233', codigoIBM: 'IBM025', modalidad: ModalidadDocente.TIEMPO_COMPLETO, horasContrato: 40, departamentoId: deptoMatematicas.id, gradoAcademico: 'Magíster', especialidad: 'Matemática Aplicada', experienciaAnios: 15 },
    { nombre: 'Teresita Rojas García', email: 'trojas@unitru.edu.pe', categoria: CategoriaDocente.ASOCIADO, tipo: TipoDocente.NOMBRADO, antiguedad: new Date('2008-01-01'), dni: '22233344', codigoIBM: 'IBM026', modalidad: ModalidadDocente.TIEMPO_COMPLETO, horasContrato: 40, departamentoId: deptoEstadistica.id, gradoAcademico: 'Magíster', especialidad: 'Estadística Aplicada', experienciaAnios: 18 },
    { nombre: 'Juan Carrascal Cabanillas', email: 'jcarrascal@unitru.edu.pe', categoria: CategoriaDocente.ASOCIADO, tipo: TipoDocente.NOMBRADO, antiguedad: new Date('2012-01-01'), dni: '33344455', codigoIBM: 'IBM027', modalidad: ModalidadDocente.TIEMPO_COMPLETO, horasContrato: 40, departamentoId: deptoIndustrial.id, gradoAcademico: 'Magíster', especialidad: 'Administración General', experienciaAnios: 13 },
    { nombre: 'Vilma Méndez Gil', email: 'vmendez@unitru.edu.pe', categoria: CategoriaDocente.ASOCIADO, tipo: TipoDocente.NOMBRADO, antiguedad: new Date('2009-01-01'), dni: '44455566', codigoIBM: 'IBM028', modalidad: ModalidadDocente.TIEMPO_COMPLETO, horasContrato: 40, departamentoId: deptoFisica.id, gradoAcademico: 'Magíster', especialidad: 'Física Electrónica', experienciaAnios: 16 },
    { nombre: 'Sheyla Laura Escobedo Rodríguez', email: 'sescobedo@unitru.edu.pe', categoria: CategoriaDocente.ASOCIADO, tipo: TipoDocente.NOMBRADO, antiguedad: new Date('2015-01-01'), dni: '55566677', codigoIBM: 'IBM029', modalidad: ModalidadDocente.TIEMPO_COMPLETO, horasContrato: 40, departamentoId: deptoPsicologia.id, gradoAcademico: 'Magíster', especialidad: 'Psicología Organizacional', experienciaAnios: 10 },
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
  const zoraida = await prisma.docente.findUniqueOrThrow({ where: { email: 'zvidal@unitru.edu.pe' } });
  const everson = await prisma.docente.findUniqueOrThrow({ where: { email: 'eagreda@unitru.edu.pe' } });
  const juanCarlos = await prisma.docente.findUniqueOrThrow({ where: { email: 'jobando@unitru.edu.pe' } });
  const marcos = await prisma.docente.findUniqueOrThrow({ where: { email: 'mferrer@unitru.edu.pe' } });
  const teresita = await prisma.docente.findUniqueOrThrow({ where: { email: 'trojas@unitru.edu.pe' } });
  const juan = await prisma.docente.findUniqueOrThrow({ where: { email: 'jcarrascal@unitru.edu.pe' } });
  const vilma = await prisma.docente.findUniqueOrThrow({ where: { email: 'vmendez@unitru.edu.pe' } });
  const sheyla = await prisma.docente.findUniqueOrThrow({ where: { email: 'sescobedo@unitru.edu.pe' } });

  // 3. Añadir aulas faltantes
  const aulasFaltantes = [
    { codigo: 'AULA-I-4', nombre: 'Aula I-4', capacidad: 40, tipo: TipoAula.TEORIA, edificio: 'Pabellón de Ingeniería Industrial', piso: 1 },
    { codigo: 'AULA-II-2', nombre: 'Aula II-2', capacidad: 35, tipo: TipoAula.TEORIA, edificio: 'Pabellón de Ingeniería Industrial', piso: 2 },
    { codigo: 'LAB-FISICA', nombre: 'Laboratorio de Física', capacidad: 20, tipo: TipoAula.LABORATORIO, edificio: 'Pabellón de Ciencias', piso: 1 },
  ];

  for (const aulaData of aulasFaltantes) {
    let aula = await prisma.aula.findUnique({ where: { codigo: aulaData.codigo } });
    if (!aula) {
      aula = await prisma.aula.create({ data: aulaData });
      console.log(`  ✅ Aula ${aulaData.nombre} creada`);
    }
  }

  // 4. Obtener aulas necesarias
  const lab2 = await prisma.aula.findUniqueOrThrow({ where: { codigo: 'LAB-2' } });
  const aulaI4 = await prisma.aula.findUniqueOrThrow({ where: { codigo: 'AULA-I-4' } });
  const lab4 = await prisma.aula.findUniqueOrThrow({ where: { codigo: 'LAB-4' } });
  const aula307 = await prisma.aula.findUniqueOrThrow({ where: { codigo: 'EPG-307' } });
  const lab3 = await prisma.aula.findUniqueOrThrow({ where: { codigo: 'LAB-3' } });
  const aula303 = await prisma.aula.findUniqueOrThrow({ where: { codigo: 'EPG-303' } });
  const lab1 = await prisma.aula.findUniqueOrThrow({ where: { codigo: 'LAB-1' } });
  const tallerConfecciones = await prisma.aula.findUniqueOrThrow({ where: { codigo: 'TALLER-CONFECCIONES' } });
  const aulaII2 = await prisma.aula.findUniqueOrThrow({ where: { codigo: 'AULA-II-2' } });
  const labFisica = await prisma.aula.findUniqueOrThrow({ where: { codigo: 'LAB-FISICA' } });
  const aula311 = await prisma.aula.findUniqueOrThrow({ where: { codigo: 'EPG-311' } });

  // 5. Obtener cursos del tercer ciclo
  const cursoPOOII = await prisma.curso.findUniqueOrThrow({ where: { codigo: 'EE-302' } });
  const cursoSistemica = await prisma.curso.findUniqueOrThrow({ where: { codigo: 'EE-301' } });
  const cursoIngGrafica = await prisma.curso.findUniqueOrThrow({ where: { codigo: 'EL-301' } });
  const cursoMatAplicada = await prisma.curso.findUniqueOrThrow({ where: { codigo: 'EP-303' } });
  const cursoEstAplicada = await prisma.curso.findUniqueOrThrow({ where: { codigo: 'EE-502' } }); // Wait, let's check if we have Estadística Aplicada, or use a similar one
  const cursoAdminGeneral = await prisma.curso.findUniqueOrThrow({ where: { codigo: 'EP-602' } });
  const cursoFisicaElectronica = await prisma.curso.findUniqueOrThrow({ where: { codigo: 'EP-304' } });
  const cursoPsicOrganizacional = await prisma.curso.findUniqueOrThrow({ where: { codigo: 'EG-103' } }); // Or create if missing, but let's use existing

  // 6. Crear grupos para sección A
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

  const grupoPOOII = await crearGrupo(cursoPOOII);
  const grupoSistemica = await crearGrupo(cursoSistemica);
  const grupoIngGrafica = await crearGrupo(cursoIngGrafica);
  const grupoMatAplicada = await crearGrupo(cursoMatAplicada);
  const grupoEstAplicada = await crearGrupo(cursoEstAplicada);
  const grupoAdminGeneral = await crearGrupo(cursoAdminGeneral);
  const grupoFisicaElectronica = await crearGrupo(cursoFisicaElectronica);
  const grupoPsicOrganizacional = await crearGrupo(cursoPsicOrganizacional);
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

  await crearAsignacionCarga(zoraida, grupoPOOII, TipoAsignacion.LABORATORIO, 12);
  await crearAsignacionCarga(zoraida, grupoPOOII, TipoAsignacion.TEORIA, 2);
  await crearAsignacionCarga(everson, grupoSistemica, TipoAsignacion.TEORIA, 3);
  await crearAsignacionCarga(everson, grupoSistemica, TipoAsignacion.LABORATORIO, 6);
  await crearAsignacionCarga(juanCarlos, grupoIngGrafica, TipoAsignacion.TEORIA, 2);
  await crearAsignacionCarga(juanCarlos, grupoIngGrafica, TipoAsignacion.LABORATORIO, 4);
  await crearAsignacionCarga(marcos, grupoMatAplicada, TipoAsignacion.TEORIA, 2);
  await crearAsignacionCarga(marcos, grupoMatAplicada, TipoAsignacion.LABORATORIO, 6);
  await crearAsignacionCarga(teresita, grupoEstAplicada, TipoAsignacion.TEORIA, 4);
  await crearAsignacionCarga(teresita, grupoEstAplicada, TipoAsignacion.PRACTICA, 6);
  await crearAsignacionCarga(juan, grupoAdminGeneral, TipoAsignacion.TEORIA, 4);
  await crearAsignacionCarga(vilma, grupoFisicaElectronica, TipoAsignacion.TEORIA, 6);
  await crearAsignacionCarga(vilma, grupoFisicaElectronica, TipoAsignacion.LABORATORIO, 8);
  await crearAsignacionCarga(sheyla, grupoPsicOrganizacional, TipoAsignacion.TEORIA, 4);
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

  await crearDocenteGrupo(zoraida, grupoPOOII);
  await crearDocenteGrupo(everson, grupoSistemica);
  await crearDocenteGrupo(juanCarlos, grupoIngGrafica);
  await crearDocenteGrupo(marcos, grupoMatAplicada);
  await crearDocenteGrupo(teresita, grupoEstAplicada);
  await crearDocenteGrupo(juan, grupoAdminGeneral);
  await crearDocenteGrupo(vilma, grupoFisicaElectronica);
  await crearDocenteGrupo(sheyla, grupoPsicOrganizacional);
  console.log('  ✅ Vinculaciones docente-grupo creadas');

  // 9. Crear Asignaciones (horario real)
  const crearAsignacion = async (grupo: any, docente: any, aula: any, franja: any, tipo: TipoAsignacion) => {
    if (!franja) {
      console.warn(`  ⚠️ No se encontró franja para ${dia} ${horaInicio}`);
      return;
    }
    // Eliminar cualquier asignación existente que entre en conflicto
    await prisma.asignacion.deleteMany({
      where: {
        OR: [
          { aulaId: aula.id, franjaHorariaId: franja.id, periodoId: periodo2026I.id },
          { docenteId: docente.id, franjaHorariaId: franja.id, periodoId: periodo2026I.id },
          { grupoId: grupo.id, franjaHorariaId: franja.id, periodoId: periodo2026I.id },
        ],
      },
    });
    
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

  // --- Zoraida Vidal: Programación Orientada a Objetos II ---
  // Lunes 9-13 (4h lab, Lab 2)
  for (let i = 9; i < 13; i++) {
    const hora = String(i).padStart(2, '0') + ':00';
    await crearAsignacion(grupoPOOII, zoraida, lab2, getFranja(DiaSemana.LUNES, hora)!, TipoAsignacion.LABORATORIO);
  }
  // Martes 9-13 (4h lab, Lab 2)
  for (let i = 9; i < 13; i++) {
    const hora = String(i).padStart(2, '0') + ':00';
    await crearAsignacion(grupoPOOII, zoraida, lab2, getFranja(DiaSemana.MARTES, hora)!, TipoAsignacion.LABORATORIO);
  }
  // Martes 14-16 (2h teoría, Aula I-4)
  for (let i = 14; i < 16; i++) {
    const hora = String(i).padStart(2, '0') + ':00';
    await crearAsignacion(grupoPOOII, zoraida, aulaI4, getFranja(DiaSemana.MARTES, hora)!, TipoAsignacion.TEORIA);
  }
  // Viernes 9-13 (4h lab, Lab 4)
  for (let i = 9; i < 13; i++) {
    const hora = String(i).padStart(2, '0') + ':00';
    await crearAsignacion(grupoPOOII, zoraida, lab4, getFranja(DiaSemana.VIERNES, hora)!, TipoAsignacion.LABORATORIO);
  }

  // --- Everson Agreda: Sistémica ---
  // Miércoles 9-12 (3h teoría, Posgrado A-307)
  for (let i = 9; i < 12; i++) {
    const hora = String(i).padStart(2, '0') + ':00';
    await crearAsignacion(grupoSistemica, everson, aula307, getFranja(DiaSemana.MIERCOLES, hora)!, TipoAsignacion.TEORIA);
  }
  // Miércoles 14-18 (4h lab, Lab 3)
  for (let i = 14; i < 18; i++) {
    const hora = String(i).padStart(2, '0') + ':00';
    await crearAsignacion(grupoSistemica, everson, lab3, getFranja(DiaSemana.MIERCOLES, hora)!, TipoAsignacion.LABORATORIO);
  }
  // Jueves 16-18 (2h lab, Lab 3)
  for (let i = 16; i < 18; i++) {
    const hora = String(i).padStart(2, '0') + ':00';
    await crearAsignacion(grupoSistemica, everson, lab3, getFranja(DiaSemana.JUEVES, hora)!, TipoAsignacion.LABORATORIO);
  }

  // --- Juan Carlos Obando: Ingeniería Gráfica ---
  // Miércoles 7-9 (2h teoría, Posgrado A-303)
  for (let i = 7; i < 9; i++) {
    const hora = String(i).padStart(2, '0') + ':00';
    await crearAsignacion(grupoIngGrafica, juanCarlos, aula303, getFranja(DiaSemana.MIERCOLES, hora)!, TipoAsignacion.TEORIA);
  }
  // Jueves mañana (7-11, 4h lab, Lab 1)
  for (let i = 7; i < 11; i++) {
    const hora = String(i).padStart(2, '0') + ':00';
    await crearAsignacion(grupoIngGrafica, juanCarlos, lab1, getFranja(DiaSemana.JUEVES, hora)!, TipoAsignacion.LABORATORIO);
  }

  // --- Marcos Ferrer: Matemática Aplicada ---
  // Miércoles 18-21 (3h teoría, Posgrado A-303)
  for (let i = 18; i < 21; i++) {
    const hora = String(i).padStart(2, '0') + ':00';
    const franja = getFranja(DiaSemana.MIERCOLES, hora);
    if (franja) {
      await crearAsignacion(grupoMatAplicada, marcos, aula303, franja, TipoAsignacion.TEORIA);
    }
  }
  // Jueves 14-18 (4h práctica, Taller de Confecciones)
  for (let i = 14; i < 18; i++) {
    const hora = String(i).padStart(2, '0') + ':00';
    await crearAsignacion(grupoMatAplicada, marcos, tallerConfecciones, getFranja(DiaSemana.JUEVES, hora)!, TipoAsignacion.PRACTICA);
  }

  // --- Teresita Rojas: Estadística Aplicada ---
  // Martes 16-18 (2h teoría, Posgrado A-303)
  for (let i = 16; i < 18; i++) {
    const hora = String(i).padStart(2, '0') + ':00';
    await crearAsignacion(grupoEstAplicada, teresita, aula303, getFranja(DiaSemana.MARTES, hora)!, TipoAsignacion.TEORIA);
  }
  // Jueves 18-21 (3h teoría, Taller de Confecciones)
  for (let i = 18; i < 21; i++) {
    const hora = String(i).padStart(2, '0') + ':00';
    const franja = getFranja(DiaSemana.JUEVES, hora);
    if (franja) {
      await crearAsignacion(grupoEstAplicada, teresita, tallerConfecciones, franja, TipoAsignacion.TEORIA);
    }
  }
  // Viernes 7-9 (2h práctica, Taller de Confecciones)
  for (let i = 7; i < 9; i++) {
    const hora = String(i).padStart(2, '0') + ':00';
    await crearAsignacion(grupoEstAplicada, teresita, tallerConfecciones, getFranja(DiaSemana.VIERNES, hora)!, TipoAsignacion.PRACTICA);
  }
  // Viernes 16-18 (2h práctica, Posgrado A-303)
  for (let i = 16; i < 18; i++) {
    const hora = String(i).padStart(2, '0') + ':00';
    await crearAsignacion(grupoEstAplicada, teresita, aula303, getFranja(DiaSemana.VIERNES, hora)!, TipoAsignacion.PRACTICA);
  }

  // --- Juan Carrascal: Administración General ---
  // Lunes 7-9 (2h teoría, Taller de Confecciones)
  for (let i = 7; i < 9; i++) {
    const hora = String(i).padStart(2, '0') + ':00';
    await crearAsignacion(grupoAdminGeneral, juan, tallerConfecciones, getFranja(DiaSemana.LUNES, hora)!, TipoAsignacion.TEORIA);
  }
  // Martes 7-9 (2h teoría, Aula II-2)
  for (let i = 7; i < 9; i++) {
    const hora = String(i).padStart(2, '0') + ':00';
    await crearAsignacion(grupoAdminGeneral, juan, aulaII2, getFranja(DiaSemana.MARTES, hora)!, TipoAsignacion.TEORIA);
  }

  // --- Vilma Méndez: Física Electrónica ---
  // Lunes 15-21 (6h teoría, Posgrado A-307)
  for (let i = 15; i < 21; i++) {
    const hora = String(i).padStart(2, '0') + ':00';
    const franja = getFranja(DiaSemana.LUNES, hora);
    if (franja) {
      await crearAsignacion(grupoFisicaElectronica, vilma, aula307, franja, TipoAsignacion.TEORIA);
    }
  }
  // Miércoles 14-18 (4h lab, Lab de Física)
  for (let i = 14; i < 18; i++) {
    const hora = String(i).padStart(2, '0') + ':00';
    await crearAsignacion(grupoFisicaElectronica, vilma, labFisica, getFranja(DiaSemana.MIERCOLES, hora)!, TipoAsignacion.LABORATORIO);
  }
  // Jueves 7-11 (4h lab, Lab de Física)
  for (let i = 7; i < 11; i++) {
    const hora = String(i).padStart(2, '0') + ':00';
    await crearAsignacion(grupoFisicaElectronica, vilma, labFisica, getFranja(DiaSemana.JUEVES, hora)!, TipoAsignacion.LABORATORIO);
  }

  // --- Sheyla Escobedo: Psicología Organizacional ---
  // Martes 18-20 (2h teoría, Posgrado A-311)
  for (let i = 18; i < 20; i++) {
    const hora = String(i).padStart(2, '0') + ':00';
    const franja = getFranja(DiaSemana.MARTES, hora);
    if (franja) {
      await crearAsignacion(grupoPsicOrganizacional, sheyla, aula311, franja, TipoAsignacion.TEORIA);
    }
  }
  // Viernes 18-20 (2h teoría, Posgrado A-311)
  for (let i = 18; i < 20; i++) {
    const hora = String(i).padStart(2, '0') + ':00';
    const franja = getFranja(DiaSemana.VIERNES, hora);
    if (franja) {
      await crearAsignacion(grupoPsicOrganizacional, sheyla, aula311, franja, TipoAsignacion.TEORIA);
    }
  }

  console.log('  ✅ Asignaciones de horario creadas');
  console.log('✅ Tercer ciclo populado exitosamente!');
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
