# Especificación: Generación de PDFs Institucionales

## Propósito

Generar 3 formatos PDF oficiales con datos reales de la declaración de carga horaria, usando Puppeteer para renderizado.

## Requirements

### REQ-PDF-001: Formato N°1 — Declaración de Carga Horaria Asignada
El sistema DEBE generar PDF de 1 página con: tabla de carga lectiva (curso, grupo, tipo, horas), 9 secciones de carga no lectiva con horas, total general, y 3 líneas de firma (Docente, Director Depto, Director Escuela).

| Actor | DOCENTE, DIRECTOR_DEPARTAMENTO, DECANO |
|-------|-------|
| Formato | 1 página, tamaño oficio |

**Happy Path: Generar Formato N°1**
- GIVEN declaración FINALIZADA con carga lectiva y no lectiva
- WHEN usuario solicita descargar Formato N°1
- THEN PDF se genera con tabla lectiva, 9 secciones no lectivas, totales, y espacios para firmas

**Edge Case: Sin carga no lectiva**
- GIVEN declaración solo tiene carga lectiva (no lectiva = 0)
- WHEN se genera Formato N°1
- THEN secciones no lectivas muestran "0 horas" y PDF es válido

### REQ-PDF-002: Formato N°2 — Declaración Jurada Sede Central
El sistema DEBE generar PDF con texto legal interpolado incluyendo: nombre del docente, DNI, departamento, horas lectivas totales, horas no lectivas totales, y cláusula de veracidad.

**Scenario: Interpolación de datos**
- GIVEN docente "María López", DNI "12345678", Depto "Ing. Sistemas", 40h totales
- WHEN se genera Formato N°2
- THEN PDF contiene texto legal con datos interpolados correctamente

**Edge Case: Datos faltantes**
- GIVEN docente sin DNI registrado
- WHEN se intenta generar Formato N°2
- THEN sistema muestra error "Complete DNI del docente antes de generar"

### REQ-PDF-003: Formato N°3 — Declaración Jurada Sedes Descentralizadas
El sistema DEBE generar PDF con 5 párrafos normativos interpolando: sede, facultad, periodo, horas totales.

**Scenario: Datos de sede descentralizada**
- GIVEN docente asignado a sede "Filial Huamachuco"
- WHEN se genera Formato N°3
- THEN párrafos mencionan sede correcta y aplican normativa de sedes descentralizadas

### REQ-PDF-004: Descarga Individual y Paquete
El sistema DEBE permitir descargar cada formato individualmente o los 3 formatos en un paquete ZIP.

**Scenario: Descargar paquete completo**
- GIVEN declaración FINALIZADA
- WHEN usuario solicita "Descargar todos los formatos"
- THEN sistema genera ZIP con `Formato_N1_{dni}.pdf`, `Formato_N2_{dni}.pdf`, `Formato_N3_{dni}.pdf`

### REQ-PDF-005: Renderizado Puppeteer
El sistema DEBE usar Puppeteer (ya configurado) para renderizar HTML → PDF. Templates DEBEN seguir patrón de `src/server/services/reports/templates.ts`.

**Scenario: Timeout de renderizado**
- GIVEN Puppeteer tarda más de 30s en generar PDF
- WHEN timeout ocurre
- THEN sistema retorna error "Error al generar PDF. Intente nuevamente."
