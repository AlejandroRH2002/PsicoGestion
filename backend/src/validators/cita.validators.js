import { parseId } from './terapeuta.validators.js';

function parseCitaId(value) {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  if (typeof value === 'number' && !Number.isSafeInteger(value)) return null;
  return parseId(String(value));
}

function validateIds(values, fields) {
  const errors = [];
  const data = {};

  for (const field of fields) {
    const id = parseCitaId(values?.[field]);
    if (!id) {
      errors.push({ field, message: 'Ingresa un identificador válido.' });
    } else {
      data[field] = id;
    }
  }

  return { errors, data };
}

export function validateDisponibilidad(query = {}) {
  const { errors, data } = validateIds(query, ['terapeutaId', 'salaId']);
  const fecha = typeof query.fecha === 'string' ? query.fecha.trim() : '';
  const parsed = /^\d{4}-\d{2}-\d{2}$/.test(fecha) ? new Date(`${fecha}T00:00:00Z`) : null;

  if (!parsed || Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== fecha) {
    errors.push({ field: 'fecha', message: 'Ingresa una fecha válida con formato AAAA-MM-DD.' });
  }

  return { errors, data: { ...data, fecha } };
}

export function validateCrearCita(body = {}) {
  const campos = ['pacienteId', 'terapeutaId', 'salaId'];
  const { errors, data } = validateIds(body, campos);
  const bloques = body.bloques;

  if (!Array.isArray(bloques) || bloques.length === 0 || bloques.length > 12) {
    errors.push({ field: 'bloques', message: 'Selecciona entre 1 y 12 bloques para la cita.' });
    return { errors, data: { ...data, bloques: [] } };
  }

  const ids = bloques.map(parseCitaId);
  if (ids.some((id) => !id)) {
    errors.push({ field: 'bloques', message: 'Cada bloque debe tener un identificador válido.' });
  } else if (new Set(ids).size !== ids.length) {
    errors.push({ field: 'bloques', message: 'No se puede seleccionar el mismo bloque más de una vez.' });
  }

  return { errors, data: { ...data, bloques: ids } };
}
