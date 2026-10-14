import { describe, test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { omitir, iniciarEntorno } from './entorno.js';

describe('API de salas', { skip: omitir }, () => {
  let entorno;
  let api;
  before(async () => { entorno = await iniciarEntorno(); api = entorno.api; });
  after(async () => { await entorno?.cerrar(); });

  test('requiere sesión', async () => {
    for (const [metodo, ruta] of [['GET', '/salas'], ['POST', '/salas'], ['GET', '/salas/disponibilidad?fecha=2026-10-13']]) {
      assert.equal((await api(metodo, ruta, { sinSesion: true, json: metodo === 'POST' ? { nombre: 'Sala 1' } : undefined })).status, 401);
    }
  });

  test('persiste, lista y valida el registro', async () => {
    assert.equal((await api('POST', '/salas', { json: { nombre: '' } })).status, 400);
    assert.equal((await api('POST', '/salas', { json: { nombre: '12345678901' } })).status, 400);
    const alta = await api('POST', '/salas', { json: { nombre: '  Sala   A ' } });
    assert.equal(alta.status, 201, JSON.stringify(alta.body));
    assert.equal(alta.body.sala.nombre, 'Sala A');
    const lista = await api('GET', '/salas');
    assert.deepEqual(lista.body.salas, [alta.body.sala]);
  });

  test('impide duplicados normalizados y carreras simultáneas', async () => {
    await api('POST', '/salas', { json: { nombre: 'Sala B' } });
    const duplicada = await api('POST', '/salas', { json: { nombre: '  SALA   B ' } });
    assert.equal(duplicada.status, 409);
    assert.equal(duplicada.body.errors[0].field, 'nombre');
    const resultados = await Promise.all([
      api('POST', '/salas', { json: { nombre: 'Sala C' } }),
      api('POST', '/salas', { json: { nombre: ' sala c ' } }),
    ]);
    assert.deepEqual(resultados.map((r) => r.status).sort(), [201, 409]);
  });

  test('consulta vacía, fecha inválida, sala inexistente y ausencia del módulo de citas', async () => {
    assert.equal((await api('GET', '/salas/disponibilidad?fecha=2026-02-30')).status, 400);
    assert.equal((await api('GET', '/salas/999999/disponibilidad?fecha=2026-10-13')).status, 404);
    const res = await api('GET', '/salas/disponibilidad?fecha=2026-10-13&horaInicio=09:00&horaFin=10:00');
    assert.equal(res.status, 200);
    assert.equal(res.body.fuenteOcupacion, 'pendiente_modulo_citas');
    assert.ok(res.body.salas.every((sala) => sala.estado === 'libre'));
  });
});

