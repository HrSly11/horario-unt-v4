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
  firmas = [
    { tipo: 'F01', firmanteRol: 'DOCENTE' },
    { tipo: 'F02', firmanteRol: 'DOCENTE' },
    { tipo: 'F03', firmanteRol: 'DOCENTE' },
  ] as any[],
  declaracionEstado = 'BORRADOR',
  categoriaDocente = 'PRINCIPAL',
  tipoDocente = 'NOMBRADO',
  modalidadDocente = 'TIEMPO_COMPLETO',
}: {
  session?: ReturnType<typeof makeSession>;
  lectiveHours?: number;
  nonLectiveHours?: number;
  contractHours?: number;
  latestSignatureVersion?: number | null;
  firmas?: any[];
  declaracionEstado?: string;
  categoriaDocente?: string;
  tipoDocente?: string;
  modalidadDocente?: string;
} = {}) {
  const declaracionCarga = {
    findUnique: vi.fn(async () => null),
    findUniqueOrThrow: vi.fn(async () => ({
      id: 'declaracion-1',
      docenteId: 'docente-1',
      periodoId: 'period-1',
      estado: declaracionEstado,
      docente: { departamentoId: 'dept-1' },
    })),
    update: vi.fn(async (args) => ({
      id: args.where.id,
      docenteId: 'docente-1',
      periodoId: 'period-1',
      docente: { departamentoId: 'dept-1' },
      ...args.data,
    })),
    create: vi.fn(async (args) => args),
  };
  const documentoFirmaDigital = {
    findFirst: vi.fn(async () => latestSignatureVersion === null ? null : { version: latestSignatureVersion }),
    findMany: vi.fn(async (args?: { where?: { firmanteRol?: string } }) => {
      const roleFilter = args?.where?.firmanteRol;
      if (roleFilter) {
        return firmas.filter((f) => f.firmanteRol === roleFilter);
      }
      return firmas;
    }),
    create: vi.fn(async (args) => args),
  };

  const user = {
    findUnique: vi.fn(async () => ({
      ...session,
      activo: true,
    })),
    findMany: vi.fn(async () => [{ id: 'user-1' }]),
  };
  const departamento = {
    findUnique: vi.fn(async () => ({ id: 'dept-1' })),
    findMany: vi.fn(async () => [{ id: 'dept-1' }]),
  };
  const notification = {
    create: vi.fn(async (args) => args),
    createMany: vi.fn(async (args) => args),
  };

  return {
    user,
    declaracionCarga,
    documentoFirmaDigital,
    cargoDocente: {
      findFirst: vi.fn(async () => null),
    },
    reglaCargaPorCargo: {
      findFirst: vi.fn(async () => null),
    },
    asignacionCargaLectiva: {
      findMany: vi.fn(async () => [{ horasAsignadas: lectiveHours }]),
    },
    cargaNoLectiva: {
      findMany: vi.fn(async () => [{ tipo: 'RESPONSABILIDAD_SOCIAL', horas: nonLectiveHours, descripcion: 'Evidencia' }]),
    },
    docente: {
      findUniqueOrThrow: vi.fn(async () => ({
        id: 'docente-1',
        categoria: categoriaDocente,
        tipo: tipoDocente,
        modalidad: modalidadDocente,
        horasContrato: contractHours,
      })),
    },
    departamento,
    log: {
      create: vi.fn(async (args) => args),
    },
    publicacionAcademica: {
      findUnique: vi.fn(async () => null),
      create: vi.fn(async (args) => ({ id: 'pub-1', ...args.data })),
      findFirst: vi.fn(async () => null),
    },
    asignacion: {
      findMany: vi.fn(async () => []),
    },
    notification,
    $transaction: vi.fn(async (callback) => callback({
      declaracionCarga,
      documentoFirmaDigital,
      publicacionAcademica: {
        findUnique: vi.fn(async () => null),
        create: vi.fn(async (args) => ({ id: 'pub-1', ...args.data })),
        findFirst: vi.fn(async () => null),
      },
      asignacion: {
        findMany: vi.fn(async () => []),
      },
      departamento,
      user,
      notification,
    })),
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
      where: { declaracionId: 'declaracion-1', tipo: 'DECLARACION_JURADA', firmanteRol: 'DOCENTE' },
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

describe('declaracionRouter F01-F03 multi-role approvals and signatures', () => {
  const teacherSignatures = [
    { tipo: 'F01', firmanteRol: 'DOCENTE' },
    { tipo: 'F02', firmanteRol: 'DOCENTE' },
    { tipo: 'F03', firmanteRol: 'DOCENTE' },
  ];

  const deptoSignatures = [
    ...teacherSignatures,
    { tipo: 'F01', firmanteRol: 'JEFE' },
    { tipo: 'F02', firmanteRol: 'JEFE' },
    { tipo: 'F03', firmanteRol: 'JEFE' },
  ];

  const deanSignatures = [
    ...deptoSignatures,
    { tipo: 'F01', firmanteRol: 'DECANO' },
    { tipo: 'F02', firmanteRol: 'DECANO' },
    { tipo: 'F03', firmanteRol: 'DECANO' },
  ];

  it('enviar: fails if teacher has not signed F01, F02, and F03', async () => {
    const session = makeSession('DOCENTE', 'docente-1');
    const prisma = makePrisma({
      session,
      lectiveHours: 30,
      nonLectiveHours: 10,
      contractHours: 40,
      firmas: [{ tipo: 'F01', firmanteRol: 'DOCENTE' }], // only 1 signed
    });
    const caller = makeCaller(prisma, session);

    await expect(caller.enviar({ id: 'declaracion-1' })).rejects.toMatchObject({
      code: 'BAD_REQUEST',
      message: expect.stringContaining('Debe firmar digitalmente los formatos F01, F02 y F03'),
    });
  });

  it('enviar: passes if teacher has signed all three', async () => {
    const session = makeSession('DOCENTE', 'docente-1');
    const prisma = makePrisma({
      session,
      lectiveHours: 30,
      nonLectiveHours: 10,
      contractHours: 40,
      firmas: teacherSignatures,
    });
    const caller = makeCaller(prisma, session);

    const res = await caller.enviar({ id: 'declaracion-1' });
    expect(res.estado).toBe('ENVIADA');
  });

  it('aprobarDepto: fails if department head has not signed F01, F02, and F03', async () => {
    const session = makeSession('DIRECTOR_DEPARTAMENTO');
    const prisma = makePrisma({
      session,
      declaracionEstado: 'ENVIADA',
      firmas: teacherSignatures, // jefe signatures missing
    });
    const caller = makeCaller(prisma, session);

    await expect(caller.aprobarDepto({ id: 'declaracion-1' })).rejects.toMatchObject({
      code: 'BAD_REQUEST',
      message: expect.stringContaining('Debe firmar digitalmente los formatos F01, F02 y F03 de aprobación'),
    });
  });

  it('aprobarDepto: passes if department head has signed all three', async () => {
    const session = makeSession('DIRECTOR_DEPARTAMENTO');
    const prisma = makePrisma({
      session,
      declaracionEstado: 'ENVIADA',
      firmas: deptoSignatures,
    });
    const caller = makeCaller(prisma, session);

    const res = await caller.aprobarDepto({ id: 'declaracion-1' });
    expect(res.estado).toBe('APROBADA_DEPARTAMENTO');
  });

  it('vbDecano: fails if dean has not signed F01, F02, and F03', async () => {
    const session = makeSession('DECANO');
    const prisma = makePrisma({
      session,
      declaracionEstado: 'APROBADA_DEPARTAMENTO',
      firmas: deptoSignatures, // decano signatures missing
    });
    const caller = makeCaller(prisma, session);

    await expect(caller.vbDecano({ id: 'declaracion-1' })).rejects.toMatchObject({
      code: 'BAD_REQUEST',
      message: expect.stringContaining('Debe firmar digitalmente los formatos F01, F02 y F03 de visto bueno'),
    });
  });

  it('vbDecano: passes if dean has signed all three and transitions directly from department approval', async () => {
    const session = makeSession('DECANO');
    const prisma = makePrisma({
      session,
      declaracionEstado: 'APROBADA_DEPARTAMENTO',
      firmas: deanSignatures,
    });
    const caller = makeCaller(prisma, session);

    const res = await caller.vbDecano({ id: 'declaracion-1' });
    expect(res.estado).toBe('FINALIZADA');
  });

  it('rechazar: dean can reject back to department, transitioning to OBSERVADA', async () => {
    const session = makeSession('DECANO');
    const prisma = makePrisma({
      session,
      declaracionEstado: 'APROBADA_DEPARTAMENTO',
    });
    const caller = makeCaller(prisma, session);

    const res = await caller.rechazar({
      id: 'declaracion-1',
      observaciones: 'Rechazado por el decano debido a inconsistencia',
    });

    expect(res.estado).toBe('OBSERVADA');
  });
});

describe('declaracionRouter publishFinal and freezing', () => {
  const teacherSignatures = [
    { tipo: 'F01', firmanteRol: 'DOCENTE' },
    { tipo: 'F02', firmanteRol: 'DOCENTE' },
    { tipo: 'F03', firmanteRol: 'DOCENTE' },
  ];
  const deptoSignatures = [
    ...teacherSignatures,
    { tipo: 'F01', firmanteRol: 'JEFE' },
    { tipo: 'F02', firmanteRol: 'JEFE' },
    { tipo: 'F03', firmanteRol: 'JEFE' },
  ];
  const deanSignatures = [
    ...deptoSignatures,
    { tipo: 'F01', firmanteRol: 'DECANO' },
    { tipo: 'F02', firmanteRol: 'DECANO' },
    { tipo: 'F03', firmanteRol: 'DECANO' },
  ];

  it('publishFinal: fails if user is not DECANO', async () => {
    const session = makeSession('DOCENTE');
    const prisma = makePrisma({ session });
    const caller = makeCaller(prisma, session);

    await expect(caller.publishFinal({ facultadId: 'facultad-1', periodoId: 'period-1' })).rejects.toThrow();
  });

  it('publishFinal: fails on premature finalization (missing declarations or not FINALIZADA)', async () => {
    const session = makeSession('DECANO');
    const prisma = makePrisma({ session });
    
    (prisma.declaracionCarga as any).findMany = vi.fn(async () => [
      {
        id: 'declaracion-1',
        estado: 'ENVIADA',
        docenteId: 'docente-1',
        periodoId: 'period-1',
        docente: { departamentoId: 'dept-1' },
      }
    ] as any);
    prisma.documentoFirmaDigital.findMany = vi.fn(async () => deanSignatures);

    const caller = makeCaller(prisma, session);
    await expect(
      caller.publishFinal({ facultadId: 'facultad-1', periodoId: 'period-1' })
    ).rejects.toThrowError('Premature finalization: all declarations must be finalized and signed.');
  });

  it('publishFinal: fails on premature finalization (missing signatures)', async () => {
    const session = makeSession('DECANO');
    const prisma = makePrisma({ session });
    
    (prisma.declaracionCarga as any).findMany = vi.fn(async () => [
      {
        id: 'declaracion-1',
        estado: 'FINALIZADA',
        docenteId: 'docente-1',
        periodoId: 'period-1',
        docente: { departamentoId: 'dept-1' },
      }
    ] as any);
    prisma.documentoFirmaDigital.findMany = vi.fn(async () => teacherSignatures);

    const caller = makeCaller(prisma, session);
    await expect(
      caller.publishFinal({ facultadId: 'facultad-1', periodoId: 'period-1' })
    ).rejects.toThrowError('Premature finalization: all declarations must be finalized and signed.');
  });

  it('publishFinal: succeeds if all declarations are finalized and have all 9 signatures', async () => {
    const session = makeSession('DECANO');
    const prisma = makePrisma({ session });

    (prisma.declaracionCarga as any).findMany = vi.fn(async () => [
      {
        id: 'declaracion-1',
        estado: 'FINALIZADA',
        docenteId: 'docente-1',
        periodoId: 'period-1',
        docente: { departamentoId: 'dept-1' },
      }
    ] as any);
    prisma.documentoFirmaDigital.findMany = vi.fn(async () => deanSignatures.map(s => ({ ...s, declaracionId: 'declaracion-1' })));
    
    const caller = makeCaller(prisma, session);
    const res = await caller.publishFinal({ facultadId: 'facultad-1', periodoId: 'period-1' });
    expect(res.id).toBe('pub-1');
  });

  it('mutations fail after final publication', async () => {
    const session = makeSession('DOCENTE');
    const prisma = makePrisma({ session });
    
    prisma.publicacionAcademica = {
      findUnique: vi.fn(async () => ({ id: 'pub-1', facultadId: 'facultad-1', periodoId: 'period-1', snapshot: {}, documentHashes: {} })),
      findFirst: vi.fn(async () => ({ id: 'pub-1', facultadId: 'facultad-1', periodoId: 'period-1', snapshot: {}, documentHashes: {} })),
    } as any;
    
    (prisma.declaracionCarga as any).findUnique = vi.fn(async () => ({
      id: 'declaracion-1',
      periodoId: 'period-1',
      docente: { departamento: { facultadId: 'facultad-1' } }
    })) as any;

    (prisma.docente as any).findUnique = vi.fn(async () => ({
      id: 'docente-1',
      departamento: { facultadId: 'facultad-1' }
    })) as any;
    (prisma.docente as any).findUniqueOrThrow = vi.fn(async () => ({
      id: 'docente-1',
      departamento: { facultadId: 'facultad-1' }
    })) as any;

    const caller = makeCaller(prisma, session);

    await expect(caller.enviar({ id: 'declaracion-1' })).rejects.toThrowError(
      'El periodo académico está congelado por publicación oficial final en esta facultad.'
    );
  });
});

