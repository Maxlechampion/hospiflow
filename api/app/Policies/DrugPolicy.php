<?php

namespace App\Policies;

use App\Models\Drug;
use App\Models\User;

class DrugPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->can('pharmacy.view');
    }

    public function view(User $user, Drug $drug): bool
    {
        return $user->can('pharmacy.view');
    }

    public function create(User $user): bool
    {
        return $user->can('pharmacy.catalog.manage');
    }

    public function update(User $user, Drug $drug): bool
    {
        return $user->can('pharmacy.catalog.manage');
    }

    public function delete(User $user, Drug $drug): bool
    {
        return $user->can('pharmacy.catalog.manage');
    }
}
