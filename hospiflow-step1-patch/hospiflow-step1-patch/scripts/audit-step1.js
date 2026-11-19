#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const apiDir = path.join(process.cwd(), 'api');
if (!fs.existsSync(apiDir)) {
  console.error('Exécute ce script depuis la racine du dépôt contenant /api.');
  process.exit(1);
}

const checks = [
  {
    file: 'app/Http/Requests/Pharmacy/DispenseRequest.php',
    mustContain: 'Dispensation::class',
    mustNotContain: 'DrugLot::class',
    desc: 'DispenseRequest autorise sur Dispensation::class',
  },
  {
    file: 'app/Policies/DrugLotPolicy.php',
    mustContain: 'pharmacy.catalog.manage',
    mustNotContain: 'pharmacy.manage',
    desc: 'DrugLotPolicy utilise pharmacy.catalog.manage',
  },
  {
    file: 'app/Http/Controllers/ConsultationController.php',
    mustContain: 'appointment->patient_id !== (int) $patient->id',
    mustNotContain: '$request->validate([',
    desc: 'ConsultationController vérifie la cohérence patient/RDV et utilise Form Requests',
  },
  {
    file: 'app/Http/Controllers/AppointmentController.php',
    mustContain: '$scheduleOrStatusChanged',
    mustNotContain: 'if (isset($data[\x27scheduled_at\x27])) {',
    desc: 'AppointmentController vérifie les conflits sur durée/statut/horaire',
  },
  {
    file: 'app/Http/Controllers/PrescriptionController.php',
    mustContain: 'AddPrescriptionItemRequest',
    mustNotContain: '$request->validate([',
    desc: 'PrescriptionController utilise AddPrescriptionItemRequest et Policies',
  },
  {
    file: 'app/Http/Controllers/ReportController.php',
    mustContain: "'expired_lots'",
    mustNotContain: null,
    desc: 'ReportController sépare lots expirés et lots bientôt périmés',
  },
];

let failed = 0;
for (const c of checks) {
  const full = path.join(apiDir, c.file);
  if (!fs.existsSync(full)) {
    console.log(`[MISSING] ${c.file} — ${c.desc}`);
    failed++;
    continue;
  }
  const content = fs.readFileSync(full, 'utf8');
  const okContain = !c.mustContain || content.includes(c.mustContain);
  const okNotContain = !c.mustNotContain || !content.includes(c.mustNotContain);
  if (okContain && okNotContain) {
    console.log(`[OK] ${c.desc}`);
  } else {
    console.log(`[PENDING/FAIL] ${c.desc} (${c.file})`);
    failed++;
  }
}

process.exit(failed > 0 ? 1 : 0);
