import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizarNombreSala, validateSala, validateDisponibilidad, parseSalaId } from '../src/validators/sala.validators.js';

describe('validaciones de salas', () => {
  test('normaliza espacios exteriores e interiores', () => assert.equal(normalizarNombreSala('  Sala   Uno  '), 'Sala Uno'));
  test('acepta un nombre de exactamente 10 caracteres', () => assert.deepEqual(validateSala({ nombre: '1234567890' }).errors, []));
  test('rechaza nombre vacío, solo espacios y mayor de 10', () => {
    for (const nombre of ['', '   ', '12345678901']) assert.equal(validateSala({ nombre }).errors[0].field, 'nombre');
  });
  test('acepta fecha válida y consulta de día completo', () => assert.deepEqual(validateDisponibilidad({ fecha: '2026-10-13' }).errors, []));
  test('rechaza fecha inexistente', () => assert.equal(validateDisponibilidad({ fecha: '2026-02-30' }).errors[0].field, 'fecha'));
  test('valida ambas horas y el orden del intervalo', () => {
    assert.equal(validateDisponibilidad({ fecha: '2026-10-13', horaInicio: '09:00' }).errors[0].field, 'horaFin');
    assert.equal(validateDisponibilidad({ fecha: '2026-10-13', horaInicio: '10:00', horaFin: '09:00' }).errors[0].field, 'horaFin');
    assert.deepEqual(validateDisponibilidad({ fecha: '2026-10-13', horaInicio: '09:00', horaFin: '10:00' }).errors, []);
  });
  test('solo acepta identificadores positivos', () => {
    assert.equal(parseSalaId('1'), 1);
    for (const valor of ['0', '-1', 'abc', '']) assert.equal(parseSalaId(valor), null);
  });
});

