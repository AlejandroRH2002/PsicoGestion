import { validateTerapeuta, validateListado, parseId } from '../validators/terapeuta.validators.js';
import { validarFotoPerfil } from '../utils/imagen.js';
import {
  registrarTerapeuta,
  listarTerapeutas,
  obtenerTerapeuta,
  actualizarTerapeuta,
  cambiarEstado,
  NotFoundError,
} from '../services/terapeuta.service.js';
import { ConflictError } from '../services/auth.service.js';

/** Valida los campos del formulario y, si llegó, la foto. Compartido por registro y edición. */
function validarFormulario(req) {
  const { errors, data } = validateTerapeuta(req.body);

  let foto = null;
  if (req.file) {
    const { error, extension } = validarFotoPerfil(req.file.buffer);
    if (error) {
      errors.push({ field: 'foto', message: error });
    } else {
      foto = { buffer: req.file.buffer, extension };
    }
  }

  return { errors, data, foto };
}

function manejarError(err, res, next) {
  if (err instanceof ConflictError) {
    return res.status(409).json({ errors: [{ field: err.field, message: err.message }] });
  }
  if (err instanceof NotFoundError) {
    return res.status(404).json({ error: err.message });
  }
  return next(err);
}

function noEncontrado(res) {
  return res.status(404).json({ error: new NotFoundError().message });
}

/** RF 2.1.1-2.1.13: alta de terapeuta (multipart/form-data, foto opcional en el campo "foto"). */
export async function registrar(req, res, next) {
  try {
    const { errors, data, foto } = validarFormulario(req);
    if (errors.length > 0) {
      return res.status(400).json({ errors });
    }

    const terapeuta = await registrarTerapeuta(data, foto);
    return res.status(201).json({ message: 'Terapeuta registrado correctamente.', terapeuta });
  } catch (err) {
    return manejarError(err, res, next);
  }
}

/** RF 2.2.1: GET /terapeutas?q=&estado=activos|inactivos|todos&orden=nombre|registro */
export async function listar(req, res, next) {
  try {
    const terapeutas = await listarTerapeutas(validateListado(req.query));
    return res.status(200).json({ terapeutas });
  } catch (err) {
    return next(err);
  }
}

/** RF 2.2.2: ficha del terapeuta. */
export async function obtener(req, res, next) {
  const id = parseId(req.params.id);
  if (!id) return noEncontrado(res);
  try {
    const terapeuta = await obtenerTerapeuta(id);
    return res.status(200).json({ terapeuta });
  } catch (err) {
    return manejarError(err, res, next);
  }
}

/** RF 2.2.3-2.2.4: edición con las mismas validaciones que el registro. "quitarFoto=1" elimina la foto. */
export async function actualizar(req, res, next) {
  const id = parseId(req.params.id);
  if (!id) return noEncontrado(res);
  try {
    const { errors, data, foto } = validarFormulario(req);
    if (errors.length > 0) {
      return res.status(400).json({ errors });
    }

    const quitarFoto = req.body.quitarFoto === '1' || req.body.quitarFoto === 'true';
    const terapeuta = await actualizarTerapeuta(id, data, { foto, quitarFoto });
    return res.status(200).json({ message: 'Cambios guardados correctamente.', terapeuta });
  } catch (err) {
    return manejarError(err, res, next);
  }
}

/** Baja lógica / reactivación: PATCH /terapeutas/:id/estado con { activo: boolean }. */
export async function cambiarEstadoTerapeuta(req, res, next) {
  const id = parseId(req.params.id);
  if (!id) return noEncontrado(res);
  if (typeof req.body?.activo !== 'boolean') {
    return res.status(400).json({ errors: [{ field: 'activo', message: 'El estado debe ser verdadero o falso.' }] });
  }
  try {
    const terapeuta = await cambiarEstado(id, req.body.activo);
    const message = terapeuta.activo ? 'Terapeuta reactivado.' : 'Terapeuta dado de baja.';
    return res.status(200).json({ message, terapeuta });
  } catch (err) {
    return manejarError(err, res, next);
  }
}
