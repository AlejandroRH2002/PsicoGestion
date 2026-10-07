import { randomUUID } from 'node:crypto';
import { mkdir, writeFile, unlink } from 'node:fs/promises';
import path from 'node:path';
import { env } from '../config/env.js';

/** Escribe un archivo ya validado en UPLOADS_DIR/<carpeta>/<uuid>.<extension> y devuelve su ruta relativa. */
export async function guardarArchivo(carpeta, buffer, extension) {
  const rutaRelativa = `${carpeta}/${randomUUID()}.${extension}`;
  const rutaAbsoluta = rutaEnDisco(rutaRelativa);
  await mkdir(path.dirname(rutaAbsoluta), { recursive: true });
  await writeFile(rutaAbsoluta, buffer);
  return rutaRelativa;
}

/** Borra sin fallar si el archivo ya no existe (limpieza best-effort). */
export async function borrarArchivo(rutaRelativa) {
  if (rutaRelativa) await unlink(rutaEnDisco(rutaRelativa)).catch(() => {});
}

export function rutaEnDisco(rutaRelativa) {
  return path.join(env.uploadsDir, rutaRelativa);
}
