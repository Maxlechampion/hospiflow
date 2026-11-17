#!/usr/bin/env node
// HOSPIFLOW — diagnostic « Unauthenticated. » page Rapports
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const WEB = path.join(ROOT, "web", "src");

function read(f) {
  try {
    return fs.readFileSync(f, "utf8");
  } catch {
    return "";
  }
}

function walk(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(full));
    else if (/\.(vue|js)$/.test(e.name)) out.push(full);
  }
  return out;
}

const files = walk(WEB);
let out = "HOSPIFLOW — DIAGNOSTIC M09 AUTH — " + new Date().toISOString() + "\n\n";

// 1. Reports.vue : imports + fonction load()
const reportsSrc = read(path.join(WEB, "views", "Reports.vue"));
out += "=== Reports.vue — 20 premières lignes ===\n" + reportsSrc.split("\n").slice(0, 20).join("\n") + "\n\n";
const loadIdx = reportsSrc.indexOf("async function load");
if (loadIdx !== -1) {
  out += "=== Reports.vue — fonction load() ===\n" + reportsSrc.slice(loadIdx, loadIdx + 800) + "\n\n";
}

// 2. Vue Facturation : imports + appels /invoices (la référence qui fonctionne)
const billing = files.find(
  (f) => /billing/i.test(path.basename(f)) && path.basename(f) !== "Reports.vue"
);
if (billing) {
  const bSrc = read(billing);
  const bLines = bSrc.split("\n");
  out += "=== " + path.relative(ROOT, billing) + " — imports ===\n";
  out += bLines.filter((l) => l.trim().startsWith("import ")).join("\n") + "\n\n";
  out += "=== " + path.relative(ROOT, billing) + " — lignes /invoices ===\n";
  out += bLines.filter((l) => l.includes("/invoices")).join("\n") + "\n\n";
}

// 3. Contenu intégral de web/src/api (petit, c'est la pièce maîtresse)
const apiDir = path.join(WEB, "api");
if (fs.existsSync(apiDir)) {
  for (const f of walk(apiDir)) {
    out += "=== " + path.relative(ROOT, f) + " (intégral) ===\n" + read(f) + "\n\n";
  }
}

// 4. Comment le jeton est attaché (Bearer / Authorization / localStorage / store)
out += "=== Gestion du jeton dans web/src (fichier:ligne) ===\n";
for (const f of files) {
  const src = read(f);
  if (!src) continue;
  src.split("\n").forEach((line, i) => {
    if (/Authorization|Bearer|sanctum|localStorage|getToken|access_token/i.test(line)) {
      out += path.relative(ROOT, f) + ":" + (i + 1) + ": " + line.trim().slice(0, 180) + "\n";
    }
  });
}

// 5. Où la session est enregistrée côté client (store auth)
const authFiles = files.filter((f) => /auth|user|session|store/i.test(path.basename(f)));
out += "\n=== Fichiers candidats auth/store ===\n";
for (const f of authFiles) {
  out += "- " + path.relative(ROOT, f) + "\n";
}

const dest = path.join(ROOT, "M09-diag.txt");
fs.writeFileSync(dest, out, "utf8");
console.log("Diagnostic écrit : M09-diag.txt (" + Math.round(fs.statSync(dest).size / 1024) + " Ko)");
console.log("Uploads-le dans le chat (ou colle son contenu) pour analyse.");
