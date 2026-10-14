import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { registrarSala, consultarDisponibilidad, intervalosSeSuperponen, SalaNotFoundError } from '../src/services/sala.service.js';

describe('servicio de salas', () => {
  test('detecta superposición parcial, completa y permite intervalos consecutivos', () => {
    assert.equal(intervalosSeSuperponen('09:00', '10:00', '09:30', '11:00'), true);
    assert.equal(intervalosSeSuperponen('09:00', '12:00', '10:00', '11:00'), true);
    assert.equal(intervalosSeSuperponen('09:00', '10:00', '10:00', '11:00'), false);
  });
  test('propaga un error de persistencia desconocido', async () => {
    const fallo = new Error('base no disponible');
    await assert.rejects(registrarSala({ nombre: 'Sala 1' }, { query: async () => { throw fallo; } }), fallo);
  });

  test('mapea la restricción única normalizada a conflicto comprensible', async () => {
    const db = { query: async () => { throw Object.assign(new Error(), { code: '23505', constraint: 'sala_nombre_normalizado_key' }); } };
    await assert.rejects(registrarSala({ nombre: 'SALA 1' }, db), /Ya existe una sala/);
  });

  test('sin módulo de citas informa la dependencia y muestra salas libres', async () => {
    const db = { query: async (sql) => {
      if (sql.includes('to_regclass')) return { rows: [{ disponible: false }] };
      return { rows: [{ id_sala: 1, nombre_sala: 'Sala 1' }] };
    } };
    const resultado = await consultarDisponibilidad({ fecha: '2026-10-13', horaInicio: null, horaFin: null }, db);
    assert.equal(resultado.fuenteOcupacion, 'pendiente_modulo_citas');
    assert.equal(resultado.salas[0].estado, 'libre');
  });

  test('lista vacía se conserva sin inventar disponibilidad', async () => {
    const db = { query: async (sql) => ({ rows: sql.includes('to_regclass') ? [{ disponible: false }] : [] }) };
    const resultado = await consultarDisponibilidad({ fecha: '2026-10-13' }, db);
    assert.deepEqual(resultado.salas, []);
  });

  test('clasifica libre y reservada usando solo citas pendientes', async () => {
    let consulta = '';
    const db = { query: async (sql) => {
      if (sql.includes('to_regclass')) return { rows: [{ disponible: true }] };
      consulta = sql;
      return { rows: [
        { id_sala: 1, nombre_sala: 'Sala A', ocupaciones: [{ horaInicio: '09:00', horaFin: '10:00' }] },
        { id_sala: 2, nombre_sala: 'Sala B', ocupaciones: [] },
      ] };
    } };
    const resultado = await consultarDisponibilidad({ fecha: '2026-10-13', horaInicio: '09:30', horaFin: '10:30' }, db);
    assert.deepEqual(resultado.salas.map((s) => s.estado), ['reservada', 'libre']);
    assert.match(consulta, /c\.estado = 'Pendiente'/);
    assert.match(consulta, /b\.hora_inicio < \$3::time AND b\.hora_fin > \$2::time/);
  });

  test('sala inexistente falla antes de consultar reservas', async () => {
    const db = { query: async () => ({ rows: [] }) };
    await assert.rejects(consultarDisponibilidad({ fecha: '2026-10-13', salaId: 99 }, db), SalaNotFoundError);
  });
});
