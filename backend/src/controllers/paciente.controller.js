import {
  validatePaciente,
  parsePacienteId,
  validateBusquedaPacientes,
} from '../validators/paciente.validators.js';
import {
  createPaciente,
  getPacientes,
  getPacienteById,
  updatePaciente,
  buscarPacientes,
  ConflictError,
} from '../services/paciente.service.js';

export async function create(req, res, next) {
  try {
    const { errors, data } = validatePaciente(req.body);
    if (errors.length > 0) {
      return res.status(400).json({ errors });
    }

    const paciente = await createPaciente(data);
    return res.status(201).json({
      message: 'Paciente registrado correctamente.',
      paciente,
    });
  } catch (err) {
    if (err instanceof ConflictError) {
      return res.status(409).json({ errors: [{ field: err.field, message: err.message }] });
    }
    return next(err);
  }
}

export async function list(req, res, next) {
  if (Object.prototype.hasOwnProperty.call(req.query ?? {}, 'q')) {
    return buscar(req, res, next);
  }

  try {
    const pacientes = await getPacientes();
    return res.status(200).json({ pacientes });
  } catch (err) {
    return next(err);
  }
}

/** Atiende la búsqueda rápida sin sustituir el listado general de pacientes. */
export async function buscar(req, res, next) {
  const { errors, data } = validateBusquedaPacientes(req.query);
  if (errors.length > 0) {
    return res.status(400).json({ errors });
  }

  if (!data.buscar) {
    return res.status(200).json({ pacientes: [] });
  }

  try {
    const pacientes = await buscarPacientes(data.q);
    return res.status(200).json({ pacientes });
  } catch (err) {
    return next(err);
  }
}

export async function getById(req, res, next) {
  try {
    const id = parsePacienteId(req.params.id);
    if (!id) {
      return res.status(400).json({ error: 'ID de paciente inválido.' });
    }

    const paciente = await getPacienteById(id);
    if (!paciente) {
      return res.status(404).json({ error: 'Paciente no encontrado.' });
    }

    return res.status(200).json({ paciente });
  } catch (err) {
    return next(err);
  }
}

export async function update(req, res, next) {
  try {
    const id = parsePacienteId(req.params.id);
    if (!id) {
      return res.status(400).json({ error: 'ID de paciente inválido.' });
    }

    const { errors, data } = validatePaciente(req.body);
    if (errors.length > 0) {
      return res.status(400).json({ errors });
    }

    const paciente = await updatePaciente(id, data);
    if (!paciente) {
      return res.status(404).json({ error: 'Paciente no encontrado.' });
    }

    return res.status(200).json({
      message: 'Paciente actualizado correctamente.',
      paciente,
    });
  } catch (err) {
    if (err instanceof ConflictError) {
      return res.status(409).json({ errors: [{ field: err.field, message: err.message }] });
    }
    return next(err);
  }
}
