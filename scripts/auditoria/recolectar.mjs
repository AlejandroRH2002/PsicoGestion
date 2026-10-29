// Recolecta la evidencia para la auditoría de gestión de configuración
// (README §3, §9, §11–13, derivados del SQAP) y genera un borrador del reporte.
//
//   node scripts/auditoria/recolectar.mjs [--salida <dir>] [--sin-github]
//
// Requiere `git` y, salvo con --sin-github, `gh` autenticado. Conviene correr
// `git fetch --all --prune` antes para que las ramas remotas estén al día.
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const raiz = path.resolve(__dirname, '..', '..');

const args = process.argv.slice(2);
const sinGithub = args.includes('--sin-github');
const iSalida = args.indexOf('--salida');
const dirSalida = path.resolve(raiz, iSalida >= 0 && args[iSalida + 1] ? args[iSalida + 1] : 'docs/auditoria');

// Commit que introdujo la guía de gestión de configuración: lo anterior en
// main se considera configuración inicial del repositorio.
const COMMIT_GUIA = '6c27514';

const TIPOS_README = ['feat', 'fix', 'docs', 'test'];
const TIPOS_OTROS = ['chore', 'refactor', 'style', 'ci', 'build', 'perf'];
const RE_TIPO = /^([A-Za-z]+)(\([^)]+\))?!?: \S/;
const RE_TRAZA = /\bRN?F[ -]?\d+(\.\d+)*|PG-REQ-\d+/i;
const RE_RAMA = /^(feature|fix)\/.+$/;
const RE_RAMA_ESTILO = /^(feature|fix)\/[a-z0-9]+(-[a-z0-9]+)*$/;
const RE_MERGE_PR = /^Merge pull request #(\d+)/;

function ejecutar(cmd, cmdArgs) {
  return execFileSync(cmd, cmdArgs, { cwd: raiz, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });
}

const git = (...a) => ejecutar('git', a);
const gh = (...a) => ejecutar('gh', a);

function verificarEntorno() {
  try {
    git('rev-parse', '--is-inside-work-tree');
    git('rev-parse', '--verify', 'origin/main');
  } catch {
    console.error(`No se encontró un repositorio git con origin/main en ${raiz}.`);
    process.exit(1);
  }
  if (!sinGithub) {
    try {
      gh('auth', 'status');
    } catch {
      console.error('`gh` no está disponible o no tiene sesión. Usa `gh auth login` o ejecuta con --sin-github.');
      process.exit(1);
    }
  }
}

function nombreRepo() {
  if (!sinGithub) return JSON.parse(gh('repo', 'view', '--json', 'nameWithOwner')).nameWithOwner;
  const url = git('remote', 'get-url', 'origin').trim();
  return url.replace(/\.git$/, '').split(/[/:]/).slice(-2).join('/');
}

function sinAcentos(texto) {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

// --- Recolección -----------------------------------------------------------

function leerLog(refs) {
  const salida = git('log', ...refs, '--format=%H%x1f%P%x1f%an%x1f%ae%x1f%aI%x1f%s%x1f%b%x1e');
  return salida.split('\x1e').map((r) => r.replace(/^\n/, '')).filter(Boolean).map((r) => {
    const [hash, padres, autor, correo, fecha, asunto, cuerpo] = r.split('\x1f');
    return { hash, padres: padres.split(' ').filter(Boolean), autor, correo, fecha, asunto, cuerpo: (cuerpo || '').trim() };
  });
}

function evaluarFormato(asunto) {
  const m = asunto.match(RE_TIPO);
  if (!m) return { cumple: false, motivo: 'sin prefijo `tipo: descripción`' };
  const tipo = m[1];
  if (TIPOS_README.includes(tipo)) return { cumple: true, motivo: '' };
  if (TIPOS_README.includes(tipo.toLowerCase())) return { cumple: false, motivo: `tipo con mayúsculas (\`${tipo}\`)` };
  if (TIPOS_OTROS.includes(tipo.toLowerCase())) return { cumple: false, motivo: `tipo no definido en README (\`${tipo}\`)` };
  return { cumple: false, motivo: `tipo desconocido (\`${tipo}\`)` };
}

// --branches --remotes --tags en lugar de --all: --all incluye refs/stash.
function commits() {
  return leerLog(['--branches', '--remotes', '--tags']).map((c) => {
    const esMerge = c.padres.length > 1;
    const formato = esMerge ? null : evaluarFormato(c.asunto);
    return { ...c, esMerge, formato, trazable: RE_TRAZA.test(`${c.asunto}\n${c.cuerpo}`) };
  });
}

function esAncestro(a, b) {
  try {
    git('merge-base', '--is-ancestor', a, b);
    return true;
  } catch {
    return false;
  }
}

function historialMain() {
  return leerLog(['--first-parent', 'origin/main']).map((c) => {
    const esMerge = c.padres.length > 1;
    const pr = c.asunto.match(RE_MERGE_PR);
    let nota = '';
    if (!esMerge) {
      if (esAncestro(c.hash, COMMIT_GUIA)) nota = 'configuración inicial (antes o igual a la guía de GitHub)';
      else if (/^Add files via upload/.test(c.asunto)) nota = 'subido desde la interfaz web de GitHub';
    }
    return { ...c, esMerge, pr: pr ? Number(pr[1]) : null, nota };
  });
}

function ramas() {
  const fusionadas = new Set(git('branch', '-r', '--merged', 'origin/main').split('\n').map((l) => l.trim()).filter(Boolean));
  const salida = git('for-each-ref', 'refs/remotes/origin', '--format=%(refname:short)%1f%(committerdate:iso8601-strict)%1f%(authorname)%1f%(symref)');
  return salida.split('\n').filter(Boolean).map((l) => l.split('\x1f')).filter(([ref, , , symref]) => !symref && ref !== 'origin' && ref !== 'origin/main').map(([ref, fecha, autor]) => {
    const nombre = ref.replace(/^origin\//, '');
    return {
      nombre,
      ultimoCommit: fecha,
      autor,
      fusionada: fusionadas.has(ref),
      sufijoVersion: /-v\d+$/.test(nombre),
    };
  });
}

function prs() {
  const campos = 'number,title,body,author,headRefName,baseRefName,state,createdAt,mergedAt,mergedBy,reviews,url';
  return JSON.parse(gh('pr', 'list', '--state', 'all', '--limit', '500', '--json', campos)).sort((a, b) => a.number - b.number).map((p) => {
    const autor = p.author?.login ?? '';
    const reviews = (p.reviews || []).map((r) => ({ autor: r.author?.login ?? '', estado: r.state, fecha: r.submittedAt }));
    const aprobadores = [...new Set(reviews.filter((r) => r.estado === 'APPROVED' && r.autor !== autor).map((r) => r.autor))];
    return {
      numero: p.number,
      titulo: p.title,
      url: p.url,
      autor,
      rama: p.headRefName,
      base: p.baseRefName,
      estado: p.state,
      creado: p.createdAt,
      fusionado: p.mergedAt,
      fusionadoPor: p.mergedBy?.login ?? null,
      reviews,
      aprobadores,
      plantilla: evaluarPlantilla(p.title, p.body || ''),
    };
  });
}

// Secciones que pide README §11. Se buscan en encabezados (`## X`, `**X**`, `X:`),
// salvo la relación con el requerimiento, que basta con que aparezca.
const SECCIONES = [
  ['descripción', /descripcion|resumen/],
  ['cambios', /cambios/],
  ['módulos', /modulos|archivos/],
  ['pruebas', /pruebas|tests?\b|verificacion/],
];

function evaluarPlantilla(titulo, cuerpo) {
  if (!cuerpo.trim()) return { vacia: true, faltantes: [...SECCIONES.map(([n]) => n), 'requerimiento'] };
  const encabezados = sinAcentos(cuerpo).split('\n').filter((l) => /^\s*(#{1,6}\s|\*\*|[^\s].{0,40}:\s*$)/.test(l)).join('\n');
  const faltantes = SECCIONES.filter(([, re]) => !re.test(encabezados)).map(([n]) => n);
  if (!RE_TRAZA.test(`${titulo}\n${cuerpo}`) && !/requerimiento|tarea|ticket/.test(sinAcentos(cuerpo))) faltantes.push('requerimiento');
  return { vacia: false, faltantes };
}

function proteccionMain(repo) {
  if (sinGithub) return { verificable: false, detalle: 'omitida (--sin-github)' };
  try {
    const p = JSON.parse(gh('api', `repos/${repo}/branches/main/protection`));
    return {
      verificable: true,
      protegida: true,
      reviewsRequeridos: p.required_pull_request_reviews?.required_approving_review_count ?? 0,
      checksRequeridos: (p.required_status_checks?.contexts || []).length,
      aplicaAdmins: !!p.enforce_admins?.enabled,
      detalle: p,
    };
  } catch (e) {
    const err = String(e.stderr || e.message);
    if (/Branch not protected/i.test(err)) return { verificable: true, protegida: false, detalle: 'Branch not protected' };
    return { verificable: false, detalle: `no verificable con los permisos actuales (${err.trim().split('\n').pop()}). Capturar Settings → Branches.` };
  }
}

// --- Análisis ---------------------------------------------------------------

function porcentaje(cumple, total) {
  return total ? `${Math.round((cumple / total) * 100)} %` : 'n/a';
}

function analizar({ repo, todos, main, listaRamas, listaPrs, proteccion }) {
  const sinMerge = todos.filter((c) => !c.esMerge);
  const directos = main.filter((c) => !c.esMerge);
  const mergesSinPr = main.filter((c) => c.esMerge && !c.pr);

  // C2 sobre la unión de ramas remotas y ramas de origen de PRs (cubre ramas borradas).
  const nombres = new Map();
  for (const r of listaRamas) nombres.set(r.nombre, { nombre: r.nombre, fuentes: ['remoto'] });
  for (const p of listaPrs) {
    const e = nombres.get(p.rama) ?? { nombre: p.rama, fuentes: [] };
    e.fuentes.push(`PR #${p.numero}`);
    nombres.set(p.rama, e);
  }
  const evalRamas = [...nombres.values()].filter((r) => r.nombre !== 'main').map((r) => ({
    ...r,
    cumple: RE_RAMA.test(r.nombre),
    estilo: RE_RAMA_ESTILO.test(r.nombre),
  }));

  const prsMain = listaPrs.filter((p) => p.estado === 'MERGED');
  const prsPorRama = Object.entries(Object.groupBy(listaPrs, (p) => p.rama)).filter(([, v]) => v.length > 1);

  const criterios = [
    { id: 'C1', titulo: 'Sin commits directos a `main`', fuente: 'README §3, §13', cumple: main.length - directos.length, total: main.length },
    { id: 'C2', titulo: 'Ramas con prefijo `feature/` o `fix/`', fuente: 'README §3.1–3.2', cumple: evalRamas.filter((r) => r.cumple).length, total: evalRamas.length },
    { id: 'C3a', titulo: 'Commits con formato `tipo: descripción`', fuente: 'README §9', cumple: sinMerge.filter((c) => c.formato.cumple).length, total: sinMerge.length },
    { id: 'C3b', titulo: 'Commits trazables a RF/RNF o tarea', fuente: 'CLAUDE.md / SQAP', cumple: sinMerge.filter((c) => c.trazable).length, total: sinMerge.length },
    { id: 'C4', titulo: 'Integraciones a `main` mediante PR', fuente: 'README §4, §11', cumple: main.filter((c) => c.pr).length, total: main.length },
    { id: 'C5', titulo: 'PR fusionados con aprobación de otra persona', fuente: 'README §12–13', cumple: prsMain.filter((p) => p.aprobadores.length).length, total: prsMain.length },
    { id: 'C6', titulo: 'PR con la descripción de la plantilla completa', fuente: 'README §11', cumple: listaPrs.filter((p) => !p.plantilla.faltantes.length).length, total: listaPrs.length },
    { id: 'C7', titulo: 'Ramas remotas vigentes (no quedaron tras fusionarse)', fuente: 'README §14, Regla 2', cumple: listaRamas.filter((r) => !r.fusionada).length, total: listaRamas.length },
    { id: 'C8', titulo: '`main` protegida en GitHub', fuente: 'README §3, §13', cumple: proteccion.protegida ? 1 : 0, total: proteccion.verificable ? 1 : 0 },
  ];

  return { repo, criterios, sinMerge, directos, mergesSinPr, evalRamas, prsMain, prsPorRama, proteccion };
}

function personas(todos, listaPrs) {
  const grupos = new Map();
  for (const c of todos) {
    const clave = sinAcentos(c.autor).trim();
    const g = grupos.get(clave) ?? { nombre: c.autor, correos: new Set(), commits: 0, merges: 0 };
    g.correos.add(c.correo.toLowerCase());
    if (c.esMerge) g.merges++;
    else g.commits++;
    grupos.set(clave, g);
  }
  const cuentas = new Map();
  const cuenta = (login) => cuentas.get(login) ?? cuentas.set(login, { login, abiertos: 0, fusionados: 0, fusionadosPorEl: 0, reviews: 0, aprobaciones: 0 }).get(login);
  for (const p of listaPrs) {
    cuenta(p.autor).abiertos++;
    if (p.estado === 'MERGED') cuenta(p.autor).fusionados++;
    if (p.fusionadoPor) cuenta(p.fusionadoPor).fusionadosPorEl++;
    for (const r of p.reviews.filter((r) => r.autor !== p.autor)) {
      cuenta(r.autor).reviews++;
      if (r.estado === 'APPROVED') cuenta(r.autor).aprobaciones++;
    }
  }
  return {
    identidades: [...grupos.values()].map((g) => ({ ...g, correos: [...g.correos] })).sort((a, b) => b.commits - a.commits),
    cuentas: [...cuentas.values()].sort((a, b) => b.abiertos - a.abiertos),
  };
}

// --- Reporte ----------------------------------------------------------------

const md = (t) => String(t ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ');
const dia = (f) => (f ? f.slice(0, 10) : '—');

function tabla(encabezados, filas) {
  if (!filas.length) return '_Sin elementos._\n';
  return [
    `| ${encabezados.join(' | ')} |`,
    `|${encabezados.map(() => '---').join('|')}|`,
    ...filas.map((f) => `| ${f.map(md).join(' | ')} |`),
  ].join('\n') + '\n';
}

function detalles(resumen, contenido) {
  return `<details>\n<summary>${resumen}</summary>\n\n${contenido}\n</details>\n`;
}

function generarReporte(a, gente, meta) {
  const { repo } = a;
  const enlaceCommit = (h) => `[\`${h.slice(0, 7)}\`](https://github.com/${repo}/commit/${h})`;
  const enlacePr = (p) => `[#${p.numero}](${p.url})`;
  const filaCommit = (c, extra = []) => [enlaceCommit(c.hash), c.autor, dia(c.fecha), c.asunto, ...extra];
  const L = [];

  L.push('# Reporte de auditoría de gestión de configuración — PsicoGestión\n');
  L.push('## 1. Datos de la auditoría\n');
  L.push(tabla(['Campo', 'Valor'], [
    ['Repositorio', `https://github.com/${repo}`],
    ['Fecha de recolección', meta.fecha],
    ['Commit de `main` auditado', enlaceCommit(meta.headMain)],
    ['Alcance', 'Todo el historial: ramas locales, remotas y etiquetas (sin stash); todas las ramas remotas, incluidas `docs` y `manual`; todos los PR'],
    ['Criterios', 'README §3, §4, §9, §11–14 (derivados del SQAP) y trazabilidad RF/RNF'],
    ['Método', 'Recolección automática con `scripts/auditoria/recolectar.mjs` (git + GitHub CLI) y revisión manual de los casos marcados'],
    ['Evidencia cruda', '`evidencia-auditoria.json`'],
  ]));

  L.push('## 2. Resumen de cumplimiento\n');
  L.push(tabla(['Criterio', 'Descripción', 'Fuente', 'Cumple', 'Total', '%'],
    a.criterios.map((c) => [c.id, c.titulo, c.fuente, c.cumple, c.total, porcentaje(c.cumple, c.total)])));
  L.push('> C1 y C4 cuentan los commits del historial de primer padre de `main`. C7 es informativo: una rama fusionada que sigue en el remoto debió borrarse.\n');

  L.push('## 3. Hallazgos por criterio\n');

  L.push('### C1 — Commits directos a `main`\n');
  L.push(tabla(['Commit', 'Autor', 'Fecha', 'Asunto', 'Nota'], a.directos.map((c) => filaCommit(c, [c.nota]))));

  L.push('### C2 — Nomenclatura de ramas\n');
  const ramasMal = a.evalRamas.filter((r) => !r.cumple);
  const ramasEstilo = a.evalRamas.filter((r) => r.cumple && !r.estilo);
  L.push('**No conformes** (sin prefijo `feature/` o `fix/`; incluye `docs` y `manual`):\n');
  L.push(tabla(['Rama', 'Dónde aparece'], ramasMal.map((r) => [`\`${r.nombre}\``, r.fuentes.join(', ')])));
  L.push('**Observaciones de estilo** (prefijo correcto, pero con mayúsculas, acentos o ñ; los ejemplos del README usan solo minúsculas y guiones):\n');
  L.push(tabla(['Rama', 'Dónde aparece'], ramasEstilo.map((r) => [`\`${r.nombre}\``, r.fuentes.join(', ')])));
  L.push(detalles(`Ramas conformes (${a.evalRamas.length - ramasMal.length})`,
    a.evalRamas.filter((r) => r.cumple).map((r) => `- \`${r.nombre}\` (${r.fuentes.join(', ')})`).join('\n')));

  L.push('### C3a — Formato de los mensajes de commit\n');
  const malFormato = a.sinMerge.filter((c) => !c.formato.cumple);
  L.push(tabla(['Commit', 'Autor', 'Fecha', 'Asunto', 'Motivo'], malFormato.map((c) => filaCommit(c, [c.formato.motivo]))));
  const tipos = Object.entries(Object.groupBy(a.sinMerge.filter((c) => c.formato.cumple), (c) => c.asunto.match(RE_TIPO)[1]))
    .map(([t, v]) => `\`${t}\`: ${v.length}`).join(' · ');
  L.push(`Distribución de tipos en los commits conformes: ${tipos || '—'}\n`);

  L.push('### C3b — Trazabilidad de commits a requerimientos\n');
  const noTrazables = a.sinMerge.filter((c) => !c.trazable);
  L.push(`${a.sinMerge.length - noTrazables.length} de ${a.sinMerge.length} commits (sin contar merges) citan un RF/RNF o un identificador \`PG-REQ\`.\n`);
  L.push(detalles(`Commits sin referencia (${noTrazables.length})`,
    tabla(['Commit', 'Autor', 'Fecha', 'Asunto'], noTrazables.map((c) => filaCommit(c)))));

  L.push('### C4 — Integraciones a `main` sin PR\n');
  L.push('Merges en `main` que no provienen de un Pull Request (además de los commits directos de C1):\n');
  L.push(tabla(['Commit', 'Autor', 'Fecha', 'Asunto'], a.mergesSinPr.map((c) => filaCommit(c))));

  L.push('### C5 — Revisión y aprobación de los PR\n');
  L.push(tabla(['PR', 'Rama', 'Autor', 'Fusionado por', 'Fecha de fusión', 'Reviews', 'Aprobado por otro'],
    a.prsMain.map((p) => [enlacePr(p), p.rama, p.autor, p.fusionadoPor ?? '—', dia(p.fusionado),
      p.reviews.length ? p.reviews.map((r) => `${r.autor}: ${r.estado}`).join(', ') : 'ninguno',
      p.aprobadores.length ? `sí (${p.aprobadores.join(', ')})` : 'no'])));
  const autoFusion = a.prsMain.filter((p) => p.fusionadoPor === p.autor);
  L.push(`PR fusionados por su propio autor: ${autoFusion.length ? autoFusion.map((p) => `#${p.numero}`).join(', ') : 'ninguno'}.\n`);

  L.push('### C6 — Descripción de los PR según la plantilla (README §11)\n');
  L.push(tabla(['PR', 'Estado', 'Título', 'Secciones faltantes'],
    meta.listaPrs.map((p) => [enlacePr(p), p.estado, p.titulo,
      p.plantilla.vacia ? 'descripción vacía' : (p.plantilla.faltantes.join(', ') || '✔ completa')])));
  const noMain = meta.listaPrs.filter((p) => p.base !== 'main');
  if (noMain.length) L.push(`PR con base distinta de \`main\`: ${noMain.map((p) => `#${p.numero} → \`${p.base}\``).join(', ')}.\n`);
  const sinFusionar = meta.listaPrs.filter((p) => p.estado !== 'MERGED');
  L.push(`PR no fusionados (abiertos o cerrados): ${sinFusionar.length ? sinFusionar.map((p) => `#${p.numero} (${p.estado.toLowerCase()})`).join(', ') : 'ninguno'}.\n`);

  L.push('### C7 — Una tarea por rama y limpieza de ramas\n');
  L.push(tabla(['Rama remota', 'Último commit', 'Autor', 'Fusionada en `main`', 'Observación'],
    meta.listaRamas.map((r) => [`\`${r.nombre}\``, dia(r.ultimoCommit), r.autor, r.fusionada ? 'sí (no se borró)' : 'no',
      r.sufijoVersion ? 'sufijo de versión: posible tarea repetida' : ''])));
  if (a.prsPorRama.length) {
    L.push('Ramas reutilizadas en más de un PR:\n');
    L.push(a.prsPorRama.map(([rama, ps]) => `- \`${rama}\`: ${ps.map((p) => `#${p.numero}`).join(', ')}`).join('\n') + '\n');
  }

  L.push('### C8 — Protección de `main`\n');
  const p = a.proteccion;
  if (!p.verificable) L.push(`Resultado: **${p.detalle}**\n\nEvidencia indirecta: ${a.directos.length} commit(s) directo(s) en \`main\` (C1).\n`);
  else if (!p.protegida) L.push('Resultado: **`main` no tiene reglas de protección.**\n');
  else L.push(tabla(['Regla', 'Valor'], [['Aprobaciones requeridas', p.reviewsRequeridos], ['Checks requeridos', p.checksRequeridos], ['Aplica a administradores', p.aplicaAdmins ? 'sí' : 'no']]));

  L.push('## 4. Participación por integrante\n');
  L.push('**Identidades de git** (agrupadas por nombre; varios correos para una misma persona son una observación menor):\n');
  L.push(tabla(['Nombre', 'Commits', 'Merges', 'Correos'], gente.identidades.map((g) => [g.nombre, g.commits, g.merges, g.correos.join(', ')])));
  if (!sinGithub) {
    L.push('**Cuentas de GitHub**:\n');
    L.push(tabla(['Usuario', 'PR abiertos', 'PR fusionados', 'PR que fusionó', 'Reviews a otros', 'Aprobaciones'],
      gente.cuentas.map((c) => [c.login, c.abiertos, c.fusionados, c.fusionadosPorEl, c.reviews, c.aprobaciones])));
  }

  L.push('## 5. Buenas prácticas observadas\n');
  L.push('<!-- COMPLETAR: qué se hizo bien (p. ej. adopción del formato de commits, uso de PR, documentación, pruebas). -->\n');
  L.push('## 6. No conformidades y severidad\n');
  L.push(tabla(['ID', 'Criterio', 'Descripción', 'Evidencia', 'Severidad', 'Justificación'], [
    ['NC-01', '', '<!-- COMPLETAR -->', '', 'Alta / Media / Baja', ''],
  ]));
  L.push('## 7. Recomendaciones\n');
  L.push('<!-- COMPLETAR: p. ej. activar protección de `main` con aprobación obligatoria, añadir `.github/pull_request_template.md`, workflow de CI que valide nombre de rama, formato de commits y plantilla de PR, borrar ramas fusionadas. -->\n');
  L.push('## 8. Conclusión\n');
  L.push('<!-- COMPLETAR -->\n');

  return L.join('\n');
}

// --- Principal --------------------------------------------------------------

verificarEntorno();
const repo = nombreRepo();
const todos = commits();
const main = historialMain();
const listaRamas = ramas();
const listaPrs = sinGithub ? [] : prs();
const proteccion = proteccionMain(repo);
const analisis = analizar({ repo, todos, main, listaRamas, listaPrs, proteccion });
const gente = personas(todos, listaPrs);
const meta = { fecha: new Date().toISOString(), headMain: git('rev-parse', 'origin/main').trim(), listaPrs, listaRamas };

fs.mkdirSync(dirSalida, { recursive: true });
fs.writeFileSync(path.join(dirSalida, 'evidencia-auditoria.json'), JSON.stringify({
  meta: { repo, fecha: meta.fecha, headMain: meta.headMain, sinGithub },
  criterios: analisis.criterios,
  commits: todos,
  historialMain: main,
  ramas: listaRamas,
  evaluacionRamas: analisis.evalRamas,
  prs: listaPrs,
  proteccionMain: proteccion,
  personas: gente,
}, null, 2));
fs.writeFileSync(path.join(dirSalida, 'reporte-auditoria.md'), generarReporte(analisis, gente, meta));

console.log(`Evidencia y reporte escritos en ${path.relative(raiz, dirSalida) || '.'}`);
for (const c of analisis.criterios) console.log(`  ${c.id.padEnd(4)} ${String(c.cumple).padStart(3)}/${String(c.total).padEnd(3)} ${porcentaje(c.cumple, c.total).padStart(6)}  ${c.titulo}`);
