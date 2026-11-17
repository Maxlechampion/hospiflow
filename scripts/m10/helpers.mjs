#!/usr/bin/env node
// HOSPIFLOW — M04 : utilitaires partagés
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

export const ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..'
);
export const API = path.join(ROOT, 'api');
export const WEB = path.join(ROOT, 'web');

export function log(step, message) {
  console.log('\n[' + step + '] ' + message);
}

export function ok(message) {
  console.log('  ✓ ' + message);
}

export function fail(message) {
  console.error('  ✗ ' + message);
  process.exit(1);
}

export function writeFile(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
}

export function run(command, cwd) {
  const result = spawnSync(command, {
    cwd,
    shell: true,
    stdio: 'inherit',
    env: process.env,
  });

if (result.error) {
    fail('Impossible d\'exécuter "' + command + '" : ' + result.error.message);
  }

if (result.status !== 0) {
    fail('Échec de la commande : ' + command + ' (code ' + result.status + ')');
  }
}
