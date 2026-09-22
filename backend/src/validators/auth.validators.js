const EMAIL_UADY_REGEX = /^[^\s@]+@(correo\.uady\.mx|uady\.mx)$/i;
const SPECIAL_CHAR_REGEX = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?~`]/;

export function normalizeCorreo(correo) {
  return typeof correo === 'string' ? correo.trim().toLowerCase() : '';
}

export function normalizeTelefono(telefono) {
  return typeof telefono === 'string' ? telefono.replace(/\D/g, '') : '';
}

function isPasswordValid(password) {
  if (typeof password !== 'string') return false;
  const hasLength = password.length >= 8 && password.length <= 25;
  const hasNumber = /\d/.test(password);
  const hasUpper = /[A-Z]/.test(password);
  const hasSpecial = SPECIAL_CHAR_REGEX.test(password);
  return hasLength && hasNumber && hasUpper && hasSpecial;
}

/**
 * RF 1.1.3, 1.1.5, 1.1.7-1.1.8, 1.1.13-1.1.18 (specs/01-autenticacion/spec.md).
 * Devuelve { errors, data } — data solo trae los campos normalizados válidos para insertar.
 */
export function validateRegistration(body = {}) {
  const errors = [];

  const nombre = typeof body.nombre === 'string' ? body.nombre.trim() : '';
  const telefono = normalizeTelefono(body.telefono);
  const correo = normalizeCorreo(body.correo);
  const password = typeof body.password === 'string' ? body.password : '';
  const confirmPassword = typeof body.confirmPassword === 'string' ? body.confirmPassword : '';

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

  if (!correo) {
    errors.push({ field: 'correo', message: 'El correo institucional es obligatorio.' });
  } else if (correo.length > 100 || !EMAIL_UADY_REGEX.test(correo)) {
    errors.push({ field: 'correo', message: 'El correo debe terminar en @correo.uady.mx o @uady.mx.' });
  }

  if (!isPasswordValid(password)) {
    errors.push({
      field: 'password',
      message: 'La contraseña debe tener entre 8 y 25 caracteres, con al menos 1 número, 1 mayúscula y 1 carácter especial.',
    });
  }

  if (password !== confirmPassword) {
    errors.push({ field: 'confirmPassword', message: 'Las contraseñas no coinciden.' });
  }

  return {
    errors,
    data: { nombre, telefono, correo, password },
  };
}

/** RF 1.2.1-1.2.2 (specs/01-autenticacion/spec.md). */
export function validateLogin(body = {}) {
  const errors = [];

  const correo = normalizeCorreo(body.correo);
  const password = typeof body.password === 'string' ? body.password : '';
  const recordar = body.recordar === true;

  if (!correo) {
    errors.push({ field: 'correo', message: 'El correo es obligatorio.' });
  }
  if (!password) {
    errors.push({ field: 'password', message: 'La contraseña es obligatoria.' });
  }

  return {
    errors,
    data: { correo, password, recordar },
  };
}
