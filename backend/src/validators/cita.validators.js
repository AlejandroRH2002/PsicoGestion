import { parseFecha, parseHora } from './sala.validators.js';

// Rejilla de agenda (confirmada con la coordinación): bloques de 30 min, lunes a viernes, 07:00–17:00.
// Mantener sincronizado con frontend/src/utils/cita.ts.
export const HORA_INICIO_JORNADA = '07:00';
export const HORA_FIN_JORNADA = '17:00';
export const MINUTOS_BLOQUE = 30;
export const DURACIONES = [30, 60, 90];
export const DURACION_PREDETERMINADA = 60;
export const ESTADOS_CITA = ['Pendiente', 'Cancelada', 'Vencida'];
export const PERIODOS = ['dia', 'semana', 'mes'];

export function horaAMinutos(hora) {
  const [h, m] = hora.split(':').map(Number);
  return h * 60 + m;
}

export function minutosAHora(minutos) {
  return `${String(Math.floor(minutos / 60)).padStart(2, '0')}:${String(minutos % 60).padStart(2, '0')}`;
}

/** Fecha y hora locales del servidor como 'AAAA-MM-DD' y 'HH:MM' (la clínica opera en una sola zona). */
export function ahoraLocal(ahora = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return {
    fecha: `${ahora.getFullYear()}-${pad(ahora.getMonth() + 1)}-${pad(ahora.getDate())}`,
    hora: `${pad(ahora.getHours())}:${pad(ahora.getMinutes())}`,
  };
}

export function sumarDias(fecha, dias) {
  const d = new Date(`${fecha}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

/** 0 = domingo … 6 = sábado. */
export function diaSemana(fecha) {
  return new Date(`${fecha}T00:00:00Z`).getUTCDay();
}

export function lunesDe(fecha) {
  const dia = diaSemana(fecha);
  return sumarDias(fecha, dia === 0 ? -6 : 1 - dia);
}

/** Acepta número o cadena de dígitos; devuelve el id positivo o null. */
export function parseId(valor) {
  if (typeof valor === 'number') return Number.isInteger(valor) && valor > 0 && valor < 1e9 ? valor : null;
  if (typeof valor !== 'string' || !/^\d{1,9}$/.test(valor)) return null;
  const id = Number(valor);
  return id > 0 ? id : null;
}

function parseDuracion(valor) {
  const n = typeof valor === 'string' && /^\d{1,3}$/.test(valor) ? Number(valor) : valor;
  return DURACIONES.includes(n) ? n : null;
}

/**
 * RF 5.1.2–5.1.5 / RF 5.3.3–5.3.4. `estado` solo se admite al modificar; al crear siempre es Pendiente.
 * El horario debe caer en la rejilla y, si la cita queda Pendiente, no puede estar en el pasado.
 */
export function validateCita(body = {}, { edicion = false, ahora = new Date() } = {}) {
  const errors = [];
  const pacienteId = parseId(body.pacienteId);
  const terapeutaId = parseId(body.terapeutaId);
  const salaId = parseId(body.salaId);
  const fecha = parseFecha(body.fecha);
  const horaInicio = parseHora(body.horaInicio);
  const duracion = parseDuracion(body.duracion);
  let estado = 'Pendiente';

  if (!pacienteId) errors.push({ field: 'pacienteId', message: 'Selecciona un paciente.' });
  if (!terapeutaId) errors.push({ field: 'terapeutaId', message: 'Selecciona un terapeuta.' });
  if (!salaId) errors.push({ field: 'salaId', message: 'Selecciona una sala.' });
  if (!duracion) errors.push({ field: 'duracion', message: 'Selecciona una duración válida (30, 60 o 90 minutos).' });

  if (edicion) {
    if (!ESTADOS_CITA.includes(body.estado)) errors.push({ field: 'estado', message: 'Selecciona un estatus válido.' });
    else estado = body.estado;
  }

  if (!fecha) {
    errors.push({ field: 'fecha', message: 'Selecciona una fecha válida.' });
  } else if ([0, 6].includes(diaSemana(fecha))) {
    errors.push({ field: 'fecha', message: 'Las citas solo pueden agendarse de lunes a viernes.' });
  }

  if (!horaInicio) {
    errors.push({ field: 'horaInicio', message: 'Selecciona una hora de inicio válida.' });
  } else {
    const inicio = horaAMinutos(horaInicio);
    const fueraDeRejilla = inicio % MINUTOS_BLOQUE !== 0
      || inicio < horaAMinutos(HORA_INICIO_JORNADA)
      || inicio >= horaAMinutos(HORA_FIN_JORNADA);
    if (fueraDeRejilla) {
      errors.push({ field: 'horaInicio', message: `El horario debe iniciar en intervalos de ${MINUTOS_BLOQUE} minutos entre ${HORA_INICIO_JORNADA} y ${HORA_FIN_JORNADA}.` });
    } else if (duracion && inicio + duracion > horaAMinutos(HORA_FIN_JORNADA)) {
      errors.push({ field: 'duracion', message: `La cita debe terminar a más tardar a las ${HORA_FIN_JORNADA}.` });
    }
  }

  if (fecha && horaInicio && estado === 'Pendiente') {
    const hoy = ahoraLocal(ahora);
    if (fecha < hoy.fecha || (fecha === hoy.fecha && horaInicio <= hoy.hora)) {
      errors.push({ field: 'horaInicio', message: 'No es posible agendar una cita en un horario que ya pasó.' });
    }
  }

  return { errors, data: { pacienteId, terapeutaId, salaId, fecha, horaInicio, duracion, estado } };
}

/** RF 5.2.2–5.2.3: filtros del directorio. Los inválidos se ignoran salvo la fecha de referencia. */
export function validateListado(query = {}, { ahora = new Date() } = {}) {
  const errors = [];
  const q = typeof query.q === 'string' ? query.q.trim().slice(0, 100) : '';
  const estado = ESTADOS_CITA.includes(query.estado) ? query.estado : null;
  const periodo = PERIODOS.includes(query.periodo) ? query.periodo : null;
  let fecha = ahoraLocal(ahora).fecha;
  if (query.fecha !== undefined && query.fecha !== '') {
    fecha = parseFecha(query.fecha);
    if (!fecha) errors.push({ field: 'fecha', message: 'Ingresa una fecha válida con formato AAAA-MM-DD.' });
  }
  const page = typeof query.page === 'string' && /^\d{1,6}$/.test(query.page) && Number(query.page) > 0 ? Number(query.page) : 1;
  return {
    errors,
    data: { q, estado, salaId: parseId(query.salaId), terapeutaId: parseId(query.terapeutaId), periodo, fecha, page },
  };
}

/** RF 5.1.3: consulta de la rejilla semanal para un terapeuta. */
export function validateDisponibilidadSemana(query = {}, { ahora = new Date() } = {}) {
  const errors = [];
  const terapeutaId = parseId(query.terapeutaId);
  if (!terapeutaId) errors.push({ field: 'terapeutaId', message: 'Selecciona un terapeuta.' });

  let semana = ahoraLocal(ahora).fecha;
  if (query.semana !== undefined && query.semana !== '') {
    semana = parseFecha(query.semana);
    if (!semana) errors.push({ field: 'semana', message: 'Ingresa una fecha válida con formato AAAA-MM-DD.' });
  }

  let duracion = DURACION_PREDETERMINADA;
  if (query.duracion !== undefined && query.duracion !== '') {
    duracion = parseDuracion(query.duracion);
    if (!duracion) errors.push({ field: 'duracion', message: 'Selecciona una duración válida (30, 60 o 90 minutos).' });
  }

  return {
    errors,
    data: { terapeutaId, lunes: semana ? lunesDe(semana) : null, duracion, excluirCitaId: parseId(query.excluir) },
  };
}
