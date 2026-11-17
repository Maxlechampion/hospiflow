#!/usr/bin/env node
// HOSPIFLOW — patch automatique de scripts/m09/frontend.mjs
// Applique les 4 correctifs de détection/câblage de la page Rapports.
// Idempotent : relançable ; sauvegarde .bak ; node --check de contrôle.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FILE = path.join(HERE, 'm09', 'frontend.mjs');

if (!fs.existsSync(FILE)) {
  console.error('✗ Introuvable : ' + FILE);
  process.exit(1);
}

let src = fs.readFileSync(FILE, 'utf8');
fs.copyFileSync(FILE, FILE + '.bak');

const report = [];

// Remplace le bloc compris entre startMarker (inclus) et endMarker (inclus).
function replaceBlock(label, startMarker, endMarker, newBlock, alreadyMarker) {
  if (alreadyMarker && src.includes(alreadyMarker)) {
    report.push('= ' + label + ' : déjà correct');
    return;
  }

const start = src.indexOf(startMarker);

if (start === -1) {
    report.push('⚠ ' + label + ' : bloc introuvable (variante déjà différente ?)');
    return;
  }

const end = src.indexOf(endMarker, start + startMarker.length);

if (end === -1) {
    report.push('✗ ' + label + ' : fin de bloc introuvable — patch annulé, voir .bak');
    return;
  }

src = src.slice(0, start) + newBlock + src.slice(end + endMarker.length);
  report.push('✓ ' + label + ' : corrigé');
}

// ---------------------------------------------------------------------------
// Correctif 1 — billingToReports : gérer le chemin /facturation → /rapports
// ---------------------------------------------------------------------------
const NEW_BILLING = String.raw`function billingToReports(text) {
  return text
    .split('BillingView.vue').join('Reports.vue')
    .split('BillingView').join('ReportsView')
    .split('/facturation').join('/rapports')
    .split('Billing').join('Reports')
    .split('billing').join('reports')
    .split('Facturation').join('Rapports')
    .split('facturation').join('rapports');
}`;

replaceBlock(
  'billingToReports',
  'function billingToReports(text) {',
  '\n}',
  NEW_BILLING,
  "split('/facturation').join('/rapports')"
);

// ---------------------------------------------------------------------------
// Correctif 2 — ancres de cloneRegistrations : /facturation et Facturation
// ---------------------------------------------------------------------------
const NEW_ANCHORS = String.raw`  let anchor = null;

if (src.includes('BillingView')) {
    anchor = 'BillingView';
  } else if (src.includes('/facturation')) {
    anchor = '/facturation';
  } else if (src.includes('Facturation')) {
    anchor = 'Facturation';
  } else if (src.includes("'billing'")) {
    anchor = "'billing'";
  } else if (src.includes('"billing"')) {
    anchor = '"billing"';
  } else if (src.includes('/billing')) {
    anchor = '/billing';
  } else {
    return null;
  }`;

replaceBlock(
  'Ancres de détection',
  '  let anchor = null;',
  '    return null;\n  }',
  NEW_ANCHORS,
  "src.includes('/facturation')"
);

// Variante : version à fonction findAnchor(candidates) — mise à jour de la liste
if (src.includes('function findAnchor(')) {
  const oldCandidates = "const candidates = ['BillingView', 'Facturation', 'facturation', '/invoices', 'billing', 'Billing'];";

if (src.includes(oldCandidates)) {
    src = src.split(oldCandidates).join("const candidates = ['BillingView', '/facturation', 'Facturation', 'facturation', '/invoices', 'billing', 'Billing'];");
    report.push('✓ findAnchor : /facturation priorisé');
  } else if (src.includes("'/facturation', 'Facturation'")) {
    report.push('= findAnchor : déjà correct');
  }
}

// ---------------------------------------------------------------------------
// Correctif 3 — sélection des fichiers : détection insensible à la casse
// ---------------------------------------------------------------------------
const NEW_FILTER = String.raw`  const withBilling = allFiles.filter((file) => {
    const src = fs.readFileSync(file, 'utf8');

return /BillingView|\/facturation|Facturation|billing/i.test(src);
  });`;

replaceBlock(
  'Sélection des fichiers',
  'const withBilling = allFiles.filter(',
  '  );',
  NEW_FILTER,
  '/BillingView|\\/facturation|Facturation|billing/i.test(src)'
);

// ---------------------------------------------------------------------------
// Correctif 4 — filet de sécurité menu : ne plus exiger "billing" à côté
//               de "Facturation", et matcher le texte de ligne aussi
// ---------------------------------------------------------------------------
const NEW_NAV = String.raw`  const navCandidates = allFiles.filter((file) => {
    const src = fs.readFileSync(file, 'utf8');

if (!/Facturation|\/facturation/i.test(src)) {
      return false;
    }
    if (src.includes('Rapports')) {
      return false;
    }
    return true;
  });`;

replaceBlock(
  'Filtre navCandidates',
  'const navCandidates = allFiles.filter((file) => {',
  '  });',
  NEW_NAV,
  '/Facturation|\\/facturation/i.test(src)'
);

const oldLineChecks = "      if (!line.includes('Facturation')) {\n        continue;\n      }\n      if (!line.includes('billing')) {\n        continue;\n      }";
const newLineCheck = String.raw`      if (!/Facturation|\/facturation/i.test(line)) {
        continue;
      }`;

if (src.includes(oldLineChecks)) {
  src = src.split(oldLineChecks).join(newLineCheck);
  report.push('✓ Match de ligne (menu) : corrigé');
} else if (src.includes(newLineCheck)) {
  report.push('= Match de ligne (menu) : déjà correct');
} else {
  report.push('⚠ Match de ligne (menu) : motif introuvable (variante)');
}

// ---------------------------------------------------------------------------
// Écriture + contrôle de syntaxe
// ---------------------------------------------------------------------------
fs.writeFileSync(FILE, src, 'utf8');

const check = spawnSync(process.execPath, ['--check', FILE], { encoding: 'utf8' });

if (check.status !== 0) {
  fs.copyFileSync(FILE + '.bak', FILE);
  console.error('✗ node --check a échoué après le patch — original restauré depuis .bak');
  console.error(check.stderr);
  process.exit(1);
}

console.log('Patch de scripts/m09/frontend.mjs :');
for (const line of report) {
  console.log('  ' + line);
}

if (report.some((l) => l.startsWith('✗'))) {
  process.exit(1);
}

console.log('');
console.log('Syntaxe OK (node --check). Sauvegarde de l\'original : frontend.mjs.bak');
console.log('Prochaine étape : npm run m09');
