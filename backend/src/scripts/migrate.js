import { pool } from '../db/pool.js';
import { aplicarMigraciones } from '../db/migraciones.js';

async function run() {
  const client = await pool.connect();
  try {
    const aplicadas = await aplicarMigraciones(client, { log: console.log });
    if (aplicadas.length === 0) {
      console.log('No hay migraciones pendientes.');
    } else {
      console.log(`Migraciones aplicadas: ${aplicadas.length}.`);
    }
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
