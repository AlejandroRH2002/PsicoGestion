import { pool } from '../db/pool.js';
import { ConflictError } from './auth.service.js';

export { ConflictError };

export const PACIENTE_SEARCH_LIMIT = 20;

/** Escapa %, _ y \ para que la búsqueda los trate como texto literal. */
export function escaparLikeLiteral(valor) {
  return valor.replace(/[\\%_]/g, '\\$&');
}

function esCandidatoCurp(q) {
  return /^[A-Za-z0-9]+$/.test(q);
}

function normalizarTelefonoBusqueda(q) {
  if (!/^[\d\s()+.\-/]+$/.test(q) || !/\d/.test(q)) return null;
  const digitos = q.replace(/\D/g, '');
  return digitos || null;
}

function ultimos4(valor) {
  return typeof valor === 'string' ? valor.trim().slice(-4) : '';
}

function ultimos4Telefono(valor) {
  return typeof valor === 'string' ? valor.replace(/\D/g, '').slice(-4) : '';
}

/** Reduce cada fila a los datos estrictamente necesarios para los resultados de búsqueda. */
export function mapearPatientSearchItem(row) {
  return {
    id: row.id_paciente,
    nombre: row.nombre_completo,
    curpUltimos4: row.curp_ultimos4 ?? ultimos4(row.curp),
    telefonoUltimos4: row.telefono_ultimos4 ?? ultimos4Telefono(row.telefono),
    activo: row.activo,
  };
}

/** Busca pacientes en PostgreSQL; `db` permite ejecutar pruebas aisladas. */
export async function buscarPacientes(q, db = null) {
  if (typeof q !== 'string' || !q.trim()) return [];

  const consulta = q.trim();
  const database = db ?? pool;
  const params = [];

  const nombreLiteral = escaparLikeLiteral(consulta);
  params.push(`%${nombreLiteral}%`);
  const nombreSubstringParam = params.length;
  params.push(`${nombreLiteral}%`);
  const nombrePrefijoParam = params.length;

  const predicados = [`nombre_completo ILIKE $${nombreSubstringParam} ESCAPE E'\\\\'`];

  let curpParam = null;
  if (esCandidatoCurp(consulta)) {
    params.push(consulta.toUpperCase());
    curpParam = params.length;
    predicados.push(`UPPER(BTRIM(curp)) LIKE ($${curpParam} || '%')`);
  }

  let telefonoParam = null;
  const telefono = normalizarTelefonoBusqueda(consulta);
  if (telefono) {
    params.push(telefono);
    telefonoParam = params.length;
    predicados.push(`regexp_replace(telefono, '[^0-9]', '', 'g') LIKE ($${telefonoParam} || '%')`);
  }

  const exacto = [
    curpParam ? `UPPER(BTRIM(curp)) = $${curpParam}` : null,
    telefonoParam ? `regexp_replace(telefono, '[^0-9]', '', 'g') = $${telefonoParam}` : null,
  ]
    .filter(Boolean)
    .join(' OR ') || 'FALSE';

  const sql = `SELECT
      id_paciente,
      nombre_completo,
      RIGHT(BTRIM(curp), 4) AS curp_ultimos4,
      RIGHT(regexp_replace(telefono, '[^0-9]', '', 'g'), 4) AS telefono_ultimos4,
      activo
    FROM paciente
    WHERE (${predicados.join(' OR ')})
    ORDER BY
      activo DESC,
      CASE WHEN (${exacto}) THEN 0 ELSE 1 END,
      CASE WHEN nombre_completo ILIKE $${nombrePrefijoParam} ESCAPE E'\\\\' THEN 0 ELSE 1 END,
      nombre_completo,
      id_paciente
    LIMIT ${PACIENTE_SEARCH_LIMIT}`;

  const { rows } = await database.query(sql, params);
  return rows.map(mapearPatientSearchItem);
}

export async function createPaciente({ nombre_completo, curp, sexo, fecha_nacimiento, telefono }) {
  const existing = await pool.query(
    `SELECT id_paciente, curp, telefono
     FROM paciente
     WHERE curp = $1 OR telefono = $2`,
    [curp, telefono]
  );

  if (existing.rows.length > 0) {
    const conflict = existing.rows[0];
    if (conflict.curp === curp) {
      throw new ConflictError('curp', 'Ya existe un paciente registrado con esta CURP.');
    }
    if (conflict.telefono === telefono) {
      throw new ConflictError('telefono', 'Este número telefónico ya se encuentra registrado.');
    }
  }

  try {
    const { rows } = await pool.query(
      `INSERT INTO paciente (nombre_completo, curp, sexo, fecha_nacimiento, telefono)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id_paciente, nombre_completo, curp, sexo,
                 to_char(fecha_nacimiento, 'YYYY-MM-DD') AS fecha_nacimiento, telefono`,
      [nombre_completo, curp, sexo, fecha_nacimiento, telefono]
    );

    return rows[0];
  } catch (err) {
    if (err.code === '23505') {
      if (err.constraint === 'paciente_curp_key') {
        throw new ConflictError('curp', 'Ya existe un paciente registrado con esta CURP.');
      }
      if (err.constraint === 'paciente_telefono_key') {
        throw new ConflictError('telefono', 'Este número telefónico ya se encuentra registrado.');
      }
    }
    throw err;
  }
}

export async function getPacientes() {
  const { rows } = await pool.query(
    `SELECT id_paciente, nombre_completo, curp, sexo,
            to_char(fecha_nacimiento, 'YYYY-MM-DD') AS fecha_nacimiento,
            telefono, activo, fecha_registro
     FROM paciente
     WHERE activo = TRUE
     ORDER BY id_paciente DESC`
  );

  return rows;
}

export async function getPacienteById(id) {
  const { rows } = await pool.query(
    `SELECT id_paciente, nombre_completo, curp, sexo,
            to_char(fecha_nacimiento, 'YYYY-MM-DD') AS fecha_nacimiento,
            telefono, activo, fecha_registro
     FROM paciente
     WHERE id_paciente = $1 AND activo = TRUE`,
    [id]
  );

  return rows[0] || null;
}

export async function updatePaciente(id, { nombre_completo, curp, sexo, fecha_nacimiento, telefono }) {
  const existing = await pool.query(
    `SELECT id_paciente, curp, telefono
     FROM paciente
     WHERE (curp = $1 OR telefono = $2) AND id_paciente <> $3`,
    [curp, telefono, id]
  );

  if (existing.rows.length > 0) {
    const conflict = existing.rows[0];
    if (conflict.curp === curp) {
      throw new ConflictError('curp', 'Ya existe un paciente registrado con esta CURP.');
    }
    if (conflict.telefono === telefono) {
      throw new ConflictError('telefono', 'Este número telefónico ya se encuentra registrado.');
    }
  }

  try {
    const { rows } = await pool.query(
      `UPDATE paciente
       SET nombre_completo = $1,
           curp = $2,
           sexo = $3,
           fecha_nacimiento = $4,
           telefono = $5
       WHERE id_paciente = $6 AND activo = TRUE
       RETURNING id_paciente, nombre_completo, curp, sexo,
                 to_char(fecha_nacimiento, 'YYYY-MM-DD') AS fecha_nacimiento, telefono, activo, fecha_registro`,
      [nombre_completo, curp, sexo, fecha_nacimiento, telefono, id]
    );

    return rows[0] || null;
  } catch (err) {
    if (err.code === '23505') {
      if (err.constraint === 'paciente_curp_key') {
        throw new ConflictError('curp', 'Ya existe un paciente registrado con esta CURP.');
      }
      if (err.constraint === 'paciente_telefono_key') {
        throw new ConflictError('telefono', 'Este número telefónico ya se encuentra registrado.');
      }
    }
    throw err;
  }
}
