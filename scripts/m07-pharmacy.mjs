#!/usr/bin/env node
// HOSPIFLOW — M07 : Pharmacie & dispensation (orchestrateur)
// Prérequis : M06 terminé. Module découpé dans scripts/m07/.
import fs from 'node:fs';
import path from 'node:path';
import { API, WEB, log, ok, fail, run } from './m07/helpers.mjs';
import { installBackend } from './m07/backend.mjs';
import { installFrontend } from './m07/frontend.mjs';
import { runE2e } from './m07/e2e.mjs';

// ---------- M07/1 : Prérequis ----------
log('M07/1', 'Vérification du module M06');

for (const required of [
  path.join(API, 'app', 'Models', 'LabRequest.php'),
  path.join(API, 'app', 'Http', 'Controllers', 'LabRequestController.php'),
  path.join(WEB, 'src', 'views', 'LabView.vue'),
]) {
  if (!fs.existsSync(required)) {
    fail('M06 incomplet : fichier manquant ' + required + '. Relance "npm run m06".');
  }
}
ok('Module M06 opérationnel');

// ---------- M07/2 : Backend ----------
log('M07/2', 'Backend — catalogue, stock & dispensations');
installBackend();

// ---------- M07/3 : Migrations et permissions ----------
log('M07/3', 'Migrations et permissions');
run('php artisan migrate --force', API);
run('php artisan db:seed --class=PharmacyPermissionsSeeder --force', API);
ok('Migrations et permissions terminées');

// ---------- M07/4 : Frontend ----------
log('M07/4', 'Webapp Vue — page Pharmacie');
installFrontend();

// ---------- M07/5 : E2E ----------
await runE2e();

log('M07', 'Terminé');
console.log('');
console.log('Pharmacie : catalogue partagé, lots par établissement avec péremption,');
console.log('dispensation FEFO avec décrément transactionnel et isolation vérifiée.');
