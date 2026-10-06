const CURP_REGEX = /^[A-Z0-9]{18}$/;

export const CURP_VALIDATION_STATUS = Object.freeze({
  VALID: 'VALID',
  REQUIRED: 'REQUIRED',
  INVALID_FORMAT: 'INVALID_FORMAT',
});

/** Conserva caracteres internos para que la validación los rechace en lugar de corregirlos. */
export function normalizarCurp(value) {
  return typeof value === 'string' ? value.trim().toUpperCase() : '';
}

/** Valida el formato mínimo acordado, sin intentar reproducir el algoritmo oficial de CURP. */
export function validarCurp(value) {
  const curp = normalizarCurp(value);

  if (!curp) {
    return {
      status: CURP_VALIDATION_STATUS.REQUIRED,
      curp,
      errors: [{ field: 'curp', message: 'La CURP es obligatoria.' }],
    };
  }

  if (!CURP_REGEX.test(curp)) {
    return {
      status: CURP_VALIDATION_STATUS.INVALID_FORMAT,
      curp,
      errors: [{ field: 'curp', message: 'La CURP debe tener exactamente 18 caracteres alfanuméricos.' }],
    };
  }

  return {
    status: CURP_VALIDATION_STATUS.VALID,
    curp,
    errors: [],
  };
}
