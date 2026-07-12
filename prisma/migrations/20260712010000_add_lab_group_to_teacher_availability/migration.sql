ALTER TABLE "disponibilidades_docentes"
ADD COLUMN IF NOT EXISTS "grupo_laboratorio" INTEGER;

DROP INDEX IF EXISTS "disponibilidades_docentes_docente_id_periodo_id_franja_horaria_id_grupo_id_tipo_key";

CREATE UNIQUE INDEX "disponibilidades_docentes_scope_lab_key"
ON "disponibilidades_docentes"(
  "docente_id",
  "periodo_id",
  "franja_horaria_id",
  "grupo_id",
  "tipo",
  "grupo_laboratorio"
);
