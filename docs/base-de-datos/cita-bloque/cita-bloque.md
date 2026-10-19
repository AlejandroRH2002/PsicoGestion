# Entidad CitaBloque

La entidad `CitaBloque` es una relación entre una cita y los bloques horarios
que ocupa. Permite modelar citas de duración variable y verificar conflictos de
horario.

## Estructura de la entidad

| Campo | Tipo de dato | Restricciones |
|---|---|---|
| `id_cita` | INT | FOREIGN KEY → Cita(`id_cita`), NOT NULL |
| `id_bloque` | INT | FOREIGN KEY → BloqueHorario(`id_bloque`), NOT NULL |
| (PK compuesta) | | PRIMARY KEY (`id_cita`, `id_bloque`) |

## Observaciones de diseño

- La llave primaria compuesta evita asociar dos veces el mismo bloque a la misma
  cita.
- Ambas llaves foráneas usan `ON DELETE CASCADE`, según la restricción de
  integridad de borrado en cascada.

## Implementación (`008_create_cita.sql`)

- La FK a `cita` es `CASCADE`: al editar el horario se reemplazan los bloques de la cita. La FK a `bloque_horario` es `RESTRICT`.
