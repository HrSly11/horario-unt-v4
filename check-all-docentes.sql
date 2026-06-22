
-- Verificar todos los docentes
SELECT 
  d.id,
  d.email,
  d.nombre,
  COALESCE(SUM(a.horas_asignadas), 0) AS total_horas_lectivas,
  COALESCE((SELECT SUM(cnl.horas) FROM cargas_no_lectivas cnl WHERE cnl.docente_id = d.id AND cnl.tipo = 'PREPARACION_EVALUACION'), 0) AS horas_preparacion,
  FLOOR(COALESCE(SUM(a.horas_asignadas), 0) * 0.5) AS limite_preparacion,
  CASE 
    WHEN COALESCE((SELECT SUM(cnl.horas) FROM cargas_no_lectivas cnl WHERE cnl.docente_id = d.id AND cnl.tipo = 'PREPARACION_EVALUACION'), 0) > FLOOR(COALESCE(SUM(a.horas_asignadas), 0) * 0.5) 
    THEN 'EXCEDE' 
    ELSE 'OK' 
  END AS estado
FROM docentes d
LEFT JOIN asignaciones_carga_lectiva a ON (a.docente_id = d.id OR a.docente_compartido_id = d.id)
GROUP BY d.id, d.email, d.nombre
ORDER BY total_horas_lectivas;
