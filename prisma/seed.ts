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

  // ── Periodos Académicos ──────────────────────────
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

  // ── Franjas Horarias ──────────────────────────────
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
    // Posgrado 3er Piso
    { codigo: 'EPG-303', nombre: 'Aula Posgrado 303', capacidad: 40, tipo: TipoAula.TEORIA, edificio: 'Escuela de Posgrado', piso: 3 },
    { codigo: 'EPG-307', nombre: 'Aula Posgrado 307', capacidad: 45, tipo: TipoAula.TEORIA, edificio: 'Escuela de Posgrado', piso: 3 },
    { codigo: 'EPG-311', nombre: 'Aula Posgrado 311', capacidad: 50, tipo: TipoAula.TEORIA, edificio: 'Escuela de Posgrado', piso: 3 },
    { codigo: 'EPG-315', nombre: 'Aula Posgrado 315', capacidad: 42, tipo: TipoAula.TEORIA, edificio: 'Escuela de Posgrado', piso: 3 },
    { codigo: 'EPG-319', nombre: 'Aula Posgrado 319', capacidad: 48, tipo: TipoAula.TEORIA, edificio: 'Escuela de Posgrado', piso: 3 },
    { codigo: 'EPG-323', nombre: 'Aula Posgrado 323', capacidad: 45, tipo: TipoAula.TEORIA, edificio: 'Escuela de Posgrado', piso: 3 },
    
    // Laboratorios
    { codigo: 'LAB-1', nombre: 'Laboratorio 1', capacidad: 16, tipo: TipoAula.LABORATORIO, edificio: 'Pabellón C', piso: 1 },
    { codigo: 'LAB-2', nombre: 'Laboratorio 2', capacidad: 16, tipo: TipoAula.LABORATORIO, edificio: 'Pabellón C', piso: 1 },
    { codigo: 'LAB-3', nombre: 'Laboratorio 3', capacidad: 16, tipo: TipoAula.LABORATORIO, edificio: 'Pabellón C', piso: 2 },
    { codigo: 'LAB-4', nombre: 'Laboratorio 4', capacidad: 20, tipo: TipoAula.LABORATORIO, edificio: 'Pabellón C', piso: 2 },
    { codigo: 'LAB-5', nombre: 'Laboratorio 5 (Auditorio)', capacidad: 20, tipo: TipoAula.LABORATORIO, edificio: 'Pabellón C', piso: 2 },
  ];

  await prisma.aula.createMany({ data: aulasData });
  console.log(`  ✅ ${aulasData.length} aulas creadas`);

  // ── Cursos (Plan 2018) ──────────────────────────
  const cursosData = [
    // Ciclo I
    { codigo: 'EG-101', nombre: 'Desarrollo del Pensamiento Lógico Matemático', creditos: 3, horasTeoria: 2, horasPractica: 2, horasLaboratorio: 0, ciclo: 1, departamento: 'Dpto. de Matemáticas', condicion: 'O' },
    { codigo: 'EG-102', nombre: 'Lectura Crítica y Redacción de Textos Académicos', creditos: 3, horasTeoria: 2, horasPractica: 2, horasLaboratorio: 0, ciclo: 1, departamento: 'Dpto. de Lengua y Literatura', condicion: 'O' },
    { codigo: 'EG-103', nombre: 'Desarrollo Personal', creditos: 3, horasTeoria: 2, horasPractica: 2, horasLaboratorio: 0, ciclo: 1, departamento: 'Dpto. de Ciencias Sicológicas', condicion: 'O' },
    { codigo: 'EG-104', nombre: 'Introducción al Análisis Matemático', creditos: 4, horasTeoria: 2, horasPractica: 4, horasLaboratorio: 0, ciclo: 1, departamento: 'Dpto. de Matemáticas', condicion: 'O' },
    { codigo: 'EG-105', nombre: 'Estadística General', creditos: 4, horasTeoria: 2, horasPractica: 4, horasLaboratorio: 0, ciclo: 1, departamento: 'Dpto. de Estadística', condicion: 'O' },
    { codigo: 'EE-101', nombre: 'Introducción a la Ingeniería de Sistemas', creditos: 2, horasTeoria: 1, horasPractica: 2, horasLaboratorio: 0, ciclo: 1, departamento: 'Dpto. de Ing. Sistemas', condicion: 'O' },
    { codigo: 'EE-102', nombre: 'Introducción a la Programación', creditos: 3, horasTeoria: 2, horasPractica: 0, horasLaboratorio: 2, ciclo: 1, departamento: 'Dpto. de Ing. Sistemas', requiereLaboratorio: true, condicion: 'O' },
    { codigo: 'EL-101', nombre: 'Técnicas de comunicación eficaz (e)', creditos: 1, horasTeoria: 0, horasPractica: 2, horasLaboratorio: 0, ciclo: 1, departamento: 'Dpto. de Comunicación Social', condicion: 'E' },
    { codigo: 'EL-102', nombre: 'Taller de Música (e)', creditos: 1, horasTeoria: 0, horasPractica: 2, horasLaboratorio: 0, ciclo: 1, departamento: 'Dpto. de Ciencias Sociales', condicion: 'E' },
    { codigo: 'EL-103', nombre: 'Taller de Liderazgo y trabajo en equipo (e)', creditos: 1, horasTeoria: 0, horasPractica: 2, horasLaboratorio: 0, ciclo: 1, departamento: 'Dpto. de Ciencias Sicológicas', condicion: 'E' },
    
    // Ciclo II
    { codigo: 'EG-201', nombre: 'Ética, Convivencia Humana y Ciudadanía', creditos: 3, horasTeoria: 2, horasPractica: 2, horasLaboratorio: 0, ciclo: 2, departamento: 'Dpto. de Filosofía y Arte', condicion: 'O' },
    { codigo: 'EG-202', nombre: 'Sociedad, Cultura y Ecología', creditos: 3, horasTeoria: 2, horasPractica: 2, horasLaboratorio: 0, ciclo: 2, departamento: 'Dpto. de Ciencias Sociales', condicion: 'O' },
    { codigo: 'EG-203', nombre: 'Cultura Investigativa y Pensamiento Crítico', creditos: 3, horasTeoria: 2, horasPractica: 2, horasLaboratorio: 0, ciclo: 2, departamento: 'Dpto. de Ciencias Sociales', condicion: 'O' },
    { codigo: 'EG-204', nombre: 'Análisis Matemático', creditos: 4, horasTeoria: 2, horasPractica: 4, horasLaboratorio: 0, ciclo: 2, departamento: 'Dpto. de Matemáticas', condicion: 'O' },
    { codigo: 'EG-205', nombre: 'Física General', creditos: 4, horasTeoria: 2, horasPractica: 2, horasLaboratorio: 2, ciclo: 2, departamento: 'Dpto. de Física', requiereLaboratorio: true, condicion: 'O' },
    { codigo: 'EE-201', nombre: 'Programación Orientada a Objetos I', creditos: 4, horasTeoria: 2, horasPractica: 0, horasLaboratorio: 4, ciclo: 2, departamento: 'Dpto. de Ing. Sistemas', requiereLaboratorio: true, condicion: 'O' },
    
    // Ciclo III
    { codigo: 'EE-301', nombre: 'Sistémica', creditos: 3, horasTeoria: 1, horasPractica: 2, horasLaboratorio: 2, ciclo: 3, departamento: 'Dpto. de Ing. Sistemas', requiereLaboratorio: true, condicion: 'O' },
    { codigo: 'EP-303', nombre: 'Matemática Aplicada', creditos: 3, horasTeoria: 1, horasPractica: 2, horasLaboratorio: 2, ciclo: 3, departamento: 'Dpto. de Matemáticas', requiereLaboratorio: true, condicion: 'O' },
    { codigo: 'EP-304', nombre: 'Física Electrónica', creditos: 3, horasTeoria: 1, horasPractica: 2, horasLaboratorio: 2, ciclo: 3, departamento: 'Dpto. de Física', requiereLaboratorio: true, condicion: 'O' },
    { codigo: 'EE-302', nombre: 'Programación Orientada a Objetos II', creditos: 4, horasTeoria: 2, horasPractica: 0, horasLaboratorio: 4, ciclo: 3, departamento: 'Dpto. de Ing. Sistemas', requiereLaboratorio: true, condicion: 'O' },
    { codigo: 'EL-301', nombre: 'Ingeniería Gráfica (e)', creditos: 3, horasTeoria: 1, horasPractica: 1, horasLaboratorio: 3, ciclo: 3, departamento: 'Dpto. de Ing. Sistemas', condicion: 'E', requiereLaboratorio: true },

    // Ciclo IV
    { codigo: 'EE-401', nombre: 'Diseño Web', creditos: 3, horasTeoria: 1, horasPractica: 1, horasLaboratorio: 3, ciclo: 4, departamento: 'Dpto. de Ing. Sistemas', requiereLaboratorio: true, condicion: 'O' },
    { codigo: 'EP-402', nombre: 'Pensamiento de Diseño', creditos: 3, horasTeoria: 1, horasPractica: 2, horasLaboratorio: 2, ciclo: 4, departamento: 'Dpto. de Ing. Sistemas', requiereLaboratorio: true, condicion: 'O' },
    { codigo: 'EE-402', nombre: 'Sistemas Digitales', creditos: 3, horasTeoria: 1, horasPractica: 2, horasLaboratorio: 2, ciclo: 4, departamento: 'Dpto. de Ing. Sistemas', requiereLaboratorio: true, condicion: 'O' },
    { codigo: 'EE-403', nombre: 'Estructura de Datos Orientado a Objetos', creditos: 4, horasTeoria: 2, horasPractica: 1, horasLaboratorio: 3, ciclo: 4, departamento: 'Dpto. de Ing. Sistemas', requiereLaboratorio: true, condicion: 'O' },
    { codigo: 'EL-401', nombre: 'Computación Gráfica y Visual (e)', creditos: 3, horasTeoria: 1, horasPractica: 1, horasLaboratorio: 3, ciclo: 4, departamento: 'Dpto. de Ing. Sistemas', condicion: 'E', requiereLaboratorio: true },
    { codigo: 'EL-402', nombre: 'Plataformas Tecnológicas (e)', creditos: 3, horasTeoria: 2, horasPractica: 0, horasLaboratorio: 2, ciclo: 4, departamento: 'Dpto. de Ing. Sistemas', condicion: 'E', requiereLaboratorio: true },

    // Ciclo V
    { codigo: 'EE-501', nombre: 'Tecnologías Web', creditos: 3, horasTeoria: 1, horasPractica: 1, horasLaboratorio: 3, ciclo: 5, departamento: 'Dpto. de Ing. Sistemas', requiereLaboratorio: true, condicion: 'O' },
    { codigo: 'EE-502', nombre: 'Ingeniería de Datos I', creditos: 4, horasTeoria: 2, horasPractica: 1, horasLaboratorio: 3, ciclo: 5, departamento: 'Dpto. de Ing. Sistemas', requiereLaboratorio: true, condicion: 'O' },
    { codigo: 'EE-503', nombre: 'Arquitectura y Organización de Computadoras', creditos: 3, horasTeoria: 1, horasPractica: 2, horasLaboratorio: 2, ciclo: 5, departamento: 'Dpto. de Ing. Sistemas', requiereLaboratorio: true, condicion: 'O' },
    { codigo: 'EE-504', nombre: 'Sistemas de Información', creditos: 4, horasTeoria: 2, horasPractica: 2, horasLaboratorio: 2, ciclo: 5, departamento: 'Dpto. de Ing. Sistemas', requiereLaboratorio: true, condicion: 'O' },

    // Ciclo VI
    { codigo: 'EE-601', nombre: 'Sistemas Inteligentes', creditos: 3, horasTeoria: 1, horasPractica: 2, horasLaboratorio: 2, ciclo: 6, departamento: 'Dpto. de Ing. Sistemas', requiereLaboratorio: true, condicion: 'O' },
    { codigo: 'EP-602', nombre: 'Ingeniería Económica', creditos: 3, horasTeoria: 1, horasPractica: 2, horasLaboratorio: 2, ciclo: 6, departamento: 'Dpto. de Ing. Industrial', requiereLaboratorio: true, condicion: 'O' },
    { codigo: 'EE-602', nombre: 'Ingeniería de Datos II', creditos: 4, horasTeoria: 2, horasPractica: 1, horasLaboratorio: 3, ciclo: 6, departamento: 'Dpto. de Ing. Sistemas', requiereLaboratorio: true, condicion: 'O' },
    { codigo: 'EE-603', nombre: 'Sistemas Operativos', creditos: 3, horasTeoria: 1, horasPractica: 2, horasLaboratorio: 2, ciclo: 6, departamento: 'Dpto. de Ing. Sistemas', requiereLaboratorio: true, condicion: 'O' },
    { codigo: 'EE-604', nombre: 'Ingeniería de Requerimientos', creditos: 3, horasTeoria: 1, horasPractica: 2, horasLaboratorio: 2, ciclo: 6, departamento: 'Dpto. de Ing. Sistemas', requiereLaboratorio: true, condicion: 'O' },

    // Ciclo VII
    { codigo: 'EP-701', nombre: 'Cadena de Suministro', creditos: 3, horasTeoria: 2, horasPractica: 2, horasLaboratorio: 0, ciclo: 7, departamento: 'Dpto. de Ing. Industrial', condicion: 'O' },
    { codigo: 'EE-701', nombre: 'Gestión de Servicios de TIC', creditos: 3, horasTeoria: 1, horasPractica: 2, horasLaboratorio: 2, ciclo: 7, departamento: 'Dpto. de Ing. Sistemas', requiereLaboratorio: true, condicion: 'O' },
    { codigo: 'EE-702', nombre: 'Planeamiento Estratégico de la Información', creditos: 3, horasTeoria: 1, horasPractica: 2, horasLaboratorio: 2, ciclo: 7, departamento: 'Dpto. de Ing. Sistemas', requiereLaboratorio: true, condicion: 'O' },
    { codigo: 'EE-703', nombre: 'Redes y Comunicaciones I', creditos: 3, horasTeoria: 1, horasPractica: 1, horasLaboratorio: 3, ciclo: 7, departamento: 'Dpto. de Ing. Sistemas', requiereLaboratorio: true, condicion: 'O' },
    { codigo: 'EE-704', nombre: 'Ingeniería del Software I', creditos: 4, horasTeoria: 2, horasPractica: 1, horasLaboratorio: 3, ciclo: 7, departamento: 'Dpto. de Ing. Sistemas', requiereLaboratorio: true, condicion: 'O' },
    { codigo: 'EL-702', nombre: 'Negocios Electrónicos (e)', creditos: 3, horasTeoria: 2, horasPractica: 0, horasLaboratorio: 2, ciclo: 7, departamento: 'Dpto. de Ing. Sistemas', condicion: 'E', requiereLaboratorio: true },

    // Ciclo VIII
    { codigo: 'EE-801', nombre: 'Seguridad de la Información', creditos: 3, horasTeoria: 1, horasPractica: 2, horasLaboratorio: 2, ciclo: 8, departamento: 'Dpto. de Ing. Sistemas', requiereLaboratorio: true, condicion: 'O' },
    { codigo: 'EE-802', nombre: 'Internet de las Cosas', creditos: 3, horasTeoria: 1, horasPractica: 1, horasLaboratorio: 3, ciclo: 8, departamento: 'Dpto. de Ing. Sistemas', requiereLaboratorio: true, condicion: 'O' },
    { codigo: 'EE-803', nombre: 'Inteligencia de Negocios', creditos: 3, horasTeoria: 1, horasPractica: 2, horasLaboratorio: 2, ciclo: 8, departamento: 'Dpto. de Ing. Sistemas', requiereLaboratorio: true, condicion: 'O' },
    { codigo: 'EE-804', nombre: 'Redes y Comunicaciones II', creditos: 3, horasTeoria: 1, horasPractica: 1, horasLaboratorio: 3, ciclo: 8, departamento: 'Dpto. de Ing. Sistemas', requiereLaboratorio: true, condicion: 'O' },
    { codigo: 'EE-805', nombre: 'Ingeniería del Software II', creditos: 4, horasTeoria: 2, horasPractica: 1, horasLaboratorio: 3, ciclo: 8, departamento: 'Dpto. de Ing. Sistemas', requiereLaboratorio: true, condicion: 'O' },

    // Ciclo IX
    { codigo: 'EE-901', nombre: 'Gestión de Proyectos de TIC', creditos: 1, horasTeoria: 1, horasPractica: 2, horasLaboratorio: 2, ciclo: 9, departamento: 'Dpto. de Ing. Sistemas', requiereLaboratorio: true, condicion: 'O' },
    { codigo: 'EE-902', nombre: 'Auditoría Informática', creditos: 3, horasTeoria: 1, horasPractica: 2, horasLaboratorio: 2, ciclo: 9, departamento: 'Dpto. de Ing. Sistemas', requiereLaboratorio: true, condicion: 'O' },
    { codigo: 'EI-901', nombre: 'Tesis I', creditos: 4, horasTeoria: 2, horasPractica: 2, horasLaboratorio: 2, ciclo: 9, departamento: 'Dpto. de Ing. Sistemas', requiereLaboratorio: true, condicion: 'O' },
    { codigo: 'EE-903', nombre: 'Analítica de Negocios', creditos: 3, horasTeoria: 1, horasPractica: 2, horasLaboratorio: 2, ciclo: 9, departamento: 'Dpto. de Ing. Sistemas', requiereLaboratorio: true, condicion: 'O' },
    { codigo: 'EE-904', nombre: 'Computación en la Nube', creditos: 3, horasTeoria: 1, horasPractica: 1, horasLaboratorio: 3, ciclo: 9, departamento: 'Dpto. de Ing. Sistemas', requiereLaboratorio: true, condicion: 'O' },
    { codigo: 'EL-901', nombre: 'Emprendedurismo Tecnológico (e)', creditos: 3, horasTeoria: 2, horasPractica: 0, horasLaboratorio: 2, ciclo: 9, departamento: 'Dpto. de Ing. Sistemas', condicion: 'E', requiereLaboratorio: true },
    { codigo: 'EL-902', nombre: 'Hackeo Ético (e)', creditos: 3, horasTeoria: 2, horasPractica: 0, horasLaboratorio: 2, ciclo: 9, departamento: 'Dpto. de Ing. Sistemas', condicion: 'E', requiereLaboratorio: true },

    // Ciclo X
    { codigo: 'EE-X02', nombre: 'Gobierno de TIC', creditos: 3, horasTeoria: 1, horasPractica: 2, horasLaboratorio: 2, ciclo: 10, departamento: 'Dpto. de Ing. Sistemas', requiereLaboratorio: true, condicion: 'O' },
    { codigo: 'EI-X01', nombre: 'Tesis II', creditos: 4, horasTeoria: 2, horasPractica: 2, horasLaboratorio: 2, ciclo: 10, departamento: 'Dpto. de Ing. Sistemas', requiereLaboratorio: true, condicion: 'O' },
    { codigo: 'EE-X03', nombre: 'Arquitectura Empresarial', creditos: 3, horasTeoria: 1, horasPractica: 2, horasLaboratorio: 2, ciclo: 10, departamento: 'Dpto. de Ing. Sistemas', requiereLaboratorio: true, condicion: 'O' },
    { codigo: 'EP-X01', nombre: 'Responsabilidad Social Corporativa', creditos: 3, horasTeoria: 2, horasPractica: 2, horasLaboratorio: 0, ciclo: 10, departamento: 'Dpto. de Ing. Industrial', condicion: 'O' },
    { codigo: 'EE-X05', nombre: 'Prácticas Pre Profesionales', creditos: 4, horasTeoria: 2, horasPractica: 1, horasLaboratorio: 3, ciclo: 10, departamento: 'Dpto. de Ing. Sistemas', requiereLaboratorio: true, condicion: 'O' },
  ];

  const cursos = await Promise.all(
    cursosData.map((c) => prisma.curso.create({ data: c }))
  );
  console.log(`  ✅ ${cursos.length} cursos creados`);

  // ── Estructura Organizacional ─────────────────────
  const facultadIng = await prisma.facultad.create({ data: { nombre: 'Facultad de Ingeniería', siglas: 'FI' } });
  const facultadCiencias = await prisma.facultad.create({ data: { nombre: 'Facultad de Ciencias Físicas y Matemáticas', siglas: 'FCFM' } });

  const deptoSistemas = await prisma.departamento.create({ data: { nombre: 'Departamento de Ingeniería de Sistemas', facultadId: facultadIng.id } });
  const deptoIndustrial = await prisma.departamento.create({ data: { nombre: 'Departamento de Ingeniería Industrial', facultadId: facultadIng.id } });
  const deptoMatematicas = await prisma.departamento.create({ data: { nombre: 'Departamento de Matemáticas', facultadId: facultadCiencias.id } });
  const deptoFisica = await prisma.departamento.create({ data: { nombre: 'Departamento de Física', facultadId: facultadCiencias.id } });

  const escuelaSistemas = await prisma.escuela.create({ data: { nombre: 'Escuela de Ingeniería de Sistemas', facultadId: facultadIng.id } });

  const curricula2018 = await prisma.curricula.create({
    data: { codigo: '2018', escuelaId: escuelaSistemas.id, vigente: true, anio: 2018 },
  });

  const cursosCurriculaData = cursos.map((curso) => ({
    cursoId: curso.id, curriculaId: curricula2018.id, ciclo: curso.ciclo, esElectivo: curso.condicion === 'E',
  }));
  await prisma.cursoCurricula.createMany({ data: cursosCurriculaData });

  // ── Docentes ───────────────────────────────────────
  const docentesData = [
    // DPTO SISTEMAS
    { nombre: 'Juan Pedro Santos Fernandez', email: 'jsantos@unitru.edu.pe', categoria: CategoriaDocente.PRINCIPAL, tipo: TipoDocente.NOMBRADO, antiguedad: new Date('1985-05-10'), dni: '01234567', codigoIBM: 'IBM001', modalidad: ModalidadDocente.DEDICACION_EXCLUSIVA, horasContrato: 40, departamentoId: deptoSistemas.id, gradoAcademico: 'Doctor', especialidad: 'Ingeniería de Software', experienciaAnios: 40 },
    { nombre: 'Luis Enrique Boy Chavil', email: 'lboy@unitru.edu.pe', categoria: CategoriaDocente.PRINCIPAL, tipo: TipoDocente.NOMBRADO, antiguedad: new Date('1990-03-15'), dni: '12345678', codigoIBM: 'IBM002', modalidad: ModalidadDocente.DEDICACION_EXCLUSIVA, horasContrato: 40, departamentoId: deptoSistemas.id, gradoAcademico: 'Doctor', especialidad: 'Ingeniería de Datos', experienciaAnios: 35 },
    { nombre: 'Everson Agreda Gamboa', email: 'eagreda@unitru.edu.pe', categoria: CategoriaDocente.PRINCIPAL, tipo: TipoDocente.NOMBRADO, antiguedad: new Date('1995-08-20'), dni: '23456789', codigoIBM: 'IBM003', modalidad: ModalidadDocente.TIEMPO_COMPLETO, horasContrato: 40, departamentoId: deptoSistemas.id, gradoAcademico: 'Doctor', especialidad: 'Redes y Negocios', experienciaAnios: 30 },
    { nombre: 'Alberto Mendoza de los Santos', email: 'amendoza@unitru.edu.pe', categoria: CategoriaDocente.PRINCIPAL, tipo: TipoDocente.NOMBRADO, antiguedad: new Date('1998-01-10'), dni: '34567890', codigoIBM: 'IBM004', modalidad: ModalidadDocente.TIEMPO_COMPLETO, horasContrato: 40, departamentoId: deptoSistemas.id, gradoAcademico: 'Doctor', especialidad: 'Gobierno de TIC', experienciaAnios: 28 },
    { nombre: 'José Alberto Gómez Ávila', email: 'jgomez@unitru.edu.pe', categoria: CategoriaDocente.PRINCIPAL, tipo: TipoDocente.NOMBRADO, antiguedad: new Date('2000-06-01'), dni: '45678901', codigoIBM: 'IBM005', modalidad: ModalidadDocente.TIEMPO_COMPLETO, horasContrato: 40, departamentoId: deptoSistemas.id, gradoAcademico: 'Doctor', especialidad: 'Gestión de Proyectos', experienciaAnios: 25 },
    { nombre: 'Ricardo Darío Mendoza Rivera', email: 'rmendoza@unitru.edu.pe', categoria: CategoriaDocente.PRINCIPAL, tipo: TipoDocente.NOMBRADO, antiguedad: new Date('2002-11-15'), dni: '56789012', codigoIBM: 'IBM006', modalidad: ModalidadDocente.TIEMPO_COMPLETO, horasContrato: 40, departamentoId: deptoSistemas.id, gradoAcademico: 'Doctor', especialidad: 'Tesis e Inteligencia', experienciaAnios: 23 },
    { nombre: 'Juan Carlos Obando Roldán', email: 'jobando@unitru.edu.pe', categoria: CategoriaDocente.PRINCIPAL, tipo: TipoDocente.NOMBRADO, antiguedad: new Date('2004-04-10'), dni: '67890123', codigoIBM: 'IBM007', modalidad: ModalidadDocente.TIEMPO_COMPLETO, horasContrato: 40, departamentoId: deptoSistemas.id, gradoAcademico: 'Doctor', especialidad: 'Sistemas de Información', experienciaAnios: 21 },
    { nombre: 'Oscar Alcantara Moreno', email: 'oalcantara@unitru.edu.pe', categoria: CategoriaDocente.PRINCIPAL, tipo: TipoDocente.NOMBRADO, antiguedad: new Date('2006-07-20'), dni: '78901234', codigoIBM: 'IBM008', modalidad: ModalidadDocente.TIEMPO_COMPLETO, horasContrato: 40, departamentoId: deptoSistemas.id, gradoAcademico: 'Doctor', especialidad: 'Planeamiento Estratégico', experienciaAnios: 19 },
    
    { nombre: 'Robert Jerry Sanchez Ticona', email: 'rsanchez@unitru.edu.pe', categoria: CategoriaDocente.ASOCIADO, tipo: TipoDocente.NOMBRADO, antiguedad: new Date('2010-02-28'), dni: '89012345', codigoIBM: 'IBM009', modalidad: ModalidadDocente.TIEMPO_COMPLETO, horasContrato: 40, departamentoId: deptoSistemas.id, gradoAcademico: 'Magíster', especialidad: 'Sistemas e Ingeniería', experienciaAnios: 15 },
    { nombre: 'Marcelino Torres Villanueva', email: 'mtorres@unitru.edu.pe', categoria: CategoriaDocente.ASOCIADO, tipo: TipoDocente.NOMBRADO, antiguedad: new Date('2012-08-01'), dni: '90123456', codigoIBM: 'IBM010', modalidad: ModalidadDocente.TIEMPO_COMPLETO, horasContrato: 40, departamentoId: deptoSistemas.id, gradoAcademico: 'Magíster', especialidad: 'Programación y Datos', experienciaAnios: 13 },
    { nombre: 'Zoraida Vidal Melgarejo', email: 'zvidal@unitru.edu.pe', categoria: CategoriaDocente.ASOCIADO, tipo: TipoDocente.NOMBRADO, antiguedad: new Date('2014-03-15'), dni: '02345678', codigoIBM: 'IBM011', modalidad: ModalidadDocente.TIEMPO_COMPLETO, horasContrato: 40, departamentoId: deptoSistemas.id, gradoAcademico: 'Magíster', especialidad: 'Programación Orientada a Objetos', experienciaAnios: 11 },
    { nombre: 'Silvia Ana Rodriguez Aguirre', email: 'srodriguez@unitru.edu.pe', categoria: CategoriaDocente.ASOCIADO, tipo: TipoDocente.NOMBRADO, antiguedad: new Date('2016-03-01'), dni: '13456789', codigoIBM: 'IBM012', modalidad: ModalidadDocente.TIEMPO_COMPLETO, horasContrato: 40, departamentoId: deptoSistemas.id, gradoAcademico: 'Magíster', especialidad: 'Sistémica', experienciaAnios: 9 },
    { nombre: 'Camilo Suarez Rebaza', email: 'csuarez@unitru.edu.pe', categoria: CategoriaDocente.ASOCIADO, tipo: TipoDocente.NOMBRADO, antiguedad: new Date('2018-08-15'), dni: '24567890', codigoIBM: 'IBM013', modalidad: ModalidadDocente.TIEMPO_COMPLETO, horasContrato: 40, departamentoId: deptoSistemas.id, gradoAcademico: 'Magíster', especialidad: 'Plataformas y Hackeo', experienciaAnios: 7 },
    
    { nombre: 'Cesar Arellano Salazar', email: 'carellano@unitru.edu.pe', categoria: CategoriaDocente.AUXILIAR, tipo: TipoDocente.NOMBRADO, antiguedad: new Date('2020-03-01'), dni: '35678901', codigoIBM: 'IBM014', modalidad: ModalidadDocente.TIEMPO_COMPLETO, horasContrato: 40, departamentoId: deptoSistemas.id, gradoAcademico: 'Ingeniero', especialidad: 'Sistemas Digitales y SO', experienciaAnios: 5 },

    // OTROS DEPARTAMENTOS
    { nombre: 'Joe Alexis Gonzales Vasquez', email: 'jgonzales@unitru.edu.pe', categoria: CategoriaDocente.AUXILIAR, tipo: TipoDocente.NOMBRADO, antiguedad: new Date('2021-03-15'), dni: '46789012', codigoIBM: 'IBM015', modalidad: ModalidadDocente.TIEMPO_COMPLETO, horasContrato: 40, departamentoId: deptoIndustrial.id, gradoAcademico: 'Ingeniero', especialidad: 'Ingeniería Económica', experienciaAnios: 4 },
    { nombre: 'Dr. Matematico Externo', email: 'math@unitru.edu.pe', categoria: CategoriaDocente.PRINCIPAL, tipo: TipoDocente.NOMBRADO, antiguedad: new Date('2000-01-01'), dni: '57890123', codigoIBM: 'IBM016', modalidad: ModalidadDocente.TIEMPO_COMPLETO, horasContrato: 40, departamentoId: deptoMatematicas.id, gradoAcademico: 'Doctor', especialidad: 'Matemática Pura', experienciaAnios: 25 },
    { nombre: 'Mg. Fisico Externo', email: 'physics@unitru.edu.pe', categoria: CategoriaDocente.ASOCIADO, tipo: TipoDocente.NOMBRADO, antiguedad: new Date('2010-01-01'), dni: '68901234', codigoIBM: 'IBM017', modalidad: ModalidadDocente.TIEMPO_COMPLETO, horasContrato: 40, departamentoId: deptoFisica.id, gradoAcademico: 'Magíster', especialidad: 'Física', experienciaAnios: 15 },
  ];

  const docentes = await Promise.all(docentesData.map((d) => prisma.docente.create({ data: d })));
  console.log(`  ✅ ${docentes.length} docentes creados`);

  // ── Asignaciones de Carga Lectiva (DATA DEFINITION) ─────────────────
  const assignmentsData: { docenteIdx: number; assignments: { code: string, group: string }[] }[] = [
    { docenteIdx: 0, assignments: [{ code: 'EE-704', group: 'A' }, { code: 'EE-805', group: 'A' }, { code: 'EI-901', group: 'A' }, { code: 'EI-X01', group: 'A' }] }, // Juan Pedro Santos
    { docenteIdx: 1, assignments: [{ code: 'EE-502', group: 'A' }, { code: 'EE-602', group: 'A' }] }, // Luis Boy
    { docenteIdx: 2, assignments: [{ code: 'EE-804', group: 'A' }, { code: 'EL-702', group: 'A' }, { code: 'EE-X03', group: 'A' }] }, // Everson Agreda
    { docenteIdx: 3, assignments: [{ code: 'EE-701', group: 'A' }, { code: 'EE-801', group: 'A' }, { code: 'EE-902', group: 'A' }, { code: 'EE-X02', group: 'A' }] }, // Alberto Mendoza
    { docenteIdx: 4, assignments: [{ code: 'EP-402', group: 'A' }, { code: 'EE-802', group: 'A' }, { code: 'EE-901', group: 'A' }, { code: 'EE-904', group: 'A' }] }, // José Gómez
    { docenteIdx: 5, assignments: [{ code: 'EI-901', group: 'B' }, { code: 'EI-X01', group: 'B' }, { code: 'EE-803', group: 'A' }, { code: 'EE-903', group: 'A' }] }, // Ricardo Mendoza (shares Tesis B)
    { docenteIdx: 6, assignments: [{ code: 'EL-301', group: 'A' }, { code: 'EE-401', group: 'A' }, { code: 'EE-504', group: 'B' }] }, // Juan Carlos Obando (shares Sistemas Info B)
    { docenteIdx: 7, assignments: [{ code: 'EE-702', group: 'A' }, { code: 'EL-901', group: 'A' }, { code: 'EE-X05', group: 'A' }] }, // Oscar Alcantara
    { docenteIdx: 8, assignments: [{ code: 'EL-401', group: 'A' }, { code: 'EE-501', group: 'A' }, { code: 'EE-504', group: 'A' }, { code: 'EE-604', group: 'A' }, { code: 'EE-704', group: 'B' }] }, // Robert Sanchez
    { docenteIdx: 9, assignments: [{ code: 'EE-102', group: 'A' }, { code: 'EE-403', group: 'A' }, { code: 'EE-601', group: 'A' }] }, // Marcelino Torres (shares Intro Prog A)
    { docenteIdx: 10, assignments: [{ code: 'EE-201', group: 'A' }, { code: 'EE-302', group: 'A' }, { code: 'EE-102', group: 'B' }] }, // Zoraida Vidal (shares Intro Prog B)
    { docenteIdx: 11, assignments: [{ code: 'EE-301', group: 'A' }] }, // Silvia Rodriguez
    { docenteIdx: 12, assignments: [{ code: 'EL-402', group: 'A' }, { code: 'EL-902', group: 'A' }] }, // Camilo Suarez
    { docenteIdx: 13, assignments: [{ code: 'EE-402', group: 'A' }, { code: 'EE-503', group: 'A' }, { code: 'EE-603', group: 'A' }, { code: 'EE-703', group: 'A' }] }, // Cesar Arellano
    { docenteIdx: 14, assignments: [{ code: 'EP-602', group: 'A' }, { code: 'EP-701', group: 'A' }, { code: 'EP-X01', group: 'A' }] }, // Joe Gonzales
    { docenteIdx: 15, assignments: [{ code: 'EG-101', group: 'A' }, { code: 'EG-104', group: 'A' }, { code: 'EG-204', group: 'A' }, { code: 'EP-303', group: 'A' }] }, // Math Teacher
    { docenteIdx: 16, assignments: [{ code: 'EG-205', group: 'A' }, { code: 'EP-304', group: 'A' }] }, // Physics Teacher
  ];

  // ── Grupos ─────────────────────────────────────────
  const gruposCreated = [];
  const sharedCourseCodes = ['EE-704', 'EI-901', 'EI-X01', 'EE-102', 'EE-504'];
  
  // Función para crear grupos y asignaciones por periodo
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
          // Asignar Teoría
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

  console.log('  ⏳ Creando grupos y asignaciones para 2026-I...');
  await seedPeriodo(periodo2026I);
  console.log('  ⏳ Creando grupos y asignaciones para 2026-II...');
  await seedPeriodo(periodo2026II);
  
  console.log(`  ✅ ${gruposCreated.length} grupos creados en total`);

  // ── Usuarios ──────────────────────────────
  const hashedPassword = await bcrypt.hash('admin123', 10);
  const docentePassword = await bcrypt.hash('docente123', 10);

  await prisma.user.create({ data: { email: 'admin@unt.edu.pe', password: hashedPassword, nombre: 'Administrador', role: UserRole.ADMIN } });
  await prisma.user.create({ data: { email: 'director@unt.edu.pe', password: hashedPassword, nombre: 'Director Escuela', role: UserRole.DIRECTOR_ESCUELA } });
  await prisma.user.create({ data: { email: 'secretaria@unt.edu.pe', password: hashedPassword, nombre: 'Secretaria Académica', role: UserRole.SECRETARIA_ACADEMICA } });

  // Jefe de Departamento de Sistemas
  const jefeDeptSistemas = await prisma.user.create({
    data: { 
      email: 'dirsistemas@unt.edu.pe', 
      password: hashedPassword, 
      nombre: 'Jefe de Departamento de Sistemas', 
      role: UserRole.DIRECTOR_DEPARTAMENTO 
    } 
  });

  // Decano
  await prisma.user.create({
    data: { 
      email: 'decano@unt.edu.pe', 
      password: hashedPassword, 
      nombre: 'Decano de Facultad', 
      role: UserRole.DECANO 
    } 
  });

  // Vincular Jefe al Departamento de Sistemas
  await prisma.departamento.update({
    where: { id: deptoSistemas.id },
    data: { directorId: jefeDeptSistemas.id }
  });

  // ── Horario Personal y Declaraciones (Pruebas 2026-I) ────────────────
  console.log('  ⏳ Generando horarios y declaraciones de prueba...');

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

    // Actualizar Carga Lectiva para Ticona
    await prisma.asignacionCargaLectiva.upsert({
      where: { grupoId_periodoId_tipo: { grupoId: softwareI.id, periodoId: periodo2026I.id, tipo: 'LABORATORIO' } },
      update: { horasAsignadas: 9, compartido: true }, // 3h Santos + 6h Ticona = 9h totales de dictado lab
      create: { docenteId: juanSantos.id, grupoId: softwareI.id, periodoId: periodo2026I.id, tipo: 'LABORATORIO', horasAsignadas: 9, compartido: true }
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
  if (tesisI) {
    await prisma.asignacion.createMany({
      data: [
        { grupoId: tesisI.id, docenteId: juanSantos.id, aulaId: (await prisma.aula.findUnique({ where: { codigo: 'EPG-311' } }))!.id, franjaHorariaId: getFranja('MIERCOLES', 2)!.id, periodoId: periodo2026I.id, tipo: 'TEORIA' },
        { grupoId: tesisI.id, docenteId: juanSantos.id, aulaId: (await prisma.aula.findUnique({ where: { codigo: 'EPG-311' } }))!.id, franjaHorariaId: getFranja('MIERCOLES', 3)!.id, periodoId: periodo2026I.id, tipo: 'TEORIA' },
        { grupoId: tesisI.id, docenteId: juanSantos.id, aulaId: (await prisma.aula.findUnique({ where: { codigo: 'EPG-311' } }))!.id, franjaHorariaId: getFranja('MIERCOLES', 4)!.id, periodoId: periodo2026I.id, tipo: 'PRACTICA' },
        { grupoId: tesisI.id, docenteId: juanSantos.id, aulaId: (await prisma.aula.findUnique({ where: { codigo: 'EPG-311' } }))!.id, franjaHorariaId: getFranja('MIERCOLES', 5)!.id, periodoId: periodo2026I.id, tipo: 'PRACTICA' },
        { grupoId: tesisI.id, docenteId: juanSantos.id, aulaId: (await prisma.aula.findUnique({ where: { codigo: 'LAB-4' } }))!.id, franjaHorariaId: getFranja('MIERCOLES', 6)!.id, periodoId: periodo2026I.id, tipo: 'LABORATORIO' },
        { grupoId: tesisI.id, docenteId: juanSantos.id, aulaId: (await prisma.aula.findUnique({ where: { codigo: 'LAB-4' } }))!.id, franjaHorariaId: getFranja('MIERCOLES', 7)!.id, periodoId: periodo2026I.id, tipo: 'LABORATORIO' },
      ]
    });
  }

  // Carga No Lectiva Juan Santos (28h para llegar a 40h)
  const cargasJuan = [
    { tipo: TipoCargaNoLectiva.PREPARACION_EVALUACION, horas: 6, descripcion: 'Preparación de clases y evaluación' },
    { tipo: TipoCargaNoLectiva.INVESTIGACION, horas: 12, descripcion: 'Proyecto IA', codigoProyecto: 'INV-2026-005', nombreProyecto: 'IA en Educación' },
    { tipo: TipoCargaNoLectiva.CONSEJERIA, horas: 4, descripcion: 'Tutoría VII ciclo', numAlumnos: 15, cicloConsejeria: '2026-I' },
    { tipo: TipoCargaNoLectiva.ADMINISTRACION, horas: 6, descripcion: 'Comisión académica' },
  ];

  for (const c of cargasJuan) {
    const carga = await prisma.cargaNoLectiva.create({
      data: { ...c, docenteId: juanSantos.id, periodoId: periodo2026I.id }
    });
    if (c.tipo === TipoCargaNoLectiva.INVESTIGACION) {
      await prisma.horarioCargaNoLectiva.create({
        data: { cargaNoLectivaId: carga.id, dia: 'JUEVES', horaInicio: '08:00', horaFin: '12:00', lugar: 'Gabinete' }
      });
    }
  }

  // Declaración Juan Santos (FINALIZADA)
  await prisma.declaracionCarga.create({
    data: {
      docenteId: juanSantos.id,
      periodoId: periodo2026I.id,
      estado: EstadoDeclaracion.FINALIZADA,
      totalHorasLectivas: 12,
      totalHorasNoLectivas: 28,
      totalHoras: 40,
      fechaAprobacionDepto: new Date(),
      fechaAprobacionEscuela: new Date(),
      fechaVistoBueno: new Date(),
      vistoBuenoDecanoId: (await prisma.user.findFirst({ where: { role: UserRole.DECANO } }))!.id
    }
  });

  // 2. Luis Boy (EN PROCESO - ENVIADA)
  const luisBoy = docentes[1];
  await prisma.cargaNoLectiva.create({
    data: { docenteId: luisBoy.id, periodoId: periodo2026I.id, tipo: TipoCargaNoLectiva.PREPARACION_EVALUACION, horas: 4, descripcion: 'Preparación de clases' }
  });
  await prisma.declaracionCarga.create({
    data: {
      docenteId: luisBoy.id,
      periodoId: periodo2026I.id,
      estado: EstadoDeclaracion.ENVIADA,
      totalHorasLectivas: 8,
      totalHorasNoLectivas: 4,
      totalHoras: 12, // Incompleta
    }
  });

  // 3. Everson Agreda (RECHAZADA)
  const everson = docentes[2];
  await prisma.declaracionCarga.create({
    data: {
      docenteId: everson.id,
      periodoId: periodo2026I.id,
      estado: EstadoDeclaracion.RECHAZADA,
      observaciones: 'Falta detallar las horas de investigación.',
      totalHorasLectivas: 9,
      totalHorasNoLectivas: 0,
      totalHoras: 9,
    }
  });

  // 4. Crear más usuarios docentes
  for (let i = 1; i < docentes.length; i++) {
    const d = docentes[i];
    const email = d.email;
    const exists = await prisma.user.findUnique({ where: { email } });
    if (!exists) {
      await prisma.user.create({
        data: { email, password: docentePassword, nombre: d.nombre, role: UserRole.DOCENTE, docenteId: d.id }
      });
    }
  }

  console.log('\n🎉 Seed completo!');
  console.log(`   Docentes: ${docentes.length}`);
  console.log(`   Cursos: ${cursos.length}`);
  console.log(`   Grupos: ${gruposCreated.length}`);
}

main()
  .then(async () => { await prisma.$disconnect(); })
  .catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
