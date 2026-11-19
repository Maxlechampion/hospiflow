<?php

use App\Models\Drug;
use App\Models\DrugLot;
use App\Models\Patient;

beforeEach(function () {
    [$this->user, $this->facility] = authUser([
        'pharmacy.view',
        'pharmacy.manage',
        'pharmacy.catalog.manage',
        'pharmacy.dispense',
        'billing.view',
        'billing.manage',
    ]);
    $this->patient = Patient::factory()->create(['facility_id' => $this->facility->id]);
});

test('storeDrug accepts unit_price', function () {
    $response = $this->actingAs($this->user, 'sanctum')
        ->postJson('/api/pharmacy/drugs', [
            'name' => 'Paracétamol 500mg',
            'form' => 'comprimé',
            'dosage' => '500mg',
            'unit' => 'boîte',
            'unit_price' => 1500,
        ]);

    $response->assertStatus(201)
        ->assertJsonPath('drug.unit_price', 1500);
});

test('drugs list returns unit_price', function () {
    Drug::factory()->create(['name' => 'Aspirine', 'unit_price' => 800, 'is_active' => true]);

    $response = $this->actingAs($this->user, 'sanctum')
        ->getJson('/api/pharmacy/drugs');

    $response->assertStatus(200);
    $aspirine = collect($response->json('drugs'))->firstWhere('name', 'Aspirine');
    expect($aspirine['unit_price'])->toBe(800);
});

test('dispense with create_invoice creates a draft invoice', function () {
    $drug = Drug::factory()->create(['unit_price' => 2000, 'is_active' => true]);
    DrugLot::factory()->create([
        'facility_id' => $this->facility->id,
        'drug_id' => $drug->id,
        'quantity' => 100,
    ]);

    $response = $this->actingAs($this->user, 'sanctum')
        ->postJson('/api/pharmacy/dispensations', [
            'patient_id' => $this->patient->id,
            'drug_id' => $drug->id,
            'quantity' => 10,
            'create_invoice' => true,
        ]);

    $response->assertStatus(201)
        ->assertJsonPath('dispensation.drug.unit_price', 2000)
        ->assertJsonPath('dispensation.total_price', 20000);

    expect($response->json('invoice'))->not->toBeNull();
    expect($response->json('invoice.total_amount'))->toBe(20000);
    expect($response->json('invoice.status'))->toBe('draft');
});

test('dispense without create_invoice does not create an invoice', function () {
    $drug = Drug::factory()->create(['unit_price' => 1000, 'is_active' => true]);
    DrugLot::factory()->create([
        'facility_id' => $this->facility->id,
        'drug_id' => $drug->id,
        'quantity' => 50,
    ]);

    $response = $this->actingAs($this->user, 'sanctum')
        ->postJson('/api/pharmacy/dispensations', [
            'patient_id' => $this->patient->id,
            'drug_id' => $drug->id,
            'quantity' => 5,
        ]);

    $response->assertStatus(201);
    expect($response->json('invoice'))->toBeNull();
});

test('invoice item can reference a dispensation', function () {
    $drug = Drug::factory()->create(['unit_price' => 3000, 'is_active' => true]);
    DrugLot::factory()->create([
        'facility_id' => $this->facility->id,
        'drug_id' => $drug->id,
        'quantity' => 100,
    ]);

    // 1. Créer une dispensation
    $dispResp = $this->actingAs($this->user, 'sanctum')
        ->postJson('/api/pharmacy/dispensations', [
            'patient_id' => $this->patient->id,
            'drug_id' => $drug->id,
            'quantity' => 3,
        ]);
    $dispResp->assertStatus(201);
    $dispId = $dispResp->json('dispensation.id');

    // 2. Créer une facture en référençant la dispensation
    $invResp = $this->actingAs($this->user, 'sanctum')
        ->postJson('/api/invoices', [
            'patient_id' => $this->patient->id,
            'items' => [[
                'label' => 'Médicament dispensé',
                'quantity' => 3,
                'unit_price' => 3000,
                'dispensation_id' => $dispId,
            ]],
        ]);

    $invResp->assertStatus(201)
        ->assertJsonPath('invoice.items.0.dispensation_id', $dispId);
});

test('unit_price defaults to 0 when not provided', function () {
    $response = $this->actingAs($this->user, 'sanctum')
        ->postJson('/api/pharmacy/drugs', [
            'name' => 'Médicament sans prix',
            'form' => 'sirop',
            'unit' => 'flacon',
        ]);

    $response->assertStatus(201)
        ->assertJsonPath('drug.unit_price', 0);
});
