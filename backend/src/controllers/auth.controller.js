import {
  validateRegistration,
  validateLogin,
  validateRecoveryRequest,
  validateRecoveryVerify,
  validatePasswordReset,
} from '../validators/auth.validators.js';
import {
  registerSecretaria,
  loginSecretaria,
  obtenerSecretaria,
  ConflictError,
  InvalidCredentialsError,
} from '../services/auth.service.js';
import {
  CODE_LENGTH,
  requestRecoveryCode,
  verifyRecoveryCode,
  resetPassword,
  InvalidCodeError,
  InvalidResetTokenError,
} from '../services/recovery.service.js';
import { signSessionToken, sessionCookieOptions } from '../utils/jwt.js';

export async function register(req, res, next) {
  try {
    const { errors, data } = validateRegistration(req.body);
    if (errors.length > 0) {
      return res.status(400).json({ errors });
    }

    const usuario = await registerSecretaria(data);
    return res.status(201).json({
      message: 'Cuenta creada correctamente. Ya puedes iniciar sesión.',
      usuario,
    });
  } catch (err) {
    if (err instanceof ConflictError) {
      return res.status(409).json({ errors: [{ field: err.field, message: err.message }] });
    }
    return next(err);
  }
}

export async function login(req, res, next) {
  try {
    const { errors, data } = validateLogin(req.body);
    if (errors.length > 0) {
      return res.status(400).json({ errors });
    }

    const usuario = await loginSecretaria(data);
    const token = signSessionToken(usuario, { recordar: data.recordar });
    res.cookie('session', token, sessionCookieOptions({ recordar: data.recordar }));

    return res.status(200).json({ message: 'Inicio de sesión exitoso.', usuario });
  } catch (err) {
    if (err instanceof InvalidCredentialsError) {
      // RNF 1.2.2: mensaje genérico, nunca revela cuál dato falló.
      return res.status(401).json({ error: err.message });
    }
    return next(err);
  }
}

export async function me(req, res, next) {
  try {
    const usuario = await obtenerSecretaria(req.usuario.id);
    if (!usuario) {
      res.clearCookie('session', sessionCookieOptions());
      return res.status(401).json({ error: 'Tu sesión ya no es válida. Inicia sesión de nuevo.' });
    }
    return res.status(200).json({ usuario });
  } catch (err) {
    return next(err);
  }
}

export function logout(req, res) {
  res.clearCookie('session', sessionCookieOptions());
  return res.status(200).json({ message: 'Sesión cerrada.' });
}

export async function recoverRequest(req, res, next) {
  try {
    const { errors, data } = validateRecoveryRequest(req.body);
    if (errors.length > 0) {
      return res.status(400).json({ errors });
    }

    await requestRecoveryCode(data);
    // Misma respuesta exista o no la cuenta, para no revelar qué correos están registrados.
    return res.status(200).json({
      message: 'Si el correo está registrado, recibirás un código de verificación en unos momentos.',
    });
  } catch (err) {
    return next(err);
  }
}

export async function recoverVerify(req, res, next) {
  try {
    const { errors, data } = validateRecoveryVerify(req.body, CODE_LENGTH);
    if (errors.length > 0) {
      return res.status(400).json({ errors });
    }

    const resetToken = await verifyRecoveryCode(data);
    return res.status(200).json({ message: 'Código verificado correctamente.', resetToken });
  } catch (err) {
    if (err instanceof InvalidCodeError) {
      return res.status(400).json({ errors: [{ field: 'codigo', message: err.message }] });
    }
    return next(err);
  }
}

export async function recoverReset(req, res, next) {
  try {
    const { errors, data } = validatePasswordReset(req.body);
    if (errors.length > 0) {
      return res.status(400).json({ errors });
    }

    await resetPassword(data);
    return res.status(200).json({ message: 'Contraseña actualizada. Ya puedes iniciar sesión.' });
  } catch (err) {
    if (err instanceof InvalidResetTokenError) {
      return res.status(400).json({ errors: [{ field: 'token', message: err.message }] });
    }
    return next(err);
  }
}
