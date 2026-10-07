import { test } from 'node:test';
import assert from 'node:assert/strict';

const { validatePaciente, parsePacienteId } = await import('../src/validators/paciente.validators.js');

// Una sola captura de reloj para toda la suite; ninguna fecha usa la zona local.
const hoy = new Date();
hoy.setUTCHours(0, 0, 0, 0);
function fechaTexto(fecha) {
  return `${String(fecha.getUTCDate()).padStart(2, '0')}/${String(fecha.getUTCMonth() + 1).padStart(2, '0')}/${fecha.getUTCFullYear()}`;
}
function fechaHaceAnios(referencia, anios) {
  const anio = referencia.getUTCFullYear() - anios;
  const mes = referencia.getUTCMonth();
  const ultimoDia = new Date(Date.UTC(anio, mes + 1, 0)).getUTCDate();
  return new Date(Date.UTC(anio, mes, Math.min(referencia.getUTCDate(), ultimoDia)));
}
const limiteSiete = fechaHaceAnios(hoy, 7);
const nacimientoDemasiadoReciente = new Date(limiteSiete);
nacimientoDemasiadoReciente.setUTCDate(nacimientoDemasiadoReciente.getUTCDate() + 1);
const manana = new Date(hoy);
manana.setUTCDate(manana.getUTCDate() + 1);
const esBisiesto = (anio) => new Date(Date.UTC(anio, 1, 29)).getUTCMonth() === 1;
let anioReferenciaBisiesto = hoy.getUTCFullYear();
while (!esBisiesto(anioReferenciaBisiesto - 7)) anioReferenciaBisiesto += 1;
let anioNoBisiesto = hoy.getUTCFullYear() - 10;
while (esBisiesto(anioNoBisiesto)) anioNoBisiesto -= 1;

const pacienteValido = {
  nombre_completo: 'Luis García',
  curp: 'GACL960101HDFRLS09',
  sexo: 'M',
  fecha_nacimiento: '01/01/1996',
  telefono: '999 123 4567',
};

test('acepta un paciente válido y normaliza los datos', () => {
  const { errors, data } = validatePaciente(pacienteValido, { hoy });
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
  const { errors } = validatePaciente({}, { hoy });
  assert.deepEqual(errors.map((e) => e.field).sort(), ['curp', 'fecha_nacimiento', 'nombre_completo', 'sexo', 'telefono']);
});

test('rechaza CURP con formato inválido', () => {
  const { errors } = validatePaciente({ ...pacienteValido, curp: 'ABC123' }, { hoy });
  assert.equal(errors[0].field, 'curp');
});

test('rechaza teléfonos no numéricos o con longitud incorrecta', () => {
  assert.equal(validatePaciente({ ...pacienteValido, telefono: '999-123-456' }, { hoy }).errors[0].field, 'telefono');
  assert.equal(validatePaciente({ ...pacienteValido, telefono: '99912345678' }, { hoy }).errors[0].field, 'telefono');
});

test('fecha de nacimiento debe tener formato válido y ser anterior a la fecha actual', () => {
  assert.equal(validatePaciente({ ...pacienteValido, fecha_nacimiento: '1996-01-01' }, { hoy }).errors[0].field, 'fecha_nacimiento');
  assert.equal(validatePaciente({ ...pacienteValido, fecha_nacimiento: fechaTexto(hoy) }, { hoy }).errors[0].field, 'fecha_nacimiento');
});

test('parsePacienteId: solo acepta enteros positivos', () => {
  assert.equal(parsePacienteId('12'), 12);
  for (const invalido of ['0', '-1', 'abc', '1.5', '', undefined]) {
    assert.equal(parsePacienteId(invalido), null, String(invalido));
  }
});

test('edad: acepta siete años cumplidos en la fecha de referencia', () => {
  const { errors } = validatePaciente(
    { ...pacienteValido, fecha_nacimiento: fechaTexto(limiteSiete) },
    { hoy }
  );
  assert.deepEqual(errors, []);
});

test('edad: rechaza un día antes de cumplir siete años', () => {
  const { errors } = validatePaciente(
    { ...pacienteValido, fecha_nacimiento: fechaTexto(nacimientoDemasiadoReciente) },
    { hoy }
  );
  assert.ok(errors.some(({ field }) => field === 'fecha_nacimiento'));
});

test('edad: nacido el 29 de febrero aún no cumple siete el 28 de febrero', () => {
  const { errors } = validatePaciente(
    { ...pacienteValido, fecha_nacimiento: `29/02/${anioReferenciaBisiesto - 7}` },
    { hoy: new Date(Date.UTC(anioReferenciaBisiesto, 1, 28)) }
  );
  assert.ok(errors.some(({ field }) => field === 'fecha_nacimiento'));
});

test('edad: nacido el 29 de febrero ya cumplió siete el 1 de marzo', () => {
  const { errors } = validatePaciente(
    { ...pacienteValido, fecha_nacimiento: `29/02/${anioReferenciaBisiesto - 7}` },
    { hoy: new Date(Date.UTC(anioReferenciaBisiesto, 2, 1)) }
  );
  assert.deepEqual(errors, []);
});

test('fecha: rechaza el 29 de febrero de un año no bisiesto', () => {
  const { errors } = validatePaciente(
    { ...pacienteValido, fecha_nacimiento: `29/02/${anioNoBisiesto}` },
    { hoy }
  );
  assert.equal(errors[0]?.field, 'fecha_nacimiento');
});

test('fecha: rechaza una fecha futura', () => {
  const { errors } = validatePaciente(
    { ...pacienteValido, fecha_nacimiento: fechaTexto(manana) },
    { hoy }
  );
  assert.equal(errors[0]?.field, 'fecha_nacimiento');
});
