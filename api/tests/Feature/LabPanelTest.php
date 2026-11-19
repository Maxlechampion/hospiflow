<?php

use App\Models\Facility;
use App\Models\LabPanel;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Spatie\Permission\Models\Permission;

uses(RefreshDatabase::class);

function makeLabPanelContext(array $perms = ['lab.view', 'lab.requests.manage']): array
{
    $facility = Facility::factory()->create();
    $user = User::factory()->create(['current_facility_id' => $facility->id]);
    $user->facilities()->attach($facility->id);
    foreach ($perms as $perm) {
        Permission::firstOrCreate(['name' => $perm, 'guard_name' => 'web']);
    }
    $user->givePermissionTo($perms);

    return [$user, $facility];
}

test('creates and lists facility lab panels and enforces unique code per facility', function () {
    [$user, $facility] = makeLabPanelContext();
    $otherFacility = Facility::factory()->create();

    $this->actingAs($user, 'sanctum')->postJson('/api/lab-panels', [
        'code' => 'nfs',
        'name' => 'Numération Formule Sanguine',
        'category' => 'Hématologie',
        'price' => 3500,
        'turnaround_hours' => 4,
    ])->assertStatus(201)
        ->assertJsonPath('panel.code', 'NFS')
        ->assertJsonPath('panel.price', 3500);

    // Doublon dans le même établissement refusé
    $this->actingAs($user, 'sanctum')->postJson('/api/lab-panels', [
        'code' => 'NFS',
        'name' => 'Doublon NFS',
        'price' => 4000,
    ])->assertStatus(422);

    // Même code autorisé dans un autre établissement
    LabPanel::create([
        'facility_id' => $otherFacility->id,
        'code' => 'NFS',
        'name' => 'NFS autre établissement',
        'price' => 5000,
    ]);

    $this->actingAs($user, 'sanctum')->getJson('/api/lab-panels')
        ->assertStatus(200)
        ->assertJsonCount(1, 'panels');
});

test('updates lab panel price and active status', function () {
    [$user, $facility] = makeLabPanelContext();
    $panel = LabPanel::create([
        'facility_id' => $facility->id,
        'code' => 'GLY',
        'name' => 'Glycémie à jeun',
        'price' => 1500,
        'is_active' => true,
    ]);

    $this->actingAs($user, 'sanctum')->patchJson('/api/lab-panels/'.$panel->id, [
        'price' => 2000,
        'is_active' => false,
    ])->assertStatus(200)
        ->assertJsonPath('panel.price', 2000)
        ->assertJsonPath('panel.is_active', false);
});

test('denies lab panel creation without lab.requests.manage permission', function () {
    [$user] = makeLabPanelContext(['lab.view']);

    $this->actingAs($user, 'sanctum')->postJson('/api/lab-panels', [
        'code' => 'PALU',
        'name' => 'Goutte épaisse',
        'price' => 1000,
    ])->assertStatus(403);
});
