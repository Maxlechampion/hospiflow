#!/usr/bin/env node
// HOSPIFLOW — Export intégral du projet dans un fichier txt
// Usage : node scripts/export-project.mjs
// Sortie : PROJECT-EXPORT.txt à la racine (manifeste + contenu complet de chaque fichier)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const OUT = path.join(ROOT, "PROJECT-EXPORT.txt");
const MAX_FILE_KB = 512; // les fichiers plus gros sont listés mais non dumpés

// --- Exclusions ---
const EXCLUDED_DIRS = new Set([
  "node_modules", "vendor", ".git", "dist", "build", "coverage",
  ".vite", "bootstrap/cache", "storage", "__pycache__", ".idea", ".vscode",
  "cache", "sessions", "views", "logs",
]);
const EXCLUDED_FILES = new Set([
  "package-lock.json", "composer.lock", "yarn.lock", "pnpm-lock.yaml",
  "PROJECT-EXPORT.txt", "phpunit.xml.result.cache",
]);
const EXCLUDED_SUFFIX = [".bak", ".log", ".zip", ".rar", ".7z", ".png", ".jpg", ".jpeg",
  ".gif", ".ico", ".woff", ".woff2", ".ttf", ".eot", ".pdf", ".exe", ".dll", ".map"];

// Extensions traitées comme texte (tout le reste est listé sans être dumpé)
const TEXT_EXT = new Set([
  ".php", ".js", ".mjs", ".cjs", ".vue", ".ts", ".json", ".md", ".txt", ".html",
  ".css", ".scss", ".yml", ".yaml", ".xml", ".env", ".example", ".gitignore",
  ".gitattributes", ".sql", ".ps1", ".svg", ".toml", ".editorconfig", ".htaccess",
]);
const TEXT_NAMES = new Set([".env", ".env.example", ".gitignore", ".htaccess"]);

function isTextFile(name) {
  const lower = name.toLowerCase();
  if (TEXT_NAMES.has(lower)) return true;
  return TEXT_EXT.has(path.extname(lower));
}

function isExcluded(relDir, name) {
  if (EXCLUDED_FILES.has(name)) return true;
  if (EXCLUDED_SUFFIX.some((s) => name.toLowerCase().endsWith(s))) return true;
  // Un composant du chemin relatif figure dans la liste noire (bootstrap/cache, storage…)
  const parts = relDir ? relDir.split(path.sep) : [];
  for (const p of parts) {
    if (EXCLUDED_DIRS.has(p.toLowerCase())) return true;
  }
  if (EXCLUDED_DIRS.has(name.toLowerCase())) return true;
  return false;
}

function walk(dir, relDir, out) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isSymbolicLink()) continue;
    if (isExcluded(relDir, entry.name)) continue;
    const full = path.join(dir, entry.name);
    const rel = relDir ? relDir + "/" + entry.name : entry.name;
    if (entry.isDirectory()) {
      walk(full, rel, out);
    } else if (entry.isFile()) {
      out.push({ full, rel });
    }
  }
}

// --- Collecte ---
const files = [];
walk(ROOT, "", files);
files.sort((a, b) => a.rel.localeCompare(b.rel));

// --- Rédaction ---
let dumped = 0;
let skippedBinary = 0;
let skippedLarge = 0;
const skippedList = [];

const header = [
  "================================================================================",
  "HOSPIFLOW — EXPORT INTÉGRAL DU PROJET",
  "Date       : " + new Date().toISOString(),
  "Racine     : " + ROOT,
  "Node       : " + process.version,
  "Fichiers   : " + files.length + " (dossiers vendor/node_modules/.git/dist/storage exclus)",
  "Format     : chaque fichier précédé de ===== CHEMIN ===== et du nombre de lignes",
  "Ce fichier sert à reprendre le développement dans un nouveau chat.",
  "Modules    : MVP complet M00 → M10 (voir context.md)",
  "================================================================================",
  "",
].join("\n");

fs.writeFileSync(OUT, header, "utf8");

for (const f of files) {
  let stat;
  try {
    stat = fs.statSync(f.full);
  } catch {
    continue;
  }

if (!isTextFile(f.rel)) {
    skippedBinary += 1;
    skippedList.push(f.rel + " (non-texte)");
    continue;
  }

if (stat.size > MAX_FILE_KB * 1024) {
    skippedLarge += 1;
    skippedList.push(f.rel + " (> " + MAX_FILE_KB + " Ko)");
    continue;
  }

const content = fs.readFileSync(f.full, "utf8");
  const lines = content.split("\n").length;
  const block =
    "\n===== " + f.rel + " ===== (" + lines + " lignes, "
    + Math.round(stat.size / 1024) + " Ko)\n" + content
    + (content.endsWith("\n") ? "" : "\n");
  fs.appendFileSync(OUT, block, "utf8");
  dumped += 1;
}

const footer = [
  "",
  "================================================================================",
  "STATISTIQUES DE L'EXPORT",
  "Fichiers dumpés      : " + dumped,
  "Non-texte (ignorés)  : " + skippedBinary,
  "Trop volumineux      : " + skippedLarge,
  "Total parcouru       : " + files.length,
  "================================================================================",
].join("\n") + "\n" + (skippedList.length ? "\nFichiers non dumpés :\n" + skippedList.map((s) => "- " + s).join("\n") + "\n" : "");

fs.appendFileSync(OUT, footer, "utf8");

const mb = (fs.statSync(OUT).size / (1024 * 1024)).toFixed(2);
console.log("✓ Export écrit : PROJECT-EXPORT.txt (" + mb + " Mo)");
console.log("  Fichiers dumpés : " + dumped + " / " + files.length + " (" + skippedBinary + " binaires ignorés, " + skippedLarge + " trop volumineux)");
if (skippedList.length) {
  console.log("  Ignorés (extrait) :");
  for (const s of skippedList.slice(0, 15)) console.log("    - " + s);
  if (skippedList.length > 15) console.log("    … et " + (skippedList.length - 15) + " autres");
}
if (parseFloat(mb) > 25) {
  console.log("⚠ Taille > 25 Mo — dis-le-moi, je te fournirai une variante qui découpe l'export en plusieurs fichiers.");
}
