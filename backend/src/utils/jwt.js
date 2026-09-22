import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

const REMEMBER_EXPIRES_IN = '30d';
const DEFAULT_EXPIRES_IN = '1d';

export function signSessionToken({ id, correo }, { recordar = false } = {}) {
  return jwt.sign({ sub: id, correo }, env.jwtSecret, {
    expiresIn: recordar ? REMEMBER_EXPIRES_IN : DEFAULT_EXPIRES_IN,
  });
}

export function verifySessionToken(token) {
  return jwt.verify(token, env.jwtSecret);
}

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export function sessionCookieOptions({ recordar = false } = {}) {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.nodeEnv === 'production',
    // Sin maxAge => cookie de sesión (se borra al cerrar el navegador) cuando no se pide "recordar".
    ...(recordar ? { maxAge: THIRTY_DAYS_MS } : {}),
  };
}
