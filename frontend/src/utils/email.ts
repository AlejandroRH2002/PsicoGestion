// Dominios institucionales permitidos (RF 1.1.7).
const UADY_DOMAINS = ['correo.uady.mx', 'uady.mx'];

// Dominios extra solo para pruebas locales, separados por comas (ej. PUBLIC_EXTRA_EMAIL_DOMAINS=alumnos.uady.mx).
// Deben coincidir con EXTRA_EMAIL_DOMAINS del backend.
const EXTRA_DOMAINS = (import.meta.env.PUBLIC_EXTRA_EMAIL_DOMAINS ?? '')
  .split(',')
  .map((d: string) => d.trim().toLowerCase())
  .filter(Boolean);

const ALLOWED_DOMAINS = [...UADY_DOMAINS, ...EXTRA_DOMAINS];

export function isUadyEmail(email: string): boolean {
  const normalized = email.trim().toLowerCase();
  return ALLOWED_DOMAINS.some((domain) => normalized.endsWith(`@${domain}`));
}
