<?php

namespace App\Http\Controllers;

use App\Models\Facility;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class FacilityController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();

        $facilities = $user->can('facilities.manage')
            ? Facility::query()->orderBy('name')->get()
            : $user->facilities()->orderBy('name')->get();

        return response()->json([
            'facilities' => $facilities,
            'current_facility_id' => $user->current_facility_id,
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $this->authorizeManage($request);

        $data = $request->validate([
            'code' => ['required', 'string', 'max:20', 'unique:facilities,code'],
            'name' => ['required', 'string', 'max:255'],
            'city' => ['nullable', 'string', 'max:100'],
            'address' => ['nullable', 'string', 'max:255'],
            'phone' => ['nullable', 'string', 'max:30'],
            'email' => ['nullable', 'email'],
        ], [
            'code.required' => 'Le code établissement est obligatoire.',
            'code.unique' => 'Ce code établissement existe déjà.',
            'name.required' => 'Le nom de l\'établissement est obligatoire.',
        ]);

        $facility = Facility::create($data);
        $request->user()->facilities()->syncWithoutDetaching([$facility->id]);

        return response()->json(['facility' => $facility], 201);
    }

    public function update(Request $request, Facility $facility): JsonResponse
    {
        $this->authorizeManage($request);

        $data = $request->validate([
            'name' => ['sometimes', 'required', 'string', 'max:255'],
            'city' => ['nullable', 'string', 'max:100'],
            'address' => ['nullable', 'string', 'max:255'],
            'phone' => ['nullable', 'string', 'max:30'],
            'email' => ['nullable', 'email'],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        $facility->update($data);

        return response()->json(['facility' => $facility->fresh()]);
    }

    public function switch(Request $request, Facility $facility): JsonResponse
    {
        $user = $request->user();

        if (! $user->isMemberOf($facility)) {
            abort(403, 'Vous n\'êtes pas membre de cet établissement.');
        }

        if (! $facility->is_active) {
            abort(403, 'Cet établissement est désactivé.');
        }

        $user->forceFill(['current_facility_id' => $facility->id])->save();

        return response()->json([
            'message' => 'Établissement actif mis à jour.',
            'current_facility_id' => $facility->id,
        ]);
    }

    public function attachUser(Request $request, Facility $facility): JsonResponse
    {
        $this->authorizeManage($request);

        $data = $request->validate([
            'email' => ['required', 'email'],
        ]);

        // VAGUE1: anti-énumération e-mail
        $target = User::where('email', $data['email'])->first();

        if (! $target) {
            abort(422, 'Impossible de rattacher cet utilisateur. Vérifiez l\'adresse e-mail.');
        }
        $facility->users()->syncWithoutDetaching([$target->id]);

        return response()->json([
            'message' => 'Utilisateur rattaché à l\'établissement.',
            'user_id' => $target->id,
            'facility_id' => $facility->id,
        ]);
    }

    public function users(Request $request, Facility $facility): JsonResponse
    {
        $this->authorizeManage($request);

        $members = $facility->users()
            ->orderBy('name')
            ->get(['users.id', 'users.name', 'users.email', 'users.phone', 'users.is_active', 'users.current_facility_id']);

        return response()->json([
            'facility_id' => $facility->id,
            'users' => $members,
        ]);
    }

    public function detachUser(Request $request, Facility $facility, int $userId): JsonResponse
    {
        $this->authorizeManage($request);

        $isMember = $facility->users()->where('users.id', $userId)->exists();

        if (! $isMember) {
            abort(404, "Cet utilisateur n'est pas rattaché à cet établissement.");
        }

        /** @var User|null $target */
        $target = User::query()->find($userId);

        if (! $target) {
            abort(404, "Cet utilisateur n'est pas rattaché à cet établissement.");
        }

        $facility->users()->detach($target->id);

        if ((int) $target->current_facility_id === (int) $facility->id) {
            $fallbackFacilityId = $target->facilities()
                ->where('facilities.is_active', true)
                ->value('facilities.id');

            $target->forceFill(['current_facility_id' => $fallbackFacilityId])->save();
        }

        return response()->json([
            'message' => "Accès utilisateur retiré de l'établissement.",
            'user_id' => $target->id,
            'facility_id' => $facility->id,
        ]);
    }

    private function authorizeManage(Request $request): void
    {
        if (! $request->user()->can('facilities.manage')) {
            abort(403, 'Action réservée aux administrateurs.');
        }
    }
}
