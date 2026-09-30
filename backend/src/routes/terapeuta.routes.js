import { Router } from 'express';
import { create, list, getById } from '../controllers/terapeuta.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';

export const terapeutaRouter = Router();

// Todas las rutas de gestión de terapeutas requieren inicio de sesión activo
terapeutaRouter.use(requireAuth);

terapeutaRouter.post('/', create);
terapeutaRouter.get('/', list);
terapeutaRouter.get('/:id', getById);

