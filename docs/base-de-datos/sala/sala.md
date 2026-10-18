# Entidad Sala

La entidad `Sala` representa el espacio físico donde se realizan las citas. Cada
sala puede estar disponible en ciertos bloques de tiempo.

Su consulta es de frecuencia alta, su creación de frecuencia baja y su
modificación de frecuencia baja. Las secretarias pueden agregar, consultar y
modificar salas, y el administrador de la base de datos cuenta con las mismas
funciones.

## Estructura de la entidad

| Campo | Tipo de dato | Restricciones |
|---|---|---|
| `id_sala` | SERIAL / INT | PRIMARY KEY, autogenerado |
| `nombre_sala` | VARCHAR(10) | NOT NULL, UNIQUE |

## Observaciones de diseño

- El único dato propio de la sala es su nombre, que debe ser único.
- La disponibilidad de la sala se modela en `disponibilidad_sala`, y su uso en
  las citas mediante la tabla `cita`.

## Implementación

- `009_sala_estado.sql` agrega `activo` y `fecha_baja`. "Eliminar sala"
  (RF 4.2) es una baja lógica: las citas referencian la sala con `ON DELETE
  RESTRICT` y el historial debe conservarse. Se rechaza si la sala tiene citas
  `Pendiente` por ocurrir.
- La unicidad de `nombre_sala` se aplica solo entre salas activas (índice
  único parcial `WHERE activo`), así que una sala eliminada libera su nombre.
