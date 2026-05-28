# Gestión de Carga Académica Integral — Delta Specs

**Change**: `gestion-carga-academica` | **Date**: 2026-05-27 | **Requirements**: 64 | **Scenarios**: 80+

## New Capabilities

### 1. Estructura Organizacional (`organizational-structure`)
CRUD Facultad → Departamento → Escuela → Curricula. Designación de directores por Decano.
| ID | Requirement | Actor |
|----|-------------|-------|
| REQ-ORG-001 | CRUD Facultad (nombre, siglas @unique) | ADMIN |
| REQ-ORG-002 | CRUD Departamento con FK a Facultad + director/secretaria | ADMIN |
| REQ-ORG-003 | CRUD Escuela con FK a Facultad + director + designación por Decano | ADMIN, DECANO |
| REQ-ORG-004 | CRUD Curricula con FK a Escuela + cursos con ciclo/esElectivo | ADMIN |
| REQ-ORG-005 | Designación de autoridades: Decano asigna director, registra designadoPorId + fechaDesignacion | DECANO |
| REQ-ORG-006 | Visualización jerárquica navegable | Todos |

### 2. Asignación de Carga Lectiva (`carga-lectiva`)
Asignación de cursos a docentes con splits T/P/L y cursos compartidos.
| ID | Requirement | Actor |
|----|-------------|-------|
| REQ-CL-001 | Asignar curso a docente con tipo (TEORIA/PRACTICA/LABORATORIO) + horas | SECRETARIA, DIRECTOR DPTO |
| REQ-CL-002 | Curso compartido: 2 docentes (T+P / L), unique constraint previene duplicados | SECRETARIA |
| REQ-CL-003 | Múltiples tipos por docente en mismo grupo | SECRETARIA |
| REQ-CL-004 | Validar horasAsignadas ≤ horas totales del curso | Sistema |
| REQ-CL-005 | Filtro por departamento y periodo | SECRETARIA |
| REQ-CL-006 | Campo `seccion` en Grupo ("A", "B") | ADMIN |
| REQ-CL-007 | Listado de carga por docente con total lectivas vs contrato | SECRETARIA, DIRECTOR |

### 3. Carga No Lectiva (`carga-no-lectiva`)
Docente registra 9 tipos de actividades no lectivas con auto-cálculo de límites.
| ID | Requirement | Actor |
|----|-------------|-------|
| REQ-CNL-001 | Registrar actividad con tipo, horas, descripción, campos condicionales | DOCENTE |
| REQ-CNL-002 | Auto-cálculo PREPARACION_EVALUACION ≤ 50% horas lectivas | Sistema |
| REQ-CNL-003 | Campos condicionales por tipo (codigoProyecto, numAlumnos, ciclo) | DOCENTE |
| REQ-CNL-004 | Totalización en tiempo real: lectiva + no lectiva vs horasContrato | DOCENTE |
| REQ-CNL-005 | Edición/eliminación solo en estado BORRADOR | DOCENTE |
| REQ-CNL-006 | DE: validar dictaOtraUniversidad = false | Sistema |
| REQ-CNL-007 | Listado por periodo, agrupado por tipo | DOCENTE |

### 4. Flujo de Declaración (`declaracion`)
Workflow BORRADOR → ENVIADA → APROBADA_DEPARTAMENTO → APROBADA_ESCUELA → FINALIZADA.
| ID | Requirement | Actor |
|----|-------------|-------|
| REQ-DEC-001 | Crear declaración BORRADOR (única por docente+periodo) | DOCENTE |
| REQ-DEC-002 | Máquina de estados con aprobaciones jerárquicas + RECHAZADA desde cualquier estado | Multi-rol |
| REQ-DEC-003 | Reenvío tras rechazo: vuelve a ENVIADA | DOCENTE |
| REQ-DEC-004 | Timeline visual con fechas, actores, transiciones | Todos |
| REQ-DEC-005 | Validación pre-envío: totales = contrato, preparación ≤ 50%, sin conflictos DE | Sistema |
| REQ-DEC-006 | Notificaciones de cambio de estado | Sistema |

### 5. PDFs Institucionales (`declaracion-pdf`)
3 formatos PDF con Puppeteer: carga horaria, DJ sede central, DJ sedes descentralizadas.
| ID | Requirement | Actor |
|----|-------------|-------|
| REQ-PDF-001 | Formato N°1: tabla lectiva + 9 secciones no lectivas + 3 firmas (1 página) | DOCENTE, DIRECTOR, DECANO |
| REQ-PDF-002 | Formato N°2: texto legal interpolado con datos del docente | DOCENTE |
| REQ-PDF-003 | Formato N°3: 5 párrafos normativos para sedes descentralizadas | DOCENTE |
| REQ-PDF-004 | Descarga individual o paquete ZIP con 3 formatos | DOCENTE |
| REQ-PDF-005 | Renderizado Puppeteer con timeout 30s, sigue patrón templates.ts | Sistema |

### 6. Horario Personal (`horario-personal`)
Grilla semanal Lun-Sáb 7am-9pm. Lectiva read-only + no lectiva seleccionable.
| ID | Requirement | Actor |
|----|-------------|-------|
| REQ-HP-001 | Grilla 6×14 (días × horas), slots de 1h | DOCENTE |
| REQ-HP-002 | Bloques lectivos read-only (curso, grupo, tipo, color) | DOCENTE |
| REQ-HP-003 | Slots seleccionables para carga no lectiva (click/DnD) | DOCENTE |
| REQ-HP-004 | Validación en tiempo real: 8h/día, 40h/sem TC/DE, sin cruces | Sistema |
| REQ-HP-005 | Panel lateral con totalización en tiempo real | DOCENTE |
| REQ-HP-006 | Filtro por semana del periodo | DOCENTE |

### 7. Validaciones de Negocio (`workload-validation`)
Servicio central reutilizable de validación.
| ID | Requirement | Actor |
|----|-------------|-------|
| REQ-WL-001 | Máximo 8h/día por docente | Sistema |
| REQ-WL-002 | TC/DE: 40h/semana; TP: según horasContrato | Sistema |
| REQ-WL-003 | Sin solapamientos lectiva-no lectiva | Sistema |
| REQ-WL-004 | Total lectiva + no lectiva = horasContrato al enviar | Sistema |
| REQ-WL-005 | PREPARACION_EVALUACION ≤ 50% lectivas | Sistema |
| REQ-WL-006 | DE: dictaOtraUniversidad = false | Sistema |
| REQ-WL-007 | Servicio independiente reutilizable | Sistema |

## Modified Capabilities

### 8. Gestión de Docentes (`docente-management`)
Ampliación con campos DNI, IBM, modalidad, horasContrato, departamento.
| ID | Requirement | Tipo |
|----|-------------|------|
| REQ-DOC-001 | dni (unique), codigoIBM (unique) | ADDED |
| REQ-DOC-002 | modalidad (TC/DE/TP), horasContrato (default 40) | ADDED |
| REQ-DOC-003 | departamentoId FK → Departamento | ADDED |
| REQ-DOC-004 | dictaOtraUniversidad (DE debe ser false) | ADDED |
| REQ-DOC-005 | Indicador carga completa/pendiente por periodo | ADDED |

### 9. Dashboard (`dashboard`)
KPIs y accesos rápidos por rol.
| ID | Requirement | Tipo |
|----|-------------|------|
| REQ-DASH-001 | Director Depto: docentes, carga %, declaraciones pendientes | ADDED |
| REQ-DASH-002 | Decano: resumen facultad, VB pendientes | ADDED |
| REQ-DASH-003 | Docente: estado declaración, progreso carga, CTA a horario/formatos | ADDED |
| REQ-DASH-004 | Admin: KPIs globales ampliados | ADDED |

### 10. Sidebar (`navigation`)
Navegación por rol con refactor a mapa rol→módulos.
| ID | Requirement | Tipo |
|----|-------------|------|
| REQ-NAV-001 | DIRECTOR_DEPARTAMENTO: Dashboard, Carga Lectiva, Declaraciones, Docentes | ADDED |
| REQ-NAV-002 | SECRETARIA_DEPARTAMENTO: Dashboard, Carga Lectiva, Carga No Lectiva, Declaraciones | ADDED |
| REQ-NAV-003 | DECANO: Dashboard, Organización, Declaraciones, Formatos, Reportes | ADDED |
| REQ-NAV-004 | DOCENTE ampliado: +Horario Personal, +Formatos | ADDED |
| REQ-NAV-005 | Refactor if/else → mapa rol→módulos | ADDED |

### 11. Seed Data (`seed-data`)
Datos organizacionales, usuarios, carga lectiva/no lectiva, declaraciones de ejemplo.
| ID | Requirement | Tipo |
|----|-------------|------|
| REQ-SEED-001 | 1 Facultad, 2 Deptos, 2 Escuelas, 2 Curriculas con cursos | ADDED |
| REQ-SEED-002 | Usuarios con roles: ADMIN, DECANO, DIRECTOR_DPTO×2, SECRETARIA_DPTO×2, DIRECTOR_ESCUELA×2, DOCENTE×5 | ADDED |
| REQ-SEED-003 | Asignaciones carga lectiva con curso compartido T/P/L | ADDED |
| REQ-SEED-004 | Carga no lectiva variada (3+ tipos) | ADDED |
| REQ-SEED-005 | Declaraciones en estados: BORRADOR, ENVIADA, APROBADA_DEPARTAMENTO, FINALIZADA | ADDED |
| REQ-SEED-006 | Limpieza previa con deleteMany en orden de dependencias | ADDED |

## Validation Rules Summary

| Rule | Constraint | Error Message |
|------|-----------|---------------|
| 8h/día | horas_dia ≤ 8 | "Excede límite de 8h/día" |
| 40h/sem TC/DE | horas_semana ≤ 40 | "Dedicación Exclusiva: máximo 40h semanales" |
| TP por contrato | horas_semana ≤ horasContrato | "Excede horas de contrato" |
| Sin cruces | ∀ slots: no overlap | "Conflicto con [asignación]" |
| Totales = contrato | lectiva + noLectiva = horasContrato | "Faltan/sobran Xh para completar" |
| Preparación ≤ 50% | prep ≤ lectivas × 0.5 | "Preparación excede 50% de horas lectivas" |
| DE no dicta otra U | modalidad=DE → !dictaOtraUniversidad | "DE no permite dictar en otra universidad" |
| Curso compartido ≤ 2 | count(docentes por grupo) ≤ 2 | "Máximo 2 docentes por grupo compartido" |
| Unique asignación | @@unique([docenteId, grupoId, periodoId, tipo]) | "Asignación duplicada" |
| Unique declaración | @@unique([docenteId, periodoId]) | "Ya existe declaración para este periodo" |

## Deferred (Phase 2)

- Elección de representante de escuela por docentes
- Integración real de firmas digitales (se mantienen boolean flags)
