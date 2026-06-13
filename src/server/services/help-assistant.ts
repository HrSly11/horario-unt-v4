import { z } from 'zod';
import type { AvailabilityService, LaboratorySearchResult } from './availability/availability.service';

const DEFAULT_OPENAI_MODEL = 'gpt-5.4-mini';

const laboratorySearchSchema = z.object({
  day: z.enum(['LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO']),
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
});

const SYSTEM_INSTRUCTIONS = `Eres el asistente de ayuda del Sistema de Horarios ISI de la UNT.
Responde siempre en espanol, de forma breve, atenta y clara.

El sistema incluye estas secciones, segun el rol del usuario: Dashboard, Organizacion,
Docentes, Cursos, Aulas, Periodos, Carga Lectiva, Carga No Lectiva, Declaraciones,
Horario Personal, Formatos, Horarios, Reportes, Asignacion, Disponibilidad,
Gestion de Usuarios y Bitacora.

Reglas:
- Para cualquier pregunta sobre laboratorios libres o disponibles, debes llamar a
  find_available_laboratories. Convierte horas de 12 horas a formato HH:mm de 24 horas.
- Para cualquier pregunta sobre horarios de clases, que dias dicta un profesor, que cursos dicta,
  donde dicta, que se dicta en un aula, etc., debes llamar a find_class_schedule.
- Nunca inventes horarios, aulas, disponibilidad ni datos almacenados en el sistema.
- Si piden otros datos dinamicos para los que no existe una funcion, explica que esa
  consulta aun no esta habilitada en el asistente y orienta a la seccion correspondiente.
- No afirmes que una operacion fue realizada; este asistente solo orienta y consulta.`;

interface OpenAIMessageOutput {
  type: 'message';
  content?: Array<{ type: string; text?: string }>;
}

interface OpenAIFunctionOutput {
  type: 'function_call';
  name: string;
  arguments: string;
}

interface OpenAIResponse {
  output?: Array<OpenAIMessageOutput | OpenAIFunctionOutput | { type: string }>;
}

export interface HelpAssistantHistoryMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface HelpAssistantAnswer {
  answer: string;
  source: 'openai' | 'schedule';
  schedule?: LaboratorySearchResult;
}

export interface HelpAssistantOptions {
  apiKey?: string;
  model?: string;
  fetchImpl?: typeof fetch;
  prisma?: any;
}

const DAY_LABELS: Record<string, string> = {
  LUNES: 'lunes',
  MARTES: 'martes',
  MIERCOLES: 'miercoles',
  JUEVES: 'jueves',
  VIERNES: 'viernes',
  SABADO: 'sabado',
};

function formatLaboratoryAnswer(result: LaboratorySearchResult) {
  const interval = `${DAY_LABELS[result.day] ?? result.day.toLowerCase()} de ${result.startTime} a ${result.endTime}`;

  if (result.laboratories.length === 0) {
    return `No hay laboratorios libres el ${interval} en el periodo ${result.periodName}.`;
  }

  const laboratoryList = result.laboratories
    .map((laboratory) => `${laboratory.code} (${laboratory.name})`)
    .join(', ');

  return `Los laboratorios libres el ${interval} en el periodo ${result.periodName} son: ${laboratoryList}.`;
}

function extractText(response: OpenAIResponse) {
  return (response.output ?? [])
    .filter((item): item is OpenAIMessageOutput => item.type === 'message')
    .flatMap((item) => item.content ?? [])
    .filter((content) => content.type === 'output_text' && content.text)
    .map((content) => content.text)
    .join('\n')
    .trim();
}

export class HelpAssistantService {
  private readonly fetchImpl: typeof fetch;
  private readonly prisma: any;

  constructor(
    private readonly availabilityService: AvailabilityService,
    private readonly options: HelpAssistantOptions = {}
  ) {
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.prisma = options.prisma ?? (availabilityService as any).prisma;
  }

  private normalizeQuery(q: string): string {
    return q
      .replace(/\b1\b/g, 'I')
      .replace(/\b2\b/g, 'II')
      .replace(/\b3\b/g, 'III')
      .replace(/\b4\b/g, 'IV')
      .replace(/\b5\b/g, 'V')
      .replace(/\b6\b/g, 'VI')
      .replace(/\b7\b/g, 'VII')
      .replace(/\b8\b/g, 'VIII')
      .replace(/\b9\b/g, 'IX')
      .replace(/\b10\b/g, 'X');
  }

  private async findClassSchedule(args: {
    teacherName?: string | null;
    courseQuery?: string | null;
    classroomCode?: string | null;
  }): Promise<string> {
    if (!this.prisma) {
      throw new Error('El cliente de base de datos Prisma no está disponible en HelpAssistantService');
    }

    const { teacherName, courseQuery, classroomCode } = args;

    const period = await this.prisma.periodoAcademico.findFirst({
      where: { activo: true },
    });

    if (!period) {
      return 'No hay un período académico activo en este momento.';
    }

    const whereClause: any = {
      periodoId: period.id,
    };

    if (teacherName && teacherName.trim()) {
      whereClause.docente = {
        nombre: {
          contains: teacherName.trim(),
          mode: 'insensitive',
        },
      };
    }

    if (courseQuery && courseQuery.trim()) {
      const trimmedQuery = courseQuery.trim();
      const normalizedQuery = this.normalizeQuery(trimmedQuery);
      whereClause.grupo = {
        curso: {
          OR: [
            { nombre: { contains: trimmedQuery, mode: 'insensitive' } },
            { nombre: { contains: normalizedQuery, mode: 'insensitive' } },
            { codigo: { contains: trimmedQuery, mode: 'insensitive' } },
            { codigo: { contains: normalizedQuery, mode: 'insensitive' } },
          ],
        },
      };
    }

    if (classroomCode && classroomCode.trim()) {
      whereClause.aula = {
        codigo: {
          contains: classroomCode.trim(),
          mode: 'insensitive',
        },
      };
    }

    const assignments = await this.prisma.asignacion.findMany({
      where: whereClause,
      include: {
        docente: true,
        aula: true,
        franjaHoraria: true,
        grupo: {
          include: {
            curso: true,
          },
        },
      },
    });

    if (assignments.length === 0) {
      return `No encontré ninguna clase asignada en el periodo ${period.nombre} con los filtros especificados.`;
    }

    // 1. Group assignments by course + group + docente
    interface GroupKey {
      courseName: string;
      courseCode: string;
      groupName: string;
      docenteNombre: string;
    }

    const groupsMap = new Map<string, { key: GroupKey; slots: any[] }>();

    for (const a of assignments) {
      const keyStr = `${a.grupo.curso.codigo}-${a.grupo.nombre}-${a.docente.id}`;
      if (!groupsMap.has(keyStr)) {
        groupsMap.set(keyStr, {
          key: {
            courseName: a.grupo.curso.nombre,
            courseCode: a.grupo.curso.codigo,
            groupName: a.grupo.nombre,
            docenteNombre: a.docente.nombre,
          },
          slots: [],
        });
      }
      groupsMap.get(keyStr)!.slots.push(a);
    }

    // 2. Sort days order
    const dayOrder: Record<string, number> = {
      LUNES: 1,
      MARTES: 2,
      MIERCOLES: 3,
      JUEVES: 4,
      VIERNES: 5,
      SABADO: 6,
    };

    const dayMap: Record<string, string> = {
      LUNES: 'Lunes',
      MARTES: 'Martes',
      MIERCOLES: 'Miércoles',
      JUEVES: 'Jueves',
      VIERNES: 'Viernes',
      SABADO: 'Sábado',
    };

    const formattedGroups: string[] = [];

    for (const [_, groupData] of groupsMap) {
      const { key, slots } = groupData;
      
      // Sort slots by day and then start time
      const sortedSlots = slots.sort((a, b) => {
        const orderA = dayOrder[a.franjaHoraria.dia] ?? 99;
        const orderB = dayOrder[b.franjaHoraria.dia] ?? 99;
        if (orderA !== orderB) return orderA - orderB;
        return a.franjaHoraria.horaInicio.localeCompare(b.franjaHoraria.horaInicio);
      });

      // Merge contiguous slots in the same day and classroom
      const mergedSlots: Array<{
        dia: string;
        horaInicio: string;
        horaFin: string;
        aulaCodigo: string;
        aulaNombre: string;
      }> = [];

      for (const slot of sortedSlots) {
        const prev = mergedSlots[mergedSlots.length - 1];
        if (
          prev &&
          prev.dia === slot.franjaHoraria.dia &&
          prev.aulaCodigo === slot.aula.codigo &&
          prev.horaFin === slot.franjaHoraria.horaInicio
        ) {
          prev.horaFin = slot.franjaHoraria.horaFin;
        } else {
          mergedSlots.push({
            dia: slot.franjaHoraria.dia,
            horaInicio: slot.franjaHoraria.horaInicio,
            horaFin: slot.franjaHoraria.horaFin,
            aulaCodigo: slot.aula.codigo,
            aulaNombre: slot.aula.nombre,
          });
        }
      }

      // Format the schedule lines for this course group
      const scheduleLines = mergedSlots.map(s => {
        const diaStr = dayMap[s.dia] ?? s.dia;
        return `  • ${diaStr} de ${s.horaInicio} a ${s.horaFin} en ${s.aulaCodigo} (${s.aulaNombre})`;
      }).join('\n');

      formattedGroups.push(
        `Curso: ${key.courseName} (${key.courseCode}, Grupo ${key.groupName})\n` +
        `Docente: ${key.docenteNombre}\n` +
        `${scheduleLines}`
      );
    }

    return `Horarios encontrados en el periodo ${period.nombre}:\n\n` + formattedGroups.join('\n\n');
  }

  async answer(
    message: string,
    history: HelpAssistantHistoryMessage[] = []
  ): Promise<HelpAssistantAnswer> {
    const apiKey = this.options.apiKey ?? process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('Falta configurar OPENAI_API_KEY en el servidor');
    }

    const requiresLaboratoryTool = /\blaboratorios?\b/i.test(message)
      && /\b(libres?|disponibles?|disponibilidad)\b/i.test(message);

    const response = await this.fetchImpl('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: this.options.model ?? process.env.OPENAI_MODEL ?? DEFAULT_OPENAI_MODEL,
        instructions: SYSTEM_INSTRUCTIONS,
        input: [
          ...history.map((item) => ({ role: item.role, content: item.content })),
          { role: 'user', content: message },
        ],
        tools: [
          {
            type: 'function',
            name: 'find_available_laboratories',
            description: 'Busca laboratorios libres durante todo un intervalo del periodo academico activo.',
            strict: true,
            parameters: {
              type: 'object',
              properties: {
                day: {
                  type: 'string',
                  enum: ['LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO'],
                },
                startTime: {
                  type: 'string',
                  description: 'Hora inicial en formato HH:mm de 24 horas.',
                },
                endTime: {
                  type: 'string',
                  description: 'Hora final en formato HH:mm de 24 horas.',
                },
              },
              required: ['day', 'startTime', 'endTime'],
              additionalProperties: false,
            },
          },
          {
            type: 'function',
            name: 'find_class_schedule',
            description: 'Busca horarios de clases asignados en el periodo academico activo filtrando por docente, curso o aula. Deja los campos vacios o nulos si no aplican.',
            strict: true,
            parameters: {
              type: 'object',
              properties: {
                teacherName: {
                  type: ['string', 'null'],
                  description: 'Nombre o apellido del docente a buscar (por ejemplo, "Santos"). Nulo si no se especifica.',
                },
                courseQuery: {
                  type: ['string', 'null'],
                  description: 'Nombre o codigo del curso a buscar (por ejemplo, "tesis 1" o "EE-704"). Nulo si no se especifica.',
                },
                classroomCode: {
                  type: ['string', 'null'],
                  description: 'Codigo del aula o laboratorio (por ejemplo, "EPG-303"). Nulo si no se especifica.',
                },
              },
              required: ['teacherName', 'courseQuery', 'classroomCode'],
              additionalProperties: false,
            },
          },
        ],
        tool_choice: requiresLaboratoryTool
          ? { type: 'function', name: 'find_available_laboratories' }
          : 'auto',
        max_output_tokens: 400,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI no pudo responder (${response.status})`);
    }

    const data = await response.json() as OpenAIResponse;
    const functionCall = (data.output ?? []).find(
      (item): item is OpenAIFunctionOutput =>
        item.type === 'function_call' && 'name' in item
    );

    if (functionCall) {
      if (functionCall.name === 'find_available_laboratories') {
        const parsedArguments = laboratorySearchSchema.safeParse(JSON.parse(functionCall.arguments));
        if (!parsedArguments.success) {
          throw new Error('OpenAI devolvio parametros de horario invalidos');
        }

        const schedule = await this.availabilityService.findAvailableLaboratories(parsedArguments.data);
        return {
          answer: formatLaboratoryAnswer(schedule),
          source: 'schedule',
          schedule,
        };
      }

      if (functionCall.name === 'find_class_schedule') {
        const args = JSON.parse(functionCall.arguments);
        const scheduleResult = await this.findClassSchedule(args);
        return {
          answer: scheduleResult,
          source: 'schedule',
        };
      }
    }

    const text = extractText(data);
    if (!text) {
      throw new Error('OpenAI devolvio una respuesta vacia');
    }

    return { answer: text, source: 'openai' };
  }
}
