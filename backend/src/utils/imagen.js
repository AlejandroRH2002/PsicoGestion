import { imageSize } from 'image-size';

export const FOTO_MAX_BYTES = 5 * 1024 * 1024; // RNF 2.1.3
export const FOTO_MIN_LADO = 200; // RF 2.1.11-2.1.13

const EXTENSIONES = { jpg: 'jpg', png: 'png' };

/**
 * Valida la foto de perfil leyendo su cabecera real (no la extensión ni el mimetype).
 * Devuelve { error } si no es válida, o { extension } lista para guardar el archivo.
 */
export function validarFotoPerfil(buffer) {
  let info;
  try {
    info = imageSize(buffer);
  } catch {
    return { error: 'La foto debe ser una imagen JPG o PNG.' };
  }

  const extension = EXTENSIONES[info.type];
  if (!extension) {
    return { error: 'La foto debe ser una imagen JPG o PNG.' };
  }
  if (info.width < FOTO_MIN_LADO || info.height < FOTO_MIN_LADO) {
    return { error: `La foto debe medir al menos ${FOTO_MIN_LADO}x${FOTO_MIN_LADO} px.` };
  }
  return { extension };
}
