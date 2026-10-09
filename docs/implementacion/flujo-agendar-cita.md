# Flujo para agendar una cita

## Objetivo y alcance

La secretaria agenda una cita para un paciente con un terapeuta, en una sala y
en uno o más bloques consecutivos. La cita conserva el folio y el estado
definidos por el modelo de datos. La aplicación no debe ofrecer horarios
ocupados ni aceptar una selección que haya dejado de estar disponible.

El esquema sigue las entidades documentadas en
[`../base-de-datos/README.md`](../base-de-datos/README.md): `cita`,
`cita_bloque`, `bloque_horario`, `disponibilidad_terapeuta`,
`disponibilidad_sala` y `sala`. El horario se deriva de los bloques asociados a
la cita, lo que permite una duración variable.

## Flujo funcional propuesto

1. La secretaria inicia sesión y abre la opción para agendar una cita.
2. Busca y selecciona un paciente activo. Se reutiliza la búsqueda de pacientes
   existente; no se vuelven a capturar sus datos durante el agendamiento.
3. Selecciona un terapeuta activo.
4. Selecciona una sala y una fecha. El sistema consulta los bloques que están
   marcados disponibles simultáneamente para ese terapeuta y esa sala.
5. Selecciona uno o más bloques consecutivos. La duración es la suma de los
   bloques seleccionados; todos deben corresponder al mismo día.
6. Revisa el resumen (paciente, terapeuta, sala, fecha y horario) y confirma.
7. El backend vuelve a comprobar paciente, terapeuta, disponibilidad y
   ocupación dentro de una transacción. Si otra secretaria reservó el horario,
   se informa el conflicto y se solicita elegir otro bloque.
8. Si se confirma, se muestra el folio y los datos de la cita.

Las citas nuevas quedan en estado `Pendiente`. La cancelación, notificaciones,
recordatorios y la gestión de citas vencidas quedan fuera de esta primera
entrega; deben definirse antes de ampliar el flujo. El ENUM documentado no
incluye estado de cita completada.

## Persistencia

`backend/src/migrations/005_create_citas.sql` incorpora las tablas de sala,
bloques, disponibilidades, cita y relación cita-bloque en el ejecutor de
migraciones del backend. Los datos de terapeuta y paciente reutilizan sus
tablas existentes. `cita_bloque` mantiene la relación de duración variable y
sus llaves compuestas evitan asociar el mismo bloque dos veces a una cita.

La escritura se realiza en una transacción: se serializan las reservas por
terapeuta y sala con bloqueos advisory transaccionales, se comprueban los
bloques y sus disponibilidades, se rechazan horarios vencidos, no consecutivos
u ocupados, y finalmente se insertan `cita` y sus filas de `cita_bloque`. Así,
dos solicitudes concurrentes no pueden confirmar una reserva incompatible.
Las consultas de disponibilidad filtran también citas activas que se
superponen temporalmente, incluso si los bloques existentes no tienen el mismo
identificador.

El ERS y el SQL del modelo usan `ON DELETE CASCADE`, mientras que la
documentación de paciente y terapeuta requiere conservar historial (y el
backend implementa bajas lógicas para esas entidades). La migración mantiene
las reglas documentadas; antes de habilitar borrados físicos en producción se
debe decidir si las citas históricas deben protegerse con `RESTRICT` o
`SET NULL`.

## API de la primera implementación

Todas las rutas requieren la sesión actual de secretaria:

- `GET /citas/disponibilidad?terapeutaId=<id>&salaId=<id>&fecha=AAAA-MM-DD`
  devuelve `{ bloques: [{ id, fecha, horaInicio, horaFin }] }` con bloques
  futuros y libres para ambos recursos.
- `GET /citas/salas` devuelve `{ salas: [{ id, nombre }] }` para poblar el
  selector de sala.
- `POST /citas` recibe
  `{ pacienteId, terapeutaId, salaId, bloques: [idBloque, ...] }` y responde
  `201` con `{ message, cita }`. Devuelve `400` para datos inválidos, `404`
  cuando no existe alguno de los recursos o `409` cuando los bloques ya no
  pueden reservarse.

El folio de diez caracteres lo genera el backend. Ningún identificador de sala,
bloque, folio ni estado enviado por el cliente se considera confiable.

## Estado de implementación y próximos pasos

- **Base implementada:** migración, disponibilidad y creación atómica en API;
  ambas rutas requieren autenticación.
- **Base web implementada:** la página `/citas` busca pacientes activos,
  permite seleccionar terapeuta, sala, fecha y bloques, y presenta conflictos
  o confirmación. La página requiere sesión activa.
- **Siguiente:** completar pruebas de integración de reserva, concurrencia,
  bloqueos y permisos; acordar cancelación, conservación histórica, zonas
  horarias, notificaciones y administración de salas/disponibilidades.

Aplicar la migración con `npm run migrate` desde `backend/`. La creación de
bloques, salas y disponibilidades administrativas aún requiere carga/gestión
de datos: este primer paso las persiste y permite consumirlas, no crea
automáticamente horarios de consulta.