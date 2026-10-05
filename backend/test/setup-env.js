// config/env.js exige estas variables al importarse; las pruebas unitarias no tocan la BD.
process.env.DATABASE_URL ??= 'postgres://pruebas@localhost:5434/pruebas';
process.env.JWT_SECRET ??= 'secreto-de-pruebas';
process.env.EXTRA_EMAIL_DOMAINS = '';
