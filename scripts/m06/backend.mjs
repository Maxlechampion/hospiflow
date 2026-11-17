#!/usr/bin/env node
// HOSPIFLOW — M06 (2/4) : backend — laboratoire, demandes & résultats
import fs from 'node:fs';
import path from 'node:path';
import { API, ok, writeFile } from './helpers.mjs';

export function installBackend() {
  // --- Migration lab_requests + lab_results ---
  const migrationsDir = path.join(API, 'database', 'migrations');
  const migrationExists = fs
    .readdirSync(migrationsDir)
    .some((f) => f.includes('create_lab_tables'));

if (migrationExists) {
    ok('Migration déjà présente');
  } else {
    const timestamp = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);

writeFile(
      path.join(migrationsDir, timestamp + '_create_lab_tables.php'),
      String.raw`<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('lab_requests', function (Blueprint $table) {
            $table->id();
            $table->foreignId('facility_id')->constrained()->cascadeOnDelete();
            $table->foreignId('patient_id')->constrained()->cascadeOnDelete();
            $table->foreignId('consultation_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('requested_by')->constrained('users')->cascadeOnDelete();
            $table->string('panel', 200);
            $table->string('priority', 20)->default('routine');
            $table->string('status', 20)->default('pending');
            $table->string('notes', 500)->nullable();
            $table->timestamps();

$table->index(['facility_id', 'status']);
            $table->index(['facility_id', 'patient_id']);
        });

Schema::create('lab_results', function (Blueprint $table) {
            $table->id();
            $table->foreignId('lab_request_id')->unique()->constrained()->cascadeOnDelete();
            $table->text('values');
            $table->string('conclusion', 1000)->nullable();
            $table->foreignId('resulted_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('resulted_at')->nullable();
            $table->timestamps();
        });
    }

public function down(): void
    {
        Schema::dropIfExists('lab_results');
        Schema::dropIfExists('lab_requests');
    }
};
`
    );
    ok('Migration laboratoire créée');
  }

// --- Modèle LabRequest ---
  writeFile(
    path.join(API, 'app', 'Models', 'LabRequest.php'),
    String.raw`<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasOne;

class LabRequest extends Model
{
    public const STATUSES = ['pending', 'in_progress', 'completed', 'cancelled'];

protected $fillable = [
        'facility_id',
        'patient_id',
        'consultation_id',
        'requested_by',
        'panel',
        'priority',
        'status',
        'notes',
    ];

public function patient(): BelongsTo
    {
        return $this->belongsTo(Patient::class);
    }

public function requester(): BelongsTo
    {
        return $this->belongsTo(User::class, 'requested_by');
    }

public function consultation(): BelongsTo
    {
        return $this->belongsTo(Consultation::class);
    }

public function result(): HasOne
    {
        return $this->hasOne(LabResult::class);
    }

public function scopeInFacility($query, Facility $facility)
    {
        return $query->where('facility_id', $facility->id);
    }
}
`
  );

// --- Modèle LabResult ---
  writeFile(
    path.join(API, 'app', 'Models', 'LabResult.php'),
    String.raw`<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class LabResult extends Model
{
    protected $fillable = [
        'lab_request_id',
        'values',
        'conclusion',
        'resulted_by',
        'resulted_at',
    ];

protected $casts = [
        'resulted_at' => 'datetime',
    ];

public function labRequest(): BelongsTo
    {
        return $this->belongsTo(LabRequest::class);
    }

public function resultedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'resulted_by');
    }
}
`
  );

// --- Contrôleur LabRequestController ---
  writeFile(
    path.join(API, 'app', 'Http', 'Controllers', 'LabRequestController.php'),
    String.raw`<?php

namespace App\Http\Controllers;

use App\Models\Consultation;
use App\Models\Facility;
use App\Models\LabRequest;
use App\Models\Patient;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class LabRequestController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $this->authorizeView($request);

$facility = $this->currentFacility($request);

$query = LabRequest::inFacility($facility)
            ->with([
                'patient:id,local_code,first_name,last_name',
                'requester:id,name',
                'result.resultedBy:id,name',
            ])
            ->orderByDesc('created_at');

$patientId = $request->query('patient_id');

if ($patientId !== null) {
            $query->where('patient_id', (int) $patientId);
        }

$status = $request->query('status');

if ($status) {
            $query->where('status', $status);
        }

return response()->json([
            'lab_requests' => $query->get()
                ->map(fn ($r) => $this->payload($r)),
        ]);
    }

public function store(Request $request): JsonResponse
    {
        $this->authorizeRequest($request);

$facility = $this->currentFacility($request);

$data = $request->validate([
            'patient_id' => ['required', 'integer', 'exists:patients,id'],
            'consultation_id' => ['nullable', 'integer', 'exists:consultations,id'],
            'panel' => ['required', 'string', 'max:200'],
            'priority' => ['nullable', 'string', 'in:routine,urgent'],
            'notes' => ['nullable', 'string', 'max:500'],
        ], [
            'panel.required' => 'Le type d\'analyse est obligatoire.',
            'patient_id.exists' => 'Patient inconnu.',
            'consultation_id.exists' => 'Consultation inconnue.',
            'priority.in' => 'Priorité invalide.',
        ]);

$patient = Patient::inFacility($facility)->find($data['patient_id']);

if (! $patient) {
            abort(422, 'Ce patient n\'existe pas dans votre établissement.');
        }

$consultation = null;

if (! empty($data['consultation_id'])) {
            $consultation = Consultation::inFacility($facility)->find($data['consultation_id']);

if (! $consultation) {
                abort(422, 'Cette consultation n\'existe pas dans votre établissement.');
            }
        }

$labRequest = LabRequest::create([
            'facility_id' => $facility->id,
            'patient_id' => $patient->id,
            'consultation_id' => $consultation?->id,
            'requested_by' => $request->user()->id,
            'panel' => $data['panel'],
            'priority' => $data['priority'] ?? 'routine',
            'status' => 'pending',
            'notes' => $data['notes'] ?? null,
        ]);

return response()->json(
            ['lab_request' => $this->payload($labRequest->load(
                'patient:id,local_code,first_name,last_name',
                'requester:id,name'
            ))],
            201
        );
    }

public function show(Request $request, int $labRequestId): JsonResponse
    {
        $this->authorizeView($request);

$facility = $this->currentFacility($request);

$labRequest = LabRequest::inFacility($facility)
            ->with([
                'patient:id,local_code,first_name,last_name',
                'requester:id,name',
                'result.resultedBy:id,name',
            ])
            ->findOrFail($labRequestId);

return response()->json([
            'lab_request' => $this->payload($labRequest),
        ]);
    }

public function update(Request $request, int $labRequestId): JsonResponse
    {
        $this->authorizeRequest($request);

$facility = $this->currentFacility($request);

$labRequest = LabRequest::inFacility($facility)->findOrFail($labRequestId);

if ($labRequest->status === 'completed') {
            abort(422, 'Cette demande est complétée et ne peut plus être modifiée.');
        }

$data = $request->validate([
            'status' => ['required', 'string', 'in:' . implode(',', ['pending', 'in_progress', 'cancelled'])],
        ], [
            'status.in' => 'Statut invalide (la complétion passe par la saisie du résultat).',
        ]);

$labRequest->status = $data['status'];
        $labRequest->save();

return response()->json([
            'lab_request' => $this->payload($labRequest->fresh()->load(
                'patient:id,local_code,first_name,last_name',
                'requester:id,name',
                'result.resultedBy:id,name'
            )),
        ]);
    }

public function storeResult(Request $request, int $labRequestId): JsonResponse
    {
        $this->authorizeResults($request);

$facility = $this->currentFacility($request);

$labRequest = LabRequest::inFacility($facility)->findOrFail($labRequestId);

if ($labRequest->status === 'cancelled') {
            abort(422, 'Cette demande d\'analyse a été annulée.');
        }

if ($labRequest->status === 'completed') {
            abort(422, 'Cette demande a déjà un résultat enregistré.');
        }

$data = $request->validate([
            'values' => ['required', 'string', 'max:4000'],
            'conclusion' => ['nullable', 'string', 'max:1000'],
        ], [
            'values.required' => 'Les valeurs des analyses sont obligatoires.',
        ]);

$labRequest->result()->updateOrCreate(
            [],
            [
                'values' => $data['values'],
                'conclusion' => $data['conclusion'] ?? null,
                'resulted_by' => $request->user()->id,
                'resulted_at' => now(),
            ]
        );

$labRequest->status = 'completed';
        $labRequest->save();

return response()->json([
            'lab_request' => $this->payload($labRequest->fresh()->load(
                'patient:id,local_code,first_name,last_name',
                'requester:id,name',
                'result.resultedBy:id,name'
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
        if (! $request->user()->can('lab.view')) {
            abort(403, 'Vous n\'avez pas accès au laboratoire.');
        }
    }

private function authorizeRequest(Request $request): void
    {
        if (! $request->user()->can('lab.requests.manage')) {
            abort(403, 'Seuls les médecins peuvent prescrire des analyses.');
        }
    }

private function authorizeResults(Request $request): void
    {
        if (! $request->user()->can('lab.results.manage')) {
            abort(403, 'Seul le laboratoire peut saisir les résultats.');
        }
    }

private function payload(LabRequest $r): array
    {
        return [
            'id' => $r->id,
            'patient' => [
                'id' => $r->patient->id,
                'local_code' => $r->patient->local_code,
                'first_name' => $r->patient->first_name,
                'last_name' => $r->patient->last_name,
            ],
            'requested_by' => $r->requester?->name,
            'consultation_id' => $r->consultation_id,
            'panel' => $r->panel,
            'priority' => $r->priority,
            'status' => $r->status,
            'notes' => $r->notes,
            'result' => $r->result ? [
                'values' => $r->result->values,
                'conclusion' => $r->result->conclusion,
                'resulted_by' => $r->result->resultedBy?->name,
                'resulted_at' => $r->result->resulted_at?->format('Y-m-d H:i'),
            ] : null,
            'created_at' => $r->created_at->format('Y-m-d H:i'),
        ];
    }
}
`
  );

// --- Seeder additif : permissions laboratoire ---
  writeFile(
    path.join(API, 'database', 'seeders', 'LabPermissionsSeeder.php'),
    String.raw`<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;

class LabPermissionsSeeder extends Seeder
{
    public function run(): void
    {
        $view = Permission::findOrCreate('lab.view');
        $manageRequests = Permission::findOrCreate('lab.requests.manage');
        $manageResults = Permission::findOrCreate('lab.results.manage');

$map = [
            'admin' => [$view, $manageRequests, $manageResults],
            'medecin' => [$view, $manageRequests],
            'infirmier' => [$view],
            'laborantin' => [$view, $manageResults],
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

// --- Routes API ---
  writeFile(
    path.join(API, 'routes', 'api.php'),
    String.raw`<?php

use App\Http\Controllers\AppointmentController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\ConsultationController;
use App\Http\Controllers\FacilityController;
use App\Http\Controllers\LabRequestController;
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

Route::middleware('auth:sanctum')->prefix('lab-requests')->group(function () {
    Route::get('/', [LabRequestController::class, 'index']);
    Route::post('/', [LabRequestController::class, 'store']);
    Route::get('/{labRequestId}', [LabRequestController::class, 'show'])
        ->whereNumber('labRequestId');
    Route::patch('/{labRequestId}', [LabRequestController::class, 'update'])
        ->whereNumber('labRequestId');
    Route::post('/{labRequestId}/result', [LabRequestController::class, 'storeResult'])
        ->whereNumber('labRequestId');
});
`
  );

ok('Migration, modèles, contrôleur, seeder et routes écrits');
}
