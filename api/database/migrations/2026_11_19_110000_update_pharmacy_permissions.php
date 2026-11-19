<?php

use Illuminate\Database\Migrations\Migration;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;

return new class extends Migration
{
    public function up(): void
    {
        // Créer les nouvelles permissions granulaires
        $catalogManage = Permission::firstOrCreate(['name' => 'pharmacy.catalog.manage']);
        $dispense = Permission::firstOrCreate(['name' => 'pharmacy.dispense']);
        $view = Permission::firstOrCreate(['name' => 'pharmacy.view']);

        // Attribuer aux rôles existants
        $admin = Role::where('name', 'admin')->first();
        $pharmacien = Role::where('name', 'pharmacien')->first();
        $preparateur = Role::firstOrCreate(['name' => 'preparateur']);
        $medecin = Role::where('name', 'medecin')->first();
        $infirmier = Role::where('name', 'infirmier')->first();

        if ($admin) {
            $admin->givePermissionTo([$catalogManage, $dispense, $view]);
        }
        if ($pharmacien) {
            $pharmacien->givePermissionTo([$catalogManage, $dispense, $view]);
        }

        // Préparateur : seulement dispensation et consultation
        $preparateur->givePermissionTo([$dispense, $view]);

        // Médecin et infirmier : seulement consultation
        if ($medecin) {
            $medecin->givePermissionTo([$view]);
        }
        if ($infirmier) {
            $infirmier->givePermissionTo([$view]);
        }

        // Optionnel : supprimer l'ancienne permission globale si elle existe
        $oldPerm = Permission::where('name', 'pharmacy.manage')->first();
        if ($oldPerm) {
            $oldPerm->delete();
        }
    }

    public function down(): void
    {
        Permission::where('name', 'pharmacy.catalog.manage')->delete();
        Permission::where('name', 'pharmacy.dispense')->delete();
        Permission::where('name', 'pharmacy.view')->delete();

        // Recréer l'ancienne permission
        Permission::firstOrCreate(['name' => 'pharmacy.manage']);
    }
};
