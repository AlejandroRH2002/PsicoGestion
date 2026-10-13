import { test } from 'node:test';
import assert from 'node:assert/strict';

const { validatePaciente, validateListado, parsePacienteId } = await import('../src/validators/paciente.validators.js');

const pacienteValido = {
  nombre_completo: 'Luis García',
  curp: 'GACL960101HDFRLS09',
  sexo: 'M',
  fecha_nacimiento: '01/01/1996',
  telefono: '999 123 4567',
};

test('acepta un paciente válido y normaliza los datos', () => {
  const { errors, data } = validatePaciente(pacienteValido, { hoy: new Date(2026, 0, 1) });
  assert.deepEqual(errors, []);
  assert.deepEqual(data, {
    nombre_completo: 'Luis García',
    curp: 'GACL960101HDFRLS09',
    sexo: 'M',
    fecha_nacimiento: '1996-01-01',
    telefono: '9991234567',
  });
});

test('exige campos obligatorios del paciente', () => {
  const { errors } = validatePaciente({}, { hoy: new Date(2026, 0, 1) });
  assert.deepEqual(errors.map((e) => e.field).sort(), ['curp', 'fecha_nacimiento', 'nombre_completo', 'sexo', 'telefono']);
});

test('rechaza CURP con formato inválido', () => {
  const { errors } = validatePaciente({ ...pacienteValido, curp: 'ABC123' }, { hoy: new Date(2026, 0, 1) });
  assert.equal(errors[0].field, 'curp');
});

test('rechaza teléfonos no numéricos o con longitud incorrecta', () => {
  assert.equal(validatePaciente({ ...pacienteValido, telefono: '999-123-456' }, { hoy: new Date(2026, 0, 1) }).errors[0].field, 'telefono');
  assert.equal(validatePaciente({ ...pacienteValido, telefono: '99912345678' }, { hoy: new Date(2026, 0, 1) }).errors[0].field, 'telefono');
});

test('fecha de nacimiento debe tener formato válido y ser anterior a la fecha actual', () => {
  assert.equal(validatePaciente({ ...pacienteValido, fecha_nacimiento: '1996-01-01' }, { hoy: new Date(2026, 0, 1) }).errors[0].field, 'fecha_nacimiento');
  assert.equal(validatePaciente({ ...pacienteValido, fecha_nacimiento: '01/01/2026' }, { hoy: new Date(2026, 0, 1) }).errors[0].field, 'fecha_nacimiento');
});

test('parsePacienteId: solo acepta enteros positivos', () => {
  assert.equal(parsePacienteId('12'), 12);
  for (const invalido of ['0', '-1', 'abc', '1.5', '', undefined]) {
    assert.equal(parsePacienteId(invalido), null, String(invalido));
  }
});

test('exige una edad mínima de 7 años cumplidos (RF 3.1.9)', () => {
  const hoy = new Date(Date.UTC(2026, 5, 15));
  const conFecha = (fecha_nacimiento) => validatePaciente({ ...pacienteValido, fecha_nacimiento }, { hoy }).errors;
  assert.deepEqual(conFecha('15/06/2019'), []);
  assert.deepEqual(conFecha('16/06/2019'), [
    { field: 'fecha_nacimiento', message: 'El paciente debe tener al menos 7 años cumplidos.' },
  ]);
});

test('validateListado: estado y orden con valores predeterminados', () => {
  assert.deepEqual(validateListado({}), { estado: 'activos', orden: 'nombre' });
  assert.deepEqual(validateListado({ estado: 'todos', orden: 'registro' }), { estado: 'todos', orden: 'registro' });
  assert.deepEqual(validateListado({ estado: 'x', orden: ['nombre'] }), { estado: 'activos', orden: 'nombre' });
});
