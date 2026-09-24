import 'dotenv/config';

function required(name, fallback) {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    throw new Error(`Falta la variable de entorno ${name}. Revisa backend/.env (usa .env.example como referencia).`);
  }
  return value;
}

export const env = {
  port: Number(process.env.PORT ?? 3001),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  databaseUrl: required('DATABASE_URL'),
  jwtSecret: required('JWT_SECRET'),
  frontendOrigin: process.env.FRONTEND_ORIGIN ?? 'http://localhost:4321',
  // Dominios de correo aceptados además de los institucionales, separados por comas (solo pruebas locales).
  extraEmailDomains: (process.env.EXTRA_EMAIL_DOMAINS ?? '')
    .split(',')
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean),
  // Sin SMTP_HOST, en desarrollo el correo se imprime en consola en lugar de enviarse.
  smtp: {
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    from: process.env.SMTP_FROM ?? 'PsicoGestión UADY <no-reply@psicogestion.local>',
  },
};

export const isProduction = env.nodeEnv === 'production';
