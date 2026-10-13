import { imageSize } from 'image-size';

export const ARCHIVO_MAX_BYTES = 5 * 1024 * 1024;
export const ARCHIVOS_MAX = 10;
export const TIPOS_ARCHIVO = ['application/pdf', 'image/jpeg', 'image/png'];

export const CONTENT_TYPE = { pdf: 'application/pdf', jpg: 'image/jpeg', png: 'image/png' };

const FIRMA_PDF = Buffer.from('%PDF-', 'ascii');
const EXTENSIONES_IMAGEN = { jpg: 'jpg', png: 'png' };

/**
 * Tipo real de un adjunto del paciente leyendo su cabecera (no la extensión ni el mimetype).
 * Devuelve 'pdf' | 'jpg' | 'png', o null si no es un formato permitido.
 */
export function detectarTipoArchivo(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) return null;
  if (buffer.subarray(0, FIRMA_PDF.length).equals(FIRMA_PDF)) return 'pdf';
  try {
    return EXTENSIONES_IMAGEN[imageSize(buffer).type] ?? null;
  } catch {
    return null;
  }
}
