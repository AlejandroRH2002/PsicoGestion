import { env } from '../config/env.js';

const ALLOWED_EMAIL_DOMAINS = ['correo.uady.mx', 'uady.mx', ...env.extraEmailDomains];
const EMAIL_UADY_REGEX = new RegExp(
  `^[^\\s@]+@(${ALLOWED_EMAIL_DOMAINS.map((d) => d.replace(/\\./g, '\\.')).join('|')})$`,
  'i'
);

export function normalizeCorreo(correo) {
  return typeof correo === 'string' ? correo.trim().toLowerCase() : '';
}

export function normalizeTelefono(telefono) {
  return typeof telefono === 'string' ? telefono.replace(/\D/g, '') : '';
}

export function parseFechaNacimiento(fechaStr) {
  if (!fechaStr || typeof fechaStr !== 'string') return null;
  const trimmed = fechaStr.trim();
  // Formato dd/mm/aaaa
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(trimmed)) {
    const [dia, mes, anio] = trimmed.split('/');
    return `${anio}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`;
  }
  // Formato aaaa-mm-dd
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }
  return null;
}

/**
 * Validador para registro de nuevo terapeuta según especificación:
 * - nombre_completo: obligatorio, máx 50 caracteres
 * - telefono: obligatorio, 10 dígitos numéricos
 * - correo_electronico: obligatorio, institucional UADY, máx 100 caracteres
 * - fecha_nacimiento: opcional u obligatoria según formulario; debe ser anterior a la fecha actual
 * - cedula_profesional: obligatorio, máx 20 caracteres
 * - foto_perfil: opcional (texto / DataURL / URL)
 */
export function validateTerapeuta(body = {}) {
  const errors = [];

  const nombre_completo = typeof body.nombre_completo === 'string' ? body.nombre_completo.trim() : '';
  const rawTelefono = typeof body.telefono === 'string' ? body.telefono : '';
  const telefonoDigits = normalizeTelefono(rawTelefono);
  const correo_electronico = normalizeCorreo(body.correo_electronico);
  const rawFecha = typeof body.fecha_nacimiento === 'string' ? body.fecha_nacimiento.trim() : '';
  const cedula_profesional = typeof body.cedula_profesional === 'string' ? body.cedula_profesional.trim().toUpperCase() : '';
  const foto_perfil = typeof body.foto_perfil === 'string' && body.foto_perfil.trim() ? body.foto_perfil.trim() : null;

  // Validación Nombre Completo
  if (!nombre_completo) {
    errors.push({ field: 'nombre_completo', message: 'El nombre completo es obligatorio.' });
  } else if (nombre_completo.length > 50) {
    errors.push({ field: 'nombre_completo', message: 'El nombre completo no puede exceder 50 caracteres.' });
  }

  // Validación Teléfono
  if (!rawTelefono || !telefonoDigits) {
    errors.push({ field: 'telefono', message: 'El teléfono es obligatorio.' });
  } else if (telefonoDigits.length !== 10) {
    errors.push({ field: 'telefono', message: 'El teléfono debe ser de 10 dígitos.' });
  }

  // Validación Correo Electrónico Institucional
  if (!correo_electronico) {
    errors.push({ field: 'correo_electronico', message: 'El correo electrónico es obligatorio.' });
  } else if (correo_electronico.length > 100 || !EMAIL_UADY_REGEX.test(correo_electronico)) {
    errors.push({
      field: 'correo_electronico',
      message: 'Debe ser un correo institucional válido (@correo.uady.mx o @uady.mx).',
    });
  }

  // Validación Fecha de Nacimiento
  let fechaParsed = null;
  if (rawFecha) {
    fechaParsed = parseFechaNacimiento(rawFecha);
    if (!fechaParsed) {
      errors.push({ field: 'fecha_nacimiento', message: 'Formato de fecha inválido. Utiliza dd/mm/aaaa o aaaa-mm-dd.' });
    } else {
      const birthDate = new Date(`${fechaParsed}T00:00:00Z`);
      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);

      if (Number.isNaN(birthDate.getTime())) {
        errors.push({ field: 'fecha_nacimiento', message: 'La fecha proporcionada no es una fecha válida.' });
      } else if (birthDate >= today) {
        errors.push({ field: 'fecha_nacimiento', message: 'La fecha de nacimiento debe ser anterior a la fecha actual.' });
      }
    }
  }

  // Validación Cédula Profesional
  if (!cedula_profesional) {
    errors.push({ field: 'cedula_profesional', message: 'La cédula profesional es obligatoria.' });
  } else if (cedula_profesional.length > 20) {
    errors.push({ field: 'cedula_profesional', message: 'La cédula profesional no puede exceder 20 caracteres.' });
  }

  return {
    errors,
    data: {
      nombre_completo,
      telefono: telefonoDigits,
      correo_electronico,
      fecha_nacimiento: fechaParsed,
      cedula_profesional,
      foto_perfil,
    },
  };
}
