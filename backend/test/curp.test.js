import './setup-env.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const {
  CURP_VALIDATION_STATUS,
  normalizarCurp,
  validarCurp,
} = await import('../src/validators/curp.validators.js');
const {
  CURP_UNIQUENESS_STATUS,
  CURP_DUPLICATE_CONFLICT,
  verificarCurpUnico,
  clasificarConflictoCurp23505,
} = await import('../src/services/curp.service.js');

const CURP = 'ABCD123456EFGH7890';

function dbConRespuesta(rows, capturas = []) {
  return {
    async query(sql, params) {
      capturas.push({ sql, params });
      return { rows };
    },
  };
}

test('convierte el CURP a mayúsculas', () => {
  assert.equal(normalizarCurp('abcd123456efgh7890'), CURP);
});

test('quita únicamente los espacios exteriores', () => {
  assert.equal(normalizarCurp(`  ${CURP.toLowerCase()}  `), CURP);
});

test('conserva los caracteres internos', () => {
  assert.equal(normalizarCurp(' abcd 123456efgh7890 '), 'ABCD 123456EFGH7890');
});

test('marca un CURP vacío como requerido', () => {
  const result = validarCurp('   ');
  assert.equal(result.status, CURP_VALIDATION_STATUS.REQUIRED);
  assert.deepEqual(result.errors, [{ field: 'curp', message: 'La CURP es obligatoria.' }]);
});

test('rechaza un CURP de 17 caracteres', () => {
  assert.equal(validarCurp('A'.repeat(17)).status, CURP_VALIDATION_STATUS.INVALID_FORMAT);
});

test('rechaza un CURP de 19 caracteres', () => {
  assert.equal(validarCurp('A'.repeat(19)).status, CURP_VALIDATION_STATUS.INVALID_FORMAT);
});

test('rechaza caracteres que no son alfanuméricos', () => {
  assert.equal(validarCurp('ABCD123456EFGH789-').status, CURP_VALIDATION_STATUS.INVALID_FORMAT);
});

test('acepta 18 caracteres alfanuméricos', () => {
  const result = validarCurp(` ${CURP.toLowerCase()} `);
  assert.equal(result.status, CURP_VALIDATION_STATUS.VALID);
  assert.equal(result.curp, CURP);
  assert.deepEqual(result.errors, []);
});

test('considera único un CURP sin coincidencias', async () => {
  const result = await verificarCurpUnico(CURP, { db: dbConRespuesta([]) });
  assert.equal(result.status, CURP_UNIQUENESS_STATUS.UNIQUE);
  assert.equal(result.unique, true);
  assert.equal(result.conflict, null);
});

test('detecta un CURP que pertenece a otro paciente', async () => {
  const result = await verificarCurpUnico(CURP, { db: dbConRespuesta([{ id_paciente: 20 }]) });
  assert.equal(result.status, CURP_UNIQUENESS_STATUS.DUPLICATE);
  assert.equal(result.unique, false);
  assert.equal(result.pacienteId, 20);
  assert.deepEqual(result.conflict, CURP_DUPLICATE_CONFLICT);
});

test('excluirId deja fuera al paciente actual en la consulta', async () => {
  const capturas = [];
  await verificarCurpUnico(CURP, { excluirId: 10, db: dbConRespuesta([], capturas) });

  assert.match(capturas[0].sql, /AND\s+id_paciente\s+<>\s+\$2/i);
  assert.deepEqual(capturas[0].params, [CURP, 10]);
});

test('el paciente excluido no cuenta como duplicado', async () => {
  const db = {
    async query(sql, params) {
      const [, excluirId] = params;
      const rows = excluirId === 10 ? [] : [{ id_paciente: 10 }];
      return { rows };
    },
  };

  const result = await verificarCurpUnico(CURP, { excluirId: 10, db });
  assert.equal(result.status, CURP_UNIQUENESS_STATUS.UNIQUE);
});

test('consulta la CURP con parámetros de PostgreSQL', async () => {
  const capturas = [];
  await verificarCurpUnico(CURP, { db: dbConRespuesta([], capturas) });

  assert.match(capturas[0].sql, /WHERE\s+curp\s*=\s*\$1/i);
  assert.deepEqual(capturas[0].params, [CURP]);
});

test('no interpola la CURP dentro del SQL', async () => {
  const capturas = [];
  await verificarCurpUnico(CURP, { excluirId: 10, db: dbConRespuesta([], capturas) });

  assert.equal(capturas[0].sql.includes(CURP), false);
  assert.deepEqual(capturas[0].params, [CURP, 10]);
});

test('ignora errores que no son 23505', () => {
  const conflict = clasificarConflictoCurp23505(
    { code: '23503', constraint: 'paciente_curp_key' },
    { constraintNames: ['paciente_curp_key'] }
  );
  assert.equal(conflict, null);
});

test('clasifica un 23505 de una restricción CURP conocida', () => {
  const conflict = clasificarConflictoCurp23505(
    { code: '23505', constraint: 'paciente_curp_key' },
    { constraintNames: ['paciente_curp_key'] }
  );
  assert.deepEqual(conflict, CURP_DUPLICATE_CONFLICT);
});

test('no confunde la restricción de teléfono con CURP', () => {
  const conflict = clasificarConflictoCurp23505(
    { code: '23505', constraint: 'paciente_telefono_key' },
    { constraintNames: ['paciente_curp_key'] }
  );
  assert.equal(conflict, null);
});

test('no clasifica un 23505 sin una restricción conocida', () => {
  assert.equal(clasificarConflictoCurp23505({ code: '23505' }), null);
  assert.equal(
    clasificarConflictoCurp23505({ code: '23505', constraint: 'paciente_curp_key' }),
    null,
    'el nombre de la restricción debe declararse explícitamente como conocido'
  );
});

test('CURP_DUPLICATE conserva el campo, código y mensaje esperados', () => {
  assert.deepEqual(CURP_DUPLICATE_CONFLICT, {
    field: 'curp',
    code: 'CURP_DUPLICATE',
    message: 'Ese CURP ya está registrado.',
  });
});
