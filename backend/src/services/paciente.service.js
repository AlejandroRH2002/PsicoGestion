import { pool } from '../db/pool.js';
import { guardarArchivo, borrarArchivo } from '../utils/almacenamiento.js';
import { ConflictError } from './auth.service.js';

export { ConflictError };

const CARPETA_ARCHIVOS = 'pacientes';

export class NotFoundError extends Error {
  constructor(message = 'Paciente no encontrado.') {
    super(message);
  }
}

/** La edición intentó quitar todos los adjuntos del paciente. */
const COLUMNAS = `id_paciente, nombre_completo, curp, sexo,
  to_char(fecha_nacimiento, 'YYYY-MM-DD') AS fecha_nacimiento, telefono,
  activo, fecha_baja, fecha_registro`;

const COLUMNAS_ARCHIVO = 'id_archivo, nombre_original, tipo, tamano_bytes, subido_en';

const CAMPOS_UNICOS = {
  curp: { columna: 'curp', mensaje: 'Ese CURP ya está registrado' },
  telefono: { columna: 'telefono', mensaje: 'Ese número telefónico ya está registrado' },
};

// Nombres por defecto que Postgres da a las restricciones UNIQUE de 004_create_paciente.sql.
const CAMPO_POR_RESTRICCION = {
  paciente_curp_key: 'curp',
  paciente_telefono_key: 'telefono',
};

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

function toArchivo(row) {
  return {
    id: row.id_archivo,
    nombre: row.nombre_original,
    tipo: row.tipo,
    tamano: row.tamano_bytes,
    subidoEn: row.subido_en,
  };
}

function toPaciente(row, archivos = []) {
  return {
    id: row.id_paciente,
    nombre: row.nombre_completo,
    curp: row.curp,
    sexo: row.sexo,
    fechaNacimiento: row.fecha_nacimiento,
    telefono: row.telefono,
    activo: row.activo,
    fechaBaja: row.fecha_baja,
    fechaRegistro: row.fecha_registro,
    archivos: archivos.map(toArchivo),
  };
}

function conflicto(campo, { inactivo = false } = {}) {
  const { mensaje } = CAMPOS_UNICOS[campo];
  // Un paciente dado de baja conserva sus datos: conviene reactivarlo en lugar de duplicarlo.
  return new ConflictError(campo, inactivo ? `${mensaje} y pertenece a un paciente dado de baja.` : `${mensaje}.`);
}

/**
 * RF 3.1.5, 3.1.11, 3.2.5: CURP y teléfono no pueden repetirse.
 * En edición se excluye al propio paciente (`excluirId`).
 */
async function verificarUnicidad({ curp, telefono }, excluirId = null, db = pool) {
  const { rows } = await db.query(
    `SELECT curp, telefono, activo FROM paciente
     WHERE (curp = $1 OR telefono = $2)
       AND ($3::int IS NULL OR id_paciente <> $3)`,
    [curp, telefono, excluirId]
  );

  const valores = { curp, telefono };
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

/**
 * Escribe en disco los adjuntos ya validados ({ buffer, tipo, nombre, tamano }) y los registra.
 * Cada ruta escrita se agrega a `rutasEscritas` para poder borrarla si la transacción falla.
 */
async function insertarArchivos(client, idPaciente, archivos, rutasEscritas) {
  for (const archivo of archivos) {
    const ruta = await guardarArchivo(CARPETA_ARCHIVOS, archivo.buffer, archivo.tipo);
    rutasEscritas.push(ruta);
    await client.query(
      `INSERT INTO paciente_archivo (id_paciente, nombre_original, ruta, tipo, tamano_bytes)
       VALUES ($1, $2, $3, $4, $5)`,
      [idPaciente, archivo.nombre, ruta, archivo.tipo, archivo.tamano]
    );
  }
}

async function listarArchivos(idPaciente, db = pool) {
  const { rows } = await db.query(
    `SELECT ${COLUMNAS_ARCHIVO} FROM paciente_archivo WHERE id_paciente = $1 ORDER BY subido_en, id_archivo`,
    [idPaciente]
  );
  return rows;
}

/**
 * RF 3.1.1-3.1.12. `archivos` ya validados; se escriben antes del COMMIT y se borran si
 * la transacción falla, para no dejar huérfanos.
 */
export async function registrarPaciente({ nombre_completo, curp, sexo, fecha_nacimiento, telefono }, archivos = []) {
  await verificarUnicidad({ curp, telefono });

  const client = await pool.connect();
  const rutasEscritas = [];
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `INSERT INTO paciente (nombre_completo, curp, sexo, fecha_nacimiento, telefono)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING ${COLUMNAS}`,
      [nombre_completo, curp, sexo, fecha_nacimiento, telefono]
    );
    const paciente = rows[0];
    await insertarArchivos(client, paciente.id_paciente, archivos, rutasEscritas);
    const guardados = await listarArchivos(paciente.id_paciente, client);
    await client.query('COMMIT');
    return toPaciente(paciente, guardados);
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    await Promise.all(rutasEscritas.map(borrarArchivo));
    throw mapearErrorUnico(err);
  } finally {
    client.release();
  }
}

/** RF 3.2.1: listado general; por defecto solo activos y por nombre. */
export async function listarPacientes({ estado = 'activos', orden = 'nombre' } = {}) {
  const where = estado === 'activos' ? 'WHERE activo' : estado === 'inactivos' ? 'WHERE NOT activo' : '';
  const orderBy = orden === 'registro' ? 'fecha_registro DESC, id_paciente DESC' : 'nombre_completo, id_paciente';
  const { rows } = await pool.query(`SELECT ${COLUMNAS} FROM paciente ${where} ORDER BY ${orderBy}`);
  return rows.map((row) => toPaciente(row));
}

/** RF 3.2.2-3.2.3: ficha del paciente (activo o dado de baja) con sus adjuntos. */
export async function obtenerPaciente(id) {
  const { rows } = await pool.query(`SELECT ${COLUMNAS} FROM paciente WHERE id_paciente = $1`, [id]);
  if (rows.length === 0) throw new NotFoundError();
  return toPaciente(rows[0], await listarArchivos(id));
}

/**
 * RF 3.2.4-3.2.6: actualiza los datos con las mismas reglas que el registro.
 * `archivosNuevos` se agregan y `quitarArchivos` (ids) se eliminan. Los quitados se borran del
 * disco solo después del COMMIT; los nuevos se borran si la actualización falla.
 */
export async function actualizarPaciente(
  id,
  { nombre_completo, curp, sexo, fecha_nacimiento, telefono },
  { archivosNuevos = [], quitarArchivos = [] } = {}
) {
  const client = await pool.connect();
  const rutasEscritas = [];
  try {
    await client.query('BEGIN');

    const actual = await client.query('SELECT id_paciente FROM paciente WHERE id_paciente = $1 FOR UPDATE', [id]);
    if (actual.rows.length === 0) throw new NotFoundError();

    await verificarUnicidad({ curp, telefono }, id, client);

    const { rows } = await client.query(
      `UPDATE paciente
       SET nombre_completo = $2, curp = $3, sexo = $4, fecha_nacimiento = $5, telefono = $6
       WHERE id_paciente = $1
       RETURNING ${COLUMNAS}`,
      [id, nombre_completo, curp, sexo, fecha_nacimiento, telefono]
    );

    // Solo se quitan adjuntos de este mismo paciente; ids ajenos se ignoran.
    let quitados = [];
    if (quitarArchivos.length > 0) {
      const res = await client.query(
        'DELETE FROM paciente_archivo WHERE id_paciente = $1 AND id_archivo = ANY($2::int[]) RETURNING ruta',
        [id, quitarArchivos]
      );
      quitados = res.rows.map((row) => row.ruta);
    }

    await insertarArchivos(client, id, archivosNuevos, rutasEscritas);
    const guardados = await listarArchivos(id, client);
    await client.query('COMMIT');

    await Promise.all(quitados.map(borrarArchivo));
    return toPaciente(rows[0], guardados);
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    await Promise.all(rutasEscritas.map(borrarArchivo));
    throw mapearErrorUnico(err);
  } finally {
    client.release();
  }
}

/** RF 3.3.1: baja lógica o reactivación; nunca se borra al paciente (citas e historial dependen de él). */
export async function cambiarEstado(id, activo) {
  const { rows } = await pool.query(
    `UPDATE paciente
     SET activo = $2,
         fecha_baja = CASE WHEN $2 THEN NULL ELSE COALESCE(fecha_baja, NOW()) END
     WHERE id_paciente = $1
     RETURNING ${COLUMNAS}`,
    [id, activo]
  );
  if (rows.length === 0) throw new NotFoundError();
  return toPaciente(rows[0], await listarArchivos(id));
}

/** Adjunto de un paciente para descargarlo: { nombre, tipo, ruta }. */
export async function obtenerArchivo(idPaciente, idArchivo) {
  const { rows } = await pool.query(
    'SELECT nombre_original, tipo, ruta FROM paciente_archivo WHERE id_paciente = $1 AND id_archivo = $2',
    [idPaciente, idArchivo]
  );
  if (rows.length === 0) throw new NotFoundError('Archivo no encontrado.');
  return { nombre: rows[0].nombre_original, tipo: rows[0].tipo, ruta: rows[0].ruta };
}
