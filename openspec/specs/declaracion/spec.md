# Especificación: Flujo de Declaración de Carga Horaria

## Propósito

Workflow multi-paso para que el docente declare su carga total (lectiva + no lectiva) y obtenga aprobaciones jerárquicas hasta finalización.

## Requirements

### REQ-DEC-001: Creación de Declaración
El sistema DEBE permitir al DOCENTE crear una declaración en estado `BORRADOR` para un periodo académico. Solo PUEDE existir UNA declaración por docente+periodo.

| Actor | DOCENTE |
|-------|-------|
| Unique | `@@unique([docenteId, periodoId])` |

**Happy Path: Crear borrador**
- GIVEN docente autenticado, periodo activo, carga lectiva y no lectiva registradas
- WHEN crea declaración
- THEN sistema genera `DeclaracionCarga` en estado BORRADOR con totales calculados

**Edge Case: Declaración duplicada**
- GIVEN docente ya tiene declaración BORRADOR para periodo activo
- WHEN intenta crear otra
- THEN sistema rechaza — ya existe una

### REQ-DEC-002: Flujo de Estados
El sistema DEBE implementar la máquina de estados: `BORRADOR → ENVIADA → APROBADA_DEPARTAMENTO → APROBADA_ESCUELA → FINALIZADA`. `RECHAZADA` PUEDE ocurrir desde cualquier estado.

| Estado | Acción Disponible | Actor |
|--------|------------------|-------|
| BORRADOR | Enviar | DOCENTE |
| ENVIADA | Aprobar/Rechazar | DIRECTOR_DEPARTAMENTO |
| APROBADA_DEPARTAMENTO | Aprobar/Rechazar | DIRECTOR_ESCUELA |
| APROBADA_ESCUELA | Dar VB | DECANO |
| FINALIZADA | Descargar PDFs | DOCENTE |
| RECHAZADA | Corregir → vuelve a ENVIADA | DOCENTE |

**Scenario: Flujo completo exitoso**
- GIVEN declaración ENVIADA
- WHEN Director Depto aprueba → Director Escuela aprueba → Decano da VB
- THEN estado final es FINALIZADA con fechas de cada aprobación

**Scenario: Rechazo en aprobación de Escuela**
- GIVEN declaración en APROBADA_DEPARTAMENTO
- WHEN Director Escuela rechaza con motivo "Horas de investigación no justificadas"
- THEN estado cambia a RECHAZADA, `motivoRechazo` se registra, docente es notificado

### REQ-DEC-003: Reenvío tras Rechazo
El sistema DEBE permitir al docente corregir y reenviar una declaración RECHAZADA, reiniciando el flujo desde ENVIADA.

### REQ-DEC-004: Timeline Visual
El sistema DEBE mostrar timeline del estado con fechas, actores y transiciones.

**Scenario: Visualizar timeline**
- GIVEN declaración FINALIZADA
- WHEN docente abre detalle
- THEN timeline muestra: Creada (fecha) → Enviada (fecha) → Aprobada Depto (fecha, nombre) → Aprobada Escuela (fecha, nombre) → VB Decano (fecha, nombre) → Finalizada

### REQ-DEC-005: Validación Pre-Envío
El sistema DEBE validar antes de cambiar a ENVIADA: total lectiva + no lectiva = horas contrato, preparación ≤ 50% lectiva, no hay conflictos de dedicación exclusiva.

**Edge Case: Envío bloqueado por totales**
- GIVEN declaración BORRADOR con total 35h vs contrato 40h
- WHEN docente intenta enviar
- THEN sistema bloquea y muestra "Faltan 5h para completar carga"

### REQ-DEC-006: Notificaciones de Estado
El sistema DEBE notificar al docente sobre cambios de estado (aprobación, rechazo). DEBE notificar al Director Depto cuando hay declaraciones ENVIADA pendientes.
