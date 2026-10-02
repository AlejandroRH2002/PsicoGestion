export const API_URL = import.meta.env.PUBLIC_API_URL ?? 'http://localhost:3001';

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
