import { describe, test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { omitir, iniciarEntorno } from './entorno.js';
import { ahoraLocal, lunesDe, sumarDias } from '../../src/validators/cita.validators.js';

const LUNES = lunesDe(sumarDias(ahoraLocal().fecha, 14));
const MARTES = sumarDias(LUNES, 1);
const SIGUIENTE_LUNES = sumarDias(LUNES, 7);

describe('API de agenda', { skip: omitir }, () => {
  let entorno;
  let api;
  let db;
  const ids = {};

  async function insertar(sql, params) {
    return (await db.query(sql, params)).rows[0];
  }

  before(async () => {
    entorno = await iniciarEntorno();
    api = entorno.api;
    ({ pool: db } = await import('../../src/db/pool.js'));
    for (const n of [1, 2]) {
      ids[`p${n}`] = (await insertar(
        `INSERT INTO paciente (nombre_completo, curp, sexo, fecha_nacimiento, telefono)
         VALUES ($1, $2, 'M', '1990-01-01', $3) RETURNING id_paciente AS id`,
        [`Paciente ${n}`, `CURPAGENDA0000000${n}`, `99933300${n}0`]
      )).id;
      ids[`t${n}`] = (await insertar(
        `INSERT INTO terapeuta (nombre_completo, telefono, correo_electronico, fecha_nacimiento, cedula_profesional)
         VALUES ($1, $2, $3, '1980-01-01', $4) RETURNING id_terapeuta AS id`,
        [`Terapeuta ${n}`, `99944400${n}0`, `agenda${n}@uady.mx`, `AGD${n}`]
      )).id;
      ids[`s${n}`] = (await api('POST', '/salas', { json: { nombre: `Sala ${n}` } })).body.sala.id;
    }

    const alta = async (extra) => {
      const res = await api('POST', '/citas', {
        json: { pacienteId: ids.p1, terapeutaId: ids.t1, salaId: ids.s1, fecha: LUNES, horaInicio: '09:00', duracion: 60, ...extra },
      });
      assert.equal(res.status, 201, JSON.stringify(res.body));
      return res.body.cita;
    };
    ids.lunes9 = (await alta({})).id;
    ids.lunes9b = (await alta({ pacienteId: ids.p2, terapeutaId: ids.t2, salaId: ids.s2 })).id;
    ids.martes = (await alta({ fecha: MARTES, horaInicio: '07:30', duracion: 30 })).id;
    ids.cancelada = (await alta({ fecha: MARTES, horaInicio: '11:00' })).id;
    await api('PATCH', `/citas/${ids.cancelada}/cancelar`);
    ids.siguiente = (await alta({ fecha: SIGUIENTE_LUNES })).id;

    // Cita pasada: se vuelve Vencida al consultar la agenda.
    const vieja = await insertar(
      `INSERT INTO cita (id_paciente, id_terapeuta, id_sala, folio) VALUES ($1, $2, $3, 'CIT-2020-88888') RETURNING id_cita`,
      [ids.p2, ids.t2, ids.s2]
    );
    const bloque = await insertar(
      `INSERT INTO bloque_horario (fecha, hora_inicio, hora_fin) VALUES ('2020-03-02', '08:00', '08:30')
       ON CONFLICT ON CONSTRAINT bloque_horario_unico DO UPDATE SET fecha = EXCLUDED.fecha RETURNING id_bloque`
    );
    await db.query('INSERT INTO cita_bloque VALUES ($1, $2)', [vieja.id_cita, bloque.id_bloque]);
    ids.vieja = vieja.id_cita;
  });
  after(async () => { await entorno?.cerrar(); });

  const idsDe = (res) => res.body.citas.map((c) => c.id);

  test('requiere sesión', async () => {
    assert.equal((await api('GET', '/agenda', { sinSesion: true })).status, 401);
  });

  test('valida vista y fecha', async () => {
    const res = await api('GET', '/agenda?vista=anio&fecha=2026-13-01');
    assert.equal(res.status, 400);
    assert.deepEqual(res.body.errors.map((e) => e.field), ['vista', 'fecha']);
  });

  test('vista de día: solo las citas de esa fecha, en orden y sin canceladas', async () => {
    const res = await api('GET', `/agenda?vista=dia&fecha=${MARTES}`);
    assert.equal(res.status, 200);
    assert.deepEqual([res.body.desde, res.body.hasta], [MARTES, MARTES]);
    assert.deepEqual(idsDe(res), [ids.martes]);
    assert.deepEqual(res.body.jornada, { inicio: '07:00', fin: '17:00', minutosBloque: 30 });
  });

  test('vista de semana: lunes a viernes de la fecha indicada', async () => {
    const res = await api('GET', `/agenda?vista=semana&fecha=${sumarDias(LUNES, 3)}`);
    assert.deepEqual([res.body.desde, res.body.hasta], [LUNES, sumarDias(LUNES, 4)]);
    assert.deepEqual(idsDe(res), [ids.lunes9, ids.lunes9b, ids.martes]);
    const cita = res.body.citas[0];
    assert.deepEqual([cita.horaInicio, cita.horaFin, cita.duracion, cita.sala.nombre], ['09:00', '10:00', 60, 'Sala 1']);
  });

  test('vista de mes: todo el mes de la fecha', async () => {
    const res = await api('GET', `/agenda?vista=mes&fecha=${LUNES}`);
    assert.equal(res.body.desde, `${LUNES.slice(0, 7)}-01`);
    const esperadas = [ids.lunes9, ids.lunes9b, ids.martes, ids.siguiente].filter((id, i) => {
      const fecha = [LUNES, LUNES, MARTES, SIGUIENTE_LUNES][i];
      return fecha.slice(0, 7) === LUNES.slice(0, 7);
    });
    assert.deepEqual(idsDe(res), esperadas);
    assert.ok(!idsDe(res).includes(ids.cancelada));
  });

  test('incluye las citas vencidas', async () => {
    const res = await api('GET', '/agenda?vista=dia&fecha=2020-03-02');
    assert.deepEqual(res.body.citas.map((c) => [c.id, c.estado]), [[ids.vieja, 'Vencida']]);
  });

  test('filtra por terapeuta y por sala', async () => {
    const porTerapeuta = await api('GET', `/agenda?vista=semana&fecha=${LUNES}&terapeutaId=${ids.t2}`);
    assert.deepEqual(idsDe(porTerapeuta), [ids.lunes9b]);
    const porSala = await api('GET', `/agenda?vista=semana&fecha=${LUNES}&salaId=${ids.s1}`);
    assert.deepEqual(idsDe(porSala), [ids.lunes9, ids.martes]);
  });
});
