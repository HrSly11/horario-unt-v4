CREATE TYPE "TipoDocumentoFirma" AS ENUM (
  'DECLARACION_JURADA',
  'DECLARACION_SEDES',
  'APROBACION_DEPARTAMENTO',
  'APROBACION_ESCUELA',
  'VISTO_BUENO_DECANO',
  'REPORTE_FINAL'
);

CREATE TABLE "documentos_firmas_digitales" (
  "id" TEXT NOT NULL,
  "declaracion_id" TEXT NOT NULL,
  "tipo" "TipoDocumentoFirma" NOT NULL,
  "documento_hash" TEXT NOT NULL,
  "algoritmo_hash" TEXT NOT NULL DEFAULT 'SHA-256',
  "certificado_serial" TEXT NOT NULL,
  "certificado_emisor" TEXT NOT NULL,
  "firma_payload" TEXT NOT NULL,
  "firmado_por_id" TEXT NOT NULL,
  "firmado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "version" INTEGER NOT NULL DEFAULT 1,
  "cadena_custodia" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "documentos_firmas_digitales_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "documentos_firmas_digitales_declaracion_id_tipo_version_key"
ON "documentos_firmas_digitales"("declaracion_id", "tipo", "version");

CREATE INDEX "documentos_firmas_digitales_documento_hash_idx"
ON "documentos_firmas_digitales"("documento_hash");

ALTER TABLE "documentos_firmas_digitales"
ADD CONSTRAINT "documentos_firmas_digitales_declaracion_id_fkey"
FOREIGN KEY ("declaracion_id")
REFERENCES "declaraciones_carga"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

ALTER TABLE "documentos_firmas_digitales"
ADD CONSTRAINT "documentos_firmas_digitales_firmado_por_id_fkey"
FOREIGN KEY ("firmado_por_id")
REFERENCES "users"("id")
ON DELETE RESTRICT
ON UPDATE CASCADE;
