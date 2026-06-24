# Proposal: Gestión de Carga Académica Integral

## Intent

Transformar el sistema de horarios en sistema completo de gestión de carga académica universitaria (UNT). El sistema actual solo asigna slots horarios lectivos. Se necesita: estructura organizacional, carga lectiva con cursos compartidos y splits T/P/L, carga no lectiva (9 tipos), workflow de declaración multi-paso, 3 PDFs institucionales, horario personal drag-and-drop, y validación de límites horarios.

## Scope

### In Scope
- CRUD organizacional: Facultad → Departamento → Escuela → Curricula
- Asignación carga lectiva con cursos compartidos y splits teoría/práctica/laboratorio
- Carga no lectiva (9 tipos) completada por docente
- Workflow declaración: Borrador → Enviada → Aprobada Depto → Aprobada Escuela → VB Decano → Finalizada
- PDFs: Formato N°1 (carga horaria), N°2 (declaración jurada sede central), N°3 (sedes descentralizadas)
- Horario personal drag-and-drop para carga no lectiva
- Validación: 8h/día, 40h/semana, sin solapamientos
- Designación de directores por Decano
- Roles nuevos: DIRECTOR_DEPARTAMENTO, SECRETARIA_DEPARTAMENTO, DECANO
- Migración schema + seed + tests

### Out of Scope
- Elección de representante docente (Phase 2)
- Firmas digitales — boolean flags actuales se mantienen (Phase 2+)

## Capabilities

### New Capabilities
- `organizational-structure`: Jerarquía Facultad/Departamento/Escuela/Curricula
- `carga-lectiva`: Asignación carga lectiva con cursos compartidos
- `carga-no-lectiva`: Actividades no lectivas (9 tipos, totales horarios)
- `declaracion`: Workflow multi-paso de declaración de carga
- `declaracion-pdf`: Generación 3 formatos PDF institucionales (Puppeteer)
- `horario-personal`: Vista docente con carga lectiva (read-only) + no lectiva (DnD)
- `workload-validation`: Límites 8h/día, 40h/semana, sin solapamientos

### Modified Capabilities
- `docente-management`: Campos DNI, código IBM, modalidad, horasContrato, departamento
- `curso-management`: horasPractica, relación Curricula
- `grupo-management`: Campo seccion, numAlumnos
- `navigation`: Sidebar con roles DIRECTOR_DEPARTAMENTO, SECRETARIA_DEPARTAMENTO, DECANO

## Approach

Schema diseñado (requiere generar migración fresh + agregar unique constraints). Seguir patrón de código existente: tRPC routers (~200-400 líneas c/u), vistas Next.js (~200-400 líneas c/u), servicios con vitest co-ubicados. PDFs con Puppeteer siguiendo patrón de `templates.ts`. Chained PRs (~10, ≤400 líneas c/u): Schema+Seed → Routers → Vistas → PDFs.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `prisma/schema.prisma` | Modified | ~10 modelos nuevos, 4 modificados, unique constraints |
| `src/server/trpc/routers/` | New | 7 routers: cargaLectiva, cargaNoLectiva, declaracion, declaracionPDF, facultad, departamento, escuela |
| `src/server/trpc/_app.ts` | Modified | Registrar 7 routers nuevos |
| `src/server/services/` | New | workload-validator.ts, declaracion-pdf.ts |
| `src/app/(dashboard)/` | New + Modified | 6 páginas nuevas, modificar docentes, dashboard, sidebar |
| `prisma/seed.ts` | Modified | Datos organizacionales, roles nuevos |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Migración fresh sin staging previo | High | `prisma migrate dev` + testear en branch Supabase |
| Drag-and-drop sin librería en `package.json` | High | Evaluar `@dnd-kit/core`; fallback click-to-select |
| AsignacionCargaLectiva sin unique constraints | Med | Agregar `@@unique([docenteId, grupoId, periodoId, tipo])` |
| Scope real ~8800 líneas vs ~7000 estimado | Med | Chained PRs ≤400 líneas c/u |
| Seed data insuficiente bloquea E2E | Med | Priorizar seed en PR #1 |

## Rollback Plan

1. Revertir migración: `prisma migrate down` o restaurar backup de staging
2. Revertir código: revertir PRs en orden inverso
3. Schema original preservado en migración `20260517045725_init`

## Dependencies

- Puppeteer (existente, configurado)
- `@dnd-kit/core` (a evaluar en design)
- Prisma CLI (existente)

## Success Criteria

- [ ] Secretaria asigna carga lectiva con cursos compartidos y splits T/P/L
- [ ] Docente completa carga no lectiva, visualiza totales respetando ≤40h/semana
- [ ] Flujo declaración completo Borrador → Finalizada con aprobaciones
- [ ] 3 PDFs institucionales generados con datos reales
- [ ] Horario personal: carga lectiva read-only + no lectiva drag-and-drop
- [ ] Validación rechaza solapamientos, excesos 8h/día, 40h/semana
- [ ] Decano designa directores de Escuela y Departamento
- [ ] Tests workload-validator + integración routers pasan
