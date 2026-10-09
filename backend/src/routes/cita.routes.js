import { Router } from 'express';
import { requireAuth } from '../middleware/requireAuth.js';
import { disponibilidad, registrar, salas } from '../controllers/cita.controller.js';

export const citaRouter = Router();

citaRouter.use(requireAuth);
citaRouter.get('/salas', salas);
citaRouter.get('/disponibilidad', disponibilidad);
citaRouter.post('/', registrar);
