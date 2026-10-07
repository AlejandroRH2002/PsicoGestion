import { test } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { errorHandler } from '../src/middleware/errorHandler.js';

for (const method of ['POST', 'PUT']) {
  for (const [nombre, body] of [['null', 'null'], ['string', '"texto"'], ['número', '42'], ['JSON truncado', '{"nombre":']]) {
    test(`parser ${method}: ${nombre} devuelve un 400 fijo sin contenido recibido`, async (t) => {
      const app = express();
      app.use(express.json());
      app.use(errorHandler);
      const server = app.listen(0);
      t.after(() => new Promise((resolve) => server.close(resolve)));
      const res = await fetch(`http://localhost:${server.address().port}/pacientes/1`, {
        method, headers: { 'Content-Type': 'application/json' }, body,
      });
      assert.equal(res.status, 400);
      assert.deepEqual(await res.json(), { error: 'El cuerpo de la solicitud debe ser un objeto JSON válido.' });
    });
  }
}

test('parser: la respuesta fija también se aplica a otras rutas', async (t) => {
  const app = express();
  app.use(express.json());
  app.use(errorHandler);
  const server = app.listen(0);
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const res = await fetch(`http://localhost:${server.address().port}/terapeutas`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: 'null',
  });
  assert.equal(res.status, 400);
  assert.deepEqual(await res.json(), { error: 'El cuerpo de la solicitud debe ser un objeto JSON válido.' });
});

test('otros errores mantienen el 500 genérico sin detalle', (t) => {
  t.mock.method(console, 'error', () => {});
  let status;
  let body;
  const res = { status(value) { status = value; return this; }, json(value) { body = value; } };
  errorHandler(Object.assign(new Error('detalle privado'), { status: 400, type: 'otro.error' }), {}, res, () => {});
  assert.equal(status, 500);
  assert.deepEqual(body, { error: 'Error interno del servidor.' });
});
