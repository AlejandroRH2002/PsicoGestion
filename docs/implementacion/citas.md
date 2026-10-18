# Módulo de citas

Implementación de RF 5.1 (agendar), RF 5.2 (visualizar), RF 5.3 (modificar) y RF 5.4 (cancelar). Integra los módulos existentes de pacientes, terapeutas y salas.

## Decisiones

- **La disponibilidad se calcula solo a partir de las citas.** Un horario está libre si el terapeuta no tiene otra cita `Pendiente` que se cruce y queda al menos una sala libre. Todavía no se crean `disponibilidad_terapeuta` ni `disponibilidad_sala`, porque no hay una interfaz para cargarlas. Si se agregan después, `calcularRejilla` es el único punto que hay que extender.
- **Rejilla de agenda:** bloques de 30 min, de lunes a viernes, de 07:00 a 17:00 (20 bloques al día). Duraciones permitidas: 30, 60 y 90 min (60 por defecto). Los valores están en constantes en `backend/src/validators/cita.validators.js` y se repiten en `frontend/src/utils/cita.ts`.
- **Horario:** igual que en el modelo de datos, el horario no se guarda en `cita`. Una cita ocupa N bloques de `bloque_horario` asociados en `cita_bloque`. Los bloques se crean cuando se necesitan, son únicos por `(fecha, hora_inicio, hora_fin)` y varias citas pueden compartirlos. Lo que define la ocupación es el estado de la cita, no la existencia del bloque.
- **Folio:** `CIT-AAAA-NNNNN`, generado a partir de `id_cita` en la misma transacción del `INSERT`, así que no puede repetirse. La columna es `VARCHAR(20)` y no `VARCHAR(10)` como en `docs/base-de-datos/cita`, porque el formato del diseño ocupa 14 caracteres.
- **Integridad:** las FK hacia `paciente`, `terapeuta` y `sala` usan `ON DELETE RESTRICT`. Esas entidades se dan de baja con borrado lógico y el historial de citas debe conservarse. Las citas nunca se borran: cancelar solo cambia el estado.
- **Vencidas:** las citas `Pendiente` cuyo último bloque ya terminó pasan a `Vencida` sin necesidad de un cron. `marcarVencidas` se ejecuta antes de listar, obtener o calcular la disponibilidad. La hora de referencia es la del servidor Node, no la de PostgreSQL.
- **Doble reserva:** `crearCita` y `actualizarCita` se ejecutan en una transacción.
  1. Toman `pg_advisory_xact_lock` sobre `sala:id:fecha`, `terapeuta:id:fecha` y `paciente:id:fecha`, siempre en el mismo orden para evitar deadlocks.
  2. Ya con los locks, vuelven a comprobar si hay cruces.

  De dos solicitudes simultáneas por el mismo recurso y horario, solo una se registra (está cubierto por una prueba).
- **Notificación (RF 5.1.14):** la confirmación se envía por correo al `paciente.correo` (campo opcional, migración `010_paciente_correo.sql`) con el mailer existente (`utils/mailer.js`). Incluye nombre, fecha y hora, folio, terapeuta y sala. `backend/src/utils/notificador.js` se llama después del COMMIT y nunca lanza: devuelve `notificacion` = `{ enviada: true, destino }` o `{ enviada: false, motivo }`, con `motivo` `sin_correo`, `error` o `no_aplica` (la cita modificada ya no está `Pendiente`). La interfaz muestra ese resultado tras agendar o modificar. Sin `SMTP_HOST` (desarrollo y pruebas) el correo se imprime en consola en lugar de enviarse.
- **Cancelación por folio (RF 5.4.2):** `/citas` tiene un campo «Cancelar por folio» que busca la cita con `GET /citas/folio/:folio` y abre el mismo diálogo de confirmación que el botón de cada fila. El botón de la fila se conserva como atajo.
- **Salas eliminadas:** una cita `Pendiente` solo puede asignarse a una sala activa (RF 4.2, baja lógica). `verificarReferencias` lee la sala con `FOR SHARE` para serializarse con `sala.service.js#eliminarSala`.
- **Activos:** una cita `Pendiente` solo se puede asignar a pacientes y terapeutas activos. Si la cita se cancela o vence, se conserva aunque la persona se dé de baja después.

## API (requiere sesión de secretaria)

| Método y ruta | Descripción | Respuesta |
|---|---|---|
| `GET /citas?q&estado&salaId&terapeutaId&periodo=dia\|semana\|mes&fecha&page` | Directorio paginado (10 por página). `q` busca por nombre de paciente o folio. `periodo` filtra respecto a `fecha` (hoy por defecto). | `{ citas, conteos: { todas, pendientes, canceladas, vencidas }, total, page, limit }` |
| `GET /citas/disponibilidad?terapeutaId&semana=AAAA-MM-DD&duracion&excluir` | Rejilla de la semana (lunes a viernes) que contiene `semana`. `excluir` deja fuera una cita, para editarla. | `{ semana: { inicio, fin }, duracion, jornada, dias: [{ fecha, slots: [{ horaInicio, horaFin, estado, motivo, salasLibres }] }] }` |
| `GET /citas/folio/:folio` | Busca una cita por folio (`CIT-AAAA-NNNNN`, sin distinguir mayúsculas). `400` si el formato es inválido, `404` si no existe. | `{ cita }` |
| `GET /citas/:id` | Detalle de una cita. | `{ cita }` |
| `POST /citas` | `{ pacienteId, terapeutaId, salaId, fecha, horaInicio, duracion }`. Siempre se crea como `Pendiente`. | `201 { message, cita, notificacion }` |
| `PUT /citas/:id` | Mismos campos más `estado`. Solo se revalidan los conflictos si la cita queda `Pendiente`. | `{ message, cita, notificacion }` |
| `PATCH /citas/:id/cancelar` | Pasa la cita a `Cancelada`. | `{ message, cita }` |

`cita = { id, folio, estado, paciente: {id, nombre}, terapeuta: {id, nombre}, sala: {id, nombre}, fecha, horaInicio, horaFin, duracion }`.

En cada slot, `estado` puede ser `disponible`, `ocupado` (con `motivo` `terapeuta` o `salas`), `pasado` o `fuera`. `fuera` significa que la duración ya no cabe antes de las 17:00.

**Errores:**
- `400 { errors: [{ field, message }] }`: datos inválidos, o paciente, terapeuta o sala inexistentes.
- `409 { errors: [...] }`: cruce de horario (`field` = `terapeutaId`, `salaId` o `pacienteId`), persona dada de baja o cita ya cancelada.
- `404 { error }`: la cita no existe.

## Interfaz

- `/citas`: directorio con pestañas por estado y su conteo, búsqueda, filtros de sala, terapeuta y periodo (día, semana, mes, con fecha de referencia), paginación y cancelación con confirmación. Los filtros se guardan en la URL.
- `/citas/nueva`: asistente en tres pasos.
  1. Paciente y terapeuta, con búsqueda.
  2. Rejilla semanal, duración, sala elegida entre las libres y estatus fijo `Pendiente`.
  3. Confirmación.

  Al final se muestra una pantalla de éxito con el folio. Si otra persona ocupa el horario mientras se confirma, el asistente vuelve al paso 2 con la rejilla recargada y conserva la selección de paciente y terapeuta.
- `/citas/editar?id=N`: edición de paciente, terapeuta, sala, horario y estatus. El horario se cambia con la misma rejilla dentro de un diálogo, y se pide confirmación antes de guardar.

El código de la interfaz está repartido así:
- Componentes: `frontend/src/components/citas/`.
- Lógica compartida: `frontend/src/utils/cita.ts` (API, validación espejo, selector con búsqueda y rejilla).
- Lógica de cada página: `cita-nueva.ts`, `cita-directorio.ts` y `cita-editar.ts`.

## Trazabilidad

| Requisito | Implementación | Pruebas |
|---|---|---|
| RF 5.1.1–5.1.5 | `validateCita`, `disponibilidadSemana`/`calcularRejilla`, pasos 1 y 2 de `/citas/nueva` | `cita.validators.test.js`, `integracion/citas.test.js` (rejilla) |
| RF 5.1.6–5.1.13 | `crearCita` (transacción, locks, folio), paso 3 y pantalla de éxito | `integracion/citas.test.js` (alta, conflictos, carrera) |
| RF 5.1.14 | `utils/notificador.js` (correo al paciente), campo `correo` del paciente | `cita.validators.test.js` (redacción), `integracion/citas.test.js` (resultado del envío), `integracion/pacientes.test.js` (correo) |
| RF 5.2.1–5.2.3 | `listarCitas`, `/citas` | `integracion/citas.test.js` (conteos, filtros, búsqueda, paginación) |
| RF 5.3.1–5.3.6 | `actualizarCita`, `/citas/editar` | `integracion/citas.test.js` (edición y conflicto al editar) |
| RF 5.4.1–5.4.4 | `cancelarCita`, `GET /citas/folio/:folio`, campo «Cancelar por folio» y diálogo del directorio | `cita.validators.test.js` (`parseFolio`), `integracion/citas.test.js` (cancelación y búsqueda por folio) |
| RF 4.3.3 (salas) | `sala.service.js#consultarDisponibilidad` lee `cita`/`cita_bloque` | `integracion/citas.test.js`, `integracion/salas.test.js` |
