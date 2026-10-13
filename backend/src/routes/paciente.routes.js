import { Router } from 'express';
import multer from 'multer';
import {
  create,
  list,
  getById,
  update,
  cambiarEstadoPaciente,
  descargarArchivo,
} from '../controllers/paciente.controller.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { ARCHIVO_MAX_BYTES, ARCHIVOS_MAX, TIPOS_ARCHIVO } from '../utils/archivo.js';

// En memoria: cada adjunto se valida por su contenido real antes de escribirse en disco.
const upload = multer({
  storage: multer.memoryStorage(),
  // Los navegadores envían el nombre del archivo en UTF-8 ("identificación.pdf").
  defParamCharset: 'utf8',
  limits: { fileSize: ARCHIVO_MAX_BYTES, files: ARCHIVOS_MAX },
  fileFilter: (req, file, cb) => {
    if (TIPOS_ARCHIVO.includes(file.mimetype)) return cb(null, true);
    return cb(new multer.MulterError('LIMIT_UNEXPECTED_FILE', file.fieldname));
  },
});

const MENSAJES_MULTER = {
  LIMIT_FILE_SIZE: 'Los archivos no pueden pesar más de 5 MB.',
  LIMIT_FILE_COUNT: `No puedes adjuntar más de ${ARCHIVOS_MAX} archivos a la vez.`,
};

/** Convierte los errores de multer al formato { errors: [{ field, message }] } del resto de la API. */
function subirArchivos(req, res, next) {
  upload.array('archivos', ARCHIVOS_MAX)(req, res, (err) => {
    if (!err) return next();
    if (err instanceof multer.MulterError) {
      const message = MENSAJES_MULTER[err.code] ?? 'Solo se aceptan archivos PDF, JPG o PNG.';
      return res.status(400).json({ errors: [{ field: 'archivos', message }] });
    }
    return next(err);
  });
}

export const pacienteRouter = Router();

// Todas las rutas de gestión de pacientes requieren inicio de sesión activo
pacienteRouter.use(requireAuth);

pacienteRouter.get('/', list);
pacienteRouter.post('/', subirArchivos, create);
pacienteRouter.get('/:id', getById);
pacienteRouter.put('/:id', subirArchivos, update);
pacienteRouter.patch('/:id/estado', cambiarEstadoPaciente);
pacienteRouter.get('/:id/archivos/:idArchivo', descargarArchivo);
