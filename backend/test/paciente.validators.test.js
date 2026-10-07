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

test('edad: acepta siete años cumplidos en la fecha de referencia', () => {
  const { errors } = validatePaciente(
    { ...pacienteValido, fecha_nacimiento: '06/10/2019' },
    { hoy: new Date('2026-10-06T12:00:00Z') }
  );
  assert.deepEqual(errors, []);
});

test('edad: rechaza un día antes de cumplir siete años', () => {
  const { errors } = validatePaciente(
    { ...pacienteValido, fecha_nacimiento: '07/10/2019' },
    { hoy: new Date('2026-10-06T12:00:00Z') }
  );
  assert.ok(errors.some(({ field }) => field === 'fecha_nacimiento'));
});

test('edad: nacido el 29 de febrero aún no cumple siete el 28 de febrero', () => {
  const { errors } = validatePaciente(
    { ...pacienteValido, fecha_nacimiento: '29/02/2016' },
    { hoy: new Date('2023-02-28T12:00:00Z') }
  );
  assert.ok(errors.some(({ field }) => field === 'fecha_nacimiento'));
});

test('edad: nacido el 29 de febrero ya cumplió siete el 1 de marzo', () => {
  const { errors } = validatePaciente(
    { ...pacienteValido, fecha_nacimiento: '29/02/2016' },
    { hoy: new Date('2023-03-01T12:00:00Z') }
  );
  assert.deepEqual(errors, []);
});

test('fecha: rechaza el 29 de febrero de un año no bisiesto', () => {
  const { errors } = validatePaciente(
    { ...pacienteValido, fecha_nacimiento: '29/02/2019' },
    { hoy: new Date('2026-10-06T12:00:00Z') }
  );
  assert.equal(errors[0]?.field, 'fecha_nacimiento');
});

test('fecha: rechaza una fecha futura', () => {
  const { errors } = validatePaciente(
    { ...pacienteValido, fecha_nacimiento: '07/10/2026' },
    { hoy: new Date('2026-10-06T12:00:00Z') }
  );
  assert.equal(errors[0]?.field, 'fecha_nacimiento');
});
