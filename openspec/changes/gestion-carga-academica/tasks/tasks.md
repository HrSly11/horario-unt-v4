# Tasks: Gestión de Carga Académica Integral

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~3700-4000 total across 29 files |
| 400-line budget risk | High — 10 stacked PRs required |
| Chained PRs recommended | Yes |
| Delivery strategy | auto-chain |
| Chain strategy | stacked-to-main |

### Suggested Work Units

| Unit | Goal | Lines | Base |
|------|------|-------|------|
| 1 | Migration + Seed | ~380 | main |
| 2 | Org routers (facultad, departamento, escuela) | ~370 | main |
| 3 | CargaLectiva router + validator (tests colocated) | ~400 | main |
| 4 | CargaNoLectiva router | ~280 | main |
| 5 | Declaracion router (state machine) | ~350 | main |
| 6 | Horario-Personal view + WeeklyGrid | ~380 | main |
| 7 | Carga-Lectiva + Carga-NoLectiva views | ~370 | main |
| 8 | Declaraciones + Organizacion views | ~390 | main |
| 9 | PDF templates + DeclaracionPDF router | ~390 | main |
| 10 | Sidebar + Dashboard + Docentes fields + Formatos | ~370 | main |

All slices are stacked directly to main (independent feature slices, each autonomous).

---

## Slice 1: Schema Migration + Seed (PR #1)

- [ ] 1.1 Run `npx prisma migrate dev --name add_carga_academica` to generate migration from current schema
- [ ] 1.2 Update `prisma/seed.ts` — add `deleteMany` for new models in FK-safe order (DeclaracionCarga→CargaNoLectiva→AsignacionCargaLectiva→CursoCurricula→Curricula→Escuela→Departamento→Facultad before existing deletes)
- [ ] 1.3 Seed: 1 Facultad (Ingeniería), 2 Departamentos, 1 Escuela, 1 Curricula (6 cursos via CursoCurricula)
- [ ] 1.4 Seed: 8 users with new roles (ADMIN, DECANO, DIRECTOR_DEPARTAMENTO, DIRECTOR_ESCUELA, SECRETARIA_DEPARTAMENTO, 3 DOCENTES)
- [ ] 1.5 Seed: 3 Docentes with dni, codigoIBM, modalidad, horasContrato, departamentoId
- [ ] 1.6 Seed: 12 AsignacionCargaLectiva entries (2 shared T/P splits), 6 CargaNoLectiva (one per type), 5 DeclaracionCarga (different states)
- [ ] 1.7 Verify: `npx prisma db seed` runs clean, all data queryable via `npx prisma studio`

## Slice 2: Organizational Routers (PR #2)

- [ ] 2.1 Create `src/server/trpc/routers/facultad.ts` — CRUD (list, byId, create, update, delete), adminProcedure
- [ ] 2.2 Create `src/server/trpc/routers/departamento.ts` — CRUD + designarDirector (sets directorId+fechaDesignacion), adminProcedure + decanoProcedure
- [ ] 2.3 Create `src/server/trpc/routers/escuela.ts` — CRUD + designarDirector + listByFacultad, adminProcedure + decanoProcedure
- [ ] 2.4 Modify `src/server/trpc/routers/_app.ts` — import + register facultad, departamento, escuela routers
- [ ] 2.5 Test (co-located): `departamento.test.ts` — verify CRUD via createCallerFactory with mock context

## Slice 3: CargaLectiva Router + Workload Validator (PR #3)

- [ ] 3.1 Create `src/server/services/workload-validator.ts` — pure functions: validateDailyLimit, validateWeeklyLimit, validateNoOverlap, validateAll (router-facing, fetches via ctx.prisma)
- [ ] 3.2 Create `src/server/services/workload-validator.test.ts` (TDD: RED first) — test each rule: 8h/day, 40h/week TC/DE, no overlaps, TP per contrato, totals=contrato, preparacion≤50%, DE not dicta otra U
- [ ] 3.3 Create `src/server/trpc/routers/cargaLectiva.ts` — assign (validates via validateAll, then creates), list (filter by depto+periodo), unassign, secretariaDepartamentoProcedure + directorDepartamentoProcedure
- [ ] 3.4 Modify `_app.ts` — register cargaLectiva router

## Slice 4: CargaNoLectiva Router (PR #4)

- [ ] 4.1 Create `src/server/trpc/routers/cargaNoLectiva.ts` — create, update, delete, list (self + byDocente for secretaria), docenteProcedure + secretariaDepartamentoProcedure
- [ ] 4.2 Implement auto-calc: PREPARACION_EVALUACION hours ≤ 50% lectivas (fetch AsignacionCargaLectiva total on create/update)
- [ ] 4.3 Add conditional fields validation (codigoProyecto for INVESTIGACION, numAlumnos for ASESORIA_TESIS/CONSEJERIA, ciclo for CONSEJERIA)
- [ ] 4.4 Modify `_app.ts` — register cargaNoLectiva router

## Slice 5: Declaracion Router — State Machine (PR #5)

- [ ] 5.1 Create `src/server/trpc/routers/declaracion.ts` — create (BORRADOR, unique per docente+periodo), enviar (validates totals+preparacion+DE), list, byId (include all nested)
- [ ] 5.2 Add state transitions: aprobarDepto (ENVIADA→APROBADA_DEPARTAMENTO), aprobarEscuela (APROBADA_DEPARTAMENTO→APROBADA_ESCUELA), vbDecano (APROBADA_ESCUELA→FINALIZADA)
- [ ] 5.3 Add rechazar (any state→RECHAZADA, required observaciones) + reabrir (RECHAZADA→BORRADOR)
- [ ] 5.4 Add `declaracion.test.ts` (TDD): invalid transitions throw, valid transitions set timestamps+firmas
- [ ] 5.5 Modify `_app.ts` — register declaracion router

## Slice 6: Horario Personal View (PR #6)

- [ ] 6.1 Create `src/app/(dashboard)/horario-personal/components/WeeklyGrid.tsx` — CSS Grid 6-col (LUNES–SABADO), rows 7:00–21:00, click-to-toggle slots colored by TipoCargaNoLectiva, lective blocks read-only (gray), daily total bar (red if >8h)
- [ ] 6.2 Create `src/app/(dashboard)/horario-personal/page.tsx` — container with PeriodoSelector, WeeklyGrid, TotalsSummary (lectiva+noLectiva vs contrato), NonLectiveEditor sidebar (TipoSelector, hours, descripcion)
- [ ] 6.3 Wire tRPC queries: cargaLectiva.list (read-only blocks), cargaNoLectiva.list (editable slots), refetchInterval: 30000

## Slice 7: Carga Lectiva + No Lectiva Views (PR #7)

- [ ] 7.1 Create `src/app/(dashboard)/carga-lectiva/page.tsx` — table (docente, curso, grupo, tipo, horas, shared), filter by departamento+periodo, assign modal (select docente+grupo+tipo+horas, validate on submit), unassign action
- [ ] 7.2 Create `src/app/(dashboard)/carga-no-lectiva/page.tsx` — teacher self-entry form (tipo dropdown, hours, conditional fields), list of own entries grouped by tipo, totals bar (lectiva+noLectiva vs contrato), edit/delete only for BORRADOR state

## Slice 8: Declaraciones + Organización Views (PR #8)

- [ ] 8.1 Create `src/app/(dashboard)/organizacion/page.tsx` — tabs (Facultad/Departamentos/Escuelas/Curriculas), CRUD tables per tab, designar director modals (decanos only)
- [ ] 8.2 Create `src/app/(dashboard)/declaraciones/page.tsx` — DeclaracionTable (rows: docente, estado, totales, actions), StatusBadge color-coded, DeclaracionDetailModal with WorkflowTimeline (visual 5-state stepper), LectiveTable+NonLectiveTable read-only, ApprovalSection role-conditional
- [ ] 8.3 Wire declaracion router mutations: enviar, aprobarDepto, aprobarEscuela, vbDecano, rechazar, reabrir

## Slice 9: PDF Templates + DeclaracionPDF Router (PR #9)

- [ ] 9.1 Create `src/server/services/reports/declaracion-templates.ts` — 3 functions: templateFormatoN1 (carga horaria table + 9 no-lectiva sections + 3 firmas), templateFormatoN2 (DJ sede central), templateFormatoN3 (sedes descentralizadas). Each returns HTML with Times New Roman CSS.
- [ ] 9.2 Create `src/server/trpc/routers/declaracionPDF.ts` — generate procedure: fetches docente+asignaciones+cargasNoLectivas+declaracion via Prisma include, calls template, renders via renderPDF(), returns `{ pdfBase64, filename }`
- [ ] 9.3 Test: vitest + jsdom validates N1 HTML contains docente name, curso names, hours totals, signature lines
- [ ] 9.4 Modify `_app.ts` — register declaracionPDF router

## Slice 10: Sidebar + Dashboard + Docentes + Formatos (PR #10)

- [ ] 10.1 Refactor `src/components/layout/sidebar.tsx` — replace if/else chain with `ROLE_NAV_MAP: Record<UserRole, NavItem[]>`, add DIRECTOR_DEPARTAMENTO, SECRETARIA_DEPARTAMENTO, DECANO navigation; add DOCENTE: Horario Personal + Formatos
- [ ] 10.2 Modify `src/app/(dashboard)/page.tsx` — add role-based dashboard sections: DIRECTOR_DEPARTAMENTO (docentes+%, declaraciones pendientes), DECANO (resumen facultad, VB pendientes), DOCENTE (estado declaracion, progreso carga)
- [ ] 10.3 Modify `src/app/(dashboard)/docentes/page.tsx` — add dni, codigoIBM, modalidad, horasContrato, departamento fields to form and table
- [ ] 10.4 Create `src/app/(dashboard)/formatos/page.tsx` — PDF selector (N1/N2/N3 radio + docente+periodo), preview button (opens base64 in new tab), download button, ZIP download all 3 formatos
