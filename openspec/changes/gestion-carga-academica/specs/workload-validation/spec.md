# Especificación: Validaciones de Negocio

## Propósito

Servicio central de validación de carga horaria: límites diarios/semanales, detección de cruces, verificación de totales y reglas de dedicación.

## Requirements

### REQ-WL-001: Límite Diario
El sistema DEBE rechazar cualquier asignación que resulte en más de 8 horas en un mismo día para un docente.

| Actor | Sistema (validación automática) |
|-------|-------|

**Happy Path: Dentro del límite**
- GIVEN docente tiene 6h asignadas el Lunes
- WHEN se asigna bloque adicional de 2h
- THEN validación acepta (total = 8h)

**Edge Case: Excede límite**
- GIVEN docente tiene 7h asignadas el Martes
- WHEN se intenta asignar bloque de 2h
- THEN sistema rechaza — "Excede 8h diarias (9h en Martes)"

### REQ-WL-002: Límite Semanal
El sistema DEBE validar: TC y DE máximo 40h/semana, TP máximo según `horasContrato`.

**Scenario: TC con 40h exactas**
- GIVEN docente TC con 40h contrato, total lectiva+no lectiva = 40h
- WHEN valida carga semanal
- THEN validación pasa

**Edge Case: DE excede 40h**
- GIVEN docente DE intenta registrar 42h totales
- WHEN validación ejecuta
- THEN sistema rechaza — "Dedicación Exclusiva: máximo 40h semanales"

### REQ-WL-003: Sin Cruces de Horario
El sistema DEBE detectar solapamientos entre cualquier combinación de carga lectiva y no lectiva para un mismo docente.

**Scenario: Solapamiento lectiva vs no lectiva**
- GIVEN docente tiene TEORIA Lun 8-10am
- WHEN intenta asignar INVESTIGACION Lun 9-11am
- THEN sistema detecta cruce 9-10am y rechaza

### REQ-WL-004: Total Lectiva + No Lectiva = Horas Contrato
El sistema DEBE validar que la suma de horas lectivas y no lectivas coincida exactamente con `docente.horasContrato` al momento de enviar declaración.

**Scenario: Totales coinciden**
- GIVEN docente TC: 25h lectivas + 15h no lectivas = 40h contrato
- WHEN envía declaración
- THEN validación pasa

**Edge Case: Totales no coinciden**
- GIVEN docente TC: 20h lectivas + 15h no lectivas = 35h vs 40h contrato
- WHEN intenta enviar declaración
- THEN sistema bloquea — "Faltan 5h para completar carga"

### REQ-WL-005: Preparación ≤ 50% Horas Lectivas
El sistema DEBE validar que horas de tipo `PREPARACION_EVALUACION` no excedan el 50% de horas lectivas totales del docente.

### REQ-WL-006: Dedicación Exclusiva — No Dicta en Otra Universidad
El sistema DEBE validar que docentes DE tengan `dictaOtraUniversidad: false`. Si es true, DEBE rechazar el envío de declaración.

### REQ-WL-007: Servicio Reutilizable
El validador DEBE ser un servicio independiente (`workload-validator.ts`) invocable desde carga lectiva, carga no lectiva, horario personal y declaración.
