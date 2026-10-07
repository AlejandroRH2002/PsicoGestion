export function normalizeTelefono(telefono) {
  return typeof telefono === 'string' ? telefono.replace(/\D/g, '') : '';
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

export function validatePaciente(body = {}, options = {}) {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    return { errors: [{ field: 'body', message: 'El cuerpo de la solicitud debe ser un objeto JSON válido.' }], data: {} };
  }
  const { hoy = new Date(), fechaRegistro = null } = options;
  const errors = [];

  const nombre_completo = typeof body.nombre_completo === 'string' ? body.nombre_completo.trim() : '';
  const curp = typeof body.curp === 'string' ? body.curp.trim().toUpperCase() : '';
  const sexo = typeof body.sexo === 'string' ? body.sexo.trim().toUpperCase() : '';
  const rawFecha = typeof body.fecha_nacimiento === 'string' ? body.fecha_nacimiento.trim() : '';
  const telefono = normalizeTelefono(body.telefono);

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
      const referencia = fechaRegistro
        ? new Date(`${fechaRegistro}T00:00:00Z`)
        : new Date(hoy);
      referencia.setUTCHours(0, 0, 0, 0);

      if (Number.isNaN(birthDate.getTime())) {
        errors.push({ field: 'fecha_nacimiento', message: 'La fecha proporcionada no es válida.' });
      } else if (birthDate >= referencia) {
        errors.push({
          field: 'fecha_nacimiento',
          message: fechaRegistro
            ? 'La fecha de nacimiento debe ser anterior a la fecha de registro.'
            : 'La fecha de nacimiento debe ser anterior a la fecha actual.',
        });
      } else {
        let edad = referencia.getUTCFullYear() - birthDate.getUTCFullYear();
        if (
          referencia.getUTCMonth() < birthDate.getUTCMonth() ||
          (referencia.getUTCMonth() === birthDate.getUTCMonth() && referencia.getUTCDate() < birthDate.getUTCDate())
        ) {
          edad -= 1;
        }
        if (edad < 7) {
          errors.push({
            field: 'fecha_nacimiento',
            message: fechaRegistro
              ? 'El paciente debe tener al menos 7 años cumplidos en la fecha de registro.'
              : 'El paciente debe tener al menos 7 años cumplidos.',
          });
        }
      }
    }
  }

  if (!telefono) {
    errors.push({ field: 'telefono', message: 'El teléfono es obligatorio.' });
  } else if (telefono.length !== 10) {
    errors.push({ field: 'telefono', message: 'El teléfono debe contener 10 dígitos.' });
  }

  return {
    errors,
    data: {
      nombre_completo,
      curp,
      sexo,
      fecha_nacimiento: fechaNacimiento,
      telefono,
    },
  };
}
