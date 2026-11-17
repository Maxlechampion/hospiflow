#!/usr/bin/env node
// HOSPIFLOW — M08 : Facturation & encaissements (orchestrateur)
// Prérequis : M07 terminé. Module découpé dans scripts/m08/.
import fs from 'node:fs';
import path from 'node:path';
import { API, WEB, log, ok, fail, run } from './m08/helpers.mjs';
import { installBackend } from './m08/backend.mjs';
import { installFrontend } from './m08/frontend.mjs';
import { runE2e } from './m08/e2e.mjs';

// ---------- M08/1 : Prérequis ----------
log('M08/1', 'Vérification du module M07');

for (const required of [
  path.join(API, 'app', 'Models', 'DrugLot.php'),
  path.join(API, 'app', 'Http', 'Controllers', 'PharmacyController.php'),
  path.join(WEB, 'src', 'views', 'PharmacyView.vue'),
]) {
  if (!fs.existsSync(required)) {
    fail('M07 incomplet : fichier manquant ' + required + '. Relance "npm run m07".');
  }
}
ok('Module M07 opérationnel');

// ---------- M08/2 : Backend ----------
log('M08/2', 'Backend — factures, lignes & encaissements');
installBackend();

// ---------- M08/3 : Migrations et permissions ----------
log('M08/3', 'Migrations et permissions');
run('php artisan migrate --force', API);
run('php artisan db:seed --class=BillingPermissionsSeeder --force', API);
ok('Migrations et permissions terminées');

// ---------- M08/4 : Frontend ----------
log('M08/4', 'Webapp Vue — page Facturation');
installFrontend();

// ---------- M08/5 : E2E ----------
await runE2e();

log('M08', 'Terminé');
console.log('');
console.log('Facturation : numérotation FAC-…, lignes et totaux, émission, encaissements');
console.log('partiels en XOF, annulation protégée et isolation vérifiées.');

