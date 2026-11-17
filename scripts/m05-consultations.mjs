#!/usr/bin/env node
// HOSPIFLOW — M05 : Consultations & suivi clinique (orchestrateur)
// Prérequis : M04 terminé. Module découpé dans scripts/m05/.
import fs from 'node:fs';
import path from 'node:path';
import { API, WEB, log, ok, fail, run } from './m05/helpers.mjs';
import { installBackend } from './m05/backend.mjs';
import { installFrontend } from './m05/frontend.mjs';
import { runE2e } from './m05/e2e.mjs';

// ---------- M05/1 : Prérequis ----------
log('M05/1', 'Vérification du module M04');

for (const required of [
  path.join(API, 'app', 'Models', 'Appointment.php'),
  path.join(API, 'app', 'Http', 'Controllers', 'AppointmentController.php'),
  path.join(WEB, 'src', 'views', 'AppointmentsView.vue'),
]) {
  if (!fs.existsSync(required)) {
    fail('M04 incomplet : fichier manquant ' + required + '. Relance "npm run m04".');
  }
}
ok('Module M04 opérationnel');

// ---------- M05/2 : Backend ----------
log('M05/2', 'Backend — consultations & permissions cliniques');
installBackend();

// ---------- M05/3 : Migrations et permissions ----------
log('M05/3', 'Migrations et permissions');
run('php artisan migrate --force', API);
run('php artisan db:seed --class=ConsultationsPermissionsSeeder --force', API);
ok('Migrations et permissions terminées');

// ---------- M05/4 : Frontend ----------
log('M05/4', 'Webapp Vue — page Consultations');
installFrontend();

// ---------- M05/5 : E2E ----------
await runE2e();

log('M05', 'Terminé');
console.log('');
console.log('Consultations : comptes-rendus rattachés aux RDV, historique par patient,');
console.log('permissions cliniques restreintes et isolation vérifiée.');
