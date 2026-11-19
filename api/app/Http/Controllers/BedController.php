<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Concerns\ResolvesFacility;
use App\Http\Requests\Admission\StoreBedRequest;
use App\Http\Requests\Admission\UpdateBedRequest;
use App\Models\Admission;
use App\Models\Bed;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class BedController extends Controller
{
    use ResolvesFacility;

    public function index(Request $request): JsonResponse
    {
        $this->authorize('viewAny', Bed::class);
        $facility = $this->facility($request);

        $query = Bed::inFacility($facility)->orderBy('ward')->orderBy('code');

        if ($ward = $request->query('ward')) {
            $query->where('ward', $ward);
        }
        if ($status = $request->query('status')) {
            $query->where('status', $status);
        }
        if ($request->has('available_only')) {
            $query->where('status', 'available')->where('is_active', true);
        }

        return response()->json([
            'beds' => $query->get()->map(fn (Bed $b) => $this->payload($b)),
        ]);
    }

    public function store(StoreBedRequest $request): JsonResponse
    {
        $facility = $this->facility($request);
        $data = $request->validated();
        $data['code'] = trim((string) $data['code']);

        $request->validate([
            'code' => [
                Rule::unique('beds', 'code')->where(fn ($q) => $q->where('facility_id', $facility->id)),
            ],
        ], [
            'code.unique' => 'Ce code de lit existe déjà dans cet établissement.',
        ]);

        $bed = Bed::create([
            'facility_id' => $facility->id,
            'ward' => $data['ward'],
            'room_number' => $data['room_number'] ?? null,
            'code' => $data['code'],
            'status' => $data['status'] ?? 'available',
            'is_active' => $data['is_active'] ?? true,
        ]);

        return response()->json(['bed' => $this->payload($bed)], 201);
    }

    public function update(UpdateBedRequest $request, int $bedId): JsonResponse
    {
        $facility = $this->facility($request);
        $bed = Bed::inFacility($facility)->findOrFail($bedId);
        $this->authorize('update', $bed);

        $data = $request->validated();
        if (isset($data['code'])) {
            $data['code'] = trim((string) $data['code']);
            $request->validate([
                'code' => [
                    Rule::unique('beds', 'code')
                        ->where(fn ($q) => $q->where('facility_id', $facility->id))
                        ->ignore($bed->id),
                ],
            ], [
                'code.unique' => 'Ce code de lit existe déjà dans cet établissement.',
            ]);
        }

        if (isset($data['status']) && $data['status'] === 'available') {
            $hasActiveAdmission = Admission::query()
                ->where('bed_id', $bed->id)
                ->where('status', 'admitted')
                ->exists();
            if ($hasActiveAdmission) {
                abort(422, 'Impossible de marquer ce lit disponible tant qu\'une admission active y est rattachée.');
            }
        }

        $bed->update($data);

        return response()->json(['bed' => $this->payload($bed->fresh())]);
    }

    private function payload(Bed $b): array
    {
        return [
            'id' => $b->id,
            'ward' => $b->ward,
            'room_number' => $b->room_number,
            'code' => $b->code,
            'status' => $b->status,
            'is_active' => $b->is_active,
        ];
    }
}
