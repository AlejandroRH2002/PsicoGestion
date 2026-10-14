# Módulo de salas

Implementación de **EDT 1.4.2.5** (registro) y **EDT 1.4.2.6** (consulta de disponibilidad), correspondiente a RF 4.1.1–4.1.4, RF 4.3.1–4.3.3 y al contrato requerido por RF 5.1.3–5.1.4.

## Modelo y migración

`backend/src/migrations/007_create_sala.sql` crea `sala(id_sala, nombre_sala)`. El nombre es obligatorio, tiene como máximo 10 caracteres y posee un índice único sobre su forma recortada, con espacios compactados y en minúsculas. La API almacena la forma recortada y compactada. Así, `Sala A`, ` SALA   A ` y `sala a` representan el mismo nombre.

La migración no crea citas ni horarios. Cuando se integre el módulo de citas de Juan Kao, las tablas ya diseñadas (`cita`, `cita_bloque` y `bloque_horario`) serán detectadas automáticamente por la consulta.

## API (sesión de secretaria obligatoria)

### Registrar y listar

- `POST /salas`, JSON: `{ "nombre": "Sala A" }`. Responde `201` con `{ message, sala: { id, nombre } }`; `400` para validación y `409` para duplicado.
- `GET /salas`. Responde `{ "salas": [{ "id": 1, "nombre": "Sala A" }] }`.

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

Mientras el módulo de citas no exista, la respuesta usa `fuenteOcupacion: "pendiente_modulo_citas"`, devuelve las salas como libres y la interfaz muestra expresamente esa limitación. No se fabrican reservas.

La prevención concurrente definitiva de doble reserva corresponde a la transacción de creación de citas. La rama de citas inspeccionada usa bloqueo transaccional por sala/terapeuta y vuelve a comprobar la superposición antes del `INSERT`; el endpoint de este módulo es una consulta, no un bloqueo.

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
| EDT 1.4.2.6 / RF 4.3.1–4.3.3 | `GET /salas`, endpoints de disponibilidad, vista `/salas` | pruebas unitarias e integración de salas |
| RF 5.1.3–5.1.4 | contrato por fecha/intervalo y reglas de superposición | casos parcial, completo, consecutivo, libre, reservada y módulo ausente |

