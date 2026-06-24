# Delta: Seed Data (Ampliado)

## Propósito

Poblar base de datos con datos organizacionales, usuarios con nuevos roles, y ejemplos de carga académica para desarrollo y testing.

## ADDED Requirements

### REQ-SEED-001: Datos Organizacionales
El sistema DEBE seedear al menos: 1 Facultad (Ingeniería), 2 Departamentos (Ing. Sistemas, Ing. Industrial), 2 Escuelas (ISI, Industrial), 2 Curriculas (2018, 2022) con cursos vinculados.

| Actor | Sistema (prisma seed) |
|-------|-------|

**Scenario: Ejecutar seed**
- GIVEN base de datos vacía
- WHEN se ejecuta `prisma db seed`
- THEN datos organizacionales completos persisten con relaciones correctas

### REQ-SEED-002: Usuarios con Nuevos Roles
El sistema DEBE seedear usuarios con roles: ADMIN, DECANO, DIRECTOR_DEPARTAMENTO (×2), SECRETARIA_DEPARTAMENTO (×2), DIRECTOR_ESCUELA (×2), DOCENTE (×5).

**Scenario: Login con usuario seed**
- GIVEN seed ejecutado
- WHEN usuario "decano@unt.edu.pe" inicia sesión
- THEN accede a dashboard de DECANO con datos precargados

### REQ-SEED-003: Asignación de Carga Lectiva de Ejemplo
El sistema DEBE seedear asignaciones de carga lectiva con cursos compartidos y splits T/P/L para al menos 3 docentes.

**Scenario: Curso compartido en seed**
- GIVEN seed ejecutado
- WHEN se consulta carga lectiva de periodo activo
- THEN existe al menos 1 curso compartido con 2 docentes (T+P y L)

### REQ-SEED-004: Carga No Lectiva de Ejemplo
El sistema DEBE seedear registros de carga no lectiva variados (3+ tipos) para docentes de ejemplo.

### REQ-SEED-005: Declaraciones en Diferentes Estados
El sistema DEBE seedear declaraciones en estados: BORRADOR, ENVIADA, APROBADA_DEPARTAMENTO, FINALIZADA para demostrar el flujo completo.

### REQ-SEED-006: Limpieza Previa
El seed DEBE ejecutar `deleteMany` en orden de dependencias para todos los modelos nuevos antes de insertar, evitando conflictos de unique constraints en re-ejecuciones.
