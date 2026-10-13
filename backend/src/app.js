import path from 'node:path';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { env } from './config/env.js';
import { authRouter } from './routes/auth.routes.js';
import { pacienteRouter } from './routes/paciente.routes.js';
import { terapeutaRouter } from './routes/terapeuta.routes.js';
import { notFoundHandler, errorHandler } from './middleware/errorHandler.js';

export const app = express();

app.use(
  cors({
    origin: env.frontendOrigin,
    credentials: true,
  })
);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

app.get('/health', (req, res) => res.json({ ok: true }));

app.use('/auth', authRouter);
app.use('/pacientes', pacienteRouter);
app.use('/terapeutas', terapeutaRouter);
// Solo las fotos de terapeutas son públicas. Los adjuntos de pacientes (UPLOADS_DIR/pacientes) son
// datos clínicos y se descargan únicamente por GET /pacientes/:id/archivos/:idArchivo (RNF 3.2.7).
app.use('/uploads/terapeutas', express.static(path.join(env.uploadsDir, 'terapeutas')));

app.use(notFoundHandler);
app.use(errorHandler);
