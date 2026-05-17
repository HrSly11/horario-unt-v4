-- CreateEnum
CREATE TYPE "CategoriaDocente" AS ENUM ('PRINCIPAL', 'ASOCIADO', 'AUXILIAR', 'JEFE_PRACTICA');

-- CreateEnum
CREATE TYPE "TipoDocente" AS ENUM ('NOMBRADO', 'CONTRATADO');

-- CreateEnum
CREATE TYPE "TipoAula" AS ENUM ('TEORIA', 'LABORATORIO');

-- CreateEnum
CREATE TYPE "DiaSemana" AS ENUM ('LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES');

-- CreateEnum
CREATE TYPE "TipoAsignacion" AS ENUM ('TEORIA', 'LABORATORIO');

-- CreateEnum
CREATE TYPE "TipoRestriccion" AS ENUM ('NO_DISPONIBLE', 'PREFERENCIA');

-- CreateEnum
CREATE TYPE "EstadoSesion" AS ENUM ('PROGRAMADA', 'EN_CURSO', 'FINALIZADA');

-- CreateEnum
CREATE TYPE "EstadoTurno" AS ENUM ('PENDIENTE', 'EN_TURNO', 'COMPLETADO', 'AUSENTE');

-- CreateTable
CREATE TABLE "docentes" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "categoria" "CategoriaDocente" NOT NULL,
    "tipo" "TipoDocente" NOT NULL,
    "antiguedad" TIMESTAMP(3) NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "docentes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cursos" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "creditos" INTEGER NOT NULL,
    "horas_teoria" INTEGER NOT NULL,
    "horas_laboratorio" INTEGER NOT NULL,
    "ciclo" INTEGER NOT NULL,
    "requiere_laboratorio" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cursos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "grupos" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "curso_id" TEXT NOT NULL,
    "periodo_academico_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "grupos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "aulas" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "capacidad" INTEGER NOT NULL,
    "tipo" "TipoAula" NOT NULL,
    "edificio" TEXT NOT NULL,
    "piso" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "aulas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "periodos_academicos" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "fecha_inicio" TIMESTAMP(3) NOT NULL,
    "fecha_fin" TIMESTAMP(3) NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "periodos_academicos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "franjas_horarias" (
    "id" TEXT NOT NULL,
    "dia" "DiaSemana" NOT NULL,
    "hora_inicio" TEXT NOT NULL,
    "hora_fin" TEXT NOT NULL,
    "numero_bloque" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "franjas_horarias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asignaciones" (
    "id" TEXT NOT NULL,
    "grupo_id" TEXT NOT NULL,
    "docente_id" TEXT NOT NULL,
    "aula_id" TEXT NOT NULL,
    "franja_horaria_id" TEXT NOT NULL,
    "periodo_id" TEXT NOT NULL,
    "tipo" "TipoAsignacion" NOT NULL,
    "confirmado" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "asignaciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "restricciones_docentes" (
    "id" TEXT NOT NULL,
    "docente_id" TEXT NOT NULL,
    "franja_horaria_id" TEXT NOT NULL,
    "tipo" "TipoRestriccion" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "restricciones_docentes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "docente_grupos" (
    "id" TEXT NOT NULL,
    "docente_id" TEXT NOT NULL,
    "grupo_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "docente_grupos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feriados" (
    "id" TEXT NOT NULL,
    "fecha" DATE NOT NULL,
    "nombre" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "feriados_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mantenimiento_aulas" (
    "id" TEXT NOT NULL,
    "aula_id" TEXT NOT NULL,
    "franja_horaria_id" TEXT NOT NULL,
    "fecha" DATE NOT NULL,
    "motivo" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mantenimiento_aulas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "preasignaciones" (
    "id" TEXT NOT NULL,
    "docente_id" TEXT NOT NULL,
    "grupo_id" TEXT NOT NULL,
    "franja_horaria_id" TEXT NOT NULL,
    "periodo_id" TEXT NOT NULL,
    "aula_id" TEXT NOT NULL,
    "tipo" "TipoAsignacion" NOT NULL,
    "motivo" TEXT NOT NULL DEFAULT 'Designación por Dirección',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "preasignaciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sesiones_llenado" (
    "id" TEXT NOT NULL,
    "periodo_id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "fecha" DATE NOT NULL,
    "hora_inicio" TEXT NOT NULL,
    "hora_fin" TEXT NOT NULL,
    "intervalo" INTEGER NOT NULL DEFAULT 15,
    "estado" "EstadoSesion" NOT NULL DEFAULT 'PROGRAMADA',
    "turno_actual" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sesiones_llenado_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "turnos_docentes" (
    "id" TEXT NOT NULL,
    "sesion_id" TEXT NOT NULL,
    "docente_id" TEXT NOT NULL,
    "orden" INTEGER NOT NULL,
    "hora_asignada" TEXT NOT NULL,
    "estado" "EstadoTurno" NOT NULL DEFAULT 'PENDIENTE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "turnos_docentes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "docentes_email_key" ON "docentes"("email");

-- CreateIndex
CREATE INDEX "docentes_tipo_categoria_antiguedad_idx" ON "docentes"("tipo", "categoria", "antiguedad");

-- CreateIndex
CREATE UNIQUE INDEX "cursos_codigo_key" ON "cursos"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "grupos_curso_id_nombre_periodo_academico_id_key" ON "grupos"("curso_id", "nombre", "periodo_academico_id");

-- CreateIndex
CREATE UNIQUE INDEX "aulas_codigo_key" ON "aulas"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "periodos_academicos_nombre_key" ON "periodos_academicos"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "franjas_horarias_dia_hora_inicio_hora_fin_key" ON "franjas_horarias"("dia", "hora_inicio", "hora_fin");

-- CreateIndex
CREATE UNIQUE INDEX "asignaciones_aula_id_franja_horaria_id_periodo_id_key" ON "asignaciones"("aula_id", "franja_horaria_id", "periodo_id");

-- CreateIndex
CREATE UNIQUE INDEX "asignaciones_docente_id_franja_horaria_id_periodo_id_key" ON "asignaciones"("docente_id", "franja_horaria_id", "periodo_id");

-- CreateIndex
CREATE UNIQUE INDEX "asignaciones_grupo_id_franja_horaria_id_periodo_id_key" ON "asignaciones"("grupo_id", "franja_horaria_id", "periodo_id");

-- CreateIndex
CREATE UNIQUE INDEX "restricciones_docentes_docente_id_franja_horaria_id_key" ON "restricciones_docentes"("docente_id", "franja_horaria_id");

-- CreateIndex
CREATE UNIQUE INDEX "docente_grupos_docente_id_grupo_id_key" ON "docente_grupos"("docente_id", "grupo_id");

-- CreateIndex
CREATE UNIQUE INDEX "feriados_fecha_key" ON "feriados"("fecha");

-- CreateIndex
CREATE UNIQUE INDEX "mantenimiento_aulas_aula_id_franja_horaria_id_fecha_key" ON "mantenimiento_aulas"("aula_id", "franja_horaria_id", "fecha");

-- CreateIndex
CREATE UNIQUE INDEX "preasignaciones_aula_id_franja_horaria_id_periodo_id_key" ON "preasignaciones"("aula_id", "franja_horaria_id", "periodo_id");

-- CreateIndex
CREATE UNIQUE INDEX "turnos_docentes_sesion_id_docente_id_key" ON "turnos_docentes"("sesion_id", "docente_id");

-- CreateIndex
CREATE UNIQUE INDEX "turnos_docentes_sesion_id_orden_key" ON "turnos_docentes"("sesion_id", "orden");

-- AddForeignKey
ALTER TABLE "grupos" ADD CONSTRAINT "grupos_curso_id_fkey" FOREIGN KEY ("curso_id") REFERENCES "cursos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grupos" ADD CONSTRAINT "grupos_periodo_academico_id_fkey" FOREIGN KEY ("periodo_academico_id") REFERENCES "periodos_academicos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asignaciones" ADD CONSTRAINT "asignaciones_grupo_id_fkey" FOREIGN KEY ("grupo_id") REFERENCES "grupos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asignaciones" ADD CONSTRAINT "asignaciones_docente_id_fkey" FOREIGN KEY ("docente_id") REFERENCES "docentes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asignaciones" ADD CONSTRAINT "asignaciones_aula_id_fkey" FOREIGN KEY ("aula_id") REFERENCES "aulas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asignaciones" ADD CONSTRAINT "asignaciones_franja_horaria_id_fkey" FOREIGN KEY ("franja_horaria_id") REFERENCES "franjas_horarias"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asignaciones" ADD CONSTRAINT "asignaciones_periodo_id_fkey" FOREIGN KEY ("periodo_id") REFERENCES "periodos_academicos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "restricciones_docentes" ADD CONSTRAINT "restricciones_docentes_docente_id_fkey" FOREIGN KEY ("docente_id") REFERENCES "docentes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "restricciones_docentes" ADD CONSTRAINT "restricciones_docentes_franja_horaria_id_fkey" FOREIGN KEY ("franja_horaria_id") REFERENCES "franjas_horarias"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "docente_grupos" ADD CONSTRAINT "docente_grupos_docente_id_fkey" FOREIGN KEY ("docente_id") REFERENCES "docentes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "docente_grupos" ADD CONSTRAINT "docente_grupos_grupo_id_fkey" FOREIGN KEY ("grupo_id") REFERENCES "grupos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mantenimiento_aulas" ADD CONSTRAINT "mantenimiento_aulas_aula_id_fkey" FOREIGN KEY ("aula_id") REFERENCES "aulas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mantenimiento_aulas" ADD CONSTRAINT "mantenimiento_aulas_franja_horaria_id_fkey" FOREIGN KEY ("franja_horaria_id") REFERENCES "franjas_horarias"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "preasignaciones" ADD CONSTRAINT "preasignaciones_docente_id_fkey" FOREIGN KEY ("docente_id") REFERENCES "docentes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "preasignaciones" ADD CONSTRAINT "preasignaciones_grupo_id_fkey" FOREIGN KEY ("grupo_id") REFERENCES "grupos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "preasignaciones" ADD CONSTRAINT "preasignaciones_franja_horaria_id_fkey" FOREIGN KEY ("franja_horaria_id") REFERENCES "franjas_horarias"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "preasignaciones" ADD CONSTRAINT "preasignaciones_periodo_id_fkey" FOREIGN KEY ("periodo_id") REFERENCES "periodos_academicos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sesiones_llenado" ADD CONSTRAINT "sesiones_llenado_periodo_id_fkey" FOREIGN KEY ("periodo_id") REFERENCES "periodos_academicos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "turnos_docentes" ADD CONSTRAINT "turnos_docentes_sesion_id_fkey" FOREIGN KEY ("sesion_id") REFERENCES "sesiones_llenado"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "turnos_docentes" ADD CONSTRAINT "turnos_docentes_docente_id_fkey" FOREIGN KEY ("docente_id") REFERENCES "docentes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
