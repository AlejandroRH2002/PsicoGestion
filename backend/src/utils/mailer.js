import nodemailer from 'nodemailer';
import { env, isProduction } from '../config/env.js';

function createTransport() {
  if (env.smtp.host) {
    return nodemailer.createTransport({
      host: env.smtp.host,
      port: env.smtp.port,
      secure: env.smtp.secure,
      auth: env.smtp.user ? { user: env.smtp.user, pass: env.smtp.pass } : undefined,
    });
  }

  if (isProduction) {
    throw new Error('Falta la variable de entorno SMTP_HOST para enviar correos en producción.');
  }

  // Desarrollo sin SMTP: no se envía nada, el correo se imprime en consola.
  return nodemailer.createTransport({ jsonTransport: true });
}

const transporter = createTransport();

// Avisa al arrancar si las credenciales SMTP no sirven, en lugar de enterarse al primer envío.
if (env.smtp.host) {
  transporter
    .verify()
    .then(() => console.log(`[mailer] Conexión SMTP lista (${env.smtp.host} como ${env.smtp.user}).`))
    .catch((err) => console.error(`[mailer] No se pudo conectar a ${env.smtp.host}: ${err.message}`));
}

export async function sendMail({ to, subject, text, html }) {
  const info = await transporter.sendMail({ from: env.smtp.from, to, subject, text, html });

  if (!env.smtp.host) {
    console.log(`[mailer] SMTP no configurado; correo para ${to}:\n${text}`);
  }

  return info;
}
