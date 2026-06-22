WITH software_grupo AS (SELECT id FROM grupos WHERE curso_id = (SELECT id FROM cursos WHERE codigo = 'EE-704') LIMIT 1)
SELECT d.email, d.nombre,
  COALESCE((SELECT SUM(horas_asignadas) FROM asignaciones_carga_lectiva WHERE (docente_id = d.id OR docente_compartido_id = d.id) AND grupo_id != (SELECT id FROM software_grupo)), 0) AS lectivas_sin_software,
  (SELECT COALESCE(SUM(horas), 0) FROM cargas_no_lectivas WHERE docente_id = d.id AND tipo = 'PREPARACION_EVALUACION') AS preparacion
FROM docentes d
ORDER BY lectivas_sin_software;
