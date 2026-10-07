# Entidad Paciente

La entidad `Paciente` representa a la persona que recibe atención por parte de
un terapeuta. Puede tener múltiples citas a lo largo del tiempo.

La consulta de sus datos es de frecuencia moderada y su modificación de
frecuencia baja. Las secretarias pueden agregar, consultar y modificar
pacientes, y el administrador de la base de datos cuenta con las mismas
funciones.

## Estructura de la entidad

| Campo | Tipo de dato | Restricciones |
|---|---|---|
| `id_paciente` | SERIAL / INT | PRIMARY KEY, autogenerado |
| `nombre_completo` | VARCHAR(50) | NOT NULL |
| `curp` | CHAR(18) | NOT NULL, UNIQUE, exactamente 18 caracteres |
| `sexo` | CHAR(1) | NOT NULL, valores válidos: 'M', 'F', 'O' |
| `fecha_nacimiento` | DATE | NOT NULL, anterior a la fecha de registro |
| `telefono` | VARCHAR(15) | NOT NULL, UNIQUE, formato válido |
| `fecha_registro` | TIMESTAMP | NOT NULL, DEFAULT NOW() |
| `activo` | BOOLEAN | NOT NULL, DEFAULT TRUE (para baja lógica) |
| `fecha_baja` | TIMESTAMPTZ | NULL mientras está activo; CHECK `activo OR fecha_baja IS NOT NULL` |

## Observaciones de diseño

- `curp` se define como `CHAR(18)`, por lo que la longitud exacta queda
  garantizada por el tipo de dato.
- `fecha_nacimiento` se valida contra la fecha actual (`CURRENT_DATE`), que
  coincide con la fecha de registro al momento de crear el paciente.
- El campo `activo` permite la baja lógica, en línea con el requerimiento de
  retención de datos: se conserva el historial de todos los pacientes
  registrados.
- El formato válido del teléfono se verifica en la aplicación.
- `fecha_baja` (migración `005_paciente_estado.sql`) registra cuándo se dio de
  baja al paciente, igual que en `Terapeuta`. La "eliminación" de RF 3.3.1 es
  esta baja lógica: el paciente nunca se borra porque citas e historial
  dependen de él, y puede reactivarse.
- Los documentos adjuntos del paciente viven en la entidad
  [`PacienteArchivo`](../paciente-archivo/paciente-archivo.md).
