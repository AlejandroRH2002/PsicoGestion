import { verifySessionToken } from '../utils/jwt.js';

/** Exige la cookie de sesión de una secretaria; deja req.usuario = { id, correo }. */
export function requireAuth(req, res, next) {
  const token = req.cookies?.session;
  if (!token) {
    return res.status(401).json({ error: 'Debes iniciar sesión.' });
  }

  try {
    const payload = verifySessionToken(token);
    req.usuario = { id: payload.sub, correo: payload.correo };
    return next();
  } catch {
    return res.status(401).json({ error: 'Tu sesión expiró. Inicia sesión de nuevo.' });
  }
}
