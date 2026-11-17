<?php

namespace App\Policies;

use App\Models\Patient;
use App\Models\User;

class PatientPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->can('patients.view');
    }

    public function view(User $user, Patient $patient): bool
    {
        return $user->can('patients.view')
            && $this->isSameFacility($user, $patient->facility_id);
    }

    public function create(User $user): bool
    {
        return $user->can('patients.manage');
    }

    public function update(User $user, Patient $patient): bool
    {
        return $user->can('patients.manage')
            && $this->isSameFacility($user, $patient->facility_id);
    }

    public function delete(User $user, Patient $patient): bool
    {
        return $user->can('patients.manage')
            && $this->isSameFacility($user, $patient->facility_id);
    }

    private function isSameFacility(User $user, ?int $facilityId): bool
    {
        return $facilityId !== null
            && $user->current_facility_id === $facilityId;
    }
}
