# Especificación: Horario Personal del Docente

## Propósito

Vista de grilla semanal para que el docente visualice su carga lectiva (read-only) y complete carga no lectiva mediante selección de slots.

## Requirements

### REQ-HP-001: Grilla Semanal
El sistema DEBE mostrar grilla Lunes a Sábado, 7:00 AM a 9:00 PM, con slots de 1 hora.

| Actor | DOCENTE |
|-------|-------|
| Vista | Grilla 6 columnas × 14 filas |

**Happy Path: Visualizar horario**
- GIVEN docente autenticado con carga lectiva asignada
- WHEN abre horario personal
- THEN grilla muestra bloques lectivos (read-only, coloreados) con curso, grupo, tipo

### REQ-HP-002: Carga Lectiva Read-Only
El sistema DEBE mostrar bloques de carga lectiva como read-only (no editables, no arrastrables). Bloques DEBEN mostrar: curso, grupo, tipo (T/P/L), horas.

**Scenario: Bloque lectivo en grilla**
- GIVEN docente asignado a "ISI-101-A TEORIA Lun 8-10am"
- WHEN visualiza grilla
- THEN slot Lun 8-10am muestra bloque azul con "ISI-101 - A - TEORIA"

### REQ-HP-003: Selección de Slots para Carga No Lectiva
El sistema DEBE permitir al docente seleccionar slots horarios para asignar actividades no lectivas. Selección PUEDE ser click-to-select o drag-and-drop.

**Scenario: Asignar investigación a slot**
- GIVEN docente selecciona slot Mar 2-5pm
- WHEN asigna tipo INVESTIGACION con código proyecto
- THEN bloque verde aparece en grilla con "INVESTIGACION - PIC-2026-001"

**Edge Case: Slot ya ocupado**
- GIVEN slot Mar 2-3pm tiene carga lectiva
- WHEN docente intenta seleccionarlo para no lectiva
- THEN sistema rechaza — "Slot ocupado por ISI-101-A TEORIA"

### REQ-HP-004: Validación en Tiempo Real
El sistema DEBE validar al seleccionar slots: máximo 8h/día, máximo 40h/semana (TC/DE), sin cruces. Errores DEBEN mostrarse inmediatamente.

**Scenario: Exceder 8h diarias**
- GIVEN docente ya tiene 7h asignadas el Lunes
- WHEN intenta agregar bloque de 2h el Lunes
- THEN sistema rechaza — "Excede límite de 8h/día (tendría 9h)"

### REQ-HP-005: Totalización Horaria
El sistema DEBE mostrar en tiempo real: horas lectivas, horas no lectivas, total, horas contrato, horas restantes.

**Scenario: Conteo en tiempo real**
- GIVEN grilla con 20h lectivas + 10h no lectivas asignadas
- WHEN panel lateral muestra: "Lectivas: 20h | No Lectivas: 10h | Total: 30/40h | Restan: 10h"

### REQ-HP-006: Filtro por Semana
El sistema DEBE permitir visualizar el horario de semanas específicas dentro del periodo académico. Compatible con semanas típicas y atípicas.
