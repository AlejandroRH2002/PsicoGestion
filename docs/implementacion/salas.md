# Módulo de salas

Implementación de **EDT 1.4.2.5** (registro), la eliminación de salas y **EDT 1.4.2.6** (consulta de disponibilidad), correspondiente a RF 4.1.1–4.1.4, RF 4.2.1–4.2.5, RF 4.3.1–4.3.3 y al contrato requerido por RF 5.1.3–5.1.4.

## Modelo y migración

`backend/src/migrations/007_create_sala.sql` crea `sala(id_sala, nombre_sala)`. El nombre es obligatorio, tiene como máximo 10 caracteres y posee un índice único sobre su forma recortada, con espacios compactados y en minúsculas. La API almacena la forma recortada y compactada. Así, `Sala A`, ` SALA   A ` y `sala a` representan el mismo nombre.

`009_sala_estado.sql` agrega `activo` y `fecha_baja` (baja lógica) y convierte el índice único en parcial (`WHERE activo`): el nombre solo es único entre salas activas.

En el formulario, el campo nombre no usa `maxlength`, porque recortaba en silencio lo escrito o pegado. El contador `n / 10` se pone en rojo y el error aparece en cuanto el nombre normalizado excede 10 caracteres.

La migración no crea citas ni horarios. Esas tablas (`cita`, `cita_bloque` y `bloque_horario`) las crea `008_create_cita.sql` del módulo de citas (ver `docs/implementacion/citas.md`) y la consulta las detecta automáticamente.

## API (sesión de secretaria obligatoria)

### Registrar y listar

- `POST /salas`, JSON: `{ "nombre": "Sala A" }`. Responde `201` con `{ message, sala: { id, nombre } }`; `400` para validación y `409` para duplicado.
- `GET /salas`. Responde `{ "salas": [{ "id": 1, "nombre": "Sala A" }] }`.

### Eliminar (RF 4.2)

- `DELETE /salas/:id`. Responde `200 { message: 'Sala eliminada correctamente.' }`.
- Es una baja lógica: la fila se conserva para el historial de citas y la sala deja de aparecer en `GET /salas`, en la disponibilidad y en la rejilla y los formularios de citas. Las citas pasadas siguen mostrando su sala.
- `409 { errors: [{ field: 'sala', message }] }` si la sala tiene citas `Pendiente` por ocurrir: primero hay que reprogramarlas o cancelarlas.
- `404` si la sala no existe o ya fue eliminada.
- La eliminación bloquea la fila (`FOR UPDATE`) y la creación o edición de citas la lee con `FOR SHARE`, así que no puede agendarse una cita en una sala mientras se elimina.
- En `/salas`, cada tarjeta tiene un botón Eliminar que abre un diálogo de confirmación. El resultado se muestra en un aviso sobre la lista.

### Consultar disponibilidad

- Día completo: `GET /salas/disponibilidad?fecha=2026-10-13`
- Intervalo: `GET /salas/disponibilidad?fecha=2026-10-13&horaInicio=09:00&horaFin=10:00`
- Una sala: `GET /salas/1/disponibilidad?fecha=2026-10-13&horaInicio=09:00&horaFin=10:00`

Respuesta para consumo del formulario de citas:

```json
{
  "fecha": "2026-10-13",
  "horaInicio": "09:00",
  "horaFin": "10:00",
  "fuenteOcupacion": "citas",
  "salas": [
    { "id": 1, "nombre": "Sala A", "estado": "reservada", "ocupaciones": [{ "horaInicio": "09:30", "horaFin": "10:30" }] },
    { "id": 2, "nombre": "Sala B", "estado": "libre", "ocupaciones": [] }
  ]
}
```

La ocupación considera únicamente citas `Pendiente` y aplica `inicioOcupado < finConsultado && finOcupado > inicioConsultado`; dos intervalos consecutivos no chocan. Citas `Cancelada` y `Vencida` no reservan la sala. La respuesta nunca expone paciente, terapeuta ni folio.

Si las tablas de citas no existieran (base sin migrar hasta 008), la respuesta usa `fuenteOcupacion: "pendiente_modulo_citas"`, devuelve las salas como libres y la interfaz muestra expresamente esa limitación. No se fabrican reservas.

La prevención concurrente definitiva de doble reserva corresponde a la transacción de creación de citas. El módulo de citas toma un bloqueo transaccional por sala/terapeuta/paciente y fecha y vuelve a comprobar la superposición antes de escribir; el endpoint de este módulo es una consulta, no un bloqueo.

## Ejecución y pruebas

```bash
cd backend
npm run migrate
npm test

cd ../frontend
npm run build
```

Las pruebas de integración requieren `TEST_DATABASE_URL`, distinto de `DATABASE_URL`. Sin esa variable se omiten de forma explícita.

## Trazabilidad

| Requisito | Implementación | Pruebas |
|---|---|---|
| EDT 1.4.2.5 / RF 4.1.1–4.1.4 | migración 007, validador, servicio, `POST /salas`, formulario | `sala.validators.test.js`, `sala.service.test.js`, `integracion/salas.test.js` |
| RF 4.2.1–4.2.5 | migración 009, `eliminarSala`, `DELETE /salas/:id`, botón y diálogo en `/salas` | `integracion/salas.test.js` (baja lógica, 409 con citas pendientes, nombre liberado) |
| EDT 1.4.2.6 / RF 4.3.1–4.3.3 | `GET /salas`, endpoints de disponibilidad, vista `/salas` | pruebas unitarias e integración de salas |
| RF 5.1.3–5.1.4 | contrato por fecha/intervalo y reglas de superposición | casos parcial, completo, consecutivo, libre, reservada y módulo ausente |
