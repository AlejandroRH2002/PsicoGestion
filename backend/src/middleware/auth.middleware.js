import { verifySessionToken } from '../utils/jwt.js';

export function requireAuth(req, res, next) {
  const token = req.cookies?.session;

  if (!token) {
    return res.status(401).json({ error: 'No autorizado. Debes iniciar sesión.' });
  }

  try {
    const payload = verifySessionToken(token);
    req.user = payload;
    return next();
  } catch (err) {
    return res.status(401).json({ error: 'Sesión inválida o expirada. Por favor ingresa nuevamente.' });
  }
}
