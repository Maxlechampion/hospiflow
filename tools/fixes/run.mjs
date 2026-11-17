import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { log, summary } from './lib/logger.mjs';
import { applyPatch } from './lib/patcher.mjs';
import p01 from './patches/01-patient-search-portable.mjs';
import p02 from './patches/02-report-portable.mjs';
import p03 from './patches/03-patient-update-fix.mjs';
import p04 from './patches/04-pharmacy-notes-fix.mjs';
import p05 from './patches/05-attach-user-secure.mjs';
import p06 from './patches/06-clean-agents-md.mjs';
import p07 from './patches/07-appointment-indent.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const onlyIdx = args.indexOf('--only');
const only = onlyIdx !== -1 ? args[onlyIdx + 1] : null;
const ALL = [p01, p02, p03, p04, p05, p06, p07];
const patches = only ? ALL.filter((p) => p.id === only) : ALL;

log.title(`HOSPIFLOW — Vague 1 ${dryRun ? '(DRY-RUN)' : ''}`);
log.info(`Racine projet : ${ROOT}`);
log.info(`Patches à exécuter : ${patches.length}`);

const results = [];
for (const patch of patches) {
  try {
    const r = applyPatch(ROOT, patch, { dryRun });
    results.push(r);
    if (r.status === 'applied') log.ok(`${patch.id} — ${r.message}`);
    else if (r.status === 'skipped') log.skip(`${patch.id} — ${r.message}`);
    else log.err(`${patch.id} — ${r.message}`);
  } catch (e) {
    results.push({ id: patch.id, status: 'failed', message: e.message });
    log.err(`${patch.id} — exception: ${e.message}`);
  }
}
summary(results);
if (dryRun) log.warn('DRY-RUN : aucun fichier modifié.');
