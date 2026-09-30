// Cabeceras mínimas de imagen: image-size solo lee la cabecera para obtener tipo y dimensiones.

/** PNG: firma + chunk IHDR con ancho y alto. */
export function png(ancho, alto) {
  const buf = Buffer.alloc(8 + 8 + 13 + 4);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(buf, 0);
  buf.writeUInt32BE(13, 8);
  buf.write('IHDR', 12, 'ascii');
  buf.writeUInt32BE(ancho, 16);
  buf.writeUInt32BE(alto, 20);
  buf.writeUInt8(8, 24); // profundidad de bits
  buf.writeUInt8(6, 25); // RGBA
  return buf;
}

/** JPEG: SOI + APP0 (JFIF) + SOF0 con alto y ancho. */
export function jpeg(ancho, alto) {
  const app0 = Buffer.from([
    0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00,
  ]);
  const sof0 = Buffer.alloc(19);
  sof0.writeUInt16BE(0xffc0, 0);
  sof0.writeUInt16BE(17, 2);
  sof0.writeUInt8(8, 4);
  sof0.writeUInt16BE(alto, 5);
  sof0.writeUInt16BE(ancho, 7);
  sof0.writeUInt8(3, 9);
  return Buffer.concat([Buffer.from([0xff, 0xd8]), app0, sof0, Buffer.from([0xff, 0xd9])]);
}

/** GIF: formato no aceptado (RNF 2.1.3). */
export function gif(ancho, alto) {
  const buf = Buffer.alloc(13);
  buf.write('GIF89a', 0, 'ascii');
  buf.writeUInt16LE(ancho, 6);
  buf.writeUInt16LE(alto, 8);
  return buf;
}
