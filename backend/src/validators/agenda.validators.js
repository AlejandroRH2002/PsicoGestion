import { parseFecha } from './sala.validators.js';
import { ahoraLocal, lunesDe, sumarDias, parseId } from './cita.validators.js';

export const VISTAS_AGENDA = ['dia', 'semana', 'mes'];

function ultimoDiaDelMes(fecha) {
  const [anio, mes] = fecha.split('-').map(Number);
  const dias = new Date(Date.UTC(anio, mes, 0)).getUTCDate();
  return `${fecha.slice(0, 7)}-${String(dias).padStart(2, '0')}`;
}

/** Rango de fechas (inclusivo) que cubre cada vista: un día, lunes–viernes o el mes completo. */
export function rangoAgenda(vista, fecha) {
  if (vista === 'dia') return { desde: fecha, hasta: fecha };
  if (vista === 'semana') {
    const lunes = lunesDe(fecha);
    return { desde: lunes, hasta: sumarDias(lunes, 4) };
  }
  return { desde: `${fecha.slice(0, 7)}-01`, hasta: ultimoDiaDelMes(fecha) };
}

/** RF 6.1.1–6.1.2: vista de agenda por día, semana o mes, con filtros opcionales de terapeuta y sala. */
export function validateAgenda(query = {}, { ahora = new Date() } = {}) {
  const errors = [];
  let vista = 'semana';
  if (query.vista !== undefined && query.vista !== '') {
    if (VISTAS_AGENDA.includes(query.vista)) vista = query.vista;
    else errors.push({ field: 'vista', message: 'Selecciona una vista válida (día, semana o mes).' });
  }

  let fecha = ahoraLocal(ahora).fecha;
  if (query.fecha !== undefined && query.fecha !== '') {
    fecha = parseFecha(query.fecha);
    if (!fecha) errors.push({ field: 'fecha', message: 'Ingresa una fecha válida con formato AAAA-MM-DD.' });
  }

  const rango = fecha ? rangoAgenda(vista, fecha) : { desde: null, hasta: null };
  return {
    errors,
    data: { vista, fecha, ...rango, terapeutaId: parseId(query.terapeutaId), salaId: parseId(query.salaId) },
  };
}
