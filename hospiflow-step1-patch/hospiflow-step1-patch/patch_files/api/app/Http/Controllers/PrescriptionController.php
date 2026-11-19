<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Concerns\ResolvesFacility;
use App\Http\Requests\Prescription\AddPrescriptionItemRequest;
use App\Http\Requests\Prescription\StorePrescriptionRequest;
use App\Http\Requests\Prescription\UpdatePrescriptionRequest;
use App\Models\Consultation;
use App\Models\Patient;
use App\Models\Prescription;
use App\Models\PrescriptionItem;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class PrescriptionController extends Controller
{
    use ResolvesFacility;

    public function index(Request $request): JsonResponse
    {
        $facility = $this->facility($request);

        $query = Prescription::inFacility($facility)
            ->with([
                'patient:id,local_code,first_name,last_name',
                'practitioner:id,name',
                'consultation:id',
                'items.drug:id,name,form,dosage,unit',
            ])
            ->orderByDesc('created_at');

        if ($patientId = $request->query('patient_id')) {
            $query->where('patient_id', (int) $patientId);
        }
        if ($consultationId = $request->query('consultation_id')) {
            $query->where('consultation_id', (int) $consultationId);
        }
        if ($status = $request->query('status')) {
            $query->where('status', $status);
        }

        return response()->json([
            'prescriptions' => $query->get()->map(fn ($p) => $this->payload($p)),
        ]);
    }

    public function store(StorePrescriptionRequest $request): JsonResponse
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
                abort(422, 'La consultation ne correspond pas au patient.');
            }
        }

        $prescription = DB::transaction(function () use ($facility, $patient, $consultation, $data, $request) {
            $record = Prescription::create([
                'facility_id' => $facility->id,
                'patient_id' => $patient->id,
                'consultation_id' => $consultation?->id,
                'practitioner_id' => $request->user()->id,
                'created_by' => $request->user()->id,
                'status' => $data['status'] ?? 'active',
                'notes' => $data['notes'] ?? null,
                'prescribed_at' => $data['prescribed_at'] ?? now()->toDateString(),
            ]);

            foreach ($data['items'] as $item) {
                $record->items()->create([
                    'drug_id' => $item['drug_id'],
                    'dosage' => $item['dosage'] ?? null,
                    'frequency' => $item['frequency'] ?? null,
                    'duration' => $item['duration'] ?? null,
                    'quantity' => $item['quantity'] ?? 1,
                    'instructions' => $item['instructions'] ?? null,
                    'notes' => $item['notes'] ?? null,
                ]);
            }

            return $record;
        });

        return response()->json(
            ['prescription' => $this->payload($prescription->load(
                'patient:id,local_code,first_name,last_name',
                'practitioner:id,name',
                'consultation:id',
                'items.drug:id,name,form,dosage,unit'
            ))],
            201
        );
    }

    public function show(Request $request, int $prescriptionId): JsonResponse
    {
        $facility = $this->facility($request);
        $prescription = Prescription::inFacility($facility)
            ->with([
                'patient:id,local_code,first_name,last_name',
                'practitioner:id,name',
                'consultation:id',
                'items.drug:id,name,form,dosage,unit',
            ])
            ->findOrFail($prescriptionId);

        return response()->json([
            'prescription' => $this->payload($prescription),
        ]);
    }

    public function update(UpdatePrescriptionRequest $request, int $prescriptionId): JsonResponse
    {
        $facility = $this->facility($request);
        $prescription = Prescription::inFacility($facility)->findOrFail($prescriptionId);
        $data = $request->validated();

        foreach (['status', 'notes', 'prescribed_at'] as $field) {
            if (array_key_exists($field, $data)) {
                $prescription->{$field} = $data[$field];
            }
        }
        $prescription->save();

        return response()->json([
            'prescription' => $this->payload($prescription->fresh()->load(
                'patient:id,local_code,first_name,last_name',
                'practitioner:id,name',
                'consultation:id',
                'items.drug:id,name,form,dosage,unit'
            )),
        ]);
    }

    public function destroy(Request $request, int $prescriptionId): JsonResponse
    {
        $facility = $this->facility($request);
        $prescription = Prescription::inFacility($facility)->findOrFail($prescriptionId);
        $this->authorize('delete', $prescription);

        if ($prescription->status !== 'draft') {
            abort(422, 'Seule une prescription en brouillon peut être supprimée.');
        }

        $prescription->items()->delete();
        $prescription->delete();

        return response()->json(['message' => 'Prescription supprimée.']);
    }

    public function addItem(AddPrescriptionItemRequest $request, int $prescriptionId): JsonResponse
    {
        $facility = $this->facility($request);
        $prescription = Prescription::inFacility($facility)->findOrFail($prescriptionId);

        if (in_array($prescription->status, ['cancelled', 'completed'], true)) {
            abort(422, 'Impossible de modifier une prescription terminée ou annulée.');
        }

        $data = $request->validated();

        $item = $prescription->items()->create([
            'drug_id' => $data['drug_id'],
            'dosage' => $data['dosage'] ?? null,
            'frequency' => $data['frequency'] ?? null,
            'duration' => $data['duration'] ?? null,
            'quantity' => $data['quantity'] ?? 1,
            'instructions' => $data['instructions'] ?? null,
            'notes' => $data['notes'] ?? null,
        ]);

        return response()->json([
            'item' => $this->itemPayload($item->load('drug:id,name,form,dosage,unit')),
        ], 201);
    }

    public function removeItem(Request $request, int $prescriptionId, int $itemId): JsonResponse
    {
        $facility = $this->facility($request);
        $prescription = Prescription::inFacility($facility)->findOrFail($prescriptionId);
        $this->authorize('update', $prescription);

        if (in_array($prescription->status, ['cancelled', 'completed'], true)) {
            abort(422, 'Impossible de modifier une prescription terminée ou annulée.');
        }

        $item = $prescription->items()->findOrFail($itemId);
        $item->delete();

        return response()->json(['message' => 'Ligne supprimée.']);
    }

    private function payload(Prescription $p): array
    {
        return [
            'id' => $p->id,
            'patient' => [
                'id' => $p->patient->id,
                'local_code' => $p->patient->local_code,
                'first_name' => $p->patient->first_name,
                'last_name' => $p->patient->last_name,
            ],
            'practitioner' => [
                'id' => $p->practitioner->id,
                'name' => $p->practitioner->name,
            ],
            'consultation_id' => $p->consultation_id,
            'status' => $p->status,
            'notes' => $p->notes,
            'prescribed_at' => $p->prescribed_at?->format('Y-m-d'),
            'items' => $p->items->map(fn (PrescriptionItem $i) => $this->itemPayload($i))->values(),
            'created_at' => $p->created_at->format('Y-m-d H:i'),
        ];
    }

    private function itemPayload(PrescriptionItem $i): array
    {
        return [
            'id' => $i->id,
            'drug' => $i->drug ? [
                'id' => $i->drug->id,
                'name' => $i->drug->name,
                'form' => $i->drug->form,
                'dosage' => $i->drug->dosage,
                'unit' => $i->drug->unit,
            ] : null,
            'dosage' => $i->dosage,
            'frequency' => $i->frequency,
            'duration' => $i->duration,
            'quantity' => $i->quantity,
            'instructions' => $i->instructions,
            'notes' => $i->notes,
        ];
    }
}
