-- Immutable boundary 2: workflow aggregates plus compatible legacy-opening materialization.
CREATE TYPE "EstadoRevisionWorkflow" AS ENUM ('BORRADOR', 'ENVIADA', 'APROBADA', 'OBSERVADA', 'RECHAZADA');
CREATE TYPE "TipoComponenteLectivo" AS ENUM ('TEORIA', 'PRACTICA', 'LABORATORIO');
CREATE TYPE "EstadoCobertura" AS ENUM ('CUBIERTA', 'PENDIENTE');
CREATE TYPE "RolAsignacionDocente" AS ENUM ('PRINCIPAL', 'SECUNDARIO');
CREATE TYPE "EstadoProcesoHorario" AS ENUM ('BORRADOR', 'REVISION', 'OBSERVADO', 'APROBADO', 'PUBLICADO_PRELIMINAR');
CREATE TYPE "CargoAcademico" AS ENUM ('JEFE_DEPARTAMENTO', 'DIRECTOR_ESCUELA', 'DECANO');
CREATE TYPE "RolFirmanteDocumento" AS ENUM ('DOCENTE', 'JEFE', 'DECANO');
ALTER TYPE "EstadoDeclaracion" ADD VALUE IF NOT EXISTS 'OBSERVADA';
ALTER TYPE "EstadoDeclaracion" ADD VALUE IF NOT EXISTS 'APROBADA_DECANO';
ALTER TYPE "TipoCargaNoLectiva" ADD VALUE IF NOT EXISTS 'JURADOS';
ALTER TYPE "TipoCargaNoLectiva" ADD VALUE IF NOT EXISTS 'AUTOEVALUACION_ACREDITACION';
ALTER TYPE "TipoCargaNoLectiva" ADD VALUE IF NOT EXISTS 'OTRAS_AUTORIZADAS';
ALTER TYPE "TipoDocumentoFirma" ADD VALUE IF NOT EXISTS 'F01';
ALTER TYPE "TipoDocumentoFirma" ADD VALUE IF NOT EXISTS 'F02';
ALTER TYPE "TipoDocumentoFirma" ADD VALUE IF NOT EXISTS 'F03';

ALTER TABLE "grupos" ADD COLUMN "demanda_linea_id" TEXT, ADD COLUMN "proceso_horario_id" TEXT;
ALTER TABLE "asignaciones" ADD COLUMN "proceso_horario_id" TEXT;
ALTER TABLE "asignaciones_carga_lectiva" ADD COLUMN "distribucion_id" TEXT, ADD COLUMN "cobertura_id" TEXT,
  ADD COLUMN "rol" "RolAsignacionDocente" NOT NULL DEFAULT 'PRINCIPAL';
ALTER TABLE "documentos_firmas_digitales" ADD COLUMN "firmante_rol" "RolFirmanteDocumento" NOT NULL DEFAULT 'DOCENTE';

CREATE TABLE "demandas_academicas" (
  "id" TEXT NOT NULL, "escuela_id" TEXT NOT NULL, "periodo_id" TEXT NOT NULL,
  "estado" "EstadoRevisionWorkflow" NOT NULL DEFAULT 'BORRADOR', "observacion" TEXT,
  "enviada_por_id" TEXT, "enviada_en" TIMESTAMP(3), "revisada_por_id" TEXT, "revisada_en" TIMESTAMP(3),
  "version" INTEGER NOT NULL DEFAULT 1, "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL, CONSTRAINT "demandas_academicas_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "demanda_lineas" (
  "id" TEXT NOT NULL, "demanda_id" TEXT NOT NULL, "curso_id" TEXT NOT NULL, "departamento_id" TEXT NOT NULL,
  "horas_teoria" INTEGER NOT NULL, "horas_practica" INTEGER NOT NULL, "horas_laboratorio" INTEGER NOT NULL,
  "num_grupos_laboratorio" INTEGER NOT NULL DEFAULT 0, "motivo_apertura_excepcional" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "demanda_lineas_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "demanda_lineas_curriculas" (
  "id" TEXT NOT NULL, "demanda_linea_id" TEXT NOT NULL, "curricula_id" TEXT NOT NULL, "ciclo" INTEGER NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "demanda_lineas_curriculas_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "distribuciones_lectivas" (
  "id" TEXT NOT NULL, "departamento_id" TEXT NOT NULL, "periodo_id" TEXT NOT NULL,
  "estado" "EstadoRevisionWorkflow" NOT NULL DEFAULT 'BORRADOR', "observacion" TEXT,
  "enviada_por_id" TEXT, "enviada_en" TIMESTAMP(3), "revisada_por_id" TEXT, "revisada_en" TIMESTAMP(3),
  "version" INTEGER NOT NULL DEFAULT 1, "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL, CONSTRAINT "distribuciones_lectivas_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "coberturas_componentes" (
  "id" TEXT NOT NULL, "distribucion_id" TEXT NOT NULL, "demanda_linea_id" TEXT NOT NULL,
  "componente" "TipoComponenteLectivo" NOT NULL, "grupo_laboratorio" INTEGER NOT NULL DEFAULT 0,
  "estado" "EstadoCobertura" NOT NULL DEFAULT 'PENDIENTE', "motivo_pendiente" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "coberturas_componentes_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "procesos_horario_escuela" (
  "id" TEXT NOT NULL, "escuela_id" TEXT NOT NULL, "periodo_id" TEXT NOT NULL,
  "estado" "EstadoProcesoHorario" NOT NULL DEFAULT 'BORRADOR', "observacion" TEXT,
  "revisado_por_id" TEXT, "revisado_en" TIMESTAMP(3), "publicado_por_id" TEXT, "publicado_en" TIMESTAMP(3),
  "version" INTEGER NOT NULL DEFAULT 1, "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL, CONSTRAINT "procesos_horario_escuela_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "cargos_docentes" (
  "id" TEXT NOT NULL, "docente_id" TEXT NOT NULL, "periodo_id" TEXT NOT NULL, "cargo" "CargoAcademico" NOT NULL,
  "departamento_id" TEXT, "escuela_id" TEXT, "facultad_id" TEXT, "resolucion" TEXT, "evidencia" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "cargos_docentes_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "cargos_docentes_scope_check" CHECK (
    ("cargo" = 'JEFE_DEPARTAMENTO' AND "departamento_id" IS NOT NULL AND "escuela_id" IS NULL AND "facultad_id" IS NULL) OR
    ("cargo" = 'DIRECTOR_ESCUELA' AND "departamento_id" IS NULL AND "escuela_id" IS NOT NULL AND "facultad_id" IS NULL) OR
    ("cargo" = 'DECANO' AND "departamento_id" IS NULL AND "escuela_id" IS NULL AND "facultad_id" IS NOT NULL)
  )
);
CREATE TABLE "reglas_carga_por_cargo" (
  "id" TEXT NOT NULL, "cargo" "CargoAcademico" NOT NULL, "codigo_actividad" TEXT NOT NULL,
  "tipo_carga_no_lectiva" "TipoCargaNoLectiva", "horas_lectivas_minimas" INTEGER, "horas_no_lectivas" INTEGER,
  "requiere_evidencia" BOOLEAN NOT NULL DEFAULT true, "activa" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "reglas_carga_por_cargo_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "publicaciones_academicas" (
  "id" TEXT NOT NULL, "facultad_id" TEXT NOT NULL, "periodo_id" TEXT NOT NULL, "snapshot" JSONB NOT NULL,
  "document_hashes" JSONB NOT NULL, "publicada_por_id" TEXT NOT NULL,
  "publicada_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "version" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "publicaciones_academicas_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "demandas_academicas_escuela_id_periodo_id_key" ON "demandas_academicas"("escuela_id", "periodo_id");
CREATE UNIQUE INDEX "demanda_lineas_demanda_id_curso_id_key" ON "demanda_lineas"("demanda_id", "curso_id");
CREATE INDEX "demanda_lineas_departamento_id_idx" ON "demanda_lineas"("departamento_id");
CREATE UNIQUE INDEX "demanda_lineas_curriculas_linea_curricula_key" ON "demanda_lineas_curriculas"("demanda_linea_id", "curricula_id");
CREATE UNIQUE INDEX "distribuciones_lectivas_departamento_periodo_key" ON "distribuciones_lectivas"("departamento_id", "periodo_id");
CREATE UNIQUE INDEX "coberturas_componentes_distribucion_linea_tipo_grupo_key" ON "coberturas_componentes"("distribucion_id", "demanda_linea_id", "componente", "grupo_laboratorio");
CREATE UNIQUE INDEX "procesos_horario_escuela_escuela_periodo_key" ON "procesos_horario_escuela"("escuela_id", "periodo_id");
CREATE UNIQUE INDEX "cargos_docentes_docente_periodo_cargo_key" ON "cargos_docentes"("docente_id", "periodo_id", "cargo");
CREATE UNIQUE INDEX "reglas_carga_por_cargo_cargo_actividad_key" ON "reglas_carga_por_cargo"("cargo", "codigo_actividad");
CREATE UNIQUE INDEX "publicaciones_academicas_facultad_periodo_key" ON "publicaciones_academicas"("facultad_id", "periodo_id");
DROP INDEX IF EXISTS "asignaciones_carga_lectiva_grupo_id_periodo_id_tipo_key";
CREATE UNIQUE INDEX "asignaciones_carga_lectiva_docente_grupo_periodo_tipo_lab_key" ON "asignaciones_carga_lectiva"("docente_id", "grupo_id", "periodo_id", "tipo", "grupo_laboratorio");
CREATE UNIQUE INDEX "asignaciones_carga_lectiva_cobertura_docente_rol_key" ON "asignaciones_carga_lectiva"("cobertura_id", "docente_id", "rol");
DROP INDEX IF EXISTS "documentos_firmas_digitales_declaracion_id_tipo_version_key";
CREATE UNIQUE INDEX "documentos_firmas_digitales_declaracion_tipo_rol_version_key" ON "documentos_firmas_digitales"("declaracion_id", "tipo", "firmante_rol", "version");

-- Materialize only openings with one school provenance and a reconciled department.
WITH opening_scope AS (
  SELECT c."id" AS curso_id, MIN(cu."escuela_id") AS escuela_id, p."id" AS periodo_id
  FROM "cursos" c JOIN "cursos_curriculas" cc ON cc."curso_id" = c."id" AND cc."desasociada_en" IS NULL
  JOIN "curriculas" cu ON cu."id" = cc."curricula_id" CROSS JOIN "periodos_academicos" p
  WHERE c."aperturado" = true AND c."departamento_id" IS NOT NULL AND p."activo" = true
  GROUP BY c."id", p."id" HAVING COUNT(DISTINCT cu."escuela_id") = 1
)
INSERT INTO "demandas_academicas" ("id", "escuela_id", "periodo_id", "estado", "version", "created_at", "updated_at")
SELECT md5('demanda:' || escuela_id || ':' || periodo_id), escuela_id, periodo_id, 'APROBADA', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM opening_scope GROUP BY escuela_id, periodo_id ON CONFLICT ("escuela_id", "periodo_id") DO NOTHING;

WITH opening_scope AS (
  SELECT c.*, MIN(cu."escuela_id") AS escuela_id, p."id" AS periodo_id
  FROM "cursos" c JOIN "cursos_curriculas" cc ON cc."curso_id" = c."id" AND cc."desasociada_en" IS NULL
  JOIN "curriculas" cu ON cu."id" = cc."curricula_id" CROSS JOIN "periodos_academicos" p
  WHERE c."aperturado" = true AND c."departamento_id" IS NOT NULL AND p."activo" = true
  GROUP BY c."id", p."id" HAVING COUNT(DISTINCT cu."escuela_id") = 1
)
INSERT INTO "demanda_lineas" ("id", "demanda_id", "curso_id", "departamento_id", "horas_teoria", "horas_practica", "horas_laboratorio", "num_grupos_laboratorio", "motivo_apertura_excepcional", "created_at", "updated_at")
SELECT md5('linea:' || os."id" || ':' || os.periodo_id), d."id", os."id", os."departamento_id", os."horas_teoria", os."horas_practica", os."horas_laboratorio",
       CASE WHEN os."horas_laboratorio" > 0 THEN os."num_grupos_laboratorio" ELSE 0 END, os."motivo_apertura_excepcional", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM opening_scope os JOIN "demandas_academicas" d ON d."escuela_id" = os.escuela_id AND d."periodo_id" = os.periodo_id
ON CONFLICT ("demanda_id", "curso_id") DO NOTHING;

INSERT INTO "demanda_lineas_curriculas" ("id", "demanda_linea_id", "curricula_id", "ciclo", "created_at")
SELECT md5('provenance:' || dl."id" || ':' || cu."id"), dl."id", cu."id", cc."ciclo", CURRENT_TIMESTAMP
FROM "demanda_lineas" dl JOIN "demandas_academicas" d ON d."id" = dl."demanda_id"
JOIN "cursos_curriculas" cc ON cc."curso_id" = dl."curso_id" AND cc."desasociada_en" IS NULL
JOIN "curriculas" cu ON cu."id" = cc."curricula_id" AND cu."escuela_id" = d."escuela_id"
ON CONFLICT ("demanda_linea_id", "curricula_id") DO NOTHING;

INSERT INTO "procesos_horario_escuela" ("id", "escuela_id", "periodo_id", "estado", "version", "created_at", "updated_at")
SELECT md5('proceso:' || d."escuela_id" || ':' || d."periodo_id"), d."escuela_id", d."periodo_id", 'BORRADOR', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "demandas_academicas" d WHERE EXISTS (SELECT 1 FROM "demanda_lineas" dl WHERE dl."demanda_id" = d."id")
ON CONFLICT ("escuela_id", "periodo_id") DO NOTHING;

ALTER TABLE "demandas_academicas" ADD CONSTRAINT "demandas_escuela_fkey" FOREIGN KEY ("escuela_id") REFERENCES "escuelas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "demandas_academicas" ADD CONSTRAINT "demandas_periodo_fkey" FOREIGN KEY ("periodo_id") REFERENCES "periodos_academicos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "demandas_academicas" ADD CONSTRAINT "demandas_enviada_por_fkey" FOREIGN KEY ("enviada_por_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "demandas_academicas" ADD CONSTRAINT "demandas_revisada_por_fkey" FOREIGN KEY ("revisada_por_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "demanda_lineas" ADD CONSTRAINT "demanda_lineas_demanda_fkey" FOREIGN KEY ("demanda_id") REFERENCES "demandas_academicas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "demanda_lineas" ADD CONSTRAINT "demanda_lineas_curso_fkey" FOREIGN KEY ("curso_id") REFERENCES "cursos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "demanda_lineas" ADD CONSTRAINT "demanda_lineas_departamento_fkey" FOREIGN KEY ("departamento_id") REFERENCES "departamentos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "demanda_lineas_curriculas" ADD CONSTRAINT "demanda_lineas_curriculas_linea_fkey" FOREIGN KEY ("demanda_linea_id") REFERENCES "demanda_lineas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "demanda_lineas_curriculas" ADD CONSTRAINT "demanda_lineas_curriculas_curricula_fkey" FOREIGN KEY ("curricula_id") REFERENCES "curriculas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "distribuciones_lectivas" ADD CONSTRAINT "distribuciones_departamento_fkey" FOREIGN KEY ("departamento_id") REFERENCES "departamentos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "distribuciones_lectivas" ADD CONSTRAINT "distribuciones_periodo_fkey" FOREIGN KEY ("periodo_id") REFERENCES "periodos_academicos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "distribuciones_lectivas" ADD CONSTRAINT "distribuciones_enviada_por_fkey" FOREIGN KEY ("enviada_por_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "distribuciones_lectivas" ADD CONSTRAINT "distribuciones_revisada_por_fkey" FOREIGN KEY ("revisada_por_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "coberturas_componentes" ADD CONSTRAINT "coberturas_distribucion_fkey" FOREIGN KEY ("distribucion_id") REFERENCES "distribuciones_lectivas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "coberturas_componentes" ADD CONSTRAINT "coberturas_demanda_linea_fkey" FOREIGN KEY ("demanda_linea_id") REFERENCES "demanda_lineas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "asignaciones_carga_lectiva" ADD CONSTRAINT "asignaciones_carga_distribucion_fkey" FOREIGN KEY ("distribucion_id") REFERENCES "distribuciones_lectivas"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "asignaciones_carga_lectiva" ADD CONSTRAINT "asignaciones_carga_cobertura_fkey" FOREIGN KEY ("cobertura_id") REFERENCES "coberturas_componentes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "procesos_horario_escuela" ADD CONSTRAINT "procesos_escuela_fkey" FOREIGN KEY ("escuela_id") REFERENCES "escuelas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "procesos_horario_escuela" ADD CONSTRAINT "procesos_periodo_fkey" FOREIGN KEY ("periodo_id") REFERENCES "periodos_academicos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "procesos_horario_escuela" ADD CONSTRAINT "procesos_revisado_por_fkey" FOREIGN KEY ("revisado_por_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "procesos_horario_escuela" ADD CONSTRAINT "procesos_publicado_por_fkey" FOREIGN KEY ("publicado_por_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "grupos" ADD CONSTRAINT "grupos_demanda_linea_fkey" FOREIGN KEY ("demanda_linea_id") REFERENCES "demanda_lineas"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "grupos" ADD CONSTRAINT "grupos_proceso_horario_fkey" FOREIGN KEY ("proceso_horario_id") REFERENCES "procesos_horario_escuela"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "asignaciones" ADD CONSTRAINT "asignaciones_proceso_horario_fkey" FOREIGN KEY ("proceso_horario_id") REFERENCES "procesos_horario_escuela"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "cargos_docentes" ADD CONSTRAINT "cargos_docente_fkey" FOREIGN KEY ("docente_id") REFERENCES "docentes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "cargos_docentes" ADD CONSTRAINT "cargos_periodo_fkey" FOREIGN KEY ("periodo_id") REFERENCES "periodos_academicos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "cargos_docentes" ADD CONSTRAINT "cargos_departamento_fkey" FOREIGN KEY ("departamento_id") REFERENCES "departamentos"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "cargos_docentes" ADD CONSTRAINT "cargos_escuela_fkey" FOREIGN KEY ("escuela_id") REFERENCES "escuelas"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "cargos_docentes" ADD CONSTRAINT "cargos_facultad_fkey" FOREIGN KEY ("facultad_id") REFERENCES "facultades"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "publicaciones_academicas" ADD CONSTRAINT "publicaciones_facultad_fkey" FOREIGN KEY ("facultad_id") REFERENCES "facultades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "publicaciones_academicas" ADD CONSTRAINT "publicaciones_periodo_fkey" FOREIGN KEY ("periodo_id") REFERENCES "periodos_academicos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "publicaciones_academicas" ADD CONSTRAINT "publicaciones_usuario_fkey" FOREIGN KEY ("publicada_por_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
