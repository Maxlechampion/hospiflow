import fs from 'node:fs';
import path from 'node:path';
const BAK_SUFFIX = '.hospiflow-vague1.bak';
export function readFile(absPath) {
  if (!fs.existsSync(absPath)) throw new Error(`Fichier introuvable: ${absPath}`);
  return fs.readFileSync(absPath, 'utf8');
}
export function backupOnce(absPath) {
  const bak = absPath + BAK_SUFFIX;
  if (!fs.existsSync(bak)) fs.copyFileSync(absPath, bak);
  return bak;
}
export function writeFile(absPath, content) {
  const dir = path.dirname(absPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(absPath, content, 'utf8');
}
export function lineDelta(before, after) {
  const b = before.split('\n'); const a = after.split('\n');
  const maxLen = Math.max(b.length, a.length);
  let added = 0, removed = 0;
  for (let i = 0; i < maxLen; i++) {
    if (b[i] === undefined) added++;
    else if (a[i] === undefined) removed++;
    else if (b[i] !== a[i]) { added++; removed++; }
  }
  return { added, removed };
}
