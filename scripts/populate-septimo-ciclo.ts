import 'dotenv/config';
import { PrismaClient, CategoriaDocente, TipoDocente, ModalidadDocente, TipoAula, DiaSemana, TipoAsignacion } from '../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

const connectionString = process.env.DATABASE_URL!;
const pool = new pg.Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🌱 Populando séptimo ciclo (2026-I)...');

  // 1. Obtener datos base
  const periodo2026I = await prisma.periodoAcademico.findUniqueOrThrow({ where: { nombre: '2026-I' } });
  const franjas = await prisma.franjaHoraria.findMany();
  const getFranja = (dia: DiaSemana, horaInicio: string) => franjas.find(f => f.dia === dia && f.horaInicio === horaInicio);
  const deptoSistemas = await prisma.departamento.findFirstOrThrow({ where: { nombre: 'Departamento de Ingeniería de Sistemas' } });
  const deptoIndustrial = await prisma.departamento.findFirstOrThrow({ where: { nombre: 'Departamento de Ingeniería Industrial' } });

  // 2. Añadir docentes faltantes
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

  // 3. Añadir aula faltante
  let aulaAudiovisuales = await prisma.aula.findUnique({ where: { codigo: 'AUDIOVISUALES' } });
  if (!aulaAudiovisuales) {
    aulaAudiovisuales = await prisma.aula.create({
      data: {
        codigo: 'AUDIOVISUALES',
        nombre: 'Audiovisuales',
        capacidad: 50,
        tipo: TipoAula.TEORIA,
        edificio: 'Edificio Principal',
        piso: 1,
      },
    });
    console.log('  ✅ Aula Audiovisuales creada');
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
  const cursoIngSoftwareI = await prisma.curso.findUniqueOrThrow({ where: { codigo: 'EE-704' } });
  const cursoRedesComunicacionesI = await prisma.curso.findUniqueOrThrow({ where: { codigo: 'EE-703' } });
  const cursoNegociosElectronicos = await prisma.curso.findUniqueOrThrow({ where: { codigo: 'EL-702' } });
  const cursoGestionServiciosTI = await prisma.curso.findUniqueOrThrow({ where: { codigo: 'EE-701' } });
  const cursoMetodologiaInvestigacion = await prisma.curso.findUniqueOrThrow({ where: { codigo: 'EE-901' } });
  const cursoAdminBasesDatos = await prisma.curso.findUniqueOrThrow({ where: { codigo: 'EE-603' } });
  const cursoPlaneamientoEstrategico = await prisma.curso.findUniqueOrThrow({ where: { codigo: 'EE-702' } });
  const cursoCadenaSuministros = await prisma.curso.findUniqueOrThrow({ where: { codigo: 'EP-701' } });

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

  const grupoIngSoftwareI = await crearGrupo(cursoIngSoftwareI);
  const grupoRedesComunicacionesI = await crearGrupo(cursoRedesComunicacionesI);
  const grupoNegociosElectronicos = await crearGrupo(cursoNegociosElectronicos);
  const grupoGestionServiciosTI = await crearGrupo(cursoGestionServiciosTI);
  const grupoMetodologiaInvestigacion = await crearGrupo(cursoMetodologiaInvestigacion);
  const grupoAdminBasesDatos = await crearGrupo(cursoAdminBasesDatos);
  const grupoPlaneamientoEstrategico = await crearGrupo(cursoPlaneamientoEstrategico);
  const grupoCadenaSuministros = await crearGrupo(cursoCadenaSuministros);
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

  await crearAsignacionCarga(juanPedro, grupoIngSoftwareI, TipoAsignacion.LABORATORIO, 3);
  await crearAsignacionCarga(juanPedro, grupoIngSoftwareI, TipoAsignacion.TEORIA, 3);
  await crearAsignacionCarga(cesar, grupoRedesComunicacionesI, TipoAsignacion.LABORATORIO, 3);
  await crearAsignacionCarga(cesar, grupoRedesComunicacionesI, TipoAsignacion.TEORIA, 2);
  await crearAsignacionCarga(robert, grupoIngSoftwareI, TipoAsignacion.LABORATORIO, 6);
  await crearAsignacionCarga(everson, grupoNegociosElectronicos, TipoAsignacion.TEORIA, 3);
  await crearAsignacionCarga(alberto, grupoGestionServiciosTI, TipoAsignacion.TEORIA, 3);
  await crearAsignacionCarga(alberto, grupoGestionServiciosTI, TipoAsignacion.LABORATORIO, 4);
  await crearAsignacionCarga(paul, grupoMetodologiaInvestigacion, TipoAsignacion.TEORIA, 4);
  await crearAsignacionCarga(ricardo, grupoAdminBasesDatos, TipoAsignacion.TEORIA, 2);
  await crearAsignacionCarga(ricardo, grupoAdminBasesDatos, TipoAsignacion.LABORATORIO, 6);
  await crearAsignacionCarga(oscar, grupoPlaneamientoEstrategico, TipoAsignacion.TEORIA, 2);
  await crearAsignacionCarga(oscar, grupoPlaneamientoEstrategico, TipoAsignacion.LABORATORIO, 4);
  await crearAsignacionCarga(paul, grupoNegociosElectronicos, TipoAsignacion.LABORATORIO, 5);
  await crearAsignacionCarga(jhoe, grupoCadenaSuministros, TipoAsignacion.TEORIA, 4);
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

  await crearDocenteGrupo(juanPedro, grupoIngSoftwareI);
  await crearDocenteGrupo(cesar, grupoRedesComunicacionesI);
  await crearDocenteGrupo(robert, grupoIngSoftwareI);
  await crearDocenteGrupo(everson, grupoNegociosElectronicos);
  await crearDocenteGrupo(alberto, grupoGestionServiciosTI);
  await crearDocenteGrupo(paul, grupoMetodologiaInvestigacion);
  await crearDocenteGrupo(ricardo, grupoAdminBasesDatos);
  await crearDocenteGrupo(oscar, grupoPlaneamientoEstrategico);
  await crearDocenteGrupo(jhoe, grupoCadenaSuministros);
  console.log('  ✅ Vinculaciones docente-grupo creadas');

  // 9. Crear Asignaciones (horario real)
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

  // --- Juan Pedro Santos: Ingeniería de Software I ---
  // Martes 7-10 (3h lab, Lab 1)
  for (let i = 7; i < 10; i++) {
    const hora = String(i).padStart(2, '0') + ':00';
    await crearAsignacion(grupoIngSoftwareI, juanPedro, lab1, getFranja(DiaSemana.MARTES, hora), TipoAsignacion.LABORATORIO);
  }
  // Martes 10-13 (3h teoría, Posgrado A-303)
  for (let i = 10; i < 13; i++) {
    const hora = String(i).padStart(2, '0') + ':00';
    await crearAsignacion(grupoIngSoftwareI, juanPedro, aula303, getFranja(DiaSemana.MARTES, hora), TipoAsignacion.TEORIA);
  }

  // --- César Arellano: Redes y Comunicaciones I ---
  // Lunes 10-13 (3h lab, Lab 3)
  for (let i = 10; i < 13; i++) {
    const hora = String(i).padStart(2, '0') + ':00';
    await crearAsignacion(grupoRedesComunicacionesI, cesar, lab3, getFranja(DiaSemana.LUNES, hora), TipoAsignacion.LABORATORIO);
  }
  // Lunes 13-18 (5h lab, Lab 2)
  for (let i = 13; i < 18; i++) {
    const hora = String(i).padStart(2, '0') + ':00';
    const franja = getFranja(DiaSemana.LUNES, hora);
    if (franja) {
      await crearAsignacion(grupoRedesComunicacionesI, cesar, lab2, franja, TipoAsignacion.LABORATORIO);
    }
  }
  // Viernes 16-18 (2h teoría, Posgrado A-311)
  for (let i = 16; i < 18; i++) {
    const hora = String(i).padStart(2, '0') + ':00';
    await crearAsignacion(grupoRedesComunicacionesI, cesar, aula311, getFranja(DiaSemana.VIERNES, hora), TipoAsignacion.TEORIA);
  }

  // --- Robert Sánchez: Ingeniería de Software I ---
  // Lunes 7-13 (6h lab, Lab 1)
  for (let i = 7; i < 13; i++) {
    const hora = String(i).padStart(2, '0') + ':00';
    await crearAsignacion(grupoIngSoftwareI, robert, lab1, getFranja(DiaSemana.LUNES, hora), TipoAsignacion.LABORATORIO);
  }

  // --- Everson Agreda: Negocios Electrónicos ---
  // Martes 15-18 (3h teoría, Posgrado A-311)
  for (let i = 15; i < 18; i++) {
    const hora = String(i).padStart(2, '0') + ':00';
    const franja = getFranja(DiaSemana.MARTES, hora);
    if (franja) {
      await crearAsignacion(grupoNegociosElectronicos, everson, aula311, franja, TipoAsignacion.TEORIA);
    }
  }

  // --- Alberto Mendoza: Gestión de Servicios de TI ---
  // Viernes 7-10 (3h teoría, Posgrado A-303)
  for (let i = 7; i < 10; i++) {
    const hora = String(i).padStart(2, '0') + ':00';
    await crearAsignacion(grupoGestionServiciosTI, alberto, aula303, getFranja(DiaSemana.VIERNES, hora), TipoAsignacion.TEORIA);
  }
  // Viernes 10-14 (4h lab, Lab 1)
  for (let i = 10; i < 14; i++) {
    const hora = String(i).padStart(2, '0') + ':00';
    await crearAsignacion(grupoGestionServiciosTI, alberto, lab1, getFranja(DiaSemana.VIERNES, hora), TipoAsignacion.LABORATORIO);
  }

  // --- Paul Cotrina: Metodología de la Investigación Científica ---
  // Jueves 14-18 (4h teoría, Posgrado A-307)
  for (let i = 14; i < 18; i++) {
    const hora = String(i).padStart(2, '0') + ':00';
    await crearAsignacion(grupoMetodologiaInvestigacion, paul, aula307, getFranja(DiaSemana.JUEVES, hora), TipoAsignacion.TEORIA);
  }

  // --- Ricardo Mendoza: Administración de Base de Datos ---
  // Jueves 7-9 (2h teoría, Posgrado A-307)
  for (let i = 7; i < 9; i++) {
    const hora = String(i).padStart(2, '0') + ':00';
    await crearAsignacion(grupoAdminBasesDatos, ricardo, aula307, getFranja(DiaSemana.JUEVES, hora), TipoAsignacion.TEORIA);
  }
  // Jueves 18-21 (3h lab, Lab 4)
  for (let i = 18; i < 21; i++) {
    const hora = String(i).padStart(2, '0') + ':00';
    const franja = getFranja(DiaSemana.JUEVES, hora);
    if (franja) {
      await crearAsignacion(grupoAdminBasesDatos, ricardo, lab4, franja, TipoAsignacion.LABORATORIO);
    }
  }
  // Viernes 18-21 (3h lab, Lab 2)
  for (let i = 18; i < 21; i++) {
    const hora = String(i).padStart(2, '0') + ':00';
    const franja = getFranja(DiaSemana.VIERNES, hora);
    if (franja) {
      await crearAsignacion(grupoAdminBasesDatos, ricardo, lab2, franja, TipoAsignacion.LABORATORIO);
    }
  }

  // --- Oscar Alcántara: Planeamiento Estratégico de TI ---
  // Martes 13-15 (2h teoría, Posgrado A-307)
  for (let i = 13; i < 15; i++) {
    const hora = String(i).padStart(2, '0') + ':00';
    const franja = getFranja(DiaSemana.MARTES, hora);
    if (franja) {
      await crearAsignacion(grupoPlaneamientoEstrategico, oscar, aula307, franja, TipoAsignacion.TEORIA);
    }
  }
  // Miércoles 13-17 (4h lab, Lab 4)
  for (let i = 13; i < 17; i++) {
    const hora = String(i).padStart(2, '0') + ':00';
    const franja = getFranja(DiaSemana.MIERCOLES, hora);
    if (franja) {
      await crearAsignacion(grupoPlaneamientoEstrategico, oscar, lab4, franja, TipoAsignacion.LABORATORIO);
    }
  }
  // Miércoles 17-18 (1h teoría, Audiovisuales)
  const franja17 = getFranja(DiaSemana.MIERCOLES, '17:00');
  if (franja17) {
    await crearAsignacion(grupoPlaneamientoEstrategico, oscar, aulaAudiovisuales, franja17, TipoAsignacion.TEORIA);
  }
  // Jueves 9-11 (2h lab, Lab 3)
  for (let i = 9; i < 11; i++) {
    const hora = String(i).padStart(2, '0') + ':00';
    await crearAsignacion(grupoPlaneamientoEstrategico, oscar, lab3, getFranja(DiaSemana.JUEVES, hora), TipoAsignacion.LABORATORIO);
  }

  // --- Paul Cotrina: Negocios Electrónicos ---
  // Lunes 13-18 (5h lab, Lab 4)
  for (let i = 13; i < 18; i++) {
    const hora = String(i).padStart(2, '0') + ':00';
    const franja = getFranja(DiaSemana.LUNES, hora);
    if (franja) {
      await crearAsignacion(grupoNegociosElectronicos, paul, lab4, franja, TipoAsignacion.LABORATORIO);
    }
  }

  // --- Jhoe González: Cadena de Suministros ---
  // Miércoles 7-11 (4h teoría, Taller de Confecciones)
  for (let i = 7; i < 11; i++) {
    const hora = String(i).padStart(2, '0') + ':00';
    await crearAsignacion(grupoCadenaSuministros, jhoe, tallerConfecciones, getFranja(DiaSemana.MIERCOLES, hora), TipoAsignacion.TEORIA);
  }

  console.log('  ✅ Asignaciones de horario creadas');
  console.log('✅ Séptimo ciclo populado exitosamente!');
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
