import './setup-env.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const { validateTerapeuta } = await import('../src/validators/terapeuta.validators.js');

const HOY = new Date(2026, 8, 30); // 30/09/2026

const valido = {
  nombre: 'María García López',
  telefono: '999 123 4567',
  fechaNacimiento: '15/03/1990',
  correo: '  Maria.Garcia@Correo.UADY.mx ',
  cedula: '12345678',
};

function erroresDe(cambios) {
  const { errors } = validateTerapeuta({ ...valido, ...cambios }, { hoy: HOY });
  return errors.map((e) => e.field);
}

test('acepta un registro válido y normaliza los datos', () => {
  const { errors, data } = validateTerapeuta(valido, { hoy: HOY });
  assert.deepEqual(errors, []);
  assert.deepEqual(data, {
    nombre: 'María García López',
    telefono: '9991234567',
    correo: 'maria.garcia@correo.uady.mx',
    fechaNacimiento: '1990-03-15',
    cedula: '12345678',
  });
});

test('exige todos los campos obligatorios', () => {
  const { errors } = validateTerapeuta({}, { hoy: HOY });
  assert.deepEqual(errors.map((e) => e.field).sort(), ['cedula', 'correo', 'fechaNacimiento', 'nombre', 'telefono']);
});

// RF 2.1.3
test('nombre: 50 caracteres acepta, 51 rechaza', () => {
  assert.deepEqual(erroresDe({ nombre: 'a'.repeat(50) }), []);
  assert.deepEqual(erroresDe({ nombre: 'a'.repeat(51) }), ['nombre']);
});

test('teléfono: debe tener exactamente 10 dígitos', () => {
  assert.deepEqual(erroresDe({ telefono: '999123456' }), ['telefono']);
  assert.deepEqual(erroresDe({ telefono: '99912345678' }), ['telefono']);
  assert.deepEqual(erroresDe({ telefono: '(999) 123-4567' }), []);
});

test('correo: debe ser institucional', () => {
  assert.deepEqual(erroresDe({ correo: 'maria@gmail.com' }), ['correo']);
  assert.deepEqual(erroresDe({ correo: 'maria@uady.mx' }), []);
});

// RF 2.1.8-2.1.9
test('fecha: exige el formato dd/mm/aaaa', () => {
  assert.deepEqual(erroresDe({ fechaNacimiento: '1990-03-15' }), ['fechaNacimiento']);
  assert.deepEqual(erroresDe({ fechaNacimiento: '15/3/1990' }), ['fechaNacimiento']);
});

test('fecha: rechaza fechas inexistentes', () => {
  assert.deepEqual(erroresDe({ fechaNacimiento: '31/02/1990' }), ['fechaNacimiento']);
  assert.deepEqual(erroresDe({ fechaNacimiento: '29/02/2023' }), ['fechaNacimiento']);
  assert.deepEqual(erroresDe({ fechaNacimiento: '29/02/2024' }), []);
});

test('fecha: debe ser anterior a la fecha de registro', () => {
  assert.deepEqual(erroresDe({ fechaNacimiento: '30/09/2026' }), ['fechaNacimiento']);
  assert.deepEqual(erroresDe({ fechaNacimiento: '01/10/2026' }), ['fechaNacimiento']);
  assert.deepEqual(erroresDe({ fechaNacimiento: '29/09/2026' }), []);
});

test('cédula: 7 u 8 dígitos', () => {
  assert.deepEqual(erroresDe({ cedula: '123456' }), ['cedula']);
  assert.deepEqual(erroresDe({ cedula: '123456789' }), ['cedula']);
  assert.deepEqual(erroresDe({ cedula: '1234567' }), []);
});

const { validateListado, parseId } = await import('../src/validators/terapeuta.validators.js');

test('listado: valores por defecto y valores desconocidos', () => {
  assert.deepEqual(validateListado({}), { q: '', estado: 'activos', orden: 'nombre' });
  assert.deepEqual(validateListado({ estado: 'borrados', orden: 'edad' }), { q: '', estado: 'activos', orden: 'nombre' });
  assert.deepEqual(validateListado({ q: '  maria ', estado: 'todos', orden: 'registro' }), {
    q: 'maria',
    estado: 'todos',
    orden: 'registro',
  });
  assert.equal(validateListado({ q: 'x'.repeat(150) }).q.length, 100);
  assert.equal(validateListado({ q: ['a', 'b'] }).q, '');
});

test('parseId: solo enteros positivos', () => {
  assert.equal(parseId('12'), 12);
  for (const invalido of ['0', '-1', 'abc', '1.5', '', undefined, '1e3']) {
    assert.equal(parseId(invalido), null, String(invalido));
  }
});
