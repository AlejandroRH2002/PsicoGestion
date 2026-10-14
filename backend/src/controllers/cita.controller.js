import { validateCita, validateListado, validateDisponibilidadSemana, parseId } from '../validators/cita.validators.js';
import {
  crearCita,
  actualizarCita,
  cancelarCita,
  obtenerCita,
  listarCitas,
  disponibilidadSemana,
  CitaNotFoundError,
  ReferenciaInvalidaError,
  ConflictError,
} from '../services/cita.service.js';

function manejarError(err, res, next) {
  if (err instanceof ConflictError) return res.status(409).json({ errors: [{ field: err.field, message: err.message }] });
  if (err instanceof ReferenciaInvalidaError) return res.status(400).json({ errors: [{ field: err.field, message: err.message }] });
  if (err instanceof CitaNotFoundError) return res.status(404).json({ error: err.message });
  return next(err);
}

export async function listar(req, res, next) {
  const { errors, data } = validateListado(req.query);
  if (errors.length) return res.status(400).json({ errors });
  try {
    return res.json(await listarCitas(data));
  } catch (err) {
    return next(err);
  }
}

export async function disponibilidad(req, res, next) {
  const { errors, data } = validateDisponibilidadSemana(req.query);
  if (errors.length) return res.status(400).json({ errors });
  try {
    return res.json(await disponibilidadSemana(data));
  } catch (err) {
    return manejarError(err, res, next);
  }
}

export async function obtener(req, res, next) {
  const id = parseId(req.params.id);
  if (!id) return res.status(404).json({ error: 'Cita no encontrada.' });
  try {
    return res.json({ cita: await obtenerCita(id) });
  } catch (err) {
    return manejarError(err, res, next);
  }
}

export async function registrar(req, res, next) {
  const { errors, data } = validateCita(req.body);
  if (errors.length) return res.status(400).json({ errors });
  try {
    const cita = await crearCita(data);
    return res.status(201).json({ message: 'Cita agendada correctamente.', cita });
  } catch (err) {
    return manejarError(err, res, next);
  }
}

export async function actualizar(req, res, next) {
  const id = parseId(req.params.id);
  if (!id) return res.status(404).json({ error: 'Cita no encontrada.' });
  const { errors, data } = validateCita(req.body, { edicion: true });
  if (errors.length) return res.status(400).json({ errors });
  try {
    const cita = await actualizarCita(id, data);
    return res.json({ message: 'Cambios guardados correctamente.', cita });
  } catch (err) {
    return manejarError(err, res, next);
  }
}

export async function cancelar(req, res, next) {
  const id = parseId(req.params.id);
  if (!id) return res.status(404).json({ error: 'Cita no encontrada.' });
  try {
    const cita = await cancelarCita(id);
    return res.json({ message: 'Cita cancelada correctamente.', cita });
  } catch (err) {
    return manejarError(err, res, next);
  }
}
