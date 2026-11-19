<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Concerns\ResolvesFacility;
use App\Http\Requests\LabRequest\StoreLabRequestRequest;
use App\Http\Requests\LabRequest\StoreLabResultRequest;
use App\Http\Requests\LabRequest\UpdateLabRequestRequest;
use App\Models\Consultation;
use App\Models\Invoice;
use App\Models\InvoiceItem;
use App\Models\LabPanel;
use App\Models\LabRequest;
use App\Models\Patient;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class LabRequestController extends Controller
{
    use ResolvesFacility;

    public function index(Request $request): JsonResponse
    {
        $facility = $this->facility($request);

        $query = LabRequest::inFacility($facility)
            ->with([
                'patient:id,local_code,first_name,last_name',
                'requester:id,name',
                'panelCatalog:id,code,name,category,price,turnaround_hours',
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

    public function store(StoreLabRequestRequest $request): JsonResponse
    {
        $facility = $this->facility($request);
        $data = $request->validated();

        $patient = Patient::inFacility($facility)->find($data['patient_id']);

        if (! $patient) {
            abort(422, "Ce patient n'existe pas dans votre établissement.");
        }

        $consultation = null;

        if (! empty($data['consultation_id'])) {
            $consultation = Consultation::inFacility($facility)->find($data['consultation_id']);

            if (! $consultation) {
                abort(422, "Cette consultation n'existe pas dans votre établissement.");
            }

            if ((int) $consultation->patient_id !== (int) $patient->id) {
                abort(422, 'Cette consultation ne correspond pas au patient sélectionné.');
            }
        }

        $labPanel = null;

        if (! empty($data['lab_panel_id'])) {
            $labPanel = LabPanel::inFacility($facility)->find($data['lab_panel_id']);

            if (! $labPanel) {
                abort(422, "Ce panel d'analyse n'existe pas dans votre établissement.");
            }

            if (! $labPanel->is_active) {
                abort(422, "Ce panel d'analyse est inactif.");
            }
        }

        $createInvoice = ! empty($data['create_invoice']);
        $panelPrice = $labPanel ? (int) $labPanel->price : 0;

        if ($createInvoice && (! $labPanel || $panelPrice <= 0)) {
            abort(422, 'La facturation automatique requiert un panel d\'analyse actif avec un tarif supérieur à 0 XOF.');
        }

        $panelLabel = $data['panel'] ?? ($labPanel ? $labPanel->name : '');

        [$labRequest, $invoice] = DB::transaction(function () use ($facility, $patient, $consultation, $labPanel, $panelLabel, $createInvoice, $panelPrice, $data, $request) {
            $reqRecord = LabRequest::create([
                'facility_id' => $facility->id,
                'patient_id' => $patient->id,
                'consultation_id' => $consultation?->id,
                'lab_panel_id' => $labPanel?->id,
                'requested_by' => $request->user()->id,
                'panel' => $panelLabel,
                'priority' => $data['priority'] ?? 'routine',
                'status' => 'pending',
                'notes' => $data['notes'] ?? null,
            ]);

            $createdInvoice = null;

            if ($createInvoice && $labPanel) {
                $createdInvoice = Invoice::create([
                    'facility_id' => $facility->id,
                    'patient_id' => $patient->id,
                    'consultation_id' => $consultation?->id,
                    'created_by' => $request->user()->id,
                    'number' => 'TMP-'.uniqid(),
                    'status' => 'draft',
                    'total_amount' => $panelPrice,
                    'due_date' => $data['invoice_due_date'] ?? null,
                ]);

                $createdInvoice->number = 'FAC-'.str_pad((string) $createdInvoice->id, 5, '0', STR_PAD_LEFT);
                $createdInvoice->save();

                InvoiceItem::create([
                    'invoice_id' => $createdInvoice->id,
                    'lab_request_id' => $reqRecord->id,
                    'label' => 'Analyse labo : '.$labPanel->name,
                    'quantity' => 1,
                    'unit_price' => $panelPrice,
                    'amount' => $panelPrice,
                ]);
            }

            return [$reqRecord, $createdInvoice];
        });

        $response = [
            'lab_request' => $this->payload($labRequest->load(
                'patient:id,local_code,first_name,last_name',
                'requester:id,name',
                'panelCatalog:id,code,name,category,price,turnaround_hours'
            )),
        ];

        if ($invoice) {
            $response['invoice'] = [
                'id' => $invoice->id,
                'number' => $invoice->number,
                'status' => $invoice->status,
                'total_amount' => (int) $invoice->total_amount,
            ];
        }

        return response()->json($response, 201);
    }

    public function show(Request $request, int $labRequestId): JsonResponse
    {
        $facility = $this->facility($request);

        $labRequest = LabRequest::inFacility($facility)
            ->with([
                'patient:id,local_code,first_name,last_name',
                'requester:id,name',
                'panelCatalog:id,code,name,category,price,turnaround_hours',
                'result.resultedBy:id,name',
            ])
            ->findOrFail($labRequestId);

        return response()->json([
            'lab_request' => $this->payload($labRequest),
        ]);
    }

    public function update(UpdateLabRequestRequest $request, int $labRequestId): JsonResponse
    {
        $facility = $this->facility($request);
        $labRequest = LabRequest::inFacility($facility)->findOrFail($labRequestId);

        if ($labRequest->status === 'completed') {
            abort(422, 'Cette demande est complétée et ne peut plus être modifiée.');
        }

        $data = $request->validated();

        $labRequest->status = $data['status'];
        $labRequest->save();

        return response()->json([
            'lab_request' => $this->payload($labRequest->fresh()->load(
                'patient:id,local_code,first_name,last_name',
                'requester:id,name',
                'panelCatalog:id,code,name,category,price,turnaround_hours',
                'result.resultedBy:id,name'
            )),
        ]);
    }

    public function storeResult(StoreLabResultRequest $request, int $labRequestId): JsonResponse
    {
        $facility = $this->facility($request);
        $labRequest = LabRequest::inFacility($facility)->findOrFail($labRequestId);

        if ($labRequest->status === 'cancelled') {
            abort(422, "Cette demande d'analyse a été annulée.");
        }

        if ($labRequest->status === 'completed') {
            abort(422, 'Cette demande a déjà un résultat enregistré.');
        }

        $data = $request->validated();

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
                'panelCatalog:id,code,name,category,price,turnaround_hours',
                'result.resultedBy:id,name'
            )),
        ]);
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
            'lab_panel_id' => $r->lab_panel_id,
            'panel_catalog' => $r->panelCatalog ? [
                'id' => $r->panelCatalog->id,
                'code' => $r->panelCatalog->code,
                'name' => $r->panelCatalog->name,
                'category' => $r->panelCatalog->category,
                'price' => (int) $r->panelCatalog->price,
                'turnaround_hours' => $r->panelCatalog->turnaround_hours,
            ] : null,
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
