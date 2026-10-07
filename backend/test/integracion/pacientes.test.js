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
});
