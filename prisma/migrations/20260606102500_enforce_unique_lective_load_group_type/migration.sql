DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM (
      SELECT COUNT(*) AS count
      FROM "asignaciones_carga_lectiva"
      GROUP BY "grupo_id", "periodo_id", "tipo"
      HAVING COUNT(*) > 2
    ) duplicates
  ) THEN
    RAISE EXCEPTION 'More than two lective workload assignments exist for the same grupo_id, periodo_id, tipo. Resolve multi-docente duplicates manually before applying this migration.';
  END IF;
END $$;

WITH ranked AS (
  SELECT
    "id",
    "grupo_id",
    "periodo_id",
    "tipo",
    "docente_id",
    "horas_asignadas",
    ROW_NUMBER() OVER (
      PARTITION BY "grupo_id", "periodo_id", "tipo"
      ORDER BY "horas_asignadas" DESC, "created_at" ASC, "id" ASC
    ) AS rn
  FROM "asignaciones_carga_lectiva"
),
pairs AS (
  SELECT
    keep_row."id" AS keep_id,
    duplicate_row."id" AS duplicate_id,
    duplicate_row."docente_id" AS shared_docente_id,
    GREATEST(keep_row."horas_asignadas", duplicate_row."horas_asignadas") AS shared_hours
  FROM ranked keep_row
  JOIN ranked duplicate_row
    ON duplicate_row."grupo_id" = keep_row."grupo_id"
   AND duplicate_row."periodo_id" = keep_row."periodo_id"
   AND duplicate_row."tipo" = keep_row."tipo"
   AND duplicate_row.rn = 2
  WHERE keep_row.rn = 1
)
UPDATE "asignaciones_carga_lectiva" target
SET
  "compartido" = true,
  "docente_compartido_id" = COALESCE(target."docente_compartido_id", pairs.shared_docente_id),
  "horas_asignadas" = pairs.shared_hours
FROM pairs
WHERE target."id" = pairs.keep_id;

WITH ranked AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (
      PARTITION BY "grupo_id", "periodo_id", "tipo"
      ORDER BY "horas_asignadas" DESC, "created_at" ASC, "id" ASC
    ) AS rn
  FROM "asignaciones_carga_lectiva"
)
DELETE FROM "asignaciones_carga_lectiva"
WHERE "id" IN (
  SELECT "id"
  FROM ranked
  WHERE rn > 1
);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "asignaciones_carga_lectiva"
    GROUP BY "grupo_id", "periodo_id", "tipo"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Duplicate lective workload assignments still exist for the same grupo_id, periodo_id, tipo after shared-assignment migration.';
  END IF;
END $$;

CREATE UNIQUE INDEX "asignaciones_carga_lectiva_grupo_id_periodo_id_tipo_key"
ON "asignaciones_carga_lectiva"("grupo_id", "periodo_id", "tipo");
