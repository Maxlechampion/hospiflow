// export-project.mjs — Exporte tout le projet en .txt + génère context.md
// Usage :
//   node export-project.mjs                    (les deux exports)
//   node export-project.mjs --only=txt         (uniquement l'export .txt)
//   node export-project.mjs --only=context     (uniquement context.md)
//   node export-project.mjs --dry-run          (prévisualisation)

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = __dirname;

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------
const EXCLUDE_DIRS = new Set([
  'vendor', 'node_modules', '.git', 'dist', 'storage',
  '.idea', '.vscode', 'coverage', '.next', '.cache',
  'bower_components', 'tmp', 'temp', '.turbo',
  'bootstrap/cache',
]);

const EXCLUDE_FILES = new Set([
  'package-lock.json', 'composer.lock', 'yarn.lock', 'pnpm-lock.yaml',
  '.DS_Store', 'Thumbs.db',
  'PROJECT-EXPORT-GENERATED.txt', 'PROJECT-TREE.json',
  'test-output.txt',
]);

const SENSITIVE_PATTERNS = [
  /^\.env$/,
  /^\.env\..+/,
  /auth\.json$/,
  /composer-auth\.json$/,
  /\.npmrc$/,
];

const CODE_EXT = new Set([
  '.php', '.js', '.mjs', '.cjs', '.ts', '.mts', '.cts', '.jsx', '.tsx', '.vue',
  '.json', '.md', '.txt', '.yml', '.yaml', '.env', '.example', '.xml', '.toml',
  '.ini', '.conf', '.sh', '.bash', '.ps1', '.sql', '.graphql', '.gql',
  '.css', '.scss', '.sass', '.less', '.html', '.htm', '.pug',
]);

const C = {
  reset: '\x1b[0m', bold: '\x1b[1m', dim: '\x1b[2m',
  red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m',
  cyan: '\x1b[36m', magenta: '\x1b[35m',
};
const log = {
  t: (s) => console.log(`\n${C.bold}${C.magenta}▶ ${s}${C.reset}`),
  ok: (s) => console.log(`${C.green}✔${C.reset} ${s}`),
  warn: (s) => console.log(`${C.yellow}⚠${C.reset} ${s}`),
  err: (s) => console.log(`${C.red}✖${C.reset} ${s}`),
  info: (s) => console.log(`${C.cyan}ℹ${C.reset} ${s}`),
  dim: (s) => console.log(`${C.dim}  ${s}${C.reset}`),
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function shouldExcludeDir(name, relPath) {
  if (EXCLUDE_DIRS.has(name)) return true;
  // Exclure "bootstrap/cache" (chemin complet)
  if (relPath.replace(/\\/g, '/').endsWith('bootstrap/cache')) return true;
  return false;
}

function shouldExcludeFile(name) {
  if (EXCLUDE_FILES.has(name)) return true;
  // Exclure les fichiers générés par nos scripts
  if (/\.bak$/.test(name) || /\.bak-.*$/.test(name)) return true;
  if (/^(setup-vague1|setup-vague1-v2|restore-vague1|fix-patch-05|fix-factory-traits|apply-lot-|fix-phpstan|fix-models|fix-facility|fix-faker|fix-missing|fix-payload|move-policy|restore-factories|inspect-payload|export-project).*\.mjs$/.test(name)) return true;
  if (/^(PROJECT-|test-output)/.test(name)) return true;
  return false;
}

function isSensitive(name) {
  return SENSITIVE_PATTERNS.some(rx => rx.test(name));
}

function isCodeFile(name) {
  const ext = path.extname(name).toLowerCase();
  if (!ext && name.startsWith('.env')) return true;
  return CODE_EXT.has(ext);
}

function countLines(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    if (content.length === 0) return 0;
    return content.split('\n').length;
  } catch { return -1; }
}

function humanSize(bytes) {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
  return `${(bytes / 1024 / 1024).toFixed(2)} Mo`;
}

// ---------------------------------------------------------------------------
// Scan récursif
// ---------------------------------------------------------------------------
function scanDir(absDir, relBase = '') {
  const entries = [];
  let dirents;
  try {
    dirents = fs.readdirSync(absDir, { withFileTypes: true });
  } catch { return entries; }

  dirents.sort((a, b) => {
    if (a.isDirectory() && !b.isDirectory()) return -1;
    if (!a.isDirectory() && b.isDirectory()) return 1;
    return a.name.localeCompare(b.name);
  });

  for (const d of dirents) {
    const abs = path.join(absDir, d.name);
    const rel = relBase ? `${relBase}/${d.name}` : d.name;

    if (d.isDirectory()) {
      if (shouldExcludeDir(d.name, rel)) continue;
      const children = scanDir(abs, rel);
      entries.push({
        rel, abs, name: d.name, isDir: true,
        size: children.reduce((s, c) => s + (c.size || 0), 0),
        children,
      });
    } else if (d.isFile()) {
      if (shouldExcludeFile(d.name)) continue;
      const stat = fs.statSync(abs);
      const masked = isSensitive(d.name);
      entries.push({
        rel, abs, name: d.name, isDir: false,
        size: stat.size,
        lines: masked ? 0 : countLines(abs),
        masked,
      });
    }
  }
  return entries;
}

function flatten(entries, out = []) {
  for (const e of entries) {
    out.push(e);
    if (e.isDir) flatten(e.children, out);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Export 1 — PROJECT-EXPORT.txt
// ---------------------------------------------------------------------------
function buildTxtExport(flatEntries, rootPath) {
  const now = new Date().toISOString();
  const fileCount = flatEntries.filter(e => !e.isDir && !e.masked).length;
  const dirCount = flatEntries.filter(e => e.isDir).length;

  const header = [
    '='.repeat(80),
    'HOSPIFLOW — EXPORT INTÉGRAL DU PROJET',
    `Date       : ${now}`,
    `Racine     : ${rootPath}`,
    `Node       : ${process.version}`,
    `Dossiers   : ${dirCount}`,
    `Fichiers   : ${fileCount} (vendor/node_modules/.git/dist/storage exclus)`,
    `Format     : chaque fichier précédé de ===== CHEMIN ===== et du nombre de lignes`,
    '='.repeat(80),
    '',
  ].join('\n');

  const parts = [header];

  for (const e of flatEntries) {
    if (e.isDir || e.masked) continue;
    if (!isCodeFile(e.name)) continue;

    let content = '';
    try {
      content = fs.readFileSync(e.abs, 'utf8');
    } catch (err) {
      content = `[ERREUR DE LECTURE: ${err.message}]`;
    }

    const relPath = e.rel.replace(/\\/g, '/');
    const sizeKo = Math.round(e.size / 1024);
    parts.push(
      `===== ${relPath} ===== (${e.lines} lignes, ${sizeKo} Ko)`,
      content,
      ''
    );
  }

  return parts.join('\n');
}

// ---------------------------------------------------------------------------
// Export 2 — context.md
// ---------------------------------------------------------------------------
function buildContextMd(flatEntries) {
  const now = new Date().toISOString();
  const files = flatEntries.filter(e => !e.isDir);
  const dirs = flatEntries.filter(e => e.isDir);

  // Compter par catégorie
  const controllers = files.filter(f => /Controllers\/\w+Controller\.php$/.test(f.rel.replace(/\\/g, '/')));
  const models = files.filter(f => /Models\/\w+\.php$/.test(f.rel.replace(/\\/g, '/')));
  const requests = files.filter(f => /Requests\/.+\/\w+Request\.php$/.test(f.rel.replace(/\\/g, '/')));
  const policies = files.filter(f => /Policies\/\w+Policy\.php$/.test(f.rel.replace(/\\/g, '/')));
  const middlewares = files.filter(f => /Middleware\/\w+\.php$/.test(f.rel.replace(/\\/g, '/')));
  const factories = files.filter(f => /factories\/\w+Factory\.php$/.test(f.rel.replace(/\\/g, '/')));
  const migrations = files.filter(f => /migrations\/.+\.php$/.test(f.rel.replace(/\\/g, '/')));
  const seeders = files.filter(f => /seeders\/\w+Seeder\.php$/.test(f.rel.replace(/\\/g, '/')));
  const tests = files.filter(f => /tests\/.+\w+Test\.php$/.test(f.rel.replace(/\\/g, '/')));
  const workflows = files.filter(f => /\.github\/workflows\/.+\.yml$/.test(f.rel.replace(/\\/g, '/')));
  const configs = files.filter(f => /config\/\w+\.php$/.test(f.rel.replace(/\\/g, '/')));

  const totalLines = files.reduce((s, f) => s + (f.lines || 0), 0);
  const totalSize = files.reduce((s, f) => s + f.size, 0);

  const md = [];
  const p = (s = '') => md.push(s);

  p(`# HOSPIFLOW — Contexte projet`);
  p();
  p(`> **Dernière mise à jour** : ${now}`);
  p(`> **Généré automatiquement** par \`export-project.mjs\``);
  p();

  // --- Statistiques ---
  p(`## 📊 Statistiques`);
  p();
  p(`| Catégorie | Nombre |`);
  p(`|---|---|`);
  p(`| Dossiers | ${dirs.length} |`);
  p(`| Fichiers totaux | ${files.length} |`);
  p(`| Lignes de code (total) | ~${totalLines.toLocaleString()} |`);
  p(`| Taille totale | ${humanSize(totalSize)} |`);
  p(`| Contrôleurs | ${controllers.length} |`);
  p(`| Modèles | ${models.length} |`);
  p(`| Form Requests | ${requests.length} |`);
  p(`| Policies | ${policies.length} |`);
  p(`| Middlewares | ${middlewares.length} |`);
  p(`| Factories | ${factories.length} |`);
  p(`| Migrations | ${migrations.length} |`);
  p(`| Seeders | ${seeders.length} |`);
  p(`| Fichiers de tests | ${tests.length} |`);
  p(`| Workflows CI | ${workflows.length} |`);
  p(`| Fichiers de config | ${configs.length} |`);
  p();

  // --- Stack technique ---
  p(`## 🛠 Stack technique`);
  p();
  p(`- **Backend** : Laravel 13, PHP 8.3+`);
  p(`- **Auth** : Laravel Sanctum (tokens)`);
  p(`- **RBAC** : Spatie Permissions`);
  p(`- **Audit** : Spatie Activity Log`);
  p(`- **Tests** : Pest PHP 4`);
  p(`- **Formatage** : Laravel Pint`);
  p(`- **Analyse statique** : Larastan niveau 5 (PHPStan 2.x)`);
  p(`- **Base de données** : SQLite (dev) / PostgreSQL (prod)`);
  p(`- **CI** : GitHub Actions`);
  p();

  // --- Architecture ---
  p(`## 🏗 Architecture`);
  p();
  p(`### Modules métier (M00 → M10)`);
  p();
  p(`| Module | Description | Contrôleur |`);
  p(`|---|---|---|`);
  p(`| M00 | Authentification | \`AuthController\` |`);
  p(`| M01 | Établissements | \`FacilityController\` |`);
  p(`| M02 | Patients (MPI) | \`PatientController\` |`);
  p(`| M03 | Rendez-vous | \`AppointmentController\` |`);
  p(`| M04 | Consultations | \`ConsultationController\` |`);
  p(`| M05 | Laboratoire | \`LabRequestController\` |`);
  p(`| M06 | Pharmacie | \`PharmacyController\` |`);
  p(`| M07 | Facturation | \`InvoiceController\` |`);
  p(`| M08 | Rapports | \`ReportController\` |`);
  p(`| M09 | Audit | \`AuditLogController\` |`);
  p();

  p(`### Multi-tenant`);
  p();
  p(`Toute requête métier est scopée par \`facility\` (établissement actif) :`);
  p(`1. Middleware \`EnsureFacilityIsActive\` vérifie que l'utilisateur a une facility active`);
  p(`2. Trait \`ResolvesFacility\` fournit \`$this->facility($request)\``);
  p(`3. Policies vérifient \`$user->current_facility_id === $model->facility_id\``);
  p();

  // --- Contrôleurs ---
  if (controllers.length > 0) {
    p(`## 🎯 Contrôleurs`);
    p();
    p(`| Contrôleur | Lignes | Rôle |`);
    p(`|---|---|---|`);
    for (const c of controllers) {
      p(`| \`${path.basename(c.rel)}\` | ${c.lines} | — |`);
    }
    p();
  }

  // --- Modèles ---
  if (models.length > 0) {
    p(`## 🗄 Modèles Eloquent`);
    p();
    p(`| Modèle | Lignes | Traits |`);
    p(`|---|---|---|`);
    for (const m of models) {
      let traits = '';
      try {
        const content = fs.readFileSync(m.abs, 'utf8');
        const m2 = content.match(/use\s+([A-Za-z,\s]+);/);
        if (m2) traits = m2[1].trim();
      } catch {}
      p(`| \`${path.basename(m.rel)}\` | ${m.lines} | ${traits || '—'} |`);
    }
    p();
  }

  // --- Form Requests ---
  if (requests.length > 0) {
    p(`## 📝 Form Requests`);
    p();
    p(`| Request | Lignes |`);
    p(`|---|---|`);
    for (const r of requests) {
      p(`| \`${path.basename(r.rel)}\` | ${r.lines} |`);
    }
    p();
  }

  // --- Policies ---
  if (policies.length > 0) {
    p(`## 🔐 Policies (autorisation)`);
    p();
    p(`| Policy | Lignes |`);
    p(`|---|---|`);
    for (const p2 of policies) {
      p(`| \`${path.basename(p2.rel)}\` | ${p2.lines} |`);
    }
    p();
  }

  // --- Middlewares ---
  if (middlewares.length > 0) {
    p(`## 🛡 Middlewares`);
    p();
    p(`| Middleware | Lignes |`);
    p(`|---|---|`);
    for (const m of middlewares) {
      p(`| \`${path.basename(m.rel)}\` | ${m.lines} |`);
    }
    p();
  }

  // --- Tests ---
  if (tests.length > 0) {
    p(`## 🧪 Tests (Pest)`);
    p();
    p(`| Fichier | Lignes |`);
    p(`|---|---|`);
    for (const t of tests) {
      p(`| \`${path.basename(t.rel)}\` | ${t.lines} |`);
    }
    p();
  }

  // --- Migrations ---
  if (migrations.length > 0) {
    p(`## 📦 Migrations`);
    p();
    p(`Total : ${migrations.length} migrations`);
    p();
  }

  // --- Seeders ---
  if (seeders.length > 0) {
    p(`## 🌱 Seeders`);
    p();
    for (const s of seeders) {
      p(`- \`${path.basename(s.rel)}\``);
    }
    p();
  }

  // --- Workflows CI ---
  if (workflows.length > 0) {
    p(`## ⚙️ CI/CD (GitHub Actions)`);
    p();
    for (const w of workflows) {
      p(`- \`${path.basename(w.rel)}\``);
    }
    p();
  }

  // --- Conventions ---
  p(`## 📐 Conventions`);
  p();
  p(`- **Code** : anglais (variables, méthodes, colonnes)`);
  p(`- **Messages utilisateur** : français`);
  p(`- **Validation** : Form Requests (pas de \`$request->validate()\` dans les contrôleurs)`);
  p(`- **Autorisation** : Policies Laravel (pas de \`$user->can('permission')\` direct)`);
  p(`- **Portabilité SQL** : compatible SQLite **et** PostgreSQL (pas de \`ilike\`, \`to_char\`, \`extract\`)`);
  p(`- **Erreurs** : format uniforme \`{error: {code, message, fields?}}\``);
  p(`- **Tests** : Pest, DB \`:memory:\`, \`RefreshDatabase\``);
  p();

  // --- URLs API ---
  p(`## 🌐 API (43 routes)`);
  p();
  p(`### Public`);
  p();
  p(`- \`POST /api/auth/login\` — \`throttle:5,1\``);
  p();
  p(`### Authentifié (Sanctum)`);
  p();
  p(`- \`GET  /api/auth/me\``);
  p(`- \`POST /api/auth/logout\``);
  p(`- \`GET  /api/facilities\``);
  p(`- \`POST /api/facilities\``);
  p(`- \`PATCH /api/facilities/{id}\``);
  p(`- \`POST /api/facilities/{id}/switch\``);
  p(`- \`POST /api/facilities/{id}/users\``);
  p();
  p(`### Métier (facility active requise)`);
  p();
  p(`- **Patients** : GET/POST \`/api/patients\`, GET \`/search\`, GET/PATCH \`/{id}\``);
  p(`- **Rendez-vous** : GET/POST \`/api/appointments\`, GET \`/practitioners\`, GET/PATCH \`/{id}\``);
  p(`- **Consultations** : GET/POST \`/api/consultations\`, GET/PATCH \`/{id}\``);
  p(`- **Labo** : GET/POST \`/api/lab-requests\`, GET/PATCH \`/{id}\`, POST \`/{id}/result\``);
  p(`- **Pharmacie** : GET/POST \`/api/pharmacy/drugs\`, GET/POST \`/stock\`, GET/POST \`/dispensations\`, GET \`/dispensations/{id}\``);
  p(`- **Facturation** : GET/POST \`/api/invoices\`, GET/PATCH \`/{id}\`, POST \`/{id}/payments\``);
  p(`- **Rapports** : GET \`/api/reports/overview\`, \`/revenue\`, \`/stock\``);
  p(`- **Audit** : GET \`/api/audit-logs\``);
  p();

  // --- État des vagues ---
  p(`## ✅ État des vagues`);
  p();
  p(`| Vague | Statut | Contenu |`);
  p(`|---|---|---|`);
  p(`| Vague 1 | ✅ | Correctifs critiques (SQL portable, bugs, sécurité) |`);
  p(`| Lot A | ✅ | Middlewares, Form Requests, rate limiting, JSON uniformes |`);
  p(`| Lot B | ✅ | Audit log (Spatie Activity Log) |`);
  p(`| Lot B-bis | ✅ | 6 Policies Laravel |`);
  p(`| Lot B-ter | ✅ | Form Requests → Policies |`);
  p(`| Lot C1 | ✅ | Tests Pest (factories + 40 tests) |`);
  p(`| Lot C3 | ✅ | CI GitHub Actions + Larastan |`);
  p(`| Vague 3 | ⏳ | Fonctionnel métier |`);
  p(`| Vague 4 | ⏳ | Modernisation (Docker, OpenAPI, etc.) |`);
  p();

  // --- Liens utiles ---
  p(`## 🔗 Fichiers clés`);
  p();
  const keyFiles = [
    'api/routes/api.php',
    'api/bootstrap/app.php',
    'api/app/Http/Controllers/Concerns/ResolvesFacility.php',
    'api/app/Http/Middleware/EnsureFacilityIsActive.php',
    'api/tests/Pest.php',
    'api/phpstan.neon',
    '.github/workflows/ci.yml',
    '.github/workflows/static-analysis.yml',
  ];
  for (const k of keyFiles) {
    if (files.some(f => f.rel.replace(/\\/g, '/') === k)) {
      p(`- \`${k}\``);
    }
  }
  p();

  return md.join('\n');
}

// =============================================================================
// EXÉCUTION
// =============================================================================

const args = process.argv.slice(2);
const DRY = args.includes('--dry-run');
const ONLY = args.find(a => a.startsWith('--only='))?.split('=')[1];

log.t(`Export du projet ${DRY ? '(DRY-RUN)' : ''}`);
log.info(`Racine : ${ROOT}`);

// Scan
log.info('Scan en cours...');
const t0 = Date.now();
const tree = scanDir(ROOT);
const flat = flatten(tree);
const elapsed = Date.now() - t0;

const fileCount = flat.filter(e => !e.isDir && !e.masked).length;
const dirCount = flat.filter(e => e.isDir).length;
const masked = flat.filter(e => e.masked).length;
const totalSize = flat.filter(e => !e.isDir).reduce((s, f) => s + f.size, 0);

log.ok(`Scan terminé en ${elapsed} ms`);
log.dim(`${dirCount} dossiers • ${fileCount} fichiers • ${humanSize(totalSize)} • ${masked} masqué(s)`);

// --- Export 1 : PROJECT-EXPORT.txt ---
if (!ONLY || ONLY === 'txt') {
  log.t('Génération PROJECT-EXPORT.txt');
  const txt = buildTxtExport(flat, ROOT);
  const dateStr = new Date().toISOString().slice(0, 10);
  const outPath = path.join(ROOT, `PROJECT-EXPORT-${dateStr}.txt`);

  if (DRY) {
    log.ok(`Serait écrit : ${outPath}`);
    log.dim(`${txt.split('\n').length} lignes • ${humanSize(Buffer.byteLength(txt, 'utf8'))}`);
  } else {
    fs.writeFileSync(outPath, txt, 'utf8');
    log.ok(`Écrit : ${outPath}`);
    log.dim(`${txt.split('\n').length} lignes • ${humanSize(Buffer.byteLength(txt, 'utf8'))}`);
  }
}

// --- Export 2 : context.md ---
if (!ONLY || ONLY === 'context') {
  log.t('Génération context.md');
  const md = buildContextMd(flat);
  const outPath = path.join(ROOT, 'context.md');

  if (DRY) {
    log.ok(`Serait écrit : ${outPath}`);
    log.dim(`${md.split('\n').length} lignes • ${humanSize(Buffer.byteLength(md, 'utf8'))}`);
  } else {
    fs.writeFileSync(outPath, md, 'utf8');
    log.ok(`Écrit : ${outPath}`);
    log.dim(`${md.split('\n').length} lignes • ${humanSize(Buffer.byteLength(md, 'utf8'))}`);
  }
}

log.t('Terminé');
if (DRY) {
  log.warn('DRY-RUN : aucun fichier écrit.');
}