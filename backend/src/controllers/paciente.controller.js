import {
  validatePaciente,
  validateListado,
  parsePacienteId,
  validateBusquedaPacientes,
} from '../validators/paciente.validators.js';
import { detectarTipoArchivo, CONTENT_TYPE } from '../utils/archivo.js';
import { rutaEnDisco } from '../utils/almacenamiento.js';
import {
  registrarPaciente,
  listarPacientes,
  obtenerPaciente,
  actualizarPaciente,
  cambiarEstado,
  obtenerArchivo,
  buscarPacientes,
  ConflictError,
  NotFoundError,
  SinArchivosError,
} from '../services/paciente.service.js';

/**
 * Valida los campos del formulario y cada adjunto por su contenido real.
 * Compartido por registro y edición; `exigirArchivo` solo aplica al registro.
 */
function validarFormulario(req, { exigirArchivo }) {
  const { errors, data } = validatePaciente(req.body);

  const archivos = [];
  for (const file of req.files ?? []) {
    const tipo = detectarTipoArchivo(file.buffer);
    if (!tipo) {
      errors.push({ field: 'archivos', message: `El archivo "${file.originalname}" no es un PDF, JPG o PNG válido.` });
      break;
    }
    archivos.push({ buffer: file.buffer, tipo, nombre: file.originalname.slice(0, 255), tamano: file.size });
  }

  if (exigirArchivo && (req.files ?? []).length === 0) {
    errors.push({ field: 'archivos', message: 'Debes adjuntar al menos un archivo (PDF, JPG o PNG).' });
  }

  return { errors, data, archivos };
}

/** Ids de adjuntos a quitar en la edición: "quitarArchivos" puede repetirse o venir separado por comas. */
function parseQuitarArchivos(valor) {
  const lista = Array.isArray(valor) ? valor : typeof valor === 'string' ? valor.split(',') : [];
  return [...new Set(lista.map((v) => parsePacienteId(v)).filter(Boolean))];
}

function manejarError(err, res, next) {
  if (err instanceof ConflictError) {
    return res.status(409).json({ errors: [{ field: err.field, message: err.message }] });
  }
  if (err instanceof SinArchivosError) {
    return res.status(400).json({ errors: [{ field: err.field, message: err.message }] });
  }
  if (err instanceof NotFoundError) {
    return res.status(404).json({ error: err.message });
  }
  return next(err);
}

function noEncontrado(res) {
  return res.status(404).json({ error: new NotFoundError().message });
}

/** RF 3.1.1-3.1.12: alta de paciente (multipart/form-data, al menos un adjunto en "archivos"). */
export async function create(req, res, next) {
  try {
    const { errors, data, archivos } = validarFormulario(req, { exigirArchivo: true });
    if (errors.length > 0) {
      return res.status(400).json({ errors });
    }

    const paciente = await registrarPaciente(data, archivos);
    return res.status(201).json({ message: 'Paciente registrado correctamente.', paciente });
  } catch (err) {
    return manejarError(err, res, next);
  }
}

/** RF 3.2.1: GET /pacientes?estado=activos|inactivos|todos&orden=nombre|registro, o ?q= para la búsqueda rápida. */
export async function list(req, res, next) {
  if (Object.prototype.hasOwnProperty.call(req.query ?? {}, 'q')) {
    return buscar(req, res, next);
  }

  try {
    const pacientes = await listarPacientes(validateListado(req.query));
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

/** RF 3.2.2-3.2.3: ficha del paciente. */
export async function getById(req, res, next) {
  const id = parsePacienteId(req.params.id);
  if (!id) return noEncontrado(res);
  try {
    const paciente = await obtenerPaciente(id);
    return res.status(200).json({ paciente });
  } catch (err) {
    return manejarError(err, res, next);
  }
}

/** RF 3.2.4-3.2.6: edición con las mismas validaciones que el registro; adjuntos opcionales. */
export async function update(req, res, next) {
  const id = parsePacienteId(req.params.id);
  if (!id) return noEncontrado(res);
  try {
    const { errors, data, archivos } = validarFormulario(req, { exigirArchivo: false });
    if (errors.length > 0) {
      return res.status(400).json({ errors });
    }

    const paciente = await actualizarPaciente(id, data, {
      archivosNuevos: archivos,
      quitarArchivos: parseQuitarArchivos(req.body.quitarArchivos),
    });
    return res.status(200).json({ message: 'Cambios guardados correctamente.', paciente });
  } catch (err) {
    return manejarError(err, res, next);
  }
}

/** RF 3.3.1-3.3.3: baja lógica / reactivación con PATCH /pacientes/:id/estado y { activo: boolean }. */
export async function cambiarEstadoPaciente(req, res, next) {
  const id = parsePacienteId(req.params.id);
  if (!id) return noEncontrado(res);
  if (typeof req.body?.activo !== 'boolean') {
    return res.status(400).json({ errors: [{ field: 'activo', message: 'El estado debe ser verdadero o falso.' }] });
  }
  try {
    const paciente = await cambiarEstado(id, req.body.activo);
    const message = paciente.activo ? 'Paciente reactivado.' : 'Paciente dado de baja.';
    return res.status(200).json({ message, paciente });
  } catch (err) {
    return manejarError(err, res, next);
  }
}

/** RNF 3.2.7: los adjuntos solo se descargan con sesión, nunca desde /uploads. */
export async function descargarArchivo(req, res, next) {
  const id = parsePacienteId(req.params.id);
  const idArchivo = parsePacienteId(req.params.idArchivo);
  if (!id || !idArchivo) return res.status(404).json({ error: 'Archivo no encontrado.' });
  try {
    const archivo = await obtenerArchivo(id, idArchivo);
    res.set('X-Content-Type-Options', 'nosniff');
    res.type(CONTENT_TYPE[archivo.tipo]);
    res.attachment(archivo.nombre);
    return res.sendFile(rutaEnDisco(archivo.ruta), (err) => {
      if (err && !res.headersSent) res.status(404).json({ error: 'Archivo no encontrado.' });
    });
  } catch (err) {
    return manejarError(err, res, next);
  }
}
