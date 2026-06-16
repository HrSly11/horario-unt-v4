-- AlterTable
ALTER TABLE "cursos" ADD COLUMN     "condicion" TEXT DEFAULT 'O',
ADD COLUMN     "departamento" TEXT,
ADD COLUMN     "num_grupos_laboratorio" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "requisitos" TEXT,
ALTER COLUMN "horas_laboratorio" SET DEFAULT 0;

-- AlterTable
ALTER TABLE "disponibilidades_docentes" ADD COLUMN     "grupo_id" TEXT,
ADD COLUMN     "tipo" "TipoAsignacion";

-- DropIndex
DROP INDEX IF EXISTS "disponibilidades_docentes_docente_id_periodo_id_franja_horaria_id_key";
DROP INDEX IF EXISTS "disponibilidades_docentes_docente_id_periodo_id_franja_horaria_";
DROP INDEX IF EXISTS "disponibilidades_docentes_docente_id_periodo_id_franja_hora_key";

-- CreateIndex
CREATE UNIQUE INDEX "disponibilidades_docentes_docente_id_periodo_id_franja_horaria_id_grupo_id_tipo_key" ON "disponibilidades_docentes"("docente_id", "periodo_id", "franja_horaria_id", "grupo_id", "tipo");

-- AddForeignKey
ALTER TABLE "disponibilidades_docentes" ADD CONSTRAINT "disponibilidades_docentes_grupo_id_fkey" FOREIGN KEY ("grupo_id") REFERENCES "grupos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
