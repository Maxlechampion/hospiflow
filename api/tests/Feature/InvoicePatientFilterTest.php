<?php

use App\Models\Facility;
use App\Models\Invoice;
use App\Models\Patient;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Spatie\Permission\Models\Permission;

uses(RefreshDatabase::class);

test('filters invoices by patient_id within current facility and rejects invalid patient_id', function () {
    $facility = Facility::factory()->create();
    $otherFacility = Facility::factory()->create();
    $user = User::factory()->create(['current_facility_id' => $facility->id]);
    $user->facilities()->attach([$facility->id, $otherFacility->id]);
    Permission::firstOrCreate(['name' => 'billing.view', 'guard_name' => 'web']);
    $user->givePermissionTo(['billing.view']);

    $patientA = Patient::factory()->create(['facility_id' => $facility->id]);
    $patientB = Patient::factory()->create(['facility_id' => $facility->id]);
    $foreignPatient = Patient::factory()->create(['facility_id' => $otherFacility->id]);

    Invoice::create([
        'facility_id' => $facility->id,
        'patient_id' => $patientA->id,
        'created_by' => $user->id,
        'number' => 'FAC-80001',
        'status' => 'draft',
        'total_amount' => 10000,
    ]);

    Invoice::create([
        'facility_id' => $facility->id,
        'patient_id' => $patientB->id,
        'created_by' => $user->id,
        'number' => 'FAC-80002',
        'status' => 'draft',
        'total_amount' => 20000,
    ]);

    Invoice::create([
        'facility_id' => $otherFacility->id,
        'patient_id' => $foreignPatient->id,
        'created_by' => $user->id,
        'number' => 'FAC-80003',
        'status' => 'draft',
        'total_amount' => 30000,
    ]);

    $this->actingAs($user, 'sanctum')->getJson('/api/invoices?patient_id='.$patientA->id)
        ->assertStatus(200)
        ->assertJsonCount(1, 'invoices')
        ->assertJsonPath('invoices.0.number', 'FAC-80001');

    $this->actingAs($user, 'sanctum')->getJson('/api/invoices?patient_id=abc')
        ->assertStatus(422);
});
