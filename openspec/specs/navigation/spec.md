# Delta: Sidebar de Navegación (Ampliado)

## Propósito

Ampliar sidebar con módulos visibles según los nuevos roles: DIRECTOR_DEPARTAMENTO, SECRETARIA_DEPARTAMENTO, DECANO.

## ADDED Requirements

### REQ-NAV-001: Menú Director Departamento
El sistema DEBE mostrar en sidebar para DIRECTOR_DEPARTAMENTO: Dashboard, Carga Lectiva, Declaraciones, Docentes.

| Actor | DIRECTOR_DEPARTAMENTO |
|-------|-------|

**Scenario: Navegación Director Depto**
- GIVEN usuario con rol DIRECTOR_DEPARTAMENTO
- WHEN sidebar se renderiza
- THEN muestra 4 módulos: Dashboard, Carga Lectiva, Declaraciones, Docentes

### REQ-NAV-002: Menú Secretaria Departamento
El sistema DEBE mostrar para SECRETARIA_DEPARTAMENTO: Dashboard, Carga Lectiva, Carga No Lectiva, Declaraciones.

### REQ-NAV-003: Menú Decano
El sistema DEBE mostrar para DECANO: Dashboard, Organización, Declaraciones, Formatos, Reportes.

**Scenario: Decano accede a organización**
- GIVEN decano autenticado
- WHEN sidebar muestra "Organización"
- THEN navega a CRUD de Facultad/Departamento/Escuela/Curricula

### REQ-NAV-004: Menú Docente (Ampliado)
El sistema DEBE agregar al menú DOCENTE existente: Horario Personal, Formatos PDF.

**Scenario: Docente con declaración finalizada**
- GIVEN docente con declaración FINALIZADA
- WHEN sidebar muestra "Formatos"
- THEN puede descargar PDFs institucionales

### REQ-NAV-005: Refactor a Mapa de Navegación
El sistema DEBE reemplazar la cadena if/else actual del sidebar por un mapa rol→módulos para facilitar extensión futura.

| Rol | Módulos |
|-----|---------|
| ADMIN | Todos |
| DECANO | Dashboard, Organización, Declaraciones, Formatos, Reportes |
| DIRECTOR_DEPARTAMENTO | Dashboard, Carga Lectiva, Declaraciones, Docentes |
| SECRETARIA_DEPARTAMENTO | Dashboard, Carga Lectiva, Carga No Lectiva, Declaraciones |
| DIRECTOR_ESCUELA | (existente) |
| SECRETARIA_ACADEMICA | (existente) |
| DOCENTE | Dashboard, Horario Personal, Declaraciones, Formatos |
