import { Router } from 'express';
import multer from 'multer';
import { create, list, getById, update } from '../controllers/paciente.controller.js';
import { requireAuth } from '../middleware/requireAuth.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB máx por archivo
});

function parsearArchivos(req, res, next) {
  upload.any()(req, res, (err) => {
    if (!err) return next();
    if (err instanceof multer.MulterError) {
      const message =
        err.code === 'LIMIT_FILE_SIZE'
          ? 'Los archivos no pueden pesar más de 5 MB.'
          : 'Error al procesar los archivos adjuntos.';
      return res.status(400).json({ errors: [{ field: 'archivos', message }] });
    }
    return next(err);
  });
}

export const pacienteRouter = Router();

// Todas las rutas de gestión de pacientes requieren inicio de sesión activo
pacienteRouter.use(requireAuth);

pacienteRouter.get('/', list);
pacienteRouter.post('/', parsearArchivos, create);
pacienteRouter.get('/:id', getById);
pacienteRouter.put('/:id', parsearArchivos, update);

