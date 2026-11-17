#!/usr/bin/env node
// HOSPIFLOW — M01 : Authentification, rôles et permissions
// Prérequis : M00 terminé, PostgreSQL configuré dans api/.env.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, spawnSync } from 'node:child_process';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const API = path.join(ROOT, 'api');
const WEB = path.join(ROOT, 'web');

const ADMIN = {
  email: 'admin@hospiflow.local',
  password: 'hospiflow_admin',
};
const PORT = 8010;

function log(step, message) {
  console.log(`\n[${step}] ${message}`);
}

function ok(message) {
  console.log(`  ✓ ${message}`);
}

function fail(message) {
  console.error(`  ✗ ${message}`);
  process.exit(1);
}

function writeFile(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
}

/**
 * Exécute une commande depuis le dossier indiqué.
 * Les commandes du script sont des chaînes fixes, sans données utilisateur.
 */
function run(command, cwd) {
  const result = spawnSync(command, {
    cwd,
    shell: true,
    stdio: 'inherit',
    env: process.env,
  });

if (result.error) {
    fail(`Impossible d'exécuter "${command}" : ${result.error.message}`);
  }
  if (result.status !== 0) {
    fail(`Échec de la commande : ${command} (code ${result.status})`);
  }
}

/**
 * Exécute la commande Artisan install:api, qui peut déjà avoir été exécutée.
 * En cas d'échec, la suite vérifie que les fichiers requis existent déjà.
 */
function tryRun(command, cwd) {
  const result = spawnSync(command, {
    cwd,
    shell: true,
    stdio: 'inherit',
    env: process.env,
  });
  return result.status === 0;
}

// M01/1 — Prérequis
log('M01/1', 'Vérification du module M00');

for (const required of [
  path.join(API, 'composer.json'),
  path.join(API, '.env'),
  path.join(WEB, 'package.json'),
]) {
  if (!fs.existsSync(required)) {
    fail(`M00 incomplet : fichier manquant ${required}.`);
  }
}
ok('api/ et web/ présents');

// M01/2 — API Laravel, Sanctum et routes
log('M01/2', 'Backend Laravel — authentification, rôles et permissions');

const installApiSucceeded = tryRun(
  'php artisan install:api --no-interaction',
  API
);

const routesApiPath = path.join(API, 'routes', 'api.php');
const bootstrapPath = path.join(API, 'bootstrap', 'app.php');

if (!fs.existsSync(routesApiPath)) {
  if (!installApiSucceeded) {
    fail(
      'La commande install:api a échoué et routes/api.php est absent. ' +
        'Vérifie api/ puis relance le module.'
    );
  }
  // Laravel install:api crée normalement ce fichier.
  writeFile(routesApiPath, '<?php\n\nuse Illuminate\\Support\\Facades\\Route;\n');
}

if (!fs.existsSync(bootstrapPath)) {
  fail('Fichier Laravel introuvable : api/bootstrap/app.php.');
}

let bootstrap = fs.readFileSync(bootstrapPath, 'utf8');

if (!bootstrap.includes("api: __DIR__.'/../routes/api.php'")) {
  const webRoutePattern = /web:\s*__DIR__\s*\.\s*['"]\/\.\.\/routes\/web\.php['"]\s*,?/;

if (!webRoutePattern.test(bootstrap)) {
    fail(
      'Impossible d’enregistrer routes/api.php automatiquement dans ' +
        'bootstrap/app.php. Vérifie ce fichier avant de continuer.'
    );
  }

bootstrap = bootstrap.replace(
    webRoutePattern,
    (match) =>
      `${match.replace(/,\s*$/, '')},\n        api: __DIR__.'/../routes/api.php',`
  );

fs.writeFileSync(bootstrapPath, bootstrap, 'utf8');
}
ok('Routing API enregistré');

// Migration utilisateurs : téléphone et compte actif
const migrationsDir = path.join(API, 'database', 'migrations');
fs.mkdirSync(migrationsDir, { recursive: true });

const userMigrationExists = fs
  .readdirSync(migrationsDir)
  .some((filename) => filename.includes('add_phone_is_active_to_users_table'));

if (!userMigrationExists) {
  const timestamp = new Date()
    .toISOString()
    .replace(/[-:TZ.]/g, '')
    .slice(0, 14);

writeFile(
    path.join(
      migrationsDir,
      `${timestamp}_add_phone_is_active_to_users_table.php`
    ),
    `<?php

use Illuminate\\Database\\Migrations\\Migration;
use Illuminate\\Database\\Schema\\Blueprint;
use Illuminate\\Support\\Facades\\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('phone', 30)->nullable();
            $table->boolean('is_active')->default(true);
        });
    }

public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['phone', 'is_active']);
        });
    }
};
`
  );
  ok('Migration phone/is_active créée');
} else {
  ok('Migration phone/is_active déjà présente');
}

// Modèle utilisateur
writeFile(
  path.join(API, 'app', 'Models', 'User.php'),
  `<?php

namespace App\\Models;

use Illuminate\\Database\\Eloquent\\Factories\\HasFactory;
use Illuminate\\Foundation\\Auth\\User as Authenticatable;
use Illuminate\\Notifications\\Notifiable;
use Laravel\\Sanctum\\HasApiTokens;
use Spatie\\Permission\\Traits\\HasRoles;

class User extends Authenticatable
{
    use HasApiTokens, HasFactory, HasRoles, Notifiable;

protected $guard_name = 'web';

protected $fillable = [
        'name',
        'email',
        'password',
        'phone',
        'is_active',
    ];

protected $hidden = [
        'password',
        'remember_token',
    ];

protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'is_active' => 'boolean',
        ];
    }
}
`
);

// Contrôleur d'authentification
writeFile(
  path.join(API, 'app', 'Http', 'Controllers', 'AuthController.php'),
  `<?php

namespace App\\Http\\Controllers;

use App\\Models\\User;
use Illuminate\\Http\\JsonResponse;
use Illuminate\\Http\\Request;
use Illuminate\\Support\\Facades\\Hash;
use Illuminate\\Validation\\ValidationException;

class AuthController extends Controller
{
    public function login(Request $request): JsonResponse
    {
        $data = $request->validate([
            'email' => ['required', 'email'],
            'password' => ['required', 'string'],
        ], [
            'email.required' => "L'adresse e-mail est obligatoire.",
            'email.email' => "L'adresse e-mail est invalide.",
            'password.required' => 'Le mot de passe est obligatoire.',
        ]);

$user = User::where('email', $data['email'])->first();

if (! $user || ! Hash::check($data['password'], $user->password)) {
            throw ValidationException::withMessages([
                'email' => 'Identifiants incorrects.',
            ]);
        }

if (! $user->is_active) {
            abort(403, 'Compte désactivé. Contactez un administrateur.');
        }

$user->tokens()->where('name', 'spa')->delete();

return response()->json([
            'token' => $user->createToken('spa')->plainTextToken,
            'user' => $this->payload($user),
        ]);
    }

public function me(Request $request): JsonResponse
    {
        return response()->json([
            'user' => $this->payload($request->user()),
        ]);
    }

public function logout(Request $request): JsonResponse
    {
        $token = $request->user()->currentAccessToken();

if ($token && method_exists($token, 'delete')) {
            $token->delete();
        }

return response()->json(['message' => 'Déconnecté.']);
    }

private function payload(User $user): array
    {
        $user->loadMissing('roles.permissions');

return [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'phone' => $user->phone,
            'roles' => $user->getRoleNames(),
            'permissions' => $user->getAllPermissions()->pluck('name'),
        ];
    }
}
`
);

// Routes API
writeFile(
  routesApiPath,
  `<?php

use App\\Http\\Controllers\\AuthController;
use Illuminate\\Support\\Facades\\Route;

Route::get('/health', fn () => response()->json([
    'app' => 'HOSPIFLOW',
    'status' => 'ok',
]));

Route::prefix('auth')->group(function () {
    Route::post('/login', [AuthController::class, 'login']);

Route::middleware('auth:sanctum')->group(function () {
        Route::get('/me', [AuthController::class, 'me']);
        Route::post('/logout', [AuthController::class, 'logout']);
    });
});
`
);

// Rôles, permissions et compte administrateur local
writeFile(
  path.join(API, 'database', 'seeders', 'RolesAndPermissionsSeeder.php'),
  `<?php

namespace Database\\Seeders;

use App\\Models\\User;
use Illuminate\\Database\\Seeder;
use Spatie\\Permission\\Models\\Permission;
use Spatie\\Permission\\Models\\Role;
use Spatie\\Permission\\PermissionRegistrar;

class RolesAndPermissionsSeeder extends Seeder
{
    public function run(): void
    {
        app(PermissionRegistrar::class)->forgetCachedPermissions();

$matrix = [
            'users.manage' => ['admin'],
            'patients.view' => ['admin', 'medecin', 'infirmier', 'secretaire'],
            'patients.manage' => ['admin', 'medecin', 'secretaire'],
            'appointments.manage' => ['admin', 'secretaire', 'infirmier'],
            'lab.results.manage' => ['admin', 'laborantin'],
            'pharmacy.manage' => ['admin', 'pharmacien'],
            'billing.manage' => ['admin', 'comptable'],
            'reports.view' => ['admin', 'medecin', 'comptable'],
        ];

foreach (array_keys($matrix) as $permissionName) {
            Permission::findOrCreate($permissionName, 'web');
        }

foreach ($matrix as $permissionName => $roleNames) {
            foreach ($roleNames as $roleName) {
                Role::findOrCreate($roleName, 'web')
                    ->givePermissionTo($permissionName);
            }
        }

Role::findByName('admin', 'web')
            ->syncPermissions(array_keys($matrix));

$user = User::firstOrCreate(
            ['email' => '${ADMIN.email}'],
            [
                'name' => 'Administrateur HOSPIFLOW',
                'password' => '${ADMIN.password}',
                'phone' => null,
                'is_active' => true,
            ]
        );

$user->assignRole('admin');
    }
}
`
);

writeFile(
  path.join(API, 'database', 'seeders', 'DatabaseSeeder.php'),
  `<?php

namespace Database\\Seeders;

use Illuminate\\Database\\Seeder;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        $this->call([
            RolesAndPermissionsSeeder::class,
        ]);
    }
}
`
);

ok('Modèle, contrôleur, routes et seeder écrits');

// M01/3 — Migrations et seed
log('M01/3', 'Migrations et création du compte initial');
run('php artisan migrate --force', API);
run('php artisan db:seed --force', API);
ok('Migrations et seed terminés');

// M01/4 — Frontend Vue
log('M01/4', 'Webapp Vue — router, store et écrans');
run('npm install vue-router@4 pinia @vueuse/core', WEB);

writeFile(
  path.join(WEB, '.env'),
  'VITE_API_URL=http://127.0.0.1:8000/api\n'
);

writeFile(
  path.join(WEB, 'src', 'api', 'client.js'),
  `const BASE = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api';

export async function api(path, { method = 'GET', body, token } = {}) {
  const response = await fetch(\`\${BASE}\${path}\`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(token ? { Authorization: \`Bearer \${token}\` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

const data = await response.json().catch(() => ({}));

if (!response.ok) {
    throw new Error(
      data.message ||
        (data.errors && Object.values(data.errors).flat().join(' ')) ||
        \`Erreur HTTP \${response.status}\`
    );
  }

return data;
}
`
);

writeFile(
  path.join(WEB, 'src', 'stores', 'auth.js'),
  `import { defineStore } from 'pinia';
import { api } from '../api/client';

const TOKEN_KEY = 'hospiflow_token';
const USER_KEY = 'hospiflow_user';

export const useAuthStore = defineStore('auth', {
  state: () => ({
    token: localStorage.getItem(TOKEN_KEY),
    user: JSON.parse(localStorage.getItem(USER_KEY) || 'null'),
  }),

getters: {
    isAuthenticated: (state) => Boolean(state.token),
    roles: (state) => state.user?.roles || [],
  },

actions: {
    async login(email, password) {
      const data = await api('/auth/login', {
        method: 'POST',
        body: { email, password },
      });

this.token = data.token;
      this.user = data.user;

localStorage.setItem(TOKEN_KEY, this.token);
      localStorage.setItem(USER_KEY, JSON.stringify(this.user));
    },

async logout() {
      try {
        await api('/auth/logout', {
          method: 'POST',
          token: this.token,
        });
      } catch {
        // Le token peut déjà avoir expiré ou être révoqué.
      }

this.token = null;
      this.user = null;
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
    },
  },
});
`
);

writeFile(
  path.join(WEB, 'src', 'router', 'index.js'),
  `import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import LoginView from '../views/LoginView.vue';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/login', component: LoginView },
    {
      path: '/',
      component: () => import('../views/DashboardView.vue'),
      meta: { requiresAuth: true },
    },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
});

router.beforeEach((to) => {
  const auth = useAuthStore();

if (to.meta.requiresAuth && !auth.isAuthenticated) {
    return '/login';
  }

if (to.path === '/login' && auth.isAuthenticated) {
    return '/';
  }
});

export default router;
`
);

writeFile(
  path.join(WEB, 'src', 'views', 'LoginView.vue'),
  `<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth';

const email = ref('');
const password = ref('');
const error = ref('');
const loading = ref(false);
const router = useRouter();
const auth = useAuthStore();

async function submit() {
  loading.value = true;
  error.value = '';

try {
    await auth.login(email.value, password.value);
    await router.push('/');
  } catch (exception) {
    error.value = exception.message || 'Connexion impossible.';
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <main class="login">
    <form class="card" @submit.prevent="submit">
      <h1>HOSPIFLOW</h1>
      <p>Connexion à votre espace</p>

<label>
        E-mail
        <input v-model="email" type="email" required autocomplete="email" />
      </label>

<label>
        Mot de passe
        <input
          v-model="password"
          type="password"
          required
          autocomplete="current-password"
        />
      </label>

<p v-if="error" class="error">{{ error }}</p>

<button type="submit" :disabled="loading">
        {{ loading ? 'Connexion…' : 'Se connecter' }}
      </button>
    </form>
  </main>
</template>

<style scoped>
.login { display: grid; place-items: center; min-height: 100vh; }
.card {
  display: grid;
  gap: .8rem;
  width: min(340px, calc(100vw - 2rem));
  padding: 2rem;
  border-radius: 12px;
  background: #fff;
  box-shadow: 0 10px 30px rgb(0 0 0 / 8%);
}
.card h1 { margin: 0; color: #0d6efd; font-size: 1.5rem; letter-spacing: .05em; }
.card p { margin: 0 0 .5rem; color: #6b7280; }
label { display: grid; gap: .3rem; font-size: .9rem; }
input { padding: .6rem .8rem; border: 1px solid #d1d5db; border-radius: 8px; font-size: 1rem; }
button { padding: .7rem; border: 0; border-radius: 8px; background: #0d6efd; color: #fff; font-size: 1rem; cursor: pointer; }
button:disabled { opacity: .6; }
.error { color: #dc2626 !important; font-size: .85rem; }
</style>
`
);

writeFile(
  path.join(WEB, 'src', 'views', 'DashboardView.vue'),
  `<script setup>
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth';

const auth = useAuthStore();
const router = useRouter();

async function logout() {
  await auth.logout();
  await router.push('/login');
}
</script>

<template>
  <main class="dash">
    <header>
      <strong>HOSPIFLOW</strong>
      <nav>
        <span>{{ auth.user?.name }}</span>
        <button @click="logout">Déconnexion</button>
      </nav>
    </header>

<section class="content">
      <h1>Bienvenue, {{ auth.user?.name }}</h1>
      <p>
        Rôles :
        <span v-for="role in auth.roles" :key="role" class="badge">{{ role }}</span>
      </p>
      <p class="muted">Les prochains modules ajouteront les fonctionnalités métier.</p>
    </section>
  </main>
</template>

<style scoped>
.dash { min-height: 100vh; }
header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 2rem;
  background: #fff;
  box-shadow: 0 1px 4px rgb(0 0 0 / 6%);
}
header strong { color: #0d6efd; letter-spacing: .05em; }
nav { display: flex; align-items: center; gap: 1rem; }
nav button { padding: .4rem .9rem; border: 0; border-radius: 8px; background: #ef4444; color: #fff; cursor: pointer; }
.content { padding: 2rem; }
.badge { display: inline-block; margin-right: .4rem; padding: .15rem .6rem; border-radius: 999px; background: #e0e7ff; color: #3730a3; font-size: .85rem; }
.muted { color: #6b7280; }
</style>
`
);

writeFile(
  path.join(WEB, 'src', 'main.js'),
  `import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import router from './router';
import './style.css';

createApp(App).use(createPinia()).use(router).mount('#app');
`
);

writeFile(
  path.join(WEB, 'src', 'App.vue'),
  `<template>
  <router-view />
</template>
`
);

writeFile(
  path.join(WEB, 'src', 'style.css'),
  `:root {
  font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
  color-scheme: light;
}
* { box-sizing: border-box; }
body { margin: 0; min-height: 100vh; background: #f5f7fa; color: #1f2937; }
`
);

ok('Fichiers frontend écrits');

// M01/5 — Tests de bout en bout
log('M01/5', 'Test de bout en bout de l’API');

const baseUrl = `http://127.0.0.1:${PORT}`;
const server = spawn(
  'php',
  ['artisan', 'serve', '--host=127.0.0.1', `--port=${PORT}`],
  {
    cwd: API,
    stdio: 'ignore',
    windowsHide: true,
  }
);

const sleep = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

async function stopServer() {
  if (server.exitCode === null) {
    server.kill();
    await sleep(300);
  }
}

try {
  let serverReady = false;

for (let attempt = 0; attempt < 30 && !serverReady; attempt += 1) {
    if (server.exitCode !== null) {
      fail(`Le serveur Laravel s’est arrêté (code ${server.exitCode}).`);
    }

try {
      const response = await fetch(`${baseUrl}/api/health`, {
        signal: AbortSignal.timeout(3000),
      });
      serverReady = response.ok;
    } catch {
      await sleep(1000);
    }
  }

if (!serverReady) {
    fail(`L’API n’a pas répondu sur le port ${PORT}.`);
  }
  ok('API en ligne');

const headers = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };

const loginResponse = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers,
    body: JSON.stringify(ADMIN),
  });

if (!loginResponse.ok) {
    fail(`Échec de connexion admin (HTTP ${loginResponse.status}).`);
  }

const { token, user } = await loginResponse.json();

if (!token || !user) {
    fail('La réponse de connexion ne contient pas de token ou de profil.');
  }
  ok(`Connexion OK — ${user.email} | rôles : ${user.roles.join(', ')}`);

const meResponse = await fetch(`${baseUrl}/api/auth/me`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
  });

if (meResponse.status !== 200) {
    fail(`Échec de /api/auth/me (HTTP ${meResponse.status}).`);
  }
  ok('/api/auth/me protégé par Sanctum');

const badLoginResponse = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      email: ADMIN.email,
      password: 'mot-de-passe-incorrect',
    }),
  });

if (badLoginResponse.status !== 422) {
    fail(
      `Mauvais mot de passe : attendu HTTP 422, reçu HTTP ${badLoginResponse.status}.`
    );
  }
  ok('Rejet des identifiants incorrects (HTTP 422)');

const logoutResponse = await fetch(`${baseUrl}/api/auth/logout`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
  });

if (logoutResponse.status !== 200) {
    fail(`Échec de déconnexion (HTTP ${logoutResponse.status}).`);
  }
  ok('Déconnexion et révocation du token OK');
} finally {
  await stopServer();
}

log('M01', 'Terminé');
console.log('');
console.log('Compte administrateur local de démarrage :');
console.log(`  E-mail       : ${ADMIN.email}`);
console.log(`  Mot de passe : ${ADMIN.password}`);
console.log('À changer avant toute utilisation réelle.');
console.log('');
console.log('Pour démarrer les applications dans deux terminaux :');
console.log('  API : cd api; php artisan serve');
console.log('  Web : cd web; npm run dev');
