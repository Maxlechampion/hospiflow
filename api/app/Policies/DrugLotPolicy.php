<?php

namespace App\Policies;

use App\Models\DrugLot;
use App\Models\User;

class DrugLotPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->can('pharmacy.view');
    }

    public function view(User $user, DrugLot $lot): bool
    {
        return $user->can('pharmacy.view')
            && $user->current_facility_id === $lot->facility_id;
    }

    public function create(User $user): bool
    {
        return $user->can('pharmacy.manage');
    }

    public function update(User $user, DrugLot $lot): bool
    {
        return $user->can('pharmacy.manage')
            && $user->current_facility_id === $lot->facility_id;
    }

    public function dispense(User $user, DrugLot $lot): bool
    {
        return $user->can('pharmacy.manage')
            && $user->current_facility_id === $lot->facility_id
            && $lot->quantity > 0;
    }
}
