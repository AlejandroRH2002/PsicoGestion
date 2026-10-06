import './setup-env.js';
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

const { validateBusquedaPacientes } = await import('../src/validators/paciente.validators.js');
const {
  PACIENTE_SEARCH_LIMIT,
  buscarPacientes,
  escaparLikeLiteral,
  mapearPatientSearchItem,
} = await import('../src/services/paciente.service.js');
const { buscar: buscarController } = await import('../src/controllers/paciente.controller.js');

function responseDouble() {
  return {
    statusCode: null,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

function dbDouble(rows = []) {
  const calls = [];
  return {
    calls,
    async query(sql, params) {
      calls.push({ sql, params });
      return { rows };
    },
  };
}

describe('validación de búsqueda', () => {
  test('recorta espacios y acepta una consulta válida', () => {
    const result = validateBusquedaPacientes({ q: '  Ana López  ' });
    assert.deepEqual(result.errors, []);
    assert.deepEqual(result.data, { q: 'Ana López', buscar: true });
  });

  test('una consulta ausente o vacía no activa la búsqueda', () => {
    assert.equal(validateBusquedaPacientes({}).data.buscar, false);
    assert.equal(validateBusquedaPacientes({ q: '' }).data.buscar, false);
    assert.equal(validateBusquedaPacientes({ q: '   ' }).data.buscar, false);
  });

  test('acepta 50 caracteres y rechaza 51', () => {
    assert.deepEqual(validateBusquedaPacientes({ q: 'a'.repeat(50) }).errors, []);
    const result = validateBusquedaPacientes({ q: 'a'.repeat(51) });
    assert.equal(result.data.buscar, false);
    assert.equal(result.errors.length, 1);
    assert.equal(result.errors[0].field, 'q');
  });
});

describe('controlador de búsqueda', () => {
  test('una consulta mayor a 50 caracteres responde 400 con error de campo', async () => {
    const res = responseDouble();
    await buscarController(
      { query: { q: 'x'.repeat(51) } },
      res,
      (err) => {
        throw err ?? new Error('next no debía ejecutarse');
      }
    );

    assert.equal(res.statusCode, 400);
    assert.deepEqual(res.body, {
      errors: [{ field: 'q', message: 'La búsqueda no puede exceder 50 caracteres.' }],
    });
  });

  test('una consulta vacía devuelve la respuesta mínima sin listar pacientes', async () => {
    for (const query of [{}, { q: '   ' }]) {
      const res = responseDouble();
      await buscarController(
        { query },
        res,
        (err) => {
          throw err ?? new Error('next no debía ejecutarse');
        }
      );
      assert.equal(res.statusCode, 200);
      assert.deepEqual(res.body, { pacientes: [] });
    }
  });
});

describe('búsqueda en backend', () => {
  test('busca nombre por coincidencia parcial sin distinguir mayúsculas', async () => {
    const db = dbDouble();
    await buscarPacientes('mArÍa', db);
    const [{ sql, params }] = db.calls;

    assert.match(sql, /nombre_completo ILIKE \$1/);
    assert.equal(params[0], '%mArÍa%');
    assert.ok(params[0].startsWith('%') && params[0].endsWith('%'));
  });

  test('trata %, _ y \\ como texto literal', async () => {
    const q = '%_\\';
    assert.equal(escaparLikeLiteral(q), '\\%\\_\\\\');

    const db = dbDouble();
    await buscarPacientes(q, db);
    const [{ sql, params }] = db.calls;

    assert.equal(params[0], '%\\%\\_\\\\%');
    assert.equal(params[1], '\\%\\_\\\\%');
    assert.ok(sql.includes("ESCAPE E'\\\\'"));
  });

  test('normaliza CURP a mayúsculas y busca por prefijo', async () => {
    const db = dbDouble();
    await buscarPacientes('abcd1234', db);
    const [{ sql, params }] = db.calls;

    assert.equal(params[2], 'ABCD1234');
    assert.match(sql, /UPPER\(BTRIM\(curp\)\) LIKE \(\$3 \|\| '%'\)/);
    assert.match(sql, /UPPER\(BTRIM\(curp\)\) = \$3/);
  });

  test('normaliza el teléfono a dígitos y busca por prefijo', async () => {
    const db = dbDouble();
    await buscarPacientes('+52 (999) 123-4567', db);
    const [{ sql, params }] = db.calls;

    assert.equal(params[2], '529991234567');
    assert.match(sql, /regexp_replace\(telefono, '\[\^0-9\]', '', 'g'\) LIKE \(\$3 \|\| '%'\)/);
    assert.match(sql, /regexp_replace\(telefono, '\[\^0-9\]', '', 'g'\) = \$3/);
  });

  test('no interpola la entrada del usuario en el SQL', async () => {
    const q = "x' OR TRUE --";
    const db = dbDouble();
    await buscarPacientes(q, db);
    const [{ sql, params }] = db.calls;

    assert.equal(sql.includes(q), false);
    assert.ok(params.some((value) => typeof value === 'string' && value.includes(q)));
  });

  test('mantiene un límite fijo de 20 resultados', async () => {
    const db = dbDouble();
    await buscarPacientes('Ana', db);
    const [{ sql, params }] = db.calls;

    assert.equal(PACIENTE_SEARCH_LIMIT, 20);
    assert.match(sql, /LIMIT 20\s*$/);
    assert.equal(params.includes(20), false);
  });

  test('ordena activos y coincidencias más relevantes primero', async () => {
    const db = dbDouble();
    await buscarPacientes('ABCD1234', db);
    const [{ sql }] = db.calls;

    const activo = sql.indexOf('activo DESC');
    const exacto = sql.indexOf('UPPER(BTRIM(curp)) = $3');
    const prefijo = sql.indexOf('CASE WHEN nombre_completo ILIKE $2');
    const nombre = sql.indexOf('nombre_completo,', prefijo);
    const id = sql.indexOf('id_paciente', nombre);

    assert.ok(activo >= 0 && exacto > activo && prefijo > exacto && nombre > prefijo && id > nombre);
  });

  test('una consulta vacía no toca la base de datos', async () => {
    const db = dbDouble();
    assert.deepEqual(await buscarPacientes('   ', db), []);
    assert.equal(db.calls.length, 0);
  });
});

describe('datos visibles en resultados', () => {
  test('devuelve solo los últimos cuatro dígitos de CURP y teléfono', () => {
    const row = {
      id_paciente: 7,
      nombre_completo: 'Ana Pérez',
      curp: 'PEPA900101MYNNRN09',
      telefono: '+52 (999) 123-4567',
      activo: true,
    };

    const item = mapearPatientSearchItem(row);
    assert.deepEqual(item, {
      id: 7,
      nombre: 'Ana Pérez',
      curpUltimos4: 'RN09',
      telefonoUltimos4: '4567',
      activo: true,
    });
    assert.equal(JSON.stringify(item).includes(row.curp), false);
    assert.equal(JSON.stringify(item).includes(row.telefono), false);
  });

  test('el servicio no expone CURP ni teléfono completos', async () => {
    const db = dbDouble([
      {
        id_paciente: 8,
        nombre_completo: 'Luis Gómez',
        curp: 'GOLU880808HYNNMS01',
        telefono: '9997654321',
        activo: false,
      },
    ]);

    const [item] = await buscarPacientes('Luis', db);
    assert.deepEqual(Object.keys(item), ['id', 'nombre', 'curpUltimos4', 'telefonoUltimos4', 'activo']);
    assert.equal(item.curpUltimos4, 'MS01');
    assert.equal(item.telefonoUltimos4, '4321');
  });
});
