#!/usr/bin/env node
// HOSPIFLOW — M04 (2/4) : backend — migration, modèle, contrôleur, routes
import fs from 'node:fs';
import path from 'node:path';
import { API, ok, fail, writeFile } from './helpers.mjs';

export function installBackend() {
  // --- Migration ---
  const migrationsDir = path.join(API, 'database', 'migrations');
  const migrationExists = fs
    .readdirSync(migrationsDir)
    .some((f) => f.includes('create_appointments_table'));

if (migrationExists) {
    ok('Migration déjà présente');
  } else {
    const timestamp = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);

writeFile(
      path.join(migrationsDir, timestamp + '_create_appointments_table.php'),
      String.raw`<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('appointments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('facility_id')->constrained()->cascadeOnDelete();
            $table->foreignId('patient_id')->constrained()->cascadeOnDelete();
            $table->foreignId('practitioner_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('scheduled_at');
            $table->unsignedSmallInteger('duration_minutes')->default(30);
            $table->string('status', 20)->default('scheduled');
            $table->string('reason', 500)->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();

$table->index(['facility_id', 'scheduled_at']);
            $table->index(['practitioner_id', 'scheduled_at']);
        });
    }

public function down(): void
    {
        Schema::dropIfExists('appointments');
    }
};
`
    );
    ok('Migration appointments créée');
  }

// --- Modèle Appointment ---
  writeFile(
    path.join(API, 'app', 'Models', 'Appointment.php'),
    String.raw`<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Appointment extends Model
{
    public const STATUSES = ['scheduled', 'confirmed', 'done', 'cancelled', 'no_show'];

protected $fillable = [
        'facility_id',
        'patient_id',
        'practitioner_id',
        'created_by',
        'scheduled_at',
        'duration_minutes',
        'status',
        'reason',
        'notes',
    ];

protected $casts = [
        'scheduled_at' => 'datetime',
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

public function scopeInFacility($query, Facility $facility)
    {
        return $query->where('facility_id', $facility->id);
    }
}
`
  );

// --- Contrôleur AppointmentController ---
  writeFile(
    path.join(API, 'app', 'Http', 'Controllers', 'AppointmentController.php'),
    String.raw`<?php

namespace App\Http\Controllers;

use App\Models\Appointment;
use App\Models\Facility;
use App\Models\Patient;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

class AppointmentController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $this->authorizeView($request);

$facility = $this->currentFacility($request);

$query = Appointment::inFacility($facility)
            ->with(['patient:id,local_code,first_name,last_name', 'practitioner:id,name'])
            ->orderBy('scheduled_at');

$date = $request->query('date');

if ($date) {
            $query->whereDate('scheduled_at', $date);
        }

return response()->json([
            'appointments' => $query->get()
                ->map(fn ($a) => $this->payload($a)),
        ]);
    }

public function practitioners(Request $request): JsonResponse
    {
        $this->authorizeView($request);

$facility = $this->currentFacility($request);

$users = $facility->users()
            ->orderBy('name')
            ->get(['id', 'name']);

return response()->json([
            'practitioners' => $users->map(fn ($u) => [
                'id' => $u->id,
                'name' => $u->name,
            ]),
        ]);
    }

public function store(Request $request): JsonResponse
    {
        $this->authorizeManage($request);

$facility = $this->currentFacility($request);

$data = $request->validate([
            'patient_id' => ['required', 'integer', 'exists:patients,id'],
            'practitioner_id' => ['required', 'integer', 'exists:users,id'],
            'scheduled_at' => ['required', 'date', 'after:now'],
            'duration_minutes' => ['nullable', 'integer', 'min:5', 'max:480'],
            'reason' => ['nullable', 'string', 'max:500'],
        ], [
            'scheduled_at.after' => 'La date du rendez-vous doit être dans le futur.',
            'patient_id.exists' => 'Patient inconnu.',
            'practitioner_id.exists' => 'Praticien inconnu.',
        ]);

$patient = Patient::inFacility($facility)->find($data['patient_id']);

if (! $patient) {
            abort(422, 'Ce patient n\'existe pas dans votre établissement.');
        }

$practitioner = User::find($data['practitioner_id']);

if (! $practitioner->isMemberOf($facility)) {
            abort(422, 'Ce praticien n\'appartient pas à votre établissement.');
        }

$start = Carbon::parse($data['scheduled_at']);
        $duration = $data['duration_minutes'] ?? 30;

if ($this->hasConflict($facility, $practitioner->id, $start, $duration)) {
            abort(422, 'Conflit d\'agenda : le praticien a déjà un rendez-vous sur ce créneau.');
        }

$appointment = Appointment::create([
            'facility_id' => $facility->id,
            'patient_id' => $patient->id,
            'practitioner_id' => $practitioner->id,
            'created_by' => $request->user()->id,
            'scheduled_at' => $start,
            'duration_minutes' => $duration,
            'status' => 'scheduled',
            'reason' => $data['reason'] ?? null,
        ]);

return response()->json(
            ['appointment' => $this->payload($appointment->load(
                'patient:id,local_code,first_name,last_name',
                'practitioner:id,name'
            ))],
            201
        );
    }

public function show(Request $request, int $appointmentId): JsonResponse
    {
        $this->authorizeView($request);

$facility = $this->currentFacility($request);

$appointment = Appointment::inFacility($facility)
            ->with(['patient:id,local_code,first_name,last_name', 'practitioner:id,name'])
            ->findOrFail($appointmentId);

return response()->json([
            'appointment' => $this->payload($appointment),
        ]);
    }

public function update(Request $request, int $appointmentId): JsonResponse
    {
        $this->authorizeManage($request);

$facility = $this->currentFacility($request);

$appointment = Appointment::inFacility($facility)->findOrFail($appointmentId);

$data = $request->validate([
            'status' => ['sometimes', 'string', 'in:' . implode(',', Appointment::STATUSES)],
            'scheduled_at' => ['sometimes', 'date', 'after:now'],
            'duration_minutes' => ['sometimes', 'integer', 'min:5', 'max:480'],
            'reason' => ['sometimes', 'nullable', 'string', 'max:500'],
            'notes' => ['sometimes', 'nullable', 'string'],
        ], [
            'status.in' => 'Statut invalide.',
        ]);

if (isset($data['scheduled_at'])) {
            $start = Carbon::parse($data['scheduled_at']);
            $duration = $data['duration_minutes'] ?? $appointment->duration_minutes;

if ($appointment->status !== 'cancelled') {
                if ($this->hasConflict($facility, $appointment->practitioner_id, $start, $duration, $appointment->id)) {
                    abort(422, 'Conflit d\'agenda : le praticien a déjà un rendez-vous sur ce créneau.');
                }
            }

$appointment->scheduled_at = $start;
        }

if (isset($data['duration_minutes'])) {
            $appointment->duration_minutes = $data['duration_minutes'];
        }

if (array_key_exists('reason', $data)) {
            $appointment->reason = $data['reason'];
        }

if (array_key_exists('notes', $data)) {
            $appointment->notes = $data['notes'];
        }

if (isset($data['status'])) {
            $appointment->status = $data['status'];
        }

$appointment->save();

return response()->json([
            'appointment' => $this->payload($appointment->fresh()->load(
                'patient:id,local_code,first_name,last_name',
                'practitioner:id,name'
            )),
        ]);
    }

private function hasConflict(
        Facility $facility,
        int $practitionerId,
        $start,
        int $durationMinutes,
        ?int $ignoreId = null
    ): bool {
        $end = (clone $start)->addMinutes($durationMinutes);
        $maxDuration = 480;

$query = Appointment::inFacility($facility)
            ->where('practitioner_id', $practitionerId)
            ->whereIn('status', ['scheduled', 'confirmed'])
            ->where('scheduled_at', '<', $end)
            ->where('scheduled_at', '>=', (clone $start)->subMinutes($maxDuration));

if ($ignoreId !== null) {
            $query->where('id', '!=', $ignoreId);
        }

foreach ($query->get(['scheduled_at', 'duration_minutes']) as $existing) {
            $existingEnd = $existing->scheduled_at->addMinutes($existing->duration_minutes);

if ($existingEnd > $start) {
                return true;
            }
        }

return false;
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
        $allowed = $request->user()->can('patients.view');

if (! $allowed) {
            abort(403, 'Vous n\'avez pas le droit de consulter les rendez-vous.');
        }
    }

private function authorizeManage(Request $request): void
    {
        $allowed = $request->user()->can('appointments.manage');

if (! $allowed) {
            abort(403, 'Vous n\'avez pas le droit de gérer les rendez-vous.');
        }
    }

private function payload(Appointment $a): array
    {
        return [
            'id' => $a->id,
            'patient' => [
                'id' => $a->patient->id,
                'local_code' => $a->patient->local_code,
                'first_name' => $a->patient->first_name,
                'last_name' => $a->patient->last_name,
            ],
            'practitioner' => [
                'id' => $a->practitioner->id,
                'name' => $a->practitioner->name,
            ],
            'scheduled_at' => $a->scheduled_at->format('Y-m-d H:i'),
            'duration_minutes' => $a->duration_minutes,
            'status' => $a->status,
            'reason' => $a->reason,
            'notes' => $a->notes,
        ];
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
`
  );

ok('Modèle, contrôleur et routes écrits');
}
