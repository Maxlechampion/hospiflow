#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const repoRoot = process.cwd();
const patchRoot = path.join(__dirname, '..', 'patch_files');
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const runChecks = args.includes('--verify');

function walk(dir, base = '') {
  let results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = path.join(base, entry.name);
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results = results.concat(walk(full, rel));
    } else if (entry.isFile()) {
      results.push(rel);
    }
  }
  return results;
}

const files = walk(patchRoot);
console.log(`HOSPIFLOW — Étape 1 Patcher (${files.length} fichiers) | dryRun=${dryRun}`);

for (const rel of files) {
  const src = path.join(patchRoot, rel);
  const dst = path.join(repoRoot, rel);
  if (dryRun) {
    console.log(`[DRY-RUN] Would write: ${rel}`);
    continue;
  }
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.copyFileSync(src, dst);
  console.log(`[APPLIED] ${rel}`);
}

if (!dryRun && runChecks) {
  const apiDir = path.join(repoRoot, 'api');
  if (!fs.existsSync(apiDir)) {
    console.warn('[WARN] Dossier ./api introuvable depuis la racine courante.');
    process.exit(0);
  }
  console.log('\n--- Exécution Pint + Larastan + Pest ---');
  execSync('./vendor/bin/pint && ./vendor/bin/phpstan analyse --memory-limit=2G && ./vendor/bin/pest --colors=never', {
    cwd: apiDir,
    stdio: 'inherit',
  });
}
