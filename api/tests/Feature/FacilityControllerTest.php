<?php

use App\Models\Facility;
use App\Models\User;

beforeEach(function () {
    [$this->admin, $this->facility] = authUser(['facilities.manage']);
});

test('admin with facilities.manage can create a facility and is attached to it', function () {
    $response = $this->actingAs($this->admin, 'sanctum')
        ->postJson('/api/facilities', [
            'code' => 'CLI-COT-09',
            'name' => 'Clinique du Littoral',
            'city' => 'Cotonou',
        ]);

    $response->assertStatus(201)
        ->assertJsonPath('facility.code', 'CLI-COT-09')
        ->assertJsonPath('facility.name', 'Clinique du Littoral');

    $createdId = $response->json('facility.id');
    expect($this->admin->facilities()->where('facilities.id', $createdId)->exists())->toBeTrue();
});

test('user without facilities.manage cannot create a facility or attach members', function () {
    [$staff] = authUser(['patients.view'], $this->facility);
    $other = User::factory()->create();

    $this->actingAs($staff, 'sanctum')
        ->postJson('/api/facilities', [
            'code' => 'FORBIDDEN-01',
            'name' => 'Interdit',
        ])
        ->assertStatus(403);

    $this->actingAs($staff, 'sanctum')
        ->postJson('/api/facilities/'.$this->facility->id.'/users', [
            'email' => $other->email,
        ])
        ->assertStatus(403);
});

test('member can switch current_facility_id to an active member facility', function () {
    $second = Facility::factory()->create(['is_active' => true]);
    $this->admin->facilities()->syncWithoutDetaching([$second->id]);

    $this->actingAs($this->admin, 'sanctum')
        ->postJson('/api/facilities/'.$second->id.'/switch')
        ->assertStatus(200)
        ->assertJsonPath('current_facility_id', $second->id);

    expect((int) $this->admin->fresh()->current_facility_id)->toBe($second->id);
});

test('switching to an inactive or unattached facility is forbidden', function () {
    $inactive = Facility::factory()->create(['is_active' => false]);
    $this->admin->facilities()->syncWithoutDetaching([$inactive->id]);

    $this->actingAs($this->admin, 'sanctum')
        ->postJson('/api/facilities/'.$inactive->id.'/switch')
        ->assertStatus(403);

    $unattached = Facility::factory()->create(['is_active' => true]);

    $this->actingAs($this->admin, 'sanctum')
        ->postJson('/api/facilities/'.$unattached->id.'/switch')
        ->assertStatus(403);
});

test('admin can attach an existing user by email and rejects unknown email', function () {
    $target = User::factory()->create(['email' => 'membre.hospiflow@example.test']);

    $this->actingAs($this->admin, 'sanctum')
        ->postJson('/api/facilities/'.$this->facility->id.'/users', [
            'email' => $target->email,
        ])
        ->assertStatus(200);

    expect($this->facility->users()->where('users.id', $target->id)->exists())->toBeTrue();

    $this->actingAs($this->admin, 'sanctum')
        ->postJson('/api/facilities/'.$this->facility->id.'/users', [
            'email' => 'inconnu.hospiflow@example.test',
        ])
        ->assertStatus(422);
});
