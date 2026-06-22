
-- Obtener docente Juan Santos
SELECT id, email, nombre FROM docentes WHERE email = 'jsantos@unitru.edu.pe';

-- Obtener periodos
SELECT id, nombre FROM periodoAcademico WHERE activo = true;

-- Obtener cursos y grupos existentes
SELECT c.id AS curso_id, c.codigo, c.nombre, g.id AS grupo_id, g.nombre AS grupo_nombre, c.ciclo, c."horasTeoria", c."horasPractica", c."horasLaboratorio"
FROM cursos c
JOIN grupos g ON c.id = g.curso_id
WHERE g."periodoAcademicoId" = (SELECT id FROM periodoAcademico WHERE activo = true)
AND c.nombre NOT LIKE '%Ing. de Software%
LIMIT 10;
