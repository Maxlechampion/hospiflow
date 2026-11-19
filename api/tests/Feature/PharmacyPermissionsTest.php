<?php

use App\Models\Drug;
use App\Models\DrugLot;
use App\Models\Patient;

beforeEach(function () {
    $this->patient = Patient::factory()->create(['facility_id' => $this->facility->id]);
});

test('pharmacien can create drug', function () {
    [$user, $facility] = authUser(['pharmacy.catalog.manage', 'pharmacy.dispense', 'pharmacy.view']);
    $this->facility = $facility;

    $response = $this->actingAs($user, 'sanctum')
        ->postJson('/api/pharmacy/drugs', [
            'name' => 'Paracétamol 500mg',
            'form' => 'comprimé',
            'dosage' => '500mg',
            'unit' => 'boîte',
            'unit_price' => 1500,
        ]);

    $response->assertStatus(201);
});

test('preparateur cannot create drug', function () {
    [$user, $facility] = authUser(['pharmacy.dispense', 'pharmacy.view']);
    $this->facility = $facility;

    $response = $this->actingAs($user, 'sanctum')
        ->postJson('/api/pharmacy/drugs', [
            'name' => 'Aspirine 500mg',
            'form' => 'comprimé',
            'unit' => 'boîte',
        ]);

    $response->assertStatus(403);
});

test('preparateur can dispense', function () {
    [$user, $facility] = authUser(['pharmacy.dispense', 'pharmacy.view']);
    $this->facility = $facility;
    $patient = Patient::factory()->create(['facility_id' => $facility->id]);
    $drug = Drug::factory()->create(['unit_price' => 1000, 'is_active' => true]);
    DrugLot::factory()->create([
        'facility_id' => $facility->id,
        'drug_id' => $drug->id,
        'quantity' => 50,
    ]);

    $response = $this->actingAs($user, 'sanctum')
        ->postJson('/api/pharmacy/dispensations', [
            'patient_id' => $patient->id,
            'drug_id' => $drug->id,
            'quantity' => 5,
        ]);

    $response->assertStatus(201);
});

test('medecin cannot dispense', function () {
    [$user, $facility] = authUser(['pharmacy.view']);
    $this->facility = $facility;
    $patient = Patient::factory()->create(['facility_id' => $facility->id]);
    $drug = Drug::factory()->create(['unit_price' => 1000, 'is_active' => true]);
    DrugLot::factory()->create([
        'facility_id' => $facility->id,
        'drug_id' => $drug->id,
        'quantity' => 50,
    ]);

    $response = $this->actingAs($user, 'sanctum')
        ->postJson('/api/pharmacy/dispensations', [
            'patient_id' => $patient->id,
            'drug_id' => $drug->id,
            'quantity' => 5,
        ]);

    $response->assertStatus(403);
});

test('infirmier can view drugs but not manage', function () {
    [$user, $facility] = authUser(['pharmacy.view']);
    $this->facility = $facility;

    // Peut consulter
    $response = $this->actingAs($user, 'sanctum')
        ->getJson('/api/pharmacy/drugs');
    $response->assertStatus(200);

    // Ne peut pas créer
    $response = $this->actingAs($user, 'sanctum')
        ->postJson('/api/pharmacy/drugs', [
            'name' => 'Test',
            'form' => 'sirop',
            'unit' => 'flacon',
        ]);
    $response->assertStatus(403);
});
