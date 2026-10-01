import { EMAIL_UADY_REGEX, normalizeCorreo, normalizeTelefono } from './auth.validators.js';

const FECHA_REGEX = /^(\d{2})\/(\d{2})\/(\d{4})$/;
const CEDULA_REGEX = /^\d{7,8}$/;

function pad(n) {
  return String(n).padStart(2, '0');
}

/**
 * RF 2.1.8-2.1.9: fecha en formato dd/mm/aaaa, existente y anterior a hoy.
 * Devuelve la fecha en ISO (aaaa-mm-dd) o null si no es válida.
 */
export function parseFechaNacimiento(valor, hoy = new Date()) {
  const match = typeof valor === 'string' ? FECHA_REGEX.exec(valor.trim()) : null;
  if (!match) return { iso: null, error: 'La fecha de nacimiento debe tener el formato dd/mm/aaaa.' };

  const [, dd, mm, aaaa] = match;
  const dia = Number(dd);
  const mes = Number(mm);
  const anio = Number(aaaa);
  const fecha = new Date(anio, mes - 1, dia);
  if (fecha.getFullYear() !== anio || fecha.getMonth() !== mes - 1 || fecha.getDate() !== dia) {
    return { iso: null, error: 'La fecha de nacimiento no es una fecha válida.' };
  }

  const inicioDeHoy = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  if (fecha >= inicioDeHoy) {
    return { iso: null, error: 'La fecha de nacimiento debe ser anterior a la fecha de registro.' };
  }

  return { iso: `${anio}-${pad(mes)}-${pad(dia)}`, error: null };
}

/**
 * RF 2.1.1-2.1.9 y RF 2.2.4 (registro y edición usan las mismas reglas).
 * Devuelve { errors, data } con los campos normalizados.
 * La foto de perfil se valida aparte (utils/imagen.js) porque llega como archivo.
 */
export function validateTerapeuta(body = {}, { hoy } = {}) {
  const errors = [];

  const nombre = typeof body.nombre === 'string' ? body.nombre.trim() : '';
  const telefono = normalizeTelefono(body.telefono);
  const correo = normalizeCorreo(body.correo);
  const cedula = typeof body.cedula === 'string' ? body.cedula.replace(/\D/g, '') : '';

  if (!nombre) {
    errors.push({ field: 'nombre', message: 'El nombre completo es obligatorio.' });
  } else if (nombre.length > 50) {
    errors.push({ field: 'nombre', message: 'El nombre completo no puede exceder 50 caracteres.' });
  }

  if (!telefono) {
    errors.push({ field: 'telefono', message: 'El número telefónico es obligatorio.' });
  } else if (telefono.length !== 10) {
    errors.push({ field: 'telefono', message: 'El número telefónico debe tener 10 dígitos.' });
  }

  let fechaNacimiento = null;
  if (typeof body.fechaNacimiento !== 'string' || !body.fechaNacimiento.trim()) {
    errors.push({ field: 'fechaNacimiento', message: 'La fecha de nacimiento es obligatoria.' });
  } else {
    const { iso, error } = parseFechaNacimiento(body.fechaNacimiento, hoy);
    if (error) errors.push({ field: 'fechaNacimiento', message: error });
    fechaNacimiento = iso;
  }

  if (!correo) {
    errors.push({ field: 'correo', message: 'El correo institucional es obligatorio.' });
  } else if (correo.length > 100 || !EMAIL_UADY_REGEX.test(correo)) {
    errors.push({ field: 'correo', message: 'El correo debe terminar en @correo.uady.mx o @uady.mx.' });
  }

  if (!cedula) {
    errors.push({ field: 'cedula', message: 'La cédula profesional es obligatoria.' });
  } else if (!CEDULA_REGEX.test(cedula)) {
    errors.push({ field: 'cedula', message: 'La cédula profesional debe tener 7 u 8 dígitos.' });
  }

  return {
    errors,
    data: { nombre, telefono, correo, fechaNacimiento, cedula },
  };
}

const ESTADOS = ['activos', 'inactivos', 'todos'];
const ORDENES = ['nombre', 'registro'];

/** Parámetros de GET /terapeutas. Los valores desconocidos toman el predeterminado. */
export function validateListado(query = {}) {
  const q = typeof query.q === 'string' ? query.q.trim().slice(0, 100) : '';
  const estado = ESTADOS.includes(query.estado) ? query.estado : 'activos';
  const orden = ORDENES.includes(query.orden) ? query.orden : 'nombre';
  return { q, estado, orden };
}

/** Id de ruta como entero positivo, o null si no es válido (el controlador responde 404). */
export function parseId(param) {
  if (typeof param !== 'string' || !/^\d{1,9}$/.test(param)) return null;
  const id = Number(param);
  return id > 0 ? id : null;
}
