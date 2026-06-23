import 'dotenv/config';
import { PrismaClient, CategoriaDocente, TipoDocente, ModalidadDocente, TipoAula, DiaSemana, UserRole, EstadoDeclaracion, TipoCargaNoLectiva, TipoAsignacion, EstadoPeriodo } from '../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import bcrypt from 'bcryptjs';
import { getTeachersWithoutAuthorityAccount } from '../src/server/domain/workflow-foundation';

const connectionString = process.env.DATABASE_URL!;
const pool = new pg.Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Ã°Å¸Å’Â± Seeding database...');
  const foundationPrisma = prisma as any;

  // Limpiar base de datos antes de sembrar (en orden inverso de relaciones)
  await foundationPrisma.publicacionAcademica.deleteMany();
  await foundationPrisma.migracionReconciliacion.deleteMany();
  await prisma.documentoFirmaDigital.deleteMany();
  await prisma.declaracionCarga.deleteMany();
  await prisma.cargaNoLectiva.deleteMany();
  await prisma.asignacionCargaLectiva.deleteMany();
  await foundationPrisma.coberturaComponente.deleteMany();
  await foundationPrisma.distribucionLectiva.deleteMany();
  await foundationPrisma.demandaLineaCurricula.deleteMany();
  await foundationPrisma.demandaLinea.deleteMany();
  await foundationPrisma.demandaAcademica.deleteMany();
  await foundationPrisma.procesoHorarioEscuela.deleteMany();
  await foundationPrisma.cargoDocente.deleteMany();
  await foundationPrisma.reglaCargaPorCargo.deleteMany();
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

  console.log('  Ã°Å¸â€”â€˜Ã¯Â¸Â  Base de datos limpiada');

  // Ã¢â€â‚¬Ã¢â€â‚¬ Periodos AcadÃƒÂ©micos Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
  const periodo2026I = await prisma.periodoAcademico.create({
    data: {
      nombre: '2026-I',
      fechaInicio: new Date('2026-03-25'),
      fechaFin: new Date('2026-08-10'),
      activo: true,
      estado: 'ASIGNACION',
    },
  });

  const periodo2026II = await prisma.periodoAcademico.create({
    data: {
      nombre: '2026-II',
      fechaInicio: new Date('2026-08-20'),
      fechaFin: new Date('2026-12-20'),
      activo: false,
      estado: 'PLANIFICACION',
    },
  });

  // Ã¢â€â‚¬Ã¢â€â‚¬ Franjas Horarias Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
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
  console.log(`  Ã¢Å“â€¦ ${franjasData.length} franjas horarias creadas`);

  // Ã¢â€â‚¬Ã¢â€â‚¬ Aulas Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
  const aulasData = [
    // Posgrado 3er Piso
    { codigo: 'EPG-303', nombre: 'Aula Posgrado 303', capacidad: 40, tipo: TipoAula.TEORIA, edificio: 'Escuela de Posgrado', piso: 3 },
    { codigo: 'EPG-307', nombre: 'Aula Posgrado 307', capacidad: 45, tipo: TipoAula.TEORIA, edificio: 'Escuela de Posgrado', piso: 3 },
    { codigo: 'EPG-311', nombre: 'Aula Posgrado 311', capacidad: 50, tipo: TipoAula.TEORIA, edificio: 'Escuela de Posgrado', piso: 3 },
    { codigo: 'EPG-315', nombre: 'Aula Posgrado 315', capacidad: 42, tipo: TipoAula.TEORIA, edificio: 'Escuela de Posgrado', piso: 3 },
    { codigo: 'EPG-319', nombre: 'Aula Posgrado 319', capacidad: 48, tipo: TipoAula.TEORIA, edificio: 'Escuela de Posgrado', piso: 3 },
    { codigo: 'EPG-323', nombre: 'Aula Posgrado 323', capacidad: 45, tipo: TipoAula.TEORIA, edificio: 'Escuela de Posgrado', piso: 3 },
    
    // Laboratorios
    { codigo: 'LAB-1', nombre: 'Laboratorio 1', capacidad: 16, tipo: TipoAula.LABORATORIO, edificio: 'PabellÃƒÂ³n C', piso: 1 },
    { codigo: 'LAB-2', nombre: 'Laboratorio 2', capacidad: 16, tipo: TipoAula.LABORATORIO, edificio: 'PabellÃƒÂ³n C', piso: 1 },
    { codigo: 'LAB-3', nombre: 'Laboratorio 3', capacidad: 16, tipo: TipoAula.LABORATORIO, edificio: 'PabellÃƒÂ³n C', piso: 2 },
    { codigo: 'LAB-4', nombre: 'Laboratorio 4', capacidad: 20, tipo: TipoAula.LABORATORIO, edificio: 'PabellÃƒÂ³n C', piso: 2 },
    { codigo: 'LAB-5', nombre: 'Laboratorio 5 (Auditorio)', capacidad: 20, tipo: TipoAula.LABORATORIO, edificio: 'PabellÃƒÂ³n C', piso: 2 },
  ];

  await prisma.aula.createMany({ data: aulasData });
  console.log(`  Ã¢Å“â€¦ ${aulasData.length} aulas creadas`);

  // Ã¢â€â‚¬Ã¢â€â‚¬ Cursos (Plan 2018) Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
  const cursosData = [
    // Ciclo I
    { codigo: 'EG-101', nombre: 'Desarrollo del Pensamiento LÃƒÂ³gico MatemÃƒÂ¡tico', creditos: 3, horasTeoria: 2, horasPractica: 2, horasLaboratorio: 0, ciclo: 1, departamento: 'Dpto. de MatemÃƒÂ¡ticas', condicion: 'O' },
    { codigo: 'EG-102', nombre: 'Lectura CrÃƒÂ­tica y RedacciÃƒÂ³n de Textos AcadÃƒÂ©micos', creditos: 3, horasTeoria: 2, horasPractica: 2, horasLaboratorio: 0, ciclo: 1, departamento: 'Dpto. de Lengua y Literatura', condicion: 'O' },
    { codigo: 'EG-103', nombre: 'Desarrollo Personal', creditos: 3, horasTeoria: 2, horasPractica: 2, horasLaboratorio: 0, ciclo: 1, departamento: 'Dpto. de Ciencias SicolÃƒÂ³gicas', condicion: 'O' },
    { codigo: 'EG-104', nombre: 'IntroducciÃƒÂ³n al AnÃƒÂ¡lisis MatemÃƒÂ¡tico', creditos: 4, horasTeoria: 2, horasPractica: 4, horasLaboratorio: 0, ciclo: 1, departamento: 'Dpto. de MatemÃƒÂ¡ticas', condicion: 'O' },
    { codigo: 'EG-105', nombre: 'EstadÃƒÂ­stica General', creditos: 4, horasTeoria: 2, horasPractica: 4, horasLaboratorio: 0, ciclo: 1, departamento: 'Dpto. de EstadÃƒÂ­stica', condicion: 'O' },
    { codigo: 'EE-101', nombre: 'IntroducciÃƒÂ³n a la IngenierÃƒÂ­a de Sistemas', creditos: 2, horasTeoria: 1, horasPractica: 2, horasLaboratorio: 0, ciclo: 1, departamento: 'Dpto. de Ing. Sistemas', condicion: 'O' },
    { codigo: 'EE-102', nombre: 'IntroducciÃƒÂ³n a la ProgramaciÃƒÂ³n', creditos: 3, horasTeoria: 2, horasPractica: 0, horasLaboratorio: 2, ciclo: 1, departamento: 'Dpto. de Ing. Sistemas', requiereLaboratorio: true, condicion: 'O' },
    { codigo: 'EL-101', nombre: 'TÃƒÂ©cnicas de comunicaciÃƒÂ³n eficaz (e)', creditos: 1, horasTeoria: 0, horasPractica: 2, horasLaboratorio: 0, ciclo: 1, departamento: 'Dpto. de ComunicaciÃƒÂ³n Social', condicion: 'E' },
    { codigo: 'EL-102', nombre: 'Taller de MÃƒÂºsica (e)', creditos: 1, horasTeoria: 0, horasPractica: 2, horasLaboratorio: 0, ciclo: 1, departamento: 'Dpto. de Ciencias Sociales', condicion: 'E' },
    { codigo: 'EL-103', nombre: 'Taller de Liderazgo y trabajo en equipo (e)', creditos: 1, horasTeoria: 0, horasPractica: 2, horasLaboratorio: 0, ciclo: 1, departamento: 'Dpto. de Ciencias SicolÃƒÂ³gicas', condicion: 'E' },
    
    // Ciclo II
    { codigo: 'EG-201', nombre: 'Ãƒâ€°tica, Convivencia Humana y CiudadanÃƒÂ­a', creditos: 3, horasTeoria: 2, horasPractica: 2, horasLaboratorio: 0, ciclo: 2, departamento: 'Dpto. de FilosofÃƒÂ­a y Arte', condicion: 'O' },
    { codigo: 'EG-202', nombre: 'Sociedad, Cultura y EcologÃƒÂ­a', creditos: 3, horasTeoria: 2, horasPractica: 2, horasLaboratorio: 0, ciclo: 2, departamento: 'Dpto. de Ciencias Sociales', condicion: 'O' },
    { codigo: 'EG-203', nombre: 'Cultura Investigativa y Pensamiento CrÃƒÂ­tico', creditos: 3, horasTeoria: 2, horasPractica: 2, horasLaboratorio: 0, ciclo: 2, departamento: 'Dpto. de Ciencias Sociales', condicion: 'O' },
    { codigo: 'EG-204', nombre: 'AnÃƒÂ¡lisis MatemÃƒÂ¡tico', creditos: 4, horasTeoria: 2, horasPractica: 4, horasLaboratorio: 0, ciclo: 2, departamento: 'Dpto. de MatemÃƒÂ¡ticas', condicion: 'O' },
    { codigo: 'EG-205', nombre: 'FÃƒÂ­sica General', creditos: 4, horasTeoria: 2, horasPractica: 2, horasLaboratorio: 2, ciclo: 2, departamento: 'Dpto. de FÃƒÂ­sica', requiereLaboratorio: true, condicion: 'O' },
    { codigo: 'EE-201', nombre: 'ProgramaciÃƒÂ³n Orientada a Objetos I', creditos: 4, horasTeoria: 2, horasPractica: 0, horasLaboratorio: 4, ciclo: 2, departamento: 'Dpto. de Ing. Sistemas', requiereLaboratorio: true, condicion: 'O' },
    
    // Ciclo III
    { codigo: 'EE-301', nombre: 'SistÃƒÂ©mica', creditos: 3, horasTeoria: 1, horasPractica: 2, horasLaboratorio: 2, ciclo: 3, departamento: 'Dpto. de Ing. Sistemas', requiereLaboratorio: true, condicion: 'O' },
    { codigo: 'EP-303', nombre: 'MatemÃƒÂ¡tica Aplicada', creditos: 3, horasTeoria: 1, horasPractica: 2, horasLaboratorio: 2, ciclo: 3, departamento: 'Dpto. de MatemÃƒÂ¡ticas', requiereLaboratorio: true, condicion: 'O' },
    { codigo: 'EP-304', nombre: 'FÃƒÂ­sica ElectrÃƒÂ³nica', creditos: 3, horasTeoria: 1, horasPractica: 2, horasLaboratorio: 2, ciclo: 3, departamento: 'Dpto. de FÃƒÂ­sica', requiereLaboratorio: true, condicion: 'O' },
    { codigo: 'EE-302', nombre: 'ProgramaciÃƒÂ³n Orientada a Objetos II', creditos: 4, horasTeoria: 2, horasPractica: 0, horasLaboratorio: 4, ciclo: 3, departamento: 'Dpto. de Ing. Sistemas', requiereLaboratorio: true, condicion: 'O' },
    { codigo: 'EL-301', nombre: 'IngenierÃƒÂ­a GrÃƒÂ¡fica (e)', creditos: 3, horasTeoria: 1, horasPractica: 1, horasLaboratorio: 3, ciclo: 3, departamento: 'Dpto. de Ing. Sistemas', condicion: 'E', requiereLaboratorio: true },

    // Ciclo IV
    { codigo: 'EE-401', nombre: 'DiseÃƒÂ±o Web', creditos: 3, horasTeoria: 1, horasPractica: 1, horasLaboratorio: 3, ciclo: 4, departamento: 'Dpto. de Ing. Sistemas', requiereLaboratorio: true, condicion: 'O' },
    { codigo: 'EP-402', nombre: 'Pensamiento de DiseÃƒÂ±o', creditos: 3, horasTeoria: 1, horasPractica: 2, horasLaboratorio: 2, ciclo: 4, departamento: 'Dpto. de Ing. Sistemas', requiereLaboratorio: true, condicion: 'O' },
    { codigo: 'EE-402', nombre: 'Sistemas Digitales', creditos: 3, horasTeoria: 1, horasPractica: 2, horasLaboratorio: 2, ciclo: 4, departamento: 'Dpto. de Ing. Sistemas', requiereLaboratorio: true, condicion: 'O' },
    { codigo: 'EE-403', nombre: 'Estructura de Datos Orientado a Objetos', creditos: 4, horasTeoria: 2, horasPractica: 1, horasLaboratorio: 3, ciclo: 4, departamento: 'Dpto. de Ing. Sistemas', requiereLaboratorio: true, condicion: 'O' },
    { codigo: 'EL-401', nombre: 'ComputaciÃƒÂ³n GrÃƒÂ¡fica y Visual (e)', creditos: 3, horasTeoria: 1, horasPractica: 1, horasLaboratorio: 3, ciclo: 4, departamento: 'Dpto. de Ing. Sistemas', condicion: 'E', requiereLaboratorio: true },
    { codigo: 'EL-402', nombre: 'Plataformas TecnolÃƒÂ³gicas (e)', creditos: 3, horasTeoria: 2, horasPractica: 0, horasLaboratorio: 2, ciclo: 4, departamento: 'Dpto. de Ing. Sistemas', condicion: 'E', requiereLaboratorio: true },

    // Ciclo V
    { codigo: 'EE-501', nombre: 'TecnologÃƒÂ­as Web', creditos: 3, horasTeoria: 1, horasPractica: 1, horasLaboratorio: 3, ciclo: 5, departamento: 'Dpto. de Ing. Sistemas', requiereLaboratorio: true, condicion: 'O' },
    { codigo: 'EE-502', nombre: 'IngenierÃƒÂ­a de Datos I', creditos: 4, horasTeoria: 2, horasPractica: 1, horasLaboratorio: 3, ciclo: 5, departamento: 'Dpto. de Ing. Sistemas', requiereLaboratorio: true, condicion: 'O' },
    { codigo: 'EE-503', nombre: 'Arquitectura y OrganizaciÃƒÂ³n de Computadoras', creditos: 3, horasTeoria: 1, horasPractica: 2, horasLaboratorio: 2, ciclo: 5, departamento: 'Dpto. de Ing. Sistemas', requiereLaboratorio: true, condicion: 'O' },
    { codigo: 'EE-504', nombre: 'Sistemas de InformaciÃƒÂ³n', creditos: 4, horasTeoria: 2, horasPractica: 2, horasLaboratorio: 2, ciclo: 5, departamento: 'Dpto. de Ing. Sistemas', requiereLaboratorio: true, condicion: 'O' },

    // Ciclo VI
    { codigo: 'EE-601', nombre: 'Sistemas Inteligentes', creditos: 3, horasTeoria: 1, horasPractica: 2, horasLaboratorio: 2, ciclo: 6, departamento: 'Dpto. de Ing. Sistemas', requiereLaboratorio: true, condicion: 'O' },
    { codigo: 'EP-602', nombre: 'IngenierÃƒÂ­a EconÃƒÂ³mica', creditos: 3, horasTeoria: 1, horasPractica: 2, horasLaboratorio: 2, ciclo: 6, departamento: 'Dpto. de Ing. Industrial', requiereLaboratorio: true, condicion: 'O' },
    { codigo: 'EE-602', nombre: 'IngenierÃƒÂ­a de Datos II', creditos: 4, horasTeoria: 2, horasPractica: 1, horasLaboratorio: 3, ciclo: 6, departamento: 'Dpto. de Ing. Sistemas', requiereLaboratorio: true, condicion: 'O' },
    { codigo: 'EE-603', nombre: 'Sistemas Operativos', creditos: 3, horasTeoria: 1, horasPractica: 2, horasLaboratorio: 2, ciclo: 6, departamento: 'Dpto. de Ing. Sistemas', requiereLaboratorio: true, condicion: 'O' },
    { codigo: 'EE-604', nombre: 'IngenierÃƒÂ­a de Requerimientos', creditos: 3, horasTeoria: 1, horasPractica: 2, horasLaboratorio: 2, ciclo: 6, departamento: 'Dpto. de Ing. Sistemas', requiereLaboratorio: true, condicion: 'O' },

    // Ciclo VII
    { codigo: 'EP-701', nombre: 'Cadena de Suministro', creditos: 3, horasTeoria: 2, horasPractica: 2, horasLaboratorio: 0, ciclo: 7, departamento: 'Dpto. de Ing. Industrial', condicion: 'O' },
    { codigo: 'EE-701', nombre: 'GestiÃƒÂ³n de Servicios de TIC', creditos: 3, horasTeoria: 1, horasPractica: 2, horasLaboratorio: 2, ciclo: 7, departamento: 'Dpto. de Ing. Sistemas', requiereLaboratorio: true, condicion: 'O' },
    { codigo: 'EE-702', nombre: 'Planeamiento EstratÃƒÂ©gico de la InformaciÃƒÂ³n', creditos: 3, horasTeoria: 1, horasPractica: 2, horasLaboratorio: 2, ciclo: 7, departamento: 'Dpto. de Ing. Sistemas', requiereLaboratorio: true, condicion: 'O' },
    { codigo: 'EE-703', nombre: 'Redes y Comunicaciones I', creditos: 3, horasTeoria: 1, horasPractica: 1, horasLaboratorio: 3, ciclo: 7, departamento: 'Dpto. de Ing. Sistemas', requiereLaboratorio: true, condicion: 'O' },
    { codigo: 'EE-704', nombre: 'IngenierÃƒÂ­a del Software I', creditos: 4, horasTeoria: 2, horasPractica: 1, horasLaboratorio: 3, ciclo: 7, departamento: 'Dpto. de Ing. Sistemas', requiereLaboratorio: true, condicion: 'O' },
    { codigo: 'EL-702', nombre: 'Negocios ElectrÃƒÂ³nicos (e)', creditos: 3, horasTeoria: 2, horasPractica: 0, horasLaboratorio: 2, ciclo: 7, departamento: 'Dpto. de Ing. Sistemas', condicion: 'E', requiereLaboratorio: true },

    // Ciclo VIII
    { codigo: 'EE-801', nombre: 'Seguridad de la InformaciÃƒÂ³n', creditos: 3, horasTeoria: 1, horasPractica: 2, horasLaboratorio: 2, ciclo: 8, departamento: 'Dpto. de Ing. Sistemas', requiereLaboratorio: true, condicion: 'O' },
    { codigo: 'EE-802', nombre: 'Internet de las Cosas', creditos: 3, horasTeoria: 1, horasPractica: 1, horasLaboratorio: 3, ciclo: 8, departamento: 'Dpto. de Ing. Sistemas', requiereLaboratorio: true, condicion: 'O' },
    { codigo: 'EE-803', nombre: 'Inteligencia de Negocios', creditos: 3, horasTeoria: 1, horasPractica: 2, horasLaboratorio: 2, ciclo: 8, departamento: 'Dpto. de Ing. Sistemas', requiereLaboratorio: true, condicion: 'O' },
    { codigo: 'EE-804', nombre: 'Redes y Comunicaciones II', creditos: 3, horasTeoria: 1, horasPractica: 1, horasLaboratorio: 3, ciclo: 8, departamento: 'Dpto. de Ing. Sistemas', requiereLaboratorio: true, condicion: 'O' },
    { codigo: 'EE-805', nombre: 'IngenierÃƒÂ­a del Software II', creditos: 4, horasTeoria: 2, horasPractica: 1, horasLaboratorio: 3, ciclo: 8, departamento: 'Dpto. de Ing. Sistemas', requiereLaboratorio: true, condicion: 'O' },

    // Ciclo IX
    { codigo: 'EE-901', nombre: 'GestiÃƒÂ³n de Proyectos de TIC', creditos: 1, horasTeoria: 1, horasPractica: 2, horasLaboratorio: 2, ciclo: 9, departamento: 'Dpto. de Ing. Sistemas', requiereLaboratorio: true, condicion: 'O' },
    { codigo: 'EE-902', nombre: 'AuditorÃƒÂ­a InformÃƒÂ¡tica', creditos: 3, horasTeoria: 1, horasPractica: 2, horasLaboratorio: 2, ciclo: 9, departamento: 'Dpto. de Ing. Sistemas', requiereLaboratorio: true, condicion: 'O' },
    { codigo: 'EI-901', nombre: 'Tesis I', creditos: 4, horasTeoria: 2, horasPractica: 2, horasLaboratorio: 2, ciclo: 9, departamento: 'Dpto. de Ing. Sistemas', requiereLaboratorio: true, condicion: 'O' },
    { codigo: 'EE-903', nombre: 'AnalÃƒÂ­tica de Negocios', creditos: 3, horasTeoria: 1, horasPractica: 2, horasLaboratorio: 2, ciclo: 9, departamento: 'Dpto. de Ing. Sistemas', requiereLaboratorio: true, condicion: 'O' },
    { codigo: 'EE-904', nombre: 'ComputaciÃƒÂ³n en la Nube', creditos: 3, horasTeoria: 1, horasPractica: 1, horasLaboratorio: 3, ciclo: 9, departamento: 'Dpto. de Ing. Sistemas', requiereLaboratorio: true, condicion: 'O' },
    { codigo: 'EL-901', nombre: 'Emprendedurismo TecnolÃƒÂ³gico (e)', creditos: 3, horasTeoria: 2, horasPractica: 0, horasLaboratorio: 2, ciclo: 9, departamento: 'Dpto. de Ing. Sistemas', condicion: 'E', requiereLaboratorio: true },
    { codigo: 'EL-902', nombre: 'Hackeo Ãƒâ€°tico (e)', creditos: 3, horasTeoria: 2, horasPractica: 0, horasLaboratorio: 2, ciclo: 9, departamento: 'Dpto. de Ing. Sistemas', condicion: 'E', requiereLaboratorio: true },

    // Ciclo X
    { codigo: 'EE-X02', nombre: 'Gobierno de TIC', creditos: 3, horasTeoria: 1, horasPractica: 2, horasLaboratorio: 2, ciclo: 10, departamento: 'Dpto. de Ing. Sistemas', requiereLaboratorio: true, condicion: 'O' },
    { codigo: 'EI-X01', nombre: 'Tesis II', creditos: 4, horasTeoria: 2, horasPractica: 2, horasLaboratorio: 2, ciclo: 10, departamento: 'Dpto. de Ing. Sistemas', requiereLaboratorio: true, condicion: 'O' },
    { codigo: 'EE-X03', nombre: 'Arquitectura Empresarial', creditos: 3, horasTeoria: 1, horasPractica: 2, horasLaboratorio: 2, ciclo: 10, departamento: 'Dpto. de Ing. Sistemas', requiereLaboratorio: true, condicion: 'O' },
    { codigo: 'EP-X01', nombre: 'Responsabilidad Social Corporativa', creditos: 3, horasTeoria: 2, horasPractica: 2, horasLaboratorio: 0, ciclo: 10, departamento: 'Dpto. de Ing. Industrial', condicion: 'O' },
    { codigo: 'EE-X05', nombre: 'PrÃƒÂ¡cticas Pre Profesionales', creditos: 4, horasTeoria: 2, horasPractica: 1, horasLaboratorio: 3, ciclo: 10, departamento: 'Dpto. de Ing. Sistemas', requiereLaboratorio: true, condicion: 'O' },
  ];

  const cursos = await Promise.all(
    cursosData.map((c) => prisma.curso.create({ data: c }))
  );
  console.log(`  Ã¢Å“â€¦ ${cursos.length} cursos creados`);

  // Ã¢â€â‚¬Ã¢â€â‚¬ Estructura Organizacional Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
  const facultadIng = await prisma.facultad.create({ data: { nombre: 'Facultad de IngenierÃƒÂ­a', siglas: 'FI' } });
  const facultadCiencias = await prisma.facultad.create({ data: { nombre: 'Facultad de Ciencias FÃƒÂ­sicas y MatemÃƒÂ¡ticas', siglas: 'FCFM' } });

  const deptoSistemas = await prisma.departamento.create({ data: { nombre: 'Departamento de IngenierÃƒÂ­a de Sistemas', facultadId: facultadIng.id } });
  const deptoIndustrial = await prisma.departamento.create({ data: { nombre: 'Departamento de IngenierÃƒÂ­a Industrial', facultadId: facultadIng.id } });
  const deptoMatematicas = await prisma.departamento.create({ data: { nombre: 'Departamento de MatemÃƒÂ¡ticas', facultadId: facultadCiencias.id } });
  const deptoFisica = await prisma.departamento.create({ data: { nombre: 'Departamento de FÃƒÂ­sica', facultadId: facultadCiencias.id } });

  const departmentByLegacyName = new Map([
    ['Dpto. de Ing. Sistemas', deptoSistemas.id],
    ['Dpto. de Ing. Industrial', deptoIndustrial.id],
    ['Dpto. de MatemÃƒÂ¡ticas', deptoMatematicas.id],
    ['Dpto. de FÃƒÂ­sica', deptoFisica.id],
  ]);
  await Promise.all(
    cursosData.map((curso) => {
      const departamentoId = departmentByLegacyName.get(curso.departamento);
      return departamentoId
        ? foundationPrisma.curso.update({ where: { codigo: curso.codigo }, data: { departamentoId } })
        : Promise.resolve();
    })
  );

  const escuelaSistemas = await prisma.escuela.create({ data: { nombre: 'Escuela de IngenierÃƒÂ­a de Sistemas', facultadId: facultadIng.id } });

  const curricula2018 = await foundationPrisma.curricula.create({
    data: { codigo: '2018', escuelaId: escuelaSistemas.id, vigente: true, estado: 'ACTIVA', estudiantesPendientes: 0, anio: 2018 },
  });

  const cursosCurriculaData = cursos.map((curso) => ({
    cursoId: curso.id, curriculaId: curricula2018.id, ciclo: curso.ciclo, esElectivo: curso.condicion === 'E',
  }));
  await prisma.cursoCurricula.createMany({ data: cursosCurriculaData });

  // Ã¢â€â‚¬Ã¢â€â‚¬ Docentes Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
  const docentesData = [
    // DPTO SISTEMAS
    { nombre: 'Juan Pedro Santos Fernandez', email: 'jsantos@unitru.edu.pe', categoria: CategoriaDocente.PRINCIPAL, tipo: TipoDocente.NOMBRADO, antiguedad: new Date('1985-05-10'), dni: '01234567', codigoIBM: 'IBM001', modalidad: ModalidadDocente.DEDICACION_EXCLUSIVA, horasContrato: 40, departamentoId: deptoSistemas.id, gradoAcademico: 'Doctor', especialidad: 'IngenierÃƒÂ­a de Software', experienciaAnios: 40 },
    { nombre: 'Luis Enrique Boy Chavil', email: 'lboy@unitru.edu.pe', categoria: CategoriaDocente.PRINCIPAL, tipo: TipoDocente.NOMBRADO, antiguedad: new Date('1990-03-15'), dni: '12345678', codigoIBM: 'IBM002', modalidad: ModalidadDocente.DEDICACION_EXCLUSIVA, horasContrato: 40, departamentoId: deptoSistemas.id, gradoAcademico: 'Doctor', especialidad: 'IngenierÃƒÂ­a de Datos', experienciaAnios: 35 },
    { nombre: 'Everson Agreda Gamboa', email: 'eagreda@unitru.edu.pe', categoria: CategoriaDocente.PRINCIPAL, tipo: TipoDocente.NOMBRADO, antiguedad: new Date('1995-08-20'), dni: '23456789', codigoIBM: 'IBM003', modalidad: ModalidadDocente.TIEMPO_COMPLETO, horasContrato: 40, departamentoId: deptoSistemas.id, gradoAcademico: 'Doctor', especialidad: 'Redes y Negocios', experienciaAnios: 30 },
    { nombre: 'Alberto Mendoza de los Santos', email: 'amendoza@unitru.edu.pe', categoria: CategoriaDocente.PRINCIPAL, tipo: TipoDocente.NOMBRADO, antiguedad: new Date('1998-01-10'), dni: '34567890', codigoIBM: 'IBM004', modalidad: ModalidadDocente.TIEMPO_COMPLETO, horasContrato: 40, departamentoId: deptoSistemas.id, gradoAcademico: 'Doctor', especialidad: 'Gobierno de TIC', experienciaAnios: 28 },
    { nombre: 'JosÃƒÂ© Alberto GÃƒÂ³mez ÃƒÂvila', email: 'jgomez@unitru.edu.pe', categoria: CategoriaDocente.PRINCIPAL, tipo: TipoDocente.NOMBRADO, antiguedad: new Date('2000-06-01'), dni: '45678901', codigoIBM: 'IBM005', modalidad: ModalidadDocente.TIEMPO_COMPLETO, horasContrato: 40, departamentoId: deptoSistemas.id, gradoAcademico: 'Doctor', especialidad: 'GestiÃƒÂ³n de Proyectos', experienciaAnios: 25 },
    { nombre: 'Ricardo DarÃƒÂ­o Mendoza Rivera', email: 'rmendoza@unitru.edu.pe', categoria: CategoriaDocente.PRINCIPAL, tipo: TipoDocente.NOMBRADO, antiguedad: new Date('2002-11-15'), dni: '56789012', codigoIBM: 'IBM006', modalidad: ModalidadDocente.TIEMPO_COMPLETO, horasContrato: 40, departamentoId: deptoSistemas.id, gradoAcademico: 'Doctor', especialidad: 'Tesis e Inteligencia', experienciaAnios: 23 },
    { nombre: 'Juan Carlos Obando RoldÃƒÂ¡n', email: 'jobando@unitru.edu.pe', categoria: CategoriaDocente.PRINCIPAL, tipo: TipoDocente.NOMBRADO, antiguedad: new Date('2004-04-10'), dni: '67890123', codigoIBM: 'IBM007', modalidad: ModalidadDocente.TIEMPO_COMPLETO, horasContrato: 40, departamentoId: deptoSistemas.id, gradoAcademico: 'Doctor', especialidad: 'Sistemas de InformaciÃƒÂ³n', experienciaAnios: 21 },
    { nombre: 'Oscar Alcantara Moreno', email: 'oalcantara@unitru.edu.pe', categoria: CategoriaDocente.PRINCIPAL, tipo: TipoDocente.NOMBRADO, antiguedad: new Date('2006-07-20'), dni: '78901234', codigoIBM: 'IBM008', modalidad: ModalidadDocente.TIEMPO_COMPLETO, horasContrato: 40, departamentoId: deptoSistemas.id, gradoAcademico: 'Doctor', especialidad: 'Planeamiento EstratÃƒÂ©gico', experienciaAnios: 19 },
    
    { nombre: 'Robert Jerry Sanchez Ticona', email: 'rsanchez@unitru.edu.pe', categoria: CategoriaDocente.ASOCIADO, tipo: TipoDocente.NOMBRADO, antiguedad: new Date('2010-02-28'), dni: '89012345', codigoIBM: 'IBM009', modalidad: ModalidadDocente.TIEMPO_COMPLETO, horasContrato: 40, departamentoId: deptoSistemas.id, gradoAcademico: 'MagÃƒÂ­ster', especialidad: 'Sistemas e IngenierÃƒÂ­a', experienciaAnios: 15 },
    { nombre: 'Marcelino Torres Villanueva', email: 'mtorres@unitru.edu.pe', categoria: CategoriaDocente.ASOCIADO, tipo: TipoDocente.NOMBRADO, antiguedad: new Date('2012-08-01'), dni: '90123456', codigoIBM: 'IBM010', modalidad: ModalidadDocente.TIEMPO_COMPLETO, horasContrato: 40, departamentoId: deptoSistemas.id, gradoAcademico: 'MagÃƒÂ­ster', especialidad: 'ProgramaciÃƒÂ³n y Datos', experienciaAnios: 13 },
    { nombre: 'Zoraida Vidal Melgarejo', email: 'zvidal@unitru.edu.pe', categoria: CategoriaDocente.ASOCIADO, tipo: TipoDocente.NOMBRADO, antiguedad: new Date('2014-03-15'), dni: '02345678', codigoIBM: 'IBM011', modalidad: ModalidadDocente.TIEMPO_COMPLETO, horasContrato: 40, departamentoId: deptoSistemas.id, gradoAcademico: 'MagÃƒÂ­ster', especialidad: 'ProgramaciÃƒÂ³n Orientada a Objetos', experienciaAnios: 11 },
    { nombre: 'Silvia Ana Rodriguez Aguirre', email: 'srodriguez@unitru.edu.pe', categoria: CategoriaDocente.ASOCIADO, tipo: TipoDocente.NOMBRADO, antiguedad: new Date('2016-03-01'), dni: '13456789', codigoIBM: 'IBM012', modalidad: ModalidadDocente.TIEMPO_COMPLETO, horasContrato: 40, departamentoId: deptoSistemas.id, gradoAcademico: 'MagÃƒÂ­ster', especialidad: 'SistÃƒÂ©mica', experienciaAnios: 9 },
    { nombre: 'Camilo Suarez Rebaza', email: 'csuarez@unitru.edu.pe', categoria: CategoriaDocente.ASOCIADO, tipo: TipoDocente.NOMBRADO, antiguedad: new Date('2018-08-15'), dni: '24567890', codigoIBM: 'IBM013', modalidad: ModalidadDocente.TIEMPO_COMPLETO, horasContrato: 40, departamentoId: deptoSistemas.id, gradoAcademico: 'MagÃƒÂ­ster', especialidad: 'Plataformas y Hackeo', experienciaAnios: 7 },
    
    { nombre: 'Cesar Arellano Salazar', email: 'carellano@unitru.edu.pe', categoria: CategoriaDocente.AUXILIAR, tipo: TipoDocente.NOMBRADO, antiguedad: new Date('2020-03-01'), dni: '35678901', codigoIBM: 'IBM014', modalidad: ModalidadDocente.TIEMPO_COMPLETO, horasContrato: 40, departamentoId: deptoSistemas.id, gradoAcademico: 'Ingeniero', especialidad: 'Sistemas Digitales y SO', experienciaAnios: 5 },

    // OTROS DEPARTAMENTOS
    { nombre: 'Joe Alexis Gonzales Vasquez', email: 'jgonzales@unitru.edu.pe', categoria: CategoriaDocente.AUXILIAR, tipo: TipoDocente.NOMBRADO, antiguedad: new Date('2021-03-15'), dni: '46789012', codigoIBM: 'IBM015', modalidad: ModalidadDocente.TIEMPO_COMPLETO, horasContrato: 40, departamentoId: deptoIndustrial.id, gradoAcademico: 'Ingeniero', especialidad: 'IngenierÃƒÂ­a EconÃƒÂ³mica', experienciaAnios: 4 },
    { nombre: 'Dr. Matematico Externo', email: 'math@unitru.edu.pe', categoria: CategoriaDocente.PRINCIPAL, tipo: TipoDocente.NOMBRADO, antiguedad: new Date('2000-01-01'), dni: '57890123', codigoIBM: 'IBM016', modalidad: ModalidadDocente.TIEMPO_COMPLETO, horasContrato: 40, departamentoId: deptoMatematicas.id, gradoAcademico: 'Doctor', especialidad: 'MatemÃƒÂ¡tica Pura', experienciaAnios: 25 },
    { nombre: 'Mg. Fisico Externo', email: 'physics@unitru.edu.pe', categoria: CategoriaDocente.ASOCIADO, tipo: TipoDocente.NOMBRADO, antiguedad: new Date('2010-01-01'), dni: '68901234', codigoIBM: 'IBM017', modalidad: ModalidadDocente.TIEMPO_COMPLETO, horasContrato: 40, departamentoId: deptoFisica.id, gradoAcademico: 'MagÃƒÂ­ster', especialidad: 'FÃƒÂ­sica', experienciaAnios: 15 },
  ];

  const docentes = await Promise.all(docentesData.map((d) => prisma.docente.create({ data: d })));
  console.log(`  Ã¢Å“â€¦ ${docentes.length} docentes creados`);

  // Ã¢â€â‚¬Ã¢â€â‚¬ Asignaciones de Carga Lectiva (DATA DEFINITION) Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
  const assignmentsData: { docenteIdx: number; assignments: { code: string, group: string }[] }[] = [
    { docenteIdx: 0, assignments: [{ code: 'EE-704', group: 'A' }, { code: 'EE-805', group: 'A' }, { code: 'EI-901', group: 'A' }, { code: 'EI-X01', group: 'A' }] }, // Juan Pedro Santos
    { docenteIdx: 1, assignments: [{ code: 'EE-502', group: 'A' }, { code: 'EE-602', group: 'A' }] }, // Luis Boy
    { docenteIdx: 2, assignments: [{ code: 'EE-804', group: 'A' }, { code: 'EL-702', group: 'A' }, { code: 'EE-X03', group: 'A' }] }, // Everson Agreda
    { docenteIdx: 3, assignments: [{ code: 'EE-701', group: 'A' }, { code: 'EE-801', group: 'A' }, { code: 'EE-902', group: 'A' }, { code: 'EE-X02', group: 'A' }] }, // Alberto Mendoza
    { docenteIdx: 4, assignments: [{ code: 'EP-402', group: 'A' }, { code: 'EE-802', group: 'A' }, { code: 'EE-901', group: 'A' }, { code: 'EE-904', group: 'A' }] }, // JosÃƒÂ© GÃƒÂ³mez
    { docenteIdx: 5, assignments: [{ code: 'EE-803', group: 'A' }, { code: 'EE-903', group: 'A' }] }, // Ricardo Mendoza
    { docenteIdx: 6, assignments: [{ code: 'EL-301', group: 'A' }, { code: 'EE-401', group: 'A' }] }, // Juan Carlos Obando
    { docenteIdx: 7, assignments: [{ code: 'EE-702', group: 'A' }, { code: 'EL-901', group: 'A' }, { code: 'EE-X05', group: 'A' }] }, // Oscar Alcantara
    { docenteIdx: 8, assignments: [{ code: 'EL-401', group: 'A' }, { code: 'EE-501', group: 'A' }, { code: 'EE-504', group: 'A' }, { code: 'EE-604', group: 'A' }] }, // Robert Sanchez
    { docenteIdx: 9, assignments: [{ code: 'EE-102', group: 'A' }, { code: 'EE-403', group: 'A' }, { code: 'EE-601', group: 'A' }] }, // Marcelino Torres (shares Intro Prog A)
    { docenteIdx: 10, assignments: [{ code: 'EE-201', group: 'A' }, { code: 'EE-302', group: 'A' }] }, // Zoraida Vidal
    { docenteIdx: 11, assignments: [{ code: 'EE-301', group: 'A' }] }, // Silvia Rodriguez
    { docenteIdx: 12, assignments: [{ code: 'EL-402', group: 'A' }, { code: 'EL-902', group: 'A' }] }, // Camilo Suarez
    { docenteIdx: 13, assignments: [{ code: 'EE-402', group: 'A' }, { code: 'EE-503', group: 'A' }, { code: 'EE-603', group: 'A' }, { code: 'EE-703', group: 'A' }] }, // Cesar Arellano
    { docenteIdx: 14, assignments: [{ code: 'EP-602', group: 'A' }, { code: 'EP-701', group: 'A' }, { code: 'EP-X01', group: 'A' }] }, // Joe Gonzales
    { docenteIdx: 15, assignments: [{ code: 'EG-101', group: 'A' }, { code: 'EG-104', group: 'A' }, { code: 'EG-204', group: 'A' }, { code: 'EP-303', group: 'A' }] }, // Math Teacher
    { docenteIdx: 16, assignments: [{ code: 'EG-205', group: 'A' }, { code: 'EP-304', group: 'A' }] }, // Physics Teacher
  ];

  // Ã¢â€â‚¬Ã¢â€â‚¬ Grupos Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
  const gruposCreated: any[] = [];
  const sharedCourseCodes: string[] = [];
  
  // FunciÃƒÂ³n para crear grupos y asignaciones por periodo
  const seedPeriodo = async (periodo: any) => {
    const esImpar = periodo.nombre.endsWith('-I');
    
    for (const curso of cursos) {
      // Solo aperturar si coincide la paridad (Impar = ciclos 1,3,5,7,9; Par = ciclos 2,4,6,8,10)
      const cicloEsImpar = curso.ciclo % 2 !== 0;
      if (esImpar !== cicloEsImpar) continue;

      const numGrupos = sharedCourseCodes.includes(curso.codigo) ? 2 : 1;
      for (let i = 0; i < numGrupos; i++) {
        const seccion = String.fromCharCode(65 + i);
        const grupo = await prisma.grupo.create({
          data: { nombre: seccion, seccion: seccion, cursoId: curso.id, periodoAcademicoId: periodo.id, numAlumnos: 30 },
        });
        gruposCreated.push({ ...grupo, curso });

        // Buscar docentes para este curso (simplificado para el seed)
        const assignment = assignmentsData.find(a => a.assignments.some(as => as.code === curso.codigo && as.group === seccion));
        if (assignment) {
          const docente = docentes[assignment.docenteIdx];
          // Asignar TeorÃƒÂ­a
          await prisma.asignacionCargaLectiva.create({
            data: { docenteId: docente.id, grupoId: grupo.id, periodoId: periodo.id, tipo: 'TEORIA', horasAsignadas: curso.horasTeoria, compartido: sharedCourseCodes.includes(curso.codigo) }
          });
          // Asignar Laboratorio si tiene
          if (curso.horasLaboratorio > 0) {
            await prisma.asignacionCargaLectiva.create({
              data: { docenteId: docente.id, grupoId: grupo.id, periodoId: periodo.id, tipo: 'LABORATORIO', horasAsignadas: curso.horasLaboratorio, compartido: sharedCourseCodes.includes(curso.codigo) }
            });
          }
          // Vincular en docenteGrupo
          await prisma.docenteGrupo.create({ data: { docenteId: docente.id, grupoId: grupo.id } });
        }
      }
    }
  };

  console.log('  Ã¢ÂÂ³ Creando grupos y asignaciones para 2026-I...');
  await seedPeriodo(periodo2026I);
  console.log('  Ã¢ÂÂ³ Creando grupos y asignaciones para 2026-II...');
  await seedPeriodo(periodo2026II);
  
  console.log(`  Ã¢Å“â€¦ ${gruposCreated.length} grupos creados en total`);

  // Ã¢â€â‚¬Ã¢â€â‚¬ Usuarios Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
  const hashedPassword = await bcrypt.hash('admin123', 10);
  const docentePassword = await bcrypt.hash('docente123', 10);

  await prisma.user.create({ data: { email: 'admin@unt.edu.pe', password: hashedPassword, nombre: 'Administrador', role: UserRole.ADMIN } });
  const directorEscuela = await prisma.user.create({ data: { email: 'director@unt.edu.pe', password: hashedPassword, nombre: 'Director Escuela', role: UserRole.DIRECTOR_ESCUELA, docenteId: docentes[1].id } });
  const secretariaEscuela = await prisma.user.create({ data: { email: 'secretaria@unt.edu.pe', password: hashedPassword, nombre: 'Secretaria AcadÃƒÂ©mica', role: UserRole.SECRETARIA_ACADEMICA } });

  // Jefe de Departamento de Sistemas
  const jefeDeptSistemas = await prisma.user.create({
    data: { 
      email: 'dirsistemas@unt.edu.pe', 
      password: hashedPassword, 
      nombre: 'Jefe de Departamento de Sistemas', 
      role: UserRole.DIRECTOR_DEPARTAMENTO,
      docenteId: docentes[0].id,
    } 
  });

  // Secretaria de Departamento de Sistemas
  const secretariaDpto = await prisma.user.create({
    data: {
      email: 'secretariadpto@unt.edu.pe',
      password: hashedPassword,
      nombre: 'Secretaria Dpto. de Sistemas',
      role: UserRole.SECRETARIA_DEPARTAMENTO,
    },
  });

  // Decano
  const decano = await prisma.user.create({
    data: { 
      email: 'decano@unt.edu.pe', 
      password: hashedPassword, 
      nombre: 'Decano de Facultad', 
      role: UserRole.DECANO,
      docenteId: docentes[2].id,
    } 
  });

  // Vincular Jefe y Secretaria al Departamento de Sistemas
  await prisma.departamento.update({
    where: { id: deptoSistemas.id },
    data: { directorId: jefeDeptSistemas.id, secretariaId: secretariaDpto.id }
  });
  await foundationPrisma.escuela.update({
    where: { id: escuelaSistemas.id },
    data: { directorId: directorEscuela.id, secretariaId: secretariaEscuela.id },
  });
  await foundationPrisma.facultad.update({
    where: { id: facultadIng.id },
    data: { decanoId: decano.id },
  });

  await foundationPrisma.cargoDocente.createMany({
    data: [
      { docenteId: docentes[0].id, periodoId: periodo2026I.id, cargo: 'JEFE_DEPARTAMENTO', departamentoId: deptoSistemas.id, resolucion: 'SEED-JEFE-2026-I' },
      { docenteId: docentes[1].id, periodoId: periodo2026I.id, cargo: 'DIRECTOR_ESCUELA', escuelaId: escuelaSistemas.id, resolucion: 'SEED-DIRECTOR-2026-I' },
      { docenteId: docentes[2].id, periodoId: periodo2026I.id, cargo: 'DECANO', facultadId: facultadIng.id, resolucion: 'SEED-DECANO-2026-I' },
    ],
  });

  const roleRules = [
    ['JEFE_DEPARTAMENTO', 8, 4, 1, 5, 15, 1],
    ['DIRECTOR_ESCUELA', 8, 4, 1, 5, 15, 1],
    ['DECANO', 4, 2, 1, 5, 20, 1],
  ] as const;
  await foundationPrisma.reglaCargaPorCargo.createMany({
    data: roleRules.flatMap(([cargo, lectiva, preparacion, consejeria, investigacion, administracion, proyeccion]) => [
      { cargo, codigoActividad: 'LECTIVA_MINIMA', horasLectivasMinimas: lectiva, requiereEvidencia: false },
      { cargo, codigoActividad: 'PREPARACION', tipoCargaNoLectiva: 'PREPARACION_EVALUACION', horasNoLectivas: preparacion, requiereEvidencia: false },
      { cargo, codigoActividad: 'CONSEJERIA', tipoCargaNoLectiva: 'CONSEJERIA', horasNoLectivas: consejeria, requiereEvidencia: false },
      { cargo, codigoActividad: 'INVESTIGACION', tipoCargaNoLectiva: 'INVESTIGACION', horasNoLectivas: investigacion, requiereEvidencia: true },
      { cargo, codigoActividad: 'ADMINISTRACION', tipoCargaNoLectiva: 'ADMINISTRACION', horasNoLectivas: administracion, requiereEvidencia: true },
      { cargo, codigoActividad: 'PROYECCION_SOCIAL', tipoCargaNoLectiva: 'RESPONSABILIDAD_SOCIAL', horasNoLectivas: proyeccion, requiereEvidencia: true },
    ]),
  });

  // Ã¢â€â‚¬Ã¢â€â‚¬ Horario Personal y Declaraciones (Pruebas 2026-I) Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
  console.log('  Ã¢ÂÂ³ Generando horarios y declaraciones de prueba...');

  const franjas = await prisma.franjaHoraria.findMany();
  const getFranja = (dia: DiaSemana, bloque: number) => franjas.find(f => f.dia === dia && f.numeroBloque === bloque);

  // 1. Juan Santos (COMPLETO)
  const juanSantos = docentes[0];
  const robertTicona = docentes[8];
  const cesarArellano = docentes[13];

  const softwareI = gruposCreated.find(g => g.curso.codigo === 'EE-704' && g.periodoAcademicoId === periodo2026I.id && g.nombre === 'A');
  const redesI = gruposCreated.find(g => g.curso.codigo === 'EE-703' && g.periodoAcademicoId === periodo2026I.id && g.nombre === 'A');

  // Asignaciones Software I (EE-704)
  if (softwareI) {
    // Santos: Lab Lunes 7-10
    await prisma.asignacion.createMany({
      data: [
        { grupoId: softwareI.id, docenteId: juanSantos.id, aulaId: (await prisma.aula.findUnique({ where: { codigo: 'LAB-1' } }))!.id, franjaHorariaId: getFranja('LUNES', 1)!.id, periodoId: periodo2026I.id, tipo: 'LABORATORIO' },
        { grupoId: softwareI.id, docenteId: juanSantos.id, aulaId: (await prisma.aula.findUnique({ where: { codigo: 'LAB-1' } }))!.id, franjaHorariaId: getFranja('LUNES', 2)!.id, periodoId: periodo2026I.id, tipo: 'LABORATORIO' },
        { grupoId: softwareI.id, docenteId: juanSantos.id, aulaId: (await prisma.aula.findUnique({ where: { codigo: 'LAB-1' } }))!.id, franjaHorariaId: getFranja('LUNES', 3)!.id, periodoId: periodo2026I.id, tipo: 'LABORATORIO' },
      ]
    });
    // Santos: Teoria Lunes 10-13 (2h Teoria + 1h Practica = 3h)
    await prisma.asignacion.createMany({
      data: [
        { grupoId: softwareI.id, docenteId: juanSantos.id, aulaId: (await prisma.aula.findUnique({ where: { codigo: 'EPG-303' } }))!.id, franjaHorariaId: getFranja('LUNES', 4)!.id, periodoId: periodo2026I.id, tipo: 'TEORIA' },
        { grupoId: softwareI.id, docenteId: juanSantos.id, aulaId: (await prisma.aula.findUnique({ where: { codigo: 'EPG-303' } }))!.id, franjaHorariaId: getFranja('LUNES', 5)!.id, periodoId: periodo2026I.id, tipo: 'TEORIA' },
        { grupoId: softwareI.id, docenteId: juanSantos.id, aulaId: (await prisma.aula.findUnique({ where: { codigo: 'EPG-303' } }))!.id, franjaHorariaId: getFranja('LUNES', 6)!.id, periodoId: periodo2026I.id, tipo: 'PRACTICA' },
      ]
    });

    // Ticona: 2 Grupos Lab (3h cada uno) Martes
    // Grupo Lab 2 (Ticona) Martes 7-10
    await prisma.asignacion.createMany({
      data: [
        { grupoId: softwareI.id, docenteId: robertTicona.id, aulaId: (await prisma.aula.findUnique({ where: { codigo: 'LAB-2' } }))!.id, franjaHorariaId: getFranja('MARTES', 1)!.id, periodoId: periodo2026I.id, tipo: 'LABORATORIO' },
        { grupoId: softwareI.id, docenteId: robertTicona.id, aulaId: (await prisma.aula.findUnique({ where: { codigo: 'LAB-2' } }))!.id, franjaHorariaId: getFranja('MARTES', 2)!.id, periodoId: periodo2026I.id, tipo: 'LABORATORIO' },
        { grupoId: softwareI.id, docenteId: robertTicona.id, aulaId: (await prisma.aula.findUnique({ where: { codigo: 'LAB-2' } }))!.id, franjaHorariaId: getFranja('MARTES', 3)!.id, periodoId: periodo2026I.id, tipo: 'LABORATORIO' },
      ]
    });
    // Grupo Lab 3 (Ticona) Martes 10-13
    await prisma.asignacion.createMany({
      data: [
        { grupoId: softwareI.id, docenteId: robertTicona.id, aulaId: (await prisma.aula.findUnique({ where: { codigo: 'LAB-2' } }))!.id, franjaHorariaId: getFranja('MARTES', 4)!.id, periodoId: periodo2026I.id, tipo: 'LABORATORIO' },
        { grupoId: softwareI.id, docenteId: robertTicona.id, aulaId: (await prisma.aula.findUnique({ where: { codigo: 'LAB-2' } }))!.id, franjaHorariaId: getFranja('MARTES', 5)!.id, periodoId: periodo2026I.id, tipo: 'LABORATORIO' },
        { grupoId: softwareI.id, docenteId: robertTicona.id, aulaId: (await prisma.aula.findUnique({ where: { codigo: 'LAB-2' } }))!.id, franjaHorariaId: getFranja('MARTES', 6)!.id, periodoId: periodo2026I.id, tipo: 'LABORATORIO' },
      ]
    });

    // Actualizar Carga Lectiva para Ticona y Santos
    await prisma.asignacionCargaLectiva.deleteMany({
      where: { grupoId: softwareI.id, periodoId: periodo2026I.id, tipo: 'LABORATORIO' }
    });
    await prisma.asignacionCargaLectiva.create({
      data: { docenteId: juanSantos.id, grupoId: softwareI.id, periodoId: periodo2026I.id, tipo: 'LABORATORIO', horasAsignadas: 3, compartido: true, docenteCompartidoId: robertTicona.id, grupoLaboratorio: 1 }
    });
    await prisma.asignacionCargaLectiva.create({
      data: { docenteId: robertTicona.id, grupoId: softwareI.id, periodoId: periodo2026I.id, tipo: 'LABORATORIO', horasAsignadas: 6, compartido: true, docenteCompartidoId: juanSantos.id, grupoLaboratorio: 2 }
    });
  }

  // Asignaciones Redes I (EE-703) - Cesar Arellano
  if (redesI) {
    // Lab 1: Lunes 10-13 (Cruce visual con Software I Teoria)
    await prisma.asignacion.createMany({
      data: [
        { grupoId: redesI.id, docenteId: cesarArellano.id, aulaId: (await prisma.aula.findUnique({ where: { codigo: 'LAB-3' } }))!.id, franjaHorariaId: getFranja('LUNES', 4)!.id, periodoId: periodo2026I.id, tipo: 'LABORATORIO' },
        { grupoId: redesI.id, docenteId: cesarArellano.id, aulaId: (await prisma.aula.findUnique({ where: { codigo: 'LAB-3' } }))!.id, franjaHorariaId: getFranja('LUNES', 5)!.id, periodoId: periodo2026I.id, tipo: 'LABORATORIO' },
        { grupoId: redesI.id, docenteId: cesarArellano.id, aulaId: (await prisma.aula.findUnique({ where: { codigo: 'LAB-3' } }))!.id, franjaHorariaId: getFranja('LUNES', 6)!.id, periodoId: periodo2026I.id, tipo: 'LABORATORIO' },
      ]
    });
    // Lab 2: Lunes 13-16
    await prisma.asignacion.createMany({
      data: [
        { grupoId: redesI.id, docenteId: cesarArellano.id, aulaId: (await prisma.aula.findUnique({ where: { codigo: 'LAB-3' } }))!.id, franjaHorariaId: getFranja('LUNES', 7)!.id, periodoId: periodo2026I.id, tipo: 'LABORATORIO' },
        { grupoId: redesI.id, docenteId: cesarArellano.id, aulaId: (await prisma.aula.findUnique({ where: { codigo: 'LAB-3' } }))!.id, franjaHorariaId: getFranja('LUNES', 8)!.id, periodoId: periodo2026I.id, tipo: 'LABORATORIO' },
        { grupoId: redesI.id, docenteId: cesarArellano.id, aulaId: (await prisma.aula.findUnique({ where: { codigo: 'LAB-3' } }))!.id, franjaHorariaId: getFranja('LUNES', 9)!.id, periodoId: periodo2026I.id, tipo: 'LABORATORIO' },
      ]
    });
    // Lab 3: Lunes 16-19
    await prisma.asignacion.createMany({
      data: [
        { grupoId: redesI.id, docenteId: cesarArellano.id, aulaId: (await prisma.aula.findUnique({ where: { codigo: 'LAB-3' } }))!.id, franjaHorariaId: getFranja('LUNES', 10)!.id, periodoId: periodo2026I.id, tipo: 'LABORATORIO' },
        { grupoId: redesI.id, docenteId: cesarArellano.id, aulaId: (await prisma.aula.findUnique({ where: { codigo: 'LAB-3' } }))!.id, franjaHorariaId: getFranja('LUNES', 11)!.id, periodoId: periodo2026I.id, tipo: 'LABORATORIO' },
        { grupoId: redesI.id, docenteId: cesarArellano.id, aulaId: (await prisma.aula.findUnique({ where: { codigo: 'LAB-3' } }))!.id, franjaHorariaId: getFranja('LUNES', 12)!.id, periodoId: periodo2026I.id, tipo: 'LABORATORIO' },
      ]
    });
    // Teoria: Viernes 16-18 (2h)
    await prisma.asignacion.createMany({
      data: [
        { grupoId: redesI.id, docenteId: cesarArellano.id, aulaId: (await prisma.aula.findUnique({ where: { codigo: 'EPG-307' } }))!.id, franjaHorariaId: getFranja('VIERNES', 10)!.id, periodoId: periodo2026I.id, tipo: 'TEORIA' },
        { grupoId: redesI.id, docenteId: cesarArellano.id, aulaId: (await prisma.aula.findUnique({ where: { codigo: 'EPG-307' } }))!.id, franjaHorariaId: getFranja('VIERNES', 11)!.id, periodoId: periodo2026I.id, tipo: 'TEORIA' },
      ]
    });
  }

  // Otros cursos de Juan Santos para completar su carga lectiva (12h lectivas totales solicitadas)
  // Ya tiene 3h Lab + 3h Teoria/Prac = 6h de Software I.
  // Agregaremos Tesis I (EI-901) - 6h (2T, 2P, 2L)
  const tesisI = gruposCreated.find(g => g.curso.codigo === 'EI-901' && g.periodoAcademicoId === periodo2026I.id && g.nombre === 'A');
  // Ã¢â€â‚¬Ã¢â€â‚¬ PASO 1: Demanda AcadÃƒÂ©mica de Escuela (flujo de horarios integral) Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
  console.log('  Ã¢ÂÂ³ Creando demanda acadÃƒÂ©mica de escuela...');

  // Los cursos de ciclo impar (1,3,5,7,9) son los que se dictan en 2026-I.
  // Armamos una demanda de la Escuela de Sistemas para 2026-I con los cursos clave.
  const cursosPorCodigo = new Map(cursos.map((c) => [c.codigo, c]));

  // Cursos ciclo I que la escuela pide para 2026-I (obligatorios del plan 2018)
  const cursosEnDemanda = [
    cursosPorCodigo.get('EE-101')!, // IntroducciÃƒÂ³n a la IngenierÃƒÂ­a de Sistemas
    cursosPorCodigo.get('EE-102')!, // IntroducciÃƒÂ³n a la ProgramaciÃƒÂ³n (con lab)
    cursosPorCodigo.get('EE-301')!, // SistÃƒÂ©mica (ciclo 3, con lab)
    cursosPorCodigo.get('EE-302')!, // POO II (ciclo 3, lab)
    cursosPorCodigo.get('EE-501')!, // TecnologÃƒÂ­as Web (ciclo 5)
    cursosPorCodigo.get('EE-502')!, // IngenierÃƒÂ­a de Datos I (ciclo 5)
    cursosPorCodigo.get('EE-701')!, // GestiÃƒÂ³n de Servicios TIC (ciclo 7)
    cursosPorCodigo.get('EE-704')!, // IngenierÃƒÂ­a del Software I (ciclo 7)
    cursosPorCodigo.get('EI-901')!, // Tesis I (ciclo 9)
    cursosPorCodigo.get('EE-904')!, // ComputaciÃƒÂ³n en la Nube (ciclo 9)
  ].filter(Boolean);

  const demandaEscuela = await foundationPrisma.demandaAcademica.create({
    data: {
      escuelaId: escuelaSistemas.id,
      periodoId: periodo2026I.id,
      estado: 'ENVIADA', // Ya fue enviada por la secretarÃƒÂ­a al director
      version: 1,
      enviadaPorId: secretariaEscuela.id,
      enviadaEn: new Date('2026-02-10T10:00:00Z'),
    },
  });

  // Crear lÃƒÂ­neas de demanda para cada curso con su vÃƒÂ­nculo a curricula 2018
  for (const curso of cursosEnDemanda) {
    const linea = await foundationPrisma.demandaLinea.create({
      data: {
        demandaId: demandaEscuela.id,
        cursoId: curso.id,
        departamentoId: curso.departamentoId ?? deptoSistemas.id,
        horasTeoria: curso.horasTeoria,
        horasPractica: curso.horasPractica,
        horasLaboratorio: curso.horasLaboratorio,
        numGruposLaboratorio: curso.horasLaboratorio > 0 ? 2 : 0,
        motivoAperturaExcepcional: null,
      },
    });

    // Vinculo a curricula 2018 con el ciclo real del curso
    await foundationPrisma.demandaLineaCurricula.create({
      data: {
        demandaLineaId: linea.id,
        curriculaId: curricula2018.id,
        ciclo: curso.ciclo,
      },
    });
  }

  console.log(`  Ã¢Å“â€¦ Demanda acadÃƒÂ©mica de escuela creada (estado: ENVIADA, ${cursosEnDemanda.length} cursos)`);

  // Ã¢â€â‚¬Ã¢â€â‚¬ PASO 2: Demanda de Departamento (aprobadas Ã¢â€ â€™ visibles para Dpto. Sistemas) Ã¢â€â‚¬Ã¢â€â‚¬
  // Cuando el director aprueba la demanda escolar, se notifica al dpto.
  // Simulamos que la demanda ya fue aprobada para que la pÃƒÂ¡gina del dpto. muestre datos.
  await foundationPrisma.demandaAcademica.update({
    where: { id: demandaEscuela.id },
    data: {
      estado: 'APROBADA',
      observacion: null,
    },
  });
  console.log('  Ã¢Å“â€¦ Demanda aprobada por el director Ã¢â€ â€™ visible en panel de departamento');

  // Ã¢â€â‚¬Ã¢â€â‚¬ PASO 6: Declaraciones FINALIZADAS para mostrar en PublicaciÃƒÂ³n Final Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
  // Ya existen declaraciones de Juan Santos (FINALIZADA), Luis Boy (ENVIADA) y Everson (RECHAZADA).
  // Agregamos declaraciones FINALIZADAS de mÃƒÂ¡s docentes para que el panel sea realista.
  console.log('  Ã¢ Â³ Creando declaraciones finalizadas adicionales...');

  const docentesConDeclaracion = [
    { docente: docentes[3], horas: 16 }, // Alberto Mendoza
    { docente: docentes[4], horas: 14 }, // JosÃƒÂ© GÃƒÂ³mez
    { docente: docentes[5], horas: 10 }, // Ricardo Mendoza
  ];

  for (const { docente, horas } of docentesConDeclaracion) {
    await prisma.declaracionCarga.create({
      data: {
        docenteId: docente.id,
        periodoId: periodo2026I.id,
        estado: EstadoDeclaracion.FINALIZADA,
        totalHorasLectivas: horas,
        totalHorasNoLectivas: 4,
        totalHoras: horas + 4,
        aprobadoDepartamentoId: jefeDeptSistemas.id,
        aprobadoEscuelaId: directorEscuela.id,
        vistoBuenoDecanoId: decano.id,
        fechaAprobacionDepto: new Date('2026-03-01T09:00:00Z'),
        fechaAprobacionEscuela: new Date('2026-03-05T10:00:00Z'),
        fechaVistoBueno: new Date('2026-03-08T11:00:00Z'),
      },
    });
  }
  console.log(`  ✅ ${docentesConDeclaracion.length} declaraciones finalizadas adicionales creadas`);

  console.log('\nÃ°Å¸Å½â€° Seed completo!');
  console.log(`   Docentes: ${docentes.length}`);
  console.log(`   Cursos: ${cursos.length}`);
  console.log(`   Grupos: ${gruposCreated.length}`);
  console.log(`   Demanda escolar: 1 (APROBADA, ${cursosEnDemanda.length} lÃƒÂ­neas)`);
  console.log(`   Declaraciones totales: ${3 + docentesConDeclaracion.length}`);
}

main()
  .then(async () => { await prisma.$disconnect(); })
  .catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
