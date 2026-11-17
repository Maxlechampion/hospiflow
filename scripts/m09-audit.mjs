#!/usr/bin/env node
// HOSPIFLOW — audit du module M09 : vérification + export du code réel
// Usage : node scripts/m09-audit.mjs
// Sortie : M09-audit.txt à la racine (à uploader pour analyse)
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const API = path.join(ROOT, 'api');
const WEB = path.join(ROOT, 'web');

function walk(dir, exts) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walk(full, exts));
    } else if (exts.some((e) => entry.name.endsWith(e))) {
      out.push(full);
    }
  }
  return out;
}

function read(file) {
  try {
    return fs.readFileSync(file, 'utf8');
  } catch {
    return '';
  }
}

const checks = [];

function check(label, ok, detail) {
  checks.push({ label, ok: ok === true, detail: detail || '' });
}

// ---------- 1. Backend ----------
const controller = path.join(API, 'app', 'Http', 'Controllers', 'ReportController.php');
const controllerSrc = read(controller);
check('ReportController.php présent', controllerSrc.length > 0, path.relative(ROOT, controller));

if (controllerSrc.length > 0) {
  for (const method of ['function overview', 'function revenue', 'function stock']) {
    check('ReportController : ' + method, controllerSrc.includes(method));
  }
  check('Anti-corruption backslash', controllerSrc.includes('IlluminateSupport') === false);
  const lint = spawnSync('php', ['-l', controller], { encoding: 'utf8' });
  check('php -l ReportController.php', lint.status === 0, (lint.stdout || lint.stderr || '').trim());
}

const routesFile = path.join(API, 'routes', 'api.php');
const routesSrc = read(routesFile);
check('routes/api.php présent', routesSrc.length > 0);
check('Route reports/overview', routesSrc.includes('overview'));
check('Route reports/revenue', routesSrc.includes('revenue'));
check('Route reports/stock', routesSrc.includes('stock'));

if (routesSrc.length > 0) {
  const lintRoutes = spawnSync('php', ['-l', routesFile], { encoding: 'utf8' });
  check('php -l routes/api.php', lintRoutes.status === 0, (lintRoutes.stdout || lintRoutes.stderr || '').trim());
}

// ---------- 2. Frontend ----------
const webSources = walk(path.join(WEB, 'src'), ['.vue', '.js']);
const reportsVue = webSources.find((f) => path.basename(f).toLowerCase() === 'reports.vue');
check('Reports.vue présent', !!reportsVue, reportsVue ? path.relative(ROOT, reportsVue) : '');

let reportsSrc = '';
if (reportsVue) {
  reportsSrc = read(reportsVue);
  check('Reports.vue appelle /reports/overview', reportsSrc.includes('/reports/overview'));
  check('Reports.vue sans corruption <mark', reportsSrc.includes('<mark') === false);
}

const routerFile = webSources.find(
  (f) => path.basename(f) !== 'Reports.vue' && read(f).includes('Reports.vue')
);
check('Route câblée vers Reports.vue', !!routerFile,
  routerFile ? path.relative(ROOT, routerFile) : 'aucun fichier n\'importe Reports.vue');

let billingStillThere = false;
let menuLink = null;

for (const file of webSources) {
  const src = read(file);
  if (src.includes('BillingView') || src.includes('facturation')) {
    billingStillThere = true;
  }
  if (src.includes('Rapports') && (src.includes('/rapports') || src.includes('/reports'))) {
    menuLink = menuLink || path.relative(ROOT, file);
  }
}

check('Facturation toujours présente (non remplacée)', billingStillThere);
check('Lien/menu « Rapports » présent', !!menuLink, menuLink || '');

// ---------- 3. Scripts M09 ----------
const scriptFiles = [path.join(HERE, 'm09-reports.mjs')];
if (fs.existsSync(path.join(HERE, 'm09'))) {
  scriptFiles.push(...walk(path.join(HERE, 'm09'), ['.mjs']));
}

for (const file of scriptFiles) {
  const rel = path.relative(ROOT, file);

if (!fs.existsSync(file)) {
    check('Script ' + rel, false, 'introuvable');
    continue;
  }
  const lint = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  check('node --check ' + rel, lint.status === 0, (lint.stderr || '').trim().slice(0, 200));
  check('Sans corruption <mark : ' + rel, read(file).includes('<mark') === false);
}

const pkg = read(path.join(ROOT, 'package.json'));
check('Script npm m09 présent', pkg.includes('"m09"'));

// ---------- Rapport console ----------
console.log('');
console.log('=== AUDIT M09 ===');

let failures = 0;

for (const c of checks) {
  const icon = c.ok ? '✓' : '✗';

if (c.ok === false) {
    failures += 1;
  }
  console.log('  ' + icon + ' ' + c.label + (c.detail ? ' — ' + c.detail : ''));
}

console.log('');

if (failures === 0) {
  console.log('M09 : toutes les vérifications passent');
} else {
  console.log('M09 : ' + failures + ' vérification(s) en échec');
}

// ---------- Export du code réel ----------
const dumpFiles = [];

if (controllerSrc.length > 0) {
  dumpFiles.push([path.relative(ROOT, controller), controllerSrc]);
}
if (routesSrc.length > 0) {
  dumpFiles.push([path.relative(ROOT, routesFile), routesSrc]);
}
if (reportsSrc.length > 0) {
  dumpFiles.push([path.relative(ROOT, reportsVue), reportsSrc]);
}
if (routerFile) {
  dumpFiles.push([path.relative(ROOT, routerFile), read(routerFile)]);
}
for (const f of scriptFiles) {
  if (fs.existsSync(f)) {
    dumpFiles.push([path.relative(ROOT, f), read(f)]);
  }
}
const billingVue = webSources.find((f) => path.basename(f).toLowerCase().includes('billing'));

if (billingVue) {
  dumpFiles.push([path.relative(ROOT, billingVue), read(billingVue)]);
}

let out = 'HOSPIFLOW — AUDIT M09 — ' + new Date().toISOString() + '\n\n';
out += '=== RÉSULTATS DES VÉRIFICATIONS ===\n';

for (const c of checks) {
  const tag = c.ok ? '[OK]    ' : '[ECHEC] ';
  out += tag + c.label + (c.detail ? ' — ' + c.detail : '') + '\n';
}

out += '\n=== CONTENU INTÉGRAL DES FICHIERS ===\n';

for (const entry of dumpFiles) {
  out += '\n[FICHIER: ' + entry[0] + ']\n---8<---\n' + entry[1] + '\n---8<---\n[FIN: ' + entry[0] + ']\n';
}

const auditPath = path.join(ROOT, 'M09-audit.txt');
fs.writeFileSync(auditPath, out, 'utf8');

console.log('Code réel exporté : M09-audit.txt ('
  + Math.round(fs.statSync(auditPath).size / 1024) + ' Ko) — à uploader pour analyse');

process.exit(failures === 0 ? 0 : 1);
