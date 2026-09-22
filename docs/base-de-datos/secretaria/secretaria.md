# Entidad Secretaria

La entidad `Secretaria` representa al usuario administrativo de PsicoGestión. Es
la persona encargada de operar el sistema en las tareas del día a día, como el
registro y consulta de pacientes, terapeutas, salas y citas.

En el ERS, esta entidad aparece con un atributo de `nombre_completo`. Sin
embargo, durante la revisión del diseño se decidió, por indicación del
administrador, separar ese dato en campos más específicos: `nombres`,
`apellido_paterno` y `apellido_materno`.

Este ajuste no cambia el propósito de la entidad, pero sí mejora la forma en que
la información puede almacenarse y consultarse. Separar los nombres de los
apellidos facilita búsquedas, ordenamientos y una captura más clara de los
datos personales.

Además de los datos de identificación, la secretaria requiere información de
contacto y credenciales de acceso. El teléfono y el correo electrónico deben ser
únicos, ya que identifican de manera individual a cada usuario dentro del
sistema. En el caso del correo, se mantiene la idea del ERS de trabajar con
credenciales institucionales.

La contraseña se documenta como `contrasena_hash`, ya que en la implementación
no debe almacenarse la contraseña en texto plano. Aunque en los requerimientos
se menciona “contraseña”, para efectos técnicos se considera más apropiado
guardar únicamente su representación protegida.

## Estructura de la entidad

| Campo | Tipo de dato | Restricciones |
|---|---|---|
| `id_secretaria` | INT o UUID | PRIMARY KEY, autogenerado |
| `nombres` | VARCHAR(50) | NOT NULL |
| `apellido_paterno` | VARCHAR(50) | NOT NULL |
| `apellido_materno` | VARCHAR(50) | NULL |
| `telefono` | VARCHAR(15) | NOT NULL, UNIQUE |
| `correo_electronico` | VARCHAR(100) | NOT NULL, UNIQUE |
| `contrasena_hash` | VARCHAR(255) | NOT NULL |

## Observación de diseño

La principal diferencia respecto al ERS original es la sustitución del atributo
`nombre_completo` por los campos `nombres`, `apellido_paterno` y
`apellido_materno`. Esta modificación se realizó por instrucción del
administrador, con el fin de manejar de forma más detallada la información
personal del usuario.

De esta manera, la entidad conserva su función original dentro del sistema,
pero adopta una estructura más adecuada para la administración de datos.

## Requisitos modelados

El esquema de `Secretaria` se diseñó a partir de los requisitos relacionados
con el registro, autenticación y recuperación de cuenta del personal
administrativo.

Los requisitos que se reflejan directamente en esta entidad son los siguientes:

- **RF 1.1.1**: permite registrar a miembros del personal clínico con
  credenciales institucionales UADY.
- **RF 1.1.2 y RF 1.1.3**: establecen el almacenamiento del nombre del usuario y
  su longitud máxima. En el esquema, `nombre_completo` fue sustituido por
  `nombres`, `apellido_paterno` y `apellido_materno` por indicación del
  administrador del sistema.
- **RF 1.1.4 y RF 1.1.5**: requieren almacenar el número telefónico y garantizar
  que sea único.
- **RF 1.1.6, RF 1.1.7 y RF 1.1.8**: requieren almacenar el correo institucional,
  validar su formato como correo UADY y evitar correos duplicados.
- **RF 1.1.12 a RF 1.1.16**: definen la contraseña del usuario y las reglas que
  debe cumplir antes de ser almacenada.
- **RF 1.2.2 y RF 1.2.3**: permiten iniciar sesión utilizando teléfono y
  contraseña.
- **RF 1.2.4 y RF 1.2.5**: permiten iniciar sesión utilizando correo electrónico
  y contraseña.
- **RF 1.4.3 y RF 1.4.4**: utilizan el correo electrónico registrado durante el
  proceso de recuperación de cuenta.

Adicionalmente, el requisito no funcional **RNF 1.4.4** establece que una nueva
contraseña debe almacenarse de forma protegida, y la sección de seguridad del
ERS exige mecanismos seguros para el manejo de contraseñas. Por esta razón, en
la implementación se utiliza el atributo `contrasena_hash` en lugar de
almacenar la contraseña directamente.

No todos los requisitos de administración de cuentas se representan mediante
columnas en esta tabla. Por ejemplo, el envío y validación del código de
verificación, la confirmación de contraseña, el envío del enlace de
recuperación y el cierre de sesión corresponden principalmente a lógica de
aplicación y no requieren, por sí mismos, un atributo permanente dentro de
`Secretaria`.