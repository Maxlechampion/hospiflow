<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Concerns\ResolvesFacility;
use App\Http\Requests\LabPanel\StoreLabPanelRequest;
use App\Http\Requests\LabPanel\UpdateLabPanelRequest;
use App\Models\LabPanel;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class LabPanelController extends Controller
{
    use ResolvesFacility;

    public function index(Request $request): JsonResponse
    {
        $this->authorize('viewAny', LabPanel::class);
        $facility = $this->facility($request);

        $query = LabPanel::inFacility($facility)->orderBy('name');

        if ($request->has('active_only')) {
            $query->where('is_active', true);
        }
        if ($category = $request->query('category')) {
            $query->where('category', $category);
        }

        return response()->json([
            'panels' => $query->get()->map(fn (LabPanel $p) => $this->payload($p)),
        ]);
    }

    public function store(StoreLabPanelRequest $request): JsonResponse
    {
        $facility = $this->facility($request);
        $data = $request->validated();
        $data['code'] = strtoupper(trim((string) $data['code']));

        $request->validate([
            'code' => [
                Rule::unique('lab_panels', 'code')->where(fn ($q) => $q->where('facility_id', $facility->id)),
            ],
        ], [
            'code.unique' => "Ce code d'analyse existe déjà dans cet établissement.",
        ]);

        $panel = LabPanel::create([
            'facility_id' => $facility->id,
            'code' => $data['code'],
            'name' => $data['name'],
            'category' => $data['category'] ?? null,
            'price' => (int) ($data['price'] ?? 0),
            'turnaround_hours' => $data['turnaround_hours'] ?? null,
            'is_active' => $data['is_active'] ?? true,
        ]);

        return response()->json(['panel' => $this->payload($panel)], 201);
    }

    public function update(UpdateLabPanelRequest $request, int $labPanelId): JsonResponse
    {
        $facility = $this->facility($request);
        $panel = LabPanel::inFacility($facility)->findOrFail($labPanelId);
        $this->authorize('update', $panel);

        $data = $request->validated();
        if (isset($data['code'])) {
            $data['code'] = strtoupper(trim((string) $data['code']));
            $request->validate([
                'code' => [
                    Rule::unique('lab_panels', 'code')
                        ->where(fn ($q) => $q->where('facility_id', $facility->id))
                        ->ignore($panel->id),
                ],
            ], [
                'code.unique' => "Ce code d'analyse existe déjà dans cet établissement.",
            ]);
        }

        $panel->update($data);

        return response()->json(['panel' => $this->payload($panel->fresh())]);
    }

    private function payload(LabPanel $p): array
    {
        return [
            'id' => $p->id,
            'code' => $p->code,
            'name' => $p->name,
            'category' => $p->category,
            'price' => (int) $p->price,
            'turnaround_hours' => $p->turnaround_hours,
            'is_active' => $p->is_active,
        ];
    }
}
