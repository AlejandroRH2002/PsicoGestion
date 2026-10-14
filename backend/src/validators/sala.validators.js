const FECHA = /^\d{4}-\d{2}-\d{2}$/;
const HORA = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function normalizarNombreSala(valor) {
  return typeof valor === 'string' ? valor.trim().replace(/\s+/g, ' ') : '';
}

export function validateSala(body = {}) {
  const nombre = normalizarNombreSala(body.nombre);
  const errors = [];
  if (!nombre) errors.push({ field: 'nombre', message: 'El nombre de la sala es obligatorio.' });
  else if (nombre.length > 10) errors.push({ field: 'nombre', message: 'El nombre de la sala no puede exceder 10 caracteres.' });
  return { errors, data: { nombre } };
}

export function parseFecha(valor) {
  if (typeof valor !== 'string' || !FECHA.test(valor)) return null;
  const fecha = new Date(`${valor}T00:00:00Z`);
  return !Number.isNaN(fecha.getTime()) && fecha.toISOString().slice(0, 10) === valor ? valor : null;
}

export function parseHora(valor) {
  return typeof valor === 'string' && HORA.test(valor) ? valor : null;
}

export function parseSalaId(valor) {
  if (typeof valor !== 'string' || !/^\d{1,9}$/.test(valor)) return null;
  const id = Number(valor);
  return id > 0 ? id : null;
}

export function validateDisponibilidad(query = {}) {
  const errors = [];
  const fecha = parseFecha(query.fecha);
  if (!fecha) errors.push({ field: 'fecha', message: 'Ingresa una fecha válida con formato AAAA-MM-DD.' });

  const tieneInicio = query.horaInicio !== undefined && query.horaInicio !== '';
  const tieneFin = query.horaFin !== undefined && query.horaFin !== '';
  let horaInicio = null;
  let horaFin = null;
  if (tieneInicio !== tieneFin) {
    errors.push({ field: tieneInicio ? 'horaFin' : 'horaInicio', message: 'Ingresa la hora inicial y la hora final.' });
  } else if (tieneInicio) {
    horaInicio = parseHora(query.horaInicio);
    horaFin = parseHora(query.horaFin);
    if (!horaInicio) errors.push({ field: 'horaInicio', message: 'Ingresa una hora inicial válida.' });
    if (!horaFin) errors.push({ field: 'horaFin', message: 'Ingresa una hora final válida.' });
    if (horaInicio && horaFin && horaInicio >= horaFin) {
      errors.push({ field: 'horaFin', message: 'La hora final debe ser posterior a la hora inicial.' });
    }
  }
  return { errors, data: { fecha, horaInicio, horaFin } };
}
