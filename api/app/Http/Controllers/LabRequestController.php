<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Concerns\ResolvesFacility;
use App\Models\Consultation;
use App\Models\LabRequest;
use App\Models\Patient;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

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
        $facility = $this->facility($request);

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
        $facility = $this->facility($request);

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
        $facility = $this->facility($request);
        $labRequest = LabRequest::inFacility($facility)->findOrFail($labRequestId);

        if ($labRequest->status === 'completed') {
            abort(422, 'Cette demande est complétée et ne peut plus être modifiée.');
        }

        $data = $request->validate([
            'status' => ['required', 'string', 'in:'.implode(',', ['pending', 'in_progress', 'cancelled'])],
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
        $facility = $this->facility($request);
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
