
-- Obtener todos los cursos y grupos
SELECT 
  c.id AS curso_id, 
  c.codigo, 
  c.nombre, 
  g.id AS grupo_id, 
  g.nombre AS grupo_nombre,
  c.horas_teoria,
  c.horas_practica,
  c.horas_laboratorio
FROM cursos c
JOIN grupos g ON c.id = g.curso_id
WHERE g.periodo_academico_id = (SELECT id FROM periodo_academico WHERE activo = true)
ORDER BY c.nombre;
