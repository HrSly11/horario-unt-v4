# Exploration: Gestión de Carga Académica Integral

**Change**: `gestion-carga-academica`  
**Date**: 2026-05-27  
**Status**: Complete

---

## 1. Schema Audit

### 1.1 Enum Values — ✅ Complete

| Enum | Values | Status |
|---|---|---|
| `ModalidadDocente` | `TIEMPO_COMPLETO`, `DEDICACION_EXCLUSIVA`, `TIEMPO_PARCIAL` | ✅ |
| `EstadoDeclaracion` | `BORRADOR`, `ENVIADA`, `APROBADA_DEPARTAMENTO`, `APROBADA_ESCUELA`, `RECHAZADA`, `FINALIZADA` | ✅ |
| `TipoCargaNoLectiva` | 9 values (PREPARACION_EVALUACION … COMITES_COMISIONES) | ✅ |
| `DiaSemana` | Includes `SABADO` | ✅ |
| `UserRole` | Includes `DIRECTOR_DEPARTAMENTO`, `SECRETARIA_DEPARTAMENTO`, `DECANO` | ✅ |
| `TipoAsignacion` | `TEORIA`, `PRACTICA`, `LABORATORIO` | ✅ |

> ⚠️ **Critical migration gap**: The existing migration `20260517045725_init/migration.sql` uses the OLD enum definitions (`DiaSemana` WITHOUT `SABADO`, `TipoAsignacion` WITHOUT `PRACTICA`, no `UserRole` values beyond `ADMIN|DOCENTE`). There is NO migration for the new schema changes. Running `db:push` or a new migration is REQUIRED.

### 1.2 New Organizational Models — ✅ Complete

| Model | Schema Status | Notes |
|---|---|---|
| `Facultad` | ✅ | `nombre` @unique, `siglas` @unique |
| `Departamento` | ✅ | FK → Facultad, directorId/secretariaId → User, `@@unique([nombre, facultadId])` |
| `Escuela` | ✅ | FK → Facultad, directorId → User, `@@unique([nombre, facultadId])` |
| `Curricula` | ✅ | FK → Escuela, `@@unique([codigo, escuelaId])` |
| `CursoCurricula` | ✅ | Join table with ciclo + esElectivo, `@@unique([cursoId, curriculaId])` |

### 1.3 Modified Models — Audit

| Model | Field | Status | Notes |
|---|---|---|---|
| **Docente** | `dni` | ✅ | `String? @unique` |
| | `codigoIBM` | ✅ | `String? @unique` |
| | `modalidad` | ✅ | `ModalidadDocente @default(TIEMPO_COMPLETO)` |
| | `departamentoId` | ✅ | FK → Departamento |
| | `horasContrato` | ✅ | `Int @default(40)` |
| | `dictaOtraUniversidad` | ✅ | `Boolean @default(false)` |
| **Curso** | `horasPractica` | ✅ | `Int @default(0)` |
| | `cursoCurriculas` | ✅ | Relation → CursoCurricula[] |
| **Grupo** | `numAlumnos` | ✅ | `Int @default(0)` |
| | **`seccion`** | ❌ **MISSING** | Implementation plan says it should exist. Not in schema. |

> 🔴 **The `Grupo.seccion` field is MISSING from the Prisma schema.** The plan explicitly requires: `seccion String? // "A", "B" para la sección general`. This must be added before migration.

### 1.4 New Academic Load Models — ✅ Complete

| Model | Status | Notes |
|---|---|---|
| `AsignacionCargaLectiva` | ✅ | docenteId, grupoId, periodoId, tipo, horasAsignadas, compartido, docenteCompartidoId |
| `CargaNoLectiva` | ✅ | docenteId, periodoId, tipo, horas, descripcion, campos específicos |
| `DeclaracionCarga` | ✅ | Full approval flow: docenteId, periodoId, estado, totales, 3-level approval |

### 1.5 Relationships — ✅ Complete

- User ↔ Departamento (director, secretaria via named relations) ✅
- User ↔ Escuela (director via named relation) ✅
- User ↔ DeclaracionCarga (3 approval relations) ✅
- Docente ↔ AsignacionCargaLectiva (own + shared via `DocenteCompartido`) ✅
- PeriodoAcademico ↔ new models ✅
- Grupo ↔ AsignacionCargaLectiva ✅

### 1.6 Missing Unique Constraints — 🔴 CRITICAL

The existing `Asignacion` model has 3 DB-level unique constraints (no double-booking for aula, docente, grupo). The new `AsignacionCargaLectiva` model has **ZERO unique constraints** — it's possible to create duplicate assignments for the same docente+grupo+periodo+tipo combination. This MUST be addressed.

---

## 2. Codebase Inventory

### 2.1 tRPC Routers

| Router | File | Status |
|---|---|---|
| auth | `src/server/trpc/routers/auth.ts` | ✅ Exists |
| docente | `src/server/trpc/routers/docente.ts` | ✅ Exists |
| curso | `src/server/trpc/routers/curso.ts` | ✅ Exists |
| aula | `src/server/trpc/routers/aula.ts` | ✅ Exists |
| periodo | `src/server/trpc/routers/periodo.ts` | ✅ Exists |
| horario | `src/server/trpc/routers/horario.ts` | ✅ Exists |
| reporte | `src/server/trpc/routers/reporte.ts` | ✅ Exists |
| notification | `src/server/trpc/routers/notification.ts` | ✅ Exists |
| **cargaLectiva** | — | ❌ Not created |
| **cargaNoLectiva** | — | ❌ Not created |
| **declaracion** | — | ❌ Not created |
| **declaracionPDF** | — | ❌ Not created |
| **departamento** | — | ❌ Not created |
| **escuela** | — | ❌ Not created |
| **facultad** | — | ❌ Not created |

`_app.ts` registers only 8 routers. Needs import + registration for 7 new routers.

### 2.2 Procedures (init.ts) — ✅ Complete

All 3 new procedures already exist in `src/server/trpc/init.ts`:
- `directorDepartamentoProcedure` (lines 74-79) ✅
- `secretariaDepartamentoProcedure` (lines 81-86) ✅
- `decanoProcedure` (lines 88-93) ✅

### 2.3 Services

| Service | Path | Status |
|---|---|---|
| ScheduleEngine + tests | `src/server/services/schedule-engine/` | ✅ Exists (5 test files) |
| AvailabilityService + tests | `src/server/services/availability/` | ✅ Exists (2 test files) |
| Report templates | `src/server/services/reports/templates.ts` (802 lines) | ✅ Exists |
| PDF renderer (Puppeteer) | `src/server/services/reports/pdf-renderer.ts` | ✅ Exists |
| Assignment service | `src/server/services/assignment.service.ts` | ✅ Exists |
| **workload-validator** | — | ❌ Not created |
| **declaracion-pdf** | — | ❌ Not created |

### 2.4 Frontend Views

#### New Views (NONE exist)

| View | Route | Status |
|---|---|---|
| Carga Lectiva | `/carga-lectiva` | ❌ Not created |
| Carga No Lectiva | `/carga-no-lectiva` | ❌ Not created |
| Declaraciones | `/declaraciones` | ❌ Not created |
| Horario Personal | `/horario-personal` | ❌ Not created |
| Organización | `/organizacion` | ❌ Not created |
| Formatos | `/formatos` | ❌ Not created |

#### Existing Views to Modify

| View | Route | File | Work needed |
|---|---|---|---|
| Docentes | `/docentes` | `src/app/(dashboard)/docentes/page.tsx` (291 lines) | Add new fields: DNI, IBM code, modalidad, departamento, horasContrato, dictaOtraUniversidad |
| Dashboard | `/` | `src/app/(dashboard)/page.tsx` | Add KPIs for new roles |
| Sidebar | — | `src/components/layout/sidebar.tsx` (169 lines) | Add navigation for DIRECTOR_DEPARTAMENTO, SECRETARIA_DEPARTAMENTO, DECANO |

### 2.5 Seed Data — 🔴 VIRTUALLY EMPTY

`prisma/seed.ts` (285 lines) does NOT:
- Seed `Facultad`, `Departamento`, `Escuela`, `Curricula`, `CursoCurricula` ❌
- Use new Docente fields (`dni`, `codigoIBM`, `modalidad`, `departamentoId`, etc.) ❌
- Use `ModalidadDocente` import ❌
- Seed users with new roles (DIRECTOR_DEPARTAMENTO, etc.) ❌
- Seed `AsignacionCargaLectiva`, `CargaNoLectiva`, `DeclaracionCarga` ❌
- Delete new models before seeding (deleteMany list is outdated) ❌

### 2.6 Sidebar — ❌ Missing New Roles

`src/components/layout/sidebar.tsx` only handles these roles:
- `ADMIN` — full access
- `SECRETARIA_ACADEMICA` — limited
- `DIRECTOR_ESCUELA` — limited
- `DOCENTE` — minimal
- else (INVITADO / none) — guest

Missing handlers for:
- `DIRECTOR_DEPARTAMENTO` — should see carga-lectiva, declaraciones, docentes
- `SECRETARIA_DEPARTAMENTO` — should see carga-lectiva, carga-no-lectiva, declaraciones
- `DECANO` — should see declaraciones (VB), organizacion, reportes

---

## 3. Requirements Gap Analysis

### 3.1 Representative Election ("Los docentes deben poder elegir a su representante de escuela")

**What it means**: Docentes vote for a representative within their Escuela. This implies:
- A new model `EleccionRepresentante` (or similar)
- Voting mechanism (candidates, ballots, vote counting)
- Authentication: only docentes of that escuela can vote
- Time-bound election windows

| Aspect | Assessment |
|---|---|
| **Complexity** | **HIGH** |
| **New models needed** | `Eleccion`, `Candidato`, `Voto` (3 models) |
| **New routers** | `eleccion.ts` (candidate registration, voting, results) |
| **New views** | Election management + voting UI |
| **Effort estimate** | +500-700 lines, +3-4 files |
| **Risk** | Introduces a completely new domain concept. Race conditions in voting. |

**Recommendation**: Defer to Phase 2. This is a standalone feature, not blocking the core carga académica flow.

### 3.2 Director Designation by Decano ("El director de escuela es designado por el decano")

**What it means**: The Decano actively appoints the Director de Escuela (and possibly Director de Departamento), not just approves a pre-existing assignment. Currently the schema has a `directorId` on `Escuela`/`Departamento` but no designation flow.

| Aspect | Assessment |
|---|---|
| **Complexity** | **MEDIUM** |
| **Modified models** | `Escuela`, `Departamento` — add `designadoPorId` (FK → User/Decano), `fechaDesignacion` |
| **Modified routers** | `escuela.ts`, `departamento.ts` — add `designarDirector` mutation |
| **Modified views** | `/organizacion` — add designation modal |
| **Effort estimate** | +200-300 lines, modifications to existing files |
| **Risk** | Low. Fits naturally into existing organizational structure. |

**Recommendation**: Include in scope. This aligns with the existing `directorId` field and is a natural extension of the CRUD. Add to the escuela/departamento routers.

### 3.3 Digital Signatures ("uso de firmas digitales")

**What it means**: Replace the boolean flags (`declaracionJuradaFirmada`, `declaracionSedesFirmada`, approval booleans) with actual digital signature capture/verification.

| Aspect | Assessment |
|---|---|
| **Complexity** | **HIGH** |
| **Dependencies** | Digital certificate management, signature pad/canvas UI, cryptographic verification, legal compliance |
| **Modified models** | `DeclaracionCarga` — add `firmaDigitalDocente` (base64/Blob), `firmaDigitalDirector`, `hashDocumento` |
| **New services** | `signature-validator.ts` |
| **UI complexity** | Canvas-based signature pad component |
| **Effort estimate** | +800-1000 lines, +3-4 files |
| **Risk** | Legal compliance with Peruvian digital signature law (Ley N° 27269). This is not just technical — it has legal implications. |

**Recommendation**: Defer to Phase 2+. Keep boolean flags for now (they serve as "declared signed" markers). Digital signatures require legal consultation and dedicated implementation. Document this as a known limitation in the first release.

---

## 4. Risk Assessment — Top 5

### 🔴 Risk 1: Schema Drift — Migration Not Created
**Severity**: CRITICAL  
The Prisma schema has ~10 new models, 4 modified models, 6 modified enums, and 3 new enum types vs the single existing migration. Running `prisma db push` will alter the live DB in ways that might not be reversible. A proper migration must be generated AND tested against a staging DB.  
**Mitigation**: Create a fresh migration via `prisma migrate dev --name add_carga_academica`. Test against a Supabase branch before applying to production. Keep the old migration as-is (it's the pre-transformation state).

### 🟡 Risk 2: ~7000 Lines Underestimates Reality
**Severity**: HIGH  
The plan estimates ~19 files, ~7000+ lines. Actual breakdown based on codebase patterns:
- The existing `templates.ts` alone is 802 lines for 4 report types. The new declaracion PDFs will need comparable detail (~500+ lines EACH for 3 formats).
- Each tRPC router is 200-400 lines (see `docente.ts`: 334 lines).
- Each view page is 200-400 lines (see `docentes/page.tsx`: 291 lines).
- Realistic estimate: **~25-28 files, ~8500-11000 lines**.
**Mitigation**: Use chained PRs. Phase 1 (Schema+Seed+Routers), Phase 2 (Views), Phase 3 (PDFs+Polish). Keep each PR under 400 lines.

### 🟡 Risk 3: Drag-and-Drop Horario Personal View
**Severity**: HIGH  
The plan mentions "Bloques de carga NO LECTIVA: docente arrastra o selecciona slots." This requires:
- A calendar-grid component with drag-and-drop (likely `@dnd-kit` or `react-beautiful-dnd`)
- Real-time validation (8h/day, 40h/week, no overlaps)
- Integration with pre-loaded carga lectiva (read-only blocks)

No drag-and-drop library is currently in `package.json`.  
**Mitigation**: Evaluate `@dnd-kit/core` (lightweight, 33KB). If complexity is too high, fall back to click-to-select approach (simpler but less UX). Document this risk in the design phase.

### 🟡 Risk 4: AsignacionCargaLectiva Has No Unique Constraints
**Severity**: MEDIUM  
The old `Asignacion` model has 3 unique constraints preventing double-booking. `AsignacionCargaLectiva` has none. A docente could be assigned to the same grupo+periodo+tipo multiple times.  
**Mitigation**: Add `@@unique([docenteId, grupoId, periodoId, tipo])` to prevent duplicate load assignments. Also add `@@unique([docenteId, periodoId])` is NOT needed — docente can have multiple assignments in a period.

### 🟡 Risk 5: Seed Data Completeness
**Severity**: MEDIUM  
Without organizational seed data (Facultad, Departamento, Escuela), the app cannot be tested end-to-end. The new models need realistic seed data for the development workflow.  
**Mitigation**: Prioritize seed data update in Phase 1. Create at minimum: 1 Facultad (Ingeniería), 2 Departamentos, 1 Escuela (ISI), 1 Curricula (2018), 3 users with new roles.

---

## 5. Recommendation

### Should we proceed?

**YES, but with adjustments:**

1. **Add `Grupo.seccion` field immediately** — this is a 1-line schema change with no risk.

2. **Include "Director Designation by Decano"** in scope — it's low-effort and aligns with existing structure. Add `designadoPorId` and `fechaDesignacion` to `Escuela` and `Departamento`.

3. **Defer "Representative Election"** to a future phase — it's a standalone feature with its own domain model.

4. **Defer "Digital Signatures"** to a future phase — requires legal consultation and is NOT blocking the core carga académica flow.

5. **Add unique constraint** to `AsignacionCargaLectiva` before migration.

6. **Use chained PRs** — the estimated scope exceeds 400 lines by ~20x:
   - PR #1: Schema migration + seed data (~400 lines)
   - PR #2: Organizational routers (facultad, departamento, escuela) (~350 lines)
   - PR #3: CargaLectiva router + workload-validator (~400 lines)
   - PR #4: CargaNoLectiva router (~300 lines)
   - PR #5: Declaracion router (~400 lines)
   - PR #6-8: Frontend views (2 per PR, ~400 lines each)
   - PR #9-10: PDF templates + router (~500 lines)

7. **Puppeteer is already configured** — `pdf-renderer.ts` is production-ready with Chrome path detection. The existing `templates.ts` provides a solid pattern to follow. No additional setup needed.

---

## 6. Estimated File Count (Adjusted)

| Component | Files | Lines (est.) | Complexity |
|---|---|---|---|
| **Schema + Migration** | 2 (schema edit + migration SQL) | ~300 | Medium |
| **Seed Data** | 1 (seed.ts update) | ~200 | Medium |
| **New tRPC Routers** | 7 (cargaLectiva, cargaNoLectiva, declaracion, declaracionPDF, facultad, departamento, escuela) | ~2000 | High |
| **Router Registration** | 1 (_app.ts) | ~15 | Low |
| **Services** | 2 (workload-validator.ts, declaracion-pdf.ts) | ~700 | High |
| **New Views** | 6 (carga-lectiva, carga-no-lectiva, declaraciones, horario-personal, organizacion, formatos) | ~3500 | High |
| **Modified Views** | 3 (docentes page, dashboard, sidebar) | ~600 | Medium |
| **PDF Templates** | 3 (formatos N1, N2, N3 inline or separate) | ~1000 | High |
| **Tests** | 4 (workload-validator tests, router integration tests) | ~500 | Medium |
| **Total** | **~29 files** | **~8800 lines** | **High** |

> The original estimate of ~19 files / ~7000 lines was optimistic. The realistic estimate is ~29 files / ~8800 lines. This confirms the need for chained PRs.

---

## Key Learnings

- The existing migration `20260517045725_init` represents the **pre-transformation** database state. All new schema elements exist only in `schema.prisma`, not in any migration. A fresh migration is the first blocking task.
- `Grupo.seccion` is the only schema field missing from the plan — must be added before migration.
- `init.ts` already has the 3 new procedures — this was done proactively and is correct.
- The PDF rendering infrastructure (Puppeteer + templates pattern) is solid and production-ready. The new PDFs can follow the exact same pattern.
- The test infrastructure uses vitest + jsdom with factory functions and `describe/it/expect`. Tests are co-located with source files in `src/server/services/`.
- The sidebar component uses a hardcoded if/else chain for role-based navigation. Adding 3 new roles will push it toward a refactor (consider a role-to-navigation map pattern).
- `package.json` has no drag-and-drop library. The horario-personal view's DnD requirement needs a dependency decision in the design phase.
