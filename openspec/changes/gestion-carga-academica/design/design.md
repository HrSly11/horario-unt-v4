# Design: Gestión de Carga Académica Integral

## Technical Approach

Extend the existing Next.js + tRPC + Prisma + Puppeteer stack following established patterns. Seven new tRPC routers mirror the existing flat `routers/` structure. Six new views under `(dashboard)/` follow Next.js App Router conventions. Workload validation as pure functions (stateless, testable). PDF generation reuses the proven `templates.ts → renderPDF()` pipeline. Chained PRs of ≤400 lines each to protect reviewer cognitive load.

---

## Architecture Decisions

### 1. Drag-and-Drop: Custom CSS Grid + Click-to-Toggle

| Option | Tradeoff | Decision |
|--------|----------|----------|
| `@dnd-kit/core` (~15KB) | New dependency, 300+ line component, steep learning curve | ❌ |
| `react-beautiful-dnd` | Deprecated, no React 19 support | ❌ |
| **CSS Grid + click-to-toggle** | No dependency, ~180 lines, matches UNT usage pattern (admin filling, not playful dragging) | ✅ |

**Rationale**: The horario-personal view is an administrative filling tool where docentes select 30-min blocks, not a real-time playground. CSS Grid provides the 6-column (LUNES–SABADO) layout natively. Click-to-toggle with visual feedback (color by `TipoCargaNoLectiva`) is implementable in ~180 lines. `@dnd-kit` can be added later as enhancement without API changes. This also keeps the first frontend PR under 400 lines.

### 2. PDF Generation: HTML-to-PDF via Puppeteer (Same Pattern)

**Choice**: Extend existing `templates.ts` + `renderPDF()` pipeline.

New file `src/server/services/reports/declaracion-templates.ts` with 3 template functions:
- `templateFormatoN1(docente, asignaciones, cargasNoLectivas, declaracion)` — carga horaria semanal
- `templateFormatoN2(docente, declaracion, periodo)` — declaración jurada sede central
- `templateFormatoN3(docente, declaracion, periodo)` — sedes descentralizadas

Each returns an HTML string with inline Times New Roman CSS (same as existing STYLES). The `renderPDF(html, { landscape: true })` function handles Chrome launch and A4 rendering. Prisma `include` fetches all nested data in a single query per template. No new infrastructure needed — Puppeteer already configured with cross-platform Chrome path detection.

### 3. Validation Engine: Pure Functions, Pre-Fetched Data

| Option | Tradeoff | Decision |
|--------|----------|----------|
| Class with state | Mutable, harder to test individual rules | ❌ |
| DB-level (triggers) | Hard to test, PostgreSQL-specific | ❌ |
| **Pure functions** | Stateless, composable, easily testable | ✅ |

**Interface**:
```ts
// src/server/services/workload-validator.ts
type ValidationResult = { valid: boolean; errors: ValidationError[] };

validateDailyLimit(asignaciones: AsignacionInput[], dia: DiaSemana): ValidationResult
validateWeeklyLimit(totalHoras: number, horasContrato: number): ValidationResult
validateNoOverlap(slots: TimeSlot[]): ValidationResult
validateAll(docenteId: string, periodoId: string): Promise<ValidationResult>
```

`validateAll` is the router-facing entry point that fetches data via `ctx.prisma`. Simpler functions receive pre-fetched arrays for unit testing with vitest. Integration: called from `cargaLectiva` router on assignment, from `declaracion` router on submit, and can be called from `schedule-engine` if needed (imports only pure functions).

### 4. Router Architecture: Flat (Existing Pattern)

**Choice**: All routers in `src/server/trpc/routers/` — flat, same as existing 8 routers.

The project already has `auth.ts`, `docente.ts`, `curso.ts` etc. at the top level. Grouping into subdirectories would break the established convention with no benefit — each router is 200-400 lines and self-contained. Risk of naming collisions is zero since each file exports one named router.

### 5. DeclaracionCarga State Machine: Router-Level + Re-Submission

| Where | Tradeoff | Decision |
|-------|----------|----------|
| DB triggers | PostgreSQL-specific, hard to test in vitest | ❌ |
| Prisma middleware | Global scope, affects all models | ❌ |
| **Router-level validation** | Explicit, testable, role-scoped | ✅ |

**Valid transitions** (enforced in `declaracion` router):
```
BORRADOR → ENVIADA (docente submits)
ENVIADA → APROBADA_DEPARTAMENTO | RECHAZADA (director depto)
APROBADA_DEPARTAMENTO → APROBADA_ESCUELA | RECHAZADA (director escuela)
APROBADA_ESCUELA → FINALIZADA (decano VB)
* → RECHAZADA (any approver at any stage after ENVIADA)
```

**Re-submission**: Rejected declarations transition to `BORRADOR` via `reabrir` mutation (same `declaracionId`). The `@@unique([docenteId, periodoId])` constraint enforces one active declaration per docente-period. Approval history preserved in `fechaAprobacionDepto`/`fechaAprobacionEscuela` timestamps — resubmission overwrites them.

### 6. Real-time Dashboard: tRPC + React Query Polling

**Choice**: `useQuery` with `refetchInterval: 30000` (30s). No WebSocket/SSE.

WebSockets would require a separate server process, connection management, and auth integration — unjustified for an academic admin system. 30-second polling via React Query delivers acceptable freshness. The dashboard KPI cards (docentes por estado, cargas pendientes) and sidebar role indicator all use the same pattern already in place (`useQuery({ ...trpc.auth.me.queryOptions() })`).

### 7. Chained PR Strategy: 10 Slices

| # | Slice | Files | ~Lines | Dependency |
|---|-------|-------|--------|------------|
| 1 | Schema + Migration + Seed | 3 | 400 | — |
| 2 | Organizational Routers (facultad, departamento, escuela) | 3 + _app.ts | 380 | PR #1 |
| 3 | CargaLectiva Router + Workload Validator | 3 | 400 | PR #2 |
| 4 | CargaNoLectiva Router | 1 | 300 | PR #1 |
| 5 | Declaracion Router (state machine) | 1 | 350 | PR #3, #4 |
| 6 | Horario-Personal View + WeeklyGrid component | 3 | 400 | PR #3, #4 |
| 7 | Carga-Lectiva + Carga-NoLectiva Views | 2 | 380 | PR #3, #4 |
| 8 | Declaraciones View + Organizacion View | 2 | 400 | PR #2, #5 |
| 9 | PDF Templates (3 formatos) + DeclaracionPDF Router | 2 | 400 | PR #5 |
| 10 | Sidebar + Dashboard + Docentes Fields + Formatos View | 4 | 380 | PR #8, #9 |

**Ordering**: PR #1 unblocks everything. PRs #2-#5 (backend) can be done in sequence. PRs #6-#10 (frontend) depend on respective backend routers. Each slice is autonomous with its own verification.

### 8. Seeding Strategy: Complete Demo Environment

`prisma/seed.ts` creates:
- 1 Facultad (Ingeniería — UNT), 2 Departamentos (Sistemas, Matemáticas), 1 Escuela (ISI), 1 Curricula (Plan 2018)
- 8 Users: 1 ADMIN, 1 DECANO, 1 DIRECTOR_DEPARTAMENTO, 1 DIRECTOR_ESCUELA, 1 SECRETARIA_DEPARTAMENTO, 3 DOCENTES
- 3 Docentes with full fields (dni, codigoIBM, modalidad, horasContrato, departamento)
- 6 Cursos + 6 Grupos (with `seccion`) for the current Periodo
- 12 AsignacionCargaLectiva entries (including 2 shared/split T/P)
- 6 CargaNoLectiva entries (one of each type)
- 5 DeclaracionCarga in different states (BORRADOR, ENVIADA, APROBADA_DEPARTAMENTO, RECHAZADA, FINALIZADA)
- DeleteMany order respects FK dependencies (bottom-up cascade)

---

## Data Flow

### Carga Lectiva Assignment:
```
Secretaria UI ──tRPC cargaLectiva.assign──→ workload-validator.validateAll()
                    │                              │
                    │                         Prisma: carga lectiva + no lectiva + restricciones
                    │                              │
                    └────── CREATE AsignacionCargaLectiva ────→ DB
                                           │
                                     Return: { success, horasRestantes }
```

### Declaracion Workflow:
```
Docente completa carga → crea DeclaracionCarga (BORRADOR)
  → tRPC declaracion.enviar → valida 8h/40h → ENVIADA
  → Director Depto revisa → tRPC declaracion.aprobarDepto → APROBADA_DEPARTAMENTO
  → Director Escuela revisa → tRPC declaracion.aprobarEscuela → APROBADA_ESCUELA
  → Decano VB → tRPC declaracion.vbDecano → FINALIZADA
  (Any approver can rechazar at their stage → RECHAZADA → docente reabre → BORRADOR)
```

### PDF Generation:
```
User selects formato → tRPC declaracionPDF.generateN1/N2/N3(input: { docenteId, periodoId })
  → Prisma: docente + asignaciones (include grupo.curso) + cargasNoLectivas + declaracion
  → declaracion-templates.ts → HTML string (Times New Roman, UNT header)
  → pdf-renderer.ts renderPDF(html, { landscape: true }) → Buffer
  → Return: { pdfBase64: string, filename: string }
```

---

## File Structure

```
prisma/
├── schema.prisma                    (modified — already has all models)
├── migrations/
│   └── YYYYMMDDHHMMSS_add_carga_academica/  (new migration)
└── seed.ts                          (modified — complete demo environment)

src/server/trpc/routers/
├── _app.ts                          (modified — register 7 routers)
├── facultad.ts                      (new — CRUD + designar director)
├── departamento.ts                  (new — CRUD + designar director)
├── escuela.ts                       (new — CRUD + designar director)
├── cargaLectiva.ts                  (new — assign, list, unassign)
├── cargaNoLectiva.ts                (new — CRUD for docente's own entries)
├── declaracion.ts                   (new — workflow mutations)
└── declaracionPDF.ts                (new — generate N1/N2/N3)

src/server/services/
├── workload-validator.ts            (new — pure functions + validateAll)
├── workload-validator.test.ts       (new — vitest unit tests)
└── reports/
    └── declaracion-templates.ts     (new — 3 HTML template functions)

src/app/(dashboard)/
├── page.tsx                         (modified — role-based KPIs)
├── docentes/page.tsx                (modified — new fields)
├── organizacion/page.tsx            (new — facultad/depto/escuela CRUD)
├── carga-lectiva/page.tsx           (new — secretaria assignment view)
├── carga-no-lectiva/page.tsx        (new — docente self-entry)
├── horario-personal/
│   ├── page.tsx                     (new — weekly grid container)
│   └── components/
│       └── WeeklyGrid.tsx           (new — CSS Grid 6-col, click-to-toggle)
├── declaraciones/page.tsx           (new — workflow list + detail)
└── formatos/page.tsx                (new — PDF selector + preview)

src/components/layout/
└── sidebar.tsx                      (modified — add 3 new roles + nav items)
```

---

## Component Trees

### Horario Personal (`horario-personal/page.tsx`)
```
HorarioPersonalPage
├── PeriodoSelector (dropdown, current periodo)
├── WeeklyGrid (CSS Grid: 6 cols × N rows of 30-min blocks)
│   ├── DayHeader[6] (LUNES..SABADO)
│   ├── TimeRow[N] (hour label + 6 clickable slots)
│   │   ├── LectiveBlock (gray, read-only, from AsignacionCargaLectiva)
│   │   └── NonLectiveSlot (click to add/remove, colored by tipo)
│   └── DailyTotalRow (sum hours/day, red if >8h)
├── TotalsSummary (lectivas × no lectivas × horasContrato)
└── NonLectiveEditor (sidebar panel)
    ├── TipoSelector (9 types dropdown)
    ├── HoursInput
    ├── DescripcionField
    └── AddButton → adds to WeeklyGrid
```

### Declaraciones (`declaraciones/page.tsx`)
```
DeclaracionesPage
├── DeclaracionTable (rows: docente, estado, totales, acciones)
│   ├── StatusBadge (color-coded: gray=BORRADOR, blue=ENVIADA, etc.)
│   └── ActionButtons (view detail, approve, reject — role-dependent)
├── DeclaracionDetailModal
│   ├── WorkflowTimeline (visual stepper: 5 states + RECHAZADA branch)
│   ├── LectiveTable (curso, grupo, tipo, horas — read-only)
│   ├── NonLectiveTable (tipo, horas, descripcion — read-only)
│   ├── TotalDisplay (bar: lectivas + no lectivas ≤ horasContrato)
│   ├── ApprovalSection (role-conditional buttons)
│   └── ObservacionesField (required when rejecting)
```

---

## API Contract Sketches

### cargaLectiva Router
```ts
cargaLectiva.assign(input: { docenteId, grupoId, periodoId, tipo, horasAsignadas, compartido?, docenteCompartidoId? })
  → { id, valid: boolean, errors?: [] }
cargaLectiva.list(input: { periodoId, departamentoId? })
  → AsignacionCargaLectiva[] (include docente, grupo.curso, periodo)
cargaLectiva.unassign(input: { id }) → { success }
```

### declaracion Router
```ts
declaracion.create(input: { docenteId, periodoId }) → DeclaracionCarga (BORRADOR)
declaracion.enviar(input: { id }) → { success, validation }
declaracion.aprobarDepto(input: { id, observaciones? }) → DeclaracionCarga
declaracion.aprobarEscuela(input: { id, observaciones? }) → DeclaracionCarga
declaracion.vbDecano(input: { id }) → DeclaracionCarga (FINALIZADA)
declaracion.rechazar(input: { id, observaciones }) → DeclaracionCarga (RECHAZADA)
declaracion.reabrir(input: { id }) → DeclaracionCarga (BORRADOR)
declaracion.list(input: { periodoId, departamentoId?, estado? }) → DeclaracionCarga[]
declaracion.byId(input: { id }) → DeclaracionCarga (include all nested)
```

### declaracionPDF Router
```ts
declaracionPDF.generate(input: { docenteId, periodoId, formato: 'N1'|'N2'|'N3' })
  → { pdfBase64: string, filename: string }
```

---

## Migration Plan

1. **Verify**: Current schema has all models already defined in `schema.prisma`. The only missing field found in exploration is `Grupo.seccion` — already present (line 346). The exploration report was written before the field was added. ✅
2. **Generate**: `npx prisma migrate dev --name add_carga_academica` from current schema state. This creates ONE migration with all new models, enums, and constraints.
3. **Test on Supabase branch**: Create dev branch, run migration, run seed, verify all tables exist with correct FK constraints.
4. **Apply to production**: `npx prisma migrate deploy` after code review.
5. **Seed**: `npx prisma db seed` creates complete demo environment. `deleteMany` order respects FK cascade dependencies.

**Rollback**: The existing `20260517045725_init` migration represents the pre-transformation state. `prisma migrate down` to revert. Database backup recommended before deployment.

---

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | `workload-validator` pure functions | vitest, co-located `workload-validator.test.ts`, factory inputs |
| Unit | State machine transitions | vitest, test each valid + invalid transition in `declaracion.test.ts` |
| Integration | tRPC routers | vitest + `createCallerFactory`, mock Prisma context |
| Integration | PDF template output | vitest, verify HTML contains expected data, parse with jsdom |
| E2E | Seed completeness | Verify seed runs without errors, all demo data queryable |

---

## Open Questions

- [ ] Should `DECANO` role see ALL facultades or only their assigned one? (Schema supports multi-facultad but seed creates 1)
- [ ] PDF templates: exact UNT institutional format fields need confirmation from stakeholders (Formato N°1 details)
