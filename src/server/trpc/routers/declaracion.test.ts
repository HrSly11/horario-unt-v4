import { describe, expect, it, vi } from 'vitest';
import { createCallerFactory } from '../init';
import { declaracionRouter } from './declaracion';

vi.mock('@/lib/prisma', () => ({ prisma: {} }));
vi.mock('@/lib/auth', () => ({ getSession: vi.fn() }));

type SessionRole = 'ADMIN' | 'DOCENTE' | 'DIRECTOR_DEPARTAMENTO' | 'DIRECTOR_ESCUELA' | 'DECANO';

function makeSession(role: SessionRole = 'DOCENTE', docenteId: string | undefined = 'docente-1') {
  return {
    id: `${role.toLowerCase()}-user`,
    email: `${role.toLowerCase()}@example.edu`,
    nombre: role,
    role,
    docenteId,
  };
}

function makeCaller(prisma: ReturnType<typeof makePrisma>, session = makeSession()) {
  const createCaller = createCallerFactory(declaracionRouter);
  return createCaller(async () => ({
    prisma: prisma as any,
    headers: new Headers(),
    session,
  }));
}

function makePrisma({
  session = makeSession(),
  lectiveHours = 20,
  nonLectiveHours = 10,
  contractHours = 40,
  latestSignatureVersion = null,
}: {
  session?: ReturnType<typeof makeSession>;
  lectiveHours?: number;
  nonLectiveHours?: number;
  contractHours?: number;
  latestSignatureVersion?: number | null;
} = {}) {
  const declaracionCarga = {
    findUnique: vi.fn(async () => null),
    findUniqueOrThrow: vi.fn(async () => ({
      id: 'declaracion-1',
      docenteId: 'docente-1',
      periodoId: 'period-1',
      estado: 'BORRADOR',
      docente: { departamentoId: 'dept-1' },
    })),
    update: vi.fn(async (args) => args),
    create: vi.fn(async (args) => args),
  };
  const documentoFirmaDigital = {
    findFirst: vi.fn(async () => latestSignatureVersion === null ? null : { version: latestSignatureVersion }),
    findMany: vi.fn(async () => []),
    create: vi.fn(async (args) => args),
  };

  return {
    user: {
      findUnique: vi.fn(async () => ({
        ...session,
        activo: true,
      })),
    },
    declaracionCarga,
    documentoFirmaDigital,
    asignacionCargaLectiva: {
      findMany: vi.fn(async () => [{ horasAsignadas: lectiveHours }]),
    },
    cargaNoLectiva: {
      findMany: vi.fn(async () => [{ horas: nonLectiveHours }]),
    },
    docente: {
      findUniqueOrThrow: vi.fn(async () => ({ horasContrato: contractHours })),
    },
    departamento: {
      findUnique: vi.fn(async () => ({ id: 'dept-1' })),
    },
    log: {
      create: vi.fn(async (args) => args),
    },
    $transaction: vi.fn(async (callback) => callback({ declaracionCarga, documentoFirmaDigital })),
  };
}

describe('declaracionRouter enviar workload contract', () => {
  it('rejects submission when lective plus non-lective workload is below the docente contract', async () => {
    const prisma = makePrisma({ lectiveHours: 20, nonLectiveHours: 10, contractHours: 40 });
    const caller = makeCaller(prisma);

    await expect(caller.enviar({ id: 'declaracion-1' })).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    });
    expect(prisma.declaracionCarga.update).not.toHaveBeenCalled();
  });

  it('allows submission when the workload exactly matches the docente contract', async () => {
    const prisma = makePrisma({ lectiveHours: 30, nonLectiveHours: 10, contractHours: 40 });
    const caller = makeCaller(prisma);

    await caller.enviar({ id: 'declaracion-1' });

    expect(prisma.declaracionCarga.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          totalHorasLectivas: 30,
          totalHorasNoLectivas: 10,
          totalHoras: 40,
        }),
      })
    );
  });
});

describe('declaracionRouter digital signatures', () => {
  const validSignature = {
    declaracionId: 'declaracion-1',
    tipo: 'DECLARACION_JURADA' as const,
    documentoHash: 'A'.repeat(64),
    certificadoSerial: 'CERT-001',
    certificadoEmisor: 'University CA',
    firmaPayload: 'signed-payload',
    cadenaCustodia: { ip: '127.0.0.1' },
  };

  it('records versioned signature evidence and updates the legacy declaration flag', async () => {
    const session = makeSession('DOCENTE', 'docente-1');
    const prisma = makePrisma({ session, latestSignatureVersion: 1 });
    const caller = makeCaller(prisma, session);

    await caller.registrarFirma(validSignature);

    expect(prisma.documentoFirmaDigital.findFirst).toHaveBeenCalledWith({
      where: { declaracionId: 'declaracion-1', tipo: 'DECLARACION_JURADA' },
      select: { version: true },
      orderBy: { version: 'desc' },
    });
    expect(prisma.documentoFirmaDigital.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          declaracionId: 'declaracion-1',
          tipo: 'DECLARACION_JURADA',
          documentoHash: 'a'.repeat(64),
          certificadoSerial: 'CERT-001',
          certificadoEmisor: 'University CA',
          firmaPayload: 'signed-payload',
          firmadoPorId: 'docente-user',
          version: 2,
        }),
      })
    );
    expect(prisma.declaracionCarga.update).toHaveBeenCalledWith({
      where: { id: 'declaracion-1' },
      data: { declaracionJuradaFirmada: true },
    });
    expect(prisma.log.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'docente-user',
        accion: 'FIRMA_DIGITAL_REGISTRADA',
        entidad: 'DocumentoFirmaDigital',
        despues: expect.objectContaining({
          declaracionId: 'declaracion-1',
          tipo: 'DECLARACION_JURADA',
          documentoHash: 'a'.repeat(64),
          version: 2,
        }),
      }),
    });
  });

  it('forbids docentes from signing approval evidence', async () => {
    const session = makeSession('DOCENTE', 'docente-1');
    const prisma = makePrisma({ session });
    const caller = makeCaller(prisma, session);

    await expect(
      caller.registrarFirma({ ...validSignature, tipo: 'APROBACION_DEPARTAMENTO' })
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(prisma.documentoFirmaDigital.create).not.toHaveBeenCalled();
  });

  it('lists signature evidence for a declaration the user can access', async () => {
    const session = makeSession('DOCENTE', 'docente-1');
    const prisma = makePrisma({ session });
    const caller = makeCaller(prisma, session);

    await caller.firmas({ declaracionId: 'declaracion-1' });

    expect(prisma.documentoFirmaDigital.findMany).toHaveBeenCalledWith({
      where: { declaracionId: 'declaracion-1' },
      include: {
        firmadoPor: { select: { id: true, nombre: true, role: true } },
      },
      orderBy: [
        { tipo: 'asc' },
        { version: 'desc' },
      ],
    });
  });
});
