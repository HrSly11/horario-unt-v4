SELECT COUNT(*) as total, SUM(CASE WHEN aperturado THEN 1 ELSE 0 END) as aperturados FROM cursos;
