import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { register, login, logout, getMe, recoverRequest, recoverVerify, recoverReset } from '../controllers/auth.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';

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
authRouter.post('/logout', logout);
authRouter.get('/me', requireAuth, getMe);
authRouter.post('/recover/request', authLimiter, recoverRequest);
authRouter.post('/recover/verify', authLimiter, recoverVerify);
authRouter.post('/recover/reset', authLimiter, recoverReset);

