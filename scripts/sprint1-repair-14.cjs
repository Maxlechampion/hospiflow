#!/usr/bin/env node
/**
 * HOSPIFLOW — Sprint 1.4 Repair (ReportController::export)
 * Patches ciblés par ancre — résistants aux variations d'espaces.
 */

const fs = require('node:fs');
const path = require('node:path');

const ROOT = process.cwd();
const API = path.join(ROOT, 'api');
const FILE = 'app/Http/Controllers/ReportController.php';
const FULL = path.join(API, FILE);

const APPLY = process.argv.includes('--apply');
const C = { r: '\x1b[0m', grn: '\x1b[32m', yel: '\x1b[33m', red: '\x1b[31m', cyn: '\x1b[36m', b: '\x1b[1m' };
const ok = m => console.log(`${C.grn}✅${C.r} ${m}`);
const warn = m => console.log(`${C.yel}⚠️${C.r}  ${m}`);
const err = m => console.log(`${C.red}❌${C.r} ${m}`);
const title = m => console.log(`\n${C.b}${C.cyn}━━━ ${m} ━━━${C.r}\n`);

if (!fs.existsSync(FULL)) { err(`Fichier absent : ${FULL}`); process.exit(1); }

let src = fs.readFileSync(FULL, 'utf8');
const original = src;
const results = [];

function patch(id, label, test, apply) {
    if (test()) { warn(`[${id}] ${label} — Déjà appliqué (skip)`); results.push('skip'); return; }
    const before = src;
    src = apply(src);
    if (src === before) { err(`[${id}] ${label} — Aucun changement effectué`); results.push('err'); return; }
    ok(`[${id}] ${label} — ${APPLY ? 'Appliqué' : 'Dry-run OK'}`);
    results.push('ok');
}

// ============================================================
// 1.4a — Permission reports.view
// ============================================================
patch(
    '1.4a',
    'Permission reports.view dans export()',
    () => src.includes("abort(403, 'Vous n\\'avez pas accès aux exports de rapports.')"),
    (s) => s.replace(
        /(    public function export\(Request \$request\)\r?\n    \{\r?\n)/,
        `$1        if (! $request->user()->can('reports.view')) {\n            abort(403, 'Vous n\\'avez pas accès aux exports de rapports.');\n        }\n\n`
    )
);

// ============================================================
// 1.4b — fputcsv vide → fwrite("\n")
// ============================================================
patch(
    '1.4b',
    'Ligne vide propre (fputcsv → fwrite)',
    () => src.includes('fwrite($file, "\\n");'),
    (s) => s.replace(
        /(\s*)fputcsv\(\$file, \[\]\); \/\/ Ligne vide/,
        '$1fwrite($file, "\\n");'
    )
);

// ============================================================
// 1.4c — helper $safe + csvSafe()
// ============================================================
patch(
    '1.4c',
    'Helper $safe + méthode csvSafe()',
    () => src.includes('private function csvSafe'),
    (s) => s
        // Injecter $safe juste après fprintf
        .replace(
            /(fprintf\(\$file, chr\(0xEF\)\.chr\(0xBB\)\.chr\(0xBF\)\);\r?\n)/,
            `$1\n            $safe = fn ($v) => $this->csvSafe((string) $v);\n`
        )
        // Ajouter csvSafe() après export()
        .replace(
            /(return response\(\)->stream\(\$callback, 200, \$headers\);\r?\n    \})/,
            `$1\n\n    /**\n     * Neutralise les formules CSV (=, +, -, @).\n     */\n    private function csvSafe(string $value): string\n    {\n        if ($value === '') {\n            return $value;\n        }\n\n        $firstChar = $value[0];\n\n        if (in_array($firstChar, ['=', '+', '-', '@', "\\t", "\\r"], true)) {\n            return "'".$value;\n        }\n\n        return $value;\n    }`
        )
);

// ============================================================
// 1.4d — Appliquer $safe() aux fputcsv textuels
// ============================================================
patch(
    '1.4d',
    'Appliquer $safe() aux cellules CSV',
    () => src.includes("$safe('RAPPORT D\\'ACTIVITÉ')"),
    (s) => s
        .replace(
            /fputcsv\(\$file, \['RAPPORT D\\'ACTIVITÉ', \$facility->name\]\);/,
            `fputcsv($file, [$safe('RAPPORT D\\'ACTIVITÉ'), $safe($facility->name)]);`
        )
        .replace(
            /fputcsv\(\$file, \['Période', \$from\.' au '\.\$to\]\);/,
            `fputcsv($file, [$safe('Période'), $safe($from.' au '.$to)]);`
        )
        .replace(
            /fputcsv\(\$file, \['Indicateur', 'Valeur'\]\);/,
            `fputcsv($file, [$safe('Indicateur'), $safe('Valeur')]);`
        )
        .replace(
            /fputcsv\(\$file, \['Total Patients', \$patientsTotal\]\);/,
            `fputcsv($file, [$safe('Total Patients'), $patientsTotal]);`
        )
        .replace(
            /fputcsv\(\$file, \['Nouveaux Patients \(période\)', \$newPatients\]\);/,
            `fputcsv($file, [$safe('Nouveaux Patients (période)'), $newPatients]);`
        )
        .replace(
            /fputcsv\(\$file, \['Consultations \(période\)', \$consultationsTotal\]\);/,
            `fputcsv($file, [$safe('Consultations (période)'), $consultationsTotal]);`
        )
        .replace(
            /fputcsv\(\$file, \['Chiffre d\\'affaires facturé \(période\)', \$billedTotal\]\);/,
            `fputcsv($file, [$safe('Chiffre d\\'affaires facturé (période)'), $billedTotal]);`
        )
        .replace(
            /fputcsv\(\$file, \['Encaissements \(période\)', \$paidInPeriod\]\);/,
            `fputcsv($file, [$safe('Encaissements (période)'), $paidInPeriod]);`
        )
);

// ============================================================
// RAPPORT
// ============================================================
title('RAPPORT 1.4');

const nOk = results.filter(r => r === 'ok').length;
const nSkip = results.filter(r => r === 'skip').length;
const nErr = results.filter(r => r === 'err').length;
console.log(`  ✅ OK       : ${nOk}`);
console.log(`  ⚠️  Skipped  : ${nSkip}`);
console.log(`  ❌ Erreurs  : ${nErr}`);

if (APPLY && nErr === 0) {
    // Backup
    const backupDir = path.join(ROOT, '.sprint1-repair-backups');
    if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    fs.writeFileSync(path.join(backupDir, `${ts}__ReportController.php`), original);

    fs.writeFileSync(FULL, src);
    ok(`\n✨ 1.4 terminé. Fichier écrit : api/${FILE}`);
} else if (!APPLY) {
    warn('\nDry-run. Relance avec --apply.');
} else {
    process.exit(1);
}