import { describe, test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { omitir, iniciarEntorno } from './entorno.js';

describe('API de pacientes: edición y unicidad', { skip: omitir }, () => {
  let entorno;
  let api;
  let pool;
  let consecutivo = 0;

  before(async () => {
    // Conserva sin cambios el setup y TRUNCATE de los otros módulos.
    entorno = await iniciarEntorno();
    api = entorno.api;
    ({ pool } = await import('../../src/db/pool.js'));
  });

  beforeEach(async () => {
    const client = await pool.connect();
    try {
      const { rows } = await client.query('SELECT current_database() AS base');
      assert.equal(rows[0].base, 'psicogestion_test', 'La limpieza de pacientes exige la BD exclusiva');
      // Limpieza propia de pacientes, sin CASCADE ni modificar el entorno compartido.
      await client.query('TRUNCATE paciente RESTART IDENTITY');
    } finally {
      client.release();
    }
  });

  after(async () => {
    await entorno?.cerrar();
  });

  function datos(cambios = {}) {
    consecutivo += 1;
    return {
      nombre_completo: `Paciente Sintetico ${consecutivo}`,
      curp: `GACL960101HDFRLS${String(consecutivo).padStart(2, '0')}`,
      sexo: 'M',
      fecha_nacimiento: '01/01/1996',
      telefono: `999200${String(consecutivo).padStart(4, '0')}`,
      ...cambios,
    };
  }

  async function registrar(cambios = {}) {
    const entrada = datos(cambios);
    const res = await api('POST', '/pacientes', { json: entrada });
    assert.equal(res.status, 201, JSON.stringify(res.body));
    return { entrada, paciente: res.body.paciente };
  }

  for (const method of ['POST', 'PUT']) {
    for (const [nombre, json] of [['null', null], ['string', 'texto'], ['número', 42], ['arreglo', []], ['ausente', undefined]]) {
      test(`${method} con cuerpo ${nombre} responde 400 sin error interno`, async () => {
        const { paciente } = await registrar();
        const ruta = method === 'POST' ? '/pacientes' : `/pacientes/${paciente.id_paciente}`;
        const res = await api(method, ruta, { json });
        assert.equal(res.status, 400, JSON.stringify(res.body));
        assert.doesNotMatch(JSON.stringify(res.body), /interno|TypeError|SyntaxError/);
        if (nombre === 'arreglo') assert.equal(res.body.errors[0].field, 'body');
      });
    }
    test(`${method} con Content-Type no JSON responde 400 por campos obligatorios`, async (t) => {
      const { paciente } = await registrar();
      const original = globalThis.fetch;
      t.mock.method(globalThis, 'fetch', (url, opciones) => original(url, {
        ...opciones, headers: { ...opciones.headers, 'Content-Type': 'text/plain' },
      }));
      const res = await api(method, method === 'POST' ? '/pacientes' : `/pacientes/${paciente.id_paciente}`, { json: datos() });
      assert.equal(res.status, 400);
      assert.match(res.body.errors[0].message, /obligatorio/);
    });
    test(`${method} con JSON truncado responde 400 con mensaje fijo`, async (t) => {
      const { paciente } = await registrar();
      const original = globalThis.fetch;
      t.mock.method(globalThis, 'fetch', (url, opciones) => original(url, { ...opciones, body: '{"nombre":' }));
      const res = await api(method, method === 'POST' ? '/pacientes' : `/pacientes/${paciente.id_paciente}`, { json: {} });
      assert.equal(res.status, 400);
      assert.deepEqual(res.body, { error: 'El cuerpo de la solicitud debe ser un objeto JSON válido.' });
    });
  }

  test('PUT persiste el nombre y GET vuelve a leer el paciente actualizado', async () => {
    const { entrada, paciente } = await registrar();
    const nuevaEntrada = { ...entrada, nombre_completo: 'Nombre Sintetico Editado' };
    const actualizado = await api('PUT', `/pacientes/${paciente.id_paciente}`, { json: nuevaEntrada });
    assert.equal(actualizado.status, 200, JSON.stringify(actualizado.body));
    assert.equal(actualizado.body.paciente.nombre_completo, nuevaEntrada.nombre_completo);
    const consulta = await api('GET', `/pacientes/${paciente.id_paciente}`);
    assert.equal(consulta.status, 200);
    assert.deepEqual(consulta.body.paciente, actualizado.body.paciente);
  });

  for (const method of ['POST', 'PUT']) {
    for (const [constraint, field, message] of [
      ['paciente_curp_key', 'curp', 'Ya existe un paciente registrado con esta CURP.'],
      ['paciente_telefono_key', 'telefono', 'Este número telefónico ya se encuentra registrado.'],
      ['constraint_privado_simulado', 'general', 'Ya existe un paciente con alguno de los datos proporcionados.'],
    ]) {
      test(`${method}: 23505 de ${constraint} devuelve 409 seguro`, async (t) => {
        const { paciente } = await registrar();
        const original = pool.query;
        t.mock.method(pool, 'query', function (sql, ...args) {
          if (/^\s*(INSERT INTO|UPDATE) paciente\b/i.test(sql)) {
            return Promise.reject(Object.assign(new Error('detalle privado PostgreSQL'), {
              code: '23505', constraint, detail: 'detalle privado PostgreSQL',
            }));
          }
          return original.call(this, sql, ...args);
        });
        const res = await api(method, method === 'POST' ? '/pacientes' : `/pacientes/${paciente.id_paciente}`, { json: datos() });
        assert.equal(res.status, 409, JSON.stringify(res.body));
        assert.deepEqual(res.body, { errors: [{ field, message }] });
        assert.doesNotMatch(JSON.stringify(res.body), /constraint_privado_simulado|detalle privado|23505/);
      });
    }
  }

  test('PUT sin cambios conserva la propia CURP y teléfono sin falso duplicado', async () => {
    const { entrada, paciente } = await registrar();
    const res = await api('PUT', `/pacientes/${paciente.id_paciente}`, { json: entrada });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.paciente.curp, entrada.curp);
    assert.equal(res.body.paciente.telefono, entrada.telefono);
  });

  test('PUT con la CURP de otro paciente responde 409 e identifica curp', async () => {
    const a = await registrar();
    const b = await registrar();
    const res = await api('PUT', `/pacientes/${a.paciente.id_paciente}`, {
      json: { ...a.entrada, curp: b.entrada.curp },
    });
    assert.equal(res.status, 409);
    assert.equal(res.body.errors[0].field, 'curp');
    assert.match(res.body.errors[0].message, /CURP/);
    const consulta = await api('GET', `/pacientes/${a.paciente.id_paciente}`);
    assert.equal(consulta.body.paciente.curp, a.entrada.curp);
  });

  test('PUT con el teléfono de otro paciente responde 409 e identifica telefono', async () => {
    const a = await registrar();
    const b = await registrar();
    const res = await api('PUT', `/pacientes/${a.paciente.id_paciente}`, {
      json: { ...a.entrada, telefono: b.entrada.telefono },
    });
    assert.equal(res.status, 409);
    assert.equal(res.body.errors[0].field, 'telefono');
    assert.match(res.body.errors[0].message, /telefónico/);
    const consulta = await api('GET', `/pacientes/${a.paciente.id_paciente}`);
    assert.equal(consulta.body.paciente.telefono, a.entrada.telefono);
  });

  test('PUT normaliza CURP minúscula con espacios exteriores antes de comprobar unicidad', async () => {
    const { entrada, paciente } = await registrar();
    const res = await api('PUT', `/pacientes/${paciente.id_paciente}`, {
      json: { ...entrada, curp: `  ${entrada.curp.toLowerCase()}  ` },
    });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.paciente.curp, entrada.curp);
    const consulta = await api('GET', `/pacientes/${paciente.id_paciente}`);
    assert.equal(consulta.body.paciente.curp, entrada.curp);
  });

  test('PUT de ID inexistente devuelve 404 incluso con datos válidos de otro paciente', async () => {
    const { entrada } = await registrar();
    const noExiste = await api('GET', '/pacientes/2147483647');
    assert.equal(noExiste.status, 404);
    const res = await api('PUT', '/pacientes/2147483647', { json: entrada });
    assert.equal(res.status, 404, JSON.stringify(res.body));
    assert.equal(res.body.error, 'Paciente no encontrado.');
  });

  test('PUT mide siete años contra fecha_registro, no contra la fecha actual', async () => {
    const { entrada, paciente } = await registrar();
    // Captura única UTC. Registro histórico para detectar una implementación
    // incorrecta que mida contra hoy y acepte a quien entonces tenía seis años.
    const referencia = new Date();
    const mes = referencia.getUTCMonth();
    const dia = referencia.getUTCDate();
    const anio = referencia.getUTCFullYear() - 2;
    const registro = new Date(Date.UTC(anio, mes, dia, 12));
    // Si el día de partida es 29/02, Date.UTC normaliza la referencia a marzo.
    const nacimientoSiete = new Date(Date.UTC(
      registro.getUTCFullYear() - 7, registro.getUTCMonth(), registro.getUTCDate()
    ));
    const nacimientoMenor = new Date(nacimientoSiete);
    nacimientoMenor.setUTCDate(nacimientoMenor.getUTCDate() + 1);
    const texto = (fecha) => `${String(fecha.getUTCDate()).padStart(2, '0')}/${String(fecha.getUTCMonth() + 1).padStart(2, '0')}/${fecha.getUTCFullYear()}`;
    const fechaRegistro = registro.toISOString().slice(0, 19).replace('T', ' ');
    await pool.query('UPDATE paciente SET fecha_registro = $1::timestamp WHERE id_paciente = $2', [fechaRegistro, paciente.id_paciente]);

    const exactos = await api('PUT', `/pacientes/${paciente.id_paciente}`, {
      json: { ...entrada, fecha_nacimiento: texto(nacimientoSiete) },
    });
    assert.equal(exactos.status, 200, JSON.stringify(exactos.body));
    const consulta = await api('GET', `/pacientes/${paciente.id_paciente}`);
    assert.equal(consulta.body.paciente.fecha_nacimiento, nacimientoSiete.toISOString().slice(0, 10));
    assert.equal(consulta.body.paciente.fecha_registro, exactos.body.paciente.fecha_registro);

    const menor = await api('PUT', `/pacientes/${paciente.id_paciente}`, {
      json: { ...entrada, fecha_nacimiento: texto(nacimientoMenor) },
    });
    assert.equal(menor.status, 400, JSON.stringify(menor.body));
    assert.equal(menor.body.errors[0].field, 'fecha_nacimiento');
    assert.match(menor.body.errors[0].message, /7 años/);
    const sinCambios = await api('GET', `/pacientes/${paciente.id_paciente}`);
    assert.equal(sinCambios.body.paciente.fecha_nacimiento, nacimientoSiete.toISOString().slice(0, 10));
  });

  for (const inactivo of [false, true]) {
    for (const edadInvalida of [false, true]) {
      test(`PUT ${inactivo ? 'inactivo' : 'inexistente'}: 404 antes de ${edadInvalida ? 'edad' : 'duplicados'}`, async () => {
        const a = await registrar();
        const b = await registrar();
        if (inactivo) await pool.query('UPDATE paciente SET activo = FALSE WHERE id_paciente = $1', [a.paciente.id_paciente]);
        const referencia = new Date();
        const nacimiento = new Date(Date.UTC(referencia.getUTCFullYear() - 1, 0, 1));
        const fecha = `01/01/${nacimiento.getUTCFullYear()}`;
        const res = await api('PUT', `/pacientes/${inactivo ? a.paciente.id_paciente : 2147483647}`, {
          json: { ...a.entrada, curp: b.entrada.curp, ...(edadInvalida ? { fecha_nacimiento: fecha } : {}) },
        });
        assert.equal(res.status, 404, JSON.stringify(res.body));
        assert.deepEqual(res.body, { error: 'Paciente no encontrado.' });
      });
    }
  }

  test('PUT valida formato antes de consultar existencia', async (t) => {
    t.mock.method(pool, 'query', () => { throw new Error('No debe consultar la BD con formato inválido'); });
    const res = await api('PUT', '/pacientes/2147483647', { json: datos({ sexo: 'X' }) });
    assert.equal(res.status, 400, JSON.stringify(res.body));
    assert.equal(res.body.errors[0].field, 'sexo');
  });

  test('PUT reutiliza una lectura para existencia y edad; edad precede duplicados', async (t) => {
    const a = await registrar();
    const b = await registrar();
    let lecturas = 0;
    const original = pool.query;
    t.mock.method(pool, 'query', function (sql, ...args) {
      if (/^\s*SELECT/i.test(sql)) lecturas += 1;
      return original.call(this, sql, ...args);
    });
    const res = await api('PUT', `/pacientes/${a.paciente.id_paciente}`, {
      json: { ...a.entrada, curp: b.entrada.curp, fecha_nacimiento: `01/01/${new Date().getUTCFullYear() - 1}` },
    });
    assert.equal(res.status, 400);
    assert.equal(res.body.errors[0].field, 'fecha_nacimiento');
    assert.equal(lecturas, 1);
  });
});
