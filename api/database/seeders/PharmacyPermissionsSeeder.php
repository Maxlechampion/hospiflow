<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;

class PharmacyPermissionsSeeder extends Seeder
{
    public function run(): void
    {
        $view = Permission::findOrCreate('pharmacy.view');
        $manage = Permission::findOrCreate('pharmacy.manage');

        $map = [
            'admin' => [$view, $manage],
            'medecin' => [$view],
            'infirmier' => [$view],
            'pharmacien' => [$view, $manage],
        ];

        foreach ($map as $roleName => $permissions) {
            $role = Role::findOrCreate($roleName);
            $role->givePermissionTo($permissions);
        }

        app(PermissionRegistrar::class)->forgetCachedPermissions();
    }
}
