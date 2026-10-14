import { pool } from '../db/pool.js';
import { ConflictError } from './auth.service.js';
import { escaparLikeLiteral } from './paciente.service.js';
import { intervalosSeSuperponen } from './sala.service.js';
import { notificarCitaAgendada, notificarCitaModificada } from '../utils/notificador.js';
import {
  HORA_INICIO_JORNADA,
  HORA_FIN_JORNADA,
  MINUTOS_BLOQUE,
  horaAMinutos,
  minutosAHora,
  ahoraLocal,
  sumarDias,
} from '../validators/cita.validators.js';

export { ConflictError };

export const CITAS_POR_PAGINA = 10;

export class CitaNotFoundError extends Error {
  constructor() {
    super('Cita no encontrada.');
  }
}

/** El paciente, terapeuta o sala indicado no existe (400, como un error de validación). */
export class ReferenciaInvalidaError extends Error {
  constructor(field, message) {
    super(message);
    this.field = field;
  }
}

const SELECT_CITA = `
  SELECT c.id_cita, c.folio, c.estado,
         c.id_paciente, p.nombre_completo AS paciente,
         c.id_terapeuta, t.nombre_completo AS terapeuta,
         c.id_sala, s.nombre_sala AS sala,
         to_char(h.fecha, 'YYYY-MM-DD') AS fecha,
         to_char(h.inicio, 'HH24:MI') AS hora_inicio,
         to_char(h.fin, 'HH24:MI') AS hora_fin
  FROM cita c
  JOIN paciente p ON p.id_paciente = c.id_paciente
  JOIN terapeuta t ON t.id_terapeuta = c.id_terapeuta
  JOIN sala s ON s.id_sala = c.id_sala
  JOIN LATERAL (
    SELECT MIN(b.fecha) AS fecha, MIN(b.hora_inicio) AS inicio, MAX(b.hora_fin) AS fin
    FROM cita_bloque cb JOIN bloque_horario b ON b.id_bloque = cb.id_bloque
    WHERE cb.id_cita = c.id_cita
  ) h ON true`;

function toCita(row) {
  return {
    id: row.id_cita,
    folio: row.folio,
    estado: row.estado,
    paciente: { id: row.id_paciente, nombre: row.paciente },
    terapeuta: { id: row.id_terapeuta, nombre: row.terapeuta },
    sala: { id: row.id_sala, nombre: row.sala },
    fecha: row.fecha,
    horaInicio: row.hora_inicio,
    horaFin: row.hora_fin,
    duracion: row.hora_inicio && row.hora_fin ? horaAMinutos(row.hora_fin) - horaAMinutos(row.hora_inicio) : null,
  };
}

function timestampLocal(ahora) {
  const { fecha, hora } = ahoraLocal(ahora);
  return `${fecha} ${hora}:00`;
}

/** Las citas Pendiente cuyo horario ya terminó pasan a Vencida (perezoso: se llama antes de cada lectura). */
export async function marcarVencidas(db = pool, ahora = new Date()) {
  await db.query(
    `UPDATE cita c SET estado = 'Vencida', actualizado_en = now()
     WHERE c.estado = 'Pendiente'
       AND (SELECT MAX(b.fecha + b.hora_fin) FROM cita_bloque cb
            JOIN bloque_horario b ON b.id_bloque = cb.id_bloque
            WHERE cb.id_cita = c.id_cita) <= $1::timestamp`,
    [timestampLocal(ahora)]
  );
}

/** Ocupaciones (por bloque) de citas Pendiente entre dos fechas, opcionalmente excluyendo una cita. */
async function ocupacionesPendientes(db, desde, hasta, excluirCitaId = null) {
  const { rows } = await db.query(
    `SELECT c.id_cita, c.id_paciente, c.id_terapeuta, c.id_sala,
            to_char(b.fecha, 'YYYY-MM-DD') AS fecha,
            to_char(b.hora_inicio, 'HH24:MI') AS hora_inicio,
            to_char(b.hora_fin, 'HH24:MI') AS hora_fin
     FROM cita c
     JOIN cita_bloque cb ON cb.id_cita = c.id_cita
     JOIN bloque_horario b ON b.id_bloque = cb.id_bloque
     WHERE c.estado = 'Pendiente' AND b.fecha BETWEEN $1 AND $2
       AND ($3::int IS NULL OR c.id_cita <> $3)`,
    [desde, hasta, excluirCitaId]
  );
  return rows.map((r) => ({
    citaId: r.id_cita,
    pacienteId: r.id_paciente,
    terapeutaId: r.id_terapeuta,
    salaId: r.id_sala,
    fecha: r.fecha,
    horaInicio: r.hora_inicio,
    horaFin: r.hora_fin,
  }));
}

/**
 * RF 5.1.3: rejilla Lun–Vie × slots de 30 min. Un slot de inicio está disponible si durante toda la
 * duración el terapeuta no tiene otra cita Pendiente y al menos una sala está libre. Función pura.
 */
export function calcularRejilla({ lunes, duracion, terapeutaId, salas, ocupaciones, ahora = new Date() }) {
  const hoy = ahoraLocal(ahora);
  const inicioJornada = horaAMinutos(HORA_INICIO_JORNADA);
  const finJornada = horaAMinutos(HORA_FIN_JORNADA);
  const dias = [];

  for (let d = 0; d < 5; d += 1) {
    const fecha = sumarDias(lunes, d);
    const delDia = ocupaciones.filter((o) => o.fecha === fecha);
    const slots = [];
    for (let m = inicioJornada; m < finJornada; m += MINUTOS_BLOQUE) {
      const horaInicio = minutosAHora(m);
      const horaFin = minutosAHora(m + duracion);
      const slot = { horaInicio, horaFin, estado: 'disponible', motivo: null, salasLibres: [] };

      const cruzan = delDia.filter((o) => intervalosSeSuperponen(o.horaInicio, o.horaFin, horaInicio, horaFin));
      const salasOcupadas = new Set(cruzan.map((o) => o.salaId));
      const libres = salas.filter((s) => !salasOcupadas.has(s.id));

      if (m + duracion > finJornada) {
        Object.assign(slot, { estado: 'fuera', motivo: 'jornada' });
      } else if (fecha < hoy.fecha || (fecha === hoy.fecha && horaInicio <= hoy.hora)) {
        Object.assign(slot, { estado: 'pasado', motivo: 'pasado' });
      } else if (cruzan.some((o) => o.terapeutaId === terapeutaId)) {
        Object.assign(slot, { estado: 'ocupado', motivo: 'terapeuta' });
      } else if (libres.length === 0) {
        Object.assign(slot, { estado: 'ocupado', motivo: 'salas' });
      } else {
        slot.salasLibres = libres;
      }
      slots.push(slot);
    }
    dias.push({ fecha, slots });
  }
  return dias;
}

export async function disponibilidadSemana({ terapeutaId, lunes, duracion, excluirCitaId = null }, db = pool, ahora = new Date()) {
  const terapeuta = await db.query('SELECT 1 FROM terapeuta WHERE id_terapeuta = $1', [terapeutaId]);
  if (terapeuta.rows.length === 0) throw new ReferenciaInvalidaError('terapeutaId', 'El terapeuta seleccionado no existe.');

  await marcarVencidas(db, ahora);
  const viernes = sumarDias(lunes, 4);
  const [{ rows: salas }, ocupaciones] = await Promise.all([
    db.query('SELECT id_sala, nombre_sala FROM sala ORDER BY lower(nombre_sala), id_sala'),
    ocupacionesPendientes(db, lunes, viernes, excluirCitaId),
  ]);
  return {
    semana: { inicio: lunes, fin: viernes },
    duracion,
    jornada: { inicio: HORA_INICIO_JORNADA, fin: HORA_FIN_JORNADA, minutosBloque: MINUTOS_BLOQUE },
    dias: calcularRejilla({
      lunes,
      duracion,
      terapeutaId,
      salas: salas.map((s) => ({ id: s.id_sala, nombre: s.nombre_sala })),
      ocupaciones,
      ahora,
    }),
  };
}

/** Comprueba que las referencias existan y, si la cita queda Pendiente, que paciente y terapeuta estén activos. */
async function verificarReferencias(client, { pacienteId, terapeutaId, salaId, estado }) {
  const { rows } = await client.query(
    `SELECT (SELECT activo FROM paciente WHERE id_paciente = $1) AS paciente,
            (SELECT activo FROM terapeuta WHERE id_terapeuta = $2) AS terapeuta,
            EXISTS (SELECT 1 FROM sala WHERE id_sala = $3) AS sala`,
    [pacienteId, terapeutaId, salaId]
  );
  const ref = rows[0];
  if (ref.paciente === null) throw new ReferenciaInvalidaError('pacienteId', 'El paciente seleccionado no existe.');
  if (ref.terapeuta === null) throw new ReferenciaInvalidaError('terapeutaId', 'El terapeuta seleccionado no existe.');
  if (!ref.sala) throw new ReferenciaInvalidaError('salaId', 'La sala seleccionada no existe.');
  if (estado === 'Pendiente') {
    if (!ref.paciente) throw new ConflictError('pacienteId', 'El paciente está dado de baja; reactívalo antes de agendarle una cita.');
    if (!ref.terapeuta) throw new ConflictError('terapeutaId', 'El terapeuta está dado de baja; reactívalo antes de asignarle una cita.');
  }
}

/**
 * Serializa las escrituras que compiten por el mismo terapeuta, sala o paciente en la misma fecha.
 * Las llaves se toman en orden fijo para que dos transacciones no se bloqueen mutuamente.
 */
async function bloquearRecursos(client, { pacienteId, terapeutaId, salaId, fecha }) {
  const llaves = [`sala:${salaId}:${fecha}`, `terapeuta:${terapeutaId}:${fecha}`, `paciente:${pacienteId}:${fecha}`].sort();
  for (const llave of llaves) {
    await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [llave]);
  }
}

/** Revalida dentro de la transacción (ya con los locks) que nadie ocupe el horario. */
async function verificarConflictos(client, datos, horaFin, excluirCitaId = null) {
  const { pacienteId, terapeutaId, salaId, fecha, horaInicio } = datos;
  const { rows } = await client.query(
    `SELECT bool_or(c.id_terapeuta = $1) AS terapeuta, bool_or(c.id_sala = $2) AS sala, bool_or(c.id_paciente = $3) AS paciente
     FROM cita c
     JOIN cita_bloque cb ON cb.id_cita = c.id_cita
     JOIN bloque_horario b ON b.id_bloque = cb.id_bloque
     WHERE c.estado = 'Pendiente' AND b.fecha = $4
       AND b.hora_inicio < $6::time AND b.hora_fin > $5::time
       AND (c.id_terapeuta = $1 OR c.id_sala = $2 OR c.id_paciente = $3)
       AND ($7::int IS NULL OR c.id_cita <> $7)`,
    [terapeutaId, salaId, pacienteId, fecha, horaInicio, horaFin, excluirCitaId]
  );
  const choque = rows[0];
  if (choque.terapeuta) throw new ConflictError('terapeutaId', 'El terapeuta ya tiene una cita pendiente en ese horario.');
  if (choque.sala) throw new ConflictError('salaId', 'La sala ya está reservada en ese horario.');
  if (choque.paciente) throw new ConflictError('pacienteId', 'El paciente ya tiene una cita pendiente en ese horario.');
}

/** Crea (si faltan) los bloques de 30 min que cubren el horario y los asocia a la cita. */
async function asignarBloques(client, citaId, { fecha, horaInicio }, horaFin) {
  const inicios = [];
  const fines = [];
  for (let m = horaAMinutos(horaInicio); m < horaAMinutos(horaFin); m += MINUTOS_BLOQUE) {
    inicios.push(minutosAHora(m));
    fines.push(minutosAHora(m + MINUTOS_BLOQUE));
  }
  await client.query(
    `INSERT INTO bloque_horario (fecha, hora_inicio, hora_fin)
     SELECT $1, x.inicio::time, x.fin::time FROM unnest($2::text[], $3::text[]) AS x(inicio, fin)
     ON CONFLICT ON CONSTRAINT bloque_horario_unico DO NOTHING`,
    [fecha, inicios, fines]
  );
  await client.query('DELETE FROM cita_bloque WHERE id_cita = $1', [citaId]);
  await client.query(
    `INSERT INTO cita_bloque (id_cita, id_bloque)
     SELECT $1, b.id_bloque FROM bloque_horario b
     JOIN unnest($3::text[], $4::text[]) AS x(inicio, fin)
       ON b.hora_inicio = x.inicio::time AND b.hora_fin = x.fin::time
     WHERE b.fecha = $2`,
    [citaId, fecha, inicios, fines]
  );
}

async function enTransaccion(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const resultado = await fn(client);
    await client.query('COMMIT');
    return resultado;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function cargarCita(db, id) {
  const { rows } = await db.query(`${SELECT_CITA} WHERE c.id_cita = $1`, [id]);
  return rows[0] ? toCita(rows[0]) : null;
}

/** RF 5.1.5–5.1.14: registra la cita como Pendiente, genera su folio y notifica. */
export async function crearCita(datos) {
  const horaFin = minutosAHora(horaAMinutos(datos.horaInicio) + datos.duracion);
  const cita = await enTransaccion(async (client) => {
    await verificarReferencias(client, { ...datos, estado: 'Pendiente' });
    await bloquearRecursos(client, datos);
    await verificarConflictos(client, datos, horaFin);
    const { rows } = await client.query(
      `INSERT INTO cita (id_paciente, id_terapeuta, id_sala, estado)
       VALUES ($1, $2, $3, 'Pendiente') RETURNING id_cita`,
      [datos.pacienteId, datos.terapeutaId, datos.salaId]
    );
    const id = rows[0].id_cita;
    // RF 5.1.12: folio legible y único derivado del id (CIT-AAAA-00001).
    await client.query(
      `UPDATE cita SET folio = 'CIT-' || to_char(creado_en, 'YYYY') || '-' || lpad(id_cita::text, GREATEST(5, length(id_cita::text)), '0')
       WHERE id_cita = $1`,
      [id]
    );
    await asignarBloques(client, id, datos, horaFin);
    return cargarCita(client, id);
  });
  await notificarCitaAgendada(cita);
  return cita;
}

/** RF 5.3.1–5.3.6: modifica paciente, terapeuta, sala, horario y estatus revalidando conflictos. */
export async function actualizarCita(id, datos) {
  const horaFin = minutosAHora(horaAMinutos(datos.horaInicio) + datos.duracion);
  const cita = await enTransaccion(async (client) => {
    const actual = await client.query('SELECT 1 FROM cita WHERE id_cita = $1 FOR UPDATE', [id]);
    if (actual.rows.length === 0) throw new CitaNotFoundError();
    await verificarReferencias(client, datos);
    if (datos.estado === 'Pendiente') {
      await bloquearRecursos(client, datos);
      await verificarConflictos(client, datos, horaFin, id);
    }
    await client.query(
      `UPDATE cita SET id_paciente = $2, id_terapeuta = $3, id_sala = $4, estado = $5, actualizado_en = now()
       WHERE id_cita = $1`,
      [id, datos.pacienteId, datos.terapeutaId, datos.salaId, datos.estado]
    );
    await asignarBloques(client, id, datos, horaFin);
    return cargarCita(client, id);
  });
  await notificarCitaModificada(cita);
  return cita;
}

/** RF 5.4.1–5.4.4: la cancelación es un cambio de estado; la cita nunca se borra. */
export async function cancelarCita(id) {
  return enTransaccion(async (client) => {
    const { rows } = await client.query('SELECT estado FROM cita WHERE id_cita = $1 FOR UPDATE', [id]);
    if (rows.length === 0) throw new CitaNotFoundError();
    if (rows[0].estado === 'Cancelada') throw new ConflictError('estado', 'La cita ya está cancelada.');
    await client.query(`UPDATE cita SET estado = 'Cancelada', actualizado_en = now() WHERE id_cita = $1`, [id]);
    return cargarCita(client, id);
  });
}

export async function obtenerCita(id, db = pool) {
  await marcarVencidas(db);
  const cita = await cargarCita(db, id);
  if (!cita) throw new CitaNotFoundError();
  return cita;
}

/**
 * RF 6.1 / RF 7.1: citas de la agenda en un rango de fechas. Solo Pendientes y Vencidas (lo que ocupó u
 * ocupará la clínica); las Canceladas liberaron su horario y no se muestran. Sin paginación: un mes de
 * la clínica es un volumen pequeño.
 */
export async function agendaEntre({ desde, hasta, terapeutaId = null, salaId = null }, db = pool) {
  await marcarVencidas(db);
  const { rows } = await db.query(
    `${SELECT_CITA}
     WHERE c.estado IN ('Pendiente', 'Vencida')
       AND h.fecha BETWEEN $1 AND $2
       AND ($3::int IS NULL OR c.id_terapeuta = $3)
       AND ($4::int IS NULL OR c.id_sala = $4)
     ORDER BY h.fecha, h.inicio, lower(s.nombre_sala), c.id_cita`,
    [desde, hasta, terapeutaId, salaId]
  );
  return rows.map(toCita);
}

/**
 * RF 5.2.1–5.2.3: directorio paginado. `conteos` aplica todos los filtros salvo el de estado, para
 * alimentar las pestañas Todas/Pendientes/Canceladas/Vencidas.
 */
export async function listarCitas({ q, estado, salaId, terapeutaId, periodo, fecha, page }, db = pool) {
  await marcarVencidas(db);
  const condiciones = [];
  const params = [];
  const agregar = (valor) => { params.push(valor); return `$${params.length}`; };

  if (q) {
    const patron = agregar(`%${escaparLikeLiteral(q)}%`);
    condiciones.push(`(p.nombre_completo ILIKE ${patron} ESCAPE E'\\\\' OR c.folio ILIKE ${patron} ESCAPE E'\\\\')`);
  }
  if (salaId) condiciones.push(`c.id_sala = ${agregar(salaId)}`);
  if (terapeutaId) condiciones.push(`c.id_terapeuta = ${agregar(terapeutaId)}`);
  if (periodo === 'dia') {
    condiciones.push(`h.fecha = ${agregar(fecha)}::date`);
  } else if (periodo === 'semana') {
    const p = agregar(fecha);
    condiciones.push(`h.fecha >= date_trunc('week', ${p}::date) AND h.fecha < date_trunc('week', ${p}::date) + interval '7 days'`);
  } else if (periodo === 'mes') {
    const p = agregar(fecha);
    condiciones.push(`h.fecha >= date_trunc('month', ${p}::date) AND h.fecha < date_trunc('month', ${p}::date) + interval '1 month'`);
  }

  const whereBase = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';
  const conteo = await db.query(
    `SELECT c.estado, count(*)::int AS total FROM (${SELECT_CITA} ${whereBase}) c GROUP BY c.estado`,
    params
  );
  const conteos = { todas: 0, pendientes: 0, canceladas: 0, vencidas: 0 };
  const claves = { Pendiente: 'pendientes', Cancelada: 'canceladas', Vencida: 'vencidas' };
  for (const fila of conteo.rows) {
    conteos[claves[fila.estado]] = fila.total;
    conteos.todas += fila.total;
  }

  const paramsPagina = [...params];
  let where = whereBase;
  if (estado) {
    paramsPagina.push(estado);
    where = `${whereBase ? `${whereBase} AND` : 'WHERE'} c.estado = $${paramsPagina.length}`;
  }
  // Las pendientes se ven en orden cronológico (lo próximo primero); el resto, lo más reciente primero.
  const orden = estado === 'Pendiente' ? 'h.fecha ASC, h.inicio ASC' : 'h.fecha DESC, h.inicio DESC';
  paramsPagina.push(CITAS_POR_PAGINA, (page - 1) * CITAS_POR_PAGINA);
  const { rows } = await db.query(
    `${SELECT_CITA} ${where} ORDER BY ${orden}, c.id_cita DESC
     LIMIT $${paramsPagina.length - 1} OFFSET $${paramsPagina.length}`,
    paramsPagina
  );

  const total = estado ? conteos[claves[estado]] : conteos.todas;
  return { citas: rows.map(toCita), conteos, total, page, limit: CITAS_POR_PAGINA };
}
