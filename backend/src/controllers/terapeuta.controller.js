import { validateTerapeuta } from '../validators/terapeuta.validators.js';
import { validarFotoPerfil } from '../utils/imagen.js';
import { registrarTerapeuta } from '../services/terapeuta.service.js';
import { ConflictError } from '../services/auth.service.js';

/** RF 2.1.1-2.1.13: alta de terapeuta (multipart/form-data, foto opcional en el campo "foto"). */
export async function registrar(req, res, next) {
  try {
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

    if (errors.length > 0) {
      return res.status(400).json({ errors });
    }

    const terapeuta = await registrarTerapeuta(data, foto);
    return res.status(201).json({ message: 'Terapeuta registrado correctamente.', terapeuta });
  } catch (err) {
    if (err instanceof ConflictError) {
      return res.status(409).json({ errors: [{ field: err.field, message: err.message }] });
    }
    return next(err);
  }
}
