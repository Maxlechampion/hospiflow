#!/usr/bin/env node
// HOSPIFLOW — context.md : M10 terminé + MVP complet
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const FILE = path.join(ROOT, "context.md");
let md = fs.readFileSync(FILE, "utf8");
let changed = false;

fs.copyFileSync(FILE, FILE + ".bak");

// --- 1. Tableau : marquer M10 Terminé ---
const lines = md.split("\n");
let foundRow = false;

for (let i = 0; i < lines.length; i += 1) {
  const line = lines[i];
  if (line.startsWith("| M10 |")) {
    foundRow = true;
    if (line.includes("Terminé")) {
      console.log("= M10 déjà marqué Terminé");
    } else if (line.includes("À faire") || line.includes("En cours")) {
      lines[i] = line.replace(/À faire|En cours/, "Terminé");
      changed = true;
      console.log("✓ M10 marqué Terminé");
    } else {
      console.log("⚠ Ligne M10 trouvée mais statut non reconnu :");
      console.log("  " + line);
    }
    break;
  }
}

if (!foundRow) {
  console.log("⚠ Aucune ligne « | M10 | » dans le tableau — statut à corriger à la main");
}

md = lines.join("\n");

// --- 2. Retirer M10 de « Reste à faire » ---
const before = md;
md = md.split("\n").filter((l) => !/^- M10 :/.test(l)).join("\n");
if (md !== before) {
  changed = true;
  console.log("✓ M10 retiré de « Reste à faire »");
}

// --- 3. Section MVP complet + conventions M10 ---
const MARK = "## Conventions techniques consolidées (M10)";

if (!md.includes(MARK)) {
  md += "\n\n" + MARK + "\n\n"
    + "- MVP COMPLET : M00 → M10 tous terminés (" + new Date().toISOString().slice(0, 10) + ").\n"
    + "- PWA : web/public/manifest.webmanifest + web/public/sw.js (précache shell, cache-first assets, /api non intercepté).\n"
    + "- Hors ligne : web/src/api/offline.js + offline-db.js — file IndexedDB (store ops, clé X-Idempotency-Key).\n"
    + "- client.js v2 : écritures hors ligne mises en file ({ queued: true }), rejeu à la reconnexion (online + load).\n"
    + "- Backend : middleware IdempotencyKey (cache 24 h, X-Idempotent-Replay: true sur rejeu).\n"
    + "- En production : HTTPS obligatoire (Service Worker), npm run build, serveur web (Nginx/Apache) pour web/dist.\n";
  changed = true;
  console.log("✓ Conventions M10 + MVP complet ajoutés");
} else {
  console.log("= Conventions M10 déjà présentes");
}

if (changed) {
  fs.writeFileSync(FILE, md, "utf8");
  console.log("context.md à jour (sauvegarde : context.md.bak).");
} else {
  console.log("= context.md déjà à jour — aucune modification.");
}
