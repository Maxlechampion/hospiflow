<?php

namespace Database\Seeders;

use App\Models\Facility;
use App\Models\User;
use Illuminate\Database\Seeder;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;

class FacilitiesSeeder extends Seeder
{
    public function run(): void
    {
        app(PermissionRegistrar::class)->forgetCachedPermissions();

        $view = Permission::findOrCreate('facilities.view', 'web');
        $manage = Permission::findOrCreate('facilities.manage', 'web');

        Role::findByName('admin', 'web')->givePermissionTo([$view, $manage]);

        foreach (['medecin', 'infirmier', 'secretaire', 'laborantin', 'pharmacien', 'comptable'] as $roleName) {
            Role::findOrCreate($roleName, 'web')->givePermissionTo($view);
        }

        $csm = Facility::firstOrCreate(
            ['code' => 'CSM'],
            [
                'name' => 'Clinique Saint-Michel',
                'city' => 'Cotonou',
                'address' => 'Zone résidentielle, Cotonou',
                'phone' => '+229 21 00 00 00',
                'is_active' => true,
            ]
        );

        $href = Facility::firstOrCreate(
            ['code' => 'HREF'],
            [
                'name' => 'Hôpital de Référence',
                'city' => 'Porto-Novo',
                'address' => 'Avenue de la République, Porto-Novo',
                'phone' => '+229 21 00 00 01',
                'is_active' => true,
            ]
        );

        $admin = User::where('email', 'admin@hospiflow.local')->firstOrFail();
        $admin->facilities()->syncWithoutDetaching([$csm->id, $href->id]);

        if (! $admin->current_facility_id) {
            $admin->forceFill(['current_facility_id' => $csm->id])->save();
        }

        $secretary = User::firstOrCreate(
            ['email' => 'secretaire@hospiflow.local'],
            [
                'name' => 'Secrétaire Démarrage',
                'password' => 'hospiflow_sec',
                'is_active' => true,
            ]
        );
        $secretary->assignRole('secretaire');
        $secretary->facilities()->syncWithoutDetaching([$csm->id]);

        if (! $secretary->current_facility_id) {
            $secretary->forceFill(['current_facility_id' => $csm->id])->save();
        }
    }
}
