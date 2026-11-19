<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;

class PrescriptionsPermissionsSeeder extends Seeder
{
    public function run(): void
    {
        $view = Permission::findOrCreate('prescriptions.view');
        $manage = Permission::findOrCreate('prescriptions.manage');

        $map = [
            'admin' => [$view, $manage],
            'medecin' => [$view, $manage],
            'infirmier' => [$view],
            'pharmacien' => [$view],
        ];

        foreach ($map as $roleName => $permissions) {
            $role = Role::findOrCreate($roleName);
            $role->givePermissionTo($permissions);
        }

        app(PermissionRegistrar::class)->forgetCachedPermissions();
    }
}
