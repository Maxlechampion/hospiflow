<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;

class LabPermissionsSeeder extends Seeder
{
    public function run(): void
    {
        $view = Permission::findOrCreate('lab.view');
        $manageRequests = Permission::findOrCreate('lab.requests.manage');
        $manageResults = Permission::findOrCreate('lab.results.manage');

        $map = [
            'admin' => [$view, $manageRequests, $manageResults],
            'medecin' => [$view, $manageRequests],
            'infirmier' => [$view],
            'laborantin' => [$view, $manageResults],
        ];

        foreach ($map as $roleName => $permissions) {
            $role = Role::findOrCreate($roleName);
            $role->givePermissionTo($permissions);
        }

        app(PermissionRegistrar::class)->forgetCachedPermissions();
    }
}
