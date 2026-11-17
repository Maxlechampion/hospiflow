#!/usr/bin/env node
// HOSPIFLOW — Module 00 : Bootstrap
// Crée le monorepo : API Laravel + Webapp Vue 3 + PostgreSQL (Docker),
// configure .env, applique les migrations et lance les tests.
// Idempotent : relançable sans risque (chaque étape se saute si déjà faite).
// Prérequis : Node >= 20, PHP >= 8.2, Composer >= 2, Docker (facultatif si PostgreSQL dispo).
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, API, WEB, log, ok, warn, fail, requireVersion, has, run, tryRun, write, sleep } from './lib.mjs';

const DB = { host: '127.0.0.1', port: '5432', db: 'hospiflow', user: 'hospiflow', pass: 'hospiflow_dev' };

// ---------- 1. Prérequis ----------
log('M00/1', 'Vérification des prérequis');
requireVersion('node', 20, 0, 'Installe Node.js LTS >= 20 depuis https://nodejs.org');
requireVersion('php', 8, 2, 'Installe PHP >= 8.2 (avec extensions pgsql, mbstring, openssl, pdo).');
requireVersion('composer', 2, 0, 'Installe Composer >= 2 depuis https://getcomposer.org');
if (!has('docker')) warn('Docker absent : utilise un PostgreSQL local accessible et vérifie api/.env.');

// ---------- 2. Infrastructure locale (PostgreSQL) ----------
log('M00/2', 'Infrastructure locale');
write(
  path.join(ROOT, 'docker-compose.yml'),
  `services:
  db:
    image: postgres:16-alpine
    container_name: hospiflow-db
    environment:
      POSTGRES_DB: ${DB.db}
      POSTGRES_USER: ${DB.user}
      POSTGRES_PASSWORD: ${DB.pass}
    ports:
      - "${DB.port}:5432"
    volumes:
      - hospiflow-db:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${DB.user} -d ${DB.db}"]
      interval: 5s
      timeout: 5s
      retries: 20

volumes:
  hospiflow-db:
`
);
if (has('docker')) run('docker compose up -d db', { cwd: ROOT });

// ---------- 3. API Laravel ----------
log('M00/3', 'API Laravel');
if (!fs.existsSync(path.join(API, 'composer.json'))) {
  run('composer create-project laravel/laravel api --no-interaction', { cwd: ROOT });
} else ok('api/ existe déjà — étape ignorée');

// Sanctum (API tokens) + Spatie Permission (rôles/permissions) — cf. context.md §11.2
run('composer require laravel/sanctum spatie/laravel-permission --no-interaction', { cwd: API });
run('php artisan vendor:publish --provider="Spatie\\Permission\\PermissionServiceProvider" --no-interaction', { cwd: API });

// .env : PostgreSQL + français (langue MVP, cf. context.md §5)
const envPath = path.join(API, '.env');
let env = fs.readFileSync(envPath, 'utf8');
const set = (k, v) => {
  const re = new RegExp(`^${k}=.*$`, 'm');
  env = re.test(env) ? env.replace(re, `${k}=${v}`) : `${env}\n${k}=${v}`;
};
set('APP_NAME', '"HOSPIFLOW"');
set('APP_LOCALE', 'fr');
set('APP_FAKER_LOCALE', 'fr_FR');
set('DB_CONNECTION', 'pgsql');
set('DB_HOST', DB.host);
set('DB_PORT', DB.port);
set('DB_DATABASE', DB.db);
set('DB_USERNAME', DB.user);
set('DB_PASSWORD', DB.pass);
fs.writeFileSync(envPath, env);
ok('.env configuré (PostgreSQL, locale fr)');
run('php artisan key:generate --force', { cwd: API });

// ---------- 4. Migrations (attend que PostgreSQL soit prêt) ----------
log('M00/4', 'Migrations');
let migrated = false;
for (let i = 1; i <= 30 && !migrated; i++) {
  migrated = tryRun('php artisan migrate --force', API);
  if (!migrated) {
    warn(`PostgreSQL pas prêt (tentative ${i}/30)…`);
    sleep(2000);
  }
}
if (!migrated) fail('PostgreSQL injoignable après 30 tentatives. Vérifie : docker compose logs db');
ok('Migrations appliquées');

// ---------- 5. Webapp Vue 3 ----------
log('M00/5', 'Webapp Vue 3');
if (!fs.existsSync(path.join(WEB, 'package.json'))) {
  run('npm create vite@latest web -- --template vue', { cwd: ROOT });
} else ok('web/ existe déjà — étape ignorée');
run('npm install', { cwd: WEB });
run('npm install vue-router@4 pinia @vueuse/core', { cwd: WEB });
// PWA/offline (M10) : préinstallation du plugin, la config viendra au module M10.
run('npm install -D vite-plugin-pwa', { cwd: WEB });

// ---------- 6. Vérifications finales ----------
log('M00/6', 'Vérifications');
run('php artisan test', { cwd: API });
run('npm run build', { cwd: WEB });

ok('Module 00 terminé : monorepo opérationnel.');
console.log('\nProchaine étape : "npm run m01" — Auth, rôles et permissions.');
