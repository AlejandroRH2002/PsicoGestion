import { validateSala, validateDisponibilidad, parseSalaId } from '../validators/sala.validators.js';
import { registrarSala, listarSalas, consultarDisponibilidad, SalaNotFoundError } from '../services/sala.service.js';
import { ConflictError } from '../services/auth.service.js';

function manejarError(err, res, next) {
  if (err instanceof ConflictError) return res.status(409).json({ errors: [{ field: err.field, message: err.message }] });
  if (err instanceof SalaNotFoundError) return res.status(404).json({ error: err.message });
  return next(err);
}

export async function registrar(req, res, next) {
  const { errors, data } = validateSala(req.body);
  if (errors.length) return res.status(400).json({ errors });
  try {
    const sala = await registrarSala(data);
    return res.status(201).json({ message: 'Sala registrada correctamente.', sala });
  } catch (err) {
    return manejarError(err, res, next);
  }
}

export async function listar(req, res, next) {
  try {
    return res.json({ salas: await listarSalas() });
  } catch (err) {
    return next(err);
  }
}

async function disponibilidad(req, res, next, salaId = null) {
  const { errors, data } = validateDisponibilidad(req.query);
  if (errors.length) return res.status(400).json({ errors });
  try {
    return res.json(await consultarDisponibilidad({ ...data, salaId }));
  } catch (err) {
    return manejarError(err, res, next);
  }
}

export function consultarTodas(req, res, next) {
  return disponibilidad(req, res, next);
}

export function consultarUna(req, res, next) {
  const id = parseSalaId(req.params.id);
  if (!id) return res.status(404).json({ error: 'Sala no encontrada.' });
  return disponibilidad(req, res, next, id);
}

