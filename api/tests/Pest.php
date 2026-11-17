<?php

use App\Models\Facility;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Spatie\Permission\Models\Permission;
use Tests\TestCase;

pest()->extend(TestCase::class)
    ->use(RefreshDatabase::class)
    ->in('Feature');

/*
|--------------------------------------------------------------------------
| Helpers globaux
|--------------------------------------------------------------------------
*/

/**
 * Crée un utilisateur authentifié avec une facility active et les permissions données.
 */
function authUser(array $permissions = [], ?Facility $facility = null): array
{
    $facility = $facility ?? Facility::factory()->create();

    /** @var User $user */
    $user = User::factory()->create([
        'current_facility_id' => $facility->id,
    ]);

    $user->facilities()->syncWithoutDetaching([$facility->id]);

    // Crée les permissions si elles n'existent pas encore
    foreach ($permissions as $perm) {
        Permission::firstOrCreate(['name' => $perm]);
    }

    if (! empty($permissions)) {
        $user->givePermissionTo($permissions);
    }

    return [$user, $facility];
}
