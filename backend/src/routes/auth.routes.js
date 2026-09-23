import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { register, login, recoverRequest, recoverVerify, recoverReset } from '../controllers/auth.controller.js';

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
authRouter.post('/recover/request', authLimiter, recoverRequest);
authRouter.post('/recover/verify', authLimiter, recoverVerify);
authRouter.post('/recover/reset', authLimiter, recoverReset);
