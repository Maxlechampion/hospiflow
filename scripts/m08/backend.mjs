#!/usr/bin/env node
// HOSPIFLOW — M08 (2/4) : backend — facturation & encaissements
import fs from 'node:fs';
import path from 'node:path';
import { API, ok, writeFile } from './helpers.mjs';

export function installBackend() {
  // --- Migration billing ---
  const migrationsDir = path.join(API, 'database', 'migrations');
  const migrationExists = fs
    .readdirSync(migrationsDir)
    .some((f) => f.includes('create_billing_tables'));

if (migrationExists) {
    ok('Migration déjà présente');
  } else {
    const timestamp = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);

writeFile(
      path.join(migrationsDir, timestamp + '_create_billing_tables.php'),
      String.raw`<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('invoices', function (Blueprint $table) {
            $table->id();
            $table->foreignId('facility_id')->constrained()->cascadeOnDelete();
            $table->foreignId('patient_id')->constrained()->cascadeOnDelete();
            $table->foreignId('consultation_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('created_by')->constrained('users')->cascadeOnDelete();
            $table->string('number', 40);
            $table->string('status', 20)->default('draft');
            $table->unsignedBigInteger('total_amount')->default(0);
            $table->date('due_date')->nullable();
            $table->timestamps();

$table->unique(['facility_id', 'number']);
            $table->index(['facility_id', 'status']);
        });

Schema::create('invoice_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('invoice_id')->constrained()->cascadeOnDelete();
            $table->string('label', 300);
            $table->unsignedInteger('quantity')->default(1);
            $table->unsignedBigInteger('unit_price')->default(0);
            $table->unsignedBigInteger('amount')->default(0);
            $table->timestamps();
        });

Schema::create('payments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('invoice_id')->constrained()->cascadeOnDelete();
            $table->unsignedBigInteger('amount');
            $table->string('method', 30);
            $table->foreignId('received_by')->constrained('users')->cascadeOnDelete();
            $table->timestamp('paid_at');
            $table->timestamps();
        });
    }

public function down(): void
    {
        Schema::dropIfExists('payments');
        Schema::dropIfExists('invoice_items');
        Schema::dropIfExists('invoices');
    }
};
`
    );
    ok('Migration facturation créée');
  }

// --- Modèle Invoice (avec relation patient) ---
  writeFile(
    path.join(API, 'app', 'Models', 'Invoice.php'),
    String.raw`<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Invoice extends Model
{
    public const STATUSES = ['draft', 'issued', 'paid', 'cancelled'];

public const PAYMENT_METHODS = ['cash', 'mobile_money', 'transfer'];

protected $fillable = [
        'facility_id',
        'patient_id',
        'consultation_id',
        'created_by',
        'number',
        'status',
        'total_amount',
        'due_date',
    ];

protected $casts = [
        'due_date' => 'date',
    ];

public function patient(): BelongsTo
    {
        return $this->belongsTo(Patient::class);
    }

public function items(): HasMany
    {
        return $this->hasMany(InvoiceItem::class);
    }

public function payments(): HasMany
    {
        return $this->hasMany(Payment::class);
    }

public function scopeInFacility($query, Facility $facility)
    {
        return $query->where('facility_id', $facility->id);
    }
}
`
  );

// --- Modèle InvoiceItem ---
  writeFile(
    path.join(API, 'app', 'Models', 'InvoiceItem.php'),
    String.raw`<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class InvoiceItem extends Model
{
    protected $fillable = [
        'invoice_id',
        'label',
        'quantity',
        'unit_price',
        'amount',
    ];

public function invoice(): BelongsTo
    {
        return $this->belongsTo(Invoice::class);
    }
}
`
  );

// --- Modèle Payment ---
  writeFile(
    path.join(API, 'app', 'Models', 'Payment.php'),
    String.raw`<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Payment extends Model
{
    protected $fillable = [
        'invoice_id',
        'amount',
        'method',
        'received_by',
        'paid_at',
    ];

protected $casts = [
        'paid_at' => 'datetime',
    ];

public function invoice(): BelongsTo
    {
        return $this->belongsTo(Invoice::class);
    }
}
`
  );

// --- Contrôleur InvoiceController ---
  writeFile(
    path.join(API, 'app', 'Http', 'Controllers', 'InvoiceController.php'),
    String.raw`<?php

namespace App\Http\Controllers;

use App\Models\Consultation;
use App\Models\Facility;
use App\Models\Invoice;
use App\Models\InvoiceItem;
use App\Models\Patient;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class InvoiceController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $this->authorizeView($request);

$facility = $this->currentFacility($request);

$query = Invoice::inFacility($facility)
            ->with(['patient:id,local_code,first_name,last_name'])
            ->withSum('payments as paid_amount', 'amount')
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
            'invoices' => $query->get()
                ->map(fn ($i) => $this->payload($i)),
        ]);
    }

public function store(Request $request): JsonResponse
    {
        $this->authorizeManage($request);

$facility = $this->currentFacility($request);

$data = $request->validate([
            'patient_id' => ['required', 'integer', 'exists:patients,id'],
            'consultation_id' => ['nullable', 'integer', 'exists:consultations,id'],
            'due_date' => ['nullable', 'date', 'after:today'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.label' => ['required', 'string', 'max:300'],
            'items.*.quantity' => ['required', 'integer', 'min:1', 'max:10000'],
            'items.*.unit_price' => ['required', 'integer', 'min:0', 'max:100000000'],
        ], [
            'patient_id.exists' => 'Patient inconnu.',
            'consultation_id.exists' => 'Consultation inconnue.',
            'items.required' => 'La facture doit contenir au moins une ligne.',
            'due_date.after' => 'L\'échéance doit être future.',
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

$invoice = DB::transaction(function () use ($facility, $patient, $consultation, $data, $request) {
            $total = 0;

foreach ($data['items'] as $item) {
                $total += $item['quantity'] * $item['unit_price'];
            }

$record = Invoice::create([
                'facility_id' => $facility->id,
                'patient_id' => $patient->id,
                'consultation_id' => $consultation?->id,
                'created_by' => $request->user()->id,
                'number' => 'TMP-' . uniqid(),
                'status' => 'draft',
                'total_amount' => $total,
                'due_date' => $data['due_date'] ?? null,
            ]);

$record->number = 'FAC-' . str_pad((string) $record->id, 5, '0', STR_PAD_LEFT);
            $record->save();

foreach ($data['items'] as $item) {
                InvoiceItem::create([
                    'invoice_id' => $record->id,
                    'label' => $item['label'],
                    'quantity' => $item['quantity'],
                    'unit_price' => $item['unit_price'],
                    'amount' => $item['quantity'] * $item['unit_price'],
                ]);
            }

return $record;
        });

return response()->json(
            ['invoice' => $this->payload($invoice->load(
                'patient:id,local_code,first_name,last_name',
                'items',
                'payments'
            ))],
            201
        );
    }

public function show(Request $request, int $invoiceId): JsonResponse
    {
        $this->authorizeView($request);

$facility = $this->currentFacility($request);

$invoice = Invoice::inFacility($facility)
            ->with(['patient:id,local_code,first_name,last_name', 'items', 'payments'])
            ->withSum('payments as paid_amount', 'amount')
            ->findOrFail($invoiceId);

return response()->json([
            'invoice' => $this->payload($invoice),
        ]);
    }

public function update(Request $request, int $invoiceId): JsonResponse
    {
        $this->authorizeManage($request);

$facility = $this->currentFacility($request);

$invoice = Invoice::inFacility($facility)->findOrFail($invoiceId);

$data = $request->validate([
            'status' => ['required', 'string', 'in:issued,cancelled'],
        ], [
            'status.in' => 'Transition invalide (émettre ou annuler uniquement).',
        ]);

if ($invoice->status === 'paid') {
            abort(422, 'Cette facture est payée et ne peut plus être modifiée.');
        }

if ($invoice->status === 'cancelled') {
            abort(422, 'Cette facture est annulée et ne peut plus être modifiée.');
        }

if ($data['status'] === 'cancelled') {
            $paid = (int) $invoice->payments()->sum('amount');

if ($paid > 0) {
                abort(422, 'Impossible d\'annuler une facture ayant encaissé ' . $paid . ' XOF.');
            }
        }

if ($data['status'] === 'issued') {
            if ($invoice->status !== 'draft') {
                abort(422, 'Seule une facture brouillon peut être émise.');
            }
        }

$invoice->status = $data['status'];
        $invoice->save();

return response()->json([
            'invoice' => $this->payload($invoice->fresh()->load(
                'patient:id,local_code,first_name,last_name',
                'items',
                'payments'
            )),
        ]);
    }

public function pay(Request $request, int $invoiceId): JsonResponse
    {
        $this->authorizeManage($request);

$facility = $this->currentFacility($request);

$data = $request->validate([
            'amount' => ['required', 'integer', 'min:1', 'max:100000000'],
            'method' => ['required', 'string', 'in:' . implode(',', Invoice::PAYMENT_METHODS)],
        ], [
            'amount.required' => 'Le montant encaissé est obligatoire.',
            'method.in' => 'Mode de paiement invalide.',
        ]);

$invoice = DB::transaction(function () use ($facility, $invoiceId, $data, $request) {
            $record = Invoice::inFacility($facility)
                ->with(['patient:id,local_code,first_name,last_name', 'items', 'payments'])
                ->lockForUpdate()
                ->findOrFail($invoiceId);

if ($record->status !== 'issued') {
                abort(422, 'Seule une facture émise peut être encaissée (statut actuel : ' . $record->status . ').');
            }

$paid = (int) $record->payments()->sum('amount');
            $remaining = $record->total_amount - $paid;

if ($data['amount'] > $remaining) {
                abort(422, 'Montant supérieur au reste à payer (' . $remaining . ' XOF).');
            }

$record->payments()->create([
                'amount' => $data['amount'],
                'method' => $data['method'],
                'received_by' => $request->user()->id,
                'paid_at' => now(),
            ]);

$paid += $data['amount'];

if ($paid >= $record->total_amount) {
                $record->status = 'paid';
                $record->save();
            }

return $record->fresh()->load(
                'patient:id,local_code,first_name,last_name',
                'items',
                'payments'
            );
        });

return response()->json([
            'invoice' => $this->payload($invoice),
        ]);
    }

private function payload(Invoice $i): array
    {
        $paidAmount = (int) ($i->paid_amount ?? $i->payments->sum('amount'));

return [
            'id' => $i->id,
            'number' => $i->number,
            'patient' => [
                'id' => $i->patient->id,
                'local_code' => $i->patient->local_code,
                'first_name' => $i->patient->first_name,
                'last_name' => $i->patient->last_name,
            ],
            'consultation_id' => $i->consultation_id,
            'status' => $i->status,
            'total_amount' => (int) $i->total_amount,
            'paid_amount' => $paidAmount,
            'remaining_amount' => (int) $i->total_amount - $paidAmount,
            'due_date' => $i->due_date?->format('Y-m-d'),
            'items' => $i->items->map(fn ($item) => [
                'label' => $item->label,
                'quantity' => $item->quantity,
                'unit_price' => (int) $item->unit_price,
                'amount' => (int) $item->amount,
            ]),
            'payments' => $i->payments->map(fn ($p) => [
                'amount' => (int) $p->amount,
                'method' => $p->method,
                'paid_at' => $p->paid_at->format('Y-m-d H:i'),
            ]),
            'created_at' => $i->created_at->format('Y-m-d H:i'),
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
        if (! $request->user()->can('billing.view')) {
            abort(403, 'Vous n\'avez pas accès à la facturation.');
        }
    }

private function authorizeManage(Request $request): void
    {
        if (! $request->user()->can('billing.manage')) {
            abort(403, 'Vous n\'avez pas le droit de gérer la facturation.');
        }
    }
}
`
  );

// --- Seeder additif : permissions facturation ---
  writeFile(
    path.join(API, 'database', 'seeders', 'BillingPermissionsSeeder.php'),
    String.raw`<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;

class BillingPermissionsSeeder extends Seeder
{
    public function run(): void
    {
        $view = Permission::findOrCreate('billing.view');
        $manage = Permission::findOrCreate('billing.manage');

$map = [
            'admin' => [$view, $manage],
            'comptable' => [$view, $manage],
            'medecin' => [$view],
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
use App\Http\Controllers\InvoiceController;
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

Route::middleware('auth:sanctum')->prefix('invoices')->group(function () {
    Route::get('/', [InvoiceController::class, 'index']);
    Route::post('/', [InvoiceController::class, 'store']);
    Route::get('/{invoiceId}', [InvoiceController::class, 'show'])
        ->whereNumber('invoiceId');
    Route::patch('/{invoiceId}', [InvoiceController::class, 'update'])
        ->whereNumber('invoiceId');
    Route::post('/{invoiceId}/payments', [InvoiceController::class, 'pay'])
        ->whereNumber('invoiceId');
});
`
  );

ok('Migration, modèles, contrôleur, seeder et routes écrits');
}
