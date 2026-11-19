<?php

use App\Models\Bed;
use App\Models\Facility;
use App\Models\Patient;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Spatie\Permission\Models\Permission;

uses(RefreshDatabase::class);

function makeAdmissionContext(array $perms = ['admissions.view', 'admissions.manage']): array
{
    $facility = Facility::factory()->create();
    $user = User::factory()->create(['current_facility_id' => $facility->id]);
    $user->facilities()->attach($facility->id);
    foreach ($perms as $perm) {
        Permission::firstOrCreate(['name' => $perm, 'guard_name' => 'web']);
    }
    $user->givePermissionTo($perms);
    $patient = Patient::factory()->create(['facility_id' => $facility->id]);

    return [$user, $facility, $patient];
}

test('creates bed, admits patient, occupies bed, and releases bed on discharge', function () {
    [$user, $facility, $patient] = makeAdmissionContext();

    $bedResp = $this->actingAs($user, 'sanctum')->postJson('/api/beds', [
        'ward' => 'Médecine',
        'room_number' => '101',
        'code' => 'MED-101-A',
    ])->assertStatus(201);
    $bedId = $bedResp->json('bed.id');

    $admResp = $this->actingAs($user, 'sanctum')->postJson('/api/admissions', [
        'patient_id' => $patient->id,
        'bed_id' => $bedId,
        'reason' => 'Fièvre persistante',
    ])->assertStatus(201)->assertJsonPath('admission.status', 'admitted');
    $admissionId = $admResp->json('admission.id');

    expect(Bed::find($bedId)?->status)->toBe('occupied');

    $this->actingAs($user, 'sanctum')->postJson('/api/admissions/'.$admissionId.'/discharge', [
        'notes' => 'Sortie autorisée',
    ])->assertStatus(200)->assertJsonPath('admission.status', 'discharged');

    expect(Bed::find($bedId)?->status)->toBe('available');
});

test('prevents double active admission for same patient and prevents occupying unavailable bed', function () {
    [$user, $facility, $patient] = makeAdmissionContext();
    $secondPatient = Patient::factory()->create(['facility_id' => $facility->id]);
    $bed1 = Bed::create(['facility_id' => $facility->id, 'ward' => 'Urgences', 'code' => 'URG-01', 'status' => 'available']);
    $bed2 = Bed::create(['facility_id' => $facility->id, 'ward' => 'Urgences', 'code' => 'URG-02', 'status' => 'available']);
    $maintBed = Bed::create(['facility_id' => $facility->id, 'ward' => 'Urgences', 'code' => 'URG-03', 'status' => 'maintenance']);

    $this->actingAs($user, 'sanctum')->postJson('/api/admissions', [
        'patient_id' => $patient->id,
        'bed_id' => $bed1->id,
    ])->assertStatus(201);

    // Patient déjà admis
    $this->actingAs($user, 'sanctum')->postJson('/api/admissions', [
        'patient_id' => $patient->id,
        'bed_id' => $bed2->id,
    ])->assertStatus(422);

    // Lit déjà occupé
    $this->actingAs($user, 'sanctum')->postJson('/api/admissions', [
        'patient_id' => $secondPatient->id,
        'bed_id' => $bed1->id,
    ])->assertStatus(422);

    // Lit en maintenance
    $this->actingAs($user, 'sanctum')->postJson('/api/admissions', [
        'patient_id' => $secondPatient->id,
        'bed_id' => $maintBed->id,
    ])->assertStatus(422);
});

test('enforces multi-facility isolation on admissions and beds', function () {
    [$user, $facility, $patient] = makeAdmissionContext();
    $otherFacility = Facility::factory()->create();
    $otherPatient = Patient::factory()->create(['facility_id' => $otherFacility->id]);
    $otherBed = Bed::create(['facility_id' => $otherFacility->id, 'ward' => 'Chirurgie', 'code' => 'CHIR-01', 'status' => 'available']);

    $this->actingAs($user, 'sanctum')->postJson('/api/admissions', [
        'patient_id' => $otherPatient->id,
    ])->assertStatus(422);

    $this->actingAs($user, 'sanctum')->postJson('/api/admissions', [
        'patient_id' => $patient->id,
        'bed_id' => $otherBed->id,
    ])->assertStatus(422);
});
