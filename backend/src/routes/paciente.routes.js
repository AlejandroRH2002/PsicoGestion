import { Router } from 'express';
import { create, list, getById, update } from '../controllers/paciente.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';

export const pacienteRouter = Router();

// Todas las rutas de gestión de pacientes requieren inicio de sesión activo
pacienteRouter.use(requireAuth);

pacienteRouter.post('/', create);
pacienteRouter.get('/', list);
pacienteRouter.get('/:id', getById);
pacienteRouter.put('/:id', update);
