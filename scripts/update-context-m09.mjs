#!/usr/bin/env node
// HOSPIFLOW — context.md : M09 terminé + conventions consolidées
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const FILE = path.join(ROOT, "context.md");
let md = fs.readFileSync(FILE, "utf8");
let changed = false;

fs.copyFileSync(FILE, FILE + ".bak");

// --- 1. Tableau : marquer M09 Terminé (ligne par ligne, sans regex) ---
const lines = md.split("\n");
let foundRow = false;

for (let i = 0; i < lines.length; i += 1) {
  const line = lines[i];
  if (line.startsWith("| M09 |")) {
    foundRow = true;
    if (line.includes("Terminé")) {
      console.log("= M09 déjà marqué Terminé");
      break;
    }
    if (line.includes("À faire")) {
      lines[i] = line.replace("À faire", "Terminé");
      changed = true;
      console.log("✓ M09 marqué Terminé");
      break;
    }
    console.log("⚠ Ligne M09 trouvée mais sans « À faire » — vérifiez :");
    console.log("  " + line);
    break;
  }
}

if (!foundRow) {
  console.log("⚠ Aucune ligne « | M09 | » dans le tableau — statut à corriger à la main");
}

md = lines.join("\n");

// --- 2. Retirer M09 de la section « Reste à faire » ---
const before = md;
md = md.split("\n").filter((l) => !/^- M09 :/.test(l)).join("\n");

if (md !== before) {
  changed = true;
  console.log("✓ M09 retiré de « Reste à faire »");
}

// --- 3. Ajouter les conventions M09 ---
const MARK = "## Conventions techniques consolidées (M09)";

if (!md.includes(MARK)) {
  md += "\n\n" + MARK + "\n\n"
    + "- Rapports : GET /api/reports/overview, /api/reports/revenue, /api/reports/stock (permission reports.view).\n"
    + "- Routeur webapp : web/src/router/index.js — chemins en français (/facturation, /rapports).\n"
    + "- Client API : web/src/api/client.js — api(chemin, { token, facilityId }), jeton Bearer explicite par appel.\n"
    + "- Générateurs M09 adaptatifs : tables résolues via migrations, client API détecté depuis la vue Facturation.\n"
    + "- Correctifs acquis : appels api(chemin) sans enveloppe (p), jeton d'authentification sur tous les appels /reports/*.\n";
  changed = true;
  console.log("✓ Conventions M09 ajoutées");
} else {
  console.log("= Conventions M09 déjà présentes");
}

if (changed) {
  fs.writeFileSync(FILE, md, "utf8");
  console.log("context.md à jour (sauvegarde : context.md.bak).");
} else {
  console.log("= context.md déjà à jour — aucune modification.");
}
