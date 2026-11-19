<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Concerns\ResolvesFacility;
use App\Http\Requests\Patient\StorePatientRequest;
use App\Http\Requests\Patient\UpdatePatientRequest;
use App\Models\Facility;
use App\Models\MasterPatientIndex;
use App\Models\Patient;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class PatientController extends Controller
{
    use ResolvesFacility;

    public function index(Request $request): JsonResponse
    {
        $facility = $this->facility($request);

        $patients = $facility->patients()
            ->with('mpi:id,hospiflow_code')
            ->orderBy('last_name')
            ->orderBy('first_name')
            ->get();

        return response()->json([
            'facility' => ['id' => $facility->id, 'code' => $facility->code],
            'patients' => $patients->map(fn (Patient $p) => $this->payload($p)),
        ]);
    }

    public function search(Request $request): JsonResponse
    {
        $facility = $this->facility($request);
        $q = trim((string) $request->query('q', ''));

        if ($q === '') {
            return response()->json(['results' => []]);
        }

        $patients = $facility->patients()
            ->with('mpi:id,hospiflow_code')
            ->where(function ($w) use ($q) {
                $w->whereRaw($this->portableLike('first_name'), [$this->likePattern($q)])
                    ->orWhereRaw($this->portableLike('last_name'), [$this->likePattern($q)])
                    ->orWhereRaw($this->portableLike('local_code'), [$this->likePattern($q)])
                    ->orWhereRaw($this->portableLike('phone'), [$this->likePattern($q)])
                    ->orWhereHas('mpi', function ($m) use ($q) {
                        $m->whereRaw('LOWER(hospiflow_code) LIKE LOWER(?)', [$this->likePattern($q)]);
                    });
            })
            ->limit(50)
            ->get();

        return response()->json([
            'results' => $patients->map(fn (Patient $p) => $this->payload($p)),
        ]);
    }

    public function store(StorePatientRequest $request): JsonResponse
    {
        $facility = $this->facility($request);
        $data = $request->validated();

        [$patient, $created] = DB::transaction(function () use ($facility, $data) {
            $mpi = null;

            if (! empty($data['mpi_code'])) {
                $mpi = MasterPatientIndex::where('hospiflow_code', $data['mpi_code'])
                    ->lockForUpdate()
                    ->first();

                if (! $mpi) {
                    abort(422, 'Identifiant réseau HOSPIFLOW inconnu.');
                }
            }

            if (! $mpi) {
                $mpi = MasterPatientIndex::create([
                    'first_name' => $data['first_name'],
                    'last_name' => $data['last_name'],
                    'date_of_birth' => $data['date_of_birth'] ?? null,
                    'gender' => $data['gender'] ?? null,
                    'phone' => $data['phone'] ?? null,
                ]);
            }

            $existing = $facility->patients()->where('mpi_id', $mpi->id)->first();

            if ($existing) {
                return [$existing, false];
            }

            $patient = $facility->patients()->create([
                'mpi_id' => $mpi->id,
                'local_code' => $this->nextLocalCode($facility),
                'first_name' => $data['first_name'],
                'last_name' => $data['last_name'],
                'date_of_birth' => $data['date_of_birth'] ?? null,
                'gender' => $data['gender'] ?? null,
                'phone' => $data['phone'] ?? null,
                'address' => $data['address'] ?? null,
                'blood_group' => $data['blood_group'] ?? null,
                'allergies' => $data['allergies'] ?? null,
            ]);

            return [$patient, true];
        });

        $payload = $this->payload($patient->load('mpi:id,hospiflow_code'));

        if (! $created) {
            return response()->json([
                'patient' => $payload,
                'message' => 'Ce patient réseau existe déjà dans cet établissement.',
            ], 200);
        }

        return response()->json(['patient' => $payload], 201);
    }

    public function show(Request $request, int $patientId): JsonResponse
    {
        $facility = $this->facility($request);

        $patient = Patient::inFacility($facility)
            ->with('mpi:id,hospiflow_code')
            ->findOrFail($patientId);

        return response()->json(['patient' => $this->payload($patient)]);
    }

    public function update(UpdatePatientRequest $request, int $patientId): JsonResponse
    {
        $facility = $this->facility($request);
        $patient = Patient::inFacility($facility)->findOrFail($patientId);
        $data = $request->validated();

        $updatable = ['first_name', 'last_name', 'date_of_birth', 'gender', 'phone', 'address', 'blood_group', 'allergies'];
        $payload = [];
        foreach ($updatable as $field) {
            if (array_key_exists($field, $data)) {
                $payload[$field] = $data[$field];
            }
        }
        $patient->update($payload);

        return response()->json([
            'patient' => $this->payload($patient->fresh()->load('mpi:id,hospiflow_code')),
        ]);
    }

    private function portableLike(string $column): string
    {
        return "LOWER({$column}) LIKE LOWER(?)";    // ✅ CORRECT
    }

    private function likePattern(string $needle): string
    {
        return '%'.str_replace(['%', '_'], ['\\%', '\\_'], $needle).'%';
    }

    private function nextLocalCode(Facility $facility): string
    {
        $count = Patient::withTrashed()->where('facility_id', $facility->id)->count() + 1;

        return 'P-'.strtoupper($facility->code).'-'
            .str_pad((string) $count, 4, '0', STR_PAD_LEFT);
    }

    private function payload(Patient $patient): array
    {
        return [
            'id' => $patient->id,
            'local_code' => $patient->local_code,
            'hospiflow_code' => $patient->mpi->hospiflow_code ?? null,
            'first_name' => $patient->first_name,
            'last_name' => $patient->last_name,
            'date_of_birth' => $patient->date_of_birth?->format('Y-m-d'),
            'gender' => $patient->gender,
            'phone' => $patient->phone,
            'address' => $patient->address,
            'blood_group' => $patient->blood_group,
            'allergies' => $patient->allergies,
            'facility_id' => $patient->facility_id,
        ];
    }
}
