-- CreateTable
CREATE TABLE "horarios_carga_no_lectiva" (
    "id" TEXT NOT NULL,
    "carga_no_lectiva_id" TEXT NOT NULL,
    "dia" "DiaSemana" NOT NULL,
    "hora_inicio" TEXT NOT NULL,
    "hora_fin" TEXT NOT NULL,
    "lugar" TEXT,
    "aula" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "horarios_carga_no_lectiva_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "horarios_carga_no_lectiva" ADD CONSTRAINT "horarios_carga_no_lectiva_carga_no_lectiva_id_fkey" FOREIGN KEY ("carga_no_lectiva_id") REFERENCES "cargas_no_lectivas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
