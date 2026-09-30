export interface UserData {
  id?: number | string;
  nombres?: string;
  apellido_paterno?: string;
  apellido_materno?: string;
  nombre?: string;
  apellido?: string;
  nombre_completo?: string;
  correo?: string;
  correo_electronico?: string;
  rol?: string;
}

/**
 * Obtiene estrictamente el Primer Nombre y el Primer Apellido del usuario.
 * Soporta estructuras con campos separados (nombres, apellido_paterno), nombre_completo o strings planos.
 * Ejemplos:
 * - "Alejandro Pech" -> "Alejandro Pech"
 * - "Alejandro Pech Canché" -> "Alejandro Pech"
 * - "Alejandro Enrique Pech Canché" -> "Alejandro Pech"
 * - { nombres: "Alejandro", apellido_paterno: "Pech" } -> "Alejandro Pech"
 */
export function formatUserDisplayName(user: UserData | string | null | undefined): string {
  if (!user) return '';

  if (typeof user === 'string') {
    user = { nombre_completo: user };
  }

  // 1. Estructura con nombres y apellido_paterno (secretaria.sql)
  if (user.nombres && (user.apellido_paterno || user.apellido)) {
    const firstName = user.nombres.trim().split(/\s+/)[0];
    const lastName = (user.apellido_paterno || user.apellido || '').trim().split(/\s+/)[0];
    return `${firstName} ${lastName}`.trim();
  }

  // 2. Estructura con nombre y apellido
  if (user.nombre && user.apellido) {
    const firstName = user.nombre.trim().split(/\s+/)[0];
    const lastName = user.apellido.trim().split(/\s+/)[0];
    return `${firstName} ${lastName}`.trim();
  }

  // 3. Cadena completa (nombre_completo o nombre)
  const raw = (user.nombre_completo || user.nombre || '').trim();
  if (!raw) return '';

  const cleanTokens = raw
    .split(/\s+/)
    .filter(t => !/^(dr|dra|lic|psic|mtro|mtra)\.?$/i.test(t));

  if (cleanTokens.length === 0) return raw;
  if (cleanTokens.length === 1) return cleanTokens[0];
  if (cleanTokens.length === 2) return `${cleanTokens[0]} ${cleanTokens[1]}`;

  const firstName = cleanTokens[0];

  // Si tiene 3 palabras (Ej: Alejandro Pech Canché) -> Alejandro Pech
  if (cleanTokens.length === 3) {
    return `${firstName} ${cleanTokens[1]}`;
  }

  // Si tiene 4 palabras (Ej: Alejandro Enrique Pech Canché) -> Alejandro Pech
  if (cleanTokens.length === 4) {
    return `${firstName} ${cleanTokens[2]}`;
  }

  return `${firstName} ${cleanTokens[1]}`;
}

/**
 * Calcula las iniciales (2 letras mayúsculas) a partir del nombre mostrado
 */
export function getInitials(displayName: string): string {
  const parts = displayName.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  if (parts[0] && parts[0].length >= 2) {
    return parts[0].substring(0, 2).toUpperCase();
  }
  return parts[0] ? parts[0].toUpperCase() : 'SU';
}
