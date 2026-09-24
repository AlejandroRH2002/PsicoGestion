import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pool } from '../db/pool.js';
import { env } from '../config/env.js';
import { sendMail } from '../utils/mailer.js';

export const CODE_LENGTH = 6;
const CODE_SALT_ROUNDS = 10;
const PASSWORD_SALT_ROUNDS = 12;
const CODE_TTL_MINUTES = 10;
const RESEND_COOLDOWN_SECONDS = 30;
const MAX_ATTEMPTS = 5;
const RESET_TOKEN_EXPIRES_IN = '15m';
const RESET_TOKEN_PURPOSE = 'password-reset';

export class InvalidCodeError extends Error {
  constructor(message = 'El código es incorrecto o ha expirado. Solicita uno nuevo.') {
    super(message);
  }
}

export class InvalidResetTokenError extends Error {
  constructor() {
    super('La solicitud de recuperación expiró. Vuelve a solicitar un código.');
  }
}

function generateCode() {
  return crypto.randomInt(0, 10 ** CODE_LENGTH).toString().padStart(CODE_LENGTH, '0');
}

// Huella del hash actual: el token de restablecimiento deja de servir en cuanto cambia la contraseña,
// así cada token se puede usar una sola vez sin guardarlo en la base de datos.
function passwordFingerprint(passwordHash) {
  return crypto.createHash('sha256').update(passwordHash).digest('hex').slice(0, 16);
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

function buildEmail(nombre, code) {
  const text = [
    `Hola ${nombre},`,
    '',
    `Tu código para recuperar tu contraseña de PsicoGestión UADY es: ${code}`,
    '',
    `El código expira en ${CODE_TTL_MINUTES} minutos. Si no solicitaste este cambio, ignora este correo.`,
  ].join('\n');

  const html = `
    <div style="font-family: Manrope, Arial, sans-serif; color: #0F172A; max-width: 480px; margin: 0 auto;">
      <h2 style="color: #006847;">Recupera tu contraseña</h2>
      <p>Hola ${escapeHtml(nombre)},</p>
      <p>Usa el siguiente código para recuperar tu contraseña de <strong>PsicoGestión UADY</strong>:</p>
      <p style="font-size: 28px; font-weight: 700; letter-spacing: 8px; color: #0D9488; text-align: center; background: #F4F7F6; border-radius: 8px; padding: 16px;">
        ${code}
      </p>
      <p style="color: #64748B; font-size: 13px;">
        El código expira en ${CODE_TTL_MINUTES} minutos. Si no solicitaste este cambio, ignora este correo.
      </p>
    </div>`;

  return { subject: `Tu código de recuperación: ${code}`, text, html };
}

/**
 * RF 1.4: genera y envía un código de verificación al correo registrado.
 * Nunca revela si la cuenta existe: el controlador responde igual en todos los casos.
 */
export async function requestRecoveryCode({ correo }) {
  const { rows } = await pool.query(
    'SELECT id_secretaria, nombre_completo, correo_electronico FROM secretaria WHERE correo_electronico = $1',
    [correo]
  );
  if (rows.length === 0) return;

  const secretaria = rows[0];

  const recent = await pool.query(
    `SELECT 1 FROM codigo_recuperacion
     WHERE id_secretaria = $1 AND creado_en > NOW() - make_interval(secs => $2)`,
    [secretaria.id_secretaria, RESEND_COOLDOWN_SECONDS]
  );
  if (recent.rows.length > 0) return;

  const code = generateCode();
  const codeHash = await bcrypt.hash(code, CODE_SALT_ROUNDS);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Solo el último código enviado es válido.
    await client.query(
      'UPDATE codigo_recuperacion SET usado_en = NOW() WHERE id_secretaria = $1 AND usado_en IS NULL',
      [secretaria.id_secretaria]
    );
    await client.query(
      `INSERT INTO codigo_recuperacion (id_secretaria, codigo_hash, expira_en)
       VALUES ($1, $2, NOW() + make_interval(mins => $3))`,
      [secretaria.id_secretaria, codeHash, CODE_TTL_MINUTES]
    );
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  const email = buildEmail(secretaria.nombre_completo, code);
  // Sin await: el tiempo de respuesta no debe delatar si la cuenta existe.
  sendMail({ to: secretaria.correo_electronico, ...email }).catch((err) => {
    console.error('No se pudo enviar el correo de recuperación:', err);
  });
}

/** RF 1.4: valida el código y, si es correcto, entrega un token temporal para cambiar la contraseña. */
export async function verifyRecoveryCode({ correo, codigo }) {
  const { rows } = await pool.query(
    `SELECT c.id_codigo, c.codigo_hash, c.intentos, s.id_secretaria, s.password_hash
     FROM codigo_recuperacion c
     JOIN secretaria s ON s.id_secretaria = c.id_secretaria
     WHERE s.correo_electronico = $1 AND c.usado_en IS NULL AND c.expira_en > NOW()
     ORDER BY c.creado_en DESC
     LIMIT 1`,
    [correo]
  );

  if (rows.length === 0) throw new InvalidCodeError();

  const row = rows[0];
  if (row.intentos >= MAX_ATTEMPTS) {
    throw new InvalidCodeError('Superaste el número de intentos. Solicita un código nuevo.');
  }

  const matches = await bcrypt.compare(codigo, row.codigo_hash);
  if (!matches) {
    await pool.query('UPDATE codigo_recuperacion SET intentos = intentos + 1 WHERE id_codigo = $1', [row.id_codigo]);
    throw new InvalidCodeError('El código es incorrecto.');
  }

  await pool.query('UPDATE codigo_recuperacion SET usado_en = NOW() WHERE id_codigo = $1', [row.id_codigo]);

  return jwt.sign(
    { sub: row.id_secretaria, purpose: RESET_TOKEN_PURPOSE, pwh: passwordFingerprint(row.password_hash) },
    env.jwtSecret,
    { expiresIn: RESET_TOKEN_EXPIRES_IN }
  );
}

/** RNF 1.4.4: la nueva contraseña se guarda únicamente como hash. */
export async function resetPassword({ token, password }) {
  let payload;
  try {
    payload = jwt.verify(token, env.jwtSecret);
  } catch {
    throw new InvalidResetTokenError();
  }
  if (payload.purpose !== RESET_TOKEN_PURPOSE) throw new InvalidResetTokenError();

  const { rows } = await pool.query('SELECT password_hash FROM secretaria WHERE id_secretaria = $1', [payload.sub]);
  if (rows.length === 0 || passwordFingerprint(rows[0].password_hash) !== payload.pwh) {
    throw new InvalidResetTokenError();
  }

  const passwordHash = await bcrypt.hash(password, PASSWORD_SALT_ROUNDS);
  await pool.query('UPDATE secretaria SET password_hash = $1 WHERE id_secretaria = $2', [passwordHash, payload.sub]);
}
