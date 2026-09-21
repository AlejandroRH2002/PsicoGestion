# Entidad Cita

La entidad `Cita` registra una atención entre un paciente y un terapeuta en una
sala. Se relaciona con `paciente`, `terapeuta` y `sala`, y puede ocupar uno o
más bloques de tiempo mediante `cita_bloque`.

Es la entidad de mayor uso: su creación y consulta son de frecuencia alta y su
modificación de frecuencia moderada. Las secretarias pueden agregar, consultar y
modificar citas, y el administrador de la base de datos cuenta con las mismas
funciones.

## Estructura de la entidad

| Campo | Tipo de dato | Restricciones |
|---|---|---|
| `id_cita` | SERIAL / INT | PRIMARY KEY, autogenerado |
| `id_paciente` | INT | FOREIGN KEY → Paciente(`id_paciente`), NOT NULL |
| `id_terapeuta` | INT | FOREIGN KEY → Terapeuta(`id_terapeuta`), NOT NULL |
| `id_sala` | INT | FOREIGN KEY → Sala(`id_sala`), NOT NULL |
| `folio` | VARCHAR(10) | NOT NULL, UNIQUE |
| `estado` | ENUM | NOT NULL, valores: 'Pendiente', 'Cancelada', 'Vencida' |

## Observaciones de diseño

- El estado se implementa como el tipo enumerado `estado_cita`.
- El horario de la cita no se guarda en esta tabla: se obtiene de los bloques
  asociados en `cita_bloque`, lo que permite citas de duración variable.
- Las llaves foráneas usan `ON DELETE CASCADE`, según la restricción de
  integridad de borrado en cascada.
- Los datos del ERS indican también que deben conservarse los registros
  históricos de citas. Esto conviene tenerlo presente al decidir si se eliminan
  pacientes, terapeutas o salas, ya que el borrado en cascada eliminaría sus
  citas.
