<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;

class BillingPermissionsSeeder extends Seeder
{
    public function run(): void
    {
        $view = Permission::findOrCreate('billing.view');
        $manage = Permission::findOrCreate('billing.manage');

        $map = [
            'admin' => [$view, $manage],
            'comptable' => [$view, $manage],
            'medecin' => [$view],
        ];

        foreach ($map as $roleName => $permissions) {
            $role = Role::findOrCreate($roleName);
            $role->givePermissionTo($permissions);
        }

        app(PermissionRegistrar::class)->forgetCachedPermissions();
    }
}
