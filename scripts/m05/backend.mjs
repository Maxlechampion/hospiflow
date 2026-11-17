#!/usr/bin/env node
// HOSPIFLOW — M05 (2/4) : backend — consultations & permissions cliniques
import fs from 'node:fs';
import path from 'node:path';
import { API, ok, writeFile } from './helpers.mjs';

export function installBackend() {
  // --- Migration consultations ---
  const migrationsDir = path.join(API, 'database', 'migrations');
  const migrationExists = fs
    .readdirSync(migrationsDir)
    .some((f) => f.includes('create_consultations_table'));

if (migrationExists) {
    ok('Migration déjà présente');
  } else {
    const timestamp = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);

writeFile(
      path.join(migrationsDir, timestamp + '_create_consultations_table.php'),
      String.raw`<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('consultations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('facility_id')->constrained()->cascadeOnDelete();
            $table->foreignId('patient_id')->constrained()->cascadeOnDelete();
            $table->foreignId('appointment_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('practitioner_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('chief_complaint', 1000);
            $table->text('examination')->nullable();
            $table->string('diagnosis', 1000)->nullable();
            $table->text('treatment')->nullable();
            $table->date('follow_up_date')->nullable();
            $table->timestamps();

$table->index(['facility_id', 'patient_id']);
        });
    }

public function down(): void
    {
        Schema::dropIfExists('consultations');
    }
};
`
    );
    ok('Migration consultations créée');
  }

// --- Modèle Consultation ---
  writeFile(
    path.join(API, 'app', 'Models', 'Consultation.php'),
    String.raw`<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Consultation extends Model
{
    protected $fillable = [
        'facility_id',
        'patient_id',
        'appointment_id',
        'practitioner_id',
        'created_by',
        'chief_complaint',
        'examination',
        'diagnosis',
        'treatment',
        'follow_up_date',
    ];

protected $casts = [
        'follow_up_date' => 'date',
    ];

public function facility(): BelongsTo
    {
        return $this->belongsTo(Facility::class);
    }

public function patient(): BelongsTo
    {
        return $this->belongsTo(Patient::class);
    }

public function practitioner(): BelongsTo
    {
        return $this->belongsTo(User::class, 'practitioner_id');
    }

public function appointment(): BelongsTo
    {
        return $this->belongsTo(Appointment::class);
    }

public function scopeInFacility($query, Facility $facility)
    {
        return $query->where('facility_id', $facility->id);
    }
}
`
  );

// --- Contrôleur ConsultationController ---
  writeFile(
    path.join(API, 'app', 'Http', 'Controllers', 'ConsultationController.php'),
    String.raw`<?php

namespace App\Http\Controllers;

use App\Models\Appointment;
use App\Models\Consultation;
use App\Models\Facility;
use App\Models\Patient;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ConsultationController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $this->authorizeView($request);

$facility = $this->currentFacility($request);

$query = Consultation::inFacility($facility)
            ->with(['patient:id,local_code,first_name,last_name', 'practitioner:id,name'])
            ->orderByDesc('created_at');

$patientId = $request->query('patient_id');

if ($patientId !== null) {
            $query->where('patient_id', (int) $patientId);
        }

return response()->json([
            'consultations' => $query->get()
                ->map(fn ($c) => $this->payload($c)),
        ]);
    }

public function store(Request $request): JsonResponse
    {
        $this->authorizeManage($request);

$facility = $this->currentFacility($request);

$data = $request->validate([
            'patient_id' => ['required', 'integer', 'exists:patients,id'],
            'appointment_id' => ['nullable', 'integer', 'exists:appointments,id'],
            'chief_complaint' => ['required', 'string', 'max:1000'],
            'examination' => ['nullable', 'string'],
            'diagnosis' => ['nullable', 'string', 'max:1000'],
            'treatment' => ['nullable', 'string'],
            'follow_up_date' => ['nullable', 'date'],
        ], [
            'chief_complaint.required' => 'Le motif de consultation est obligatoire.',
            'patient_id.exists' => 'Patient inconnu.',
            'appointment_id.exists' => 'Rendez-vous inconnu.',
        ]);

$patient = Patient::inFacility($facility)->find($data['patient_id']);

if (! $patient) {
            abort(422, 'Ce patient n\'existe pas dans votre établissement.');
        }

$appointment = null;

if (! empty($data['appointment_id'])) {
            $appointment = Appointment::inFacility($facility)->find($data['appointment_id']);

if (! $appointment) {
                abort(422, 'Ce rendez-vous n\'existe pas dans votre établissement.');
            }
        }

$consultation = Consultation::create([
            'facility_id' => $facility->id,
            'patient_id' => $patient->id,
            'appointment_id' => $appointment?->id,
            'practitioner_id' => $request->user()->id,
            'created_by' => $request->user()->id,
            'chief_complaint' => $data['chief_complaint'],
            'examination' => $data['examination'] ?? null,
            'diagnosis' => $data['diagnosis'] ?? null,
            'treatment' => $data['treatment'] ?? null,
            'follow_up_date' => $data['follow_up_date'] ?? null,
        ]);

if ($appointment && in_array($appointment->status, ['scheduled', 'confirmed'], true)) {
            $appointment->status = 'done';
            $appointment->save();
        }

return response()->json(
            ['consultation' => $this->payload($consultation->load(
                'patient:id,local_code,first_name,last_name',
                'practitioner:id,name'
            ))],
            201
        );
    }

public function show(Request $request, int $consultationId): JsonResponse
    {
        $this->authorizeView($request);

$facility = $this->currentFacility($request);

$consultation = Consultation::inFacility($facility)
            ->with(['patient:id,local_code,first_name,last_name', 'practitioner:id,name'])
            ->findOrFail($consultationId);

return response()->json([
            'consultation' => $this->payload($consultation),
        ]);
    }

public function update(Request $request, int $consultationId): JsonResponse
    {
        $this->authorizeManage($request);

$facility = $this->currentFacility($request);

$consultation = Consultation::inFacility($facility)->findOrFail($consultationId);

$data = $request->validate([
            'chief_complaint' => ['sometimes', 'string', 'max:1000'],
            'examination' => ['sometimes', 'nullable', 'string'],
            'diagnosis' => ['sometimes', 'nullable', 'string', 'max:1000'],
            'treatment' => ['sometimes', 'nullable', 'string'],
            'follow_up_date' => ['sometimes', 'nullable', 'date'],
        ]);

foreach (['chief_complaint', 'examination', 'diagnosis', 'treatment', 'follow_up_date'] as $field) {
            if (array_key_exists($field, $data)) {
                $consultation->{$field} = $data[$field];
            }
        }

$consultation->save();

return response()->json([
            'consultation' => $this->payload($consultation->fresh()->load(
                'patient:id,local_code,first_name,last_name',
                'practitioner:id,name'
            )),
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
        $allowed = $request->user()->can('consultations.view');

if (! $allowed) {
            abort(403, 'Vous n\'avez pas le droit de consulter les dossiers cliniques.');
        }
    }

private function authorizeManage(Request $request): void
    {
        $allowed = $request->user()->can('consultations.manage');

if (! $allowed) {
            abort(403, 'Vous n\'avez pas le droit de rédiger les comptes-rendus.');
        }
    }

private function payload(Consultation $c): array
    {
        return [
            'id' => $c->id,
            'patient' => [
                'id' => $c->patient->id,
                'local_code' => $c->patient->local_code,
                'first_name' => $c->patient->first_name,
                'last_name' => $c->patient->last_name,
            ],
            'practitioner' => [
                'id' => $c->practitioner->id,
                'name' => $c->practitioner->name,
            ],
            'appointment_id' => $c->appointment_id,
            'chief_complaint' => $c->chief_complaint,
            'examination' => $c->examination,
            'diagnosis' => $c->diagnosis,
            'treatment' => $c->treatment,
            'follow_up_date' => $c->follow_up_date?->format('Y-m-d'),
            'created_at' => $c->created_at->format('Y-m-d H:i'),
        ];
    }
}
`
  );

// --- Seeder additif : permissions cliniques ---
  writeFile(
    path.join(API, 'database', 'seeders', 'ConsultationsPermissionsSeeder.php'),
    String.raw`<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;

class ConsultationsPermissionsSeeder extends Seeder
{
    public function run(): void
    {
        $view = Permission::findOrCreate('consultations.view');
        $manage = Permission::findOrCreate('consultations.manage');

$map = [
            'admin' => [$view, $manage],
            'medecin' => [$view, $manage],
            'infirmier' => [$view],
        ];

foreach ($map as $roleName => $permissions) {
            $role = Role::findOrCreate($roleName);
            $role->givePermissionTo($permissions);
        }

app(PermissionRegistrar::class)->forgetCachedPermissions();
    }
}
`
  );

// --- Routes API (auth + facilities + patients + appointments + consultations) ---
  writeFile(
    path.join(API, 'routes', 'api.php'),
    String.raw`<?php

use App\Http\Controllers\AppointmentController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\ConsultationController;
use App\Http\Controllers\FacilityController;
use App\Http\Controllers\PatientController;
use Illuminate\Support\Facades\Route;

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

Route::middleware('auth:sanctum')->prefix('appointments')->group(function () {
    Route::get('/practitioners', [AppointmentController::class, 'practitioners']);
    Route::get('/', [AppointmentController::class, 'index']);
    Route::post('/', [AppointmentController::class, 'store']);
    Route::get('/{appointmentId}', [AppointmentController::class, 'show'])
        ->whereNumber('appointmentId');
    Route::patch('/{appointmentId}', [AppointmentController::class, 'update'])
        ->whereNumber('appointmentId');
});

Route::middleware('auth:sanctum')->prefix('consultations')->group(function () {
    Route::get('/', [ConsultationController::class, 'index']);
    Route::post('/', [ConsultationController::class, 'store']);
    Route::get('/{consultationId}', [ConsultationController::class, 'show'])
        ->whereNumber('consultationId');
    Route::patch('/{consultationId}', [ConsultationController::class, 'update'])
        ->whereNumber('consultationId');
});
`
  );

ok('Migration, modèle, contrôleur, seeder et routes écrits');
}
