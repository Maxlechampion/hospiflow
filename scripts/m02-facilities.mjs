#!/usr/bin/env node
// HOSPIFLOW — M02 : Établissements (multi-tenant) & isolation stricte
// Prérequis : M01 terminé (auth Sanctum + Spatie opérationnels).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, spawnSync } from 'node:child_process';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const API = path.join(ROOT, 'api');
const WEB = path.join(ROOT, 'web');

const ADMIN = { email: 'admin@hospiflow.local', password: 'hospiflow_admin' };
const SECRETARY = { email: 'secretaire@hospiflow.local', password: 'hospiflow_sec' };
const PORT = 8011;

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

function run(command, cwd) {
  const result = spawnSync(command, { cwd, shell: true, stdio: 'inherit', env: process.env });
  if (result.error) fail(`Impossible d'exécuter "${command}" : ${result.error.message}`);
  if (result.status !== 0) fail(`Échec de la commande : ${command} (code ${result.status})`);
}

// ---------- M02/1 : Prérequis ----------
log('M02/1', 'Vérification du module M01');

for (const required of [
  path.join(API, 'routes', 'api.php'),
  path.join(API, 'app', 'Http', 'Controllers', 'AuthController.php'),
  path.join(API, '.env'),
]) {
  if (!fs.existsSync(required)) {
    fail(`M01 incomplet : fichier manquant ${required}. Relance "npm run m01".`);
  }
}
ok('API M01 opérationnelle');

// ---------- M02/2 : Backend ----------
log('M02/2', 'Backend — établissements, adhésions, isolation');

// 2a. Migration
const migrationsDir = path.join(API, 'database', 'migrations');
const migrationExists = fs
  .readdirSync(migrationsDir)
  .some((f) => f.includes('create_facilities_tables'));

if (!migrationExists) {
  const timestamp = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);

writeFile(
    path.join(migrationsDir, `${timestamp}_create_facilities_tables.php`),
    `<?php

use Illuminate\\Database\\Migrations\\Migration;
use Illuminate\\Database\\Schema\\Blueprint;
use Illuminate\\Support\\Facades\\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('facilities', function (Blueprint $table) {
            $table->id();
            $table->string('code', 20)->unique();
            $table->string('name');
            $table->string('city', 100)->nullable();
            $table->string('address', 255)->nullable();
            $table->string('phone', 30)->nullable();
            $table->string('email')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            $table->softDeletes();
        });

Schema::create('facility_user', function (Blueprint $table) {
            $table->id();
            $table->foreignId('facility_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->timestamps();
            $table->unique(['facility_id', 'user_id']);
        });

Schema::table('users', function (Blueprint $table) {
            $table
                ->foreignId('current_facility_id')
                ->nullable()
                ->constrained('facilities')
                ->nullOnDelete();
        });
    }

public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropConstrainedForeignId('current_facility_id');
        });
        Schema::dropIfExists('facility_user');
        Schema::dropIfExists('facilities');
    }
};
`
  );
  ok('Migration facilities/facility_user/current_facility_id créée');
} else {
  ok('Migration déjà présente');
}

// 2b. Modèle Facility
writeFile(
  path.join(API, 'app', 'Models', 'Facility.php'),
  `<?php

namespace App\\Models;

use Illuminate\\Database\\Eloquent\\Model;
use Illuminate\\Database\\Eloquent\\Relations\\BelongsToMany;
use Illuminate\\Database\\Eloquent\\SoftDeletes;

class Facility extends Model
{
    use SoftDeletes;

protected $fillable = [
        'code',
        'name',
        'city',
        'address',
        'phone',
        'email',
        'is_active',
    ];

protected $casts = [
        'is_active' => 'boolean',
    ];

public function users(): BelongsToMany
    {
        return $this->belongsToMany(User::class);
    }

public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }
}
`
);

// 2c. Modèle User (M01 + relations établissements)
writeFile(
  path.join(API, 'app', 'Models', 'User.php'),
  `<?php

namespace App\\Models;

use Illuminate\\Database\\Eloquent\\Factories\\HasFactory;
use Illuminate\\Database\\Eloquent\\Relations\\BelongsTo;
use Illuminate\\Database\\Eloquent\\Relations\\BelongsToMany;
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

public function facilities(): BelongsToMany
    {
        return $this->belongsToMany(Facility::class);
    }

public function currentFacility(): BelongsTo
    {
        return $this->belongsTo(Facility::class, 'current_facility_id');
    }

public function isMemberOf(Facility $facility): bool
    {
        return $this->facilities()
            ->where('facilities.id', $facility->id)
            ->exists();
    }
}
`
);

// 2d. Contrôleur FacilityController
writeFile(
  path.join(API, 'app', 'Http', 'Controllers', 'FacilityController.php'),
  `<?php

namespace App\\Http\\Controllers;

use App\\Models\\Facility;
use App\\Models\\User;
use Illuminate\\Http\\JsonResponse;
use Illuminate\\Http\\Request;

class FacilityController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();

$facilities = $user->can('facilities.manage')
            ? Facility::query()->orderBy('name')->get()
            : $user->facilities()->orderBy('name')->get();

return response()->json([
            'facilities' => $facilities,
            'current_facility_id' => $user->current_facility_id,
        ]);
    }

public function store(Request $request): JsonResponse
    {
        $this->authorizeManage($request);

$data = $request->validate([
            'code' => ['required', 'string', 'max:20', 'unique:facilities,code'],
            'name' => ['required', 'string', 'max:255'],
            'city' => ['nullable', 'string', 'max:100'],
            'address' => ['nullable', 'string', 'max:255'],
            'phone' => ['nullable', 'string', 'max:30'],
            'email' => ['nullable', 'email'],
        ], [
            'code.required' => 'Le code établissement est obligatoire.',
            'code.unique' => 'Ce code établissement existe déjà.',
            'name.required' => 'Le nom de l\\'établissement est obligatoire.',
        ]);

$facility = Facility::create($data);
        $request->user()->facilities()->syncWithoutDetaching([$facility->id]);

return response()->json(['facility' => $facility], 201);
    }

public function update(Request $request, Facility $facility): JsonResponse
    {
        $this->authorizeManage($request);

$data = $request->validate([
            'name' => ['sometimes', 'required', 'string', 'max:255'],
            'city' => ['nullable', 'string', 'max:100'],
            'address' => ['nullable', 'string', 'max:255'],
            'phone' => ['nullable', 'string', 'max:30'],
            'email' => ['nullable', 'email'],
            'is_active' => ['sometimes', 'boolean'],
        ]);

$facility->update($data);

return response()->json(['facility' => $facility->fresh()]);
    }

public function switch(Request $request, Facility $facility): JsonResponse
    {
        $user = $request->user();

if (! $user->isMemberOf($facility)) {
            abort(403, 'Vous n\\'êtes pas membre de cet établissement.');
        }

if (! $facility->is_active) {
            abort(403, 'Cet établissement est désactivé.');
        }

$user->forceFill(['current_facility_id' => $facility->id])->save();

return response()->json([
            'message' => 'Établissement actif mis à jour.',
            'current_facility_id' => $facility->id,
        ]);
    }

public function attachUser(Request $request, Facility $facility): JsonResponse
    {
        $this->authorizeManage($request);

$data = $request->validate([
            'email' => ['required', 'email', 'exists:users,email'],
        ], [
            'email.exists' => 'Aucun utilisateur avec cette adresse e-mail.',
        ]);

$target = User::where('email', $data['email'])->firstOrFail();
        $facility->users()->syncWithoutDetaching([$target->id]);

return response()->json([
            'message' => 'Utilisateur rattaché à l\\'établissement.',
            'user_id' => $target->id,
            'facility_id' => $facility->id,
        ]);
    }

private function authorizeManage(Request $request): void
    {
        if (! $request->user()->can('facilities.manage')) {
            abort(403, 'Action réservée aux administrateurs.');
        }
    }
}
`
);

// 2e. Routes API (complètes : auth + facilities)
writeFile(
  path.join(API, 'routes', 'api.php'),
  `<?php

use App\\Http\\Controllers\\AuthController;
use App\\Http\\Controllers\\FacilityController;
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

Route::middleware('auth:sanctum')->prefix('facilities')->group(function () {
    Route::get('/', [FacilityController::class, 'index']);
    Route::post('/', [FacilityController::class, 'store']);
    Route::patch('/{facility}', [FacilityController::class, 'update'])->scopeBindings();
    Route::post('/{facility}/switch', [FacilityController::class, 'switch'])->scopeBindings();
    Route::post('/{facility}/users', [FacilityController::class, 'attachUser'])->scopeBindings();
});
`
);

// 2f. Seeder : permissions + établissements de démarrage
writeFile(
  path.join(API, 'database', 'seeders', 'FacilitiesSeeder.php'),
  `<?php

namespace Database\\Seeders;

use App\\Models\\Facility;
use App\\Models\\User;
use Illuminate\\Database\\Seeder;
use Spatie\\Permission\\Models\\Permission;
use Spatie\\Permission\\Models\\Role;
use Spatie\\Permission\\PermissionRegistrar;

class FacilitiesSeeder extends Seeder
{
    public function run(): void
    {
        app(PermissionRegistrar::class)->forgetCachedPermissions();

$view = Permission::findOrCreate('facilities.view', 'web');
        $manage = Permission::findOrCreate('facilities.manage', 'web');

Role::findByName('admin', 'web')->givePermissionTo([$view, $manage]);

foreach (['medecin', 'infirmier', 'secretaire', 'laborantin', 'pharmacien', 'comptable'] as $roleName) {
            Role::findOrCreate($roleName, 'web')->givePermissionTo($view);
        }

$csm = Facility::firstOrCreate(
            ['code' => 'CSM'],
            [
                'name' => 'Clinique Saint-Michel',
                'city' => 'Cotonou',
                'address' => 'Zone résidentielle, Cotonou',
                'phone' => '+229 21 00 00 00',
                'is_active' => true,
            ]
        );

$href = Facility::firstOrCreate(
            ['code' => 'HREF'],
            [
                'name' => 'Hôpital de Référence',
                'city' => 'Porto-Novo',
                'address' => 'Avenue de la République, Porto-Novo',
                'phone' => '+229 21 00 00 01',
                'is_active' => true,
            ]
        );

$admin = User::where('email', 'admin@hospiflow.local')->firstOrFail();
        $admin->facilities()->syncWithoutDetaching([$csm->id, $href->id]);

if (! $admin->current_facility_id) {
            $admin->forceFill(['current_facility_id' => $csm->id])->save();
        }

$secretary = User::firstOrCreate(
            ['email' => 'secretaire@hospiflow.local'],
            [
                'name' => 'Secrétaire Démarrage',
                'password' => 'hospiflow_sec',
                'is_active' => true,
            ]
        );
        $secretary->assignRole('secretaire');
        $secretary->facilities()->syncWithoutDetaching([$csm->id]);

if (! $secretary->current_facility_id) {
            $secretary->forceFill(['current_facility_id' => $csm->id])->save();
        }
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
            FacilitiesSeeder::class,
        ]);
    }
}
`
);
ok('Modèle, contrôleur, routes et seeders écrits');

// ---------- M02/3 : Migrations & seed ----------
log('M02/3', 'Migrations et seed');
run('php artisan migrate --force', API);
run('php artisan db:seed --force', API);
ok('Migrations et seed terminés');

// ---------- M02/4 : Frontend ----------
log('M02/4', 'Webapp Vue — page Établissements');

writeFile(
  path.join(WEB, 'src', 'api', 'client.js'),
  `const BASE = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api';

export async function api(path, { method = 'GET', body, token, facilityId } = {}) {
  const response = await fetch(\`\${BASE}\${path}\`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(token ? { Authorization: \`Bearer \${token}\` } : {}),
      ...(facilityId ? { 'X-Facility-Id': String(facilityId) } : {}),
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
const FACILITY_KEY = 'hospiflow_facility';

export const useAuthStore = defineStore('auth', {
  state: () => ({
    token: localStorage.getItem(TOKEN_KEY),
    user: JSON.parse(localStorage.getItem(USER_KEY) || 'null'),
    currentFacilityId: localStorage.getItem(FACILITY_KEY),
  }),

getters: {
    isAuthenticated: (state) => Boolean(state.token),
    roles: (state) => state.user?.roles || [],
    canManageFacilities: (state) =>
      (state.user?.permissions || []).includes('facilities.manage'),
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

async loadFacilities() {
      const data = await api('/facilities', { token: this.token });
      this.currentFacilityId = data.current_facility_id;
      localStorage.setItem(FACILITY_KEY, this.currentFacilityId || '');
      return data.facilities;
    },

async switchFacility(facilityId) {
      const data = await api('/facilities/' + facilityId + '/switch', {
        method: 'POST',
        token: this.token,
      });
      this.currentFacilityId = data.current_facility_id;
      localStorage.setItem(FACILITY_KEY, this.currentFacilityId || '');
    },

async logout() {
      try {
        await api('/auth/logout', { method: 'POST', token: this.token });
      } catch {
        // Token peut être déjà révoqué ou expiré.
      }

this.token = null;
      this.user = null;
      this.currentFacilityId = null;
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
      localStorage.removeItem(FACILITY_KEY);
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
    {
      path: '/facilities',
      component: () => import('../views/FacilitiesView.vue'),
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
  path.join(WEB, 'src', 'views', 'FacilitiesView.vue'),
  `<script setup>
import { computed, onMounted, ref } from 'vue';
import { api } from '../api/client';
import { useAuthStore } from '../stores/auth';

const auth = useAuthStore();

const facilities = ref([]);
const currentFacilityId = ref(null);
const error = ref('');
const loading = ref(false);

const code = ref('');
const name = ref('');
const city = ref('');

const canManage = computed(() => auth.canManageFacilities);

async function load() {
  loading.value = true;
  error.value = '';
  try {
    const data = await api('/facilities', { token: auth.token });
    facilities.value = data.facilities;
    currentFacilityId.value = data.current_facility_id;
    auth.currentFacilityId = data.current_facility_id;
  } catch (exception) {
    error.value = exception.message;
  } finally {
    loading.value = false;
  }
}

async function createFacility() {
  error.value = '';
  try {
    await api('/facilities', {
      method: 'POST',
      token: auth.token,
      body: {
        code: code.value.trim(),
        name: name.value.trim(),
        city: city.value.trim() || null,
      },
    });
    code.value = '';
    name.value = '';
    city.value = '';
    await load();
  } catch (exception) {
    error.value = exception.message;
  }
}

async function switchFacility(facilityId) {
  error.value = '';
  try {
    await auth.switchFacility(facilityId);
    currentFacilityId.value = auth.currentFacilityId;
  } catch (exception) {
    error.value = exception.message;
  }
}

onMounted(load);
</script>

<template>
  <main class="page">
    <header>
      <strong>HOSPIFLOW</strong>
      <router-link to="/">Tableau de bord</router-link>
    </header>

<section class="content">
      <h1>Établissements</h1>
      <p class="muted">
        Votre établissement actif détermine les données visibles dans les
        prochains modules.
      </p>

<p v-if="error" class="error">{{ error }}</p>

<table v-if="facilities.length">
        <thead>
          <tr>
            <th>Code</th>
            <th>Nom</th>
            <th>Ville</th>
            <th>Statut</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="facility in facilities" :key="facility.id">
            <td>{{ facility.code }}</td>
            <td>{{ facility.name }}</td>
            <td>{{ facility.city }}</td>
            <td>{{ facility.is_active ? 'Actif' : 'Désactivé' }}</td>
            <td>
              <button
                v-if="facility.id !== currentFacilityId"
                :disabled="!facility.is_active"
                @click="switchFacility(facility.id)"
              >
                Définir actif
              </button>
              <span v-else class="badge">Actif</span>
            </td>
          </tr>
        </tbody>
      </table>

<p v-else-if="!loading">Aucun établissement rattaché à votre compte.</p>

<form v-if="canManage" class="create" @submit.prevent="createFacility">
        <h2>Créer un établissement</h2>
        <label>
          Code
          <input v-model="code" required maxlength="20" placeholder="CLIN01" />
        </label>
        <label>
          Nom
          <input v-model="name" required placeholder="Clinique Nouvelle Espérance" />
        </label>
        <label>
          Ville
          <input v-model="city" placeholder="Cotonou" />
        </label>
        <button type="submit">Créer</button>
      </form>
    </section>
  </main>
</template>

<style scoped>
.page { min-height: 100vh; }
header {
  display: flex;
  gap: 1.5rem;
  align-items: center;
  padding: 1rem 2rem;
  background: #fff;
  box-shadow: 0 1px 4px rgb(0 0 0 / 6%);
}
header strong { color: #0d6efd; letter-spacing: .05em; }
header a { color: #1f2937; text-decoration: none; }
header a:hover { text-decoration: underline; }
.content { padding: 2rem; max-width: 900px; }
.muted { color: #6b7280; }
.error { color: #dc2626; }
table { border-collapse: collapse; width: 100%; background: #fff; border-radius: 8px; overflow: hidden; }
th, td { padding: .6rem .8rem; border-bottom: 1px solid #e5e7eb; text-align: left; }
th { background: #f3f4f6; }
button { padding: .4rem .8rem; border: 0; border-radius: 8px; background: #0d6efd; color: #fff; cursor: pointer; }
button:disabled { opacity: .5; cursor: not-allowed; }
.badge { background: #dcfce7; color: #166534; padding: .15rem .6rem; border-radius: 999px; font-size: .85rem; }
.create { margin-top: 2rem; display: grid; gap: .6rem; max-width: 420px; background: #fff; padding: 1.5rem; border-radius: 8px; }
.create h2 { margin: 0 0 .5rem; font-size: 1.1rem; }
label { display: grid; gap: .25rem; font-size: .9rem; }
input { padding: .5rem .7rem; border: 1px solid #d1d5db; border-radius: 8px; }
</style>
`
);

// Dashboard : lien vers Établissements + affichage de l'établissement actif
writeFile(
  path.join(WEB, 'src', 'views', 'DashboardView.vue'),
  `<script setup>
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth';

const auth = useAuthStore();
const router = useRouter();
const currentFacilityName = ref('');

async function logout() {
  await auth.logout();
  await router.push('/login');
}

onMounted(async () => {
  try {
    const facilities = await auth.loadFacilities();
    const current = facilities.find(
      (facility) => facility.id === auth.currentFacilityId
    );
    currentFacilityName.value = current ? current.name : '';
  } catch {
    currentFacilityName.value = '';
  }
});
</script>

<template>
  <main class="dash">
    <header>
      <strong>HOSPIFLOW</strong>
      <nav>
        <router-link to="/facilities">Établissements</router-link>
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
      <p v-if="currentFacilityName">
        Établissement actif : <strong>{{ currentFacilityName }}</strong>
      </p>
      <p class="muted">Module suivant : M03 — Patients & MPI.</p>
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
nav a { color: #1f2937; text-decoration: none; }
nav a:hover { text-decoration: underline; }
nav button { padding: .4rem .9rem; border: 0; border-radius: 8px; background: #ef4444; color: #fff; cursor: pointer; }
.content { padding: 2rem; }
.badge { display: inline-block; margin-right: .4rem; padding: .15rem .6rem; border-radius: 999px; background: #e0e7ff; color: #3730a3; font-size: .85rem; }
.muted { color: #6b7280; }
</style>
`
);
ok('Fichiers frontend écrits');

// ---------- M02/5 : Test de bout en bout ----------
log('M02/5', 'Test de bout en bout — isolation multi-établissements');

const baseUrl = `http://127.0.0.1:${PORT}`;
const server = spawn(
  'php',
  ['artisan', 'serve', '--host=127.0.0.1', `--port=${PORT}`],
  { cwd: API, stdio: 'ignore', windowsHide: true }
);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function stopServer() {
  if (server.exitCode === null) {
    server.kill();
    await sleep(300);
  }
}

async function login(credentials) {
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(credentials),
  });
  if (!response.ok) {
    fail(`Connexion impossible pour ${credentials.email} (HTTP ${response.status}).`);
  }
  return (await response.json()).token;
}

try {
  let ready = false;
  for (let attempt = 0; attempt < 30 && !ready; attempt += 1) {
    if (server.exitCode !== null) {
      fail(`Le serveur Laravel s'est arrêté (code ${server.exitCode}).`);
    }
    try {
      const response = await fetch(`${baseUrl}/api/health`, {
        signal: AbortSignal.timeout(3000),
      });
      ready = response.ok;
    } catch {
      await sleep(1000);
    }
  }
  if (!ready) fail(`L'API n'a pas répondu sur le port ${PORT}.`);
  ok('API en ligne');

const adminToken = await login(ADMIN);
  const secretaryToken = await login(SECRETARY);
  ok('Connexions admin et secrétaire OK');

const authHeaders = (token) => ({
    Authorization: `Bearer ${token}`,
    Accept: 'application/json',
    'Content-Type': 'application/json',
  });

// 1. Admin crée un établissement
  const createResponse = await fetch(`${baseUrl}/api/facilities`, {
    method: 'POST',
    headers: authHeaders(adminToken),
    body: JSON.stringify({
      code: 'E2E01',
      name: 'Clinique E2E',
      city: 'Abomey-Calavi',
    }),
  });
  if (createResponse.status !== 201) {
    fail(`Création d'établissement par admin attendue en 201, reçu ${createResponse.status}.`);
  }
  ok('Création d\'établissement par admin (201)');

// 2. Admin voit ses établissements
  const adminList = await (await fetch(`${baseUrl}/api/facilities`, {
    headers: authHeaders(adminToken),
  })).json();
  const adminCodes = adminList.facilities.map((f) => f.code).sort();
  for (const expected of ['CSM', 'HREF', 'E2E01']) {
    if (!adminCodes.includes(expected)) {
      fail(`L'admin devrait voir l'établissement ${expected}. Reçu : ${adminCodes.join(', ')}`);
    }
  }
  ok(`Admin voit bien ses 3 établissements (${adminCodes.join(', ')})`);

// 3. Admin bascule vers l'établissement créé
  const e2eFacility = adminList.facilities.find((f) => f.code === 'E2E01');
  const switchResponse = await fetch(
    `${baseUrl}/api/facilities/${e2eFacility.id}/switch`,
    { method: 'POST', headers: authHeaders(adminToken) }
  );
  if (switchResponse.status !== 200) {
    fail(`Bascule admin attendue en 200, reçu ${switchResponse.status}.`);
  }
  ok('Bascule d\'établissement par admin (200)');

// 4. La secrétaire ne voit QUE son établissement (isolation)
  const secretaryList = await (await fetch(`${baseUrl}/api/facilities`, {
    headers: authHeaders(secretaryToken),
  })).json();
  const secretaryCodes = secretaryList.facilities.map((f) => f.code);
    if (secretaryCodes.length !== 1) {
    fail(
      `Isolation rompue : la secrétaire devrait ne voir qu'un seul établissement, reçu ${secretaryCodes.join(', ')}.`
    );
  }
  if (secretaryCodes[0] !== 'CSM') {
    fail(
      `Isolation rompue : la secrétaire devrait ne voir que CSM, reçu ${secretaryCodes.join(', ')}.`
    );
  }

  ok('Isolation : la secrétaire ne voit que CSM');

// 5. La secrétaire ne peut PAS basculer vers HREF
  const hrefFacility = adminList.facilities.find((f) => f.code === 'HREF');
  const forbiddenSwitch = await fetch(
    `${baseUrl}/api/facilities/${hrefFacility.id}/switch`,
    { method: 'POST', headers: authHeaders(secretaryToken) }
  );
  if (forbiddenSwitch.status !== 403) {
    fail(`Bascule interdite attendue en 403, reçu ${forbiddenSwitch.status}.`);
  }
  ok('Bascule vers un établissement non membre rejetée (403)');

// 6. La secrétaire ne peut PAS créer d'établissement
  const forbiddenCreate = await fetch(`${baseUrl}/api/facilities`, {
    method: 'POST',
    headers: authHeaders(secretaryToken),
    body: JSON.stringify({ code: 'HACK', name: 'Clinique Pirate' }),
  });
  if (forbiddenCreate.status !== 403) {
    fail(`Création interdite attendue en 403, reçu ${forbiddenCreate.status}.`);
  }
  ok('Création d\'établissement par secrétaire rejetée (403)');
} finally {
  await stopServer();
}

log('M02', 'Terminé');
console.log('');
console.log('Comptes de démarrage :');
console.log(`  Admin      : ${ADMIN.email} / ${ADMIN.password}`);
console.log(`  Secrétaire : ${SECRETARY.email} / ${SECRETARY.password}`);
console.log('Mot de passe à changer avant toute utilisation réelle.');
