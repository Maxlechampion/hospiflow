#!/usr/bin/env node
// HOSPIFLOW — M07 (2/4) : backend — pharmacie, stock & dispensations
import fs from 'node:fs';
import path from 'node:path';
import { API, ok, writeFile } from './helpers.mjs';

export function installBackend() {
  // --- Migration pharmacy ---
  const migrationsDir = path.join(API, 'database', 'migrations');
  const migrationExists = fs
    .readdirSync(migrationsDir)
    .some((f) => f.includes('create_pharmacy_tables'));

if (migrationExists) {
    ok('Migration déjà présente');
  } else {
    const timestamp = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);

writeFile(
      path.join(migrationsDir, timestamp + '_create_pharmacy_tables.php'),
      String.raw`<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('drugs', function (Blueprint $table) {
            $table->id();
            $table->string('name', 200)->unique();
            $table->string('form', 100);
            $table->string('dosage', 100)->nullable();
            $table->string('unit', 50);
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

Schema::create('drug_lots', function (Blueprint $table) {
            $table->id();
            $table->foreignId('facility_id')->constrained()->cascadeOnDelete();
            $table->foreignId('drug_id')->constrained()->cascadeOnDelete();
            $table->string('lot_number', 100)->nullable();
            $table->unsignedInteger('quantity')->default(0);
            $table->date('expires_at')->nullable();
            $table->timestamps();

$table->index(['facility_id', 'drug_id']);
        });

Schema::create('dispensations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('facility_id')->constrained()->cascadeOnDelete();
            $table->foreignId('patient_id')->constrained()->cascadeOnDelete();
            $table->foreignId('consultation_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('drug_id')->constrained()->cascadeOnDelete();
            $table->foreignId('dispensed_by')->constrained('users')->cascadeOnDelete();
            $table->unsignedInteger('quantity');
            $table->string('notes', 500)->nullable();
            $table->timestamps();

$table->index(['facility_id', 'patient_id']);
        });
    }

public function down(): void
    {
        Schema::dropIfExists('dispensations');
        Schema::dropIfExists('drug_lots');
        Schema::dropIfExists('drugs');
    }
};
`
    );
    ok('Migration pharmacie créée');
  }

// --- Modèle Drug ---
  writeFile(
    path.join(API, 'app', 'Models', 'Drug.php'),
    String.raw`<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Drug extends Model
{
    protected $fillable = [
        'name',
        'form',
        'dosage',
        'unit',
        'is_active',
    ];

protected $casts = [
        'is_active' => 'boolean',
    ];

public function lots(): HasMany
    {
        return $this->hasMany(DrugLot::class);
    }
}
`
  );

// --- Modèle DrugLot ---
  writeFile(
    path.join(API, 'app', 'Models', 'DrugLot.php'),
    String.raw`<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DrugLot extends Model
{
    protected $fillable = [
        'facility_id',
        'drug_id',
        'lot_number',
        'quantity',
        'expires_at',
    ];

protected $casts = [
        'expires_at' => 'date',
    ];

public function drug(): BelongsTo
    {
        return $this->belongsTo(Drug::class);
    }

public function scopeInFacility($query, Facility $facility)
    {
        return $query->where('facility_id', $facility->id);
    }
}
`
  );

// --- Modèle Dispensation ---
  writeFile(
    path.join(API, 'app', 'Models', 'Dispensation.php'),
    String.raw`<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Dispensation extends Model
{
    protected $fillable = [
        'facility_id',
        'patient_id',
        'consultation_id',
        'drug_id',
        'dispensed_by',
        'quantity',
        'notes',
    ];

public function patient(): BelongsTo
    {
        return $this->belongsTo(Patient::class);
    }

public function drug(): BelongsTo
    {
        return $this->belongsTo(Drug::class);
    }

public function dispenser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'dispensed_by');
    }

public function scopeInFacility($query, Facility $facility)
    {
        return $query->where('facility_id', $facility->id);
    }
}
`
  );

// --- Contrôleur PharmacyController ---
  writeFile(
    path.join(API, 'app', 'Http', 'Controllers', 'PharmacyController.php'),
    String.raw`<?php

namespace App\Http\Controllers;

use App\Models\Consultation;
use App\Models\Dispensation;
use App\Models\Drug;
use App\Models\DrugLot;
use App\Models\Facility;
use App\Models\Patient;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class PharmacyController extends Controller
{
    // ---------- Catalogue ----------

public function drugs(Request $request): JsonResponse
    {
        $this->authorizeView($request);

$this->currentFacility($request);

$drugs = Drug::orderBy('name')->get();

return response()->json([
            'drugs' => $drugs->map(fn ($d) => [
                'id' => $d->id,
                'name' => $d->name,
                'form' => $d->form,
                'dosage' => $d->dosage,
                'unit' => $d->unit,
                'is_active' => $d->is_active,
            ]),
        ]);
    }

public function storeDrug(Request $request): JsonResponse
    {
        $this->authorizeManage($request);

$this->currentFacility($request);

$data = $request->validate([
            'name' => ['required', 'string', 'max:200', 'unique:drugs,name'],
            'form' => ['required', 'string', 'max:100'],
            'dosage' => ['nullable', 'string', 'max:100'],
            'unit' => ['required', 'string', 'max:50'],
        ], [
            'name.required' => 'Le nom du médicament est obligatoire.',
            'name.unique' => 'Ce médicament existe déjà au catalogue.',
            'unit.required' => 'L\'unité de dispensation est obligatoire.',
        ]);

$drug = Drug::create([
            'name' => $data['name'],
            'form' => $data['form'],
            'dosage' => $data['dosage'] ?? null,
            'unit' => $data['unit'],
            'is_active' => true,
        ]);

return response()->json(['drug' => [
            'id' => $drug->id,
            'name' => $drug->name,
            'form' => $drug->form,
            'dosage' => $drug->dosage,
            'unit' => $drug->unit,
            'is_active' => $drug->is_active,
        ]], 201);
    }

// ---------- Stock ----------

public function stock(Request $request): JsonResponse
    {
        $this->authorizeView($request);

$facility = $this->currentFacility($request);

$expiringDays = $request->query('expiring_days');

$query = DrugLot::inFacility($facility)
            ->with('drug:id,name,form,dosage,unit')
            ->orderBy('expires_at');

if ($expiringDays !== null) {
            $limit = now()->addDays((int) $expiringDays)->endOfDay();

$query->whereNotNull('expires_at')
                ->where('expires_at', '<=', $limit)
                ->where('expires_at', '>', now())
                ->where('quantity', '>', 0);
        }

return response()->json([
            'lots' => $query->get()
                ->map(fn ($lot) => $this->lotPayload($lot)),
        ]);
    }

public function storeStock(Request $request): JsonResponse
    {
        $this->authorizeManage($request);

$facility = $this->currentFacility($request);

$data = $request->validate([
            'drug_id' => ['required', 'integer', 'exists:drugs,id'],
            'lot_number' => ['nullable', 'string', 'max:100'],
            'quantity' => ['required', 'integer', 'min:1', 'max:1000000'],
            'expires_at' => ['nullable', 'date', 'after:today'],
        ], [
            'quantity.required' => 'La quantité du lot est obligatoire.',
            'expires_at.after' => 'La date de péremption doit être future.',
            'drug_id.exists' => 'Médicament inconnu.',
        ]);

$drug = Drug::where('is_active', true)->find($data['drug_id']);

if (! $drug) {
            abort(422, 'Ce médicament est inconnu ou inactif.');
        }

$lot = DrugLot::create([
            'facility_id' => $facility->id,
            'drug_id' => $drug->id,
            'lot_number' => $data['lot_number'] ?? null,
            'quantity' => $data['quantity'],
            'expires_at' => $data['expires_at'] ?? null,
        ]);

return response()->json(
            ['lot' => $this->lotPayload($lot->load('drug:id,name,form,dosage,unit'))],
            201
        );
    }

// ---------- Dispensations ----------

public function dispensations(Request $request): JsonResponse
    {
        $this->authorizeView($request);

$facility = $this->currentFacility($request);

$query = Dispensation::inFacility($facility)
            ->with(['patient:id,local_code,first_name,last_name', 'drug:id,name,unit', 'dispenser:id,name'])
            ->orderByDesc('created_at');

$patientId = $request->query('patient_id');

if ($patientId !== null) {
            $query->where('patient_id', (int) $patientId);
        }

return response()->json([
            'dispensations' => $query->get()
                ->map(fn ($d) => $this->dispensationPayload($d)),
        ]);
    }

public function dispense(Request $request): JsonResponse
    {
        $this->authorizeManage($request);

$facility = $this->currentFacility($request);

$data = $request->validate([
            'patient_id' => ['required', 'integer', 'exists:patients,id'],
            'consultation_id' => ['nullable', 'integer', 'exists:consultations,id'],
            'drug_id' => ['required', 'integer', 'exists:drugs,id'],
            'quantity' => ['required', 'integer', 'min:1', 'max:10000'],
            'notes' => ['nullable', 'string', 'max:500'],
        ], [
            'quantity.required' => 'La quantité dispensée est obligatoire.',
            'patient_id.exists' => 'Patient inconnu.',
            'drug_id.exists' => 'Médicament inconnu.',
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

$drug = Drug::where('is_active', true)->find($data['drug_id']);

if (! $drug) {
            abort(422, 'Ce médicament est inconnu ou inactif.');
        }

$quantity = $data['quantity'];

[$dispensation, $remaining] = DB::transaction(function () use ($facility, $patient, $consultation, $drug, $quantity, $request) {
            $lots = DrugLot::inFacility($facility)
                ->where('drug_id', $drug->id)
                ->where('quantity', '>', 0)
                ->where(function ($q) {
                    $q->whereNull('expires_at')->orWhere('expires_at', '>', now());
                })
                ->orderBy('expires_at')
                ->lockForUpdate()
                ->get();

$available = $lots->sum('quantity');

if ($available < $quantity) {
                abort(422, 'Stock insuffisant : ' . $available . ' ' . $drug->unit . '(s) disponible(s).');
            }

$left = $quantity;

foreach ($lots as $lot) {
                if ($left <= 0) {
                    break;
                }

$take = min($lot->quantity, $left);
                $lot->quantity -= $take;
                $lot->save();
                $left -= $take;
            }

$record = Dispensation::create([
                'facility_id' => $facility->id,
                'patient_id' => $patient->id,
                'consultation_id' => $consultation?->id,
                'drug_id' => $drug->id,
                'dispensed_by' => $request->user()->id,
                'quantity' => $quantity,
                'notes' => request('notes'),
            ]);

return [$record, $available - $quantity];
        });

return response()->json([
            'dispensation' => $this->dispensationPayload($dispensation->load(
                'patient:id,local_code,first_name,last_name',
                'drug:id,name,unit',
                'dispenser:id,name'
            )),
            'remaining_stock' => $remaining,
        ], 201);
    }

public function showDispensation(Request $request, int $dispensationId): JsonResponse
    {
        $this->authorizeView($request);

$facility = $this->currentFacility($request);

$dispensation = Dispensation::inFacility($facility)
            ->with(['patient:id,local_code,first_name,last_name', 'drug:id,name,unit', 'dispenser:id,name'])
            ->findOrFail($dispensationId);

return response()->json([
            'dispensation' => $this->dispensationPayload($dispensation),
        ]);
    }

// ---------- Helpers ----------

private function lotPayload(DrugLot $lot): array
    {
        $expiringSoon = $lot->expires_at !== null
            && $lot->expires_at->isFuture()
            && $lot->expires_at->lessThanOrEqualTo(now()->addDays(30))
            && $lot->quantity > 0;

return [
            'id' => $lot->id,
            'drug' => [
                'id' => $lot->drug->id,
                'name' => $lot->drug->name,
                'form' => $lot->drug->form,
                'dosage' => $lot->drug->dosage,
                'unit' => $lot->drug->unit,
            ],
            'lot_number' => $lot->lot_number,
            'quantity' => $lot->quantity,
            'expires_at' => $lot->expires_at?->format('Y-m-d'),
            'expired' => $lot->expires_at !== null && $lot->expires_at->isPast(),
            'expiring_soon' => $expiringSoon,
        ];
    }

private function dispensationPayload(Dispensation $d): array
    {
        return [
            'id' => $d->id,
            'patient' => [
                'id' => $d->patient->id,
                'local_code' => $d->patient->local_code,
                'first_name' => $d->patient->first_name,
                'last_name' => $d->patient->last_name,
            ],
            'drug' => [
                'id' => $d->drug->id,
                'name' => $d->drug->name,
                'unit' => $d->drug->unit,
            ],
            'quantity' => $d->quantity,
            'dispensed_by' => $d->dispenser?->name,
            'consultation_id' => $d->consultation_id,
            'notes' => $d->notes,
            'created_at' => $d->created_at->format('Y-m-d H:i'),
        ];
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
        if (! $request->user()->can('pharmacy.view')) {
            abort(403, 'Vous n\'avez pas accès à la pharmacie.');
        }
    }

private function authorizeManage(Request $request): void
    {
        if (! $request->user()->can('pharmacy.manage')) {
            abort(403, 'Vous n\'avez pas le droit de gérer la pharmacie.');
        }
    }
}
`
  );

// --- Seeder additif : permissions pharmacie ---
  writeFile(
    path.join(API, 'database', 'seeders', 'PharmacyPermissionsSeeder.php'),
    String.raw`<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;

class PharmacyPermissionsSeeder extends Seeder
{
    public function run(): void
    {
        $view = Permission::findOrCreate('pharmacy.view');
        $manage = Permission::findOrCreate('pharmacy.manage');

$map = [
            'admin' => [$view, $manage],
            'medecin' => [$view],
            'infirmier' => [$view],
            'pharmacien' => [$view, $manage],
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
use App\Http\Controllers\PharmacyController;
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

Route::middleware('auth:sanctum')->prefix('pharmacy')->group(function () {
    Route::get('/drugs', [PharmacyController::class, 'drugs']);
    Route::post('/drugs', [PharmacyController::class, 'storeDrug']);
    Route::get('/stock', [PharmacyController::class, 'stock']);
    Route::post('/stock', [PharmacyController::class, 'storeStock']);
    Route::get('/dispensations', [PharmacyController::class, 'dispensations']);
    Route::post('/dispensations', [PharmacyController::class, 'dispense']);
    Route::get('/dispensations/{dispensationId}', [PharmacyController::class, 'showDispensation'])
        ->whereNumber('dispensationId');
});
`
  );

ok('Migration, modèles, contrôleur, seeder et routes écrits');
}
