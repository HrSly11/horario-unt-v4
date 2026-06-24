# Delta: Gestión de Docentes (Ampliada)

## Propósito

Ampliar el modelo Docente existente con campos requeridos por la gestión de carga académica: DNI, código IBM, modalidad, horas contrato, departamento y declaración de otra universidad.

## ADDED Requirements

### REQ-DOC-001: Campos de Identificación
El sistema DEBE agregar al modelo Docente: `dni` (String?, @unique), `codigoIBM` (String?, @unique).

| Actor | ADMIN |
|-------|-------|

**Scenario: Registrar DNI**
- GIVEN formulario de edición de docente
- WHEN ADMIN ingresa DNI "12345678"
- THEN `docente.dni` persiste validado como único

**Edge Case: DNI duplicado**
- GIVEN existe docente con DNI "12345678"
- WHEN ADMIN intenta asignar mismo DNI a otro docente
- THEN sistema rechaza con error de unicidad

### REQ-DOC-002: Modalidad y Horas Contrato
El sistema DEBE agregar: `modalidad` (TIEMPO_COMPLETO | DEDICACION_EXCLUSIVA | TIEMPO_PARCIAL, default TC), `horasContrato` (Int, default 40).

**Scenario: Asignar modalidad DE**
- GIVEN formulario de docente
- WHEN ADMIN selecciona DEDICACION_EXCLUSIVA
- THEN `horasContrato` se fija en 40 y `dictaOtraUniversidad` debe ser false

### REQ-DOC-003: Asociación a Departamento
El sistema DEBE agregar `departamentoId` (FK → Departamento) al modelo Docente.

### REQ-DOC-004: Indicador de Otra Universidad
El sistema DEBE agregar `dictaOtraUniversidad` (Boolean, default false). Docentes DE NO PUEDEN tener este campo en true.

**Scenario: DE declara otra universidad**
- GIVEN docente DE intenta marcar `dictaOtraUniversidad: true`
- WHEN guarda cambios
- THEN sistema rechaza — "Dedicación Exclusiva no permite dictar en otra universidad"

### REQ-DOC-005: Indicador de Carga por Periodo
El sistema DEBE mostrar para cada docente si su carga está completa (lectiva+no lectiva = horasContrato), pendiente, o excedida para el periodo activo.
