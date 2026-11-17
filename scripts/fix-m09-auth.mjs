#!/usr/bin/env node
// HOSPIFLOW — correctif 401 « Unauthenticated. » page Rapports
// Cause : client api(path, { token }) — Reports.vue n'envoie pas le jeton Bearer.
// Ajoute useAuthStore + { token: auth.token } sur les 3 appels /reports/*.
// Corrige aussi le gabarit de frontend.mjs pour les régénérations.
// Idempotent : relançable sans risque.
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const REPORTS = path.join(ROOT, "web", "src", "views", "Reports.vue");
const FRONTEND = path.join(HERE, "m09", "frontend.mjs");

// ---------------------------------------------------------------------------
// 1. Reports.vue — import du store + jeton sur les 3 appels
// ---------------------------------------------------------------------------
if (!fs.existsSync(REPORTS)) {
  console.error("✗ Reports.vue introuvable : " + REPORTS);
  process.exit(1);
}

let vue = fs.readFileSync(REPORTS, "utf8");
let changed = false;

if (!vue.includes("useAuthStore")) {
  fs.copyFileSync(REPORTS, REPORTS + ".bak");

const importLine = "import { api } from '../api/client';";
  const authImport = "import { useAuthStore } from '../stores/auth';";

if (vue.includes(importLine)) {
    vue = vue.replace(importLine, importLine + "\n" + authImport);
    changed = true;
  } else {
    console.log("⚠ Ligne d'import du client non trouvée telle quelle — vérification manuelle");
  }

// Instanciation du store avant la première utilisation
  const anchor = "function unwrap(res) {";
  const storeLine = "const auth = useAuthStore();";

if (vue.includes(anchor) && !vue.includes(storeLine)) {
    vue = vue.replace(anchor, storeLine + "\n\n" + anchor);
    changed = true;
  }

// Jeton sur les 3 appels
  const callFixes = [
    ["api('/reports/overview' + query)", "api('/reports/overview' + query, { token: auth.token })"],
    ["api('/reports/revenue' + query)", "api('/reports/revenue' + query, { token: auth.token })"],
    ["api('/reports/stock')", "api('/reports/stock', { token: auth.token })"],
  ];

for (const [before, after] of callFixes) {
    if (vue.includes(before)) {
      vue = vue.split(before).join(after);
      changed = true;
      console.log("✓ Reports.vue : jeton ajouté sur " + before.slice(0, 26) + "…");
    }
  }

if (changed) {
    fs.writeFileSync(REPORTS, vue, "utf8");
  }
} else {
  console.log("= Reports.vue : useAuthStore déjà présent");
}

const vueNow = fs.readFileSync(REPORTS, "utf8");
let failures = 0;

for (const marker of [
  "useAuthStore",
  "const auth = useAuthStore();",
  "{ token: auth.token }",
]) {
  if (vueNow.includes(marker)) {
    console.log("✓ Reports.vue contient : " + marker);
  } else {
    console.error("✗ Reports.vue manque : " + marker);
    failures += 1;
  }
}

if ((vueNow.match(/\{ token: auth\.token \}/g) || []).length < 3) {
  console.error("✗ Reports.vue : moins de 3 appels avec jeton");
  failures += 1;
} else {
  console.log("✓ Reports.vue : les 3 appels /reports/* portent le jeton");
}

// ---------------------------------------------------------------------------
// 2. frontend.mjs — gabarit : mêmes correctifs pour les régénérations futures
// ---------------------------------------------------------------------------
let fe = fs.readFileSync(FRONTEND, "utf8");
let feChanged = false;

const templateFixes = [
  // Import du store dans le gabarit
  [
    "__IMPORT__\n\nfunction unwrap(res) {",
    "__IMPORT__\nimport { useAuthStore } from '../stores/auth';\n\nconst auth = useAuthStore();\n\nfunction unwrap(res) {",
  ],
  // Jeton dans les 3 appels du gabarit
  [
    "__GET__('/reports/overview' + query)",
    "__GET__('/reports/overview' + query, { token: auth.token })",
  ],
  [
    "__GET__('/reports/revenue' + query)",
    "__GET__('/reports/revenue' + query, { token: auth.token })",
  ],
  [
    "__GET__('/reports/stock')",
    "__GET__('/reports/stock', { token: auth.token })",
  ],
];

for (const [before, after] of templateFixes) {
  if (fe.includes(after)) {
    console.log("= frontend.mjs : correctif gabarit déjà en place");
  } else if (fe.includes(before)) {
    if (!feChanged) {
      fs.copyFileSync(FRONTEND, FRONTEND + ".bak");
    }
    fe = fe.replace(before, after);
    feChanged = true;
    console.log("✓ frontend.mjs : gabarit corrigé — " + before.slice(0, 40).replace("\n", " ") + "…");
  }
}

if (feChanged) {
  fs.writeFileSync(FRONTEND, fe, "utf8");
}

const feCheck = spawnSync(process.execPath, ["--check", FRONTEND], { encoding: "utf8" });

if (feCheck.status !== 0) {
  if (fs.existsSync(FRONTEND + ".bak")) {
    fs.copyFileSync(FRONTEND + ".bak", FRONTEND);
  }
  console.error("✗ node --check frontend.mjs a échoué — original restauré");
  console.error((feCheck.stderr || "").slice(0, 500));
  process.exit(1);
}
console.log("✓ frontend.mjs : syntaxe valide (node --check)");

// ---------------------------------------------------------------------------
// 3. Anti-corruption
// ---------------------------------------------------------------------------
for (const file of [REPORTS, FRONTEND]) {
  if (fs.readFileSync(file, "utf8").includes("<mark")) {
    console.error("✗ Corruption <mark dans " + path.relative(ROOT, file));
    failures += 1;
  }
}

console.log("");

if (failures === 0) {
  console.log("Correctif terminé — recharge la page Rapports (hot-reload Vite).");
} else {
  console.log(failures + " contrôle(s) en échec");
  process.exit(1);
}
