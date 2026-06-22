
-- Obtener periodos
SELECT id, nombre, activo FROM periodos_academicos;

-- Obtener Juan Santos
SELECT id, email, nombre FROM docentes WHERE email = 'jsantos@unitru.edu.pe';

-- Obtener todos los grupos y cursos
SELECT 
  g.id AS grupo_id,
  g.nombre AS grupo_nombre,
  c.id AS curso_id,
  c.codigo,
  c.nombre AS curso_nombre,
  c.horas_teoria,
  c.horas_practica,
  c.horas_laboratorio,
  c.num_grupos_laboratorio
FROM grupos g
JOIN cursos c ON g.curso_id = c.id
WHERE g.periodo_academico_id = (SELECT id FROM periodos_academicos WHERE activo = true);
