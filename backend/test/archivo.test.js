import { test } from 'node:test';
import assert from 'node:assert/strict';
import { detectarTipoArchivo } from '../src/utils/archivo.js';
import { png, jpeg, gif } from './imagenes-de-prueba.js';

test('reconoce PDF, JPG y PNG por su cabecera', () => {
  assert.equal(detectarTipoArchivo(Buffer.from('%PDF-1.7\n...')), 'pdf');
  assert.equal(detectarTipoArchivo(jpeg(10, 10)), 'jpg');
  assert.equal(detectarTipoArchivo(png(10, 10)), 'png');
});

test('rechaza formatos no permitidos o contenido falso', () => {
  assert.equal(detectarTipoArchivo(gif(10, 10)), null);
  assert.equal(detectarTipoArchivo(Buffer.from('no soy un pdf')), null);
  assert.equal(detectarTipoArchivo(Buffer.from('%PDF')), null);
  assert.equal(detectarTipoArchivo(Buffer.alloc(0)), null);
  assert.equal(detectarTipoArchivo(undefined), null);
});
