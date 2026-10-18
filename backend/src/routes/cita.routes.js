import { Router } from 'express';
import { requireAuth } from '../middleware/requireAuth.js';
import { listar, disponibilidad, obtener, obtenerPorFolio, registrar, actualizar, cancelar } from '../controllers/cita.controller.js';

export const citaRouter = Router();
citaRouter.use(requireAuth);
citaRouter.get('/', listar);
citaRouter.post('/', registrar);
citaRouter.get('/disponibilidad', disponibilidad);
citaRouter.get('/folio/:folio', obtenerPorFolio);
citaRouter.get('/:id', obtener);
citaRouter.put('/:id', actualizar);
citaRouter.patch('/:id/cancelar', cancelar);
