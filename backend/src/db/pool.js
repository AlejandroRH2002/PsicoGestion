import pg from 'pg';
import { env } from '../config/env.js';

const { Pool } = pg;

export const pool = new Pool({
  connectionString: env.databaseUrl,
});

pool.on('error', (err) => {
  // Conexiones ociosas del pool que fallan en background; no deben tumbar el proceso.
  console.error('Error inesperado en el pool de PostgreSQL:', err);
});
