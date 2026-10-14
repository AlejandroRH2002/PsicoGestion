import { Router } from 'express';
import { requireAuth } from '../middleware/requireAuth.js';
import { registrar, listar, consultarTodas, consultarUna } from '../controllers/sala.controller.js';

export const salaRouter = Router();
salaRouter.use(requireAuth);
salaRouter.get('/', listar);
salaRouter.post('/', registrar);
salaRouter.get('/disponibilidad', consultarTodas);
salaRouter.get('/:id/disponibilidad', consultarUna);

