import 'dotenv/config';
import { PrismaClient, CategoriaDocente, TipoDocente, ModalidadDocente, TipoAula, DiaSemana, TipoAsignacion } from '../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

const connectionString = process.env.DATABASE_URL!;
const pool = new pg.Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🌱 Actualizando séptimo ciclo (2026-I)...');

  // 1. Obtener datos base
  const periodo2026I = await prisma.periodoAcademico.findUniqueOrThrow({ where: { nombre: '2026-I' } });
  const franjas = await prisma.franjaHoraria.findMany();
  const getFranja = (dia: DiaSemana, horaInicio: string) => franjas.find(f => f.dia === dia && f.horaInicio === horaInicio);
  const deptoSistemas = await prisma.departamento.findFirstOrThrow({ where: { nombre: 'Departamento de Ingeniería de Sistemas' } });
  const deptoIndustrial = await prisma.departamento.findFirstOrThrow({ where: { nombre: 'Departamento de Ingeniería Industrial' } });

  // 2. Añadir docentes faltantes (Jhoe González Vásquez)
  const docentesData = [
    { nombre: 'Jhoe González Vásquez', email: 'jgonzalez@unitru.edu.pe', categoria: CategoriaDocente.AUXILIAR, tipo: TipoDocente.NOMBRADO, antiguedad: new Date('2021-01-01'), dni: '88899900', codigoIBM: 'IBM032', modalidad: ModalidadDocente.TIEMPO_COMPLETO, horasContrato: 40, departamentoId: deptoIndustrial.id, gradoAcademico: 'Ingeniero', especialidad: 'Cadena de Suministros', experienciaAnios: 5 },
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
  const cesar = await prisma.docente.findUniqueOrThrow({ where: { email: 'carellano@unitru.edu.pe' } });
  const robert = await prisma.docente.findUniqueOrThrow({ where: { email: 'rsanchez@unitru.edu.pe' } });
  const everson = await prisma.docente.findUniqueOrThrow({ where: { email: 'eagreda@unitru.edu.pe' } });
  const alberto = await prisma.docente.findUniqueOrThrow({ where: { email: 'amendoza@unitru.edu.pe' } });
  const paul = await prisma.docente.findUniqueOrThrow({ where: { email: 'pcotrina@unitru.edu.pe' } });
  const ricardo = await prisma.docente.findUniqueOrThrow({ where: { email: 'rmendoza@unitru.edu.pe' } });
  const oscar = await prisma.docente.findUniqueOrThrow({ where: { email: 'oalcantara@unitru.edu.pe' } });
  const jhoe = await prisma.docente.findUniqueOrThrow({ where: { email: 'jgonzalez@unitru.edu.pe' } });

  // 3. Añadir aula faltante (Lab 5)
  let lab5 = await prisma.aula.findUnique({ where: { codigo: 'LAB-5' } });
  if (!lab5) {
    lab5 = await prisma.aula.create({
      data: {
        codigo: 'LAB-5',
        nombre: 'Laboratorio 5',
        capacidad: 30,
        tipo: TipoAula.LABORATORIO,
        edificio: 'Edificio de Laboratorios',
        piso: 1,
      },
    });
    console.log('  ✅ Aula Laboratorio 5 creada');
  }

  // 4. Obtener aulas necesarias
  const lab1 = await prisma.aula.findUniqueOrThrow({ where: { codigo: 'LAB-1' } });
  const aula303 = await prisma.aula.findUniqueOrThrow({ where: { codigo: 'EPG-303' } });
  const lab3 = await prisma.aula.findUniqueOrThrow({ where: { codigo: 'LAB-3' } });
  const lab2 = await prisma.aula.findUniqueOrThrow({ where: { codigo: 'LAB-2' } });
  const aula311 = await prisma.aula.findUniqueOrThrow({ where: { codigo: 'EPG-311' } });
  const aula307 = await prisma.aula.findUniqueOrThrow({ where: { codigo: 'EPG-307' } });
  const lab4 = await prisma.aula.findUniqueOrThrow({ where: { codigo: 'LAB-4' } });
  const tallerConfecciones = await prisma.aula.findUniqueOrThrow({ where: { codigo: 'TALLER-CONFECCIONES' } });

  // 5. Obtener cursos del séptimo ciclo
  const cursoIngSoftwareI = await prisma.curso.findUniqueOrThrow({ where: { codigo: 'EE-704' } }); // Ingeniería de Software I
  const cursoRedesComunicacionesI = await prisma.curso.findUniqueOrThrow({ where: { codigo: 'EE-703' } }); // Redes y Comunicaciones I
  const cursoNegociosElectronicos = await prisma.curso.findUniqueOrThrow({ where: { codigo: 'EL-702' } }); // Negocios Electrónicos
  const cursoGestionServiciosTI = await prisma.curso.findUniqueOrThrow({ where: { codigo: 'EE-701' } }); // Gestión de Servicios de TI
  const cursoMetodologiaInvestigacion = await prisma.curso.findUniqueOrThrow({ where: { codigo: 'EE-901' } }); // Metodología de la Investigación Científica
  const cursoAdminBasesDatos = await prisma.curso.findUniqueOrThrow({ where: { codigo: 'EE-603' } }); // Administración de Base de Datos
  const cursoPlaneamientoEstrategico = await prisma.curso.findUniqueOrThrow({ where: { codigo: 'EE-702' } }); // Planeamiento Estratégico de TI
  const cursoCadenaSuministros = await prisma.curso.findUniqueOrThrow({ where: { codigo: 'EP-701' } }); // Cadena de Suministros

  // 6. Primero, ELIMINAR todas las asignaciones, asignaciones de carga lectiva, docente-grupo y grupos existentes para este ciclo
  console.log('  🗑️  Limpiando datos existentes del séptimo ciclo...');
  await prisma.asignacion.deleteMany({ where: { periodoId: periodo2026I.id } });
  await prisma.asignacionCargaLectiva.deleteMany({ where: { periodoId: periodo2026I.id } });
  await prisma.docenteGrupo.deleteMany({ where: { grupo: { periodoAcademicoId: periodo2026I.id, curso: { ciclo: 7 } } } });
  await prisma.grupo.deleteMany({ where: { periodoAcademicoId: periodo2026I.id, curso: { ciclo: 7 } } });

  // 7. Crear grupos para sección A
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

  const grupoIngSoftwareI = await crearGrupo(cursoIngSoftwareI);
  const grupoRedesComunicacionesI = await crearGrupo(cursoRedesComunicacionesI);
  const grupoNegociosElectronicos = await crearGrupo(cursoNegociosElectronicos);
  const grupoGestionServiciosTI = await crearGrupo(cursoGestionServiciosTI);
  const grupoMetodologiaInvestigacion = await crearGrupo(cursoMetodologiaInvestigacion);
  const grupoAdminBasesDatos = await crearGrupo(cursoAdminBasesDatos);
  const grupoPlaneamientoEstrategico = await crearGrupo(cursoPlaneamientoEstrategico);
  const grupoCadenaSuministros = await crearGrupo(cursoCadenaSuministros);
  console.log('  ✅ Grupos creados');

  // 8. Crear AsignacionCargaLectiva
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

  // --- Ingeniería de Software ---
  await crearAsignacionCarga(juanPedro, grupoIngSoftwareI, TipoAsignacion.LABORATORIO, 3, 1);
  await crearAsignacionCarga(juanPedro, grupoIngSoftwareI, TipoAsignacion.TEORIA, 3);
  await crearAsignacionCarga(robert, grupoIngSoftwareI, TipoAsignacion.LABORATORIO, 3, 2);
  await crearAsignacionCarga(robert, grupoIngSoftwareI, TipoAsignacion.LABORATORIO, 3, 3);

  // --- Redes y Comunicaciones ---
  await crearAsignacionCarga(cesar, grupoRedesComunicacionesI, TipoAsignacion.LABORATORIO, 3, 1);
  await crearAsignacionCarga(cesar, grupoRedesComunicacionesI, TipoAsignacion.LABORATORIO, 3, 2);
  await crearAsignacionCarga(cesar, grupoRedesComunicacionesI, TipoAsignacion.LABORATORIO, 3, 3);
  await crearAsignacionCarga(cesar, grupoRedesComunicacionesI, TipoAsignacion.TEORIA, 2);

  // --- Negocios Electrónicos ---
  await crearAsignacionCarga(everson, grupoNegociosElectronicos, TipoAsignacion.TEORIA, 2);
  await crearAsignacionCarga(paul, grupoNegociosElectronicos, TipoAsignacion.LABORATORIO, 2, 1);
  await crearAsignacionCarga(paul, grupoNegociosElectronicos, TipoAsignacion.LABORATORIO, 2, 2);

  // --- Gestión de Servicios de TI ---
  await crearAsignacionCarga(alberto, grupoGestionServiciosTI, TipoAsignacion.TEORIA, 3);
  await crearAsignacionCarga(alberto, grupoGestionServiciosTI, TipoAsignacion.LABORATORIO, 4, 1);

  // --- Metodología de la Investigación ---
  await crearAsignacionCarga(paul, grupoMetodologiaInvestigacion, TipoAsignacion.TEORIA, 4);

  // --- Administración de Base de Datos ---
  await crearAsignacionCarga(ricardo, grupoAdminBasesDatos, TipoAsignacion.TEORIA, 2);
  await crearAsignacionCarga(ricardo, grupoAdminBasesDatos, TipoAsignacion.LABORATORIO, 6, 1);

  // --- Planeamiento Estratégico de TI ---
  await crearAsignacionCarga(oscar, grupoPlaneamientoEstrategico, TipoAsignacion.TEORIA, 3);
  await crearAsignacionCarga(oscar, grupoPlaneamientoEstrategico, TipoAsignacion.LABORATORIO, 2, 1);
  await crearAsignacionCarga(oscar, grupoPlaneamientoEstrategico, TipoAsignacion.LABORATORIO, 2, 2);
  await crearAsignacionCarga(oscar, grupoPlaneamientoEstrategico, TipoAsignacion.LABORATORIO, 2, 3);

  // --- Cadena de Suministros ---
  await crearAsignacionCarga(jhoe, grupoCadenaSuministros, TipoAsignacion.TEORIA, 4);
  console.log('  ✅ Asignaciones de carga lectiva creadas');

  // 9. Crear docenteGrupo
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

  await crearDocenteGrupo(juanPedro, grupoIngSoftwareI);
  await crearDocenteGrupo(robert, grupoIngSoftwareI);
  await crearDocenteGrupo(cesar, grupoRedesComunicacionesI);
  await crearDocenteGrupo(everson, grupoNegociosElectronicos);
  await crearDocenteGrupo(paul, grupoNegociosElectronicos);
  await crearDocenteGrupo(alberto, grupoGestionServiciosTI);
  await crearDocenteGrupo(paul, grupoMetodologiaInvestigacion);
  await crearDocenteGrupo(ricardo, grupoAdminBasesDatos);
  await crearDocenteGrupo(oscar, grupoPlaneamientoEstrategico);
  await crearDocenteGrupo(jhoe, grupoCadenaSuministros);
  console.log('  ✅ Vinculaciones docente-grupo creadas');

  // 10. Crear Asignaciones (horario real)
  const crearAsignacion = async (grupo: any, docente: any, aula: any, franja: any, tipo: TipoAsignacion) => {
    if (!franja) {
      console.warn(`  ⚠️ No se encontró franja para la hora indicada`);
      return;
    }
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

  // --- Juan Pedro Santos: Ingeniería de Software I ---
  // Martes 07:00 – 10:00 (Laboratorio, grupo 1, Lab 1)
  for (let i = 7; i < 10; i++) {
    const hora = String(i).padStart(2, '0') + ':00';
    await crearAsignacion(grupoIngSoftwareI, juanPedro, lab1, getFranja(DiaSemana.MARTES, hora), TipoAsignacion.LABORATORIO);
  }
  // Martes 10:00 – 13:00 (Teoría, Posgrado A-303)
  for (let i = 10; i < 13; i++) {
    const hora = String(i).padStart(2, '0') + ':00';
    await crearAsignacion(grupoIngSoftwareI, juanPedro, aula303, getFranja(DiaSemana.MARTES, hora), TipoAsignacion.TEORIA);
  }

  // --- Robert Sanchez: Ingeniería de Software I ---
  // Lunes 07:00 – 10:00 (Laboratorio, grupo 2, Lab 1)
  for (let i = 7; i < 10; i++) {
    const hora = String(i).padStart(2, '0') + ':00';
    await crearAsignacion(grupoIngSoftwareI, robert, lab1, getFranja(DiaSemana.LUNES, hora), TipoAsignacion.LABORATORIO);
  }
  // Lunes 10:00 – 13:00 (Laboratorio, grupo 3, Lab 1)
  for (let i = 10; i < 13; i++) {
    const hora = String(i).padStart(2, '0') + ':00';
    await crearAsignacion(grupoIngSoftwareI, robert, lab1, getFranja(DiaSemana.LUNES, hora), TipoAsignacion.LABORATORIO);
  }

  // --- Cesar Arellano: Redes y Comunicaciones I ---
  // Lunes 10:00 – 13:00 (Laboratorio grupo 1, Lab 2)
  for (let i = 10; i < 13; i++) {
    const hora = String(i).padStart(2, '0') + ':00';
    await crearAsignacion(grupoRedesComunicacionesI, cesar, lab2, getFranja(DiaSemana.LUNES, hora), TipoAsignacion.LABORATORIO);
  }
  // Lunes 13:00 – 16:00 (Laboratorio grupo 2, Lab 2)
  for (let i = 13; i < 16; i++) {
    const hora = String(i).padStart(2, '0') + ':00';
    await crearAsignacion(grupoRedesComunicacionesI, cesar, lab2, getFranja(DiaSemana.LUNES, hora), TipoAsignacion.LABORATORIO);
  }
  // Lunes 16:00 – 19:00 (Laboratorio grupo 3, Lab 2)
  for (let i = 16; i < 19; i++) {
    const hora = String(i).padStart(2, '0') + ':00';
    const franja = getFranja(DiaSemana.LUNES, hora);
    if (franja) {
      await crearAsignacion(grupoRedesComunicacionesI, cesar, lab2, franja, TipoAsignacion.LABORATORIO);
    }
  }
  // Viernes 16:00 – 18:00 (Teoría, Lab 2)
  for (let i = 16; i < 18; i++) {
    const hora = String(i).padStart(2, '0') + ':00';
    await crearAsignacion(grupoRedesComunicacionesI, cesar, lab2, getFranja(DiaSemana.VIERNES, hora), TipoAsignacion.TEORIA);
  }

  // --- Everson Agreda: Negocios Electrónicos ---
  // Martes 16:00 – 18:00 (Teoría, Posgrado 311)
  for (let i = 16; i < 18; i++) {
    const hora = String(i).padStart(2, '0') + ':00';
    await crearAsignacion(grupoNegociosElectronicos, everson, aula311, getFranja(DiaSemana.MARTES, hora), TipoAsignacion.TEORIA);
  }

  // --- Paul Cotrina: Negocios Electrónicos ---
  // Lunes 14:00 – 16:00 (Laboratorio grupo 1, Lab 4)
  for (let i = 14; i < 16; i++) {
    const hora = String(i).padStart(2, '0') + ':00';
    await crearAsignacion(grupoNegociosElectronicos, paul, lab4, getFranja(DiaSemana.LUNES, hora), TipoAsignacion.LABORATORIO);
  }
  // Lunes 16:00 – 18:00 (Laboratorio grupo 2, Lab 4)
  for (let i = 16; i < 18; i++) {
    const hora = String(i).padStart(2, '0') + ':00';
    await crearAsignacion(grupoNegociosElectronicos, paul, lab4, getFranja(DiaSemana.LUNES, hora), TipoAsignacion.LABORATORIO);
  }

  // --- Alberto Mendoza: Gestión de Servicios de TI ---
  // Viernes 7:00 – 10:00 (Teoría, EPG-303)
  for (let i = 7; i < 10; i++) {
    const hora = String(i).padStart(2, '0') + ':00';
    await crearAsignacion(grupoGestionServiciosTI, alberto, aula303, getFranja(DiaSemana.VIERNES, hora), TipoAsignacion.TEORIA);
  }
  // Viernes 10:00 – 12:00 (Laboratorio grupo 1, Lab 1)
  for (let i = 10; i < 12; i++) {
    const hora = String(i).padStart(2, '0') + ':00';
    await crearAsignacion(grupoGestionServiciosTI, alberto, lab1, getFranja(DiaSemana.VIERNES, hora), TipoAsignacion.LABORATORIO);
  }
  // Viernes 12:00 – 14:00 (Laboratorio grupo 1, Lab 1)
  for (let i = 12; i < 14; i++) {
    const hora = String(i).padStart(2, '0') + ':00';
    await crearAsignacion(grupoGestionServiciosTI, alberto, lab1, getFranja(DiaSemana.VIERNES, hora), TipoAsignacion.LABORATORIO);
  }

  // --- Paul Cotrina: Metodología de la Investigación ---
  // Jueves 14:00 – 18:00 (Teoría, EPG 307)
  for (let i = 14; i < 18; i++) {
    const hora = String(i).padStart(2, '0') + ':00';
    await crearAsignacion(grupoMetodologiaInvestigacion, paul, aula307, getFranja(DiaSemana.JUEVES, hora), TipoAsignacion.TEORIA);
  }

  // --- Ricardo Mendoza: Administración de Base de Datos ---
  // Jueves 7:00 - 9:00 (Teoría, EPG 307)
  for (let i = 7; i < 9; i++) {
    const hora = String(i).padStart(2, '0') + ':00';
    await crearAsignacion(grupoAdminBasesDatos, ricardo, aula307, getFranja(DiaSemana.JUEVES, hora), TipoAsignacion.TEORIA);
  }
  // Jueves 18:00 - 21:00 (Laboratorio grupo 1, Lab 4)
  for (let i = 18; i < 21; i++) {
    const hora = String(i).padStart(2, '0') + ':00';
    const franja = getFranja(DiaSemana.JUEVES, hora);
    if (franja) {
      await crearAsignacion(grupoAdminBasesDatos, ricardo, lab4, franja, TipoAsignacion.LABORATORIO);
    }
  }
  // Viernes 18:00 - 21:00 (Laboratorio grupo 1, Lab 4)
  for (let i = 18; i < 21; i++) {
    const hora = String(i).padStart(2, '0') + ':00';
    const franja = getFranja(DiaSemana.VIERNES, hora);
    if (franja) {
      await crearAsignacion(grupoAdminBasesDatos, ricardo, lab4, franja, TipoAsignacion.LABORATORIO);
    }
  }

  // --- Oscar Alcantara: Planeamiento Estratégico de TI ---
  // Martes 13:00 - 16:00 (Teoría, EPG 307)
  for (let i = 13; i < 16; i++) {
    const hora = String(i).padStart(2, '0') + ':00';
    await crearAsignacion(grupoPlaneamientoEstrategico, oscar, aula307, getFranja(DiaSemana.MARTES, hora), TipoAsignacion.TEORIA);
  }
  // Miercoles 13:00 - 15:00 (Laboratorio grupo 1, Lab 4)
  for (let i = 13; i < 15; i++) {
    const hora = String(i).padStart(2, '0') + ':00';
    await crearAsignacion(grupoPlaneamientoEstrategico, oscar, lab4, getFranja(DiaSemana.MIERCOLES, hora), TipoAsignacion.LABORATORIO);
  }
  // Miercoles 15:00 - 17:00 (Laboratorio grupo 2, Lab 4)
  for (let i = 15; i < 17; i++) {
    const hora = String(i).padStart(2, '0') + ':00';
    await crearAsignacion(grupoPlaneamientoEstrategico, oscar, lab4, getFranja(DiaSemana.MIERCOLES, hora), TipoAsignacion.LABORATORIO);
  }
  // Miercoles 17:00 - 19:00 (Laboratorio grupo 3, Lab 5)
  for (let i = 17; i < 19; i++) {
    const hora = String(i).padStart(2, '0') + ':00';
    const franja = getFranja(DiaSemana.MIERCOLES, hora);
    if (franja) {
      await crearAsignacion(grupoPlaneamientoEstrategico, oscar, lab5, franja, TipoAsignacion.LABORATORIO);
    }
  }
  // Jueves 9:00 - 11:00 (Laboratorio grupo 2, Lab 3)
  for (let i = 9; i < 11; i++) {
    const hora = String(i).padStart(2, '0') + ':00';
    await crearAsignacion(grupoPlaneamientoEstrategico, oscar, lab3, getFranja(DiaSemana.JUEVES, hora), TipoAsignacion.LABORATORIO);
  }

  // --- Jhoe Gonzalez: Cadena de Suministros ---
  // Miercoles 7:00 - 11:00 (Teoría y práctica, Taller de confecciones)
  for (let i = 7; i < 11; i++) {
    const hora = String(i).padStart(2, '0') + ':00';
    await crearAsignacion(grupoCadenaSuministros, jhoe, tallerConfecciones, getFranja(DiaSemana.MIERCOLES, hora), TipoAsignacion.TEORIA);
  }

  console.log('  ✅ Asignaciones de horario creadas');
  console.log('✅ Séptimo ciclo actualizado exitosamente!');
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
