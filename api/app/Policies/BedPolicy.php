<?php

namespace App\Policies;

use App\Models\Bed;
use App\Models\User;

class BedPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->can('admissions.view') || $user->can('admissions.manage');
    }

    public function view(User $user, Bed $bed): bool
    {
        return ($user->can('admissions.view') || $user->can('admissions.manage'))
            && $user->current_facility_id === $bed->facility_id;
    }

    public function create(User $user): bool
    {
        return $user->can('admissions.manage');
    }

    public function update(User $user, Bed $bed): bool
    {
        return $user->can('admissions.manage')
            && $user->current_facility_id === $bed->facility_id;
    }
}
