import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { validateAgenda, rangoAgenda } from '../src/validators/agenda.validators.js';

const AHORA = new Date(2026, 9, 13, 10, 15); // martes 13 de octubre de 2026
const campos = (r) => r.errors.map((e) => e.field);

describe('validateAgenda', () => {
  test('por defecto muestra la semana actual', () => {
    const r = validateAgenda({}, { ahora: AHORA });
    assert.deepEqual(r.errors, []);
    assert.deepEqual(r.data, { vista: 'semana', fecha: '2026-10-13', desde: '2026-10-12', hasta: '2026-10-16', terapeutaId: null, salaId: null });
  });

  test('día, semana y mes calculan su rango', () => {
    assert.deepEqual(rangoAgenda('dia', '2026-10-13'), { desde: '2026-10-13', hasta: '2026-10-13' });
    assert.deepEqual(rangoAgenda('semana', '2026-10-18'), { desde: '2026-10-12', hasta: '2026-10-16' });
    assert.deepEqual(rangoAgenda('mes', '2026-10-13'), { desde: '2026-10-01', hasta: '2026-10-31' });
  });

  test('la semana puede cruzar de mes', () => {
    assert.deepEqual(rangoAgenda('semana', '2026-10-01'), { desde: '2026-09-28', hasta: '2026-10-02' });
  });

  test('meses de 28, 29, 30 y 31 días', () => {
    assert.equal(rangoAgenda('mes', '2026-02-10').hasta, '2026-02-28');
    assert.equal(rangoAgenda('mes', '2028-02-10').hasta, '2028-02-29');
    assert.equal(rangoAgenda('mes', '2026-11-30').hasta, '2026-11-30');
    assert.equal(rangoAgenda('mes', '2026-12-01').hasta, '2026-12-31');
  });

  test('rechaza vista y fecha inválidas', () => {
    assert.deepEqual(campos(validateAgenda({ vista: 'anio', fecha: '2026-02-30' })), ['vista', 'fecha']);
  });

  test('acepta filtros válidos e ignora ids inválidos', () => {
    assert.deepEqual(
      [validateAgenda({ terapeutaId: '3', salaId: '0' }).data.terapeutaId, validateAgenda({ terapeutaId: '3', salaId: '0' }).data.salaId],
      [3, null]
    );
  });
});
