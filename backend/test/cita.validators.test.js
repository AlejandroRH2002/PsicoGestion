import './setup-env.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateCrearCita, validateDisponibilidad } from '../src/validators/cita.validators.js';

test('valida disponibilidad con IDs positivos y fecha calendario', () => {
  assert.deepEqual(validateDisponibilidad({ terapeutaId: '2', salaId: '3', fecha: '2026-11-05' }), {
    errors: [],
    data: { terapeutaId: 2, salaId: 3, fecha: '2026-11-05' },
  });
});

test('rechaza IDs inválidos y fechas inexistentes en disponibilidad', () => {
  const { errors } = validateDisponibilidad({ terapeutaId: '0', salaId: 'x', fecha: '2026-02-30' });
  assert.deepEqual(errors.map(({ field }) => field), ['terapeutaId', 'salaId', 'fecha']);
});

test('valida IDs y bloques distintos para una nueva cita', () => {
  assert.deepEqual(
    validateCrearCita({ pacienteId: '1', terapeutaId: 2, salaId: 3, bloques: ['4', 5] }),
    {
      errors: [],
      data: { pacienteId: 1, terapeutaId: 2, salaId: 3, bloques: [4, 5] },
    }
  );
});

test('rechaza bloques vacíos, duplicados o inválidos', () => {
  assert.deepEqual(
    validateCrearCita({ pacienteId: 1, terapeutaId: 2, salaId: 3, bloques: [4, 4] }).errors,
    [{ field: 'bloques', message: 'No se puede seleccionar el mismo bloque más de una vez.' }]
  );
  assert.equal(validateCrearCita({ pacienteId: 1, terapeutaId: 2, salaId: 3, bloques: [] }).errors[0].field, 'bloques');
  assert.equal(validateCrearCita({ pacienteId: 1, terapeutaId: 2, salaId: 3, bloques: ['x'] }).errors[0].field, 'bloques');
});
