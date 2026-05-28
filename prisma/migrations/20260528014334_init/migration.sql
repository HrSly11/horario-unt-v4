-- CreateEnum
CREATE TYPE "CategoriaDocente" AS ENUM ('PRINCIPAL', 'ASOCIADO', 'AUXILIAR', 'JEFE_PRACTICA');

-- CreateEnum
CREATE TYPE "TipoDocente" AS ENUM ('NOMBRADO', 'CONTRATADO');

-- CreateEnum
CREATE TYPE "ModalidadDocente" AS ENUM ('TIEMPO_COMPLETO', 'DEDICACION_EXCLUSIVA', 'TIEMPO_PARCIAL');

-- CreateEnum
CREATE TYPE "TipoAula" AS ENUM ('TEORIA', 'LABORATORIO');

-- CreateEnum
CREATE TYPE "DiaSemana" AS ENUM ('LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO');

-- CreateEnum
CREATE TYPE "TipoAsignacion" AS ENUM ('TEORIA', 'PRACTICA', 'LABORATORIO');

-- CreateEnum
CREATE TYPE "TipoRestriccion" AS ENUM ('NO_DISPONIBLE', 'PREFERENCIA');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'DOCENTE', 'ESTUDIANTE', 'INVITADO', 'SECRETARIA_ACADEMICA', 'DIRECTOR_ESCUELA', 'DIRECTOR_DEPARTAMENTO', 'SECRETARIA_DEPARTAMENTO', 'DECANO');

-- CreateEnum
CREATE TYPE "EstadoPeriodo" AS ENUM ('PLANIFICACION', 'POSTULACION', 'ASIGNACION', 'REVISION', 'APROBADO', 'FINALIZADO');

-- CreateEnum
CREATE TYPE "EstadoDeclaracion" AS ENUM ('BORRADOR', 'ENVIADA', 'APROBADA_DEPARTAMENTO', 'APROBADA_ESCUELA', 'RECHAZADA', 'FINALIZADA');

-- CreateEnum
CREATE TYPE "TipoCargaNoLectiva" AS ENUM ('PREPARACION_EVALUACION', 'CONSEJERIA', 'INVESTIGACION', 'CAPACITACION', 'GOBIERNO', 'ADMINISTRACION', 'ASESORIA_TESIS', 'RESPONSABILIDAD_SOCIAL', 'COMITES_COMISIONES');

-- CreateTable
CREATE TABLE "facultades" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "siglas" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "facultades_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "departamentos" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "facultad_id" TEXT NOT NULL,
    "director_id" TEXT,
    "secretaria_id" TEXT,
    "designado_por_id" TEXT,
    "fecha_designacion" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "departamentos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "escuelas" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "facultad_id" TEXT NOT NULL,
    "director_id" TEXT,
    "designado_por_id" TEXT,
    "fecha_designacion" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "escuelas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "curriculas" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "escuela_id" TEXT NOT NULL,
    "vigente" BOOLEAN NOT NULL DEFAULT true,
    "anio" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "curriculas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cursos_curriculas" (
    "id" TEXT NOT NULL,
    "curso_id" TEXT NOT NULL,
    "curricula_id" TEXT NOT NULL,
    "ciclo" INTEGER NOT NULL,
    "es_electivo" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "cursos_curriculas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'DOCENTE',
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "docente_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "logs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "accion" TEXT NOT NULL,
    "detalles" TEXT,
    "ip" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "docentes" (
    "id" TEXT NOT NULL,
    "codigo" TEXT,
    "nombre" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "categoria" "CategoriaDocente" NOT NULL,
    "tipo" "TipoDocente" NOT NULL,
    "modalidad" "ModalidadDocente" NOT NULL DEFAULT 'TIEMPO_COMPLETO',
    "antiguedad" TIMESTAMP(3) NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "grado_academico" TEXT,
    "especialidad" TEXT,
    "experiencia_anios" INTEGER NOT NULL DEFAULT 0,
    "perfil_academico" TEXT,
    "dni" TEXT,
    "codigo_ibm" TEXT,
    "departamento_id" TEXT,
    "horas_contrato" INTEGER NOT NULL DEFAULT 40,
    "dicta_otra_universidad" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "docentes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "docente_id" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "mensaje" TEXT NOT NULL,
    "leida" BOOLEAN NOT NULL DEFAULT false,
    "tipo" TEXT NOT NULL DEFAULT 'INFO',
    "link" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cursos" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "creditos" INTEGER NOT NULL,
    "horas_teoria" INTEGER NOT NULL,
    "horas_practica" INTEGER NOT NULL DEFAULT 0,
    "horas_laboratorio" INTEGER NOT NULL,
    "ciclo" INTEGER NOT NULL,
    "requiere_laboratorio" BOOLEAN NOT NULL DEFAULT false,
    "perfil_requerido" TEXT,
    "grado_requerido" TEXT,
    "experiencia_minima" INTEGER NOT NULL DEFAULT 0,
    "especialidad_requerida" TEXT,
    "aperturado" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cursos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "disponibilidades_docentes" (
    "id" TEXT NOT NULL,
    "docente_id" TEXT NOT NULL,
    "franja_horaria_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "disponibilidades_docentes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "postulaciones_cursos" (
    "id" TEXT NOT NULL,
    "docente_id" TEXT NOT NULL,
    "curso_id" TEXT NOT NULL,
    "prioridad" INTEGER NOT NULL DEFAULT 1,
    "compatibilidad" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "postulaciones_cursos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "grupos" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "seccion" TEXT,
    "curso_id" TEXT NOT NULL,
    "periodo_academico_id" TEXT NOT NULL,
    "num_alumnos" INTEGER NOT NULL DEFAULT 0,
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
    "estado" "EstadoPeriodo" NOT NULL DEFAULT 'PLANIFICACION',
    "aprobado_por_id" TEXT,
    "fecha_aprobacion" TIMESTAMP(3),
    "comentarios_director" TEXT,
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
CREATE TABLE "asignaciones_carga_lectiva" (
    "id" TEXT NOT NULL,
    "docente_id" TEXT NOT NULL,
    "grupo_id" TEXT NOT NULL,
    "periodo_id" TEXT NOT NULL,
    "tipo" "TipoAsignacion" NOT NULL,
    "horas_asignadas" INTEGER NOT NULL,
    "compartido" BOOLEAN NOT NULL DEFAULT false,
    "docente_compartido_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "asignaciones_carga_lectiva_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cargas_no_lectivas" (
    "id" TEXT NOT NULL,
    "docente_id" TEXT NOT NULL,
    "periodo_id" TEXT NOT NULL,
    "tipo" "TipoCargaNoLectiva" NOT NULL,
    "horas" INTEGER NOT NULL,
    "descripcion" TEXT,
    "codigo_proyecto" TEXT,
    "nombre_proyecto" TEXT,
    "num_alumnos" INTEGER,
    "ciclo_consejeria" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cargas_no_lectivas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "declaraciones_carga" (
    "id" TEXT NOT NULL,
    "docente_id" TEXT NOT NULL,
    "periodo_id" TEXT NOT NULL,
    "estado" "EstadoDeclaracion" NOT NULL DEFAULT 'BORRADOR',
    "total_horas_lectivas" INTEGER NOT NULL DEFAULT 0,
    "total_horas_no_lectivas" INTEGER NOT NULL DEFAULT 0,
    "total_horas" INTEGER NOT NULL DEFAULT 0,
    "aprobado_departamento_id" TEXT,
    "fecha_aprobacion_depto" TIMESTAMP(3),
    "aprobado_escuela_id" TEXT,
    "fecha_aprobacion_escuela" TIMESTAMP(3),
    "visto_bueno_decano_id" TEXT,
    "fecha_visto_bueno" TIMESTAMP(3),
    "observaciones" TEXT,
    "declaracion_jurada_firmada" BOOLEAN NOT NULL DEFAULT false,
    "declaracion_sedes_firmada" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "declaraciones_carga_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "facultades_nombre_key" ON "facultades"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "facultades_siglas_key" ON "facultades"("siglas");

-- CreateIndex
CREATE UNIQUE INDEX "departamentos_director_id_key" ON "departamentos"("director_id");

-- CreateIndex
CREATE UNIQUE INDEX "departamentos_secretaria_id_key" ON "departamentos"("secretaria_id");

-- CreateIndex
CREATE UNIQUE INDEX "departamentos_nombre_facultad_id_key" ON "departamentos"("nombre", "facultad_id");

-- CreateIndex
CREATE UNIQUE INDEX "escuelas_director_id_key" ON "escuelas"("director_id");

-- CreateIndex
CREATE UNIQUE INDEX "escuelas_nombre_facultad_id_key" ON "escuelas"("nombre", "facultad_id");

-- CreateIndex
CREATE UNIQUE INDEX "curriculas_codigo_escuela_id_key" ON "curriculas"("codigo", "escuela_id");

-- CreateIndex
CREATE UNIQUE INDEX "cursos_curriculas_curso_id_curricula_id_key" ON "cursos_curriculas"("curso_id", "curricula_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_docente_id_key" ON "users"("docente_id");

-- CreateIndex
CREATE UNIQUE INDEX "docentes_codigo_key" ON "docentes"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "docentes_email_key" ON "docentes"("email");

-- CreateIndex
CREATE UNIQUE INDEX "docentes_dni_key" ON "docentes"("dni");

-- CreateIndex
CREATE UNIQUE INDEX "docentes_codigo_ibm_key" ON "docentes"("codigo_ibm");

-- CreateIndex
CREATE INDEX "docentes_tipo_categoria_antiguedad_idx" ON "docentes"("tipo", "categoria", "antiguedad");

-- CreateIndex
CREATE UNIQUE INDEX "cursos_codigo_key" ON "cursos"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "disponibilidades_docentes_docente_id_franja_horaria_id_key" ON "disponibilidades_docentes"("docente_id", "franja_horaria_id");

-- CreateIndex
CREATE UNIQUE INDEX "postulaciones_cursos_docente_id_curso_id_key" ON "postulaciones_cursos"("docente_id", "curso_id");

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
CREATE UNIQUE INDEX "asignaciones_carga_lectiva_docente_id_grupo_id_periodo_id_t_key" ON "asignaciones_carga_lectiva"("docente_id", "grupo_id", "periodo_id", "tipo");

-- CreateIndex
CREATE UNIQUE INDEX "declaraciones_carga_docente_id_periodo_id_key" ON "declaraciones_carga"("docente_id", "periodo_id");

-- AddForeignKey
ALTER TABLE "departamentos" ADD CONSTRAINT "departamentos_facultad_id_fkey" FOREIGN KEY ("facultad_id") REFERENCES "facultades"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "departamentos" ADD CONSTRAINT "departamentos_director_id_fkey" FOREIGN KEY ("director_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "departamentos" ADD CONSTRAINT "departamentos_secretaria_id_fkey" FOREIGN KEY ("secretaria_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "departamentos" ADD CONSTRAINT "departamentos_designado_por_id_fkey" FOREIGN KEY ("designado_por_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "escuelas" ADD CONSTRAINT "escuelas_facultad_id_fkey" FOREIGN KEY ("facultad_id") REFERENCES "facultades"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "escuelas" ADD CONSTRAINT "escuelas_director_id_fkey" FOREIGN KEY ("director_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "escuelas" ADD CONSTRAINT "escuelas_designado_por_id_fkey" FOREIGN KEY ("designado_por_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "curriculas" ADD CONSTRAINT "curriculas_escuela_id_fkey" FOREIGN KEY ("escuela_id") REFERENCES "escuelas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cursos_curriculas" ADD CONSTRAINT "cursos_curriculas_curso_id_fkey" FOREIGN KEY ("curso_id") REFERENCES "cursos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cursos_curriculas" ADD CONSTRAINT "cursos_curriculas_curricula_id_fkey" FOREIGN KEY ("curricula_id") REFERENCES "curriculas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_docente_id_fkey" FOREIGN KEY ("docente_id") REFERENCES "docentes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "logs" ADD CONSTRAINT "logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "docentes" ADD CONSTRAINT "docentes_departamento_id_fkey" FOREIGN KEY ("departamento_id") REFERENCES "departamentos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_docente_id_fkey" FOREIGN KEY ("docente_id") REFERENCES "docentes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disponibilidades_docentes" ADD CONSTRAINT "disponibilidades_docentes_docente_id_fkey" FOREIGN KEY ("docente_id") REFERENCES "docentes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disponibilidades_docentes" ADD CONSTRAINT "disponibilidades_docentes_franja_horaria_id_fkey" FOREIGN KEY ("franja_horaria_id") REFERENCES "franjas_horarias"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "postulaciones_cursos" ADD CONSTRAINT "postulaciones_cursos_docente_id_fkey" FOREIGN KEY ("docente_id") REFERENCES "docentes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "postulaciones_cursos" ADD CONSTRAINT "postulaciones_cursos_curso_id_fkey" FOREIGN KEY ("curso_id") REFERENCES "cursos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grupos" ADD CONSTRAINT "grupos_curso_id_fkey" FOREIGN KEY ("curso_id") REFERENCES "cursos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grupos" ADD CONSTRAINT "grupos_periodo_academico_id_fkey" FOREIGN KEY ("periodo_academico_id") REFERENCES "periodos_academicos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "periodos_academicos" ADD CONSTRAINT "periodos_academicos_aprobado_por_id_fkey" FOREIGN KEY ("aprobado_por_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

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
ALTER TABLE "asignaciones_carga_lectiva" ADD CONSTRAINT "asignaciones_carga_lectiva_docente_id_fkey" FOREIGN KEY ("docente_id") REFERENCES "docentes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asignaciones_carga_lectiva" ADD CONSTRAINT "asignaciones_carga_lectiva_docente_compartido_id_fkey" FOREIGN KEY ("docente_compartido_id") REFERENCES "docentes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asignaciones_carga_lectiva" ADD CONSTRAINT "asignaciones_carga_lectiva_grupo_id_fkey" FOREIGN KEY ("grupo_id") REFERENCES "grupos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asignaciones_carga_lectiva" ADD CONSTRAINT "asignaciones_carga_lectiva_periodo_id_fkey" FOREIGN KEY ("periodo_id") REFERENCES "periodos_academicos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cargas_no_lectivas" ADD CONSTRAINT "cargas_no_lectivas_docente_id_fkey" FOREIGN KEY ("docente_id") REFERENCES "docentes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cargas_no_lectivas" ADD CONSTRAINT "cargas_no_lectivas_periodo_id_fkey" FOREIGN KEY ("periodo_id") REFERENCES "periodos_academicos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "declaraciones_carga" ADD CONSTRAINT "declaraciones_carga_docente_id_fkey" FOREIGN KEY ("docente_id") REFERENCES "docentes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "declaraciones_carga" ADD CONSTRAINT "declaraciones_carga_periodo_id_fkey" FOREIGN KEY ("periodo_id") REFERENCES "periodos_academicos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "declaraciones_carga" ADD CONSTRAINT "declaraciones_carga_aprobado_departamento_id_fkey" FOREIGN KEY ("aprobado_departamento_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "declaraciones_carga" ADD CONSTRAINT "declaraciones_carga_aprobado_escuela_id_fkey" FOREIGN KEY ("aprobado_escuela_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "declaraciones_carga" ADD CONSTRAINT "declaraciones_carga_visto_bueno_decano_id_fkey" FOREIGN KEY ("visto_bueno_decano_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
