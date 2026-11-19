<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;

class RolesAndPermissionsSeeder extends Seeder
{
    public function run(): void
    {
        app(PermissionRegistrar::class)->forgetCachedPermissions();

        $matrix = [
            'users.manage' => ['admin'],
            'patients.view' => ['admin', 'medecin', 'infirmier', 'secretaire'],
            'patients.manage' => ['admin', 'medecin', 'secretaire'],
            'appointments.manage' => ['admin', 'secretaire', 'infirmier'],
            'lab.results.manage' => ['admin', 'laborantin'],
            'pharmacy.catalog.manage' => ['admin', 'pharmacien'],
            'pharmacy.dispense' => ['admin', 'pharmacien', 'preparateur'],
            'pharmacy.view' => ['admin', 'medecin', 'infirmier', 'pharmacien', 'preparateur'],
            'billing.manage' => ['admin', 'comptable'],
            'reports.view' => ['admin', 'medecin', 'comptable'],
            'prescriptions.view' => ['admin', 'medecin', 'infirmier', 'pharmacien'],
            'prescriptions.manage' => ['admin', 'medecin'],
        ];

        foreach (array_keys($matrix) as $permissionName) {
            Permission::findOrCreate($permissionName, 'web');
        }

        foreach ($matrix as $permissionName => $roleNames) {
            foreach ($roleNames as $roleName) {
                Role::findOrCreate($roleName, 'web')
                    ->givePermissionTo($permissionName);
            }
        }

        Role::findByName('admin', 'web')
            ->syncPermissions(array_keys($matrix));

        $user = User::firstOrCreate(
            ['email' => 'admin@hospiflow.local'],
            [
                'name' => 'Administrateur HOSPIFLOW',
                'password' => 'hospiflow_admin',
                'phone' => null,
                'is_active' => true,
            ]
        );

        $user->assignRole('admin');
    }
}
