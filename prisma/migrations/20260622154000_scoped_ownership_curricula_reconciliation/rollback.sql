-- Roll back boundary 1 only before workflow data exists.
ALTER TABLE "curriculas" DROP CONSTRAINT IF EXISTS "curriculas_escuela_id_fkey";
ALTER TABLE "curriculas" ADD CONSTRAINT "curriculas_escuela_id_fkey" FOREIGN KEY ("escuela_id") REFERENCES "escuelas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "cursos_curriculas" DROP CONSTRAINT IF EXISTS "cursos_curriculas_curso_id_fkey";
ALTER TABLE "cursos_curriculas" DROP CONSTRAINT IF EXISTS "cursos_curriculas_curricula_id_fkey";
ALTER TABLE "cursos_curriculas" ADD CONSTRAINT "cursos_curriculas_curso_id_fkey" FOREIGN KEY ("curso_id") REFERENCES "cursos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "cursos_curriculas" ADD CONSTRAINT "cursos_curriculas_curricula_id_fkey" FOREIGN KEY ("curricula_id") REFERENCES "curriculas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
DROP TABLE IF EXISTS "migracion_reconciliaciones" CASCADE;
ALTER TABLE "notifications" DROP CONSTRAINT IF EXISTS "notifications_recipient_required_check";
ALTER TABLE "notifications" DROP COLUMN IF EXISTS "recipient_user_id", ALTER COLUMN "docente_id" SET NOT NULL;
ALTER TABLE "cursos" DROP COLUMN IF EXISTS "departamento_id";
ALTER TABLE "asignaciones_carga_lectiva" DROP COLUMN IF EXISTS "grupo_laboratorio";
ALTER TABLE "cursos_curriculas" DROP COLUMN IF EXISTS "desasociada_en", DROP COLUMN IF EXISTS "asociada_en";
ALTER TABLE "curriculas" DROP COLUMN IF EXISTS "cerrada_por_id", DROP COLUMN IF EXISTS "cerrada_en", DROP COLUMN IF EXISTS "estudiantes_pendientes", DROP COLUMN IF EXISTS "estado";
ALTER TABLE "escuelas" DROP COLUMN IF EXISTS "secretaria_id";
ALTER TABLE "facultades" DROP COLUMN IF EXISTS "decano_id";
DROP TYPE IF EXISTS "EstadoCurricula";
