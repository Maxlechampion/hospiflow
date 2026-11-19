<?php

use App\Models\Drug;
use App\Models\Patient;
use App\Models\Prescription;
use App\Models\PrescriptionItem;
use Spatie\Activitylog\Models\Activity;

beforeEach(function () {
    [$this->user, $this->facility] = authUser(['prescriptions.view', 'prescriptions.manage']);
    $this->patient = Patient::factory()->create(['facility_id' => $this->facility->id]);
    $this->drug = Drug::factory()->create(['is_active' => true]);
});

test('index requires authentication', function () {
    $this->getJson('/api/prescriptions')->assertStatus(401);
});

test('index returns empty list for new facility', function () {
    $this->actingAs($this->user, 'sanctum')
        ->getJson('/api/prescriptions')
        ->assertStatus(200)
        ->assertJsonPath('prescriptions', []);
});

test('store creates a prescription with items', function () {
    $response = $this->actingAs($this->user, 'sanctum')
        ->postJson('/api/prescriptions', [
            'patient_id' => $this->patient->id,
            'notes' => 'Traitement de la grippe',
            'items' => [
                [
                    'drug_id' => $this->drug->id,
                    'dosage' => '500mg',
                    'frequency' => '3 fois par jour',
                    'duration' => '7 jours',
                    'quantity' => 21,
                    'instructions' => 'Au cours des repas',
                ],
            ],
        ]);

    $response->assertStatus(201)
        ->assertJsonPath('prescription.status', 'active')
        ->assertJsonPath('prescription.patient.id', $this->patient->id);

    expect($response->json('prescription.items'))->toHaveCount(1);
    expect($response->json('prescription.items.0.drug.id'))->toBe($this->drug->id);
    expect($response->json('prescription.items.0.quantity'))->toBe(21);
});

test('store requires at least one item', function () {
    $response = $this->actingAs($this->user, 'sanctum')
        ->postJson('/api/prescriptions', [
            'patient_id' => $this->patient->id,
            'items' => [],
        ]);

    $response->assertStatus(422)
        ->assertJsonPath('error.code', 'validation.failed');
});

test('store validates required fields', function () {
    $response = $this->actingAs($this->user, 'sanctum')
        ->postJson('/api/prescriptions', []);

    $response->assertStatus(422)
        ->assertJsonPath('error.code', 'validation.failed');
});

test('store requires prescriptions.manage permission', function () {
    [$userWithoutPerm, $facility] = authUser(['prescriptions.view']);
    $patient = Patient::factory()->create(['facility_id' => $facility->id]);

    $response = $this->actingAs($userWithoutPerm, 'sanctum')
        ->postJson('/api/prescriptions', [
            'patient_id' => $patient->id,
            'items' => [['drug_id' => $this->drug->id]],
        ]);

    $response->assertStatus(403);
});

test('show returns prescription with items', function () {
    $prescription = Prescription::factory()->create([
        'facility_id' => $this->facility->id,
        'patient_id' => $this->patient->id,
        'practitioner_id' => $this->user->id,
    ]);
    PrescriptionItem::factory()->create([
        'prescription_id' => $prescription->id,
        'drug_id' => $this->drug->id,
    ]);

    $response = $this->actingAs($this->user, 'sanctum')
        ->getJson('/api/prescriptions/'.$prescription->id);

    $response->assertStatus(200)
        ->assertJsonPath('prescription.id', $prescription->id);
    expect($response->json('prescription.items'))->toHaveCount(1);
});

test('update changes status', function () {
    $prescription = Prescription::factory()->create([
        'facility_id' => $this->facility->id,
        'patient_id' => $this->patient->id,
        'practitioner_id' => $this->user->id,
        'status' => 'active',
    ]);

    $response = $this->actingAs($this->user, 'sanctum')
        ->patchJson('/api/prescriptions/'.$prescription->id, [
            'status' => 'completed',
        ]);

    $response->assertStatus(200)
        ->assertJsonPath('prescription.status', 'completed');
});

test('cannot update cancelled prescription', function () {
    $prescription = Prescription::factory()->create([
        'facility_id' => $this->facility->id,
        'patient_id' => $this->patient->id,
        'practitioner_id' => $this->user->id,
        'status' => 'cancelled',
    ]);

    $response = $this->actingAs($this->user, 'sanctum')
        ->patchJson('/api/prescriptions/'.$prescription->id, [
            'status' => 'active',
        ]);

    $response->assertStatus(403);
});

test('delete only works on draft prescriptions', function () {
    $draft = Prescription::factory()->draft()->create([
        'facility_id' => $this->facility->id,
        'patient_id' => $this->patient->id,
        'practitioner_id' => $this->user->id,
    ]);
    PrescriptionItem::factory()->create([
        'prescription_id' => $draft->id,
        'drug_id' => $this->drug->id,
    ]);

    $response = $this->actingAs($this->user, 'sanctum')
        ->deleteJson('/api/prescriptions/'.$draft->id);

    $response->assertStatus(200);
    expect(Prescription::find($draft->id))->toBeNull();
});

test('cannot delete active prescription', function () {
    $active = Prescription::factory()->create([
        'facility_id' => $this->facility->id,
        'patient_id' => $this->patient->id,
        'practitioner_id' => $this->user->id,
        'status' => 'active',
    ]);

    $response = $this->actingAs($this->user, 'sanctum')
        ->deleteJson('/api/prescriptions/'.$active->id);

    $response->assertStatus(403);
});

test('add item to existing prescription', function () {
    $prescription = Prescription::factory()->create([
        'facility_id' => $this->facility->id,
        'patient_id' => $this->patient->id,
        'practitioner_id' => $this->user->id,
    ]);
    $drug2 = Drug::factory()->create(['is_active' => true]);

    $response = $this->actingAs($this->user, 'sanctum')
        ->postJson('/api/prescriptions/'.$prescription->id.'/items', [
            'drug_id' => $drug2->id,
            'dosage' => '250mg',
            'quantity' => 10,
        ]);

    $response->assertStatus(201)
        ->assertJsonPath('item.drug.id', $drug2->id);
    expect($prescription->fresh()->items)->toHaveCount(1);
});

test('remove item from prescription', function () {
    $prescription = Prescription::factory()->create([
        'facility_id' => $this->facility->id,
        'patient_id' => $this->patient->id,
        'practitioner_id' => $this->user->id,
    ]);
    $item = PrescriptionItem::factory()->create([
        'prescription_id' => $prescription->id,
        'drug_id' => $this->drug->id,
    ]);

    $response = $this->actingAs($this->user, 'sanctum')
        ->deleteJson('/api/prescriptions/'.$prescription->id.'/items/'.$item->id);

    $response->assertStatus(200);
    expect(PrescriptionItem::find($item->id))->toBeNull();
});

test('filter prescriptions by patient', function () {
    Prescription::factory()->create([
        'facility_id' => $this->facility->id,
        'patient_id' => $this->patient->id,
        'practitioner_id' => $this->user->id,
    ]);
    $otherPatient = Patient::factory()->create(['facility_id' => $this->facility->id]);
    Prescription::factory()->create([
        'facility_id' => $this->facility->id,
        'patient_id' => $otherPatient->id,
        'practitioner_id' => $this->user->id,
    ]);

    $response = $this->actingAs($this->user, 'sanctum')
        ->getJson('/api/prescriptions?patient_id='.$this->patient->id);

    $response->assertStatus(200);
    expect($response->json('prescriptions'))->toHaveCount(1);
    expect($response->json('prescriptions.0.patient.id'))->toBe($this->patient->id);
});

test('produces activity log on create', function () {
    Activity::query()->delete();

    $this->actingAs($this->user, 'sanctum')
        ->postJson('/api/prescriptions', [
            'patient_id' => $this->patient->id,
            'items' => [['drug_id' => $this->drug->id]],
        ])
        ->assertStatus(201);

    $logs = Activity::where('log_name', 'prescription')->get();
    expect($logs)->toHaveCount(1);
    expect($logs->first()->event)->toBe('created');
    expect($logs->first()->properties['facility_id'])->toBe($this->facility->id);
});
