<?php

namespace Database\Seeders;

use App\Models\User;
use App\Models\Facility;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class TestUserSeeder extends Seeder
{
    public function run(): void
    {
        $facility = Facility::first();
        
        if (! $facility) {
            $facility = Facility::create([
                'code' => 'CLINIQUE-01',
                'name' => 'Clinique Centrale',
                'is_active' => true,
            ]);
        }

        $user = User::updateOrCreate(
            ['email' => 'admin@hospiflow.test'],
            [
                'name' => 'Dr. Admin',
                'password' => Hash::make('password'),
                'is_active' => true,
                'current_facility_id' => $facility->id,
            ]
        );

        $user->facilities()->syncWithoutDetaching([$facility->id]);

        // Donner toutes les permissions (pour les tests)
        $user->givePermissionTo(\Spatie\Permission\Models\Permission::all());

        echo "✅ Utilisateur créé : admin@hospiflow.test / password" . PHP_EOL;
    }
}