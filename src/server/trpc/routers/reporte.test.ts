import { describe, expect, it, vi } from 'vitest';
import { createCallerFactory } from '../init';
import { reporteRouter } from './reporte';
import { generateDocenteReportHTML } from '@/server/services/reports';

vi.mock('@/lib/prisma', () => ({ prisma: {} }));
vi.mock('@/lib/auth', () => ({ getSession: vi.fn() }));
vi.mock('@/server/services/reports', () => ({
  renderPDF: vi.fn(async () => Buffer.from('pdf')),
  generateAulaReportHTML: vi.fn(() => '<html>aula</html>'),
  generateDocenteReportHTML: vi.fn(() => '<html>docente</html>'),
  generateManagementReportHTML: vi.fn(() => '<html>gestion</html>'),
  generateCicloReportHTML: vi.fn(() => '<html>ciclo</html>'),
}));

type SessionRole =
  | 'ADMIN'
  | 'DOCENTE'
  | 'INVITADO'
  | 'SECRETARIA_ACADEMICA'
  | 'DIRECTOR_DEPARTAMENTO'
  | 'SECRETARIA_DEPARTAMENTO';

function makeSession(role: SessionRole, docenteId?: string) {
  return {
    id: `${role.toLowerCase()}-user`,
    email: `${role.toLowerCase()}@example.edu`,
    nombre: role,
    role,
    docenteId,
  };
}

function makeCaller(prisma: ReturnType<typeof makePrisma>, session: ReturnType<typeof makeSession>) {
  const createCaller = createCallerFactory(reporteRouter);

  return createCaller(async () => ({
    prisma: prisma as any,
    headers: new Headers(),
    session,
  }));
}

function makePrisma({
  session = makeSession('ADMIN'),
  managedDepartamentoId = 'dept-1',
}: {
  session?: ReturnType<typeof makeSession>;
  managedDepartamentoId?: string | null;
} = {}) {
  return {
    user: {
      findUnique: vi.fn(async () => ({
        ...session,
        docenteId: session.docenteId ?? null,
        activo: true,
      })),
    },
    departamento: {
      findUnique: vi.fn(async () => (managedDepartamentoId ? { id: managedDepartamentoId } : null)),
    },
    periodoAcademico: {
      findUnique: vi.fn(async () => ({ estado: 'APROBADO' })),
      findUniqueOrThrow: vi.fn(async () => ({
        id: 'period-1',
        nombre: '2026-I',
        fechaInicio: new Date('2026-03-01'),
        fechaFin: new Date('2026-07-01'),
        estado: 'APROBADO',
      })),
    },
    docente: {
      findMany: vi.fn(async () => [] as any[]),
      findUniqueOrThrow: vi.fn(async () => ({ departamentoId: managedDepartamentoId })),
      count: vi.fn(async () => 0),
    },
    asignacion: {
      findMany: vi.fn(async () => []),
      groupBy: vi.fn(async () => []),
    },
    grupo: {
      count: vi.fn(async () => 0),
    },
    aula: {
      findMany: vi.fn(async () => []),
    },
    franjaHoraria: {
      count: vi.fn(async () => 40),
    },
    log: {
      create: vi.fn(async (args) => args),
    },
  };
}

describe('reporteRouter department scoping', () => {
  it('scopes department secretary docente PDF reports to managed departments when no docenteId is supplied', async () => {
    const session = makeSession('SECRETARIA_DEPARTAMENTO');
    const prisma = makePrisma({ session, managedDepartamentoId: 'dept-managed' });
    const caller = makeCaller(prisma, session);

    await caller.generatePDF({ periodoId: 'period-1', tipo: 'por-docente' });

    expect(prisma.docente.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          activo: true,
          departamentoId: { in: ['dept-managed'] },
        },
      })
    );
  });

  it('rejects department secretary docente PDF reports for docentes outside the managed department', async () => {
    const session = makeSession('SECRETARIA_DEPARTAMENTO');
    const prisma = makePrisma({ session, managedDepartamentoId: 'dept-managed' });
    prisma.docente.findUniqueOrThrow.mockResolvedValueOnce({ departamentoId: 'dept-other' });
    const caller = makeCaller(prisma, session);

    await expect(
      caller.generatePDF({ periodoId: 'period-1', tipo: 'por-docente', docenteId: 'docente-outside' })
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(prisma.docente.findMany).not.toHaveBeenCalled();
  });

  it('scopes porCiclo report queries for department roles by docente department', async () => {
    const session = makeSession('DIRECTOR_DEPARTAMENTO');
    const prisma = makePrisma({ session, managedDepartamentoId: 'dept-managed' });
    const caller = makeCaller(prisma, session);

    await caller.porCiclo({ periodoId: 'period-1' });

    expect(prisma.asignacion.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          periodoId: 'period-1',
          docente: { departamentoId: { in: ['dept-managed'] } },
        },
      })
    );
  });

  it('scopes management PDF reports for department roles instead of using institution-wide counts', async () => {
    const session = makeSession('SECRETARIA_DEPARTAMENTO');
    const prisma = makePrisma({ session, managedDepartamentoId: 'dept-managed' });
    const caller = makeCaller(prisma, session);

    await caller.generatePDF({ periodoId: 'period-1', tipo: 'gestion' });

    expect(prisma.docente.count).toHaveBeenCalledWith({
      where: {
        activo: true,
        departamentoId: { in: ['dept-managed'] },
      },
    });
    expect(prisma.asignacion.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          periodoId: 'period-1',
          docente: { departamentoId: { in: ['dept-managed'] } },
        },
      })
    );
  });

  it('forbids guest roles from generating reports even for published periods', async () => {
    const session = makeSession('INVITADO');
    const prisma = makePrisma({ session });
    const caller = makeCaller(prisma, session);

    await expect(caller.generatePDF({ periodoId: 'period-1', tipo: 'por-docente' })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
    expect(prisma.docente.findMany).not.toHaveBeenCalled();
  });

  it('passes practice hours from scheduled assignments into docente reports', async () => {
    const session = makeSession('DOCENTE', 'docente-1');
    const prisma = makePrisma({ session });
    prisma.docente.findMany.mockResolvedValueOnce([
      {
        nombre: 'Ada Lovelace',
        codigo: 'DOC-1',
        tipo: 'NOMBRADO',
        categoria: 'PRINCIPAL',
        antiguedad: new Date('2020-01-01'),
        asignaciones: [
          {
            tipo: 'PRACTICA',
            grupo: {
              nombre: 'A',
              curso: {
                codigo: 'IS-101',
                nombre: 'Programming',
                ciclo: 1,
                horasTeoria: 2,
                horasPractica: 3,
                horasLaboratorio: 1,
              },
            },
            aula: { codigo: 'A-101', nombre: 'Aula 101' },
            franjaHoraria: { dia: 'LUNES', horaInicio: '08:00' },
          },
        ],
      },
    ]);
    const caller = makeCaller(prisma, session);

    await caller.generatePDF({ periodoId: 'period-1', tipo: 'por-docente' });

    expect(vi.mocked(generateDocenteReportHTML)).toHaveBeenLastCalledWith(
      [
        expect.objectContaining({
          slots: [
            expect.objectContaining({
              tipo: 'PRACTICA',
              horasPractica: 3,
            }),
          ],
        }),
      ],
      '2026-I'
    );
    expect(prisma.log.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'docente-user',
        accion: 'REPORTE_PDF_GENERADO',
        entidad: 'ReportePDF',
        entidadId: expect.any(String),
        despues: expect.objectContaining({
          periodoId: 'period-1',
          tipo: 'por-docente',
          filename: 'reporte-por-docente.pdf',
          documentoHash: expect.any(String),
        }),
      }),
    });
  });
});
