import { Router } from 'express';
import multer from 'multer';
import { requireAuth } from '../middleware/requireAuth.js';
import {
  registrar,
  listar,
  obtener,
  actualizar,
  cambiarEstadoTerapeuta,
} from '../controllers/terapeuta.controller.js';
import { FOTO_MAX_BYTES } from '../utils/imagen.js';

const TIPOS_FOTO = ['image/jpeg', 'image/png'];

// En memoria: la imagen se valida (tipo real y dimensiones) antes de escribirse en disco.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: FOTO_MAX_BYTES, files: 1 },
  fileFilter: (req, file, cb) => {
    if (TIPOS_FOTO.includes(file.mimetype)) return cb(null, true);
    return cb(new multer.MulterError('LIMIT_UNEXPECTED_FILE', file.fieldname));
  },
});

/** Convierte los errores de multer al formato { errors: [{ field, message }] } del resto de la API. */
function subirFoto(req, res, next) {
  upload.single('foto')(req, res, (err) => {
    if (!err) return next();
    if (err instanceof multer.MulterError) {
      const message =
        err.code === 'LIMIT_FILE_SIZE'
          ? 'La foto no puede pesar más de 5 MB.'
          : 'La foto debe ser una imagen JPG o PNG.';
      return res.status(400).json({ errors: [{ field: 'foto', message }] });
    }
    return next(err);
  });
}

export const terapeutaRouter = Router();

terapeutaRouter.use(requireAuth);

terapeutaRouter.get('/', listar);
terapeutaRouter.post('/', subirFoto, registrar);
terapeutaRouter.get('/:id', obtener);
terapeutaRouter.put('/:id', subirFoto, actualizar);
terapeutaRouter.patch('/:id/estado', cambiarEstadoTerapeuta);
