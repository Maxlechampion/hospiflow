<?php

use App\Models\Facility;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\PermissionRegistrar;
use Tests\TestCase;

pest()->extend(TestCase::class);

uses(RefreshDatabase::class)->in('Feature');

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
    app(PermissionRegistrar::class)->forgetCachedPermissions();

    $facility = $facility ?? Facility::factory()->create();

    /** @var User $user */
    $user = User::factory()->create([
        'current_facility_id' => $facility->id,
    ]);

    $user->facilities()->syncWithoutDetaching([$facility->id]);

    foreach ($permissions as $perm) {
        Permission::firstOrCreate(['name' => $perm, 'guard_name' => 'web']);
    }

    if (! empty($permissions)) {
        $user->givePermissionTo($permissions);
    }

    return [$user, $facility];
}
