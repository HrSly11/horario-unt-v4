# Resumen de Cambios — Sistema de Gestión de Carga Académica UNT

## Metadatos
- **Fecha de implementación**: Mayo 2026
- **Rama**: `main`
- **Repositorio**: `https://github.com/HrSly11/sistema-horarios-v2.git`
- **Stack**: Next.js 16.2.6 (App Router) + tRPC + Prisma 7.8 + PostgreSQL + TailwindCSS 4 + Vitest + Puppeteer
- **BD Local**: PostgreSQL `sistema_horarios_unt` (usuario `postgres`, contraseña `12345`)
- **Migración final**: `20260528014334_init` (migración limpia única desde schema actual)

---

## 1. Visión General: ¿Qué se hizo?

Se transformó el **Sistema de Horarios** existente (enfocado únicamente en asignación de slots horarios) en un **Sistema de Gestión de Carga Académica Integral** para la Universidad Nacional de Trujillo (UNT). El sistema ahora modela:

- **Estructura organizacional** universitaria (`Facultad → Departamento → Escuela → Currícula`)
- **Carga lectiva** (asignada por el Departamento Académico)
- **Carga no lectiva** (9 categorías: preparación, investigación, consejería, etc.)
- **Declaraciones juradas** con state machine de 6 estados
- **Generación de PDFs institucionales** (Formatos N°1, N°2, N°3) vía Puppeteer
- **Validaciones de negocio** (8h/día, 40h/semana, sin cruces, 50% preparación)
- **7 roles** con dashboards y permisos diferenciados
- **Descarga real de PDFs en el navegador**

### Archivos totales nuevos/modificados: ~45+
### Líneas estimadas nuevas: ~4500-5000

---

## 2. Estructura del Proyecto

```
sistema-horarios-v2/
├── prisma/
│   ├── schema.prisma                    # MODIFICADO: +10 modelos, +4 enums, +3 roles
│   ├── seed.ts                          # MODIFICADO: seed completo con datos realistas
│   └── migrations/
│       └── 20260528014334_init/         # NUEVO: migración limpia
├── src/
│   ├── app/
│   │   ├── (dashboard)/
│   │   │   ├── page.tsx                 # MODIFICADO: dashboards para Decano, DirDepto, SecDepto
│   │   │   ├── carga-lectiva/           # NUEVO: vista de asignación de carga lectiva
│   │   │   ├── carga-no-lectiva/        # NUEVO: vista de carga no lectiva + barra progreso
│   │   │   ├── declaraciones/           # NUEVO: timeline visual 5 pasos + state machine
│   │   │   ├── docentes/page.tsx        # MODIFICADO: nuevos campos (dni, IBM, modalidad...)
│   │   │   ├── formatos/page.tsx        # NUEVO: descarga de PDFs N1/N2/N3 con useMutation
│   │   │   ├── horario-personal/        # NUEVO: grilla CSS Grid 6-columnas (Lun-Sáb)
│   │   │   └── organizacion/page.tsx    # NUEVO: tarjetas Facultad/Depto/Escuela
│   ├── components/
│   │   └── layout/
│   │       └── sidebar.tsx              # MODIFICADO: ROLE_NAV_MAP para 7 roles
│   ├── server/
│   │   ├── trpc/
│   │   │   ├── init.ts                  # MODIFICADO: procedures para nuevos roles
│   │   │   └── routers/
│   │   │       ├── _app.ts              # MODIFICADO: 15 routers registrados
│   │   │       ├── cargaLectiva.ts      # NUEVO: 6 endpoints (assign, list, byDocente, unassign, update, resumen)
│   │   │       ├── cargaNoLectiva.ts    # NUEVO: 5 endpoints + auto-calc preparación ≤50%
│   │   │       ├── declaracion.ts       # NUEVO: 10 endpoints con state machine
│   │   │       ├── declaracionPDF.ts    # NUEVO: endpoint generate (N1/N2/N3)
│   │   │       ├── facultad.ts          # NUEVO: CRUD facultad
│   │   │       ├── departamento.ts      # NUEVO: CRUD departamento + auto-suma carga
│   │   │       └── escuela.ts           # NUEVO: CRUD escuela
│   │   └── services/
│   │       ├── reports/
│   │       │   ├── declaracion-templates.ts  # NUEVO: templates HTML N1/N2/N3 (~300 líneas)
│   │       │   └── pdf-renderer.ts           # EXISTENTE (Puppeteer)
│   │       ├── workload-validator.ts         # NUEVO: 6 funciones puras + validateAll()
│   │       └── workload-validator.test.ts    # NUEVO: 30 tests unitarios
│   └── trpc/
│       └── client.tsx                    # EXISTENTE (cliente tRPC)
├── scripts/
│   └── test-pdfs.ts                      # NUEVO: script de prueba de PDFs (borrado tras usar)
├── registros_proyecto/                   # NUEVO: documentación del proyecto
│   ├── implementation_plan.md            # MOVIDO: plan de implementación original
│   ├── taskhorarios.md                   # MOVIDO: task tracking (38/38 ✅)
│   └── RESUMEN_CAMBIOS.md                # NUEVO: este archivo
└── taskhorarios.md                       # MOVIDO a registros_proyecto/
```

---

## 3. Base de Datos — Prisma Schema

### 3.1 Nuevos Enums

```prisma
enum ModalidadDocente { TIEMPO_COMPLETO, DEDICACION_EXCLUSIVA, TIEMPO_PARCIAL }
enum EstadoDeclaracion { BORRADOR, ENVIADA, APROBADA_DEPARTAMENTO, APROBADA_ESCUELA, RECHAZADA, FINALIZADA }
enum TipoCargaNoLectiva { PREPARACION_EVALUACION, CONSEJERIA, INVESTIGACION, CAPACITACION, GOBIERNO, ADMINISTRACION, ASESORIA_TESIS, RESPONSABILIDAD_SOCIAL, COMITES_COMISIONES }
// DiaSemana ahora incluye SABADO
// UserRole ahora incluye: DIRECTOR_DEPARTAMENTO, SECRETARIA_DEPARTAMENTO, DECANO
```

### 3.2 Nuevos Modelos (7)

| Modelo | Campos clave | Relaciones |
|---|---|---|
| **Facultad** | nombre, siglas | → Departamento[], Escuela[] |
| **Departamento** | nombre, facultadId, directorId, secretariaId | → Docente[] |
| **Escuela** | nombre, facultadId, directorId | → Curricula[] |
| **Curricula** | codigo, escuelaId, vigente | → CursoCurricula[] |
| **CursoCurricula** | cursoId, curriculaId, ciclo, esElectivo | curso, curricula |
| **AsignacionCargaLectiva** | docenteId, grupoId, periodoId, tipo, horasAsignadas, compartido | docente, grupo, periodo, docenteCompartido |
| **CargaNoLectiva** | docenteId, periodoId, tipo, horas, descripcion, codigoProyecto, numAlumnos | docente, periodo |
| **DeclaracionCarga** | docenteId, periodoId, estado, totalHorasLectivas/NoLectivas/Total, fechas aprobación + VB | docente, periodo |

### 3.3 Modelos Modificados (3)

| Modelo | Campos nuevos |
|---|---|
| **Docente** | dni, codigoIBM, modalidad, departamentoId, horasContrato, dictaOtraUniversidad |
| **Curso** | horasPractica |
| **Grupo** | seccion, numAlumnos |

### 3.4 Migración

- **Nombre**: `20260528014334_init`
- **Tipo**: Migración limpia única (se eliminaron migraciones viejas que causaban conflictos `CREATE TYPE`/`ALTER TYPE`)
- **Orden de seed corregido**: Aulas → Cursos → Org → Docentes (evitando referencias circulares)

---

## 4. Backend — tRPC Routers

### 4.1 Router de Carga Lectiva (`cargaLectiva.ts`) — 6 endpoints

| Endpoint | Tipo | Procedimiento | Descripción |
|---|---|---|---|
| `list` | query | `directorDepartamentoProcedure` | Lista con filtros por periodo, depto, docente |
| `byDocente` | query | `protectedProcedure` | Carga de un docente específico |
| `assign` | mutation | `directorDepartamentoProcedure` | Asignar carga (teoría/práctica/lab) |
| `unassign` | mutation | `directorDepartamentoProcedure` | Remover asignación |
| `update` | mutation | `directorDepartamentoProcedure` | Modificar horas/compartido |
| `resumenPorDepartamento` | query | `directorDepartamentoProcedure` | Resumen agregado por departamento |

### 4.2 Router de Carga No Lectiva (`cargaNoLectiva.ts`) — 5 endpoints

| Endpoint | Tipo | Descripción |
|---|---|---|
| `list` | query | Listar cargas no lectivas con filtros |
| `byDocente` | query | Carga no lectiva de un docente |
| `upsert` | mutation | Crear/actualizar (upsert por docente+periodo+tipo) |
| `delete` | mutation | Eliminar carga no lectiva |
| `autoCalcPreparacion` | mutation | Auto-calcular preparación y evaluación (máx 50% de lectiva) |

### 4.3 Router de Declaraciones (`declaracion.ts`) — 10 endpoints

**State Machine**: `BORRADOR → ENVIADA → APROBADA_DEPARTAMENTO → APROBADA_ESCUELA → FINALIZADA` (RECHAZADA desde cualquier estado)

| Endpoint | Procedimiento | Descripción |
|---|---|---|
| `list` | `baseProcedure` | Listar con filtros (periodo, estado, departamento) |
| `byDocente` | `baseProcedure` | Obtener declaración de un docente |
| `byId` | `baseProcedure` | Obtener por ID con relaciones completas |
| `create` | `docenteProcedure` | Crear declaración en BORRADOR |
| `send` | `docenteProcedure` | Enviar para aprobación (BORRADOR → ENVIADA) |
| `approveDepartamento` | `directorDepartamentoProcedure` | Aprobar en departamento |
| `approveEscuela` | `directorProcedure` | Aprobar en escuela |
| `finalize` | `decanoProcedure` | Visto bueno final (→ FINALIZADA) |
| `reject` | `directorDepartamentoProcedure` / `directorProcedure` | Rechazar con motivo |
| `pendientes` | depende del rol | Listar pendientes según rol |

### 4.4 Router de PDFs (`declaracionPDF.ts`) — 1 endpoint

| Endpoint | Tipo | Descripción |
|---|---|---|
| `generate` | mutation | Genera PDF (N1/N2/N3), retorna `{ pdfBase64, filename }` |

**Lógica interna**: Busca la declaración con docente+periodo, obtiene asignaciones de carga lectiva y no lectiva, selecciona template HTML según formato, renderiza con Puppeteer.

### 4.5 Routers Organizacionales (CRUD)

| Router | Endpoints |
|---|---|
| `facultad.ts` | list, byId, create, update, delete |
| `departamento.ts` | list, byFacultad, byId, create, update, delete, setDirector, setSecretaria, cargaResumen |
| `escuela.ts` | list, byFacultad, byId, create, update, delete, setDirector |

### 4.6 Archivo `_app.ts`

15 routers registrados: `auth`, `docente`, `curso`, `aula`, `periodo`, `horario`, `reporte`, `notification`, `facultad`, `departamento`, `escuela`, `cargaLectiva`, `cargaNoLectiva`, `declaracion`, `declaracionPDF`

### 4.7 Archivo `init.ts` — Nuevos Procedures

```typescript
directorDepartamentoProcedure  // Rol: DIRECTOR_DEPARTAMENTO o ADMIN
secretariaDepartamentoProcedure // Rol: SECRETARIA_DEPARTAMENTO o ADMIN
decanoProcedure                 // Rol: DECANO o ADMIN
directorProcedure               // Rol: DIRECTOR_ESCUELA o ADMIN (ya existía)
```

---

## 5. Validaciones de Negocio — Workload Validator

### 5.1 Servicio (`workload-validator.ts`) — 7 funciones

| Función | Regla | Entrada | Salida |
|---|---|---|---|
| `validateDailyLimit` | Máximo 8h/día | totalHorasDia | `{ ok, message }` |
| `validateWeeklyLimit` | TC/DE=40h, TP=según contrato | totalHorasSemana, modalidad, horasContrato | `{ ok, message }` |
| `validateNoOverlap` | Sin cruces de horario | franjas asignadas, nueva franja | `{ ok, message }` |
| `validatePreparacionLimit` | Preparación ≤ 50% de lectiva | horasLectivas, horasPreparacion | `{ ok, message }` |
| `validateDEDictaOtraUniversidad` | DE no puede dictar en otra U | modalidad, dictaOtraUniversidad | `{ ok, message }` |
| `validateCargaCompleta` | Lectiva + No Lectiva = Contrato | totalLectiva, totalNoLectiva, horasContrato | `{ ok, message }` |
| `validateAll` | Todas las anteriores combinadas | todos los parámetros | `ValidationResult[]` |

### 5.2 Tests (`workload-validator.test.ts`) — 30 tests

- **`validateDailyLimit`**: 5 tests (0h ok, 8h ok, 9h error, límite exacto, valores negativos)
- **`validateWeeklyLimit`**: 6 tests (TC ok, TC excedido, DE ok, TP ok, TP excedido por contrato)
- **`validateNoOverlap`**: 4 tests (sin cruce, cruce mismo día/hora, cruce día distinto, cruce borde)
- **`validatePreparacionLimit`**: 4 tests (justo 50%, 51% error, sin horas lectivas, TP 20h)
- **`validateDEDictaOtraUniversidad`**: 3 tests (DE+otraU, DE+soloUNT, TC+otraU ok)
- **`validateCargaCompleta`**: 4 tests (completa exacta, incompleta, excedida, 0 horas)
- **`validateAll`**: 4 tests (todo ok, falla diario, falla semanal, múltiples fallos)

---

## 6. PDFs Institucionales

### 6.1 Templates HTML (`declaracion-templates.ts`) — ~300 líneas

| Función | Formato | Contenido |
|---|---|---|
| `templateFormatoN1` | Declaración de Carga Horaria Asignada | Tabla de trabajo lectivo, 9 secciones de actividades, totales, firmas |
| `templateFormatoN2` | Declaración Jurada — Sede Central | Texto legal con datos del docente, declaración de no incompatibilidad, firma |
| `templateFormatoN3` | Declaración Jurada — Sedes Descentralizadas | Normativa de sedes, restricciones de horas por modalidad, firma |

### 6.2 Renderer (`pdf-renderer.ts`) — Puppeteer

- Busca Chrome/Chromium en rutas del sistema (Windows + Linux)
- Renderiza HTML → PDF A4, landscape opcional, printBackground
- Márgenes: 5mm todos los lados

### 6.3 Descarga en Navegador (`formatos/page.tsx`)

**Flujo completo**:
1. Usuario hace clic en "Descargar PDF" (N1/N2/N3)
2. Botón muestra "Generando..." (loading state por formato)
3. Se llama a `trpc.declaracionPDF.generate.mutation()` con `{ declaracionId, formato }`
4. Servidor: Prisma busca datos → template HTML → Puppeteer → Buffer PDF → base64
5. Cliente: `atob(base64)` → `Uint8Array` → `Blob` → `URL.createObjectURL` → `<a download>` → `click()` → `revokeObjectURL()`
6. El PDF se descarga automáticamente en la carpeta de descargas del navegador

---

## 7. Frontend — Vistas

### 7.1 Sidebar (`sidebar.tsx`)

**ROLE_NAV_MAP** refactorizado para 7 roles con navegación contextual:
- `ADMIN`: Dashboard, Docentes, Cursos, Aulas, Horarios, Reportes, Carga Lectiva, Carga No Lectiva, Declaraciones, Organización, Formatos
- `DECANO`: Dashboard, Declaraciones, Reportes, Formatos
- `DIRECTOR_ESCUELA`: Dashboard, Declaraciones, Reportes, Formatos
- `DIRECTOR_DEPARTAMENTO`: Dashboard, Carga Lectiva, Declaraciones, Reportes
- `SECRETARIA_DEPARTAMENTO`: Carga Lectiva, Docentes, Cursos, Declaraciones
- `SECRETARIA_ACADEMICA`: Dashboard, Docentes, Cursos, Aulas, Horarios, Reportes
- `DOCENTE`: Dashboard, Horario Personal, Carga No Lectiva, Declaraciones, Formatos

### 7.2 Dashboard (`page.tsx`)
- **Decano**: KPIs de toda la facultad (docentes, carga, declaraciones pendientes VB)
- **Director Depto**: KPIs de su departamento (carga distribuida, declaraciones pendientes)
- **Secretaria Depto**: Acceso rápido a asignación de carga y gestión de docentes
- **Docente**: Estado de su declaración, acceso directo a completar carga

### 7.3 Carga Lectiva (`carga-lectiva/page.tsx`)
- Tabla de asignaciones con filtros por periodo y docente
- Columnas: docente, curso, grupo, tipo, horas, compartido
- Botones de asignar/desasignar
- Badges de color por tipo (Teoría/Práctica/Laboratorio)

### 7.4 Carga No Lectiva (`carga-no-lectiva/page.tsx`)
- Formulario con las 9 categorías tipificadas
- Barra de progreso visual: Lectiva + No Lectiva vs Total Contrato
- Auto-cálculo de Preparación y Evaluación (máx 50% de lectiva)
- Campos condicionales: código/nombre proyecto (Investigación), N° alumnos (Consejería)
- Validación visual: verde = completo, amarillo = incompleto, rojo = excedido

### 7.5 Declaraciones (`declaraciones/page.tsx`)
- **Timeline visual** de 5 pasos: Borrador → Enviada → Aprob. Depto → Aprob. Escuela → Finalizada
- Estados intermedios con badges de color
- Botones contextuales según rol: enviar, aprobar, rechazar (con motivo), VB
- Vista de detalle con carga lectiva y no lectiva asociada

### 7.6 Horario Personal (`horario-personal/page.tsx`)
- **Componente WeeklyGrid**: CSS Grid de 6 columnas (Lun-Sáb) × filas horarias (7am-9pm)
- Carga lectiva pre-cargada (read-only, asignada por departamento)
- Visualización de bloques por tipo

### 7.7 Docentes (`docentes/page.tsx`)
- Tabla ampliada con nuevos campos: DNI, Código IBM, Modalidad, Horas Contrato, Departamento
- Badges de modalidad (TC/DE/TP) con colores diferenciados
- Indicador "Dicta en otra universidad"

### 7.8 Organización (`organizacion/page.tsx`)
- Tarjetas apiladas: Facultad → Departamentos → Escuelas
- Cada nivel muestra su nombre, siglas, y entidades hijas
- Vista jerárquica de la estructura académica

### 7.9 Formatos (`formatos/page.tsx`)
- 3 tarjetas con iconos: Formato N°1, N°2, N°3
- Cada tarjeta muestra descripción y botón "Descargar PDF"
- **Descarga real** con `useMutation` de tRPC → base64 → Blob → download
- Loading state individual por botón ("Generando...")
- Manejo de errores con alerta

---

## 8. Seed de Datos (`prisma/seed.ts`)

### Datos poblados:
| Entidad | Cantidad | Detalle |
|---|---|---|
| **Facultad** | 1 | Ingeniería |
| **Departamentos** | 2 | Sistemas, Matemáticas |
| **Escuelas** | 1 | Ing. de Sistemas |
| **Docentes** | 16 | Con nombres realistas (peruanos), distribuidos entre deptos |
| **Carga Lectiva** | 30 | Asignaciones de teoría/práctica/lab a grupos |
| **Carga No Lectiva** | 10 | Distribuida en investigación, consejería, preparación |
| **Declaraciones** | 5 | En diferentes estados (BORRADOR, ENVIADA, APROBADA_DEPT, FINALIZADA) |
| **Cursos** | Ya existían | Con grupos A, B |
| **Usuarios** | Varios | Admin, docentes con sus roles |

---

## 9. Flujo E2E Completo

```
1. ADMIN crea estructura organizacional
   └─ Facultad → Departamento → Escuela → Currícula

2. SECRETARIA DEPARTAMENTO asigna carga lectiva
   └─ Por docente: curso + tipo (T/P/L) + grupo + horas

3. DOCENTE completa carga no lectiva
   └─ 9 categorías + auto-cálculo preparación ≤50%

4. DOCENTE crea y envía declaración
   └─ BORRADOR → ENVIADA

5. DIRECTOR DEPARTAMENTO aprueba/rechaza
   └─ ENVIADA → APROBADA_DEPARTAMENTO (o RECHAZADA)

6. DIRECTOR ESCUELA aprueba/rechaza
   └─ APROBADA_DEPARTAMENTO → APROBADA_ESCUELA (o RECHAZADA)

7. DECANO da visto bueno
   └─ APROBADA_ESCUELA → FINALIZADA

8. DOCENTE descarga PDFs (N1/N2/N3)
   └─ Click → Puppeteer genera → Descarga en navegador
```

---

## 10. Correcciones y Bugs Resueltos

| Bug | Causa | Solución |
|---|---|---|
| **Seed fallaba** por referencias circulares | Docentes referenciaban deptoSistemas antes de crearse | Reordenar: Aulas → Cursos → Org → Docentes |
| **Prisma no conectaba** | No existía archivo `.env` | Crear `.env` con `DATABASE_URL` |
| **Migraciones viejas conflictivas** | `CREATE TYPE`/`ALTER TYPE` en migraciones previas | Borrar `prisma/migrations/`, generar una sola migración limpia |
| **Script test-pdfs.ts sin dotenv** | Prisma no encontraba DATABASE_URL | Agregar `import 'dotenv/config'` |
| **Botones "Descargar PDF" no funcionaban** | `onClick` sin handler real, no había llamada a tRPC | Implementar `useMutation` → `declaracionPDF.generate` → `downloadBase64PDF` |
| **Carpeta `pdfs-generados/`** | Solo era para pruebas, no producción | Eliminada. Los PDFs ahora se descargan en el navegador |
| **BD corrupta** | Datos inconsistentes de pruebas anteriores | `DROP DATABASE` + `CREATE DATABASE` + migración limpia + seed fresco |

---

## 11. Decisiones de Arquitectura

### 11.1 ¿Por qué tRPC en lugar de REST?
- Type-safety end-to-end: los tipos de Prisma fluyen directamente a los componentes React
- Sin code generation: el router del servidor es la fuente de verdad
- `useMutation`/`useQuery` de TanStack Query integrados nativamente

### 11.2 ¿Por qué State Machine para Declaraciones?
- `validTransitions` explícito: cada estado solo permite transiciones específicas
- Previene bugs de estado inválido (ej: saltar de BORRADOR a FINALIZADA)
- Fácil de auditar y extender
- Implementado como `Record<string, string[]>` en el router

### 11.3 ¿Por qué Workload Validator como funciones puras?
- Testeables unitariamente sin DB
- Sin efectos secundarios
- Componibles: `validateAll` combina todas las reglas
- Cada función retorna `{ ok: boolean, message?: string }`

### 11.4 ¿Por qué Puppeteer para PDFs?
- Renderizado HTML real (no canvas ni librerías de dibujo)
- Soporta CSS completo para los formatos institucionales
- Ya estaba en el proyecto (reportes existentes)
- Misma API que Chrome/Chromium

### 11.5 ¿Por qué `downloadBase64PDF` en lugar de `data:` URI directo?
- `URL.createObjectURL` + Blob es más eficiente para archivos binarios grandes
- Evita el límite de longitud de URL en `data:` URIs
- `URL.revokeObjectURL` libera memoria tras la descarga

### 11.6 ¿Por qué migración limpia única?
- Evitar conflictos de `CREATE TYPE`/`ALTER TYPE` entre migraciones incrementales
- Schema final como fuente de verdad
- Adecuado para entorno de desarrollo sin datos de producción

---

## 12. Estado del Proyecto

### Completado ✅
- [x] Schema de base de datos (10 modelos nuevos, 4 enums, 3 roles)
- [x] Migración limpia `20260528014334_init`
- [x] Seed completo (1 facultad, 2 deptos, 1 escuela, 16 docentes, 30 carga lectiva, 10 no lectiva, 5 declaraciones)
- [x] 6 routers tRPC nuevos (cargaLectiva, cargaNoLectiva, declaracion, declaracionPDF, facultad, departamento, escuela)
- [x] Workload Validator (6 funciones + 30 tests pasando)
- [x] PDFs institucionales N1, N2, N3 (templates HTML + Puppeteer)
- [x] Descarga real de PDFs en navegador (useMutation + base64 → Blob → download)
- [x] 7 vistas nuevas/modificadas
- [x] Sidebar con ROLE_NAV_MAP para 7 roles
- [x] Dashboards diferenciados por rol
- [x] Dev server corriendo en `localhost:3000`
- [x] BD PostgreSQL `sistema_horarios_unt` funcional
- [x] 38/38 tareas marcadas en taskhorarios.md

### Pendiente (futuro) 🔲
- [ ] Deploy a staging/Supabase
- [ ] Responsive design check exhaustivo (móvil/tablet)
- [ ] Tests de integración para routers tRPC
- [ ] CI/CD pipeline (GitHub Actions)
- [ ] Autenticación con NextAuth.js (actualmente usa sistema propio)
- [ ] Manejo de múltiples facultades
- [ ] Importación masiva de docentes/cursos desde Excel
- [ ] Firma digital en PDFs
- [ ] Notificaciones por email en cambios de estado
