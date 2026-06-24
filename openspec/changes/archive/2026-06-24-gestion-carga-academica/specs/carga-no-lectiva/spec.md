# Especificación: Registro de Carga No Lectiva

## Propósito

Docente registra actividades no lectivas (9 tipos) para completar su carga horaria total. Sistema auto-calcula límites y muestra totales en tiempo real.

## Requirements

### REQ-CNL-001: Registro de Actividad No Lectiva
El sistema DEBE permitir al DOCENTE registrar actividades con tipo, horas dedicadas, y descripción.

| Actor | DOCENTE |
|-------|-------|
| FK | docenteId, periodoId |

**Tipos**: `PREPARACION_EVALUACION`, `CONSEJERIA`, `INVESTIGACION`, `CAPACITACION`, `GOBIERNO`, `ADMINISTRACION`, `ASESORIA_TESIS`, `RESPONSABILIDAD_SOCIAL`, `COMITES_COMISIONES`

**Happy Path: Registrar investigación**
- GIVEN docente autenticado, periodo activo
- WHEN registra 10h de INVESTIGACION con código proyecto "PIC-2026-001"
- THEN `CargaNoLectiva` persiste con campos específicos

### REQ-CNL-002: Auto-cálculo de Preparación y Evaluación
El sistema DEBE limitar `PREPARACION_EVALUACION` a máximo 50% de horas lectivas asignadas. Cálculo DEBE ser automático y visible.

**Scenario: Preparación dentro del límite**
- GIVEN docente tiene 20h lectivas
- WHEN sistema auto-calcula preparación
- THEN máximo permitido es 10h (50%)

**Edge Case: Exceder límite de preparación**
- GIVEN docente tiene 20h lectivas (máx 10h preparación)
- WHEN intenta registrar 12h de PREPARACION_EVALUACION
- THEN sistema rechaza — excede 50%

### REQ-CNL-003: Campos Condicionales por Tipo
El sistema DEBE mostrar campos específicos según tipo de actividad.

| Tipo | Campos Adicionales |
|------|-------------------|
| INVESTIGACION | `codigoProyecto` |
| ASESORIA_TESIS | `numAlumnos`, `ciclo` |
| CAPACITACION | `codigoProyecto` |
| RESPONSABILIDAD_SOCIAL | `codigoProyecto` |

**Scenario: Mostrar campos de tesis**
- GIVEN docente selecciona tipo ASESORIA_TESIS
- WHEN formulario se renderiza
- THEN campos `numAlumnos` y `ciclo` son visibles y requeridos

### REQ-CNL-004: Totalización en Tiempo Real
El sistema DEBE mostrar total lectivas + no lectivas y comparar con horas contrato.

**Scenario: Total iguala contrato**
- GIVEN docente TC con 40h contrato, 25h lectivas, 15h no lectivas
- WHEN visualiza su carga
- THEN indicador muestra "Carga completa: 40/40h" en verde

**Edge Case: Total excede contrato**
- GIVEN docente TC con 40h contrato
- WHEN total lectiva + no lectiva = 45h
- THEN sistema muestra advertencia y bloquea envío de declaración

### REQ-CNL-005: Edición y Eliminación
El sistema DEBE permitir al docente editar o eliminar sus registros de carga no lectiva mientras la declaración esté en estado BORRADOR.

### REQ-CNL-006: Dedicación Exclusiva
El sistema DEBE validar que docentes con modalidad `DEDICACION_EXCLUSIVA` tengan `dictaOtraUniversidad: false`. Si es true, DEBE rechazar el registro.

### REQ-CNL-007: Listado por Periodo
El sistema DEBE mostrar carga no lectiva filtrada por periodo académico, agrupada por tipo.
