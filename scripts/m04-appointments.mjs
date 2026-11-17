#!/usr/bin/env node
// HOSPIFLOW — M04 : Rendez-vous & consultations (orchestrateur)
// Prérequis : M03 terminé (patients & MPI opérationnels).
// Le module est découpé dans scripts/m04/ : helpers, backend, frontend, e2e.
import fs from 'node:fs';
import path from 'node:path';
import { API, WEB, log, ok, fail, run } from './m04/helpers.mjs';
import { installBackend } from './m04/backend.mjs';
import { installFrontend } from './m04/frontend.mjs';
import { runE2e } from './m04/e2e.mjs';

// ---------- M04/1 : Prérequis ----------
log('M04/1', 'Vérification du module M03');

for (const required of [
  path.join(API, 'app', 'Models', 'Patient.php'),
  path.join(API, 'app', 'Http', 'Controllers', 'PatientController.php'),
  path.join(WEB, 'src', 'views', 'PatientsView.vue'),
]) {
  if (!fs.existsSync(required)) {
    fail('M03 incomplet : fichier manquant ' + required + '. Relance "npm run m03".');
  }
}
ok('Module M03 opérationnel');

// ---------- M04/2 : Backend ----------
log('M04/2', 'Backend — rendez-vous, agenda praticiens, conflits');
installBackend();

// ---------- M04/3 : Migrations ----------
log('M04/3', 'Migrations');
run('php artisan migrate --force', API);
ok('Migrations terminées');

// ---------- M04/4 : Frontend ----------
log('M04/4', 'Webapp Vue — page Rendez-vous');
installFrontend();

// ---------- M04/5 : E2E ----------
await runE2e();

log('M04', 'Terminé');
console.log('');
console.log('Rendez-vous : agenda par établissement, détection de conflits,');
console.log('statuts gérés et isolation entre établissements vérifiée.');
