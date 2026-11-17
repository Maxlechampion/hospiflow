<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;

class ConsultationsPermissionsSeeder extends Seeder
{
    public function run(): void
    {
        $view = Permission::findOrCreate('consultations.view');
        $manage = Permission::findOrCreate('consultations.manage');

        $map = [
            'admin' => [$view, $manage],
            'medecin' => [$view, $manage],
            'infirmier' => [$view],
        ];

        foreach ($map as $roleName => $permissions) {
            $role = Role::findOrCreate($roleName);
            $role->givePermissionTo($permissions);
        }

        app(PermissionRegistrar::class)->forgetCachedPermissions();
    }
}
