import { describe, expect, it, vi } from 'vitest';
import { HelpAssistantService } from './help-assistant';
import type { AvailabilityService } from './availability/availability.service';

describe('HelpAssistantService', () => {
  it('executes the laboratory availability tool and returns grounded schedule data', async () => {
    const availability = {
      findAvailableLaboratories: vi.fn(async () => ({
        periodName: '2026-I',
        day: 'MARTES' as const,
        startTime: '15:00',
        endTime: '18:00',
        laboratories: [
          {
            code: 'LAB-1',
            name: 'Laboratorio 1',
            capacity: 16,
            building: 'Pabellon C',
            floor: 1,
          },
          {
            code: 'LAB-3',
            name: 'Laboratorio 3',
            capacity: 16,
            building: 'Pabellon C',
            floor: 2,
          },
        ],
      })),
    };
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        output: [
          {
            type: 'function_call',
            name: 'find_available_laboratories',
            arguments: JSON.stringify({
              day: 'MARTES',
              startTime: '15:00',
              endTime: '18:00',
            }),
          },
        ],
      }),
    }));
    const fetchImpl = fetchMock as unknown as typeof fetch;
    const service = new HelpAssistantService(availability as unknown as AvailabilityService, {
      apiKey: 'test-key',
      fetchImpl,
    });

    const result = await service.answer('Que laboratorios estan libres el martes de 3 a 6 p.m.?');

    expect(availability.findAvailableLaboratories).toHaveBeenCalledWith({
      day: 'MARTES',
      startTime: '15:00',
      endTime: '18:00',
    });
    expect(result.answer).toContain('LAB-1 (Laboratorio 1)');
    expect(result.answer).toContain('LAB-3 (Laboratorio 3)');
    expect(result.source).toBe('schedule');
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.openai.com/v1/responses',
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer test-key' }),
      })
    );
    const request = (fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1];
    const requestBody = JSON.parse(String(request.body)) as { tool_choice: unknown };
    expect(requestBody.tool_choice).toEqual({
      type: 'function',
      name: 'find_available_laboratories',
    });
  });

  it('returns regular OpenAI help text when no system tool is required', async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        output: [
          {
            type: 'message',
            content: [{ type: 'output_text', text: 'Puedes revisar tus clases en Horario Personal.' }],
          },
        ],
      }),
    })) as unknown as typeof fetch;
    const service = new HelpAssistantService({} as unknown as AvailabilityService, {
      apiKey: 'test-key',
      fetchImpl,
    });

    const result = await service.answer('Donde veo mi horario?');

    expect(result).toEqual({
      answer: 'Puedes revisar tus clases en Horario Personal.',
      source: 'openai',
    });
  });

  it('fails with a clear configuration error when the API key is missing', async () => {
    const service = new HelpAssistantService({} as unknown as AvailabilityService, {
      apiKey: '',
      fetchImpl: vi.fn() as unknown as typeof fetch,
    });

    await expect(service.answer('Hola')).rejects.toThrow('OPENAI_API_KEY');
  });

  it('executes the class schedule query tool and queries database with parameters', async () => {
    const mockPrisma = {
      periodoAcademico: {
        findFirst: vi.fn(async () => ({ id: 'period-1', nombre: '2026-I' })),
      },
      asignacion: {
        findMany: vi.fn(async () => [
          {
            docente: { nombre: 'Juan Santos' },
            aula: { codigo: 'EPG-303', nombre: 'Aula 303' },
            franjaHoraria: { dia: 'LUNES', horaInicio: '07:00', horaFin: '10:00' },
            grupo: {
              nombre: 'A',
              curso: { nombre: 'Tesis I', codigo: 'EI-901' },
            },
          },
        ]),
      },
    };

    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        output: [
          {
            type: 'function_call',
            name: 'find_class_schedule',
            arguments: JSON.stringify({
              teacherName: 'Santos',
              courseQuery: 'tesis 1',
              classroomCode: null,
            }),
          },
        ],
      }),
    }));

    const service = new HelpAssistantService({} as unknown as AvailabilityService, {
      apiKey: 'test-key',
      fetchImpl: fetchMock as unknown as typeof fetch,
      prisma: mockPrisma,
    });

    const result = await service.answer('Qué día tiene clase el profesor Santos de tesis 1?');

    expect(mockPrisma.periodoAcademico.findFirst).toHaveBeenCalled();
    expect(mockPrisma.asignacion.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          periodoId: 'period-1',
          docente: {
            nombre: {
              contains: 'Santos',
              mode: 'insensitive',
            },
          },
          grupo: {
            curso: {
              OR: [
                { nombre: { contains: 'tesis 1', mode: 'insensitive' } },
                { nombre: { contains: 'tesis I', mode: 'insensitive' } },
                { codigo: { contains: 'tesis 1', mode: 'insensitive' } },
                { codigo: { contains: 'tesis I', mode: 'insensitive' } },
              ],
            },
          },
        }),
      })
    );
    expect(result.answer).toContain('Curso: Tesis I (EI-901, Grupo A)\nDocente: Juan Santos\n  • Lunes de 07:00 a 10:00 en EPG-303 (Aula 303)');
    expect(result.source).toBe('schedule');
  });
});
