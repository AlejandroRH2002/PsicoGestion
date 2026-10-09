import {
  crearCita,
  listarDisponibilidad,
  listarSalas,
  listarCitas,
  obtenerCitaPorId,
  actualizarCita,
  cancelarCita,
  CitaConflictError,
  CitaNotFoundError,
} from '../services/cita.service.js';
import { validateCrearCita, validateDisponibilidad } from '../validators/cita.validators.js';

function responderError(error, res, next) {
  if (error instanceof CitaConflictError) {
    return res.status(409).json({ error: error.message });
  }
  if (error instanceof CitaNotFoundError) {
    return res.status(404).json({ error: error.message });
  }
  return next(error);
}

export async function disponibilidad(req, res, next) {
  const { errors, data } = validateDisponibilidad(req.query);
  if (errors.length > 0) return res.status(400).json({ errors });

  try {
    const bloques = await listarDisponibilidad(data);
    return res.status(200).json({ bloques });
  } catch (error) {
    return next(error);
  }
}

export async function salas(req, res, next) {
  try {
    const items = await listarSalas();
    return res.status(200).json({ salas: items });
  } catch (error) {
    return next(error);
  }
}

export async function registrar(req, res, next) {
  const { errors, data } = validateCrearCita(req.body);
  if (errors.length > 0) return res.status(400).json({ errors });

  try {
    const cita = await crearCita(data);
    return res.status(201).json({ message: 'Cita agendada correctamente.', cita });
  } catch (error) {
    return responderError(error, res, next);
  }
}

export async function listar(req, res, next) {
  try {
    const resultado = await listarCitas(req.query);
    return res.status(200).json(resultado);
  } catch (error) {
    return responderError(error, res, next);
  }
}

export async function detalle(req, res, next) {
  try {
    const cita = await obtenerCitaPorId(req.params.id);
    return res.status(200).json({ cita });
  } catch (error) {
    return responderError(error, res, next);
  }
}

export async function actualizar(req, res, next) {
  try {
    const cita = await actualizarCita(req.params.id, req.body);
    return res.status(200).json({ message: 'Cita actualizada correctamente.', cita });
  } catch (error) {
    return responderError(error, res, next);
  }
}

export async function cancelar(req, res, next) {
  try {
    const resultado = await cancelarCita(req.params.id);
    return res.status(200).json({ message: 'Cita cancelada correctamente.', cita: resultado });
  } catch (error) {
    return responderError(error, res, next);
  }
}

