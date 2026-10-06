export const CURP_UNIQUENESS_STATUS = Object.freeze({
  UNIQUE: 'UNIQUE',
  DUPLICATE: 'DUPLICATE',
});

export const CURP_DUPLICATE_CONFLICT = Object.freeze({
  field: 'curp',
  code: 'CURP_DUPLICATE',
  message: 'Ese CURP ya está registrado.',
});

function crearConflictoCurpDuplicado() {
  return { ...CURP_DUPLICATE_CONFLICT };
}

async function resolverDb(db) {
  if (db) return db;
  const { pool } = await import('../db/pool.js');
  return pool;
}

/** Comprueba si el CURP ya pertenece a otro paciente; excluirId permite editar sin chocar consigo mismo. */
export async function verificarCurpUnico(curp, { excluirId = null, db } = {}) {
  const client = await resolverDb(db);
  const tieneExclusion = excluirId !== null && excluirId !== undefined;

  const sql = tieneExclusion
    ? `SELECT id_paciente
       FROM paciente
       WHERE curp = $1
         AND id_paciente <> $2
       LIMIT 1`
    : `SELECT id_paciente
       FROM paciente
       WHERE curp = $1
       LIMIT 1`;

  const params = tieneExclusion ? [curp, excluirId] : [curp];
  const { rows = [] } = await client.query(sql, params);
  const paciente = rows[0];

  if (!paciente) {
    return {
      status: CURP_UNIQUENESS_STATUS.UNIQUE,
      unique: true,
      pacienteId: null,
      conflict: null,
    };
  }

  return {
    status: CURP_UNIQUENESS_STATUS.DUPLICATE,
    unique: false,
    pacienteId: paciente.id_paciente,
    conflict: crearConflictoCurpDuplicado(),
  };
}

function normalizarNombresRestriccion(constraintNames) {
  if (typeof constraintNames === 'string') return [constraintNames];
  return Array.isArray(constraintNames) ? constraintNames : [];
}

/** Solo traduce un 23505 cuando PostgreSQL reporta una restricción CURP conocida. */
export function clasificarConflictoCurp23505(error, { constraintNames = [] } = {}) {
  if (error?.code !== '23505' || typeof error.constraint !== 'string') return null;

  const restriccionesCurp = normalizarNombresRestriccion(constraintNames);
  if (!restriccionesCurp.includes(error.constraint)) return null;

  return crearConflictoCurpDuplicado();
}
