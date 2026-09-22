# Entidad Terapeuta

La entidad `Terapeuta` representa al profesional que brinda atención a los
pacientes. Reúne sus datos de identificación y se vincula con los bloques de
horario en los que está disponible y con las citas que atiende.

Es una información de uso frecuente: su consulta es de frecuencia alta, su
creación de frecuencia moderada y su modificación de frecuencia baja.

Las secretarias pueden agregar, consultar y modificar terapeutas. El
administrador de la base de datos tiene las mismas funciones.

## Estructura de la entidad

| Campo | Tipo de dato | Restricciones |
|---|---|---|
| `id_terapeuta` | INT o UUID | PRIMARY KEY, autogenerado |
| `nombre_completo` | VARCHAR(50) | NOT NULL |
| `telefono` | VARCHAR(15) | NOT NULL, UNIQUE |
| `correo_electronico` | VARCHAR(100) | NOT NULL, UNIQUE, formato válido |
| `fecha_nacimiento` | DATE | Debe ser anterior a la fecha de registro |
| `cedula_profesional` | VARCHAR(20) | NOT NULL, UNIQUE |
| `foto_perfil` | TEXT | Opcional, validar mínimo 200x200 px si aplica |

## Observaciones de diseño

- El teléfono, el correo electrónico y la cédula profesional son únicos.
- El formato del correo se valida en la base de datos con una expresión regular
  básica.
- La fecha de nacimiento debe ser anterior a la fecha de registro. Como la tabla
  no tiene columna de registro, la restricción se implementa contra la fecha
  actual (`CURRENT_DATE`).
- La validación de dimensiones mínimas (200x200 px) de `foto_perfil` no puede
  expresarse en SQL y corresponde a la aplicación.
- Las relaciones con `bloque_horario` y `cita` se definen en las tablas
  `disponibilidad_terapeuta` y `cita`.
