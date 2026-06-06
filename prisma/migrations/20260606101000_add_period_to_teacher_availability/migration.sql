ALTER TABLE "disponibilidades_docentes"
ADD COLUMN "periodo_id" TEXT;

UPDATE "disponibilidades_docentes"
SET "periodo_id" = COALESCE(
  (
    SELECT "id"
    FROM "periodos_academicos"
    WHERE "activo" = true
    ORDER BY "created_at" DESC
    LIMIT 1
  ),
  (
    SELECT "id"
    FROM "periodos_academicos"
    ORDER BY "created_at" DESC
    LIMIT 1
  )
);

DELETE FROM "disponibilidades_docentes"
WHERE "periodo_id" IS NULL;

ALTER TABLE "disponibilidades_docentes"
ALTER COLUMN "periodo_id" SET NOT NULL;

ALTER TABLE "disponibilidades_docentes"
DROP CONSTRAINT IF EXISTS "disponibilidades_docentes_docente_id_franja_horaria_id_key";

DROP INDEX IF EXISTS "disponibilidades_docentes_docente_id_franja_horaria_id_key";

ALTER TABLE "disponibilidades_docentes"
ADD CONSTRAINT "disponibilidades_docentes_periodo_id_fkey"
FOREIGN KEY ("periodo_id")
REFERENCES "periodos_academicos"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

CREATE UNIQUE INDEX "disponibilidades_docentes_docente_id_periodo_id_franja_horaria_id_key"
ON "disponibilidades_docentes"("docente_id", "periodo_id", "franja_horaria_id");
