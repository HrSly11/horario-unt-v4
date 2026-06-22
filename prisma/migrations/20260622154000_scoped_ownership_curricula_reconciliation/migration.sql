-- Immutable boundary 1: ownership, historical curricula, and legacy reconciliation blockers.
CREATE TYPE "EstadoCurricula" AS ENUM ('ACTIVA', 'CERRADA');

ALTER TABLE "facultades" ADD COLUMN "decano_id" TEXT;
ALTER TABLE "escuelas" ADD COLUMN "secretaria_id" TEXT;
ALTER TABLE "curriculas"
  ADD COLUMN "estado" "EstadoCurricula" NOT NULL DEFAULT 'ACTIVA',
  ADD COLUMN "estudiantes_pendientes" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "cerrada_en" TIMESTAMP(3),
  ADD COLUMN "cerrada_por_id" TEXT;
UPDATE "curriculas" SET "estado" = CASE WHEN "vigente" THEN 'ACTIVA'::"EstadoCurricula" ELSE 'CERRADA'::"EstadoCurricula" END;
ALTER TABLE "cursos_curriculas"
  ADD COLUMN "asociada_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "desasociada_en" TIMESTAMP(3);
ALTER TABLE "cursos" ADD COLUMN "departamento_id" TEXT;
ALTER TABLE "asignaciones_carga_lectiva" ADD COLUMN IF NOT EXISTS "grupo_laboratorio" INTEGER;
ALTER TABLE "notifications" ADD COLUMN "recipient_user_id" TEXT, ALTER COLUMN "docente_id" DROP NOT NULL;
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_recipient_required_check" CHECK ("docente_id" IS NOT NULL OR "recipient_user_id" IS NOT NULL);

CREATE TABLE "migracion_reconciliaciones" (
  "id" TEXT NOT NULL, "codigo" TEXT NOT NULL, "entidad" TEXT NOT NULL, "entidad_id" TEXT,
  "detalle" JSONB NOT NULL, "blocking" BOOLEAN NOT NULL DEFAULT true, "resuelta_en" TIMESTAMP(3),
  "resuelta_por_id" TEXT, "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "migracion_reconciliaciones_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "facultades_decano_id_key" ON "facultades"("decano_id");
CREATE UNIQUE INDEX "escuelas_secretaria_id_key" ON "escuelas"("secretaria_id");
CREATE INDEX "migracion_reconciliaciones_blocking_resuelta_idx" ON "migracion_reconciliaciones"("blocking", "resuelta_en");

-- Backfill only a unique normalized department match. Ambiguity is always blocking.
WITH candidates AS (
  SELECT c."id" AS curso_id, d."id" AS departamento_id, COUNT(*) OVER (PARTITION BY c."id") AS matches
  FROM "cursos" c JOIN "departamentos" d
    ON regexp_replace(lower(trim(c."departamento")), '\s+', ' ', 'g') = regexp_replace(lower(trim(d."nombre")), '\s+', ' ', 'g')
  WHERE c."departamento" IS NOT NULL
)
UPDATE "cursos" c SET "departamento_id" = candidates.departamento_id
FROM candidates WHERE candidates.curso_id = c."id" AND candidates.matches = 1;

INSERT INTO "migracion_reconciliaciones" ("id", "codigo", "entidad", "entidad_id", "detalle")
SELECT md5(random()::text || clock_timestamp()::text || c."id"),
       CASE WHEN COUNT(d."id") = 0 THEN 'DEPARTAMENTO_NO_ENCONTRADO' ELSE 'DEPARTAMENTO_AMBIGUO' END,
       'Curso', c."id", jsonb_build_object('departamentoLegacy', c."departamento", 'candidatos', COALESCE(jsonb_agg(d."id") FILTER (WHERE d."id" IS NOT NULL), '[]'::jsonb))
FROM "cursos" c LEFT JOIN "departamentos" d
  ON regexp_replace(lower(trim(c."departamento")), '\s+', ' ', 'g') = regexp_replace(lower(trim(d."nombre")), '\s+', ' ', 'g')
WHERE c."departamento" IS NOT NULL AND c."departamento_id" IS NULL
GROUP BY c."id", c."departamento";

INSERT INTO "migracion_reconciliaciones" ("id", "codigo", "entidad", "entidad_id", "detalle")
SELECT md5(random()::text || clock_timestamp()::text || c."id"), 'ESCUELA_APERTURA_AMBIGUA', 'Curso', c."id",
       jsonb_build_object('escuelas', COALESCE(jsonb_agg(DISTINCT cu."escuela_id") FILTER (WHERE cu."escuela_id" IS NOT NULL), '[]'::jsonb))
FROM "cursos" c LEFT JOIN "cursos_curriculas" cc ON cc."curso_id" = c."id"
LEFT JOIN "curriculas" cu ON cu."id" = cc."curricula_id" WHERE c."aperturado" = true
GROUP BY c."id" HAVING COUNT(DISTINCT cu."escuela_id") <> 1;

INSERT INTO "migracion_reconciliaciones" ("id", "codigo", "entidad", "entidad_id", "detalle")
SELECT md5(random()::text || clock_timestamp()::text || c."id"), 'DEPARTAMENTO_FALTANTE', 'Curso', c."id",
       jsonb_build_object('departamentoLegacy', c."departamento")
FROM "cursos" c WHERE c."aperturado" = true AND c."departamento_id" IS NULL
  AND NOT EXISTS (SELECT 1 FROM "migracion_reconciliaciones" mr WHERE mr."entidad_id" = c."id" AND mr."codigo" LIKE 'DEPARTAMENTO_%');

INSERT INTO "migracion_reconciliaciones" ("id", "codigo", "entidad", "entidad_id", "detalle")
SELECT md5(random()::text || clock_timestamp()::text || a."id"), 'HORAS_COMPARTIDAS_REQUIEREN_REVISION', 'AsignacionCargaLectiva', a."id",
       jsonb_build_object('docenteId', a."docente_id", 'docenteCompartidoId', a."docente_compartido_id", 'horas', a."horas_asignadas")
FROM "asignaciones_carga_lectiva" a WHERE a."compartido" = true OR a."docente_compartido_id" IS NOT NULL;

WITH totals AS (
  SELECT g."id" AS grupo_id, a."periodo_id", a."tipo", a."grupo_laboratorio", SUM(a."horas_asignadas") AS asignadas,
         CASE a."tipo" WHEN 'TEORIA' THEN c."horas_teoria" WHEN 'PRACTICA' THEN c."horas_practica" ELSE c."horas_laboratorio" END AS esperadas,
         COUNT(*) AS filas
  FROM "asignaciones_carga_lectiva" a JOIN "grupos" g ON g."id" = a."grupo_id" JOIN "cursos" c ON c."id" = g."curso_id"
  GROUP BY g."id", a."periodo_id", a."tipo", a."grupo_laboratorio", c."horas_teoria", c."horas_practica", c."horas_laboratorio"
)
INSERT INTO "migracion_reconciliaciones" ("id", "codigo", "entidad", "entidad_id", "detalle")
SELECT md5(random()::text || clock_timestamp()::text || totals.grupo_id || totals."tipo"::text),
       CASE WHEN totals.filas > 1 THEN 'COMPONENTE_DUPLICADO' ELSE 'HORAS_NO_RECONCILIADAS' END,
       'Grupo', totals.grupo_id,
       jsonb_build_object('periodoId', totals.periodo_id, 'tipo', totals."tipo", 'grupoLaboratorio', totals.grupo_laboratorio, 'esperadas', totals.esperadas, 'asignadas', totals.asignadas, 'filas', totals.filas)
FROM totals WHERE totals.filas > 1 OR totals.asignadas <> totals.esperadas;

ALTER TABLE "facultades" ADD CONSTRAINT "facultades_decano_id_fkey" FOREIGN KEY ("decano_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "escuelas" ADD CONSTRAINT "escuelas_secretaria_id_fkey" FOREIGN KEY ("secretaria_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "curriculas" ADD CONSTRAINT "curriculas_cerrada_por_id_fkey" FOREIGN KEY ("cerrada_por_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "cursos" ADD CONSTRAINT "cursos_departamento_id_fkey" FOREIGN KEY ("departamento_id") REFERENCES "departamentos"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_recipient_user_id_fkey" FOREIGN KEY ("recipient_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "migracion_reconciliaciones" ADD CONSTRAINT "reconciliaciones_resuelta_por_fkey" FOREIGN KEY ("resuelta_por_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "cursos_curriculas" DROP CONSTRAINT IF EXISTS "cursos_curriculas_curso_id_fkey";
ALTER TABLE "cursos_curriculas" DROP CONSTRAINT IF EXISTS "cursos_curriculas_curricula_id_fkey";
ALTER TABLE "cursos_curriculas" ADD CONSTRAINT "cursos_curriculas_curso_id_fkey" FOREIGN KEY ("curso_id") REFERENCES "cursos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "cursos_curriculas" ADD CONSTRAINT "cursos_curriculas_curricula_id_fkey" FOREIGN KEY ("curricula_id") REFERENCES "curriculas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "curriculas" DROP CONSTRAINT IF EXISTS "curriculas_escuela_id_fkey";
ALTER TABLE "curriculas" ADD CONSTRAINT "curriculas_escuela_id_fkey" FOREIGN KEY ("escuela_id") REFERENCES "escuelas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
