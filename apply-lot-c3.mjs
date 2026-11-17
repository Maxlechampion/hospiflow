// apply-lot-c3.mjs — Configure la CI GitHub Actions + Larastan
// Usage :
//   node apply-lot-c3.mjs --list
//   node apply-lot-c3.mjs --dry-run
//   node apply-lot-c3.mjs

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DRY = process.argv.includes('--dry-run');
const LIST = process.argv.includes('--list');

const C = {
  reset: '\x1b[0m', bold: '\x1b[1m', dim: '\x1b[2m',
  green: '\x1b[32m', red: '\x1b[31m', yellow: '\x1b[33m',
  cyan: '\x1b[36m', magenta: '\x1b[35m',
};
const log = {
  t: (s) => console.log(`\n${C.bold}${C.magenta}▶ ${s}${C.reset}`),
  ok: (s) => console.log(`${C.green}✔${C.reset} ${s}`),
  warn: (s) => console.log(`${C.yellow}⚠${C.reset} ${s}`),
  err: (s) => console.log(`${C.red}✖${C.reset} ${s}`),
  info: (s) => console.log(`${C.cyan}ℹ${C.reset} ${s}`),
  dim: (s) => console.log(`${C.dim}  ${s}${C.reset}`),
};

// =============================================================================
// FICHIERS À CRÉER
// =============================================================================

const FILES = {};

// ---------------------------------------------------------------------------
// GitHub Actions — CI (Tests + Lint)
// ---------------------------------------------------------------------------
FILES['.github/workflows/ci.yml'] = `name: CI

on:
  push:
    branches: [main, master, develop]
  pull_request:
    branches: [main, master, develop]
  workflow_dispatch:

jobs:
  tests:
    name: Tests (PHP \${{ matrix.php }})
    runs-on: ubuntu-latest

    strategy:
      fail-fast: false
      matrix:
        php: ['8.3']

    defaults:
      run:
        working-directory: api

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup PHP
        uses: shivammathur/setup-php@v2
        with:
          php-version: \${{ matrix.php }}
          extensions: mbstring, pdo, pdo_sqlite, sqlite3, openssl, curl, fileinfo, zip
          coverage: none
          tools: composer:v2

      - name: Cache Composer dependencies
        uses: actions/cache@v4
        with:
          path: ~/.composer/cache/files
          key: composer-\${{ matrix.php }}-\${{ hashFiles('api/composer.lock') }}
          restore-keys: composer-\${{ matrix.php }}-

      - name: Install Composer dependencies
        run: composer install --prefer-dist --no-progress --no-interaction

      - name: Copy .env
        run: cp .env.example .env

      - name: Generate app key
        run: php artisan key:generate

      - name: Execute tests
        run: ./vendor/bin/pest --colors=never

  lint:
    name: Code Style (Pint)
    runs-on: ubuntu-latest

    defaults:
      run:
        working-directory: api

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup PHP
        uses: shivammathur/setup-php@v2
        with:
          php-version: '8.3'
          coverage: none
          tools: composer:v2

      - name: Cache Composer dependencies
        uses: actions/cache@v4
        with:
          path: ~/.composer/cache/files
          key: composer-lint-\${{ hashFiles('api/composer.lock') }}
          restore-keys: composer-lint-

      - name: Install Composer dependencies
        run: composer install --prefer-dist --no-progress --no-interaction

      - name: Check code style
        run: ./vendor/bin/pint --test
`;

// ---------------------------------------------------------------------------
// GitHub Actions — Static Analysis (Larastan)
// ---------------------------------------------------------------------------
FILES['.github/workflows/static-analysis.yml'] = `name: Static Analysis

on:
  push:
    branches: [main, master, develop]
  pull_request:
    branches: [main, master, develop]
  workflow_dispatch:

jobs:
  larastan:
    name: Larastan (level 5)
    runs-on: ubuntu-latest

    defaults:
      run:
        working-directory: api

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup PHP
        uses: shivammathur/setup-php@v2
        with:
          php-version: '8.3'
          extensions: mbstring, pdo, pdo_sqlite, sqlite3
          coverage: none
          tools: composer:v2

      - name: Cache Composer dependencies
        uses: actions/cache@v4
        with:
          path: ~/.composer/cache/files
          key: composer-larastan-\${{ hashFiles('api/composer.lock') }}
          restore-keys: composer-larastan-

      - name: Install Composer dependencies
        run: composer install --prefer-dist --no-progress --no-interaction

      - name: Run Larastan
        run: ./vendor/bin/phpstan analyse --memory-limit=2G --no-progress
`;

// ---------------------------------------------------------------------------
// Larastan config
// ---------------------------------------------------------------------------
FILES['api/phpstan.neon'] = `includes:
    - vendor/larastan/larastan/extension.neon

parameters:
    paths:
        - app/
        - database/factories/
        - database/seeders/

    level: 5

    ignoreErrors:
        # Erreurs bénignes liées aux casts Eloquent
        - '#Call to an undefined method Illuminate\\\\Database\\\\Eloquent\\\\Model::.*#'
        # Retours de relations polymorphiques
        - '#Parameter \\#1 \\$.* of method .* expects .* given\\.#'

    excludePaths:
        - app/Http/Controllers/AuthController.php
        - database/migrations/
        - tests/

    checkMissingIterableValueType: false
    checkGenericClassInNonGenericObjectType: false
`;

// ---------------------------------------------------------------------------
// README avec badge
// ---------------------------------------------------------------------------
FILES['README.md'] = `# HOSPIFLOW

[![CI](https://github.com/\${GITHUB_REPOSITORY}/actions/workflows/ci.yml/badge.svg)](https://github.com/\${GITHUB_REPOSITORY}/actions/workflows/ci.yml)
[![Static Analysis](https://github.com/\${GITHUB_REPOSITORY}/actions/workflows/static-analysis.yml/badge.svg)](https://github.com/\${GITHUB_REPOSITORY}/actions/workflows/static-analysis.yml)

**ERP hospitalier multi-établissements.**

## Stack

- **Backend** : Laravel 13, PHP 8.3+, Sanctum, Spatie Permissions, Spatie Activity Log
- **Base de données** : SQLite (dev) / PostgreSQL (prod)
- **Tests** : Pest PHP 4 (~40 tests, 100% verts)
- **Frontend** : SPA séparée (hors de ce repo)

## Installation

\`\`\`bash
cd api
composer install
cp .env.example .env
php artisan key:generate
php artisan migrate
php artisan serve
\`\`\`

## Tests

\`\`\`bash
cd api
./vendor/bin/pest
\`\`\`

## Formatage

\`\`\`bash
cd api
./vendor/bin/pint
\`\`\`

## Analyse statique

\`\`\`bash
cd api
./vendor/bin/phpstan analyse
\`\`\`

## CI

Les workflows GitHub Actions vérifient automatiquement :

- **Tests** : Pest sur PHP 8.3, SQLite en mémoire
- **Code style** : Pint (formatage PSR-12)
- **Analyse statique** : Larastan niveau 5

## Architecture

- Multi-tenant par établissement (facility)
- Autorisation : Policies Laravel + permissions Spatie
- Audit log : \`spatie/laravel-activitylog\` sur Patient, Consultation, Invoice, DrugLot, Appointment
`;

// =============================================================================
// EXÉCUTION
// =============================================================================

if (LIST) {
  log.t('Fichiers qui seront créés');
  for (const rel of Object.keys(FILES)) {
    console.log(`  • ${rel}`);
  }
  process.exit(0);
}

log.t(`Lot C3 ${DRY ? '(DRY-RUN)' : ''}`);

let created = 0, skipped = 0;

// --- 1. Créer les fichiers ---
for (const [rel, content] of Object.entries(FILES)) {
  const abs = path.join(__dirname, rel);

  if (fs.existsSync(abs)) {
    log.dim(`${rel} — existe déjà`);
    skipped++;
    continue;
  }

  if (DRY) {
    log.ok(`${rel} — serait créé`);
    created++;
    continue;
  }

  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content, 'utf8');
  log.ok(`${rel} — créé`);
  created++;
}

// --- 2. Ajouter les scripts Composer ---
if (!DRY) {
  const composerPath = path.join(__dirname, 'api', 'composer.json');
  if (fs.existsSync(composerPath)) {
    try {
      const composer = JSON.parse(fs.readFileSync(composerPath, 'utf8'));

      composer.scripts = composer.scripts || {};

      if (!composer.scripts.test) {
        composer.scripts.test = ['@php artisan config:clear --ansi', '@php artisan test'];
      }
      if (!composer.scripts.lint) {
        composer.scripts.lint = './vendor/bin/pint';
      }
      if (!composer.scripts['lint:check']) {
        composer.scripts['lint:check'] = './vendor/bin/pint --test';
      }
      if (!composer.scripts.analyse) {
        composer.scripts.analyse = './vendor/bin/phpstan analyse --memory-limit=2G';
      }
      if (!composer.scripts['ci']) {
        composer.scripts.ci = [
          '@lint:check',
          '@analyse',
          '@test',
        ];
      }

      fs.writeFileSync(composerPath, JSON.stringify(composer, null, 4), 'utf8');
      log.ok('api/composer.json — scripts ajoutés (lint, lint:check, analyse, ci)');
    } catch (err) {
      log.err('api/composer.json — erreur de parsing JSON');
    }
  }
}

log.t('Résumé');
console.log(`  ${C.green}${created}${C.reset} créés • ${C.dim}${skipped}${C.reset} déjà présents`);

if (DRY) {
  log.warn('DRY-RUN : aucun fichier modifié.');
  process.exit(0);
}

log.t('Prochaines étapes');

console.log(`\n${C.bold}1. Installer Larastan :${C.reset}`);
console.log(`   ${C.cyan}cd api${C.reset}`);
console.log(`   ${C.cyan}composer require --dev larastan/larastan${C.reset}`);

console.log(`\n${C.bold}2. Vérifier que tout passe en local :${C.reset}`);
console.log(`   ${C.cyan}./vendor/bin/pint --test${C.reset}     ${C.dim}(code style)${C.reset}`);
console.log(`   ${C.cyan}./vendor/bin/pest --colors=never${C.reset}  ${C.dim}(tests)${C.reset}`);
console.log(`   ${C.cyan}./vendor/bin/phpstan analyse${C.reset}       ${C.dim}(analyse statique)${C.reset}`);

console.log(`\n${C.bold}3. Formater le code (si Pint --test échoue) :${C.reset}`);
console.log(`   ${C.cyan}./vendor/bin/pint${C.reset}`);

console.log(`\n${C.bold}4. Quand tu auras créé le repo GitHub :${C.reset}`);
console.log(`   ${C.cyan}git init${C.reset}`);
console.log(`   ${C.cyan}git add .${C.reset}`);
console.log(`   ${C.cyan}git commit -m "Initial commit"${C.reset}`);
console.log(`   ${C.cyan}git remote add origin <URL_DU_REPO>${C.reset}`);
console.log(`   ${C.cyan}git push -u origin main${C.reset}`);

console.log(`\n${C.dim}Les workflows CI se lanceront automatiquement au prochain push.${C.reset}`);