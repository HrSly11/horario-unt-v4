ALTER TABLE "logs"
ADD COLUMN "entidad" TEXT,
ADD COLUMN "entidad_id" TEXT,
ADD COLUMN "antes" JSONB,
ADD COLUMN "despues" JSONB,
ADD COLUMN "motivo" TEXT,
ADD COLUMN "correlation_id" TEXT;

CREATE INDEX "logs_entidad_entidad_id_idx"
ON "logs"("entidad", "entidad_id");

CREATE INDEX "logs_correlation_id_idx"
ON "logs"("correlation_id");
