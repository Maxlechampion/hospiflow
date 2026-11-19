<?php

namespace App\Policies;

use App\Models\Dispensation;
use App\Models\User;

class DispensationPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->can('pharmacy.view');
    }

    public function view(User $user, Dispensation $dispensation): bool
    {
        return $user->can('pharmacy.view')
            && $user->current_facility_id === $dispensation->facility_id;
    }

    public function create(User $user): bool
    {
        return $user->can('pharmacy.dispense');
    }

    public function update(User $user, Dispensation $dispensation): bool
    {
        // Seuls les pharmaciens peuvent modifier (pas les préparateurs)
        return $user->can('pharmacy.catalog.manage')
            && $user->current_facility_id === $dispensation->facility_id;
    }

    public function delete(User $user, Dispensation $dispensation): bool
    {
        return $user->can('pharmacy.catalog.manage')
            && $user->current_facility_id === $dispensation->facility_id;
    }
}
