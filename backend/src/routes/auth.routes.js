import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import {
  register,
  login,
  me,
  logout,
  recoverRequest,
  recoverVerify,
  recoverReset,
} from '../controllers/auth.controller.js';
import { requireAuth } from '../middleware/requireAuth.js';

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiados intentos. Intenta de nuevo en unos minutos.' },
});

export const authRouter = Router();

authRouter.post('/register', authLimiter, register);
authRouter.post('/login', authLimiter, login);
// Sin authLimiter: /me se consulta en cada página de la app.
authRouter.get('/me', requireAuth, me);
authRouter.post('/logout', logout);
authRouter.post('/recover/request', authLimiter, recoverRequest);
authRouter.post('/recover/verify', authLimiter, recoverVerify);
authRouter.post('/recover/reset', authLimiter, recoverReset);
