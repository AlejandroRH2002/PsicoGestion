import './setup-env.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { png, jpeg, gif } from './imagenes-de-prueba.js';

const { validarFotoPerfil } = await import('../src/utils/imagen.js');

// RF 2.1.11-2.1.13 (SPEC.md § 4: 199x199 rechaza, 200x200 acepta).
test('rechaza una foto de 199x199 px', () => {
  assert.match(validarFotoPerfil(png(199, 199)).error, /200x200/);
  assert.match(validarFotoPerfil(jpeg(199, 199)).error, /200x200/);
});

test('acepta una foto de 200x200 px', () => {
  assert.deepEqual(validarFotoPerfil(png(200, 200)), { extension: 'png' });
  assert.deepEqual(validarFotoPerfil(jpeg(200, 200)), { extension: 'jpg' });
});

test('rechaza si solo un lado mide menos de 200 px', () => {
  assert.ok(validarFotoPerfil(png(1000, 199)).error);
  assert.ok(validarFotoPerfil(jpeg(199, 1000)).error);
});

// RNF 2.1.3: solo JPEG y PNG, detectados por su contenido.
test('rechaza formatos distintos de JPG o PNG', () => {
  assert.match(validarFotoPerfil(gif(500, 500)).error, /JPG o PNG/);
});

test('rechaza un archivo que no es imagen', () => {
  assert.match(validarFotoPerfil(Buffer.from('no soy una imagen')).error, /JPG o PNG/);
});
