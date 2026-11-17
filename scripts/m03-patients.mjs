#!/usr/bin/env node
// HOSPIFLOW — M03 : Patients & MPI (identifiant réseau fédéré)
// Prérequis : M02 terminé (établissements + isolation opérationnels).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, spawnSync } from 'node:child_process';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const API = path.join(ROOT, 'api');
const WEB = path.join(ROOT, 'web');

const ADMIN = { email: 'admin@hospiflow.local', password: 'hospiflow_admin' };
const SECRETARY = { email: 'secretaire@hospiflow.local', password: 'hospiflow_sec' };
const PORT = 8012;

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

// ---------- M03/1 : Prérequis ----------
log('M03/1', 'Vérification du module M02');

for (const required of [
  path.join(API, 'app', 'Models', 'Facility.php'),
  path.join(API, 'app', 'Http', 'Controllers', 'FacilityController.php'),
  path.join(WEB, 'src', 'views', 'FacilitiesView.vue'),
]) {
  if (!fs.existsSync(required)) {
    fail(`M02 incomplet : fichier manquant ${required}. Relance "npm run m02".`);
  }
}
ok('Module M02 opérationnel');

// ---------- M03/2 : Backend ----------
log('M03/2', 'Backend — patients, MPI, isolation par établissement');

// 2a. Migration
const migrationsDir = path.join(API, 'database', 'migrations');
const migrationExists = fs
  .readdirSync(migrationsDir)
  .some((f) => f.includes('create_patients_tables'));

if (!migrationExists) {
  const timestamp = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);

writeFile(
    path.join(migrationsDir, `${timestamp}_create_patients_tables.php`),
    `<?php

use Illuminate\\Database\\Migrations\\Migration;
use Illuminate\\Database\\Schema\\Blueprint;
use Illuminate\\Support\\Facades\\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('master_patient_index', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('hospiflow_code', 20)->unique();
            $table->string('first_name');
            $table->string('last_name');
            $table->date('date_of_birth')->nullable();
            $table->string('gender', 20)->nullable();
            $table->string('phone', 30)->nullable();
            $table->timestamps();
        });

Schema::create('patients', function (Blueprint $table) {
            $table->id();
            $table->foreignId('facility_id')->constrained()->cascadeOnDelete();
            $table->uuid('mpi_id');
            $table->foreign('mpi_id')->references('id')
                ->on('master_patient_index')->cascadeOnDelete();
            $table->string('local_code', 30);
            $table->string('first_name');
            $table->string('last_name');
            $table->date('date_of_birth')->nullable();
            $table->string('gender', 20)->nullable();
            $table->string('phone', 30)->nullable();
            $table->string('address', 255)->nullable();
            $table->string('blood_group', 10)->nullable();
            $table->text('allergies')->nullable();
            $table->timestamps();
            $table->softDeletes();
            $table->unique(['facility_id', 'mpi_id']);
            $table->unique(['facility_id', 'local_code']);
        });
    }

public function down(): void
    {
        Schema::dropIfExists('patients');
        Schema::dropIfExists('master_patient_index');
    }
};
`
  );
  ok('Migration patients/master_patient_index créée');
} else {
  ok('Migration déjà présente');
}

// 2b. Modèle MasterPatientIndex
writeFile(
  path.join(API, 'app', 'Models', 'MasterPatientIndex.php'),
  `<?php

namespace App\\Models;

use Illuminate\\Database\\Eloquent\\Model;
use Illuminate\\Support\\Str;

class MasterPatientIndex extends Model
{
    public $incrementing = false;

protected $keyType = 'string';

protected $table = 'master_patient_index';

protected $fillable = [
        'id',
        'hospiflow_code',
        'first_name',
        'last_name',
        'date_of_birth',
        'gender',
        'phone',
    ];

protected static function booted(): void
    {
        static::creating(function (self $mpi) {
            if (empty($mpi->id)) {
                $mpi->id = Str::uuid()->toString();
            }

if (empty($mpi->hospiflow_code)) {
                $mpi->hospiflow_code = 'HF-' . strtoupper(bin2hex(random_bytes(6)));
            }
        });
    }

public function patients()
    {
        return $this->hasMany(Patient::class, 'mpi_id');
    }
}
`
);

// 2c. Modèle Patient
writeFile(
  path.join(API, 'app', 'Models', 'Patient.php'),
  `<?php

namespace App\\Models;

use Illuminate\\Database\\Eloquent\\Model;
use Illuminate\\Database\\Eloquent\\Relations\\BelongsTo;
use Illuminate\\Database\\Eloquent\\SoftDeletes;

class Patient extends Model
{
    use SoftDeletes;

protected $fillable = [
        'facility_id',
        'mpi_id',
        'local_code',
        'first_name',
        'last_name',
        'date_of_birth',
        'gender',
        'phone',
        'address',
        'blood_group',
        'allergies',
    ];

protected $casts = [
        'date_of_birth' => 'date:Y-m-d',
    ];

public function facility(): BelongsTo
    {
        return $this->belongsTo(Facility::class);
    }

public function mpi(): BelongsTo
    {
        return $this->belongsTo(MasterPatientIndex::class, 'mpi_id');
    }

public function scopeInFacility($query, Facility $facility)
    {
        return $query->where('facility_id', $facility->id);
    }
}
`
);

// 2d. Contrôleur PatientController
writeFile(
  path.join(API, 'app', 'Http', 'Controllers', 'PatientController.php'),
  `<?php

namespace App\\Http\\Controllers;

use App\\Models\\Facility;
use App\\Models\\MasterPatientIndex;
use App\\Models\\Patient;
use Illuminate\\Http\\JsonResponse;
use Illuminate\\Http\\Request;

class PatientController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $this->authorizeView($request);

$facility = $this->currentFacility($request);

$patients = $facility->patients()
            ->with('mpi:id,hospiflow_code')
            ->orderBy('last_name')
            ->orderBy('first_name')
            ->get();

return response()->json([
            'facility' => ['id' => $facility->id, 'code' => $facility->code],
            'patients' => $patients->map(fn ($p) => $this->payload($p)),
        ]);
    }

public function search(Request $request): JsonResponse
    {
        $this->authorizeView($request);

$facility = $this->currentFacility($request);
        $q = trim((string) $request->query('q', ''));

if ($q === '') {
            return response()->json(['results' => []]);
        }

$patients = $facility->patients()
            ->with('mpi:id,hospiflow_code')
            ->where(function ($w) use ($q) {
                $w->where('first_name', 'ilike', '%'.$q.'%')
                    ->orWhere('last_name', 'ilike', '%'.$q.'%')
                    ->orWhere('local_code', 'ilike', '%'.$q.'%')
                    ->orWhere('phone', 'ilike', '%'.$q.'%')
                    ->orWhereHas('mpi', function ($m) use ($q) {
                        $m->where('hospiflow_code', 'ilike', '%'.$q.'%');
                    });
            })
            ->limit(50)
            ->get();

return response()->json([
            'results' => $patients->map(fn ($p) => $this->payload($p)),
        ]);
    }

public function store(Request $request): JsonResponse
    {
        $this->authorizeManage($request);

$facility = $this->currentFacility($request);

$data = $request->validate([
            'first_name' => ['required', 'string', 'max:255'],
            'last_name' => ['required', 'string', 'max:255'],
            'date_of_birth' => ['nullable', 'date'],
            'gender' => ['nullable', 'string', 'max:20', 'in:male,female,other'],
            'phone' => ['nullable', 'string', 'max:30'],
            'address' => ['nullable', 'string', 'max:255'],
            'blood_group' => ['nullable', 'string', 'max:10'],
            'allergies' => ['nullable', 'string'],
            'mpi_code' => ['nullable', 'string', 'max:20'],
        ], [
            'first_name.required' => 'Le prénom est obligatoire.',
            'last_name.required' => 'Le nom est obligatoire.',
        ]);

$mpi = null;

if (! empty($data['mpi_code'])) {
            $mpi = MasterPatientIndex::where('hospiflow_code', $data['mpi_code'])->first();

if (! $mpi) {
                abort(422, 'Identifiant réseau HOSPIFLOW inconnu.');
            }
        }

if (! $mpi) {
            $mpi = MasterPatientIndex::create([
                'first_name' => $data['first_name'],
                'last_name' => $data['last_name'],
                'date_of_birth' => $data['date_of_birth'] ?? null,
                'gender' => $data['gender'] ?? null,
                'phone' => $data['phone'] ?? null,
            ]);
        }

$existing = $facility->patients()->where('mpi_id', $mpi->id)->first();

if ($existing) {
            return response()->json([
                'patient' => $this->payload($existing->load('mpi:id,hospiflow_code')),
                'message' => 'Ce patient réseau existe déjà dans cet établissement.',
            ]);
        }

$patient = $facility->patients()->create([
            'mpi_id' => $mpi->id,
            'local_code' => $this->nextLocalCode($facility),
            'first_name' => $data['first_name'],
            'last_name' => $data['last_name'],
            'date_of_birth' => $data['date_of_birth'] ?? null,
            'gender' => $data['gender'] ?? null,
            'phone' => $data['phone'] ?? null,
            'address' => $data['address'] ?? null,
            'blood_group' => $data['blood_group'] ?? null,
            'allergies' => $data['allergies'] ?? null,
        ]);

return response()->json(
            ['patient' => $this->payload($patient->load('mpi:id,hospiflow_code'))],
            201
        );
    }

public function show(Request $request, int $patientId): JsonResponse
    {
        $this->authorizeView($request);

$facility = $this->currentFacility($request);

$patient = Patient::inFacility($facility)
            ->with('mpi:id,hospiflow_code')
            ->findOrFail($patientId);

return response()->json(['patient' => $this->payload($patient)]);
    }

public function update(Request $request, int $patientId): JsonResponse
    {
        $this->authorizeManage($request);

$facility = $this->currentFacility($request);

$patient = Patient::inFacility($facility)->findOrFail($patientId);

$data = $request->validate([
            'first_name' => ['sometimes', 'required', 'string', 'max:255'],
            'last_name' => ['sometimes', 'required', 'string', 'max:255'],
            'date_of_birth' => ['nullable', 'date'],
            'gender' => ['nullable', 'string', 'max:20', 'in:male,female,other'],
            'phone' => ['nullable', 'string', 'max:30'],
            'address' => ['nullable', 'string', 'max:255'],
            'blood_group' => ['nullable', 'string', 'max:10'],
            'allergies' => ['nullable', 'string'],
        ]);

$patient->update(array_filter($data, fn ($v) => $v !== null));

return response()->json([
            'patient' => $this->payload($patient->fresh()->load('mpi:id,hospiflow_code')),
        ]);
    }

private function currentFacility(Request $request): Facility
    {
        $facility = $request->user()->currentFacility;

if (! $facility) {
            abort(409, 'Aucun établissement actif. Choisissez-en un dans Établissements.');
        }

if (! $facility->is_active) {
            abort(403, 'Votre établissement actif est désactivé.');
        }

return $facility;
    }

private function authorizeView(Request $request): void
    {
        if (! $request->user()->can('patients.view')) {
            abort(403, 'Vous n\\'avez pas le droit de consulter les patients.');
        }
    }

private function authorizeManage(Request $request): void
    {
        if (! $request->user()->can('patients.manage')) {
            abort(403, 'Vous n\\'avez pas le droit de gérer les patients.');
        }
    }

private function nextLocalCode(Facility $facility): string
    {
        $count = $facility->patients()->withTrashed()->count() + 1;

return 'P-' . strtoupper($facility->code) . '-'
            . str_pad((string) $count, 4, '0', STR_PAD_LEFT);
    }

private function payload(Patient $patient): array
    {
        return [
            'id' => $patient->id,
            'local_code' => $patient->local_code,
            'hospiflow_code' => $patient->mpi->hospiflow_code ?? null,
            'first_name' => $patient->first_name,
            'last_name' => $patient->last_name,
            'date_of_birth' => $patient->date_of_birth?->format('Y-m-d'),
            'gender' => $patient->gender,
            'phone' => $patient->phone,
            'address' => $patient->address,
            'blood_group' => $patient->blood_group,
            'allergies' => $patient->allergies,
            'facility_id' => $patient->facility_id,
        ];
    }
}
`
);

// 2e. Routes API (auth + facilities + patients)
writeFile(
  path.join(API, 'routes', 'api.php'),
  `<?php

use App\\Http\\Controllers\\AuthController;
use App\\Http\\Controllers\\FacilityController;
use App\\Http\\Controllers\\PatientController;
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

Route::middleware('auth:sanctum')->prefix('patients')->group(function () {
    Route::get('/', [PatientController::class, 'index']);
    Route::get('/search', [PatientController::class, 'search']);
    Route::post('/', [PatientController::class, 'store']);
    Route::get('/{patientId}', [PatientController::class, 'show'])
        ->whereNumber('patientId');
    Route::patch('/{patientId}', [PatientController::class, 'update'])
        ->whereNumber('patientId');
});
`
);

// 2f. Seeder patients de démonstration
writeFile(
  path.join(API, 'database', 'seeders', 'PatientsSeeder.php'),
  `<?php

namespace Database\\Seeders;

use App\\Models\\Facility;
use App\\Models\\MasterPatientIndex;
use App\\Models\\Patient;
use Illuminate\\Database\\Seeder;

class PatientsSeeder extends Seeder
{
    public function run(): void
    {
        $csm = Facility::where('code', 'CSM')->firstOrFail();

$mpi = MasterPatientIndex::firstOrCreate(
            ['hospiflow_code' => 'HF-DEMO0001'],
            [
                'first_name' => 'Awa',
                'last_name' => 'Doe',
                'date_of_birth' => '1990-05-14',
                'gender' => 'female',
                'phone' => '+229 97 00 00 01',
            ]
        );

Patient::firstOrCreate(
            ['facility_id' => $csm->id, 'mpi_id' => $mpi->id],
            [
                'local_code' => 'P-CSM-0001',
                'first_name' => 'Awa',
                'last_name' => 'Doe',
                'date_of_birth' => '1990-05-14',
                'gender' => 'female',
                'phone' => '+229 97 00 00 01',
                'address' => 'Cotonou, Bénin',
                'blood_group' => 'O+',
                'allergies' => null,
            ]
        );
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
            PatientsSeeder::class,
        ]);
    }
}
`
);
ok('Modèle, contrôleur, routes et seeder écrits');

// ---------- M03/3 : Migrations & seed ----------
log('M03/3', 'Migrations et seed');
run('php artisan migrate --force', API);
run('php artisan db:seed --force', API);
ok('Migrations et seed terminés');

// ---------- M03/4 : Frontend ----------
log('M03/4', 'Webapp Vue — page Patients');

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
    {
      path: '/patients',
      component: () => import('../views/PatientsView.vue'),
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
  path.join(WEB, 'src', 'views', 'PatientsView.vue'),
  `<script setup>
import { onMounted, ref } from 'vue';
import { api } from '../api/client';
import { useAuthStore } from '../stores/auth';

const auth = useAuthStore();

const patients = ref([]);
const query = ref('');
const error = ref('');
const loading = ref(false);

const firstName = ref('');
const lastName = ref('');
const dateOfBirth = ref('');
const gender = ref('');
const phone = ref('');
const address = ref('');
const bloodGroup = ref('');
const mpiCode = ref('');

async function load() {
  loading.value = true;
  error.value = '';
  try {
    const data = await api('/patients', { token: auth.token });
    patients.value = data.patients;
  } catch (exception) {
    error.value = exception.message;
  } finally {
    loading.value = false;
  }
}

async function search() {
  error.value = '';
  try {
    if (query.value.trim() === '') {
      await load();
      return;
    }
    const data = await api(
      '/patients/search?q=' + encodeURIComponent(query.value.trim()),
      { token: auth.token }
    );
    patients.value = data.results;
  } catch (exception) {
    error.value = exception.message;
  }
}

async function createPatient() {
  error.value = '';
  try {
    await api('/patients', {
      method: 'POST',
      token: auth.token,
      body: {
        first_name: firstName.value.trim(),
        last_name: lastName.value.trim(),
        date_of_birth: dateOfBirth.value || null,
        gender: gender.value || null,
        phone: phone.value.trim() || null,
        address: address.value.trim() || null,
        blood_group: bloodGroup.value.trim() || null,
        mpi_code: mpiCode.value.trim() || null,
      },
    });
    firstName.value = '';
    lastName.value = '';
    dateOfBirth.value = '';
    gender.value = '';
    phone.value = '';
    address.value = '';
    bloodGroup.value = '';
    mpiCode.value = '';
    await load();
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
      <nav>
        <router-link to="/">Tableau de bord</router-link>
        <router-link to="/facilities">Établissements</router-link>
      </nav>
    </header>

<section class="content">
      <h1>Patients</h1>

<p v-if="error" class="error">{{ error }}</p>

<form class="search" @submit.prevent="search">
        <input
          v-model="query"
          placeholder="Nom, téléphone, code local ou code réseau HF-…"
        />
        <button type="submit">Rechercher</button>
      </form>

<table v-if="patients.length">
        <thead>
          <tr>
            <th>Code local</th>
            <th>Code réseau</th>
            <th>Nom</th>
            <th>Naissance</th>
            <th>Téléphone</th>
            <th>Groupe</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="patient in patients" :key="patient.id">
            <td>{{ patient.local_code }}</td>
            <td><code>{{ patient.hospiflow_code }}</code></td>
            <td>{{ patient.last_name }} {{ patient.first_name }}</td>
            <td>{{ patient.date_of_birth || '—' }}</td>
            <td>{{ patient.phone || '—' }}</td>
            <td>{{ patient.blood_group || '—' }}</td>
          </tr>
        </tbody>
      </table>

<p v-else-if="!loading">Aucun patient dans cet établissement pour l'instant.</p>

<form class="create" @submit.prevent="createPatient">
        <h2>Nouveau patient</h2>
        <p class="muted">
          Laissez « Code réseau » vide pour créer un nouveau patient réseau ;
          renseignez-le (HF-…) pour rattacher ce patient dans cet établissement.
        </p>
        <label>
          Prénom
          <input v-model="firstName" required />
        </label>
        <label>
          Nom
          <input v-model="lastName" required />
        </label>
        <label>
          Date de naissance
          <input v-model="dateOfBirth" type="date" />
        </label>
        <label>
          Sexe
          <select v-model="gender">
            <option value="">—</option>
            <option value="female">Féminin</option>
            <option value="male">Masculin</option>
            <option value="other">Autre</option>
          </select>
        </label>
        <label>
          Téléphone
          <input v-model="phone" />
        </label>
        <label>
          Adresse
          <input v-model="address" />
        </label>
        <label>
          Groupe sanguin
          <input v-model="bloodGroup" maxlength="10" placeholder="O+" />
        </label>
        <label>
          Code réseau (optionnel)
          <input v-model="mpiCode" placeholder="HF-XXXXXXXXXXXX" />
        </label>
        <button type="submit">Enregistrer</button>
      </form>
    </section>
  </main>
</template>

<style scoped>
.page { min-height: 100vh; }
header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 2rem;
  background: #fff;
  box-shadow: 0 1px 4px rgb(0 0 0 / 6%);
}
header strong { color: #0d6efd; letter-spacing: .05em; }
nav { display: flex; gap: 1.2rem; }
nav a { color: #1f2937; text-decoration: none; }
nav a:hover { text-decoration: underline; }
.content { padding: 2rem; max-width: 1000px; }
.error { color: #dc2626; }
.search { display: flex; gap: .6rem; margin-bottom: 1.2rem; }
.search input { flex: 1; padding: .5rem .7rem; border: 1px solid #d1d5db; border-radius: 8px; }
.search button, .create button { padding: .5rem 1rem; border: 0; border-radius: 8px; background: #0d6efd; color: #fff; cursor: pointer; }
table { border-collapse: collapse; width: 100%; background: #fff; border-radius: 8px; overflow: hidden; }
th, td { padding: .6rem .8rem; border-bottom: 1px solid #e5e7eb; text-align: left; font-size: .92rem; }
th { background: #f3f4f6; }
code { background: #eef2ff; color: #3730a3; padding: .1rem .4rem; border-radius: 6px; font-size: .82rem; }
.create { margin-top: 2rem; display: grid; gap: .6rem; max-width: 460px; background: #fff; padding: 1.5rem; border-radius: 8px; }
.create h2 { margin: 0 0 .3rem; font-size: 1.1rem; }
.muted { margin: 0; color: #6b7280; font-size: .85rem; }
label { display: grid; gap: .25rem; font-size: .9rem; }
input, select { padding: .5rem .7rem; border: 1px solid #d1d5db; border-radius: 8px; font-size: .95rem; }
</style>
`
);

// Dashboard : lien Patients
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
        <router-link to="/patients">Patients</router-link>
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
      <p class="muted">Module suivant : M04 — Rendez-vous & consultations.</p>
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

// ---------- M03/5 : Test de bout en bout ----------
log('M03/5', 'Test de bout en bout — patients & MPI');

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

function mustBe(response, expected, label) {
  if (response.status !== expected) {
    fail(`${label} : HTTP ${expected} attendu, reçu HTTP ${response.status}.`);
  }
  ok(label);
}

function authHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };
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

async function switchFacility(token, facilityId) {
  const response = await fetch(`${baseUrl}/api/facilities/${facilityId}/switch`, {
    method: 'POST',
    headers: authHeaders(token),
  });
  if (response.status !== 200) {
    fail(`Bascule d'établissement refusée (HTTP ${response.status}).`);
  }
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

// Récupérer les établissements pour la secrétaire (CSM) et l'admin (HREF)
  const secFacilities = await (await fetch(`${baseUrl}/api/facilities`, {
    headers: authHeaders(secretaryToken),
  })).json();
  const csm = secFacilities.facilities.find((f) => f.code === 'CSM');
  if (!csm) fail('CSM introuvable pour la secrétaire.');

const adminFacilities = await (await fetch(`${baseUrl}/api/facilities`, {
    headers: authHeaders(adminToken),
  })).json();
  const href = adminFacilities.facilities.find((f) => f.code === 'HREF');
  if (!href) fail('HREF introuvable pour l\'admin.');

// La secrétaire pointe sur CSM, l'admin sur HREF pour la suite.
  await switchFacility(secretaryToken, csm.id);
  await switchFacility(adminToken, href.id);
  ok('Établissements actifs définis (secrétaire → CSM, admin → HREF)');

// Test 1 : liste patients de la secrétaire = patients de CSM uniquement
  const listResponse = await fetch(`${baseUrl}/api/patients`, {
    headers: authHeaders(secretaryToken),
  });
  await mustBe(listResponse, 200, 'Liste patients accessible (secrétaire)');

const listData = await listResponse.json();
  const localCodes = listData.patients.map((p) => p.local_code);
  if (!localCodes.includes('P-CSM-0001')) {
    fail(`Le patient de démonstration P-CSM-0001 manque. Reçu : ${localCodes.join(', ')}`);
  }
    for (const code of localCodes) {
    if (!code.startsWith('P-CSM-')) {
      fail(`Isolation rompue : code local inattendu ${code}.`);
    }
  }

  const demoPatient = listData.patients[0];
  if (!demoPatient.hospiflow_code) {
    fail('Le code réseau (hospiflow_code) manque dans la réponse patient.');
  }
  ok(`Patient démo visible : ${demoPatient.local_code} / ${demoPatient.hospiflow_code}`);

// Test 2 : création d'un patient par la secrétaire → 201 + code réseau généré
  const createResponse = await fetch(`${baseUrl}/api/patients`, {
    method: 'POST',
    headers: authHeaders(secretaryToken),
    body: JSON.stringify({
      first_name: 'Koffi',
      last_name: 'Adjovi',
      date_of_birth: '1985-03-02',
      gender: 'male',
      phone: '+229 96 11 22 33',
      address: 'Abomey-Calavi',
      blood_group: 'A+',
    }),
  });
  await mustBe(createResponse, 201, 'Création patient par la secrétaire (201)');

const created = (await createResponse.json()).patient;
  if (!created.hospiflow_code.startsWith('HF-')) {
    fail(`Le code réseau généré est invalide : ${created.hospiflow_code}`);
  }
  ok(`Code réseau généré automatiquement : ${created.hospiflow_code}`);

// Test 3 : recherche par nom dans l'établissement actif
  const searchResponse = await fetch(
    `${baseUrl}/api/patients/search?q=Adjovi`,
    { headers: authHeaders(secretaryToken) }
  );
  await mustBe(searchResponse, 200, 'Recherche patients (200)');

const searchResults = (await searchResponse.json()).results;
  if (searchResults.length !== 1) {
    fail(`La recherche « Adjovi » devrait renvoyer 1 patient, reçu ${searchResults.length}.`);
  }
  ok('Recherche par nom : patient trouvé');

// Test 4 : admin rattache le patient réseau de CSM dans HREF (MPI fédéré)
  const linkResponse = await fetch(`${baseUrl}/api/patients`, {
    method: 'POST',
    headers: authHeaders(adminToken),
    body: JSON.stringify({
      mpi_code: demoPatient.hospiflow_code,
      first_name: demoPatient.first_name,
      last_name: demoPatient.last_name,
      date_of_birth: demoPatient.date_of_birth,
      gender: demoPatient.gender,
      phone: demoPatient.phone,
    }),
  });
  await mustBe(linkResponse, 201, 'Rattachement du patient réseau dans HREF (201)');

const linked = (await linkResponse.json()).patient;
  if (linked.hospiflow_code !== demoPatient.hospiflow_code) {
    fail('Le code réseau devrait être identique entre les deux établissements.');
  }
  if (linked.local_code === demoPatient.local_code) {
    fail('Le code local devrait être différent dans chaque établissement.');
  }
  ok(`Fédération OK : ${linked.local_code} (HREF) partage le code ${linked.hospiflow_code} avec ${demoPatient.local_code} (CSM)`);

// Test 5 : isolation — la secrétaire ne peut PAS voir le patient de HREF
  const forbiddenShow = await fetch(`${baseUrl}/api/patients/${linked.id}`, {
    headers: authHeaders(secretaryToken),
  });
  await mustBe(forbiddenShow, 404, 'Accès au patient d\'un autre établissement rejeté (404)');

// Test 6 : accès non authentifié rejeté
  const anonymousShow = await fetch(`${baseUrl}/api/patients`, {
    headers: { Accept: 'application/json' },
  });
  await mustBe(anonymousShow, 401, 'Accès anonyme rejeté (401)');
} finally {
  await stopServer();
}

log('M03', 'Terminé');
console.log('');
console.log('Patients : identifiant réseau HF-… partagé entre établissements,');
console.log('codes locaux distincts par établissement, isolation vérifiée.');
