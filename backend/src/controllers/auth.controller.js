import { validateRegistration, validateLogin } from '../validators/auth.validators.js';
import {
  registerSecretaria,
  loginSecretaria,
  ConflictError,
  InvalidCredentialsError,
} from '../services/auth.service.js';
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
