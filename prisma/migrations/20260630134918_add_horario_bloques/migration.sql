-- DropIndex
DROP INDEX "asignaciones_carga_lectiva_docente_id_grupo_id_periodo_id_t_key";

-- CreateTable
CREATE TABLE "horario_bloques" (
    "id" TEXT NOT NULL,
    "docente_id" TEXT NOT NULL,
    "periodo_id" TEXT NOT NULL,
    "tipo_origen" TEXT NOT NULL,
    "origen_id" TEXT NOT NULL,
    "subtipo" TEXT,
    "dia_semana" "DiaSemana" NOT NULL,
    "hora_inicio" TEXT NOT NULL,
    "hora_fin" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "horario_bloques_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "horario_bloques_docente_id_periodo_id_idx" ON "horario_bloques"("docente_id", "periodo_id");

-- CreateIndex
CREATE INDEX "horario_bloques_origen_id_idx" ON "horario_bloques"("origen_id");

-- CreateIndex
CREATE UNIQUE INDEX "horario_bloques_docente_id_periodo_id_dia_semana_hora_inici_key" ON "horario_bloques"("docente_id", "periodo_id", "dia_semana", "hora_inicio");

-- RenameForeignKey
ALTER TABLE "asignaciones" RENAME CONSTRAINT "asignaciones_proceso_horario_fkey" TO "asignaciones_proceso_horario_id_fkey";

-- RenameForeignKey
ALTER TABLE "asignaciones_carga_lectiva" RENAME CONSTRAINT "asignaciones_carga_cobertura_fkey" TO "asignaciones_carga_lectiva_cobertura_id_fkey";

-- RenameForeignKey
ALTER TABLE "asignaciones_carga_lectiva" RENAME CONSTRAINT "asignaciones_carga_distribucion_fkey" TO "asignaciones_carga_lectiva_distribucion_id_fkey";

-- RenameForeignKey
ALTER TABLE "cargos_docentes" RENAME CONSTRAINT "cargos_departamento_fkey" TO "cargos_docentes_departamento_id_fkey";

-- RenameForeignKey
ALTER TABLE "cargos_docentes" RENAME CONSTRAINT "cargos_docente_fkey" TO "cargos_docentes_docente_id_fkey";

-- RenameForeignKey
ALTER TABLE "cargos_docentes" RENAME CONSTRAINT "cargos_escuela_fkey" TO "cargos_docentes_escuela_id_fkey";

-- RenameForeignKey
ALTER TABLE "cargos_docentes" RENAME CONSTRAINT "cargos_facultad_fkey" TO "cargos_docentes_facultad_id_fkey";

-- RenameForeignKey
ALTER TABLE "cargos_docentes" RENAME CONSTRAINT "cargos_periodo_fkey" TO "cargos_docentes_periodo_id_fkey";

-- RenameForeignKey
ALTER TABLE "coberturas_componentes" RENAME CONSTRAINT "coberturas_demanda_linea_fkey" TO "coberturas_componentes_demanda_linea_id_fkey";

-- RenameForeignKey
ALTER TABLE "coberturas_componentes" RENAME CONSTRAINT "coberturas_distribucion_fkey" TO "coberturas_componentes_distribucion_id_fkey";

-- RenameForeignKey
ALTER TABLE "demanda_lineas" RENAME CONSTRAINT "demanda_lineas_curso_fkey" TO "demanda_lineas_curso_id_fkey";

-- RenameForeignKey
ALTER TABLE "demanda_lineas" RENAME CONSTRAINT "demanda_lineas_demanda_fkey" TO "demanda_lineas_demanda_id_fkey";

-- RenameForeignKey
ALTER TABLE "demanda_lineas" RENAME CONSTRAINT "demanda_lineas_departamento_fkey" TO "demanda_lineas_departamento_id_fkey";

-- RenameForeignKey
ALTER TABLE "demanda_lineas_curriculas" RENAME CONSTRAINT "demanda_lineas_curriculas_curricula_fkey" TO "demanda_lineas_curriculas_curricula_id_fkey";

-- RenameForeignKey
ALTER TABLE "demanda_lineas_curriculas" RENAME CONSTRAINT "demanda_lineas_curriculas_linea_fkey" TO "demanda_lineas_curriculas_demanda_linea_id_fkey";

-- RenameForeignKey
ALTER TABLE "demandas_academicas" RENAME CONSTRAINT "demandas_enviada_por_fkey" TO "demandas_academicas_enviada_por_id_fkey";

-- RenameForeignKey
ALTER TABLE "demandas_academicas" RENAME CONSTRAINT "demandas_escuela_fkey" TO "demandas_academicas_escuela_id_fkey";

-- RenameForeignKey
ALTER TABLE "demandas_academicas" RENAME CONSTRAINT "demandas_periodo_fkey" TO "demandas_academicas_periodo_id_fkey";

-- RenameForeignKey
ALTER TABLE "demandas_academicas" RENAME CONSTRAINT "demandas_revisada_por_fkey" TO "demandas_academicas_revisada_por_id_fkey";

-- RenameForeignKey
ALTER TABLE "distribuciones_lectivas" RENAME CONSTRAINT "distribuciones_departamento_fkey" TO "distribuciones_lectivas_departamento_id_fkey";

-- RenameForeignKey
ALTER TABLE "distribuciones_lectivas" RENAME CONSTRAINT "distribuciones_enviada_por_fkey" TO "distribuciones_lectivas_enviada_por_id_fkey";

-- RenameForeignKey
ALTER TABLE "distribuciones_lectivas" RENAME CONSTRAINT "distribuciones_periodo_fkey" TO "distribuciones_lectivas_periodo_id_fkey";

-- RenameForeignKey
ALTER TABLE "distribuciones_lectivas" RENAME CONSTRAINT "distribuciones_revisada_por_fkey" TO "distribuciones_lectivas_revisada_por_id_fkey";

-- RenameForeignKey
ALTER TABLE "grupos" RENAME CONSTRAINT "grupos_demanda_linea_fkey" TO "grupos_demanda_linea_id_fkey";

-- RenameForeignKey
ALTER TABLE "grupos" RENAME CONSTRAINT "grupos_proceso_horario_fkey" TO "grupos_proceso_horario_id_fkey";

-- RenameForeignKey
ALTER TABLE "migracion_reconciliaciones" RENAME CONSTRAINT "reconciliaciones_resuelta_por_fkey" TO "migracion_reconciliaciones_resuelta_por_id_fkey";

-- RenameForeignKey
ALTER TABLE "procesos_horario_escuela" RENAME CONSTRAINT "procesos_escuela_fkey" TO "procesos_horario_escuela_escuela_id_fkey";

-- RenameForeignKey
ALTER TABLE "procesos_horario_escuela" RENAME CONSTRAINT "procesos_periodo_fkey" TO "procesos_horario_escuela_periodo_id_fkey";

-- RenameForeignKey
ALTER TABLE "procesos_horario_escuela" RENAME CONSTRAINT "procesos_publicado_por_fkey" TO "procesos_horario_escuela_publicado_por_id_fkey";

-- RenameForeignKey
ALTER TABLE "procesos_horario_escuela" RENAME CONSTRAINT "procesos_revisado_por_fkey" TO "procesos_horario_escuela_revisado_por_id_fkey";

-- RenameForeignKey
ALTER TABLE "publicaciones_academicas" RENAME CONSTRAINT "publicaciones_facultad_fkey" TO "publicaciones_academicas_facultad_id_fkey";

-- RenameForeignKey
ALTER TABLE "publicaciones_academicas" RENAME CONSTRAINT "publicaciones_periodo_fkey" TO "publicaciones_academicas_periodo_id_fkey";

-- RenameForeignKey
ALTER TABLE "publicaciones_academicas" RENAME CONSTRAINT "publicaciones_usuario_fkey" TO "publicaciones_academicas_publicada_por_id_fkey";

-- AddForeignKey
ALTER TABLE "horario_bloques" ADD CONSTRAINT "horario_bloques_docente_id_fkey" FOREIGN KEY ("docente_id") REFERENCES "docentes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "horario_bloques" ADD CONSTRAINT "horario_bloques_periodo_id_fkey" FOREIGN KEY ("periodo_id") REFERENCES "periodos_academicos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "asignaciones_carga_lectiva_cobertura_docente_rol_key" RENAME TO "asignaciones_carga_lectiva_cobertura_id_docente_id_rol_key";

-- RenameIndex
ALTER INDEX "asignaciones_carga_lectiva_docente_grupo_periodo_tipo_lab_key" RENAME TO "asignaciones_carga_lectiva_docente_id_grupo_id_periodo_id_t_key";

-- RenameIndex
ALTER INDEX "cargos_docentes_docente_periodo_cargo_key" RENAME TO "cargos_docentes_docente_id_periodo_id_cargo_key";

-- RenameIndex
ALTER INDEX "coberturas_componentes_distribucion_linea_tipo_grupo_key" RENAME TO "coberturas_componentes_distribucion_id_demanda_linea_id_com_key";

-- RenameIndex
ALTER INDEX "demanda_lineas_curriculas_linea_curricula_key" RENAME TO "demanda_lineas_curriculas_demanda_linea_id_curricula_id_key";

-- RenameIndex
ALTER INDEX "distribuciones_lectivas_departamento_periodo_key" RENAME TO "distribuciones_lectivas_departamento_id_periodo_id_key";

-- RenameIndex
ALTER INDEX "documentos_firmas_digitales_declaracion_tipo_rol_version_key" RENAME TO "documentos_firmas_digitales_declaracion_id_tipo_firmante_ro_key";

-- RenameIndex
ALTER INDEX "migracion_reconciliaciones_blocking_resuelta_idx" RENAME TO "migracion_reconciliaciones_blocking_resuelta_en_idx";

-- RenameIndex
ALTER INDEX "procesos_horario_escuela_escuela_periodo_key" RENAME TO "procesos_horario_escuela_escuela_id_periodo_id_key";

-- RenameIndex
ALTER INDEX "publicaciones_academicas_facultad_periodo_key" RENAME TO "publicaciones_academicas_facultad_id_periodo_id_key";

-- RenameIndex
ALTER INDEX "reglas_carga_por_cargo_cargo_actividad_key" RENAME TO "reglas_carga_por_cargo_cargo_codigo_actividad_key";
