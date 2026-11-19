<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Concerns\ResolvesFacility;
use App\Http\Requests\Appointment\StoreAppointmentRequest;
use App\Models\Appointment;
use App\Models\Facility;
use App\Models\Patient;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

class AppointmentController extends Controller
{
    use ResolvesFacility;

    public function index(Request $request): JsonResponse
    {
        $facility = $this->facility($request);

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
        $facility = $this->facility($request);

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

    public function store(StoreAppointmentRequest $request): JsonResponse
    {
        $facility = $this->facility($request);
        $data = $request->validated();

        $patient = Patient::inFacility($facility)->find($data['patient_id']);

        if (! $patient) {
            abort(422, "Ce patient n'existe pas dans votre établissement.");
        }

        $practitioner = User::find($data['practitioner_id']);

        if (! $practitioner || ! $practitioner->isMemberOf($facility)) {
            abort(422, "Ce praticien n'appartient pas à votre établissement.");
        }

        $start = Carbon::parse($data['scheduled_at']);
        $duration = $data['duration_minutes'] ?? 30;

        if ($this->hasConflict($facility, $practitioner->id, $start, $duration)) {
            abort(422, "Conflit d'agenda : le praticien a déjà un rendez-vous sur ce créneau.");
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
        $facility = $this->facility($request);

        $appointment = Appointment::inFacility($facility)
            ->with(['patient:id,local_code,first_name,last_name', 'practitioner:id,name'])
            ->findOrFail($appointmentId);

        return response()->json([
            'appointment' => $this->payload($appointment),
        ]);
    }

    public function update(Request $request, int $appointmentId): JsonResponse
    {
        $facility = $this->facility($request);
        $appointment = Appointment::inFacility($facility)->findOrFail($appointmentId);
        $this->authorize('update', $appointment);

        $data = $request->validate([
            'status' => ['sometimes', 'string', 'in:'.implode(',', Appointment::STATUSES)],
            'scheduled_at' => ['sometimes', 'date', 'after:now'],
            'duration_minutes' => ['sometimes', 'integer', 'min:5', 'max:480'],
            'reason' => ['sometimes', 'nullable', 'string', 'max:500'],
            'notes' => ['sometimes', 'nullable', 'string'],
        ], [
            'status.in' => 'Statut invalide.',
        ]);

        $nextStart = isset($data['scheduled_at']) ? Carbon::parse($data['scheduled_at']) : $appointment->scheduled_at;
        $nextDuration = $data['duration_minutes'] ?? $appointment->duration_minutes;
        $nextStatus = $data['status'] ?? $appointment->status;

        $scheduleOrStatusChanged = isset($data['scheduled_at'])
            || isset($data['duration_minutes'])
            || (isset($data['status']) && $data['status'] !== $appointment->status);

        if ($scheduleOrStatusChanged && in_array($nextStatus, ['scheduled', 'confirmed'], true)) {
            if ($this->hasConflict($facility, $appointment->practitioner_id, $nextStart, $nextDuration, $appointment->id)) {
                abort(422, "Conflit d'agenda : le praticien a déjà un rendez-vous sur ce créneau.");
            }
        }

        if (isset($data['scheduled_at'])) {
            $appointment->scheduled_at = $nextStart;
        }

        if (isset($data['duration_minutes'])) {
            $appointment->duration_minutes = $nextDuration;
        }

        if (array_key_exists('reason', $data)) {
            $appointment->reason = $data['reason'];
        }

        if (array_key_exists('notes', $data)) {
            $appointment->notes = $data['notes'];
        }

        if (isset($data['status'])) {
            $appointment->status = $nextStatus;
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
