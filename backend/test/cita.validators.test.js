import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  validateCita,
  validateListado,
  validateDisponibilidadSemana,
  lunesDe,
  sumarDias,
  parseFolio,
} from '../src/validators/cita.validators.js';
import { calcularRejilla } from '../src/services/cita.service.js';
import { redactarConfirmacion } from '../src/utils/notificador.js';

// Martes 13 de octubre de 2026, 10:15 hora local.
const AHORA = new Date(2026, 9, 13, 10, 15);
const valida = { pacienteId: 1, terapeutaId: '2', salaId: 3, fecha: '2026-10-14', horaInicio: '09:30', duracion: 60 };
const campos = (r) => r.errors.map((e) => e.field);

describe('validateCita', () => {
  test('acepta una cita válida y fija el estado en Pendiente al crear', () => {
    const r = validateCita({ ...valida, estado: 'Cancelada' }, { ahora: AHORA });
    assert.deepEqual(r.errors, []);
    assert.equal(r.data.estado, 'Pendiente');
    assert.equal(r.data.terapeutaId, 2);
  });

  test('exige paciente, terapeuta, sala, fecha, hora y duración', () => {
    assert.deepEqual(campos(validateCita({}, { ahora: AHORA })).sort(),
      ['duracion', 'fecha', 'horaInicio', 'pacienteId', 'salaId', 'terapeutaId']);
  });

  test('rechaza fines de semana', () => {
    assert.deepEqual(campos(validateCita({ ...valida, fecha: '2026-10-17' }, { ahora: AHORA })), ['fecha']);
  });

  test('solo admite inicios en la rejilla de 30 min dentro de 07:00–17:00', () => {
    for (const horaInicio of ['09:15', '06:30', '17:00']) {
      assert.deepEqual(campos(validateCita({ ...valida, horaInicio }, { ahora: AHORA })), ['horaInicio'], horaInicio);
    }
    assert.deepEqual(validateCita({ ...valida, horaInicio: '07:00' }, { ahora: AHORA }).errors, []);
    assert.deepEqual(validateCita({ ...valida, horaInicio: '16:30', duracion: 30 }, { ahora: AHORA }).errors, []);
  });

  test('la cita debe terminar a más tardar a las 17:00', () => {
    assert.deepEqual(campos(validateCita({ ...valida, horaInicio: '16:30', duracion: 60 }, { ahora: AHORA })), ['duracion']);
  });

  test('solo admite duraciones de 30, 60 o 90 minutos', () => {
    assert.deepEqual(campos(validateCita({ ...valida, duracion: 45 }, { ahora: AHORA })), ['duracion']);
    assert.deepEqual(validateCita({ ...valida, duracion: '90' }, { ahora: AHORA }).errors, []);
  });

  test('no permite agendar en el pasado', () => {
    assert.deepEqual(campos(validateCita({ ...valida, fecha: '2026-10-12' }, { ahora: AHORA })), ['horaInicio']);
    assert.deepEqual(campos(validateCita({ ...valida, fecha: '2026-10-13', horaInicio: '10:00' }, { ahora: AHORA })), ['horaInicio']);
    assert.deepEqual(validateCita({ ...valida, fecha: '2026-10-13', horaInicio: '10:30' }, { ahora: AHORA }).errors, []);
  });

  test('al editar exige un estatus válido y permite cancelar una cita pasada', () => {
    assert.deepEqual(campos(validateCita({ ...valida, estado: 'Otra' }, { edicion: true, ahora: AHORA })), ['estado']);
    const r = validateCita({ ...valida, fecha: '2026-10-12', estado: 'Cancelada' }, { edicion: true, ahora: AHORA });
    assert.deepEqual(r.errors, []);
    assert.equal(r.data.estado, 'Cancelada');
  });
});

describe('filtros y semana', () => {
  test('validateListado ignora filtros inválidos y valida la fecha de referencia', () => {
    const r = validateListado({ q: '  Ana ', estado: 'X', periodo: 'año', page: '0', salaId: 'abc' }, { ahora: AHORA });
    assert.deepEqual(r.data, { q: 'Ana', estado: null, salaId: null, terapeutaId: null, periodo: null, fecha: '2026-10-13', page: 1 });
    assert.deepEqual(campos(validateListado({ fecha: '2026-02-30' })), ['fecha']);
  });

  test('validateDisponibilidadSemana normaliza al lunes y exige terapeuta', () => {
    const r = validateDisponibilidadSemana({ terapeutaId: '4', semana: '2026-10-18' }, { ahora: AHORA });
    assert.deepEqual(r.data, { terapeutaId: 4, lunes: '2026-10-12', duracion: 60, excluirCitaId: null });
    assert.deepEqual(campos(validateDisponibilidadSemana({ duracion: '20' })), ['terapeutaId', 'duracion']);
  });

  test('lunesDe y sumarDias cruzan meses', () => {
    assert.equal(lunesDe('2026-11-01'), '2026-10-26');
    assert.equal(sumarDias('2026-10-30', 3), '2026-11-02');
  });
});

describe('calcularRejilla', () => {
  const salas = [{ id: 1, nombre: 'Sala 1' }, { id: 2, nombre: 'Sala 2' }];
  const base = { lunes: '2026-10-19', duracion: 60, terapeutaId: 7, salas, ahora: AHORA };
  const slot = (dias, fecha, hora) => dias.find((d) => d.fecha === fecha).slots.find((s) => s.horaInicio === hora);

  test('genera 5 días × 20 slots y marca como fuera los que no caben antes de las 17:00', () => {
    const dias = calcularRejilla({ ...base, ocupaciones: [] });
    assert.equal(dias.length, 5);
    assert.ok(dias.every((d) => d.slots.length === 20));
    assert.equal(slot(dias, '2026-10-19', '16:30').estado, 'fuera');
    assert.equal(slot(dias, '2026-10-19', '16:00').estado, 'disponible');
  });

  test('el terapeuta ocupado bloquea el slot aunque haya salas libres', () => {
    const ocupaciones = [{ terapeutaId: 7, salaId: 9, fecha: '2026-10-19', horaInicio: '10:00', horaFin: '10:30' }];
    const dias = calcularRejilla({ ...base, ocupaciones });
    assert.deepEqual([slot(dias, '2026-10-19', '09:30').motivo, slot(dias, '2026-10-19', '10:00').motivo], ['terapeuta', 'terapeuta']);
    assert.equal(slot(dias, '2026-10-19', '09:00').estado, 'disponible');
    assert.equal(slot(dias, '2026-10-19', '10:30').estado, 'disponible');
  });

  test('lista solo las salas libres y marca ocupado cuando no queda ninguna', () => {
    const ocupaciones = [
      { terapeutaId: 1, salaId: 1, fecha: '2026-10-20', horaInicio: '08:00', horaFin: '09:00' },
      { terapeutaId: 2, salaId: 2, fecha: '2026-10-20', horaInicio: '08:30', horaFin: '09:00' },
    ];
    const dias = calcularRejilla({ ...base, ocupaciones });
    assert.equal(slot(dias, '2026-10-20', '08:00').motivo, 'salas');
    assert.deepEqual(slot(dias, '2026-10-20', '07:00').salasLibres.map((s) => s.id), [1, 2]);
    assert.deepEqual(slot(dias, '2026-10-20', '07:30').salasLibres.map((s) => s.id), [2]);
  });

  test('marca como pasados los slots anteriores al momento actual', () => {
    const dias = calcularRejilla({ ...base, lunes: '2026-10-12', ocupaciones: [] });
    assert.equal(slot(dias, '2026-10-12', '15:00').estado, 'pasado');
    assert.equal(slot(dias, '2026-10-13', '10:00').estado, 'pasado');
    assert.equal(slot(dias, '2026-10-13', '10:30').estado, 'disponible');
  });
});

describe('parseFolio (RF 5.4.2)', () => {
  test('normaliza mayúsculas y espacios; rechaza otros formatos', () => {
    assert.equal(parseFolio(' cit-2026-00012 '), 'CIT-2026-00012');
    assert.equal(parseFolio('CIT-2026-123456'), 'CIT-2026-123456');
    for (const valor of ['', 'CIT-26-00001', 'CIT-2026-1234', 'XYZ-2026-00001', 'CIT-2026-00001x', undefined]) {
      assert.equal(parseFolio(valor), null, String(valor));
    }
  });
});

describe('redactarConfirmacion (RF 5.1.14)', () => {
  test('incluye nombre, fecha y hora, folio, terapeuta y sala', () => {
    const cita = {
      folio: 'CIT-2026-00007', estado: 'Pendiente', fecha: '2026-10-14', horaInicio: '09:30', horaFin: '10:30',
      paciente: { nombre: 'Ana Canul' }, terapeuta: { nombre: 'Luis Pech' }, sala: { nombre: 'Sala 3' },
    };
    const { asunto, texto } = redactarConfirmacion('agendada', cita);
    assert.match(asunto, /CIT-2026-00007/);
    for (const fragmento of ['Ana Canul', 'miércoles 14 de octubre de 2026', '09:30 a 10:30', 'CIT-2026-00007', 'Luis Pech', 'Sala 3']) {
      assert.ok(texto.includes(fragmento), fragmento);
    }
  });
});
