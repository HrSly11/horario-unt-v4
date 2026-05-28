# Sistema de Gestión de Carga Académica — Task Tracking

## Phase 1: Foundation (Schema + Seed + Core Backend)

### 1.1 Database Schema
- [x] Add new enums (ModalidadDocente, EstadoDeclaracion, TipoCargaNoLectiva, SABADO to DiaSemana)
- [x] Add new roles to UserRole (DIRECTOR_DEPARTAMENTO, SECRETARIA_DEPARTAMENTO, DECANO)
- [x] Create organizational models (Facultad, Departamento, Escuela, Curricula, CursoCurricula)
- [x] Modify Docente model (dni, codigoIBM, modalidad, departamentoId, horasContrato, dictaOtraUniversidad)
- [x] Modify Curso model (horasPractica)
- [x] Modify Grupo model (seccion, numAlumnos)
- [x] Create AsignacionCargaLectiva model
- [x] Create CargaNoLectiva model
- [x] Create DeclaracionCarga model
- [x] Run prisma migration (20260528014334_init — fresh from current schema)

### 1.2 Seed Data
- [x] Update seed with Facultad, Departamento, Escuela, Curricula
- [x] Update seed with organizational structure and expanded fields
- [x] Add new role users
- [x] Add sample AsignacionCargaLectiva and CargaNoLectiva data
- [x] Add sample DeclaracionCarga records

### 1.3 Backend — tRPC Routers
- [x] Add new procedures to init.ts
- [x] Create organizational routers (facultad, departamento, escuela)
- [x] Create cargaLectiva.ts router
- [x] Create cargaNoLectiva.ts router
- [x] Create declaracion.ts router (flujo completo)
- [x] Create declaracionPDF.ts router
- [x] Create workload-validator.ts service
- [x] Register all routers in _app.ts

## Phase 2: Frontend Views

### 2.1 New Views
- [x] Vista: Carga Lectiva (/carga-lectiva)
- [x] Vista: Carga No Lectiva (/carga-no-lectiva)
- [x] Vista: Declaraciones (/declaraciones)
- [x] Vista: Horario Personal (/horario-personal)
- [x] Vista: Estructura Organizacional (/organizacion)
- [x] Vista: Formatos y Documentos (/formatos)

### 2.2 Modified Views
- [x] Ampliar vista Docentes (nuevos campos)
- [x] Ampliar Dashboard (nuevos roles, KPIs)
- [x] Actualizar Sidebar (nuevos módulos)

## Phase 3: PDFs + Polish

### 3.1 PDF Generation
- [x] Formato N°1: Declaración de Carga Horaria Asignada
- [x] Formato N°2: Declaración Jurada Sede Central
- [x] Formato N°3: Declaración Jurada Sedes Descentralizadas

### 3.2 Validation & Polish
- [x] Tests para workload-validator (30 tests ✅)
- [x] Flujo E2E completo — BD recreada, migración 20260528014334_init, seed ejecutado (30 carga lectiva + 10 no lectiva + 5 declaraciones), dev server corriendo en localhost:3000
- [x] Responsive design check — Next.js 16.2.6 + TailwindCSS 4 con vistas responsive
