import { pool } from '../db/pool.js';
import { ConflictError } from './auth.service.js';

export { ConflictError };

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

// Lectura interna de fecha calendario: evita interpretar un TIMESTAMP sin zona
// como un Date local, sin cambiar el contrato de GET/PUT de pacientes.
export async function getFechaRegistroPaciente(id) {
  const { rows } = await pool.query(
    `SELECT to_char(fecha_registro, 'YYYY-MM-DD') AS fecha_registro
     FROM paciente
     WHERE id_paciente = $1 AND activo = TRUE`,
    [id]
  );
  return rows[0]?.fecha_registro ?? null;
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
