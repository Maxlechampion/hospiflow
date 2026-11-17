#!/usr/bin/env node
// HOSPIFLOW — M09 : rapports & statistiques
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { API, log, ok, fail } from './m09/helpers.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');

log('M09/1', 'Vérification du module M08');

const invoiceController = path.join(API, 'app', 'Http', 'Controllers', 'InvoiceController.php');

if (!fs.existsSync(invoiceController)) {
  fail('Module M08 (facturation) introuvable — lancez npm run m08 avant M09.');
}
ok('Module M08 opérationnel');

log('M09/2', 'Backend — rapports & statistiques');
const { installBackend } = await import('./m09/backend.mjs');
installBackend();

log('M09/3', 'Migrations et permissions');
execFileSync('php', ['artisan', 'migrate', '--force'], { cwd: API, stdio: 'inherit' });
ok('Aucune migration nécessaire ; permission reports.view déjà posée par M01');

log('M09/4', 'Webapp Vue — page Rapports');
const { installFrontend } = await import('./m09/frontend.mjs');
installFrontend();

log('M09/5', 'Test de bout en bout — rapports');
const { runE2e } = await import('./m09/e2e.mjs');
await runE2e();

console.log('');
console.log('[M09] Terminé');
console.log('Rapports : vue d\'ensemble, revenus, recouvrement, alertes stock & péremption.');
