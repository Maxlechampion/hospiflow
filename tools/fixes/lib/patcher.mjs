import { readFile, writeFile, backupOnce, lineDelta } from './fs-utils.mjs';

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function applyOps(content, ops) {
  let mutated = content;
  for (const op of ops) {
    if (op.type === 'replace') {
      if (mutated.includes(op.from)) {
        mutated = mutated.split(op.from).join(op.to);
        continue;
      }
      const flexibleFrom = op.from.replace(/^ +/gm, '');
      if (mutated.includes(flexibleFrom)) {
        mutated = mutated.split(flexibleFrom).join(op.to.replace(/^ +/gm, ''));
        continue;
      }
      const fromLines = op.from.split('\n');
      const toLines = op.to.split('\n');
      const firstLine = fromLines[0].trimStart();
      const regex = new RegExp('^( *)' + escapeRegex(firstLine), 'm');
      const m = mutated.match(regex);
      if (m) {
        const indent = m[1];
        const normalizedFrom = fromLines.map((l) => l.trimStart()).join('\n');
        const normalizedTo = toLines.map((l) => indent + l.trimStart()).join('\n');
        if (mutated.includes(normalizedFrom)) {
          mutated = mutated.split(normalizedFrom).join(normalizedTo);
          continue;
        }
      }
      throw new Error('motif introuvable: ' + op.from.slice(0, 60) + '...');
    } else if (op.type === 'insertBefore') {
      if (mutated.includes(op.anchor)) {
        mutated = mutated.replace(op.anchor, op.text + op.anchor);
        continue;
      }
      const flexible = op.anchor.replace(/^ +/gm, '');
      if (mutated.includes(flexible)) {
        mutated = mutated.replace(flexible, op.text.replace(/^ +/gm, '') + flexible);
        continue;
      }
      throw new Error('ancre introuvable: ' + op.anchor.slice(0, 60) + '...');
    } else {
      throw new Error('type d\'op inconnu: ' + op.type);
    }
  }
  return mutated;
}

export function applyPatch(rootDir, patch, { dryRun = false } = {}) {
  const absPath = (rootDir + '/' + patch.file).replace(/\\\\/g, '/');
  let content;
  try { content = readFile(absPath); }
  catch (e) { return { id: patch.id, status: 'failed', message: e.message }; }
  if (patch.marker && content.includes(patch.marker)) {
    return { id: patch.id, status: 'skipped', message: 'déjà appliqué' };
  }
  let mutated;
  try {
    mutated = patch.customApply ? patch.newContent : applyOps(content, patch.ops);
  } catch (e) {
    return { id: patch.id, status: 'failed', message: e.message };
  }
  if (mutated === content) {
    return { id: patch.id, status: 'skipped', message: 'aucun changement' };
  }
  const delta = lineDelta(content, mutated);
  if (!dryRun) { backupOnce(absPath); writeFile(absPath, mutated); }
  if (patch.extraFiles) {
    for (const ef of patch.extraFiles) {
      const abs = (rootDir + '/' + ef.file).replace(/\\\\/g, '/');
      const current = (() => { try { return readFile(abs); } catch { return ''; } })();
      if (current.includes(ef.marker)) continue;
      if (!dryRun) { try { backupOnce(abs); } catch {} writeFile(abs, ef.content); }
    }
  }
  return { id: patch.id, status: 'applied', message: '+' + delta.added + '/-' + delta.removed + (dryRun ? ' (dry)' : ''), delta };
}
