// RF 2.1.11-2.1.13, RNF 2.1.3: deben coincidir con backend/src/utils/imagen.js.
export const FOTO_MAX_BYTES = 5 * 1024 * 1024;
export const FOTO_MIN_LADO = 200;
const TIPOS_FOTO = ['image/jpeg', 'image/png'];

/** Devuelve un mensaje de error, o null si la foto es aceptable. */
export async function validarFotoPerfil(archivo: File): Promise<string | null> {
  if (!TIPOS_FOTO.includes(archivo.type)) {
    return 'La foto debe ser una imagen JPG o PNG.';
  }
  if (archivo.size > FOTO_MAX_BYTES) {
    return 'La foto no puede pesar más de 5 MB.';
  }

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(archivo);
  } catch {
    return 'No se pudo leer la imagen. Intenta con otro archivo.';
  }
  const { width, height } = bitmap;
  bitmap.close();

  if (width < FOTO_MIN_LADO || height < FOTO_MIN_LADO) {
    return `La foto debe medir al menos ${FOTO_MIN_LADO}x${FOTO_MIN_LADO} px (la seleccionada mide ${width}x${height}).`;
  }
  return null;
}
