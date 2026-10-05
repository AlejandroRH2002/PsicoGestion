import { test } from 'node:test';
import assert from 'node:assert/strict';

const { validatePaciente, parsePacienteId } = await import('../src/validators/paciente.validators.js');

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
