import { pool } from '../db/pool.js';
import { ConflictError } from './auth.service.js';

export { ConflictError };

/**
 * Registra un nuevo terapeuta verificando unicidad de correo, teléfono y cédula.
 */
export async function createTerapeuta({
  nombre_completo,
  telefono,
  correo_electronico,
  fecha_nacimiento,
  cedula_profesional,
  foto_perfil,
}) {
  // Verificación de unicidad previa para dar mensajes de error específicos y amigables
  const existing = await pool.query(
    `SELECT correo_electronico, telefono, cedula_profesional
     FROM terapeuta
     WHERE correo_electronico = $1 OR telefono = $2 OR cedula_profesional = $3`,
    [correo_electronico, telefono, cedula_profesional]
  );

  if (existing.rows.length > 0) {
    for (const conflict of existing.rows) {
      if (conflict.correo_electronico === correo_electronico) {
        throw new ConflictError('correo_electronico', 'Este correo electrónico ya se encuentra registrado.');
      }
      if (conflict.telefono === telefono) {
        throw new ConflictError('telefono', 'Este número telefónico ya se encuentra registrado.');
      }
      if (conflict.cedula_profesional === cedula_profesional) {
        throw new ConflictError('cedula_profesional', 'Esta cédula profesional ya se encuentra registrada.');
      }
    }
  }

  try {
    const { rows } = await pool.query(
      `INSERT INTO terapeuta (
        nombre_completo,
        telefono,
        correo_electronico,
        fecha_nacimiento,
        cedula_profesional,
        foto_perfil
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id_terapeuta, nombre_completo, telefono, correo_electronico, fecha_nacimiento, cedula_profesional, foto_perfil`,
      [
        nombre_completo,
        telefono,
        correo_electronico,
        fecha_nacimiento,
        cedula_profesional,
        foto_perfil,
      ]
    );

    return rows[0];
  } catch (err) {
    // Si ocurre una colisión concurrente capturada por restricciones de PostgreSQL:
    if (err.code === '23505') {
      if (err.constraint === 'terapeuta_correo_electronico_key') {
        throw new ConflictError('correo_electronico', 'Este correo electrónico ya se encuentra registrado.');
      }
      if (err.constraint === 'terapeuta_telefono_key') {
        throw new ConflictError('telefono', 'Este número telefónico ya se encuentra registrado.');
      }
      if (err.constraint === 'terapeuta_cedula_profesional_key') {
        throw new ConflictError('cedula_profesional', 'Esta cédula profesional ya se encuentra registrada.');
      }
    }
    throw err;
  }
}

/**
 * Obtiene la lista de terapeutas registrados.
 */
export async function getTerapeutas() {
  const { rows } = await pool.query(
    `SELECT id_terapeuta, nombre_completo, telefono, correo_electronico,
            to_char(fecha_nacimiento, 'YYYY-MM-DD') as fecha_nacimiento,
            cedula_profesional, foto_perfil
     FROM terapeuta
     ORDER BY id_terapeuta DESC`
  );
  return rows;
}

/**
 * Obtiene un terapeuta por su ID.
 */
export async function getTerapeutaById(id) {
  const { rows } = await pool.query(
    `SELECT id_terapeuta, nombre_completo, telefono, correo_electronico,
            to_char(fecha_nacimiento, 'YYYY-MM-DD') as fecha_nacimiento,
            cedula_profesional, foto_perfil
     FROM terapeuta
     WHERE id_terapeuta = $1`,
    [id]
  );
  return rows[0] || null;
}
