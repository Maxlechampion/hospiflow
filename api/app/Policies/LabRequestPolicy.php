<?php

namespace App\Policies;

use App\Models\LabRequest;
use App\Models\User;

class LabRequestPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->can('lab.view');
    }

    public function view(User $user, LabRequest $labRequest): bool
    {
        return $user->can('lab.view')
            && $user->current_facility_id === $labRequest->facility_id;
    }

    public function create(User $user): bool
    {
        return $user->can('lab.requests.manage');
    }

    public function update(User $user, LabRequest $labRequest): bool
    {
        return $user->can('lab.requests.manage')
            && $user->current_facility_id === $labRequest->facility_id
            && $labRequest->status !== 'completed';
    }

    public function storeResult(User $user, LabRequest $labRequest): bool
    {
        return $user->can('lab.results.manage')
            && $user->current_facility_id === $labRequest->facility_id
            && ! in_array($labRequest->status, ['completed', 'cancelled'], true);
    }
}
