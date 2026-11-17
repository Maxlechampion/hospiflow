#!/usr/bin/env node
// HOSPIFLOW — M09 (2/4) : backend — rapports & statistiques
import fs from 'node:fs';
import path from 'node:path';
import { API, ok, fail, writeFile } from './helpers.mjs';

function createdTables(content) {
  const tables = [];
  const marker = "Schema::create('";
  let cursor = 0;

while (cursor < content.length) {
    const start = content.indexOf(marker, cursor);
    if (start === -1) {
      break;
    }
    const nameStart = start + marker.length;
    const nameEnd = content.indexOf("'", nameStart);
    if (nameEnd === -1) {
      break;
    }
    tables.push(content.slice(nameStart, nameEnd));
    cursor = nameEnd + 1;
  }

return tables;
}

function tableBody(content, tableName) {
  const marker = "Schema::create('" + tableName + "'";
  const start = content.indexOf(marker);
  if (start === -1) {
    return '';
  }
  const rest = content.slice(start);
  const next = rest.indexOf('Schema::create', marker.length);
  if (next === -1) {
    return rest;
  }
  return rest.slice(0, next);
}

export function installBackend() {
  // --- Résolution dynamique des tables M04/M06/M07 ---
  const migrationsDir = path.join(API, 'database', 'migrations');
  const migrationFiles = fs.readdirSync(migrationsDir);

function readMigration(needle) {
    const name = migrationFiles.find((f) => f.includes(needle));
    if (!name) {
      return '';
    }
    return fs.readFileSync(path.join(migrationsDir, name), 'utf8');
  }

const pharmacySql = readMigration('pharmacy');
  const pharmacyTables = createdTables(pharmacySql);

const drugTable = pharmacyTables.find((t) => t === 'drugs')
    || pharmacyTables.find((t) => t.includes('drug'));
  const stockTable = pharmacyTables.find((t) => t.includes('stock'))
    || pharmacyTables.find((t) => t.includes('lot'));
  const dispensationTable = pharmacyTables.find((t) => t.includes('dispens'));

if (!drugTable) {
    fail('Table médicaments introuvable — le module M07 doit être installé.');
  }
  if (!stockTable) {
    fail('Table de lots de stock introuvable — le module M07 doit être installé.');
  }
  if (!dispensationTable) {
    fail('Table dispensations introuvable — le module M07 doit être installé.');
  }

const labTable = createdTables(readMigration('lab'))
    .find((t) => t.includes('lab'));

if (!labTable) {
    fail('Table laboratoire introuvable — le module M06 doit être installé.');
  }

const appointmentBody = tableBody(readMigration('appointment'), 'appointments');
  const appointmentDateCol = ['scheduled_at', 'starts_at', 'date_time', 'appointment_date']
    .find((c) => appointmentBody.includes("'" + c + "'")) || 'scheduled_at';

const stockBody = tableBody(pharmacySql, stockTable);
  const stockQtyCol = ['quantity', 'remaining_quantity', 'current_quantity', 'units']
    .find((c) => stockBody.includes("'" + c + "'")) || 'quantity';
  const expiryCol = stockBody.includes('expires_at') ? 'expires_at' : 'expiry_date';

const drugsBody = tableBody(pharmacySql, drugTable);
  const drugNameCol = drugsBody.includes("'name'") ? 'name' : 'label';

ok('Tables résolues — labo: ' + labTable + ', stock: ' + stockTable
    + ', dispensations: ' + dispensationTable + ', date RDV: ' + appointmentDateCol);

// --- Contrôleur ReportController ---
  writeFile(
    path.join(API, 'app', 'Http', 'Controllers', 'ReportController.php'),
    String.raw`<?php

namespace App\Http\Controllers;

use App\Models\Facility;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ReportController extends Controller
{
    private const LOW_STOCK_THRESHOLD = 20;

private const EXPIRY_WINDOW_DAYS = 60;

public function overview(Request $request): JsonResponse
    {
        $this->authorizeReport($request);

$facility = $this->currentFacility($request);
        [$from, $to] = $this->period($request);

$fromAt = $from . ' 00:00:00';
        $toAt = $to . ' 23:59:59';

$patientsTotal = DB::table('patients')
            ->where('facility_id', $facility->id)
            ->count();

$newPatients = DB::table('patients')
            ->where('facility_id', $facility->id)
            ->whereBetween('created_at', [$fromAt, $toAt])
            ->count();

$appointmentsByStatus = DB::table('appointments')
            ->where('facility_id', $facility->id)
            ->whereBetween('${appointmentDateCol}', [$fromAt, $toAt])
            ->groupBy('status')
            ->selectRaw('status, count(*) as total')
            ->get()
            ->mapWithKeys(fn ($row) => [$row->status => (int) $row->total]);

$consultationsTotal = DB::table('consultations')
            ->where('facility_id', $facility->id)
            ->whereBetween('created_at', [$fromAt, $toAt])
            ->count();

$labRequestsByStatus = DB::table('${labTable}')
            ->where('facility_id', $facility->id)
            ->whereBetween('created_at', [$fromAt, $toAt])
            ->groupBy('status')
            ->selectRaw('status, count(*) as total')
            ->get()
            ->mapWithKeys(fn ($row) => [$row->status => (int) $row->total]);

$dispensationsTotal = DB::table('${dispensationTable}')
            ->where('facility_id', $facility->id)
            ->whereBetween('created_at', [$fromAt, $toAt])
            ->count();

$invoices = DB::table('invoices')
            ->where('facility_id', $facility->id)
            ->whereBetween('created_at', [$fromAt, $toAt])
            ->where('status', '!=', 'cancelled')
            ->get(['id', 'total_amount']);

$billedTotal = (int) $invoices->sum('total_amount');

$paidInPeriod = (int) DB::table('payments')
            ->join('invoices', 'payments.invoice_id', '=', 'invoices.id')
            ->where('invoices.facility_id', $facility->id)
            ->whereBetween('payments.paid_at', [$fromAt, $toAt])
            ->sum('payments.amount');

$issuedInvoices = DB::table('invoices')
            ->where('facility_id', $facility->id)
            ->where('status', 'issued')
            ->get(['id', 'total_amount']);

$issuedBilled = (int) $issuedInvoices->sum('total_amount');

$issuedPaid = (int) DB::table('payments')
            ->whereIn('invoice_id', $issuedInvoices->pluck('id'))
            ->sum('amount');

$outstandingTotal = $issuedBilled - $issuedPaid;

$recoveryRate = null;

if ($billedTotal > 0) {
            $recoveryRate = round($paidInPeriod * 100 / $billedTotal, 1);
        }

return response()->json([
            'report' => [
                'facility' => ['id' => $facility->id, 'code' => $facility->code],
                'period' => ['from' => $from, 'to' => $to],
                'patients' => [
                    'total' => $patientsTotal,
                    'new_in_period' => $newPatients,
                ],
                'appointments_by_status' => $appointmentsByStatus,
                'consultations_in_period' => $consultationsTotal,
                'lab_requests_by_status' => $labRequestsByStatus,
                'dispensations_in_period' => $dispensationsTotal,
                'billing' => [
                    'invoices_in_period' => $invoices->count(),
                    'billed_in_period' => $billedTotal,
                    'paid_in_period' => $paidInPeriod,
                    'outstanding_total' => $outstandingTotal,
                    'recovery_rate_percent' => $recoveryRate,
                ],
            ],
        ]);
    }

public function revenue(Request $request): JsonResponse
    {
        $this->authorizeReport($request);

$facility = $this->currentFacility($request);
        [$from, $to] = $this->period($request);

$fromAt = $from . ' 00:00:00';
        $toAt = $to . ' 23:59:59';

$daily = DB::table('payments')
            ->join('invoices', 'payments.invoice_id', '=', 'invoices.id')
            ->where('invoices.facility_id', $facility->id)
            ->whereBetween('payments.paid_at', [$fromAt, $toAt])
            ->groupByRaw("to_char(payments.paid_at, 'YYYY-MM-DD')")
            ->orderByRaw("to_char(payments.paid_at, 'YYYY-MM-DD')")
            ->selectRaw("to_char(payments.paid_at, 'YYYY-MM-DD') as day, sum(payments.amount) as total")
            ->get();

$byMethod = DB::table('payments')
            ->join('invoices', 'payments.invoice_id', '=', 'invoices.id')
            ->where('invoices.facility_id', $facility->id)
            ->whereBetween('payments.paid_at', [$fromAt, $toAt])
            ->groupBy('payments.method')
            ->selectRaw('payments.method as method, sum(payments.amount) as total')
            ->get();

return response()->json([
            'report' => [
                'period' => ['from' => $from, 'to' => $to],
                'paid_total' => (int) $daily->sum('total'),
                'daily' => $daily->map(fn ($row) => [
                    'day' => $row->day,
                    'total' => (int) $row->total,
                ]),
                'by_method' => $byMethod->map(fn ($row) => [
                    'method' => $row->method,
                    'total' => (int) $row->total,
                ]),
            ],
        ]);
    }

public function stock(Request $request): JsonResponse
    {
        $this->authorizeReport($request);

$facility = $this->currentFacility($request);

$lowStock = DB::table('${drugTable} as d')
            ->join('${stockTable} as s', 's.drug_id', '=', 'd.id')
            ->where('s.facility_id', $facility->id)
            ->groupBy('d.id', 'd.${drugNameCol}')
            ->havingRaw('sum(s.${stockQtyCol}) <= ?', [self::LOW_STOCK_THRESHOLD])
            ->selectRaw('d.${drugNameCol} as drug, sum(s.${stockQtyCol}) as total_quantity')
            ->get();

$expiringLots = DB::table('${stockTable} as s')
            ->join('${drugTable} as d', 'd.id', '=', 's.drug_id')
            ->where('s.facility_id', $facility->id)
            ->where('s.${stockQtyCol}', '>', 0)
            ->where('s.${expiryCol}', '<=', now()->addDays(self::EXPIRY_WINDOW_DAYS))
            ->orderBy('s.${expiryCol}')
            ->selectRaw("d.${drugNameCol} as drug, s.${stockQtyCol} as quantity, s.${expiryCol} as expiry_date, extract(day from (s.${expiryCol} - now())) as days_left")
            ->get();

return response()->json([
            'report' => [
                'low_stock_threshold' => self::LOW_STOCK_THRESHOLD,
                'low_stock' => $lowStock->map(fn ($item) => [
                    'drug' => $item->drug,
                    'total_quantity' => (int) $item->total_quantity,
                ]),
                'expiring_window_days' => self::EXPIRY_WINDOW_DAYS,
                'expiring_lots' => $expiringLots->map(fn ($lot) => [
                    'drug' => $lot->drug,
                    'quantity' => (int) $lot->quantity,
                    'expiry_date' => $lot->expiry_date,
                    'days_left' => (int) $lot->days_left,
                ]),
            ],
        ]);
    }

private function period(Request $request): array
    {
        $data = $request->validate([
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date', 'after_or_equal:from'],
        ], [
            'to.after_or_equal' => 'La date de fin doit suivre la date de début.',
        ]);

$from = $data['from'] ?? now()->subDays(29)->toDateString();
        $to = $data['to'] ?? now()->toDateString();

return [$from, $to];
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

private function authorizeReport(Request $request): void
    {
        if (! $request->user()->can('reports.view')) {
            abort(403, 'Vous n\'avez pas accès aux rapports.');
        }
    }
}
`
  );

// --- Routes API consolidées (M00 → M09) ---
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
use App\Http\Controllers\ReportController;
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

Route::middleware('auth:sanctum')->prefix('reports')->group(function () {
    Route::get('/overview', [ReportController::class, 'overview']);
    Route::get('/revenue', [ReportController::class, 'revenue']);
    Route::get('/stock', [ReportController::class, 'stock']);
});
`
  );

ok('Contrôleur de rapports et routes écrits');
}
