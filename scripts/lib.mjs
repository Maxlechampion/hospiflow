// HOSPIFLOW — librairie commune des scripts d'automatisation des modules.
// Chaque module (m00, m01, …) importe ces helpers. Idempotent par conception.
import { execSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Racine du monorepo : hospiflow/
//   hospiflow/package.json   <- orchestrateur
//   hospiflow/scripts/*.mjs  <- un script par module
//   hospiflow/api/           <- API Laravel (créée par m00)
//   hospiflow/web/           <- Webapp Vue 3 (créée par m00)
export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const API = path.join(ROOT, 'api');
export const WEB = path.join(ROOT, 'web');

export const log = (step, msg) => console.log(`\n[${step}] ${msg}`);
export const ok = (msg) => console.log(`  ✓ ${msg}`);
export const warn = (msg) => console.log(`  ! ${msg}`);
export const fail = (msg) => {
  console.error(`\n  ✗ ${msg}`);
  process.exit(1);
};

// Version du premier token de la sortie de `bin --version` (ex: "v20.11.0", "PHP 8.3.1").
export function version(bin) {
  try {
    const out = execSync(`${bin} --version`, { encoding: 'utf8' });
    const m = out.match(/(\d+)\.(\d+)\.(\d+)/);
    return m ? { major: +m[1], minor: +m[2], patch: +m[3] } : null;
  } catch {
    return null;
  }
}

export function has(bin) {
  return version(bin) !== null;
}

export function requireVersion(bin, minMajor, minMinor, installHint) {
  const v = version(bin);
  if (!v) fail(`${bin} est introuvable. ${installHint}`);
  if (v.major < minMajor || (v.major === minMajor && v.minor < minMinor))
    fail(`${bin} ${v.major}.${v.minor}.${v.patch} trouvé, mais >= ${minMajor}.${minMinor} requis. ${installHint}`);
  ok(`${bin} ${v.major}.${v.minor}.${v.patch} — conforme`);
}

// Exécute une commande shell avec sortie live. Échec bloquant sauf allowFail=true.
export function run(cmd, { cwd = ROOT, allowFail = false } = {}) {
  const res = spawnSync(cmd, { cwd, stdio: 'inherit', shell: true });
  if (res.status !== 0 && !allowFail) fail(`Échec de la commande : ${cmd} (dans ${cwd})`);
  return res.status === 0;
}

// Comme run() mais silencieux : renvoie true/false (utilisé pour les sondes).
export function tryRun(cmd, cwd = ROOT) {
  const res = spawnSync(cmd, { cwd, stdio: 'pipe', shell: true });
  return res.status === 0;
}

// Écrit un fichier en créant les dossiers parents si besoin.
export function write(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
  ok(`créé : ${path.relative(ROOT, file)}`);
}

export const sleep = (ms) => spawnSync(process.execPath, ['-e', `new Promise(r=>setTimeout(r,${ms}))`]);
