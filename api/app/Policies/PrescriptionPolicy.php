<?php

namespace App\Policies;

use App\Models\Prescription;
use App\Models\User;

class PrescriptionPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->can('prescriptions.view');
    }

    public function view(User $user, Prescription $prescription): bool
    {
        return $user->can('prescriptions.view')
            && $user->current_facility_id === $prescription->facility_id;
    }

    public function create(User $user): bool
    {
        return $user->can('prescriptions.manage');
    }

    public function update(User $user, Prescription $prescription): bool
    {
        return $user->can('prescriptions.manage')
            && $user->current_facility_id === $prescription->facility_id
            && $prescription->status !== 'cancelled';
    }

    public function delete(User $user, Prescription $prescription): bool
    {
        return $user->can('prescriptions.manage')
            && $user->current_facility_id === $prescription->facility_id
            && $prescription->status === 'draft';
    }
}
