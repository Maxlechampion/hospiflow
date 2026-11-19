<?php

use App\Models\Drug;
use App\Models\DrugLot;
use App\Models\Facility;
use App\Models\Patient;
use App\Models\Prescription;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Spatie\Permission\Models\Permission;

uses(RefreshDatabase::class);

function makePharmacyContext(array $perms): array
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

test('dispensing updates prescription item and completes prescription when fulfilled', function () {
    [$user, $facility, $patient] = makePharmacyContext(['pharmacy.dispense', 'pharmacy.view']);
    $drug = Drug::factory()->create(['is_active' => true, 'unit_price' => 500]);
    DrugLot::factory()->create([
        'facility_id' => $facility->id,
        'drug_id' => $drug->id,
        'quantity' => 30,
        'expires_at' => now()->addMonths(6),
    ]);

    $prescription = Prescription::factory()->create([
        'facility_id' => $facility->id,
        'patient_id' => $patient->id,
        'practitioner_id' => $user->id,
        'created_by' => $user->id,
        'status' => 'active',
    ]);
    $item = $prescription->items()->create([
        'drug_id' => $drug->id,
        'dosage' => '500mg',
        'quantity' => 10,
    ]);

    $resp1 = $this->actingAs($user, 'sanctum')->postJson('/api/pharmacy/dispensations', [
        'patient_id' => $patient->id,
        'prescription_id' => $prescription->id,
        'prescription_item_id' => $item->id,
        'drug_id' => $drug->id,
        'quantity' => 4,
    ]);
    $resp1->assertStatus(201)->assertJsonPath('prescription_status', 'active');
    expect($item->fresh()->dispensed_quantity)->toBe(4);

    $resp2 = $this->actingAs($user, 'sanctum')->postJson('/api/pharmacy/dispensations', [
        'patient_id' => $patient->id,
        'prescription_id' => $prescription->id,
        'prescription_item_id' => $item->id,
        'drug_id' => $drug->id,
        'quantity' => 6,
    ]);
    $resp2->assertStatus(201)->assertJsonPath('prescription_status', 'completed');
    expect($item->fresh()->dispensed_quantity)->toBe(10);
    expect($prescription->fresh()->status)->toBe('completed');
});

test('dispensing rejects quantity exceeding remaining prescribed quantity', function () {
    [$user, $facility, $patient] = makePharmacyContext(['pharmacy.dispense', 'pharmacy.view']);
    $drug = Drug::factory()->create(['is_active' => true]);
    DrugLot::factory()->create([
        'facility_id' => $facility->id,
        'drug_id' => $drug->id,
        'quantity' => 50,
        'expires_at' => now()->addMonths(6),
    ]);

    $prescription = Prescription::factory()->create([
        'facility_id' => $facility->id,
        'patient_id' => $patient->id,
        'practitioner_id' => $user->id,
        'created_by' => $user->id,
        'status' => 'active',
    ]);
    $item = $prescription->items()->create([
        'drug_id' => $drug->id,
        'dosage' => '500mg',
        'quantity' => 5,
        'dispensed_quantity' => 3,
    ]);

    $this->actingAs($user, 'sanctum')->postJson('/api/pharmacy/dispensations', [
        'patient_id' => $patient->id,
        'prescription_id' => $prescription->id,
        'prescription_item_id' => $item->id,
        'drug_id' => $drug->id,
        'quantity' => 3,
    ])->assertStatus(422);
});

test('dispensing rejects prescription from another facility', function () {
    [$user, $facility, $patient] = makePharmacyContext(['pharmacy.dispense', 'pharmacy.view']);
    $otherFacility = Facility::factory()->create();
    $otherPatient = Patient::factory()->create(['facility_id' => $otherFacility->id]);
    $drug = Drug::factory()->create(['is_active' => true]);
    DrugLot::factory()->create([
        'facility_id' => $facility->id,
        'drug_id' => $drug->id,
        'quantity' => 20,
        'expires_at' => now()->addMonths(6),
    ]);

    $foreignPrescription = Prescription::factory()->create([
        'facility_id' => $otherFacility->id,
        'patient_id' => $otherPatient->id,
        'practitioner_id' => $user->id,
        'created_by' => $user->id,
        'status' => 'active',
    ]);

    $this->actingAs($user, 'sanctum')->postJson('/api/pharmacy/dispensations', [
        'patient_id' => $patient->id,
        'prescription_id' => $foreignPrescription->id,
        'drug_id' => $drug->id,
        'quantity' => 2,
    ])->assertStatus(422);
});
