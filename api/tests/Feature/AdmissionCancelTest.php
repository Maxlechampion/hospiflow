<?php

use App\Models\Admission;
use App\Models\Bed;
use App\Models\Facility;
use App\Models\Patient;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Spatie\Permission\Models\Permission;

uses(RefreshDatabase::class);

test('cancels active admission and releases occupied bed', function () {
    $facility = Facility::factory()->create();
    $user = User::factory()->create(['current_facility_id' => $facility->id]);
    $user->facilities()->attach($facility->id);
    Permission::firstOrCreate(['name' => 'admissions.manage', 'guard_name' => 'web']);
    $user->givePermissionTo(['admissions.manage']);
    $patient = Patient::factory()->create(['facility_id' => $facility->id]);
    $bed = Bed::create(['facility_id' => $facility->id, 'ward' => 'Urgences', 'code' => 'URG-02', 'status' => 'occupied']);

    $admission = Admission::create([
        'facility_id' => $facility->id,
        'patient_id' => $patient->id,
        'bed_id' => $bed->id,
        'admitted_by' => $user->id,
        'status' => 'admitted',
        'admitted_at' => now(),
    ]);

    $this->actingAs($user, 'sanctum')->postJson('/api/admissions/'.$admission->id.'/cancel', [
        'reason' => 'Erreur de saisie patient',
    ])->assertStatus(200)
        ->assertJsonPath('admission.status', 'cancelled')
        ->assertJsonPath('admission.bed.status', 'available');

    expect($bed->fresh()->status)->toBe('available');
});

test('rejects cancelling an already discharged admission', function () {
    $facility = Facility::factory()->create();
    $user = User::factory()->create(['current_facility_id' => $facility->id]);
    $user->facilities()->attach($facility->id);
    Permission::firstOrCreate(['name' => 'admissions.manage', 'guard_name' => 'web']);
    $user->givePermissionTo(['admissions.manage']);
    $patient = Patient::factory()->create(['facility_id' => $facility->id]);

    $admission = Admission::create([
        'facility_id' => $facility->id,
        'patient_id' => $patient->id,
        'admitted_by' => $user->id,
        'status' => 'discharged',
        'admitted_at' => now()->subDay(),
        'discharged_at' => now(),
    ]);

    $this->actingAs($user, 'sanctum')->postJson('/api/admissions/'.$admission->id.'/cancel')
        ->assertStatus(422);
});
