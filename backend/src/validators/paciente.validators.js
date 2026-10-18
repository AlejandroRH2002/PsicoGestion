export function normalizeTelefono(telefono) {
  return typeof telefono === 'string' ? telefono.replace(/\D/g, '') : '';
}

export function normalizeCorreo(correo) {
  return typeof correo === 'string' ? correo.trim().toLowerCase() : '';
}

export function parseFechaNacimiento(fechaStr) {
  if (typeof fechaStr !== 'string') return null;

  const trimmed = fechaStr.trim();
  if (!/^\d{2}\/\d{2}\/\d{4}$/.test(trimmed)) {
    return null;
  }

  const [dia, mes, anio] = trimmed.split('/').map(Number);
  const fecha = new Date(Date.UTC(anio, mes - 1, dia));

  if (
    fecha.getUTCFullYear() !== anio ||
    fecha.getUTCMonth() !== mes - 1 ||
    fecha.getUTCDate() !== dia
  ) {
    return null;
  }

  return `${anio}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
}

export function parsePacienteId(value) {
  if (typeof value === 'number') {
    return Number.isInteger(value) && value > 0 ? value : null;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }

    const parsed = Number(trimmed);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
  }

  return null;
}

const QUERY_MAX = 50;

/** Valida el término opcional del buscador rápido. */
export function validateBusquedaPacientes(query = {}) {
  const q = typeof query.q === 'string' ? query.q.trim() : '';
  const errors = [];

  if (q.length > QUERY_MAX) {
    errors.push({ field: 'q', message: `La búsqueda no puede exceder ${QUERY_MAX} caracteres.` });
  }

  return {
    errors,
    data: {
      q,
      buscar: q.length > 0 && q.length <= QUERY_MAX,
    },
  };
}

export { QUERY_MAX as PACIENTE_SEARCH_QUERY_MAX };

export const EDAD_MINIMA = 7;

/** Años cumplidos entre dos fechas UTC (sin hora). */
function calcularEdad(nacimiento, hoy) {
  let edad = hoy.getUTCFullYear() - nacimiento.getUTCFullYear();
  const mes = hoy.getUTCMonth() - nacimiento.getUTCMonth();
  if (mes < 0 || (mes === 0 && hoy.getUTCDate() < nacimiento.getUTCDate())) edad -= 1;
  return edad;
}

const ESTADOS = ['activos', 'inactivos', 'todos'];
const ORDENES = ['nombre', 'registro'];

/** RF 3.2.1: parámetros del listado general. Los valores desconocidos toman el predeterminado. */
export function validateListado(query = {}) {
  const estado = ESTADOS.includes(query.estado) ? query.estado : 'activos';
  const orden = ORDENES.includes(query.orden) ? query.orden : 'nombre';
  return { estado, orden };
}

// Formato general (no institucional): el correo es del paciente o su tutor.
const CORREO_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** RF 3.1.2-3.1.11, RF 3.2.4-3.2.5: mismas reglas para registro y edición. */
export function validatePaciente(body = {}, options = {}) {
  const { hoy = new Date() } = options;
  const errors = [];

  const nombre_completo = typeof body.nombre_completo === 'string' ? body.nombre_completo.trim() : '';
  const curp = typeof body.curp === 'string' ? body.curp.trim().toUpperCase() : '';
  const sexo = typeof body.sexo === 'string' ? body.sexo.trim().toUpperCase() : '';
  const rawFecha = typeof body.fecha_nacimiento === 'string' ? body.fecha_nacimiento.trim() : '';
  const telefono = normalizeTelefono(body.telefono);
  const correo = normalizeCorreo(body.correo);

  if (!nombre_completo) {
    errors.push({ field: 'nombre_completo', message: 'El nombre completo es obligatorio.' });
  } else if (nombre_completo.length > 50) {
    errors.push({ field: 'nombre_completo', message: 'El nombre completo no puede exceder 50 caracteres.' });
  }

  if (!curp) {
    errors.push({ field: 'curp', message: 'La CURP es obligatoria.' });
  } else if (curp.length !== 18 || !/^[A-Z]{4}\d{6}[HM][A-Z]{5}[0-9A-Z]\d$/.test(curp)) {
    errors.push({ field: 'curp', message: 'Ingresa una CURP oficial válida de 18 caracteres.' });
  }

  if (!sexo) {
    errors.push({ field: 'sexo', message: 'El sexo del paciente es obligatorio.' });
  } else if (!['M', 'F', 'O'].includes(sexo)) {
    errors.push({ field: 'sexo', message: 'El sexo debe ser M, F u O.' });
  }

  let fechaNacimiento = null;
  if (!rawFecha) {
    errors.push({ field: 'fecha_nacimiento', message: 'La fecha de nacimiento es obligatoria.' });
  } else {
    fechaNacimiento = parseFechaNacimiento(rawFecha);
    if (!fechaNacimiento) {
      errors.push({ field: 'fecha_nacimiento', message: 'Formato de fecha inválido. Usa dd/mm/aaaa.' });
    } else {
      const birthDate = new Date(`${fechaNacimiento}T00:00:00Z`);
      const today = new Date(hoy);
      today.setUTCHours(0, 0, 0, 0);

      if (Number.isNaN(birthDate.getTime())) {
        errors.push({ field: 'fecha_nacimiento', message: 'La fecha proporcionada no es válida.' });
      } else if (birthDate >= today) {
        // RF 3.1.8, RNF 3.1.5
        errors.push({ field: 'fecha_nacimiento', message: 'La fecha de nacimiento debe ser anterior a la fecha actual.' });
      } else if (calcularEdad(birthDate, today) < EDAD_MINIMA) {
        // RF 3.1.9
        errors.push({ field: 'fecha_nacimiento', message: `El paciente debe tener al menos ${EDAD_MINIMA} años cumplidos.` });
      }
    }
  }

  if (!telefono) {
    errors.push({ field: 'telefono', message: 'El teléfono es obligatorio.' });
  } else if (telefono.length !== 10) {
    errors.push({ field: 'telefono', message: 'El teléfono debe contener 10 dígitos.' });
  }

  // RF 5.1.14: opcional; es el destino de la confirmación de cita.
  if (correo && (correo.length > 100 || !CORREO_REGEX.test(correo))) {
    errors.push({ field: 'correo', message: 'Ingresa un correo electrónico válido.' });
  }

  return {
    errors,
    data: {
      nombre_completo,
      curp,
      sexo,
      fecha_nacimiento: fechaNacimiento,
      telefono,
      correo: correo || null,
    },
  };
}
