#!/usr/bin/env node
// HOSPIFLOW — correctif « p is not defined » (Reports.vue + frontend.mjs M09)
// Cause : client API de type api(chemin) enveloppé à tort en api(p)(chemin).
// Idempotent : relançable sans risque.
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const REPORTS = path.join(ROOT, "web", "src", "views", "Reports.vue");
const FRONTEND = path.join(HERE, "m09", "frontend.mjs");

let failures = 0;

// ---------------------------------------------------------------------------
// 1. Reports.vue : motif  nom(p)(  →  nom(
// ---------------------------------------------------------------------------
if (!fs.existsSync(REPORTS)) {
  console.error("✗ Reports.vue introuvable : " + REPORTS);
  process.exit(1);
}

let vue = fs.readFileSync(REPORTS, "utf8");
const wrapper = /\b([A-Za-z_$][\w.$]*)\(p\)\(/g;
const matches = [...vue.matchAll(wrapper)];

if (matches.length === 0) {
  console.log("= Reports.vue : aucun appel à enveloppe à corriger");
} else {
  fs.copyFileSync(REPORTS, REPORTS + ".bak");
  vue = vue.replace(wrapper, "$1(");
  fs.writeFileSync(REPORTS, vue, "utf8");
  const names = [...new Set(matches.map((m) => m[1]))].join(", ");
  console.log("✓ Reports.vue : " + matches.length + " appel(s) corrigé(s) — " + names);
}

const vueNow = fs.readFileSync(REPORTS, "utf8");

if (vueNow.includes("(p)(")) {
  console.error("✗ Reports.vue : des appels à enveloppe subsistent");
  failures += 1;
} else {
  console.log("✓ Reports.vue : plus aucun appel à enveloppe");
}

for (const endpoint of ["/reports/overview", "/reports/revenue", "/reports/stock"]) {
  if (vueNow.includes(endpoint)) {
    console.log("✓ Reports.vue appelle " + endpoint);
  } else {
    console.error("✗ Reports.vue n'appelle pas " + endpoint);
    failures += 1;
  }
}

// ---------------------------------------------------------------------------
// 2. frontend.mjs : getCall adaptatif (méthode .get vs fonction directe)
// ---------------------------------------------------------------------------
if (!fs.existsSync(FRONTEND)) {
  console.error("✗ frontend.mjs introuvable : " + FRONTEND);
  process.exit(1);
}

let fe = fs.readFileSync(FRONTEND, "utf8");
const oldLine = "const getCall = clientCall + '(p)';";
const newLine = "const getCall = clientCall.includes('.') ? clientCall + '(p)' : clientCall;";

if (fe.includes(newLine)) {
  console.log("= frontend.mjs : construction getCall déjà corrigée");
} else if (fe.includes(oldLine)) {
  fs.copyFileSync(FRONTEND, FRONTEND + ".bak");
  fe = fe.replace(oldLine, newLine);
  fs.writeFileSync(FRONTEND, fe, "utf8");
  console.log("✓ frontend.mjs : getCall adaptatif installé");
} else {
  console.log("⚠ frontend.mjs : ligne getCall introuvable — vérification manuelle nécessaire");
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
// 3. Contrôles anti-corruption
// ---------------------------------------------------------------------------
for (const file of [REPORTS, FRONTEND]) {
  const src = fs.readFileSync(file, "utf8");
  if (src.includes("<mark")) {
    console.error("✗ Corruption <mark détectée dans " + path.relative(ROOT, file));
    failures += 1;
  }
}

console.log("");

if (failures === 0) {
  console.log("Correctif terminé — recharge la page Rapports dans la webapp.");
  console.log("Si le serveur Vite tourne, le hot-reload suffit ; sinon : cd web puis npm run dev");
} else {
  console.log(failures + " contrôle(s) en échec — voir ci-dessus");
  process.exit(1);
}
