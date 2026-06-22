
-- Robert Sánchez: horas lectivas actuales
SELECT 
  a.id,
  c.nombre AS curso,
  g.nombre AS grupo,
  a.tipo,
  a.horas_asignadas,
  CASE WHEN a.docente_id = d.id THEN 'PRINCIPAL' ELSE 'COMPARTIDO' END AS rol
FROM docentes d
LEFT JOIN asignaciones_carga_lectiva a ON (a.docente_id = d.id OR a.docente_compartido_id = d.id)
LEFT JOIN grupos g ON a.grupo_id = g.id
LEFT JOIN cursos c ON g.curso_id = c.id
WHERE d.email = 'rsanchez@unitru.edu.pe'
ORDER BY c.nombre;

-- Total horas lectivas de Robert
SELECT 
  SUM(a.horas_asignadas) AS total_horas_lectivas
FROM docentes d
LEFT JOIN asignaciones_carga_lectiva a ON (a.docente_id = d.id OR a.docente_compartido_id = d.id)
WHERE d.email = 'rsanchez@unitru.edu.pe';

-- Preparación y evaluación de Robert
SELECT 
  cnl.id,
  cnl.tipo,
  cnl.horas
FROM docentes d
LEFT JOIN cargas_no_lectivas cnl ON d.id = cnl.docente_id
WHERE d.email = 'rsanchez@unitru.edu.pe'
  AND cnl.tipo = 'PREPARACION_EVALUACION';
