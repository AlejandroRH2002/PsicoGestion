import { pool } from '../db/pool.js';
import { ConflictError } from './auth.service.js';
import { ahoraLocal } from '../validators/cita.validators.js';

export class SalaNotFoundError extends Error {
  constructor() {
    super('Sala no encontrada.');
  }
}

export function intervalosSeSuperponen(inicioA, finA, inicioB, finB) {
  return inicioA < finB && finA > inicioB;
}

function toSala(row) {
  return { id: row.id_sala, nombre: row.nombre_sala };
}

function mapearError(err) {
  if (err?.code === '23505' && err.constraint === 'sala_nombre_normalizado_key') {
    return new ConflictError('nombre', 'Ya existe una sala con ese nombre.');
  }
  return err;
}

export async function registrarSala({ nombre }, db = pool) {
  try {
    const { rows } = await db.query(
      'INSERT INTO sala (nombre_sala) VALUES ($1) RETURNING id_sala, nombre_sala',
      [nombre]
    );
    return toSala(rows[0]);
  } catch (err) {
    throw mapearError(err);
  }
}

export async function listarSalas(db = pool) {
  const { rows } = await db.query('SELECT id_sala, nombre_sala FROM sala WHERE activo ORDER BY lower(nombre_sala), id_sala');
  return rows.map(toSala);
}

/**
 * RF 4.2.1–4.2.5: baja lógica. La fila se conserva para el historial de citas (FK RESTRICT) y deja de
 * ofrecerse en el catálogo, la disponibilidad y los formularios de citas. Se rechaza si la sala aún tiene
 * citas Pendiente por ocurrir: eliminarla las dejaría en una sala inexistente.
 * El FOR UPDATE choca con el FOR SHARE que toma cita.service.js#verificarReferencias, así que una cita no
 * puede agendarse en la sala mientras se elimina (ni al revés).
 */
export async function eliminarSala(id, ahora = new Date()) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const sala = await client.query('SELECT 1 FROM sala WHERE id_sala = $1 AND activo FOR UPDATE', [id]);
    if (sala.rows.length === 0) throw new SalaNotFoundError();
    const { fecha, hora } = ahoraLocal(ahora);
    const { rows } = await client.query(
      `SELECT count(*)::int AS pendientes FROM cita c
       WHERE c.id_sala = $1 AND c.estado = 'Pendiente'
         AND (SELECT MAX(b.fecha + b.hora_fin) FROM cita_bloque cb
              JOIN bloque_horario b ON b.id_bloque = cb.id_bloque
              WHERE cb.id_cita = c.id_cita) > $2::timestamp`,
      [id, `${fecha} ${hora}:00`]
    );
    const { pendientes } = rows[0];
    if (pendientes > 0) {
      throw new ConflictError(
        'sala',
        `La sala tiene ${pendientes === 1 ? '1 cita pendiente' : `${pendientes} citas pendientes`}; reprográmalas o cancélalas antes de eliminarla.`
      );
    }
    await client.query('UPDATE sala SET activo = false, fecha_baja = now() WHERE id_sala = $1', [id]);
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function moduloCitasDisponible(db) {
  const { rows } = await db.query(
    "SELECT to_regclass('public.cita') IS NOT NULL AND to_regclass('public.cita_bloque') IS NOT NULL AND to_regclass('public.bloque_horario') IS NOT NULL AS disponible"
  );
  return rows[0].disponible;
}

/**
 * RF 4.3 / contrato RF 5.1.3-5.1.4. No devuelve pacientes ni terapeutas.
 * Sin horas, una sala está reservada si tiene cualquier cita vigente ese día.
 * Con intervalo aplica: inicioOcupado < finConsultado && finOcupado > inicioConsultado.
 */
export async function consultarDisponibilidad({ fecha, horaInicio, horaFin, salaId = null }, db = pool) {
  if (salaId) {
    const existe = await db.query('SELECT 1 FROM sala WHERE id_sala = $1 AND activo', [salaId]);
    if (existe.rows.length === 0) throw new SalaNotFoundError();
  }

  if (!(await moduloCitasDisponible(db))) {
    const salas = await listarSalas(db);
    const filtradas = salaId ? salas.filter((sala) => sala.id === salaId) : salas;
    return { fecha, horaInicio, horaFin, fuenteOcupacion: 'pendiente_modulo_citas', salas: filtradas.map((sala) => ({ ...sala, estado: 'libre', ocupaciones: [] })) };
  }

  const params = [fecha, horaInicio, horaFin, salaId];
  const { rows } = await db.query(
    `SELECT s.id_sala, s.nombre_sala,
            COALESCE(json_agg(json_build_object(
              'horaInicio', to_char(b.hora_inicio, 'HH24:MI'),
              'horaFin', to_char(b.hora_fin, 'HH24:MI')
            ) ORDER BY b.hora_inicio) FILTER (WHERE b.id_bloque IS NOT NULL), '[]') AS ocupaciones
     FROM sala s
     LEFT JOIN (
       SELECT DISTINCT c.id_sala, b.id_bloque, b.hora_inicio, b.hora_fin
       FROM cita c
       JOIN cita_bloque cb ON cb.id_cita = c.id_cita
       JOIN bloque_horario b ON b.id_bloque = cb.id_bloque
       WHERE c.estado = 'Pendiente' AND b.fecha = $1
         AND ($2::time IS NULL OR (b.hora_inicio < $3::time AND b.hora_fin > $2::time))
     ) b ON b.id_sala = s.id_sala
     WHERE s.activo AND ($4::int IS NULL OR s.id_sala = $4)
     GROUP BY s.id_sala, s.nombre_sala
     ORDER BY lower(s.nombre_sala), s.id_sala`,
    params
  );
  return {
    fecha,
    horaInicio,
    horaFin,
    fuenteOcupacion: 'citas',
    salas: rows.map((row) => ({ ...toSala(row), estado: row.ocupaciones.length ? 'reservada' : 'libre', ocupaciones: row.ocupaciones })),
  };
}
