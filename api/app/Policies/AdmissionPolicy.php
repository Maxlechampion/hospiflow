<?php

namespace App\Policies;

use App\Models\Admission;
use App\Models\User;

class AdmissionPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->can('admissions.view') || $user->can('admissions.manage');
    }

    public function view(User $user, Admission $admission): bool
    {
        return ($user->can('admissions.view') || $user->can('admissions.manage'))
            && $user->current_facility_id === $admission->facility_id;
    }

    public function create(User $user): bool
    {
        return $user->can('admissions.manage');
    }

    public function update(User $user, Admission $admission): bool
    {
        return $user->can('admissions.manage')
            && $user->current_facility_id === $admission->facility_id;
    }
}
