<?php

use App\Models\Patient;

beforeEach(function () {
    [$this->user, $this->facility] = authUser(['patients.view', 'patients.manage']);
});

test('index requires authentication', function () {
    $this->getJson('/api/patients')->assertStatus(401);
});

test('index returns empty list for new facility', function () {
    $this->actingAs($this->user, 'sanctum')
        ->getJson('/api/patients')
        ->assertStatus(200)
        ->assertJsonPath('patients', [])
        ->assertJsonStructure(['facility' => ['id', 'code'], 'patients']);
});

test('store creates a new patient with local code', function () {
    $response = $this->actingAs($this->user, 'sanctum')
        ->postJson('/api/patients', [
            'first_name' => 'Jean',
            'last_name' => 'Dupont',
            'date_of_birth' => '1990-05-15',
            'gender' => 'male',
            'phone' => '+22991000001',
        ]);

    $response->assertStatus(201)
        ->assertJsonPath('patient.first_name', 'Jean')
        ->assertJsonPath('patient.last_name', 'Dupont')
        ->assertJsonPath('patient.facility_id', $this->facility->id);

    $code = $response->json('patient.local_code');
    expect($code)->toMatch('/^P-'.strtoupper($this->facility->code).'-\d{4}$/');
});

test('store validates required fields', function () {
    $response = $this->actingAs($this->user, 'sanctum')
        ->postJson('/api/patients', []);

    $response->assertStatus(422)
        ->assertJsonPath('error.code', 'validation.failed')
        ->assertJsonStructure(['error' => ['code', 'message', 'fields']]);
});

test('store requires patients.manage permission', function () {
    [$userWithoutPerm, $facility] = authUser(['patients.view']);

    $response = $this->actingAs($userWithoutPerm, 'sanctum')
        ->postJson('/api/patients', [
            'first_name' => 'Jean',
            'last_name' => 'Dupont',
        ]);

    $response->assertStatus(403);
});

test('search finds patient by first name (portable LOWER LIKE)', function () {
    Patient::factory()->create([
        'facility_id' => $this->facility->id,
        'first_name' => 'Aminata',
        'last_name' => 'Soglo',
        'phone' => '+22997000001',
    ]);

    $response = $this->actingAs($this->user, 'sanctum')
        ->getJson('/api/patients/search?q=aminata');

    $response->assertStatus(200);
    expect($response->json('results'))->toHaveCount(1);
    expect($response->json('results.0.first_name'))->toBe('Aminata');
});

test('search returns empty for no match', function () {
    $response = $this->actingAs($this->user, 'sanctum')
        ->getJson('/api/patients/search?q=zzzznotfound');

    $response->assertStatus(200);
    expect($response->json('results'))->toBe([]);
});

test('update can clear a field with explicit null (Vague 1 fix)', function () {
    $patient = Patient::factory()->create([
        'facility_id' => $this->facility->id,
        'first_name' => 'Jean',
        'last_name' => 'Dupont',
        'phone' => '+22991000001',
    ]);

    $response = $this->actingAs($this->user, 'sanctum')
        ->patchJson('/api/patients/'.$patient->id, [
            'phone' => null,
        ]);

    $response->assertStatus(200);
    expect($response->json('patient.phone'))->toBeNull();

    $patient->refresh();
    expect($patient->phone)->toBeNull();
});
