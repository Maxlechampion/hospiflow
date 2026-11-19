<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Concerns\ResolvesFacility;
use App\Http\Requests\Pharmacy\DispenseRequest;
use App\Models\Consultation;
use App\Models\Dispensation;
use App\Models\Drug;
use App\Models\DrugLot;
use App\Models\Invoice;
use App\Models\InvoiceItem;
use App\Models\Patient;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class PharmacyController extends Controller
{
    use ResolvesFacility;

    public function drugs(Request $request): JsonResponse
    {
        $this->facility($request);
        $drugs = Drug::orderBy('name')->get();

        return response()->json([
            'drugs' => $drugs->map(fn ($d) => [
                'id' => $d->id,
                'name' => $d->name,
                'form' => $d->form,
                'dosage' => $d->dosage,
                'unit' => $d->unit,
                'unit_price' => (int) $d->unit_price,
                'is_active' => $d->is_active,
            ]),
        ]);
    }

    public function storeDrug(Request $request): JsonResponse
    {
        $this->authorize('create', Drug::class);
        $this->facility($request);
        $data = $request->validate([
            'name' => ['required', 'string', 'max:200', 'unique:drugs,name'],
            'form' => ['required', 'string', 'max:100'],
            'dosage' => ['nullable', 'string', 'max:100'],
            'unit' => ['required', 'string', 'max:50'],
            'unit_price' => ['nullable', 'integer', 'min:0', 'max:100000000'],
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
            'unit_price' => $data['unit_price'] ?? 0,
            'is_active' => true,
        ]);

        return response()->json(['drug' => [
            'id' => $drug->id,
            'name' => $drug->name,
            'form' => $drug->form,
            'dosage' => $drug->dosage,
            'unit' => $drug->unit,
            'unit_price' => (int) $drug->unit_price,
            'is_active' => $drug->is_active,
        ]], 201);
    }

    public function stock(Request $request): JsonResponse
    {
        $facility = $this->facility($request);
        $expiringDays = $request->query('expiring_days');
        $query = DrugLot::inFacility($facility)
            ->with('drug:id,name,form,dosage,unit,unit_price')
            ->orderBy('expires_at');

        if ($expiringDays !== null) {
            $limit = now()->addDays((int) $expiringDays)->endOfDay();
            $query->whereNotNull('expires_at')
                ->where('expires_at', '<=', $limit)
                ->where('expires_at', '>', now())
                ->where('quantity', '>', 0);
        }

        return response()->json([
            'lots' => $query->get()->map(fn ($lot) => $this->lotPayload($lot)),
        ]);
    }

    public function storeStock(Request $request): JsonResponse
    {
        $facility = $this->facility($request);
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
            ['lot' => $this->lotPayload($lot->load('drug:id,name,form,dosage,unit,unit_price'))],
            201
        );
    }

    public function dispensations(Request $request): JsonResponse
    {
        $facility = $this->facility($request);
        $query = Dispensation::inFacility($facility)
            ->with([
                'patient:id,local_code,first_name,last_name',
                'drug:id,name,unit,unit_price',
                'dispenser:id,name',
            ])
            ->orderByDesc('created_at');

        $patientId = $request->query('patient_id');
        if ($patientId !== null) {
            $query->where('patient_id', (int) $patientId);
        }

        return response()->json([
            'dispensations' => $query->get()->map(fn ($d) => $this->dispensationPayload($d)),
        ]);
    }

    public function dispense(DispenseRequest $request): JsonResponse
    {
        $this->authorize('create', Dispensation::class);
        $facility = $this->facility($request);
        $data = $request->validated();

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
        $notes = $data['notes'] ?? null;
        $createInvoice = ! empty($data['create_invoice']);
        $invoiceDueDate = $data['invoice_due_date'] ?? null;

        [$dispensation, $remaining, $invoice] = DB::transaction(function () use (
            $facility, $patient, $consultation, $drug, $quantity, $notes,
            $createInvoice, $invoiceDueDate, $request
        ) {
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
                abort(422, 'Stock insuffisant : '.$available.' '.$drug->unit.'(s) disponible(s).');
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
                'notes' => $notes,
            ]);

            $createdInvoice = null;
            if ($createInvoice) {
                $unitPrice = (int) $drug->unit_price;
                $totalAmount = $unitPrice * $quantity;

                $inv = Invoice::create([
                    'facility_id' => $facility->id,
                    'patient_id' => $patient->id,
                    'consultation_id' => $consultation?->id,
                    'created_by' => $request->user()->id,
                    'number' => 'TMP-'.uniqid(),
                    'status' => 'draft',
                    'total_amount' => $totalAmount,
                    'due_date' => $invoiceDueDate,
                ]);
                $inv->number = 'FAC-'.str_pad((string) $inv->id, 5, '0', STR_PAD_LEFT);
                $inv->save();

                InvoiceItem::create([
                    'invoice_id' => $inv->id,
                    'dispensation_id' => $record->id,
                    'label' => $drug->name.($drug->dosage ? ' '.$drug->dosage : ''),
                    'quantity' => $quantity,
                    'unit_price' => $unitPrice,
                    'amount' => $totalAmount,
                ]);

                $createdInvoice = $inv;
            }

            return [$record, $available - $quantity, $createdInvoice];
        });

        $response = [
            'dispensation' => $this->dispensationPayload($dispensation->load(
                'patient:id,local_code,first_name,last_name',
                'drug:id,name,unit,unit_price',
                'dispenser:id,name'
            )),
            'remaining_stock' => $remaining,
        ];

        if ($invoice) {
            $response['invoice'] = [
                'id' => $invoice->id,
                'number' => $invoice->number,
                'total_amount' => (int) $invoice->total_amount,
                'status' => $invoice->status,
            ];
        }

        return response()->json($response, 201);
    }

    public function showDispensation(Request $request, int $dispensationId): JsonResponse
    {
        $facility = $this->facility($request);
        $dispensation = Dispensation::inFacility($facility)
            ->with([
                'patient:id,local_code,first_name,last_name',
                'drug:id,name,unit,unit_price',
                'dispenser:id,name',
                'invoiceItems.invoice:id,number,status',
            ])
            ->findOrFail($dispensationId);

        return response()->json([
            'dispensation' => $this->dispensationPayload($dispensation),
        ]);
    }

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
                'unit_price' => (int) $lot->drug->unit_price,
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
                'unit_price' => (int) $d->drug->unit_price,
            ],
            'quantity' => $d->quantity,
            'total_price' => (int) $d->drug->unit_price * $d->quantity,
            'dispensed_by' => $d->dispenser?->name,
            'consultation_id' => $d->consultation_id,
            'notes' => $d->notes,
            'invoices' => $d->invoiceItems
                ->filter(fn ($ii) => $ii->invoice !== null)
                ->map(fn ($ii) => [
                    'id' => $ii->invoice->id,
                    'number' => $ii->invoice->number,
                    'status' => $ii->invoice->status,
                ])
                ->values(),
            'created_at' => $d->created_at->format('Y-m-d H:i'),
        ];
    }
}
