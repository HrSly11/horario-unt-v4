import { randomUUID } from 'node:crypto';
import type { Prisma, PrismaClient } from '@/generated/prisma/client';

type AuditPrisma = Pick<PrismaClient, 'log'>;

type AuditSession = {
  id: string;
} | null | undefined;

export interface AuditLogInput {
  session?: AuditSession;
  headers?: Headers;
  accion: string;
  entidad?: string;
  entidadId?: string;
  detalles?: string;
  antes?: unknown;
  despues?: unknown;
  motivo?: string;
  correlationId?: string;
}

function toJson(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined || value === null) return undefined;
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function getHeader(headers: Headers | undefined, name: string) {
  const value = headers?.get(name);
  return value && value.trim().length > 0 ? value : undefined;
}

export function getAuditMeta(headers?: Headers) {
  const forwardedFor = getHeader(headers, 'x-forwarded-for');
  return {
    ip: forwardedFor?.split(',')[0]?.trim() ?? getHeader(headers, 'x-real-ip'),
    userAgent: getHeader(headers, 'user-agent'),
    correlationId: getHeader(headers, 'x-correlation-id') ?? getHeader(headers, 'x-request-id') ?? randomUUID(),
  };
}

export async function writeAuditLog(prisma: AuditPrisma, input: AuditLogInput) {
  const meta = getAuditMeta(input.headers);

  return prisma.log.create({
    data: {
      userId: input.session?.id,
      accion: input.accion,
      entidad: input.entidad,
      entidadId: input.entidadId,
      detalles: input.detalles,
      antes: toJson(input.antes),
      despues: toJson(input.despues),
      motivo: input.motivo,
      ip: meta.ip,
      userAgent: meta.userAgent,
      correlationId: input.correlationId ?? meta.correlationId,
    },
  });
}
