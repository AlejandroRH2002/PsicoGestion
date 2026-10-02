import bcrypt from 'bcryptjs';
import { pool } from '../db/pool.js';

const SALT_ROUNDS = 12;

// Hash fijo usado solo para igualar el tiempo de respuesta cuando el correo no existe
// (evita que el tiempo de bcrypt.compare filtre si la cuenta existe o no).
const DUMMY_HASH = '$2a$12$C6UzMDM.H6dfI/f/IKcEeOFRkP8ZR7f3XV0mYQHzB0F0Wb0v6mzMy';

export class ConflictError extends Error {
  constructor(field, message) {
    super(message);
    this.field = field;
  }
}

export class InvalidCredentialsError extends Error {
  constructor() {
    super('Correo o contraseña incorrectos.');
  }
}

/** RF 1.1.5, 1.1.8: unicidad de teléfono y correo (specs/01-autenticacion/spec.md). */
export async function registerSecretaria({ nombre, telefono, correo, password }) {
  const existing = await pool.query(
    'SELECT correo_electronico, telefono FROM secretaria WHERE correo_electronico = $1 OR telefono = $2',
    [correo, telefono]
  );

  if (existing.rows.length > 0) {
    const conflict = existing.rows[0];
    if (conflict.correo_electronico === correo) {
      throw new ConflictError('correo', 'Ese correo ya está registrado.');
    }
    throw new ConflictError('telefono', 'Ese número telefónico ya está registrado.');
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  const { rows } = await pool.query(
    `INSERT INTO secretaria (nombre_completo, telefono, correo_electronico, password_hash)
     VALUES ($1, $2, $3, $4)
     RETURNING id_secretaria, nombre_completo, correo_electronico`,
    [nombre, telefono, correo, passwordHash]
  );

  const row = rows[0];
  return { id: row.id_secretaria, nombre: row.nombre_completo, correo: row.correo_electronico };
}

/** Datos de la secretaria con sesión activa (header de la app). Devuelve null si ya no existe. */
export async function obtenerSecretaria(id) {
  const { rows } = await pool.query(
    'SELECT id_secretaria, nombre_completo, correo_electronico FROM secretaria WHERE id_secretaria = $1',
    [id]
  );
  if (rows.length === 0) return null;
  const row = rows[0];
  return { id: row.id_secretaria, nombre: row.nombre_completo, correo: row.correo_electronico };
}

/** RF 1.2.1-1.2.2, RNF 1.2.2: mismo error sin importar cuál dato falló. */
export async function loginSecretaria({ correo, password }) {
  const { rows } = await pool.query(
    'SELECT id_secretaria, nombre_completo, correo_electronico, password_hash FROM secretaria WHERE correo_electronico = $1',
    [correo]
  );

  if (rows.length === 0) {
    await bcrypt.compare(password, DUMMY_HASH);
    throw new InvalidCredentialsError();
  }

  const row = rows[0];
  const passwordMatches = await bcrypt.compare(password, row.password_hash);
  if (!passwordMatches) {
    throw new InvalidCredentialsError();
  }

  return { id: row.id_secretaria, nombre: row.nombre_completo, correo: row.correo_electronico };
}

export async function getSecretariaById(id) {
  const { rows } = await pool.query(
    'SELECT id_secretaria, nombre_completo, correo_electronico FROM secretaria WHERE id_secretaria = $1',
    [id]
  );

  if (rows.length === 0) {
    return null;
  }

  const row = rows[0];
  return { id: row.id_secretaria, nombre: row.nombre_completo, correo: row.correo_electronico };
}
