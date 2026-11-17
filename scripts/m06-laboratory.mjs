#!/usr/bin/env node
// HOSPIFLOW — M06 : Laboratoire (orchestrateur)
// Prérequis : M05 terminé. Module découpé dans scripts/m06/.
import fs from 'node:fs';
import path from 'node:path';
import { API, WEB, log, ok, fail, run } from './m06/helpers.mjs';
import { installBackend } from './m06/backend.mjs';
import { installFrontend } from './m06/frontend.mjs';
import { runE2e } from './m06/e2e.mjs';

// ---------- M06/1 : Prérequis ----------
log('M06/1', 'Vérification du module M05');

for (const required of [
  path.join(API, 'app', 'Models', 'Consultation.php'),
  path.join(API, 'app', 'Http', 'Controllers', 'ConsultationController.php'),
  path.join(WEB, 'src', 'views', 'ConsultationsView.vue'),
]) {
  if (!fs.existsSync(required)) {
    fail('M05 incomplet : fichier manquant ' + required + '. Relance "npm run m05".');
  }
}
ok('Module M05 opérationnel');

// ---------- M06/2 : Backend ----------
log('M06/2', 'Backend — demandes d\'analyses & résultats');
installBackend();

// ---------- M06/3 : Migrations et permissions ----------
log('M06/3', 'Migrations et permissions');
run('php artisan migrate --force', API);
run('php artisan db:seed --class=LabPermissionsSeeder --force', API);
ok('Migrations et permissions terminées');

// ---------- M06/4 : Frontend ----------
log('M06/4', 'Webapp Vue — page Laboratoire');
installFrontend();

// ---------- M06/5 : E2E ----------
await runE2e();

log('M06', 'Terminé');
console.log('');
console.log('Laboratoire : demandes d\'analyses prescrites et tracées, prise en charge,');
console.log('résultats horodatés, permissions restreintes et isolation vérifiée.');
