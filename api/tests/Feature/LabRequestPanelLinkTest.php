<?php

use App\Models\Facility;
use App\Models\LabPanel;
use App\Models\Patient;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Spatie\Permission\Models\Permission;

uses(RefreshDatabase::class);

test('creates lab request linked to active facility panel and populates test name', function () {
    $facility = Facility::factory()->create();
    $user = User::factory()->create(['current_facility_id' => $facility->id]);
    $user->facilities()->attach($facility->id);
    Permission::firstOrCreate(['name' => 'lab.requests.manage', 'guard_name' => 'web']);
    $user->givePermissionTo(['lab.requests.manage']);
    $patient = Patient::factory()->create(['facility_id' => $facility->id]);

    $panel = LabPanel::create([
        'facility_id' => $facility->id,
        'code' => 'NFS',
        'name' => 'Numération Formule Sanguine',
        'category' => 'Hématologie',
        'price' => 3500,
        'is_active' => true,
    ]);

    $this->actingAs($user, 'sanctum')->postJson('/api/lab-requests', [
        'patient_id' => $patient->id,
        'lab_panel_id' => $panel->id,
        'priority' => 'urgent',
    ])->assertStatus(201)
        ->assertJsonPath('lab_request.lab_panel_id', $panel->id)
        ->assertJsonPath('lab_request.panel', 'Numération Formule Sanguine')
        // panel lié avec succès
        ->assertJsonPath('lab_request.panel_catalog.price', 3500);
});

test('rejects inactive lab panel or panel from another facility', function () {
    $facility = Facility::factory()->create();
    $otherFacility = Facility::factory()->create();
    $user = User::factory()->create(['current_facility_id' => $facility->id]);
    $user->facilities()->attach($facility->id);
    Permission::firstOrCreate(['name' => 'lab.requests.manage', 'guard_name' => 'web']);
    $user->givePermissionTo(['lab.requests.manage']);
    $patient = Patient::factory()->create(['facility_id' => $facility->id]);

    $inactivePanel = LabPanel::create([
        'facility_id' => $facility->id,
        'code' => 'OLD',
        'name' => 'Ancien panel',
        'price' => 1000,
        'is_active' => false,
    ]);
    $foreignPanel = LabPanel::create([
        'facility_id' => $otherFacility->id,
        'code' => 'EXT',
        'name' => 'Panel externe',
        'price' => 2000,
        'is_active' => true,
    ]);

    $this->actingAs($user, 'sanctum')->postJson('/api/lab-requests', [
        'patient_id' => $patient->id,
        'lab_panel_id' => $inactivePanel->id,
    ])->assertStatus(422);

    $this->actingAs($user, 'sanctum')->postJson('/api/lab-requests', [
        'patient_id' => $patient->id,
        'lab_panel_id' => $foreignPanel->id,
    ])->assertStatus(422);
});
