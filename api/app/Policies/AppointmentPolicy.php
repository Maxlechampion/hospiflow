<?php

namespace App\Policies;

use App\Models\Appointment;
use App\Models\User;

class AppointmentPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->can('patients.view');
    }

    public function view(User $user, Appointment $appointment): bool
    {
        return $user->can('patients.view')
            && $user->current_facility_id === $appointment->facility_id;
    }

    public function create(User $user): bool
    {
        return $user->can('appointments.manage');
    }

    public function update(User $user, Appointment $appointment): bool
    {
        return $user->can('appointments.manage')
            && $user->current_facility_id === $appointment->facility_id;
    }

    public function delete(User $user, Appointment $appointment): bool
    {
        return $user->can('appointments.manage')
            && $user->current_facility_id === $appointment->facility_id;
    }
}
