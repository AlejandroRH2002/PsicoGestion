# Entidad DisponibilidadSala

La entidad `DisponibilidadSala` es una relación entre salas y sus bloques de
disponibilidad. Indica cuándo una sala está disponible para ser ocupada.

## Estructura de la entidad

| Campo | Tipo de dato | Restricciones |
|---|---|---|
| `id_sala` | INT | FOREIGN KEY → Sala(`id_sala`), NOT NULL |
| `id_bloque` | INT | FOREIGN KEY → BloqueHorario(`id_bloque`), NOT NULL |
| (PK compuesta) | | PRIMARY KEY (`id_sala`, `id_bloque`) |

## Observaciones de diseño

- La llave primaria compuesta evita registrar dos veces la misma sala en el
  mismo bloque.
- Ambas llaves foráneas usan `ON DELETE CASCADE`, según la restricción de
  integridad de borrado en cascada.
