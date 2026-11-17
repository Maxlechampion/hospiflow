// diag-patient.mjs — Affiche les 30 lignes autour de chaque erreur
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FILE = path.join(__dirname, 'api', 'app', 'Http', 'Controllers', 'PatientController.php');

const content = fs.readFileSync(FILE, 'utf8');
const lines = content.split('\n');

const C = { reset: '\x1b[0m', bold: '\x1b[1m', dim: '\x1b[2m', cyan: '\x1b[36m', yellow: '\x1b[33m', green: '\x1b[32m', red: '\x1b[31m' };

console.log(`\n${C.bold}${C.cyan}▶ PatientController.php — ${lines.length} lignes${C.reset}\n`);

// Afficher les lignes d'erreur (30, 58, 91, 110) avec contexte
const errorLines = [30, 58, 91, 110];

for (const errLine of errorLines) {
  console.log(`${C.bold}${C.yellow}━━━ Contexte autour de la ligne ${errLine} ━━━${C.reset}`);
  const start = Math.max(0, errLine - 4);
  const end = Math.min(lines.length, errLine + 4);
  for (let i = start; i < end; i++) {
    const marker = (i + 1 === errLine) ? `${C.red}→${C.reset}` : ' ';
    const num = String(i + 1).padStart(4);
    console.log(` ${marker} ${C.dim}${num}${C.reset} │ ${lines[i]}`);
  }
  console.log();
}

// Afficher la définition de payload()
console.log(`${C.bold}${C.yellow}━━━ Définition de payload() ━━━${C.reset}`);
const payloadIdx = lines.findIndex(l => l.includes('private function payload'));
if (payloadIdx >= 0) {
  const start = Math.max(0, payloadIdx - 3);
  const end = Math.min(lines.length, payloadIdx + 15);
  for (let i = start; i < end; i++) {
    const marker = (i === payloadIdx) ? `${C.red}→${C.reset}` : ' ';
    const num = String(i + 1).padStart(4);
    console.log(` ${marker} ${C.dim}${num}${C.reset} │ ${lines[i]}`);
  }
}
console.log();

// Vérifier les use en haut
console.log(`${C.bold}${C.yellow}━━━ Imports (use) ━━━${C.reset}`);
lines.slice(0, 20).forEach((l, i) => {
  if (l.startsWith('use ') || l.startsWith('namespace')) {
    console.log(`  ${C.dim}${String(i + 1).padStart(4)}${C.reset} │ ${l}`);
  }
});
console.log();