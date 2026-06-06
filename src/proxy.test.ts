import { NextRequest } from 'next/server';
import { getRedirectUrl } from 'next/experimental/testing/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { decrypt } from './lib/auth';
import { proxy } from './proxy';

vi.mock('./lib/auth', () => ({ decrypt: vi.fn() }));

const decryptMock = vi.mocked(decrypt);

function makeRequest(path: string, sessionCookie?: string) {
  return new NextRequest(new URL(path, 'https://horarios.test'), {
    headers: sessionCookie ? { cookie: `session=${sessionCookie}` } : undefined,
  });
}

describe('proxy route protection matrix', () => {
  beforeEach(() => {
    decryptMock.mockReset();
  });

  it('protects disponibilidad and restricts it to docentes', async () => {
    const anonymousResponse = await proxy(makeRequest('/disponibilidad'));
    expect(getRedirectUrl(anonymousResponse)).toBe('https://horarios.test/login');

    decryptMock.mockResolvedValueOnce({ role: 'ADMIN' });
    const adminResponse = await proxy(makeRequest('/disponibilidad', 'admin-session'));
    expect(getRedirectUrl(adminResponse)).toBe('https://horarios.test/');

    decryptMock.mockResolvedValueOnce({ role: 'DOCENTE' });
    const docenteResponse = await proxy(makeRequest('/disponibilidad', 'docente-session'));
    expect(getRedirectUrl(docenteResponse)).toBeNull();
  });

  it('restricts docentes to staff roles that can access teacher data', async () => {
    decryptMock.mockResolvedValueOnce({ role: 'INVITADO' });
    const guestResponse = await proxy(makeRequest('/docentes', 'guest-session'));
    expect(getRedirectUrl(guestResponse)).toBe('https://horarios.test/');

    decryptMock.mockResolvedValueOnce({ role: 'DIRECTOR_DEPARTAMENTO' });
    const departmentDirectorResponse = await proxy(makeRequest('/docentes', 'director-session'));
    expect(getRedirectUrl(departmentDirectorResponse)).toBeNull();
  });

  it('declares horarios role access explicitly instead of falling through unrestricted', async () => {
    decryptMock.mockResolvedValueOnce({ role: 'ESTUDIANTE' });
    const studentResponse = await proxy(makeRequest('/horarios', 'student-session'));
    expect(getRedirectUrl(studentResponse)).toBe('https://horarios.test/');

    decryptMock.mockResolvedValueOnce({ role: 'INVITADO' });
    const guestResponse = await proxy(makeRequest('/horarios', 'guest-session'));
    expect(getRedirectUrl(guestResponse)).toBeNull();
  });
});
