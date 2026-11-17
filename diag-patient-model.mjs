// diag-patient-model.mjs — Affiche le modèle Patient
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FILE = path.join(__dirname, 'api', 'app', 'Models', 'Patient.php');

const content = fs.readFileSync(FILE, 'utf8');
const lines = content.split('\n');

const C = { reset: '\x1b[0m', bold: '\x1b[1m', dim: '\x1b[2m', cyan: '\x1b[36m', yellow: '\x1b[33m' };

console.log(`\n${C.bold}${C.cyan}▶ Patient.php — ${lines.length} lignes${C.reset}\n`);

lines.forEach((l, i) => {
  console.log(`  ${C.dim}${String(i + 1).padStart(4)}${C.reset} │ ${l}`);
});
console.log();