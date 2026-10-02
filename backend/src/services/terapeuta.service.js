import { randomUUID } from 'node:crypto';
import { mkdir, writeFile, unlink } from 'node:fs/promises';
import path from 'node:path';
import { pool } from '../db/pool.js';
import { env } from '../config/env.js';
import { ConflictError } from './auth.service.js';

const CARPETA_FOTOS = 'terapeutas';

export class NotFoundError extends Error {
  constructor(message = 'Terapeuta no encontrado.') {
    super(message);
  }
}

const COLUMNAS = `id_terapeuta, nombre_completo, telefono, correo_electronico,
  to_char(fecha_nacimiento, 'YYYY-MM-DD') AS fecha_nacimiento, cedula_profesional, foto_perfil,
  activo, fecha_baja, creado_en`;

const CAMPOS_UNICOS = {
  correo: { columna: 'correo_electronico', mensaje: 'Ese correo ya está registrado' },
  telefono: { columna: 'telefono', mensaje: 'Ese número telefónico ya está registrado' },
  cedula: { columna: 'cedula_profesional', mensaje: 'Esa cédula profesional ya está registrada' },
};

// Nombres por defecto que Postgres da a las restricciones UNIQUE de 003_create_terapeuta.sql.
const CAMPO_POR_RESTRICCION = {
  terapeuta_correo_electronico_key: 'correo',
  terapeuta_telefono_key: 'telefono',
  terapeuta_cedula_profesional_key: 'cedula',
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
    activo: row.activo,
    fechaBaja: row.fecha_baja,
    fechaRegistro: row.creado_en,
  };
}

function conflicto(campo, { inactivo = false } = {}) {
  const { mensaje } = CAMPOS_UNICOS[campo];
  // Un terapeuta dado de baja conserva sus datos: conviene reactivarlo en lugar de duplicarlo.
  return new ConflictError(campo, inactivo ? `${mensaje} y pertenece a un terapeuta dado de baja.` : `${mensaje}.`);
}

/**
 * RF 2.1.5, 2.1.7, 2.2.4: teléfono, correo y cédula no pueden repetirse.
 * En edición se excluye al propio terapeuta (`excluirId`).
 */
async function verificarUnicidad({ correo, telefono, cedula }, excluirId = null, db = pool) {
  const { rows } = await db.query(
    `SELECT correo_electronico, telefono, cedula_profesional, activo FROM terapeuta
     WHERE (correo_electronico = $1 OR telefono = $2 OR cedula_profesional = $3)
       AND ($4::int IS NULL OR id_terapeuta <> $4)`,
    [correo, telefono, cedula, excluirId]
  );

  const valores = { correo, telefono, cedula };
  for (const campo of Object.keys(CAMPOS_UNICOS)) {
    const fila = rows.find((row) => row[CAMPOS_UNICOS[campo].columna] === valores[campo]);
    if (fila) throw conflicto(campo, { inactivo: !fila.activo });
  }
}

/** Otro registro simultáneo pudo ganar la carrera después de verificarUnicidad. */
function mapearErrorUnico(err) {
  const campo = err.code === '23505' ? CAMPO_POR_RESTRICCION[err.constraint] : null;
  return campo ? conflicto(campo) : err;
}

/** Escribe la foto ya validada ({ buffer, extension }) y devuelve su ruta relativa a UPLOADS_DIR. */
async function guardarFoto(foto) {
  const rutaRelativa = `${CARPETA_FOTOS}/${randomUUID()}.${foto.extension}`;
  const rutaAbsoluta = path.join(env.uploadsDir, rutaRelativa);
  await mkdir(path.dirname(rutaAbsoluta), { recursive: true });
  await writeFile(rutaAbsoluta, foto.buffer);
  return rutaRelativa;
}

async function borrarFoto(rutaRelativa) {
  if (rutaRelativa) await unlink(path.join(env.uploadsDir, rutaRelativa)).catch(() => {});
}

/**
 * RF 2.1.1-2.1.13. `foto` es opcional: { buffer, extension } ya validado con validarFotoPerfil.
 * La foto se escribe antes del INSERT y se borra si este falla, para no dejar huérfanos.
 */
export async function registrarTerapeuta({ nombre, telefono, correo, fechaNacimiento, cedula }, foto) {
  await verificarUnicidad({ correo, telefono, cedula });

  const rutaFoto = foto ? await guardarFoto(foto) : null;
  try {
    const { rows } = await pool.query(
      `INSERT INTO terapeuta
         (nombre_completo, telefono, correo_electronico, fecha_nacimiento, cedula_profesional, foto_perfil)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING ${COLUMNAS}`,
      [nombre, telefono, correo, fechaNacimiento, cedula, rutaFoto]
    );
    return toTerapeuta(rows[0]);
  } catch (err) {
    await borrarFoto(rutaFoto);
    throw mapearErrorUnico(err);
  }
}

/** RF 2.2.1: lista con búsqueda por nombre, correo o cédula; por defecto solo activos. */
export async function listarTerapeutas({ q, estado, orden }) {
  const condiciones = [];
  const params = [];

  if (estado === 'activos') condiciones.push('activo');
  if (estado === 'inactivos') condiciones.push('NOT activo');

  if (q) {
    params.push(`%${q.replace(/[\\%_]/g, '\\$&')}%`);
    const busqueda = [`nombre_completo ILIKE $${params.length}`, `correo_electronico ILIKE $${params.length}`];
    const digitos = q.replace(/\D/g, '');
    if (digitos) {
      params.push(`${digitos}%`);
      busqueda.push(`cedula_profesional LIKE $${params.length}`);
    }
    condiciones.push(`(${busqueda.join(' OR ')})`);
  }

  const where = condiciones.length > 0 ? `WHERE ${condiciones.join(' AND ')}` : '';
  const orderBy = orden === 'registro' ? 'creado_en DESC, id_terapeuta DESC' : 'nombre_completo, id_terapeuta';

  const { rows } = await pool.query(`SELECT ${COLUMNAS} FROM terapeuta ${where} ORDER BY ${orderBy}`, params);
  return rows.map(toTerapeuta);
}

/** RF 2.2.2: ficha del terapeuta. */
export async function obtenerTerapeuta(id) {
  const { rows } = await pool.query(`SELECT ${COLUMNAS} FROM terapeuta WHERE id_terapeuta = $1`, [id]);
  if (rows.length === 0) throw new NotFoundError();
  return toTerapeuta(rows[0]);
}

/**
 * RF 2.2.3-2.2.4: actualiza todos los campos con las mismas reglas que el registro.
 * `foto` reemplaza la actual; `quitarFoto` la elimina. La foto anterior se borra solo
 * después del COMMIT, y la nueva se borra si la actualización falla.
 */
export async function actualizarTerapeuta(id, { nombre, telefono, correo, fechaNacimiento, cedula }, { foto, quitarFoto } = {}) {
  const client = await pool.connect();
  let rutaNueva = null;
  try {
    await client.query('BEGIN');

    const actual = await client.query('SELECT foto_perfil FROM terapeuta WHERE id_terapeuta = $1 FOR UPDATE', [id]);
    if (actual.rows.length === 0) throw new NotFoundError();
    const rutaAnterior = actual.rows[0].foto_perfil;

    await verificarUnicidad({ correo, telefono, cedula }, id, client);

    if (foto) rutaNueva = await guardarFoto(foto);
    const rutaFinal = foto ? rutaNueva : quitarFoto ? null : rutaAnterior;

    const { rows } = await client.query(
      `UPDATE terapeuta
       SET nombre_completo = $2, telefono = $3, correo_electronico = $4,
           fecha_nacimiento = $5, cedula_profesional = $6, foto_perfil = $7
       WHERE id_terapeuta = $1
       RETURNING ${COLUMNAS}`,
      [id, nombre, telefono, correo, fechaNacimiento, cedula, rutaFinal]
    );
    await client.query('COMMIT');

    if (rutaAnterior && rutaAnterior !== rutaFinal) await borrarFoto(rutaAnterior);
    return toTerapeuta(rows[0]);
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    await borrarFoto(rutaNueva);
    throw mapearErrorUnico(err);
  } finally {
    client.release();
  }
}

/** Baja lógica o reactivación; nunca se borra al terapeuta (citas e historial dependen de él). */
export async function cambiarEstado(id, activo) {
  const { rows } = await pool.query(
    `UPDATE terapeuta
     SET activo = $2,
         fecha_baja = CASE WHEN $2 THEN NULL ELSE COALESCE(fecha_baja, NOW()) END
     WHERE id_terapeuta = $1
     RETURNING ${COLUMNAS}`,
    [id, activo]
  );
  if (rows.length === 0) throw new NotFoundError();
  return toTerapeuta(rows[0]);
}
