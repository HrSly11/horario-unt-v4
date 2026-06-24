# Especificación: Asignación de Carga Lectiva

## Propósito

Secretaria/Director de Departamento asigna cursos a docentes por periodo. Soporta cursos compartidos (2 docentes) y splits Teoría/Práctica/Laboratorio.

## Requirements

### REQ-CL-001: Asignar Curso a Docente
El sistema DEBE permitir a SECRETARIA_DEPARTAMENTO y DIRECTOR_DEPARTAMENTO asignar un grupo a un docente con tipo `TEORIA`, `PRACTICA` o `LABORATORIO` y horas asignadas.

| Actor | SECRETARIA_DEPARTAMENTO, DIRECTOR_DEPARTAMENTO |
|-------|-------|
| Unique | `@@unique([docenteId, grupoId, periodoId, tipo])` |

**Happy Path: Asignación simple**
- GIVEN periodo activo, grupo "ISI-101-A", docente "Juan Pérez"
- WHEN secretaria asigna TEORIA con 4 horas
- THEN `AsignacionCargaLectiva` persiste con `compartido: false`

**Edge Case: Asignación duplicada**
- GIVEN docente ya tiene TEORIA en grupo X para periodo activo
- WHEN secretaria asigna nuevamente TEORIA en mismo grupo+periodo
- THEN sistema rechaza por violación de unique constraint

### REQ-CL-002: Curso Compartido (2 Docentes)
El sistema DEBE soportar cursos compartidos donde un docente recibe teoría+práctica y otro recibe laboratorio.

**Scenario: Split T/P + L**
- GIVEN grupo "ISI-201-B" requiere 2 docentes
- WHEN secretaria asigna docente A con TEORIA (compartido: true) y docente B con LABORATORIO
- THEN ambos registros comparten `grupoId` + `periodoId`, con `docenteCompartidoId` recíproco

**Edge Case: Tercer docente en curso compartido**
- GIVEN grupo ya tiene 2 docentes asignados (compartido)
- WHEN secretaria intenta asignar un tercero
- THEN sistema DEBE rechazar — máximo 2 docentes por grupo compartido

### REQ-CL-003: Tipos de Asignación
El sistema DEBE soportar tipos `TEORIA`, `PRACTICA`, `LABORATORIO` con horas independientes. Docente PUEDE tener múltiples tipos en mismo grupo.

**Scenario: Docente con teoría + práctica en mismo grupo**
- GIVEN docente asignado a TEORIA en grupo X
- WHEN secretaria asigna PRACTICA en mismo grupo
- THEN ambas asignaciones persisten (unique constraint cubre tipo diferente)

### REQ-CL-004: Validación de Horas Asignadas
El sistema DEBE validar que `horasAsignadas` sea positivo y no exceda las horas totales del curso.

**Scenario: Horas exceden curso**
- GIVEN curso "ISI-101" tiene 4 horas teóricas totales
- WHEN secretaria asigna 6 horas de TEORIA
- THEN sistema rechaza con error de validación

### REQ-CL-005: Filtro por Departamento y Periodo
El sistema DEBE permitir filtrar carga lectiva por departamento y periodo académico.

### REQ-CL-006: Sección de Grupo
El sistema DEBE incluir campo `seccion` (String?) en Grupo para identificar secciones ("A", "B").

### REQ-CL-007: Listado de Carga por Docente
El sistema DEBE mostrar para cada docente del departamento el total de horas lectivas asignadas vs horas contrato.
