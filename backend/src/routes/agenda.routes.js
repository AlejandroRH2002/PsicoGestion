import { Router } from 'express';
import { requireAuth } from '../middleware/requireAuth.js';
import { consultar } from '../controllers/agenda.controller.js';

export const agendaRouter = Router();
agendaRouter.use(requireAuth);
agendaRouter.get('/', consultar);
