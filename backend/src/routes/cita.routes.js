import { Router } from 'express';
import { requireAuth } from '../middleware/requireAuth.js';
import {
  actualizar,
  cancelar,
  detalle,
  disponibilidad,
  listar,
  registrar,
  salas,
} from '../controllers/cita.controller.js';

export const citaRouter = Router();

citaRouter.use(requireAuth);
citaRouter.get('/', listar);
citaRouter.get('/salas', salas);
citaRouter.get('/disponibilidad', disponibilidad);
citaRouter.get('/:id', detalle);
citaRouter.post('/', registrar);
citaRouter.put('/:id', actualizar);
citaRouter.patch('/:id/cancelar', cancelar);
citaRouter.delete('/:id', cancelar);

