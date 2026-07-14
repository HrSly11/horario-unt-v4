import 'dotenv/config';
import { PrismaClient, CategoriaDocente, TipoDocente, ModalidadDocente, TipoAula, DiaSemana, TipoAsignacion } from '../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

const connectionString = process.env.DATABASE_URL!;
const pool = new pg.Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🌱 Populando quinto ciclo (2026-I)...');

  // 1. Obtener datos base
  const periodo2026I = await prisma.periodoAcademico.findUniqueOrThrow({ where: { nombre: '2026-I' } });
  const franjas = await prisma.franjaHoraria.findMany();
  const getFranja = (dia: DiaSemana, horaInicio: string) => franjas.find(f => f.dia === dia && f.horaInicio === horaInicio);
  const deptoSistemas = await prisma.departamento.findFirstOrThrow({ where: { nombre: 'Departamento de Ingeniería de Sistemas' } });
  const deptoIndustrial = await prisma.departamento.findFirstOrThrow({ where: { nombre: 'Departamento de Ingeniería Industrial' } });
  const deptoMatematicas = await prisma.departamento.findFirstOrThrow({ where: { nombre: 'Departamento de Matemáticas' } });

  // 2. Añadir docentes faltantes
  const docentesData = [
    { nombre: 'Marcos Baca López', email: 'mbaca@unitru.edu.pe', categoria: CategoriaDocente.ASOCIADO, tipo: TipoDocente.NOMBRADO, antiguedad: new Date('2010-01-01'), dni: '66677788', codigoIBM: 'IBM030', modalidad: ModalidadDocente.TIEMPO_COMPLETO, horasContrato: 40, departamentoId: deptoMatematicas.id, gradoAcademico: 'Magíster', especialidad: 'Investigación de Operaciones', experienciaAnios: 15 },
    { nombre: 'Ana Cuadra Mitzugaray', email: 'acuadra@unitru.edu.pe', categoria: CategoriaDocente.ASOCIADO, tipo: TipoDocente.NOMBRADO, antiguedad: new Date('2012-01-01'), dni: '77788899', codigoIBM: 'IBM031', modalidad: ModalidadDocente.TIEMPO_COMPLETO, horasContrato: 40, departamentoId: deptoIndustrial.id, gradoAcademico: 'Magíster', especialidad: 'Contabilidad Gerencial', experienciaAnios: 13 },
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
  const luis = await prisma.docente.findUniqueOrThrow({ where: { email: 'lboy@unitru.edu.pe' } });
  const juanCarlos = await prisma.docente.findUniqueOrThrow({ where: { email: 'jobando@unitru.edu.pe' } });
  const everson = await prisma.docente.findUniqueOrThrow({ where: { email: 'eagreda@unitru.edu.pe' } });
  const robert = await prisma.docente.findUniqueOrThrow({ where: { email: 'rsanchez@unitru.edu.pe' } });
  const cesar = await prisma.docente.findUniqueOrThrow({ where: { email: 'carellano@unitru.edu.pe' } });
  const camilo = await prisma.docente.findUniqueOrThrow({ where: { email: 'csuarez@unitru.edu.pe' } });
  const marcos = await prisma.docente.findUniqueOrThrow({ where: { email: 'mbaca@unitru.edu.pe' } });
  const ana = await prisma.docente.findUniqueOrThrow({ where: { email: 'acuadra@unitru.edu.pe' } });

  // 3. Obtener aulas necesarias
  const aula303 = await prisma.aula.findUniqueOrThrow({ where: { codigo: 'EPG-303' } });
  const lab4 = await prisma.aula.findUniqueOrThrow({ where: { codigo: 'LAB-4' } });
  const lab1 = await prisma.aula.findUniqueOrThrow({ where: { codigo: 'LAB-1' } });
  const lab3 = await prisma.aula.findUniqueOrThrow({ where: { codigo: 'LAB-3' } });
  const aula307 = await prisma.aula.findUniqueOrThrow({ where: { codigo: 'EPG-307' } });
  const lab2 = await prisma.aula.findUniqueOrThrow({ where: { codigo: 'LAB-2' } });

  // 4. Obtener cursos del quinto ciclo
  const cursoIngDatosI = await prisma.curso.findUniqueOrThrow({ where: { codigo: 'EE-502' } });
  const cursoSistemasInfo = await prisma.curso.findUniqueOrThrow({ where: { codigo: 'EE-504' } });
  const cursoTransformacionDigital = await prisma.curso.findUniqueOrThrow({ where: { codigo: 'EE-702' } });
  const cursoTecnologiaWeb = await prisma.curso.findUniqueOrThrow({ where: { codigo: 'EE-501' } });
  const cursoArquitecturaComputadoras = await prisma.curso.findUniqueOrThrow({ where: { codigo: 'EE-503' } });
  const cursoTeleinformatica = await prisma.curso.findUniqueOrThrow({ where: { codigo: 'EE-703' } });
  const cursoInvestigacionOperaciones = await prisma.curso.findUniqueOrThrow({ where: { codigo: 'EP-602' } });
  const cursoContabilidadGerencial = await prisma.curso.findUniqueOrThrow({ where: { codigo: 'EP-701' } });

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

  const grupoIngDatosI = await crearGrupo(cursoIngDatosI);
  const grupoSistemasInfo = await crearGrupo(cursoSistemasInfo);
  const grupoTransformacionDigital = await crearGrupo(cursoTransformacionDigital);
  const grupoTecnologiaWeb = await crearGrupo(cursoTecnologiaWeb);
  const grupoArquitecturaComputadoras = await crearGrupo(cursoArquitecturaComputadoras);
  const grupoTeleinformatica = await crearGrupo(cursoTeleinformatica);
  const grupoInvestigacionOperaciones = await crearGrupo(cursoInvestigacionOperaciones);
  const grupoContabilidadGerencial = await crearGrupo(cursoContabilidadGerencial);
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

  await crearAsignacionCarga(luis, grupoIngDatosI, TipoAsignacion.TEORIA, 3);
  await crearAsignacionCarga(luis, grupoIngDatosI, TipoAsignacion.LABORATORIO, 9);
  await crearAsignacionCarga(juanCarlos, grupoSistemasInfo, TipoAsignacion.TEORIA, 4);
  await crearAsignacionCarga(juanCarlos, grupoSistemasInfo, TipoAsignacion.LABORATORIO, 6);
  await crearAsignacionCarga(everson, grupoTransformacionDigital, TipoAsignacion.TEORIA, 2);
  await crearAsignacionCarga(everson, grupoTransformacionDigital, TipoAsignacion.LABORATORIO, 4);
  await crearAsignacionCarga(robert, grupoTecnologiaWeb, TipoAsignacion.LABORATORIO, 9);
  await crearAsignacionCarga(cesar, grupoArquitecturaComputadoras, TipoAsignacion.TEORIA, 3);
  await crearAsignacionCarga(cesar, grupoArquitecturaComputadoras, TipoAsignacion.LABORATORIO, 6);
  await crearAsignacionCarga(camilo, grupoTeleinformatica, TipoAsignacion.TEORIA, 2);
  await crearAsignacionCarga(camilo, grupoTeleinformatica, TipoAsignacion.LABORATORIO, 7);
  await crearAsignacionCarga(marcos, grupoInvestigacionOperaciones, TipoAsignacion.TEORIA, 4);
  await crearAsignacionCarga(marcos, grupoInvestigacionOperaciones, TipoAsignacion.LABORATORIO, 4);
  await crearAsignacionCarga(ana, grupoContabilidadGerencial, TipoAsignacion.TEORIA, 5);
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

  await crearDocenteGrupo(luis, grupoIngDatosI);
  await crearDocenteGrupo(juanCarlos, grupoSistemasInfo);
  await crearDocenteGrupo(everson, grupoTransformacionDigital);
  await crearDocenteGrupo(robert, grupoTecnologiaWeb);
  await crearDocenteGrupo(cesar, grupoArquitecturaComputadoras);
  await crearDocenteGrupo(camilo, grupoTeleinformatica);
  await crearDocenteGrupo(marcos, grupoInvestigacionOperaciones);
  await crearDocenteGrupo(ana, grupoContabilidadGerencial);
  console.log('  ✅ Vinculaciones docente-grupo creadas');

  // 8. Crear Asignaciones (horario real)
  const crearAsignacion = async (grupo: any, docente: any, aula: any, franja: any, tipo: TipoAsignacion) => {
    if (!franja) {
      console.warn(`  ⚠️ No se encontró franja`);
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

  // --- Luis Boy: Ingeniería de Datos I ---
  // Lunes 7-10 (3h teoría, Posgrado A-303)
  for (let i = 7; i < 10; i++) {
    const hora = String(i).padStart(2, '0') + ':00';
    await crearAsignacion(grupoIngDatosI, luis, aula303, getFranja(DiaSemana.LUNES, hora)!, TipoAsignacion.TEORIA);
  }
  // Lunes 10-13 (3h lab, Lab 4)
  for (let i = 10; i < 13; i++) {
    const hora = String(i).padStart(2, '0') + ':00';
    await crearAsignacion(grupoIngDatosI, luis, lab4, getFranja(DiaSemana.LUNES, hora)!, TipoAsignacion.LABORATORIO);
  }
  // Martes 7-10 (3h lab, Lab 4)
  for (let i = 7; i < 10; i++) {
    const hora = String(i).padStart(2, '0') + ':00';
    await crearAsignacion(grupoIngDatosI, luis, lab4, getFranja(DiaSemana.MARTES, hora)!, TipoAsignacion.LABORATORIO);
  }
  // Martes 10-13 (3h lab, Lab 4)
  for (let i = 10; i < 13; i++) {
    const hora = String(i).padStart(2, '0') + ':00';
    await crearAsignacion(grupoIngDatosI, luis, lab4, getFranja(DiaSemana.MARTES, hora)!, TipoAsignacion.LABORATORIO);
  }

  // --- Juan Carlos Obando: Sistemas de Información ---
  // Miércoles 9-13 (4h teoría, Posgrado A-303)
  for (let i = 9; i < 13; i++) {
    const hora = String(i).padStart(2, '0') + ':00';
    await crearAsignacion(grupoSistemasInfo, juanCarlos, aula303, getFranja(DiaSemana.MIERCOLES, hora)!, TipoAsignacion.TEORIA);
  }
  // Miércoles 14-20 (6h lab, Lab 1)
  for (let i = 14; i < 20; i++) {
    const hora = String(i).padStart(2, '0') + ':00';
    const franja = getFranja(DiaSemana.MIERCOLES, hora);
    if (franja) {
      await crearAsignacion(grupoSistemasInfo, juanCarlos, lab1, franja, TipoAsignacion.LABORATORIO);
    }
  }

  // --- Everson Agreda: Transformación Digital ---
  // Jueves 7-9 (2h lab, Lab 3)
  for (let i = 7; i < 9; i++) {
    const hora = String(i).padStart(2, '0') + ':00';
    await crearAsignacion(grupoTransformacionDigital, everson, lab3, getFranja(DiaSemana.JUEVES, hora)!, TipoAsignacion.LABORATORIO);
  }
  // Jueves 9-11 (2h teoría, Posgrado A-307)
  for (let i = 9; i < 11; i++) {
    const hora = String(i).padStart(2, '0') + ':00';
    await crearAsignacion(grupoTransformacionDigital, everson, aula307, getFranja(DiaSemana.JUEVES, hora)!, TipoAsignacion.TEORIA);
  }
  // Jueves 11-13 (2h lab, Lab 3)
  for (let i = 11; i < 13; i++) {
    const hora = String(i).padStart(2, '0') + ':00';
    await crearAsignacion(grupoTransformacionDigital, everson, lab3, getFranja(DiaSemana.JUEVES, hora)!, TipoAsignacion.LABORATORIO);
  }

  // --- Robert Sánchez: Tecnología Web ---
  // Lunes 15-18 (3h lab, Lab 1)
  for (let i = 15; i < 18; i++) {
    const hora = String(i).padStart(2, '0') + ':00';
    const franja = getFranja(DiaSemana.LUNES, hora);
    if (franja) {
      await crearAsignacion(grupoTecnologiaWeb, robert, lab1, franja, TipoAsignacion.LABORATORIO);
    }
  }
  // Martes 15-18 (3h lab, Lab 1)
  for (let i = 15; i < 18; i++) {
    const hora = String(i).padStart(2, '0') + ':00';
    const franja = getFranja(DiaSemana.MARTES, hora);
    if (franja) {
      await crearAsignacion(grupoTecnologiaWeb, robert, lab1, franja, TipoAsignacion.LABORATORIO);
    }
  }
  // Jueves 15-18 (3h lab, Lab 4)
  for (let i = 15; i < 18; i++) {
    const hora = String(i).padStart(2, '0') + ':00';
    const franja = getFranja(DiaSemana.JUEVES, hora);
    if (franja) {
      await crearAsignacion(grupoTecnologiaWeb, robert, lab4, franja, TipoAsignacion.LABORATORIO);
    }
  }

  // --- César Arellano: Arquitectura de Computadoras ---
  // Miércoles 14-20 (6h lab, Lab 2)
  for (let i = 14; i < 20; i++) {
    const hora = String(i).padStart(2, '0') + ':00';
    const franja = getFranja(DiaSemana.MIERCOLES, hora);
    if (franja) {
      await crearAsignacion(grupoArquitecturaComputadoras, cesar, lab2, franja, TipoAsignacion.LABORATORIO);
    }
  }
  // Viernes 9-12 (3h teoría, Posgrado A-307)
  for (let i = 9; i < 12; i++) {
    const hora = String(i).padStart(2, '0') + ':00';
    await crearAsignacion(grupoArquitecturaComputadoras, cesar, aula307, getFranja(DiaSemana.VIERNES, hora)!, TipoAsignacion.TEORIA);
  }

  // --- Camilo Suárez: Teleinformática ---
  // Martes 13-15 (2h lab, Lab 2)
  for (let i = 13; i < 15; i++) {
    const hora = String(i).padStart(2, '0') + ':00';
    const franja = getFranja(DiaSemana.MARTES, hora);
    if (franja) {
      await crearAsignacion(grupoTeleinformatica, camilo, lab2, franja, TipoAsignacion.LABORATORIO);
    }
  }
  // Martes 19-21 (2h lab, Lab 2)
  for (let i = 19; i < 21; i++) {
    const hora = String(i).padStart(2, '0') + ':00';
    const franja = getFranja(DiaSemana.MARTES, hora);
    if (franja) {
      await crearAsignacion(grupoTeleinformatica, camilo, lab2, franja, TipoAsignacion.LABORATORIO);
    }
  }
  // Viernes 18-21 (3h teoría, Posgrado A-307)
  for (let i = 18; i < 21; i++) {
    const hora = String(i).padStart(2, '0') + ':00';
    const franja = getFranja(DiaSemana.VIERNES, hora);
    if (franja) {
      await crearAsignacion(grupoTeleinformatica, camilo, aula307, franja, TipoAsignacion.TEORIA);
    }
  }

  // --- Marcos Baca: Investigación de Operaciones ---
  // Jueves mañana (7-11, 4h mix, Lab 2 y A-307)
  for (let i = 7; i < 9; i++) {
    const hora = String(i).padStart(2, '0') + ':00';
    await crearAsignacion(grupoInvestigacionOperaciones, marcos, lab2, getFranja(DiaSemana.JUEVES, hora)!, TipoAsignacion.LABORATORIO);
  }
  for (let i = 9; i < 11; i++) {
    const hora = String(i).padStart(2, '0') + ':00';
    await crearAsignacion(grupoInvestigacionOperaciones, marcos, aula307, getFranja(DiaSemana.JUEVES, hora)!, TipoAsignacion.TEORIA);
  }
  // Viernes 7-9 (2h lab, Lab 2)
  for (let i = 7; i < 9; i++) {
    const hora = String(i).padStart(2, '0') + ':00';
    await crearAsignacion(grupoInvestigacionOperaciones, marcos, lab2, getFranja(DiaSemana.VIERNES, hora)!, TipoAsignacion.LABORATORIO);
  }

  // --- Ana Cuadra: Contabilidad Gerencial ---
  // Jueves 18-20 (2h teoría, Posgrado A-307)
  for (let i = 18; i < 20; i++) {
    const hora = String(i).padStart(2, '0') + ':00';
    const franja = getFranja(DiaSemana.JUEVES, hora);
    if (franja) {
      await crearAsignacion(grupoContabilidadGerencial, ana, aula307, franja, TipoAsignacion.TEORIA);
    }
  }
  // Viernes 14-17 (3h teoría, Posgrado A-307)
  for (let i = 14; i < 17; i++) {
    const hora = String(i).padStart(2, '0') + ':00';
    const franja = getFranja(DiaSemana.VIERNES, hora);
    if (franja) {
      await crearAsignacion(grupoContabilidadGerencial, ana, aula307, franja, TipoAsignacion.TEORIA);
    }
  }

  console.log('  ✅ Asignaciones de horario creadas');
  console.log('✅ Quinto ciclo populado exitosamente!');
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
