// Entorno de pruebas de integración: app real contra una BD separada (TEST_DATABASE_URL).
// Las variables se fijan ANTES de importar la app, porque config/env.js las lee al importarse.
import 'dotenv/config';
import { once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import pg from 'pg';

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;

/** Motivo para omitir las pruebas de integración, o false si se pueden correr. */
export const omitir = !TEST_DATABASE_URL
  ? 'TEST_DATABASE_URL no está configurada'
  : TEST_DATABASE_URL === process.env.DATABASE_URL
    ? 'TEST_DATABASE_URL no puede ser la misma BD que DATABASE_URL (las pruebas la vacían)'
    : false;

async function crearBaseSiNoExiste() {
  const url = new URL(TEST_DATABASE_URL);
  const nombre = decodeURIComponent(url.pathname.slice(1));
  url.pathname = '/postgres';
  const admin = new pg.Client({ connectionString: url.toString() });
  await admin.connect();
  try {
    const { rowCount } = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [nombre]);
    if (rowCount === 0) await admin.query(`CREATE DATABASE "${nombre.replace(/"/g, '""')}"`);
  } finally {
    await admin.end();
  }
}

export const SECRETARIA = {
  nombre: 'Secretaria Pruebas',
  telefono: '9990000000',
  correo: 'secretaria.pruebas@uady.mx',
  password: 'Abcdef1!',
  confirmPassword: 'Abcdef1!',
};

/**
 * Crea y migra la BD de pruebas, la vacía, levanta la app en un puerto libre e inicia sesión.
 * Devuelve { api, uploadsDir, cerrar }; `api(metodo, ruta, { form, json, sinSesion, crudo })`.
 * En `form` un valor puede ser un arreglo (campo repetido); `crudo` devuelve el cuerpo como Buffer.
 */
export async function iniciarEntorno() {
  await crearBaseSiNoExiste();

  const uploadsDir = await mkdtemp(path.join(tmpdir(), 'psicogestion-pruebas-'));
  process.env.DATABASE_URL = TEST_DATABASE_URL;
  process.env.UPLOADS_DIR = uploadsDir;
  process.env.JWT_SECRET ||= 'secreto-de-pruebas';
  process.env.EXTRA_EMAIL_DOMAINS = '';

  const { pool } = await import('../../src/db/pool.js');
  const { aplicarMigraciones } = await import('../../src/db/migraciones.js');
  const client = await pool.connect();
  try {
    await aplicarMigraciones(client);
    await client.query('TRUNCATE cita_bloque, cita, bloque_horario, paciente_archivo, sala, paciente, terapeuta, codigo_recuperacion, secretaria RESTART IDENTITY CASCADE');
  } finally {
    client.release();
  }

  const { app } = await import('../../src/app.js');
  const server = app.listen(0);
  await once(server, 'listening');
  const base = `http://localhost:${server.address().port}`;

  let cookie = '';
  async function api(metodo, ruta, { form, json, sinSesion = false, crudo = false } = {}) {
    const headers = {};
    if (!sinSesion && cookie) headers.Cookie = cookie;
    let body;
    if (json !== undefined) {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify(json);
    } else if (form) {
      body = new FormData();
      for (const [clave, valores] of Object.entries(form)) {
        for (const valor of [valores].flat()) {
          if (valor instanceof File) body.append(clave, valor, valor.name);
          else if (valor instanceof Blob) body.append(clave, valor, `${clave}.${valor.type.split('/')[1]}`);
          else body.append(clave, valor);
        }
      }
    }
    const res = await fetch(`${base}${ruta}`, { method: metodo, headers, body });
    if (crudo) return { status: res.status, body: Buffer.from(await res.arrayBuffer()), headers: res.headers };
    return { status: res.status, body: await res.json().catch(() => null), headers: res.headers };
  }

  await api('POST', '/auth/register', { json: SECRETARIA });
  const login = await api('POST', '/auth/login', { json: { correo: SECRETARIA.correo, password: SECRETARIA.password } });
  cookie = /session=[^;]+/.exec(login.headers.get('set-cookie'))[0];

  async function cerrar() {
    server.close();
    await pool.end();
    await rm(uploadsDir, { recursive: true, force: true });
  }

  return { api, uploadsDir, cerrar };
}
