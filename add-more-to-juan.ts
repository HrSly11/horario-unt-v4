
import { PrismaClient, TipoAsignacion } from './src/generated/prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Adding more courses to Juan Santos...');

  // 1. Obtener Juan Santos
  const juan = await prisma.docente.findUnique({
    where: { email: 'jsantos@unitru.edu.pe' },
  });

  if (!juan) {
    throw new Error('Juan Santos not found');
  }
  console.log('Found Juan Santos:', juan.nombre);

  // 2. Obtener periodo activo
  const periodo = await prisma.periodoAcademico.findFirst({
    where: { activo: true },
  });

  if (!periodo) {
    throw new Error('No active period');
  }
  console.log('Active period:', periodo.nombre);

  // 3. Obtener cursos que Juan NO tiene asignado
  const allGrupos = await prisma.grupo.findMany({
    where: { periodoAcademicoId: periodo.id },
    include: {
      curso: true,
      asignacionesCargaLectiva: true,
    },
  });

  // Filtrar grupos que NO tienen a Juan como principal ni compartido
  const gruposDisponibles = allGrupos.filter(grupo => {
    const tieneJuan = grupo.asignacionesCargaLectiva.some(
      acl => acl.docenteId === juan.id || acl.docenteCompartidoId === juan.id
    );
    return !tieneJuan;
  });

  console.log(`Found ${gruposDisponibles.length} groups available for Juan`);

  // Tomar 3 grupos para asignarle a Juan
  const gruposParaAsignar = gruposDisponibles.slice(0, 3);

  for (const grupo of gruposParaAsignar) {
    console.log(`\nAssigning ${grupo.curso.nombre} (${grupo.nombre}) to Juan...`);

    // Primero borrar las asignaciones existentes de este grupo
    await prisma.asignacionCargaLectiva.deleteMany({
      where: { grupoId: grupo.id },
    });

    // Asignar teoría si hay
    if (grupo.curso.horasTeoria > 0) {
      await prisma.asignacionCargaLectiva.create({
        data: {
          docenteId: juan.id,
          grupoId: grupo.id,
          periodoId: periodo.id,
          tipo: TipoAsignacion.TEORIA,
          horasAsignadas: grupo.curso.horasTeoria,
          compartido: false,
        },
      });
      console.log(`  - Teoría: ${grupo.curso.horasTeoria}h`);
    }

    // Asignar práctica si hay
    if (grupo.curso.horasPractica > 0) {
      await prisma.asignacionCargaLectiva.create({
        data: {
          docenteId: juan.id,
          grupoId: grupo.id,
          periodoId: periodo.id,
          tipo: TipoAsignacion.PRACTICA,
          horasAsignadas: grupo.curso.horasPractica,
          compartido: false,
        },
      });
      console.log(`  - Práctica: ${grupo.curso.horasPractica}h`);
    }

    // Asignar laboratorio si hay
    if (grupo.curso.horasLaboratorio > 0 && grupo.curso.numGruposLaboratorio) {
      // Dividir laboratorio entre grupos
      const horasPorGrupo = grupo.curso.horasLaboratorio;
      await prisma.asignacionCargaLectiva.create({
        data: {
          docenteId: juan.id,
          grupoId: grupo.id,
          periodoId: periodo.id,
          tipo: TipoAsignacion.LABORATORIO,
          horasAsignadas: horasPorGrupo,
          grupoLaboratorio: grupo.nombre,
          compartido: false,
        },
      });
      console.log(`  - Laboratorio: ${horasPorGrupo}h`);
    }
  }

  // Verificar total de horas de Juan
  const asignacionesJuan = await prisma.asignacionCargaLectiva.findMany({
    where: {
      OR: [
        { docenteId: juan.id },
        { docenteCompartidoId: juan.id },
      ],
      periodoId: periodo.id,
    },
  });

  const totalHorasJuan = asignacionesJuan.reduce((sum, a) => sum + a.horasAsignadas, 0);
  const limitePreparacion = Math.floor(totalHorasJuan * 0.5);

  console.log(`\n✅ Success!`);
  console.log(`Juan's new total lectiva hours: ${totalHorasJuan}`);
  console.log(`Max allowed preparacion y evaluacion: ${limitePreparacion}h (${totalHorasJuan} * 0.5)`);
  console.log(`Current preparacion y evaluacion: 6h`);
  console.log(`✅ 6h <= ${limitePreparacion}h: ${6 <= limitePreparacion}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

