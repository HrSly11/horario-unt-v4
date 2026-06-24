# Especificación: Estructura Organizacional

## Propósito

Jerarquía institucional UNT: Facultad → Departamento → Escuela → Curricula. CRUD completo con designación de autoridades por Decano.

## Requirements

### REQ-ORG-001: CRUD de Facultad
El sistema DEBE permitir al ADMIN crear, leer, actualizar y eliminar facultades con `nombre` y `siglas` únicos.

| Actor | ADMIN |
|-------|-------|
| Validación | `nombre` @unique, `siglas` @unique |

**Happy Path: Crear Facultad**
- GIVEN usuario autenticado como ADMIN
- WHEN crea facultad con nombre "Ingeniería" y siglas "FI"
- THEN facultad persiste y aparece en listado

**Edge Case: Nombre duplicado**
- GIVEN existe facultad "Ingeniería"
- WHEN ADMIN crea otra con nombre "Ingeniería"
- THEN sistema rechaza con error de unicidad

### REQ-ORG-002: CRUD de Departamento
El sistema DEBE permitir al ADMIN crear, leer, actualizar y eliminar departamentos asociados a una facultad. La combinación `(nombre, facultadId)` DEBE ser única.

| Actor | ADMIN, DIRECTOR_DEPARTAMENTO (lectura) |
|-------|-------|
| Relaciones | FK → Facultad, directorId → User, secretariaId → User |

**Scenario: Asignar Director**
- GIVEN departamento "Ing. Sistemas" existe sin director
- WHEN ADMIN asigna a usuario con rol DOCENTE como director
- THEN `departamento.directorId` se actualiza

**Edge Case: Eliminar departamento con docentes**
- GIVEN departamento tiene docentes asignados
- WHEN ADMIN intenta eliminar
- THEN sistema rechaza con error de integridad referencial

### REQ-ORG-003: CRUD de Escuela
El sistema DEBE permitir al ADMIN crear, leer, actualizar y eliminar escuelas asociadas a una facultad. La combinación `(nombre, facultadId)` DEBE ser única.

| Actor | ADMIN, DECANO (lectura), DIRECTOR_ESCUELA (lectura) |
|-------|-------|
| Relaciones | FK → Facultad, directorId → User |

**Scenario: Designar Director de Escuela por Decano**
- GIVEN escuela "ISI" existe y decano autenticado
- WHEN decano designa a un docente como director
- THEN `escuela.directorId` y `escuela.designadoPorId` se actualizan con fecha

**Edge Case: Docente designado en múltiples escuelas**
- GIVEN docente ya es director de escuela "ISI"
- WHEN decano intenta designarlo en escuela "Industrial"
- THEN sistema DEBE validar que un docente no dirija más de una escuela

### REQ-ORG-004: CRUD de Curricula
El sistema DEBE permitir al ADMIN crear, leer, actualizar y eliminar curriculas asociadas a una escuela. La combinación `(codigo, escuelaId)` DEBE ser única.

| Actor | ADMIN |
|-------|-------|
| Relaciones | FK → Escuela |

**Scenario: Asignar cursos a curricula**
- GIVEN curricula "2018" de escuela "ISI"
- WHEN ADMIN agrega cursos con `ciclo` y `esElectivo`
- THEN relación `CursoCurricula` se crea para cada curso

### REQ-ORG-005: Designación de Autoridades
El sistema DEBE permitir al DECANO designar directores de Escuela y Departamento, registrando quién designó (`designadoPorId`) y cuándo (`fechaDesignacion`).

**Scenario: Decano designa Director de Departamento**
- GIVEN departamento "Ing. Sistemas" y decano autenticado
- WHEN decano designa a un docente como director
- THEN `departamento.directorId`, `designadoPorId`, `fechaDesignacion` se actualizan

### REQ-ORG-006: Visualización Jerárquica
El sistema DEBE mostrar la estructura Facultad → Departamentos → Escuelas → Curriculas de forma navegable.

**Scenario: Navegar jerarquía**
- GIVEN datos organizacionales poblados
- WHEN usuario navega a vista de organización
- THEN se muestra árbol Facultad > Departamentos > Escuelas > Curriculas
