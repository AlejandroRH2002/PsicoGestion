# Entidad DisponibilidadTerapeuta

La entidad `DisponibilidadTerapeuta` es una relación entre terapeutas y bloques
de tiempo. Indica cuándo un terapeuta está libre para ser asignado a una cita.

## Estructura de la entidad

| Campo | Tipo de dato | Restricciones |
|---|---|---|
| `id_terapeuta` | INT | FOREIGN KEY → Terapeuta(`id_terapeuta`), NOT NULL |
| `id_bloque` | INT | FOREIGN KEY → BloqueHorario(`id_bloque`), NOT NULL |
| (PK compuesta) | | PRIMARY KEY (`id_terapeuta`, `id_bloque`) |

## Observaciones de diseño

- La llave primaria compuesta evita registrar dos veces al mismo terapeuta en el
  mismo bloque.
- Ambas llaves foráneas usan `ON DELETE CASCADE`, según la restricción de
  integridad de borrado en cascada.
