import { describe, test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { omitir, iniciarEntorno } from './entorno.js';
import { ahoraLocal, lunesDe, sumarDias } from '../../src/validators/cita.validators.js';

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

  test('consulta vacía, fecha inválida, sala inexistente y ocupación desde el módulo de citas', async () => {
    assert.equal((await api('GET', '/salas/disponibilidad?fecha=2026-02-30')).status, 400);
    assert.equal((await api('GET', '/salas/999999/disponibilidad?fecha=2026-10-13')).status, 404);
    const res = await api('GET', '/salas/disponibilidad?fecha=2026-10-13&horaInicio=09:00&horaFin=10:00');
    assert.equal(res.status, 200);
    assert.equal(res.body.fuenteOcupacion, 'citas');
    assert.ok(res.body.salas.every((sala) => sala.estado === 'libre'));
  });

  describe('eliminar sala (RF 4.2)', () => {
    let db;
    before(async () => { ({ pool: db } = await import('../../src/db/pool.js')); });

    async function insertar(sql) {
      const { rows } = await db.query(sql);
      return rows[0].id;
    }

    test('requiere sesión y responde 404 si no existe', async () => {
      assert.equal((await api('DELETE', '/salas/1', { sinSesion: true })).status, 401);
      assert.equal((await api('DELETE', '/salas/999999')).status, 404);
      assert.equal((await api('DELETE', '/salas/abc')).status, 404);
    });

    test('baja lógica: sale del catálogo y de la disponibilidad, y libera el nombre', async () => {
      const sala = (await api('POST', '/salas', { json: { nombre: 'Baja 1' } })).body.sala;
      const res = await api('DELETE', `/salas/${sala.id}`);
      assert.equal(res.status, 200, JSON.stringify(res.body));
      assert.equal(res.body.message, 'Sala eliminada correctamente.');

      const fila = await db.query('SELECT activo, fecha_baja FROM sala WHERE id_sala = $1', [sala.id]);
      assert.equal(fila.rows[0].activo, false, 'la fila se conserva');
      assert.ok(fila.rows[0].fecha_baja);
      assert.ok(!(await api('GET', '/salas')).body.salas.some((s) => s.id === sala.id));
      const disp = await api('GET', '/salas/disponibilidad?fecha=2026-10-13');
      assert.ok(!disp.body.salas.some((s) => s.id === sala.id));
      assert.equal((await api('GET', `/salas/${sala.id}/disponibilidad?fecha=2026-10-13`)).status, 404);

      assert.equal((await api('DELETE', `/salas/${sala.id}`)).status, 404, 'ya eliminada');
      assert.equal((await api('POST', '/salas', { json: { nombre: 'baja 1' } })).status, 201, 'el nombre queda libre');
    });

    test('rechaza con 409 si la sala tiene citas pendientes y permite eliminarla con solo historial', async () => {
      const paciente = await insertar(
        `INSERT INTO paciente (nombre_completo, curp, sexo, fecha_nacimiento, telefono)
         VALUES ('Paciente Sala', 'CURP00000000000901', 'F', '1990-01-01', '9993330001') RETURNING id_paciente AS id`
      );
      const terapeuta = await insertar(
        `INSERT INTO terapeuta (nombre_completo, telefono, correo_electronico, fecha_nacimiento, cedula_profesional)
         VALUES ('Terapeuta Sala', '9993330002', 'tsala@uady.mx', '1980-01-01', 'CEDSALA') RETURNING id_terapeuta AS id`
      );
      const sala = (await api('POST', '/salas', { json: { nombre: 'Baja 2' } })).body.sala;
      const lunes = lunesDe(sumarDias(ahoraLocal().fecha, 14));
      const datos = (extra) => ({ pacienteId: paciente, terapeutaId: terapeuta, salaId: sala.id, fecha: lunes, horaInicio: '10:00', duracion: 60, ...extra });
      const cita = await api('POST', '/citas', { json: datos() });
      assert.equal(cita.status, 201, JSON.stringify(cita.body));

      const conflicto = await api('DELETE', `/salas/${sala.id}`);
      assert.equal(conflicto.status, 409);
      assert.equal(conflicto.body.errors[0].field, 'sala');
      assert.match(conflicto.body.errors[0].message, /1 cita pendiente/);

      assert.equal((await api('PATCH', `/citas/${cita.body.cita.id}/cancelar`)).status, 200);
      assert.equal((await api('DELETE', `/salas/${sala.id}`)).status, 200);

      const historial = await api('GET', `/citas/${cita.body.cita.id}`);
      assert.equal(historial.body.cita.sala.nombre, 'Baja 2', 'la cita conserva su sala');

      const nueva = await api('POST', '/citas', { json: datos({ horaInicio: '12:00', duracion: 30 }) });
      assert.equal(nueva.status, 409);
      assert.equal(nueva.body.errors[0].field, 'salaId');
    });
  });
});
