# Entidad BloqueHorario

La entidad `BloqueHorario` representa un intervalo de tiempo definido por una
fecha y una hora de inicio y fin. Permite planificar la agenda diaria de citas y
controlar la disponibilidad de terapeutas y salas.

## Estructura de la entidad

| Campo | Tipo de dato | Restricciones |
|---|---|---|
| `id_bloque` | SERIAL / INT | PRIMARY KEY, autogenerado |
| `fecha` | DATE | NOT NULL |
| `hora_inicio` | TIME | NOT NULL |
| `hora_fin` | TIME | NOT NULL, posterior a `hora_inicio` |

## Observaciones de diseño

- La restricción de que `hora_fin` sea posterior a `hora_inicio` se implementa
  con un `CHECK`.
- La tabla se relaciona con `disponibilidad_terapeuta`, `disponibilidad_sala` y
  `cita_bloque`.

## Implementación (`008_create_cita.sql`)

- Los bloques son de 30 min y se crean cuando se necesitan al agendar. `UNIQUE (fecha, hora_inicio, hora_fin)` permite que varias citas compartan el mismo bloque. Lo que define si está ocupado es el estado de la cita, no la existencia del bloque.
- Por ahora no se crean `disponibilidad_terapeuta` ni `disponibilidad_sala`: la disponibilidad se deduce de las citas `Pendiente` (ver `docs/implementacion/citas.md`).
