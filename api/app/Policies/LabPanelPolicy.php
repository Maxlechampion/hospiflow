<?php

namespace App\Policies;

use App\Models\LabPanel;
use App\Models\User;

class LabPanelPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->can('lab.view') || $user->can('lab.requests.manage');
    }

    public function view(User $user, LabPanel $panel): bool
    {
        return ($user->can('lab.view') || $user->can('lab.requests.manage'))
            && $user->current_facility_id === $panel->facility_id;
    }

    public function create(User $user): bool
    {
        return $user->can('lab.requests.manage');
    }

    public function update(User $user, LabPanel $panel): bool
    {
        return $user->can('lab.requests.manage')
            && $user->current_facility_id === $panel->facility_id;
    }
}
