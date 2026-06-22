-- Roll back boundary 2 before PR2 writes workflow data. Enum additions on existing types remain harmless.
DROP TABLE IF EXISTS "publicaciones_academicas", "reglas_carga_por_cargo", "cargos_docentes", "coberturas_componentes", "distribuciones_lectivas", "demanda_lineas_curriculas", "demanda_lineas", "demandas_academicas", "procesos_horario_escuela" CASCADE;
ALTER TABLE "documentos_firmas_digitales" DROP COLUMN IF EXISTS "firmante_rol";
CREATE UNIQUE INDEX IF NOT EXISTS "documentos_firmas_digitales_declaracion_id_tipo_version_key" ON "documentos_firmas_digitales"("declaracion_id", "tipo", "version");
DROP INDEX IF EXISTS "asignaciones_carga_lectiva_docente_grupo_periodo_tipo_lab_key";
ALTER TABLE "asignaciones_carga_lectiva" DROP COLUMN IF EXISTS "rol", DROP COLUMN IF EXISTS "cobertura_id", DROP COLUMN IF EXISTS "distribucion_id";
CREATE UNIQUE INDEX IF NOT EXISTS "asignaciones_carga_lectiva_grupo_id_periodo_id_tipo_key" ON "asignaciones_carga_lectiva"("grupo_id", "periodo_id", "tipo");
ALTER TABLE "asignaciones" DROP COLUMN IF EXISTS "proceso_horario_id";
ALTER TABLE "grupos" DROP COLUMN IF EXISTS "proceso_horario_id", DROP COLUMN IF EXISTS "demanda_linea_id";
DROP TYPE IF EXISTS "RolFirmanteDocumento", "CargoAcademico", "EstadoProcesoHorario", "RolAsignacionDocente", "EstadoCobertura", "TipoComponenteLectivo", "EstadoRevisionWorkflow";
