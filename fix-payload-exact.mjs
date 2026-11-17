// fix-payload-exact.mjs — Corrige les 4 erreurs argument.type en castant dans les callbacks
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FILE = path.join(__dirname, 'api', 'app', 'Http', 'Controllers', 'PatientController.php');

let content = fs.readFileSync(FILE, 'utf8');
const backup = FILE + '.payload-exact.bak';
if (!fs.existsSync(backup)) fs.copyFileSync(FILE, backup);

let changes = 0;

// 1. Supprimer l'assert inutile (créé dans le fix précédent)
const assertBlock = `    {
        assert($patient instanceof Patient);

        return [`;
if (content.includes(assertBlock)) {
  content = content.replace(assertBlock, `    {\n        return [`);
  changes++;
  console.log('✔ assert inutile supprimé');
}

// 2. Caster $p en Patient dans les 2 callbacks map()
const mapPattern = 'fn ($p) => $this->payload($p)';
const newMapPattern = 'fn (Patient $p) => $this->payload($p)';
const mapCount = (content.match(new RegExp(mapPattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
if (mapCount > 0) {
  content = content.replaceAll(mapPattern, newMapPattern);
  changes += mapCount;
  console.log(`✔ ${mapCount} callback(s) map() castés en Patient`);
}

// 3. Caster $existing (ligne 91)
const existingPattern = "            'patient' => $this->payload($existing->load('mpi:id,hospiflow_code')),";
const existingNew = "            'patient' => $this->payload($existing instanceof Patient ? $existing->load('mpi:id,hospiflow_code') : $existing),";
if (content.includes(existingPattern)) {
  content = content.replace(existingPattern, existingNew);
  changes++;
  console.log('✔ $existing casté en Patient (ligne 91)');
}

// 4. Caster $patient (ligne 110)
const patientPattern = "            ['patient' => $this->payload($patient->load('mpi:id,hospiflow_code'))],";
const patientNew = "            ['patient' => $this->payload($patient instanceof Patient ? $patient->load('mpi:id,hospiflow_code') : $patient)],";
if (content.includes(patientPattern)) {
  content = content.replace(patientPattern, patientNew);
  changes++;
  console.log('✔ $patient casté en Patient (ligne 110)');
}

if (changes === 0) {
  console.log('⚠ Aucun changement — le fichier est peut-être déjà corrigé');
  process.exit(0);
}

fs.writeFileSync(FILE, content, 'utf8');
console.log(`\n✔ ${changes} changement(s) appliqué(s)`);

console.log('\nProchaine étape :');
console.log('  cd api');
console.log('  ./vendor/bin/phpstan analyse --memory-limit=2G');