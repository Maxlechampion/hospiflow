<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Concerns\ResolvesFacility;
use App\Http\Requests\Consultation\StoreConsultationRequest;
use App\Http\Requests\Consultation\UpdateConsultationRequest;
use App\Models\Appointment;
use App\Models\Consultation;
use App\Models\Patient;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ConsultationController extends Controller
{
    use ResolvesFacility;

    public function index(Request $request): JsonResponse
    {
        $facility = $this->facility($request);

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

    public function store(StoreConsultationRequest $request): JsonResponse
    {
        $facility = $this->facility($request);
        $data = $request->validated();

        $patient = Patient::inFacility($facility)->find($data['patient_id']);

        if (! $patient) {
            abort(422, "Ce patient n'existe pas dans votre établissement.");
        }

        $appointment = null;

        if (! empty($data['appointment_id'])) {
            $appointment = Appointment::inFacility($facility)->find($data['appointment_id']);

            if (! $appointment) {
                abort(422, "Ce rendez-vous n'existe pas dans votre établissement.");
            }

            if ((int) $appointment->patient_id !== (int) $patient->id) {
                abort(422, 'Ce rendez-vous ne correspond pas au patient sélectionné.');
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
        $facility = $this->facility($request);

        $consultation = Consultation::inFacility($facility)
            ->with(['patient:id,local_code,first_name,last_name', 'practitioner:id,name'])
            ->findOrFail($consultationId);

        return response()->json([
            'consultation' => $this->payload($consultation),
        ]);
    }

    public function update(UpdateConsultationRequest $request, int $consultationId): JsonResponse
    {
        $facility = $this->facility($request);
        $consultation = Consultation::inFacility($facility)->findOrFail($consultationId);
        $data = $request->validated();

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
