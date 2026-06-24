# Delta: Dashboard (Ampliado)

## Propósito

Ampliar dashboard con KPIs y acciones rápidas específicas por rol: Director Departamento, Decano, Docente.

## ADDED Requirements

### REQ-DASH-001: Dashboard Director Departamento
El sistema DEBE mostrar al DIRECTOR_DEPARTAMENTO: total docentes, carga completada vs pendiente (%), declaraciones pendientes de aprobación, y acceso rápido al listado de carga lectiva.

| Actor | DIRECTOR_DEPARTAMENTO |
|-------|-------|

**Scenario: KPIs de departamento**
- GIVEN director depto autenticado
- WHEN carga dashboard
- THEN muestra: "15 docentes", "80% carga completa", "3 declaraciones pendientes"

### REQ-DASH-002: Dashboard Decano
El sistema DEBE mostrar al DECANO: resumen de facultad (departamentos, escuelas, total docentes), declaraciones pendientes de VB, accesos rápidos a organización y reportes.

**Scenario: VB pendientes**
- GIVEN decano autenticado
- WHEN carga dashboard
- THEN alerta muestra "5 declaraciones requieren su VB"

### REQ-DASH-003: Dashboard Docente
El sistema DEBE mostrar al DOCENTE: estado de su declaración actual, progreso de carga (lectiva + no lectiva / contrato), acceso rápido a horario personal y formatos PDF.

**Scenario: Declaración pendiente**
- GIVEN docente sin declaración creada
- WHEN carga dashboard
- THEN muestra CTA "Iniciar declaración de carga" con indicador de progreso

### REQ-DASH-004: Resumen Global (ADMIN)
El sistema DEBE mantener y ampliar dashboard ADMIN con KPIs globales: total facultades, departamentos, escuelas, docentes, declaraciones por estado.
