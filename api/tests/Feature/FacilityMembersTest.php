<?php

use App\Models\Facility;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Spatie\Permission\Models\Permission;

uses(RefreshDatabase::class);

test('lists and detaches facility members while resetting current_facility_id if needed', function () {
    $facilityA = Facility::factory()->create(['is_active' => true]);
    $facilityB = Facility::factory()->create(['is_active' => true]);

    Permission::firstOrCreate(['name' => 'facilities.manage', 'guard_name' => 'web']);

    $admin = User::factory()->create(['current_facility_id' => $facilityA->id]);
    $admin->facilities()->attach($facilityA->id);
    $admin->givePermissionTo('facilities.manage');

    $member = User::factory()->create(['current_facility_id' => $facilityA->id]);
    $member->facilities()->attach([$facilityA->id, $facilityB->id]);

    // Liste des membres de facilityA
    $this->actingAs($admin, 'sanctum')
        ->getJson('/api/facilities/'.$facilityA->id.'/users')
        ->assertStatus(200)
        ->assertJsonCount(2, 'users');

    // Retrait du membre de facilityA -> bascule current_facility_id sur facilityB
    $this->actingAs($admin, 'sanctum')
        ->deleteJson('/api/facilities/'.$facilityA->id.'/users/'.$member->id)
        ->assertStatus(200);

    expect($member->fresh()->isMemberOf($facilityA))->toBeFalse();
    expect($member->fresh()->current_facility_id)->toBe($facilityB->id);

    // Second retrait -> 404
    $this->actingAs($admin, 'sanctum')
        ->deleteJson('/api/facilities/'.$facilityA->id.'/users/'.$member->id)
        ->assertStatus(404);
});
