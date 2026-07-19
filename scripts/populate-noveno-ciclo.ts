import 'dotenv/config';
import { PrismaClient, CategoriaDocente, TipoDocente, ModalidadDocente, TipoAula, DiaSemana, TipoAsignacion } from '../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

const connectionString = process.env.DATABASE_URL!;
const pool = new pg.Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🌱 Populando noveno ciclo (2026-I)...');

  // 1. Obtener datos base
  const periodo2026I = await prisma.periodoAcademico.findUniqueOrThrow({ where: { nombre: '2026-I' } });
  const franjas = await prisma.franjaHoraria.findMany();
  const getFranja = (dia: DiaSemana, horaInicio: string) => franjas.find(f => f.dia === dia && f.horaInicio === horaInicio);
  const deptoSistemas = await prisma.departamento.findFirstOrThrow({ where: { nombre: 'Departamento de Ingeniería de Sistemas' } });

  // 2. Añadir docentes faltantes
  const docentesData = [
    { nombre: 'José Gómez Ávila', email: 'jgomez@unitru.edu.pe', categoria: CategoriaDocente.ASOCIADO, tipo: TipoDocente.NOMBRADO, antiguedad: new Date('2015-01-01'), dni: '99900011', codigoIBM: 'IBM033', modalidad: ModalidadDocente.TIEMPO_COMPLETO, horasContrato: 40, departamentoId: deptoSistemas.id, gradoAcademico: 'Magíster', especialidad: 'Gestión de Proyectos y Cloud', experienciaAnios: 12 },
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
  const juanPedro = await prisma.docente.findUniqueOrThrow({ where: { email: 'jsantos@unitru.edu.pe' } });
  const ricardo = await prisma.docente.findUniqueOrThrow({ where: { email: 'rmendoza@unitru.edu.pe' } });
  const alberto = await prisma.docente.findUniqueOrThrow({ where: { email: 'amendoza@unitru.edu.pe' } });
  const jose = await prisma.docente.findUniqueOrThrow({ where: { email: 'jgomez@unitru.edu.pe' } });
  const oscar = await prisma.docente.findUniqueOrThrow({ where: { email: 'oalcantara@unitru.edu.pe' } });
  const marcelino = await prisma.docente.findUniqueOrThrow({ where: { email: 'mtorres@unitru.edu.pe' } });
  const camilo = await prisma.docente.findUniqueOrThrow({ where: { email: 'csuarez@unitru.edu.pe' } });

  // 3. Añadir aula faltante (AUDIOVISUALES)
  let aulaAudiovisuales = await prisma.aula.findUnique({ where: { codigo: 'AUDIOVISUALES' } });
  if (!aulaAudiovisuales) {
    aulaAudiovisuales = await prisma.aula.create({
      data: {
        codigo: 'AUDIOVISUALES',
        nombre: 'Sala Audiovisuales',
        capacidad: 50,
        tipo: TipoAula.TEORIA,
        edificio: 'Edificio Principal',
        piso: 2,
      },
    });
    console.log('  ✅ Aula Audiovisuales creada');
  }

  // 4. Obtener aulas necesarias
  const aula303 = await prisma.aula.findUniqueOrThrow({ where: { codigo: 'EPG-303' } });
  const lab2 = await prisma.aula.findUniqueOrThrow({ where: { codigo: 'LAB-2' } });
  const aula311 = await prisma.aula.findUniqueOrThrow({ where: { codigo: 'EPG-311' } });
  const lab4 = await prisma.aula.findUniqueOrThrow({ where: { codigo: 'LAB-4' } });
  const lab3 = await prisma.aula.findUniqueOrThrow({ where: { codigo: 'LAB-3' } });
  const lab1 = await prisma.aula.findUniqueOrThrow({ where: { codigo: 'LAB-1' } });

  // 5. Obtener cursos del noveno ciclo
  const cursoTesisI = await prisma.curso.findUniqueOrThrow({ where: { codigo: 'EI-901' } });
  const cursoAnaliticaNegocios = await prisma.curso.findUniqueOrThrow({ where: { codigo: 'EE-903' } });
  const cursoAuditoriaInformatica = await prisma.curso.findUniqueOrThrow({ where: { codigo: 'EE-902' } });
  const cursoGestionProyectosTI = await prisma.curso.findUniqueOrThrow({ where: { codigo: 'EE-901' } });
  const cursoEmprendimientoTecnologico = await prisma.curso.findUniqueOrThrow({ where: { codigo: 'EL-901' } });
  const cursoIngenieriaWeb = await prisma.curso.findUniqueOrThrow({ where: { codigo: 'EE-501' } });
  const cursoComputacionNube = await prisma.curso.findUniqueOrThrow({ where: { codigo: 'EE-904' } });
  const cursoHackeoEtico = await prisma.curso.findUniqueOrThrow({ where: { codigo: 'EL-902' } });

  // 5. Crear grupos para sección A
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

  const grupoTesisI = await crearGrupo(cursoTesisI);
  const grupoAnaliticaNegocios = await crearGrupo(cursoAnaliticaNegocios);
  const grupoAuditoriaInformatica = await crearGrupo(cursoAuditoriaInformatica);
  const grupoGestionProyectosTI = await crearGrupo(cursoGestionProyectosTI);
  const grupoEmprendimientoTecnologico = await crearGrupo(cursoEmprendimientoTecnologico);
  const grupoIngenieriaWeb = await crearGrupo(cursoIngenieriaWeb);
  const grupoComputacionNube = await crearGrupo(cursoComputacionNube);
  const grupoHackeoEtico = await crearGrupo(cursoHackeoEtico);
  console.log('  ✅ Grupos creados o verificados');

  // 6. Crear AsignacionCargaLectiva
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

  await crearAsignacionCarga(juanPedro, grupoTesisI, TipoAsignacion.TEORIA, 4);
  await crearAsignacionCarga(juanPedro, grupoTesisI, TipoAsignacion.LABORATORIO, 2);
  await crearAsignacionCarga(ricardo, grupoTesisI, TipoAsignacion.TEORIA, 4);
  await crearAsignacionCarga(ricardo, grupoTesisI, TipoAsignacion.LABORATORIO, 2);
  await crearAsignacionCarga(ricardo, grupoAnaliticaNegocios, TipoAsignacion.TEORIA, 3);
  await crearAsignacionCarga(ricardo, grupoAnaliticaNegocios, TipoAsignacion.LABORATORIO, 2);
  await crearAsignacionCarga(alberto, grupoAuditoriaInformatica, TipoAsignacion.TEORIA, 3);
  await crearAsignacionCarga(alberto, grupoAuditoriaInformatica, TipoAsignacion.LABORATORIO, 4);
  await crearAsignacionCarga(jose, grupoGestionProyectosTI, TipoAsignacion.TEORIA, 3);
  await crearAsignacionCarga(jose, grupoGestionProyectosTI, TipoAsignacion.LABORATORIO, 2);
  await crearAsignacionCarga(jose, grupoGestionProyectosTI, TipoAsignacion.PRACTICA, 2);
  await crearAsignacionCarga(oscar, grupoEmprendimientoTecnologico, TipoAsignacion.LABORATORIO, 4);
  await crearAsignacionCarga(oscar, grupoEmprendimientoTecnologico, TipoAsignacion.TEORIA, 2);
  await crearAsignacionCarga(marcelino, grupoIngenieriaWeb, TipoAsignacion.TEORIA, 2);
  await crearAsignacionCarga(marcelino, grupoIngenieriaWeb, TipoAsignacion.LABORATORIO, 2);
  await crearAsignacionCarga(jose, grupoComputacionNube, TipoAsignacion.LABORATORIO, 3);
  await crearAsignacionCarga(jose, grupoComputacionNube, TipoAsignacion.TEORIA, 2);
  await crearAsignacionCarga(camilo, grupoHackeoEtico, TipoAsignacion.TEORIA, 3);
  await crearAsignacionCarga(camilo, grupoHackeoEtico, TipoAsignacion.LABORATORIO, 4);
  console.log('  ✅ Asignaciones de carga lectiva creadas');

  // 7. Crear docenteGrupo
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

  await crearDocenteGrupo(juanPedro, grupoTesisI);
  await crearDocenteGrupo(ricardo, grupoTesisI);
  await crearDocenteGrupo(ricardo, grupoAnaliticaNegocios);
  await crearDocenteGrupo(alberto, grupoAuditoriaInformatica);
  await crearDocenteGrupo(jose, grupoGestionProyectosTI);
  await crearDocenteGrupo(oscar, grupoEmprendimientoTecnologico);
  await crearDocenteGrupo(marcelino, grupoIngenieriaWeb);
  await crearDocenteGrupo(jose, grupoComputacionNube);
  await crearDocenteGrupo(camilo, grupoHackeoEtico);
  console.log('  ✅ Vinculaciones docente-grupo creadas');

  // 8. Crear Asignaciones (horario real)
  const crearAsignacion = async (grupo: any, docente: any, aula: any, franja: any, tipo: TipoAsignacion) => {
    if (!franja) {
      console.warn(`  No se encontró franja para la hora indicada`);
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

  // --- Juan Pedro Santos: Tesis I ---
  // Jueves 7-11 (4h teoría, Posgrado A-303)
  for (let i = 7; i < 11; i++) {
    const hora = String(i).padStart(2, '0') + ':00';
    await crearAsignacion(grupoTesisI, juanPedro, aula303, getFranja(DiaSemana.JUEVES, hora), TipoAsignacion.TEORIA);
  }
  // Jueves 11-13 (2h lab, Laboratorio 2)
  for (let i = 11; i < 13; i++) {
    const hora = String(i).padStart(2, '0') + ':00';
    await crearAsignacion(grupoTesisI, juanPedro, lab2, getFranja(DiaSemana.JUEVES, hora), TipoAsignacion.LABORATORIO);
  }

  // --- Ricardo Mendoza: Tesis I ---
  // Jueves 14-18 (4h teoría, Posgrado A-311)
  for (let i = 14; i < 18; i++) {
    const hora = String(i).padStart(2, '0') + ':00';
    await crearAsignacion(grupoTesisI, ricardo, aula311, getFranja(DiaSemana.JUEVES, hora), TipoAsignacion.TEORIA);
  }
  // Viernes 16-18 (2h lab, Laboratorio 4)
  for (let i = 16; i < 18; i++) {
    const hora = String(i).padStart(2, '0') + ':00';
    await crearAsignacion(grupoTesisI, ricardo, lab4, getFranja(DiaSemana.VIERNES, hora), TipoAsignacion.LABORATORIO);
  }
  // Viernes 10-13 (3h teoría, Posgrado A-303)
  for (let i = 10; i < 13; i++) {
    const hora = String(i).padStart(2, '0') + ':00';
    await crearAsignacion(grupoAnaliticaNegocios, ricardo, aula303, getFranja(DiaSemana.VIERNES, hora), TipoAsignacion.TEORIA);
  }
  // Viernes 14-16 (2h lab, Laboratorio 4)
  for (let i = 14; i < 16; i++) {
    const hora = String(i).padStart(2, '0') + ':00';
    await crearAsignacion(grupoAnaliticaNegocios, ricardo, lab4, getFranja(DiaSemana.VIERNES, hora), TipoAsignacion.LABORATORIO);
  }

  // --- Alberto Mendoza: Auditoría Informática ---
  // Lunes 10-13 (3h teoría, Posgrado A-303)
  for (let i = 10; i < 13; i++) {
    const hora = String(i).padStart(2, '0') + ':00';
    await crearAsignacion(grupoAuditoriaInformatica, alberto, aula303, getFranja(DiaSemana.LUNES, hora), TipoAsignacion.TEORIA);
  }
  // Martes 10-14 (4h lab, Laboratorio 3)
  for (let i = 10; i < 14; i++) {
    const hora = String(i).padStart(2, '0') + ':00';
    await crearAsignacion(grupoAuditoriaInformatica, alberto, lab3, getFranja(DiaSemana.MARTES, hora), TipoAsignacion.LABORATORIO);
  }

  // --- José Gómez: Gestión de Proyectos de TI ---
  // Lunes 14-17 (3h teoría, Posgrado A-303)
  for (let i = 14; i < 17; i++) {
    const hora = String(i).padStart(2, '0') + ':00';
    await crearAsignacion(grupoGestionProyectosTI, jose, aula303, getFranja(DiaSemana.LUNES, hora), TipoAsignacion.TEORIA);
  }
  // Martes 10-12 (2h teoría, Audiovisuales)
  for (let i = 10; i < 12; i++) {
    const hora = String(i).padStart(2, '0') + ':00';
    await crearAsignacion(grupoGestionProyectosTI, jose, aulaAudiovisuales, getFranja(DiaSemana.MARTES, hora), TipoAsignacion.TEORIA);
  }
  // Martes 13-15 (2h práctica, Laboratorio 1)
  for (let i = 13; i < 15; i++) {
    const hora = String(i).padStart(2, '0') + ':00';
    await crearAsignacion(grupoGestionProyectosTI, jose, lab1, getFranja(DiaSemana.MARTES, hora), TipoAsignacion.PRACTICA);
  }
  // Martes 15-19 (4h lab, Laboratorio 2)
  for (let i = 15; i < 19; i++) {
    const hora = String(i).padStart(2, '0') + ':00';
    await crearAsignacion(grupoGestionProyectosTI, jose, lab2, getFranja(DiaSemana.MARTES, hora), TipoAsignacion.LABORATORIO);
  }
  // Martes 19-21 (2h lab, Laboratorio 1)
  for (let i = 19; i < 21; i++) {
    const hora = String(i).padStart(2, '0') + ':00';
    const franja = getFranja(DiaSemana.MARTES, hora);
    if (franja) {
      await crearAsignacion(grupoGestionProyectosTI, jose, lab1, franja, TipoAsignacion.LABORATORIO);
    }
  }

  // --- Oscar Alcántara: Emprendimiento Tecnológico ---
  // Viernes 14-18 (4h lab, Laboratorio 2)
  for (let i = 14; i < 18; i++) {
    const hora = String(i).padStart(2, '0') + ':00';
    await crearAsignacion(grupoEmprendimientoTecnologico, oscar, lab2, getFranja(DiaSemana.VIERNES, hora), TipoAsignacion.LABORATORIO);
  }
  // Viernes 18-20 (2h teoría, Posgrado A-303)
  for (let i = 18; i < 20; i++) {
    const hora = String(i).padStart(2, '0') + ':00';
    const franja = getFranja(DiaSemana.VIERNES, hora);
    if (franja) {
      await crearAsignacion(grupoEmprendimientoTecnologico, oscar, aula303, franja, TipoAsignacion.TEORIA);
    }
  }

  // --- Marcelino Torres: Ingeniería Web ---
  // Lunes 18-20 (2h teoría, Posgrado A-303)
  for (let i = 18; i < 20; i++) {
    const hora = String(i).padStart(2, '0') + ':00';
    const franja = getFranja(DiaSemana.LUNES, hora);
    if (franja) {
      await crearAsignacion(grupoIngenieriaWeb, marcelino, aula303, franja, TipoAsignacion.TEORIA);
    }
  }
  // Martes 14-16 (2h lab, Laboratorio 4)
  for (let i = 14; i < 16; i++) {
    const hora = String(i).padStart(2, '0') + ':00';
    await crearAsignacion(grupoIngenieriaWeb, marcelino, lab4, getFranja(DiaSemana.MARTES, hora), TipoAsignacion.LABORATORIO);
  }
  // Martes 18-20 (2h lab, Laboratorio 4)
  for (let i = 18; i < 20; i++) {
    const hora = String(i).padStart(2, '0') + ':00';
    const franja = getFranja(DiaSemana.MARTES, hora);
    if (franja) {
      await crearAsignacion(grupoIngenieriaWeb, marcelino, lab4, franja, TipoAsignacion.LABORATORIO);
    }
  }
  // Miércoles 10-13 (3h lab, Laboratorio 4)
  for (let i = 10; i < 13; i++) {
    const hora = String(i).padStart(2, '0') + ':00';
    await crearAsignacion(grupoIngenieriaWeb, marcelino, lab4, getFranja(DiaSemana.MIERCOLES, hora), TipoAsignacion.LABORATORIO);
  }

  // --- José Gómez: Computación en la Nube ---
  // Lunes 7-10 (3h lab, Laboratorio 3)
  for (let i = 7; i < 10; i++) {
    const hora = String(i).padStart(2, '0') + ':00';
    await crearAsignacion(grupoComputacionNube, jose, lab3, getFranja(DiaSemana.LUNES, hora), TipoAsignacion.LABORATORIO);
  }
  // Miércoles 7-10 (3h lab, Laboratorio 3)
  for (let i = 7; i < 10; i++) {
    const hora = String(i).padStart(2, '0') + ':00';
    await crearAsignacion(grupoComputacionNube, jose, lab3, getFranja(DiaSemana.MIERCOLES, hora), TipoAsignacion.LABORATORIO);
  }
  // Miércoles 17-20 (3h lab, Laboratorio 4)
  for (let i = 17; i < 20; i++) {
    const hora = String(i).padStart(2, '0') + ':00';
    const franja = getFranja(DiaSemana.MIERCOLES, hora);
    if (franja) {
      await crearAsignacion(grupoComputacionNube, jose, lab4, franja, TipoAsignacion.LABORATORIO);
    }
  }
  // Jueves 18-20 (2h teoría, Posgrado A-303)
  for (let i = 18; i < 20; i++) {
    const hora = String(i).padStart(2, '0') + ':00';
    const franja = getFranja(DiaSemana.JUEVES, hora);
    if (franja) {
      await crearAsignacion(grupoComputacionNube, jose, aula303, franja, TipoAsignacion.TEORIA);
    }
  }

  // --- Camilo Suárez: Hackeo Ético ---
  // Martes 7-10 (3h teoría, Posgrado A-303)
  for (let i = 7; i < 10; i++) {
    const hora = String(i).padStart(2, '0') + ':00';
    await crearAsignacion(grupoHackeoEtico, camilo, aula303, getFranja(DiaSemana.MARTES, hora), TipoAsignacion.TEORIA);
  }
  // Martes 15-19 (4h lab, Laboratorio 2)
  for (let i = 15; i < 19; i++) {
    const hora = String(i).padStart(2, '0') + ':00';
    await crearAsignacion(grupoHackeoEtico, camilo, lab2, getFranja(DiaSemana.MARTES, hora), TipoAsignacion.LABORATORIO);
  }

  console.log('  ✅ Asignaciones de horario creadas');
  console.log('✅ Noveno ciclo populado exitosamente!');
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
