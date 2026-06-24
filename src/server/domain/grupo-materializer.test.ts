import { describe, expect, it, vi } from 'vitest';
import { materializeGruposForCurso } from './grupo-materializer';

type Row = { id: string; nombre: string; seccion: string | null; demandaLineaId: string | null };

function makePrismaStub(initial: Row[] = []) {
  const groups: Row[] = initial.map((g) => ({ ...g }));

  const prisma = {
    grupo: {
      findMany: vi.fn(async (_args: any) =>
        groups.map((g) => ({ id: g.id, nombre: g.nombre, seccion: g.seccion }))
      ),
      create: vi.fn(async ({ data }: any) => {
        const id = `g-${groups.length + 1}`;
        const row: Row = {
          id,
          nombre: data.nombre,
          seccion: data.seccion ?? null,
          demandaLineaId: data.demandaLineaId ?? null,
        };
        groups.push(row);
        return { id: row.id, nombre: row.nombre, seccion: row.seccion };
      }),
      updateMany: vi.fn(async (_args: any) => ({ count: 0 })),
      count: vi.fn(async () => groups.length),
    },
  };

  return prisma;
}

describe('materializeGruposForCurso', () => {
  it('crea Grupo "A" cuando no existe ninguno', async () => {
    const prisma = makePrismaStub([]);
    const created = await materializeGruposForCurso(prisma as any, {
      cursoId: 'curso-1',
      periodoId: 'periodo-1',
      numGruposLaboratorio: 1,
    });
    expect(prisma.grupo.create).toHaveBeenCalledTimes(1);
    expect(created[0].nombre).toBe('A');
  });

  it('crea Lab-1..Lab-N cuando numGruposLaboratorio > 1', async () => {
    const prisma = makePrismaStub([]);
    const created = await materializeGruposForCurso(prisma as any, {
      cursoId: 'curso-1',
      periodoId: 'periodo-1',
      numGruposLaboratorio: 3,
    });
    const nombres = created.map((g) => g.nombre);
    expect(nombres).toEqual(['A', 'Lab-1', 'Lab-2', 'Lab-3']);
    expect(prisma.grupo.create).toHaveBeenCalledTimes(4);
  });

  it('es idempotente: no duplica Grupo existentes cuando ya están todos los turnos', async () => {
    const prisma = makePrismaStub([
      { id: 'g-1', nombre: 'A', seccion: 'A', demandaLineaId: null },
      { id: 'g-2', nombre: 'Lab-1', seccion: 'Lab-1', demandaLineaId: null },
      { id: 'g-3', nombre: 'Lab-2', seccion: 'Lab-2', demandaLineaId: null },
    ]);
    const created = await materializeGruposForCurso(prisma as any, {
      cursoId: 'curso-1',
      periodoId: 'periodo-1',
      numGruposLaboratorio: 2,
    });
    expect(created).toEqual([]);
    expect(prisma.grupo.create).not.toHaveBeenCalled();
  });

  it('completa los turnos de laboratorio faltantes', async () => {
    const prisma = makePrismaStub([
      { id: 'g-1', nombre: 'A', seccion: 'A', demandaLineaId: null },
      { id: 'g-2', nombre: 'Lab-1', seccion: 'Lab-1', demandaLineaId: null },
    ]);
    const created = await materializeGruposForCurso(prisma as any, {
      cursoId: 'curso-1',
      periodoId: 'periodo-1',
      numGruposLaboratorio: 3,
    });
    expect(created.map((g) => g.nombre)).toEqual(['Lab-2', 'Lab-3']);
  });

  it('asocia demandaLineaId a Grupo existentes sin línea vinculada', async () => {
    const prisma = makePrismaStub([
      { id: 'g-1', nombre: 'A', seccion: 'A', demandaLineaId: null },
    ]);
    await materializeGruposForCurso(prisma as any, {
      cursoId: 'curso-1',
      periodoId: 'periodo-1',
      numGruposLaboratorio: 1,
      demandaLineaId: 'linea-1',
    });
    expect(prisma.grupo.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ nombre: 'A', demandaLineaId: null }),
        data: { demandaLineaId: 'linea-1' },
      })
    );
  });

  it('normaliza numGruposLaboratorio a 1 si llega 0 o NaN', async () => {
    const prisma = makePrismaStub([]);
    const created = await materializeGruposForCurso(prisma as any, {
      cursoId: 'curso-1',
      periodoId: 'periodo-1',
      numGruposLaboratorio: 0,
    });
    expect(created.map((g) => g.nombre)).toEqual(['A']);
  });
});
