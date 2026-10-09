import { randomBytes } from 'node:crypto';
import { pool } from '../db/pool.js';

export class CitaNotFoundError extends Error {
  constructor(message = 'No se encontró el paciente, terapeuta o sala solicitados.') {
    super(message);
  }
}

export class CitaConflictError extends Error {
  constructor(message) {
    super(message);
  }
}

export async function listarSalas() {
  const { rows } = await pool.query('SELECT id_sala, nombre_sala FROM sala ORDER BY nombre_sala, id_sala');
  return rows.map((row) => ({ id: row.id_sala, nombre: row.nombre_sala }));
}

export async function listarDisponibilidad({ terapeutaId, salaId, fecha }) {
  const { rows } = await pool.query(
    `SELECT b.id_bloque, to_char(b.fecha, 'YYYY-MM-DD') AS fecha,
            to_char(b.hora_inicio, 'HH24:MI') AS hora_inicio,
            to_char(b.hora_fin, 'HH24:MI') AS hora_fin
     FROM bloque_horario b
     JOIN disponibilidad_terapeuta dt
       ON dt.id_bloque = b.id_bloque AND dt.id_terapeuta = $1
     JOIN disponibilidad_sala ds
       ON ds.id_bloque = b.id_bloque AND ds.id_sala = $2
     WHERE b.fecha = $3
       AND (b.fecha + b.hora_inicio) > LOCALTIMESTAMP
       AND NOT EXISTS (
         SELECT 1
         FROM cita_bloque cb
         JOIN cita c ON c.id_cita = cb.id_cita AND c.estado = 'Pendiente'
         JOIN bloque_horario ocupado ON ocupado.id_bloque = cb.id_bloque
         WHERE (c.id_terapeuta = $1 OR c.id_sala = $2)
           AND ocupado.fecha = b.fecha
           AND ocupado.hora_inicio < b.hora_fin
           AND ocupado.hora_fin > b.hora_inicio
       )
     ORDER BY b.hora_inicio, b.id_bloque`,
    [terapeutaId, salaId, fecha]
  );
  return rows.map((row) => ({
    id: row.id_bloque,
    fecha: row.fecha,
    horaInicio: row.hora_inicio,
    horaFin: row.hora_fin,
  }));
}

function folioNuevo() {
  return randomBytes(5).toString('hex').toUpperCase();
}

export async function crearCita({ pacienteId, terapeutaId, salaId, bloques }) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const recursos = [
      ['cita:terapeuta', terapeutaId],
      ['cita:sala', salaId],
    ].sort(([nombreA], [nombreB]) => nombreA.localeCompare(nombreB));
    for (const [recurso, id] of recursos) {
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1), $2)', [recurso, id]);
    }

    const entidades = await client.query(
      `SELECT
         EXISTS (SELECT 1 FROM paciente WHERE id_paciente = $1 AND activo) AS paciente_activo,
         EXISTS (SELECT 1 FROM terapeuta WHERE id_terapeuta = $2 AND activo) AS terapeuta_activo,
         EXISTS (SELECT 1 FROM sala WHERE id_sala = $3) AS sala_existente`,
      [pacienteId, terapeutaId, salaId]
    );
    const estado = entidades.rows[0];
    if (!estado.paciente_activo || !estado.terapeuta_activo || !estado.sala_existente) {
      throw new CitaNotFoundError();
    }

    const { rows } = await client.query(
      `SELECT b.id_bloque, to_char(b.fecha, 'YYYY-MM-DD') AS fecha,
              to_char(b.hora_inicio, 'HH24:MI:SS') AS hora_inicio,
              to_char(b.hora_fin, 'HH24:MI:SS') AS hora_fin,
              (b.fecha + b.hora_inicio) > LOCALTIMESTAMP AS futuro,
              EXISTS (
                SELECT 1 FROM disponibilidad_terapeuta dt
                WHERE dt.id_terapeuta = $2 AND dt.id_bloque = b.id_bloque
              ) AS terapeuta_disponible,
              EXISTS (
                SELECT 1 FROM disponibilidad_sala ds
                WHERE ds.id_sala = $3 AND ds.id_bloque = b.id_bloque
              ) AS sala_disponible
       FROM bloque_horario b
       WHERE b.id_bloque = ANY($1::int[])
       ORDER BY b.fecha, b.hora_inicio, b.id_bloque
       FOR UPDATE OF b`,
      [bloques, terapeutaId, salaId]
    );

    if (rows.length !== bloques.length) {
      throw new CitaConflictError('Uno o más bloques seleccionados ya no existen.');
    }
    if (rows.some((row) => !row.terapeuta_disponible || !row.sala_disponible)) {
      throw new CitaConflictError('El terapeuta o la sala no están disponibles en todos los bloques seleccionados.');
    }

    const fecha = rows[0].fecha;
    if (rows.some((row) => row.fecha !== fecha)) {
      throw new CitaConflictError('Todos los bloques de una cita deben corresponder al mismo día.');
    }
    if (rows.some((row) => !row.futuro)) {
      throw new CitaConflictError('No se pueden agendar bloques que ya comenzaron.');
    }
    for (let index = 1; index < rows.length; index += 1) {
      if (rows[index - 1].hora_fin !== rows[index].hora_inicio) {
        throw new CitaConflictError('Los bloques seleccionados deben ser consecutivos.');
      }
    }

    const ocupacion = await client.query(
      `SELECT EXISTS (
         SELECT 1
         FROM cita_bloque cb
         JOIN cita c ON c.id_cita = cb.id_cita AND c.estado = 'Pendiente'
         JOIN bloque_horario ocupado ON ocupado.id_bloque = cb.id_bloque
         WHERE (c.id_terapeuta = $1 OR c.id_sala = $2)
           AND ocupado.fecha = $3
           AND ocupado.hora_inicio < $5
           AND ocupado.hora_fin > $4
       ) AS ocupado`,
      [terapeutaId, salaId, fecha, rows[0].hora_inicio, rows.at(-1).hora_fin]
    );
    if (ocupacion.rows[0].ocupado) {
      throw new CitaConflictError('El terapeuta o la sala ya tienen una cita en ese horario.');
    }

    const { rows: citas } = await client.query(
      `INSERT INTO cita (id_paciente, id_terapeuta, id_sala, folio, estado)
       VALUES ($1, $2, $3, $4, 'Pendiente')
       RETURNING id_cita, id_paciente, id_terapeuta, id_sala, folio, estado`,
      [pacienteId, terapeutaId, salaId, folioNuevo()]
    );
    const cita = citas[0];
    for (const row of rows) {
      await client.query(
        'INSERT INTO cita_bloque (id_cita, id_bloque) VALUES ($1, $2)',
        [cita.id_cita, row.id_bloque]
      );
    }

    await client.query('COMMIT');
    return {
      id: cita.id_cita,
      pacienteId: cita.id_paciente,
      terapeutaId: cita.id_terapeuta,
      salaId: cita.id_sala,
      folio: cita.folio,
      estado: cita.estado,
      fecha,
      horaInicio: rows[0].hora_inicio.slice(0, 5),
      horaFin: rows.at(-1).hora_fin.slice(0, 5),
      bloques: rows.map((row) => row.id_bloque),
    };
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}
