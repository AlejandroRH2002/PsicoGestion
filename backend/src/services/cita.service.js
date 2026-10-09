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
  const anio = new Date().getFullYear();
  const num = Math.floor(10000 + Math.random() * 90000);
  return `CIT-${anio}-${num}`;
}

export async function listarCitas({
  q = '',
  estado = 'Todas',
  salaId = null,
  terapeutaId = null,
  tiempo = 'todos',
  fechaInicio = null,
  fechaFin = null,
  page = 1,
  limit = 10,
} = {}) {
  const conditions = [];
  const params = [];
  let paramIdx = 1;

  if (q && q.trim()) {
    conditions.push(`(p.nombre_completo ILIKE $${paramIdx} OR c.folio ILIKE $${paramIdx})`);
    params.push(`%${q.trim()}%`);
    paramIdx++;
  }

  if (estado && estado !== 'Todas') {
    conditions.push(`c.estado = $${paramIdx}`);
    params.push(estado);
    paramIdx++;
  }

  if (salaId) {
    conditions.push(`c.id_sala = $${paramIdx}`);
    params.push(Number(salaId));
    paramIdx++;
  }

  if (terapeutaId) {
    conditions.push(`c.id_terapeuta = $${paramIdx}`);
    params.push(Number(terapeutaId));
    paramIdx++;
  }

  if (tiempo === 'dia') {
    conditions.push(`EXISTS (
      SELECT 1 FROM cita_bloque cb_t 
      JOIN bloque_horario bh_t ON bh_t.id_bloque = cb_t.id_bloque
      WHERE cb_t.id_cita = c.id_cita AND bh_t.fecha = CURRENT_DATE
    )`);
  } else if (tiempo === 'semana') {
    conditions.push(`EXISTS (
      SELECT 1 FROM cita_bloque cb_t 
      JOIN bloque_horario bh_t ON bh_t.id_bloque = cb_t.id_bloque
      WHERE cb_t.id_cita = c.id_cita 
        AND bh_t.fecha >= date_trunc('week', CURRENT_DATE) 
        AND bh_t.fecha < date_trunc('week', CURRENT_DATE) + INTERVAL '7 days'
    )`);
  } else if (tiempo === 'mes') {
    conditions.push(`EXISTS (
      SELECT 1 FROM cita_bloque cb_t 
      JOIN bloque_horario bh_t ON bh_t.id_bloque = cb_t.id_bloque
      WHERE cb_t.id_cita = c.id_cita 
        AND bh_t.fecha >= date_trunc('month', CURRENT_DATE) 
        AND bh_t.fecha < (date_trunc('month', CURRENT_DATE) + INTERVAL '1 month')
    )`);
  }

  if (fechaInicio) {
    conditions.push(`EXISTS (
      SELECT 1 FROM cita_bloque cb_t 
      JOIN bloque_horario bh_t ON bh_t.id_bloque = cb_t.id_bloque
      WHERE cb_t.id_cita = c.id_cita AND bh_t.fecha >= $${paramIdx}
    )`);
    params.push(fechaInicio);
    paramIdx++;
  }

  if (fechaFin) {
    conditions.push(`EXISTS (
      SELECT 1 FROM cita_bloque cb_t 
      JOIN bloque_horario bh_t ON bh_t.id_bloque = cb_t.id_bloque
      WHERE cb_t.id_cita = c.id_cita AND bh_t.fecha <= $${paramIdx}
    )`);
    params.push(fechaFin);
    paramIdx++;
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const contadoresRes = await pool.query(`
    SELECT
      COUNT(*) AS todas,
      COUNT(*) FILTER (WHERE c.estado = 'Pendiente') AS pendientes,
      COUNT(*) FILTER (WHERE c.estado = 'Cancelada') AS canceladas,
      COUNT(*) FILTER (WHERE c.estado = 'Vencida') AS vencidas
    FROM cita c
  `);
  const contadoresRow = contadoresRes.rows[0] || {};
  const contadores = {
    todas: Number(contadoresRow.todas || 0),
    pendientes: Number(contadoresRow.pendientes || 0),
    canceladas: Number(contadoresRow.canceladas || 0),
    vencidas: Number(contadoresRow.vencidas || 0),
  };

  const countSql = `
    SELECT COUNT(DISTINCT c.id_cita) AS total
    FROM cita c
    JOIN paciente p ON p.id_paciente = c.id_paciente
    JOIN terapeuta t ON t.id_terapeuta = c.id_terapeuta
    JOIN sala s ON s.id_sala = c.id_sala
    ${whereClause}
  `;
  const countRes = await pool.query(countSql, params);
  const total = Number(countRes.rows[0]?.total || 0);

  const numLimit = Math.max(1, Math.min(100, Number(limit) || 10));
  const numPage = Math.max(1, Number(page) || 1);
  const offset = (numPage - 1) * numLimit;
  const totalPages = Math.max(1, Math.ceil(total / numLimit));

  const queryParams = [...params, numLimit, offset];
  const querySql = `
    SELECT
      c.id_cita AS id,
      c.folio,
      c.estado,
      p.id_paciente AS "pacienteId",
      p.nombre_completo AS paciente,
      t.id_terapeuta AS "terapeutaId",
      t.nombre_completo AS terapeuta,
      s.id_sala AS "salaId",
      s.nombre_sala AS sala,
      COALESCE(to_char(MIN(b.fecha), 'YYYY-MM-DD'), '') AS fecha,
      COALESCE(to_char(MIN(b.hora_inicio), 'HH24:MI'), '') AS "horaInicio",
      COALESCE(to_char(MAX(b.hora_fin), 'HH24:MI'), '') AS "horaFin"
    FROM cita c
    JOIN paciente p ON p.id_paciente = c.id_paciente
    JOIN terapeuta t ON t.id_terapeuta = c.id_terapeuta
    JOIN sala s ON s.id_sala = c.id_sala
    LEFT JOIN cita_bloque cb ON cb.id_cita = c.id_cita
    LEFT JOIN bloque_horario b ON b.id_bloque = cb.id_bloque
    ${whereClause}
    GROUP BY c.id_cita, c.folio, c.estado, p.id_paciente, p.nombre_completo, t.id_terapeuta, t.nombre_completo, s.id_sala, s.nombre_sala
    ORDER BY MIN(b.fecha) DESC NULLS LAST, MIN(b.hora_inicio) ASC NULLS LAST, c.id_cita DESC
    LIMIT $${paramIdx} OFFSET $${paramIdx + 1}
  `;

  const { rows } = await pool.query(querySql, queryParams);

  return {
    citas: rows.map(r => ({
      id: r.id,
      folio: r.folio,
      estado: r.estado,
      pacienteId: r.pacienteId,
      paciente: r.paciente,
      terapeutaId: r.terapeutaId,
      terapeuta: r.terapeuta,
      salaId: r.salaId,
      sala: r.sala,
      fecha: r.fecha,
      horaInicio: r.horaInicio,
      horaFin: r.horaFin,
    })),
    total,
    page: numPage,
    totalPages,
    contadores,
  };
}

export async function obtenerCitaPorId(idOfolio) {
  const isNumber = /^\d+$/.test(String(idOfolio));
  const where = isNumber ? 'c.id_cita = $1' : 'c.folio = $1';
  const param = isNumber ? Number(idOfolio) : String(idOfolio);

  const { rows } = await pool.query(`
    SELECT
      c.id_cita AS id,
      c.folio,
      c.estado,
      p.id_paciente AS "pacienteId",
      p.nombre_completo AS paciente,
      t.id_terapeuta AS "terapeutaId",
      t.nombre_completo AS terapeuta,
      s.id_sala AS "salaId",
      s.nombre_sala AS sala,
      COALESCE(to_char(MIN(b.fecha), 'YYYY-MM-DD'), '') AS fecha,
      COALESCE(to_char(MIN(b.hora_inicio), 'HH24:MI'), '') AS "horaInicio",
      COALESCE(to_char(MAX(b.hora_fin), 'HH24:MI'), '') AS "horaFin",
      ARRAY_AGG(cb.id_bloque) FILTER (WHERE cb.id_bloque IS NOT NULL) AS bloques
    FROM cita c
    JOIN paciente p ON p.id_paciente = c.id_paciente
    JOIN terapeuta t ON t.id_terapeuta = c.id_terapeuta
    JOIN sala s ON s.id_sala = c.id_sala
    LEFT JOIN cita_bloque cb ON cb.id_cita = c.id_cita
    LEFT JOIN bloque_horario b ON b.id_bloque = cb.id_bloque
    WHERE ${where}
    GROUP BY c.id_cita, c.folio, c.estado, p.id_paciente, p.nombre_completo, t.id_terapeuta, t.nombre_completo, s.id_sala, s.nombre_sala
  `, [param]);

  if (rows.length === 0) {
    throw new CitaNotFoundError('La cita solicitada no existe.');
  }

  const r = rows[0];
  return {
    id: r.id,
    folio: r.folio,
    estado: r.estado,
    pacienteId: r.pacienteId,
    paciente: r.paciente,
    terapeutaId: r.terapeutaId,
    terapeuta: r.terapeuta,
    salaId: r.salaId,
    sala: r.sala,
    fecha: r.fecha,
    horaInicio: r.horaInicio,
    horaFin: r.horaFin,
    bloques: r.bloques || [],
  };
}

export async function actualizarCita(id, { estado, pacienteId, terapeutaId, salaId } = {}) {
  const cita = await obtenerCitaPorId(id);

  const updates = [];
  const params = [];
  let paramIdx = 1;

  if (estado && ['Pendiente', 'Cancelada', 'Vencida'].includes(estado)) {
    updates.push(`estado = $${paramIdx++}`);
    params.push(estado);
  }

  if (pacienteId) {
    updates.push(`id_paciente = $${paramIdx++}`);
    params.push(Number(pacienteId));
  }

  if (terapeutaId) {
    updates.push(`id_terapeuta = $${paramIdx++}`);
    params.push(Number(terapeutaId));
  }

  if (salaId) {
    updates.push(`id_sala = $${paramIdx++}`);
    params.push(Number(salaId));
  }

  if (updates.length > 0) {
    params.push(cita.id);
    await pool.query(
      `UPDATE cita SET ${updates.join(', ')} WHERE id_cita = $${paramIdx}`,
      params
    );
  }

  return obtenerCitaPorId(cita.id);
}

export async function cancelarCita(id) {
  const cita = await obtenerCitaPorId(id);
  await pool.query("UPDATE cita SET estado = 'Cancelada' WHERE id_cita = $1", [cita.id]);
  return { id: cita.id, folio: cita.folio, estado: 'Cancelada' };
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
