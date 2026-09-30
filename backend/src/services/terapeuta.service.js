import { randomUUID } from 'node:crypto';
import { mkdir, writeFile, unlink } from 'node:fs/promises';
import path from 'node:path';
import { pool } from '../db/pool.js';
import { env } from '../config/env.js';
import { ConflictError } from './auth.service.js';

const CARPETA_FOTOS = 'terapeutas';

// Nombres por defecto que Postgres da a las restricciones UNIQUE de 003_create_terapeuta.sql.
const CONFLICTOS_POR_RESTRICCION = {
  terapeuta_correo_electronico_key: ['correo', 'Ese correo ya está registrado.'],
  terapeuta_telefono_key: ['telefono', 'Ese número telefónico ya está registrado.'],
  terapeuta_cedula_profesional_key: ['cedula', 'Esa cédula profesional ya está registrada.'],
};

function toTerapeuta(row) {
  return {
    id: row.id_terapeuta,
    nombre: row.nombre_completo,
    telefono: row.telefono,
    correo: row.correo_electronico,
    fechaNacimiento: row.fecha_nacimiento,
    cedula: row.cedula_profesional,
    fotoPerfil: row.foto_perfil ? `/uploads/${row.foto_perfil}` : null,
  };
}

/** RF 2.1.5, 2.1.7: teléfono, correo y cédula no pueden repetirse. */
async function verificarUnicidad({ correo, telefono, cedula }) {
  const { rows } = await pool.query(
    `SELECT correo_electronico, telefono, cedula_profesional FROM terapeuta
     WHERE correo_electronico = $1 OR telefono = $2 OR cedula_profesional = $3`,
    [correo, telefono, cedula]
  );

  if (rows.some((row) => row.correo_electronico === correo)) {
    throw new ConflictError('correo', 'Ese correo ya está registrado.');
  }
  if (rows.some((row) => row.telefono === telefono)) {
    throw new ConflictError('telefono', 'Ese número telefónico ya está registrado.');
  }
  if (rows.length > 0) {
    throw new ConflictError('cedula', 'Esa cédula profesional ya está registrada.');
  }
}

/**
 * RF 2.1.1-2.1.13. `foto` es opcional: { buffer, extension } ya validado con validarFotoPerfil.
 * La foto se escribe antes del INSERT y se borra si este falla, para no dejar huérfanos.
 */
export async function registrarTerapeuta({ nombre, telefono, correo, fechaNacimiento, cedula }, foto) {
  await verificarUnicidad({ correo, telefono, cedula });

  let rutaRelativa = null;
  let rutaAbsoluta = null;
  if (foto) {
    rutaRelativa = `${CARPETA_FOTOS}/${randomUUID()}.${foto.extension}`;
    rutaAbsoluta = path.join(env.uploadsDir, rutaRelativa);
    await mkdir(path.dirname(rutaAbsoluta), { recursive: true });
    await writeFile(rutaAbsoluta, foto.buffer);
  }

  try {
    const { rows } = await pool.query(
      `INSERT INTO terapeuta
         (nombre_completo, telefono, correo_electronico, fecha_nacimiento, cedula_profesional, foto_perfil)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id_terapeuta, nombre_completo, telefono, correo_electronico,
                 to_char(fecha_nacimiento, 'YYYY-MM-DD') AS fecha_nacimiento, cedula_profesional, foto_perfil`,
      [nombre, telefono, correo, fechaNacimiento, cedula, rutaRelativa]
    );
    return toTerapeuta(rows[0]);
  } catch (err) {
    if (rutaAbsoluta) await unlink(rutaAbsoluta).catch(() => {});
    // Otro registro simultáneo pudo ganar la carrera después de verificarUnicidad.
    const conflicto = err.code === '23505' ? CONFLICTOS_POR_RESTRICCION[err.constraint] : null;
    if (conflicto) throw new ConflictError(...conflicto);
    throw err;
  }
}
