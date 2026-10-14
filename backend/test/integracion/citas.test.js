import { describe, test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { omitir, iniciarEntorno } from './entorno.js';
import { ahoraLocal, lunesDe, sumarDias } from '../../src/validators/cita.validators.js';

// Semana futura fija relativa a hoy, para que ninguna cita caiga en el pasado.
const LUNES = lunesDe(sumarDias(ahoraLocal().fecha, 14));
const MARTES = sumarDias(LUNES, 1);

describe('API de citas', { skip: omitir }, () => {
  let entorno;
  let api;
  let db;
  const ids = {};

  async function insertar(sql, params) {
    const { rows } = await db.query(sql, params);
    return rows[0];
  }

  before(async () => {
    entorno = await iniciarEntorno();
    api = entorno.api;
    ({ pool: db } = await import('../../src/db/pool.js'));
    const paciente = (n, activo = true) => insertar(
      `INSERT INTO paciente (nombre_completo, curp, sexo, fecha_nacimiento, telefono, activo, fecha_baja)
       VALUES ($1, $2, 'F', '1990-01-01', $3, $4, CASE WHEN $4 THEN NULL ELSE now() END) RETURNING id_paciente AS id`,
      [`Paciente ${n}`, `CURP00000000000${String(n).padStart(3, '0')}`, `99911100${String(n).padStart(2, '0')}`, activo]
    );
    const terapeuta = (n, activo = true) => insertar(
      `INSERT INTO terapeuta (nombre_completo, telefono, correo_electronico, fecha_nacimiento, cedula_profesional, activo, fecha_baja)
       VALUES ($1, $2, $3, '1980-01-01', $4, $5, CASE WHEN $5 THEN NULL ELSE now() END) RETURNING id_terapeuta AS id`,
      [`Terapeuta ${n}`, `99922200${String(n).padStart(2, '0')}`, `terapeuta${n}@uady.mx`, `CED${n}`, activo]
    );
    ids.p1 = (await paciente(1)).id;
    ids.p2 = (await paciente(2)).id;
    ids.p3 = (await paciente(3)).id;
    ids.pBaja = (await paciente(4, false)).id;
    ids.t1 = (await terapeuta(1)).id;
    ids.t2 = (await terapeuta(2)).id;
    ids.t3 = (await terapeuta(3)).id;
    ids.tBaja = (await terapeuta(4, false)).id;
    ids.s1 = (await api('POST', '/salas', { json: { nombre: 'Sala 1' } })).body.sala.id;
    ids.s2 = (await api('POST', '/salas', { json: { nombre: 'Sala 2' } })).body.sala.id;
  });
  after(async () => { await entorno?.cerrar(); });

  const cita = (extra = {}) => ({
    pacienteId: ids.p1, terapeutaId: ids.t1, salaId: ids.s1, fecha: LUNES, horaInicio: '10:00', duracion: 60, ...extra,
  });

  test('requiere sesión', async () => {
    for (const [metodo, ruta] of [['GET', '/citas'], ['POST', '/citas'], ['GET', '/citas/disponibilidad?terapeutaId=1'], ['GET', '/citas/1'], ['PUT', '/citas/1'], ['PATCH', '/citas/1/cancelar']]) {
      assert.equal((await api(metodo, ruta, { sinSesion: true, json: ['POST', 'PUT'].includes(metodo) ? {} : undefined })).status, 401, ruta);
    }
  });

  test('crea una cita Pendiente con folio y bloques de 30 min', async () => {
    const res = await api('POST', '/citas', { json: cita() });
    assert.equal(res.status, 201, JSON.stringify(res.body));
    const c = res.body.cita;
    assert.match(c.folio, /^CIT-\d{4}-\d{5}$/);
    assert.equal(c.estado, 'Pendiente');
    assert.deepEqual([c.fecha, c.horaInicio, c.horaFin, c.duracion], [LUNES, '10:00', '11:00', 60]);
    assert.equal(c.paciente.nombre, 'Paciente 1');
    const bloques = await db.query('SELECT count(*)::int AS n FROM cita_bloque WHERE id_cita = $1', [c.id]);
    assert.equal(bloques.rows[0].n, 2);
    ids.cita1 = c.id;
  });

  test('rechaza con 409 los cruces de terapeuta, sala y paciente', async () => {
    const terapeuta = await api('POST', '/citas', { json: cita({ pacienteId: ids.p2, salaId: ids.s2, horaInicio: '10:30', duracion: 30 }) });
    assert.equal(terapeuta.status, 409);
    assert.equal(terapeuta.body.errors[0].field, 'terapeutaId');
    const sala = await api('POST', '/citas', { json: cita({ pacienteId: ids.p2, terapeutaId: ids.t2, horaInicio: '09:30' }) });
    assert.equal(sala.status, 409);
    assert.equal(sala.body.errors[0].field, 'salaId');
    const paciente = await api('POST', '/citas', { json: cita({ terapeutaId: ids.t2, salaId: ids.s2 }) });
    assert.equal(paciente.status, 409);
    assert.equal(paciente.body.errors[0].field, 'pacienteId');
  });

  test('intervalos consecutivos no chocan', async () => {
    const res = await api('POST', '/citas', { json: cita({ pacienteId: ids.p2, horaInicio: '11:00', duracion: 30 }) });
    assert.equal(res.status, 201, JSON.stringify(res.body));
  });

  test('valida datos y referencias inexistentes o dadas de baja', async () => {
    assert.equal((await api('POST', '/citas', { json: cita({ fecha: sumarDias(LUNES, 5) }) })).status, 400);
    const inexistente = await api('POST', '/citas', { json: cita({ salaId: 999999, horaInicio: '07:00' }) });
    assert.equal(inexistente.status, 400);
    assert.equal(inexistente.body.errors[0].field, 'salaId');
    const pBaja = await api('POST', '/citas', { json: cita({ pacienteId: ids.pBaja, horaInicio: '07:00' }) });
    assert.equal(pBaja.status, 409);
    assert.equal(pBaja.body.errors[0].field, 'pacienteId');
    const tBaja = await api('POST', '/citas', { json: cita({ terapeutaId: ids.tBaja, horaInicio: '07:00' }) });
    assert.equal(tBaja.status, 409);
    assert.equal(tBaja.body.errors[0].field, 'terapeutaId');
  });

  test('dos solicitudes simultáneas por la misma sala y horario: solo una se registra', async () => {
    const resultados = await Promise.all([
      api('POST', '/citas', { json: cita({ pacienteId: ids.p1, terapeutaId: ids.t1, fecha: MARTES, horaInicio: '08:00' }) }),
      api('POST', '/citas', { json: cita({ pacienteId: ids.p2, terapeutaId: ids.t2, fecha: MARTES, horaInicio: '08:30' }) }),
    ]);
    assert.deepEqual(resultados.map((r) => r.status).sort(), [201, 409]);
  });

  test('la rejilla semanal refleja ocupación de terapeuta y salas', async () => {
    const res = await api('GET', `/citas/disponibilidad?terapeutaId=${ids.t1}&semana=${MARTES}&duracion=60`);
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.semana.inicio, LUNES);
    const lunes = res.body.dias[0].slots;
    const slot = (h) => lunes.find((s) => s.horaInicio === h);
    assert.equal(slot('10:00').motivo, 'terapeuta');
    assert.equal(slot('11:00').motivo, 'terapeuta');
    assert.equal(slot('11:30').estado, 'disponible');
    assert.equal(slot('08:00').salasLibres.length, 2);

    // Para otro terapeuta, las 10:00 siguen disponibles en la sala que queda libre.
    const otro = await api('GET', `/citas/disponibilidad?terapeutaId=${ids.t3}&semana=${LUNES}`);
    assert.deepEqual(otro.body.dias[0].slots.find((s) => s.horaInicio === '10:00').salasLibres.map((s) => s.id), [ids.s2]);
    assert.equal((await api('GET', '/citas/disponibilidad?terapeutaId=999999')).status, 400);
  });

  test('la disponibilidad de salas usa las citas pendientes', async () => {
    const res = await api('GET', `/salas/${ids.s1}/disponibilidad?fecha=${LUNES}&horaInicio=10:30&horaFin=11:30`);
    assert.equal(res.body.fuenteOcupacion, 'citas');
    assert.equal(res.body.salas[0].estado, 'reservada');
  });

  test('obtiene el detalle y responde 404 si no existe', async () => {
    const res = await api('GET', `/citas/${ids.cita1}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.cita.id, ids.cita1);
    assert.equal((await api('GET', '/citas/999999')).status, 404);
    assert.equal((await api('GET', '/citas/abc')).status, 404);
  });

  test('modifica horario y sala excluyendo la propia cita de los conflictos', async () => {
    const mismaHora = await api('PUT', `/citas/${ids.cita1}`, { json: { ...cita(), horaInicio: '10:30', duracion: 30, estado: 'Pendiente' } });
    assert.equal(mismaHora.status, 200, JSON.stringify(mismaHora.body));
    assert.deepEqual([mismaHora.body.cita.horaInicio, mismaHora.body.cita.horaFin], ['10:30', '11:00']);

    const choque = await api('PUT', `/citas/${ids.cita1}`, { json: { ...cita(), horaInicio: '11:00', duracion: 30, estado: 'Pendiente' } });
    assert.equal(choque.status, 409);

    const movida = await api('PUT', `/citas/${ids.cita1}`, { json: { ...cita(), salaId: ids.s2, fecha: sumarDias(LUNES, 2), estado: 'Pendiente' } });
    assert.equal(movida.status, 200);
    assert.equal(movida.body.cita.sala.id, ids.s2);
    assert.equal((await api('PUT', '/citas/999999', { json: { ...cita(), estado: 'Pendiente' } })).status, 404);
  });

  test('cancelar libera el horario y no se puede cancelar dos veces', async () => {
    const fecha = sumarDias(LUNES, 3);
    const alta = await api('POST', '/citas', { json: cita({ fecha, horaInicio: '14:00' }) });
    const cancelada = await api('PATCH', `/citas/${alta.body.cita.id}/cancelar`);
    assert.equal(cancelada.status, 200);
    assert.equal(cancelada.body.cita.estado, 'Cancelada');
    assert.equal((await api('PATCH', `/citas/${alta.body.cita.id}/cancelar`)).status, 409);
    const reuso = await api('POST', '/citas', { json: cita({ pacienteId: ids.p3, fecha, horaInicio: '14:00' }) });
    assert.equal(reuso.status, 201, JSON.stringify(reuso.body));
  });

  test('marca como vencidas las citas pendientes cuyo horario ya pasó', async () => {
    const vieja = await insertar(
      `INSERT INTO cita (id_paciente, id_terapeuta, id_sala, folio, estado) VALUES ($1, $2, $3, 'CIT-2020-99999', 'Pendiente') RETURNING id_cita`,
      [ids.p3, ids.t3, ids.s1]
    );
    const bloque = await insertar(
      `INSERT INTO bloque_horario (fecha, hora_inicio, hora_fin) VALUES ('2020-01-06', '09:00', '09:30') RETURNING id_bloque`
    );
    await db.query('INSERT INTO cita_bloque VALUES ($1, $2)', [vieja.id_cita, bloque.id_bloque]);
    const res = await api('GET', `/citas/${vieja.id_cita}`);
    assert.equal(res.body.cita.estado, 'Vencida');
  });

  test('lista con conteos por estado, filtros y búsqueda por folio o paciente', async () => {
    const todas = await api('GET', '/citas');
    assert.equal(todas.status, 200);
    const { conteos } = todas.body;
    assert.equal(conteos.todas, conteos.pendientes + conteos.canceladas + conteos.vencidas);
    assert.equal(conteos.canceladas, 1);
    assert.equal(conteos.vencidas, 1);

    const pendientes = await api('GET', '/citas?estado=Pendiente');
    assert.ok(pendientes.body.citas.every((c) => c.estado === 'Pendiente'));
    assert.equal(pendientes.body.total, conteos.pendientes);

    const porSala = await api('GET', `/citas?salaId=${ids.s2}`);
    assert.ok(porSala.body.citas.length > 0 && porSala.body.citas.every((c) => c.sala.id === ids.s2));

    const porTerapeuta = await api('GET', `/citas?terapeutaId=${ids.t3}`);
    assert.ok(porTerapeuta.body.citas.every((c) => c.terapeuta.id === ids.t3));

    const dia = await api('GET', `/citas?periodo=dia&fecha=${LUNES}`);
    assert.ok(dia.body.citas.length > 0 && dia.body.citas.every((c) => c.fecha === LUNES));
    const semana = await api('GET', `/citas?periodo=semana&fecha=${MARTES}`);
    assert.ok(semana.body.citas.every((c) => c.fecha >= LUNES && c.fecha <= sumarDias(LUNES, 6)));

    const folio = await api('GET', '/citas?q=CIT-2020');
    assert.deepEqual(folio.body.citas.map((c) => c.folio), ['CIT-2020-99999']);
    const nombre = await api('GET', '/citas?q=paciente%202');
    assert.ok(nombre.body.citas.length > 0 && nombre.body.citas.every((c) => c.paciente.nombre === 'Paciente 2'));
    const literal = await api('GET', '/citas?q=%25');
    assert.equal(literal.body.total, 0);

    assert.equal((await api('GET', '/citas?page=99')).body.citas.length, 0);
  });
});
