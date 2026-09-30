import { validateTerapeuta } from '../validators/terapeuta.validators.js';
import {
  createTerapeuta,
  getTerapeutas,
  getTerapeutaById,
  ConflictError,
} from '../services/terapeuta.service.js';

export async function create(req, res, next) {
  try {
    const { errors, data } = validateTerapeuta(req.body);
    if (errors.length > 0) {
      return res.status(400).json({ errors });
    }

    const terapeuta = await createTerapeuta(data);
    return res.status(201).json({
      message: 'Terapeuta registrado correctamente.',
      terapeuta,
    });
  } catch (err) {
    if (err instanceof ConflictError) {
      return res.status(409).json({ errors: [{ field: err.field, message: err.message }] });
    }
    return next(err);
  }
}

export async function list(req, res, next) {
  try {
    const terapeutas = await getTerapeutas();
    return res.status(200).json({ terapeutas });
  } catch (err) {
    return next(err);
  }
}

export async function getById(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: 'ID de terapeuta inválido.' });
    }

    const terapeuta = await getTerapeutaById(id);
    if (!terapeuta) {
      return res.status(404).json({ error: 'Terapeuta no encontrado.' });
    }

    return res.status(200).json({ terapeuta });
  } catch (err) {
    return next(err);
  }
}
