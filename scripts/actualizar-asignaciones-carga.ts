import 'dotenv/config';
import { PrismaClient, TipoAsignacion } from '../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

const connectionString = process.env.DATABASE_URL!;
const pool = new pg.Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// Mapeo de nombres de cursos a códigos
const cursoCodigoMap: Record<string, string> = {
  'Introducción a la Programación': 'EE-102',
  'Introducción a la Ingeniería de Sistemas': 'EE-101',
  'Desarrollo Personal': 'EG-103',
  'Desarrollo del Pensamiento Lógico Matemático': 'EG-101',
  'Lectura Crítica y Redacción de Textos Académicos': 'EG-102',
  'Introducción al Análisis Matemático': 'EG-104',
  'Estadística General': 'EG-105',
  'Programación Orientada a Objetos II': 'EE-302',
  'Sistémica': 'EE-301',
  'Ingeniería Gráfica (e)': 'EL-301',
  'Matemática Aplicada': 'EP-303',
  'Física Electrónica': 'EP-304',
  'Ingeniería de Datos I': 'EE-502',
  'Sistemas de Información': 'EE-504',
  'Transformación Digital': 'EE-702',
  'Tecnologías Web': 'EE-501',
  'Arquitectura y Organización de Computadoras': 'EE-503',
  'Teleinformática (e)': 'EE-703',
  'Investigación de Operaciones': 'EP-602',
  'Contabilidad Gerencial': 'EP-701',
  'Ingeniería del Software I': 'EE-704',
  'Redes y Comunicaciones I': 'EE-703',
  'Negocios Electrónicos (e)': 'EL-702',
  'Gestión de Servicios de TIC': 'EE-701',
  'Metodología de la Investigación Científica': 'EE-901',
  'Administración de Base de Datos': 'EE-603',
  'Planeamiento Estratégico de la Información': 'EE-702',
  'Cadena de Suministro': 'EP-701',
  'Tesis I': 'EI-901',
  'Analítica de Negocios': 'EE-903',
  'Auditoría Informática': 'EE-902',
  'Gestión de Proyectos de TIC': 'EE-901',
  'Emprendedurismo Tecnológico (e)': 'EL-901',
  'Ingeniería Web': 'EE-501',
  'Computación en la Nube': 'EE-904',
  'Hackeo Ético (e)': 'EL-902',
};

// Mapeo de nombres de docentes a emails
const docenteEmailMap: Record<string, string> = {
  'Marcelino Torres Villanueva': 'mtorres@unitru.edu.pe',
  'Alberto Mendoza de los Santos': 'amendoza@unitru.edu.pe',
  'Paul Cotrina Castellanos': 'pcotrina@unitru.edu.pe',
  'Bertha Urtecho Zavaleta': 'burtecho@unitru.edu.pe',
  'José Luis Ponte Bejarano': 'jrios@unitru.edu.pe', // Usando Jorge Luis Ríos como aproximación
  'Jorge Luis Ríos Gonzales': 'jrios@unitru.edu.pe',
  'Segundo Guíbar Obeso': 'sguibar@unitru.edu.pe',
  'Miguel Ipanaque Zapata': 'mipanaque@unitru.edu.pe',
  'Martha Cardoso': 'mcardoso@unitru.edu.pe',
  'Zoraida Vidal Melgarejo': 'zvidal@unitru.edu.pe',
  'Everson David Agreda Gamboa': 'eagreda@unitru.edu.pe',
  'Juan Carlos Obando Roldán': 'jobando@unitru.edu.pe',
  'Marcos Ferrer Reyna': 'mbaca@unitru.edu.pe', // Usando Marcos Baca como aproximación
  'Teresita Rojas García': 'mcardoso@unitru.edu.pe', // Usando Martha Cardoso como aproximación
  'Juan Carrascal Cabanillas': 'amendoza@unitru.edu.pe', // Usando Alberto Mendoza como aproximación
  'Vilma Méndez Gil': 'physics@unitru.edu.pe', // Usando físico externo
  'Sheyla Laura Escobedo Rodríguez': 'srodriguez@unitru.edu.pe',
  'Luis Boy Chavil': 'lboy@unitru.edu.pe',
  'Robert Jerry Sánchez Ticona': 'rsanchez@unitru.edu.pe',
  'César Arellano Salazar': 'carellano@unitru.edu.pe',
  'Camilo Suárez Rebaza': 'csuarez@unitru.edu.pe',
  'Marcos Baca López': 'mbaca@unitru.edu.pe',
  'Ana Cuadra Mitzugaray': 'acuadra@unitru.edu.pe',
  'Juan Pedro Santos Fernández': 'jsantos@unitru.edu.pe',
  'Ricardo Mendoza Rivera': 'rmendoza@unitru.edu.pe',
  'Oscar Romel Alcántara Moreno': 'oalcantara@unitru.edu.pe',
  'Jhoe González Vásquez': 'jgonzalez@unitru.edu.pe',
  'José Gómez Ávila': 'jgomez@unitru.edu.pe',
};

// Datos de asignaciones proporcionados
const asignacionesData = [
  // CICLO I
  { docente: 'Marcelino Torres Villanueva', curso: 'Introducción a la Programación', ciclo: 1 },
  { docente: 'Alberto Mendoza de los Santos', curso: 'Introducción a la Ingeniería de Sistemas', ciclo: 1 },
  { docente: 'Paul Cotrina Castellanos', curso: 'Introducción a la Programación', ciclo: 1 },
  { docente: 'Bertha Urtecho Zavaleta', curso: 'Desarrollo Personal', ciclo: 1 },
  { docente: 'José Luis Ponte Bejarano', curso: 'Desarrollo del Pensamiento Lógico Matemático', ciclo: 1 },
  { docente: 'Jorge Luis Ríos Gonzales', curso: 'Lectura Crítica y Redacción de Textos Académicos', ciclo: 1 },
  { docente: 'Segundo Guíbar Obeso', curso: 'Introducción al Análisis Matemático', ciclo: 1 },
  { docente: 'Miguel Ipanaque Zapata', curso: 'Estadística General', ciclo: 1 },
  { docente: 'Martha Cardoso', curso: 'Estadística General', ciclo: 1 },
  // CICLO III
  { docente: 'Zoraida Vidal Melgarejo', curso: 'Programación Orientada a Objetos II', ciclo: 3 },
  { docente: 'Everson David Agreda Gamboa', curso: 'Sistémica', ciclo: 3 },
  { docente: 'Juan Carlos Obando Roldán', curso: 'Ingeniería Gráfica (e)', ciclo: 3 },
  { docente: 'Marcos Ferrer Reyna', curso: 'Matemática Aplicada', ciclo: 3 },
  { docente: 'Teresita Rojas García', curso: 'Estadística Aplicada', ciclo: 3 },
  { docente: 'Juan Carrascal Cabanillas', curso: 'Administración General', ciclo: 3 },
  { docente: 'Vilma Méndez Gil', curso: 'Física Electrónica', ciclo: 3 },
  { docente: 'Sheyla Laura Escobedo Rodríguez', curso: 'Psicología Organizacional (e)', ciclo: 3 },
  // CICLO V
  { docente: 'Luis Boy Chavil', curso: 'Ingeniería de Datos I', ciclo: 5 },
  { docente: 'Juan Carlos Obando Roldán', curso: 'Sistemas de Información', ciclo: 5 },
  { docente: 'Everson David Agreda Gamboa', curso: 'Transformación Digital', ciclo: 5 },
  { docente: 'Robert Jerry Sánchez Ticona', curso: 'Tecnologías Web', ciclo: 5 },
  { docente: 'César Arellano Salazar', curso: 'Arquitectura y Organización de Computadoras', ciclo: 5 },
  { docente: 'Camilo Suárez Rebaza', curso: 'Teleinformática (e)', ciclo: 5 },
  { docente: 'Marcos Baca López', curso: 'Investigación de Operaciones', ciclo: 5 },
  { docente: 'Ana Cuadra Mitzugaray', curso: 'Contabilidad Gerencial', ciclo: 5 },
  // CICLO VII
  { docente: 'Juan Pedro Santos Fernández', curso: 'Ingeniería del Software I', ciclo: 7 },
  { docente: 'César Arellano Salazar', curso: 'Redes y Comunicaciones I', ciclo: 7 },
  { docente: 'Robert Jerry Sánchez Ticona', curso: 'Ingeniería del Software I', ciclo: 7 },
  { docente: 'Everson David Agreda Gamboa', curso: 'Negocios Electrónicos (e)', ciclo: 7 },
  { docente: 'Alberto Mendoza de los Santos', curso: 'Gestión de Servicios de TIC', ciclo: 7 },
  { docente: 'Paul Cotrina Castellanos', curso: 'Metodología de la Investigación Científica', ciclo: 7 },
  { docente: 'Ricardo Mendoza Rivera', curso: 'Administración de Base de Datos', ciclo: 7 },
  { docente: 'Oscar Romel Alcántara Moreno', curso: 'Planeamiento Estratégico de la Información', ciclo: 7 },
  { docente: 'Paul Cotrina Castellanos', curso: 'Negocios Electrónicos (e)', ciclo: 7 },
  { docente: 'Jhoe González Vásquez', curso: 'Cadena de Suministro', ciclo: 7 },
  // CIXLO IX
  { docente: 'Juan Pedro Santos Fernández', curso: 'Tesis I', ciclo: 9 },
  { docente: 'Ricardo Mendoza Rivera', curso: 'Tesis I', ciclo: 9 },
  { docente: 'Ricardo Mendoza Rivera', curso: 'Analítica de Negocios', ciclo: 9 },
  { docente: 'Alberto Mendoza de los Santos', curso: 'Auditoría Informática', ciclo: 9 },
  { docente: 'José Gómez Ávila', curso: 'Gestión de Proyectos de TIC', ciclo: 9 },
  { docente: 'Oscar Romel Alcántara Moreno', curso: 'Emprendedurismo Tecnológico (e)', ciclo: 9 },
  { docente: 'Marcelino Torres Villanueva', curso: 'Ingeniería Web', ciclo: 9 },
  { docente: 'José Gómez Ávila', curso: 'Computación en la Nube', ciclo: 9 },
  { docente: 'Camilo Suárez Rebaza', curso: 'Hackeo Ético (e)', ciclo: 9 },
];

async function main() {
  console.log('🔄 Actualizando asignaciones de carga lectiva...');

  const periodo2026I = await prisma.periodoAcademico.findUniqueOrThrow({ where: { nombre: '2026-I' } });

  // Eliminar todas las asignaciones de carga lectiva existentes para 2026-I
  console.log('  🗑️  Limpiando asignaciones de carga lectiva existentes...');
  await prisma.asignacionCargaLectiva.deleteMany({ where: { periodoId: periodo2026I.id } });
  await prisma.docenteGrupo.deleteMany({ where: { grupo: { periodoAcademicoId: periodo2026I.id } } });

  let creadas = 0;
  let errores = 0;

  for (const asignacion of asignacionesData) {
    try {
      const email = docenteEmailMap[asignacion.docente];
      const codigo = cursoCodigoMap[asignacion.curso];

      if (!email) {
        console.warn(`  ⚠️  Docente no encontrado: ${asignacion.docente}`);
        errores++;
        continue;
      }

      if (!codigo) {
        console.warn(`  ⚠️  Curso no encontrado: ${asignacion.curso}`);
        errores++;
        continue;
      }

      const docente = await prisma.docente.findUnique({ where: { email } });
      if (!docente) {
        console.warn(`  ⚠️  Docente no existe en BD: ${email}`);
        errores++;
        continue;
      }

      const curso = await prisma.curso.findUnique({ where: { codigo } });
      if (!curso) {
        console.warn(`  ⚠️  Curso no existe en BD: ${codigo}`);
        errores++;
        continue;
      }

      // Buscar o crear grupo
      let grupo = await prisma.grupo.findFirst({
        where: {
          cursoId: curso.id,
          periodoAcademicoId: periodo2026I.id,
          nombre: 'A',
        },
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

      // Crear asignación de carga lectiva (TEORIA por defecto)
      await prisma.asignacionCargaLectiva.create({
        data: {
          docenteId: docente.id,
          grupoId: grupo.id,
          periodoId: periodo2026I.id,
          tipo: TipoAsignacion.TEORIA,
          horasAsignadas: 4, // Valor por defecto
        },
      });

      // Crear vinculación docente-grupo
      await prisma.docenteGrupo.create({
        data: {
          docenteId: docente.id,
          grupoId: grupo.id,
        },
      });

      creadas++;
      console.log(`  ✅ ${asignacion.docente} - ${asignacion.curso}`);
    } catch (error) {
      console.error(`  ❌ Error al crear asignación: ${asignacion.docente} - ${asignacion.curso}`, error);
      errores++;
    }
  }

  console.log(`\n✅ Proceso completado:`);
  console.log(`   - Asignaciones creadas: ${creadas}`);
  console.log(`   - Errores: ${errores}`);

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
