// export-project.mjs — Exporte tout le code source du projet dans un fichier .txt
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = __dirname;

// Dossiers à exclure
const EXCLUDE_DIRS = new Set([
  'vendor', 'node_modules', '.git', 'dist', 'storage',
  '.idea', '.vscode', 'coverage', '.next', '.cache',
  'bower_components', 'tmp', 'temp', '.turbo', 'public'
]);

// Fichiers à exclure
const EXCLUDE_FILES = new Set([
  'package-lock.json', 'composer.lock', 'yarn.lock', 'pnpm-lock.yaml',
  '.DS_Store', 'Thumbs.db', 'PROJECT-TREE.json', 'test-output.txt'
]);

// Extensions considérées comme "code"
const CODE_EXT = new Set([
  '.php', '.js', '.mjs', '.cjs', '.ts', '.mts', '.cts', '.jsx', '.tsx', '.vue',
  '.json', '.md', '.txt', '.yml', '.yaml', '.env', '.example', '.xml', '.toml',
  '.ini', '.conf', '.sh', '.bash', '.ps1', '.sql', '.graphql', '.gql',
  '.css', '.scss', '.sass', '.less', '.html', '.htm', '.pug',
]);

// Fichiers sensibles à masquer
const SENSITIVE = new Set([
  '.env', '.env.local', '.env.production', '.env.staging',
  'auth.json', 'composer-auth.json', '.npmrc',
]);

const C = { reset: '\x1b[0m', green: '\x1b[32m', red: '\x1b[31m', yellow: '\x1b[33m', cyan: '\x1b[36m', bold: '\x1b[1m' };

function shouldExcludeDir(name, relPath) {
  if (EXCLUDE_DIRS.has(name)) return true;
  if (relPath.replace(/\\/g, '/').endsWith('bootstrap/cache')) return true;
  // On exclut les dossiers de scripts temporaires s'ils existent
  if (relPath === 'tools' || relPath === 'scripts') return true;
  return false;
}

function shouldExcludeFile(name) {
  if (EXCLUDE_FILES.has(name)) return true;
  if (name.endsWith('.bak') || name.includes('.bak-')) return true;
  // Exclure les fichiers d'export eux-mêmes
  if (name.startsWith('PROJECT-EXPORT-')) return true;
  // Exclure les scripts à la racine
  if (name === 'export-project.mjs') return true;
  return false;
}

function isSensitive(name) {
  if (SENSITIVE.has(name)) return true;
  if (name.startsWith('.env.') && name !== '.env.example') return true;
  return false;
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
      entries.push({ rel, abs, name: d.name, isDir: true, children });
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

// --- Génération de l'export ---
console.log(`\n${C.bold}${C.cyan}▶ Génération de l'export du projet${C.reset}`);

const tree = scanDir(ROOT);
const flat = flatten(tree);

const fileCount = flat.filter(e => !e.isDir && !e.masked).length;
const dirCount = flat.filter(e => e.isDir).length;

const now = new Date().toISOString();
const dateStr = now.slice(0, 10);

const header = [
  '='.repeat(80),
  'HOSPIFLOW — EXPORT INTÉGRAL DU PROJET',
  `Date       : ${now}`,
  `Racine     : ${ROOT}`,
  `Node       : ${process.version}`,
  `Dossiers   : ${dirCount}`,
  `Fichiers   : ${fileCount} (vendor/node_modules/.git/dist/storage exclus)`,
  `Format     : chaque fichier précédé de ===== CHEMIN ===== et du nombre de lignes`,
  '='.repeat(80),
  '',
].join('\n');

const parts = [header];

for (const e of flat) {
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

const output = parts.join('\n');
const outPath = path.join(ROOT, `PROJECT-EXPORT-${dateStr}.txt`);

fs.writeFileSync(outPath, output, 'utf8');

console.log(`${C.green}✔${C.reset} Export généré : ${outPath}`);
console.log(`  ${C.cyan}ℹ${C.reset} ${output.split('\n').length} lignes, ${Math.round(Buffer.byteLength(output, 'utf8') / 1024)} Ko`);