export const API_URL = import.meta.env.PUBLIC_API_URL ?? 'http://localhost:3001';

export const MENSAJE_SIN_CONEXION = 'No se pudo conectar con el servidor. Verifica tu conexión e intenta de nuevo.';

/**
 * Cliente común de la API: envía la cookie de sesión, redirige al login en un 401 (equivalente a
 * requireAuth) y convierte el «Failed to fetch» del navegador en un mensaje en español.
 */
export async function pedirApi(ruta: string, init: RequestInit = {}) {
  let response: Response;
  try {
    response = await fetch(`${API_URL}${ruta}`, { credentials: 'include', ...init });
  } catch {
    throw new Error(MENSAJE_SIN_CONEXION);
  }
  if (response.status === 401) {
    window.location.replace('/');
    throw new Error('Tu sesión expiró.');
  }
  const body = await response.json().catch(() => null);
  return { response, body };
}

export interface Usuario {
  id: number;
  nombre: string;
  correo: string;
}

/** Secretaria con sesión activa, o null si no hay sesión (401). Lanza si el servidor no responde. */
export async function obtenerSesion(): Promise<Usuario | null> {
  const response = await fetch(`${API_URL}/auth/me`, { credentials: 'include' });
  if (response.status === 401) return null;
  if (!response.ok) throw new Error(`GET /auth/me respondió ${response.status}`);
  const body = await response.json();
  return body.usuario as Usuario;
}

export async function cerrarSesion(): Promise<void> {
  await fetch(`${API_URL}/auth/logout`, { method: 'POST', credentials: 'include' }).catch(() => {});
}

export function iniciales(nombre: string): string {
  return nombre
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((parte) => parte[0].toUpperCase())
    .join('');
}
