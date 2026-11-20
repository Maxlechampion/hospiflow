<?php

use App\Models\Patient;
use Spatie\Activitylog\Models\Activity;

beforeEach(function () {
    [$this->user, $this->facility] = authUser(['patients.view', 'patients.manage', 'reports.view']);
});

test('creating a patient produces an activity log', function () {
    Activity::query()->delete();

    $this->actingAs($this->user, 'sanctum')
        ->postJson('/api/patients', [
            'first_name' => 'Aminata',
            'last_name' => 'Soglo',
            'phone' => '+22997000001',
        ])
        ->assertStatus(201);

    $logs = Activity::where('log_name', 'patient')->get();
    expect($logs)->toHaveCount(1);

    $log = $logs->first();
    expect($log->event)->toBe('created');
    expect($log->subject_type)->toBe(Patient::class);
    expect($log->properties['attributes'])->toHaveKey('first_name', 'Aminata');
});

test('updating a patient records only the changed fields', function () {
    Activity::query()->delete();

    $patient = Patient::factory()->create([
        'facility_id' => $this->facility->id,
        'first_name' => 'Jean',
        'last_name' => 'Dupont',
        'phone' => '+22991000001',
    ]);

    $this->actingAs($this->user, 'sanctum')
        ->patchJson('/api/patients/'.$patient->id, [
            'phone' => '+22991000002',
        ])
        ->assertStatus(200);

    $logs = Activity::where('log_name', 'patient')
        ->where('event', 'updated')
        ->get();

    expect($logs)->toHaveCount(1);
    $log = $logs->first();
    expect($log->properties['old'])->toHaveKey('phone', '+22991000001');
    expect($log->properties['attributes'])->toHaveKey('phone', '+22991000002');
});

test('audit-logs endpoint requires authentication', function () {
    $this->getJson('/api/audit-logs')->assertStatus(401);
});

test('audit-logs endpoint forbids access without reports.view permission', function () {
    [$limitedUser] = authUser(['patients.view'], $this->facility);

    $this->actingAs($limitedUser, 'sanctum')
        ->getJson('/api/audit-logs')
        ->assertStatus(403);
});

test('audit-logs endpoint returns logs for the current facility', function () {
    Activity::query()->delete();

    Patient::factory()->create([
        'facility_id' => $this->facility->id,
    ]);

    $response = $this->actingAs($this->user, 'sanctum')
        ->getJson('/api/audit-logs');

    $response->assertStatus(200)
        ->assertJsonStructure([
            'activity_logs',
            'pagination' => ['current_page', 'per_page', 'total'],
        ]);

    expect($response->json('activity_logs'))->not->toBeEmpty();
});

test('audit-logs endpoint filters by subject_type, event, and date range', function () {
    Activity::query()->delete();

    $patient = Patient::factory()->create([
        'facility_id' => $this->facility->id,
        'phone' => '+22990000001',
    ]);

    $this->actingAs($this->user, 'sanctum')
        ->patchJson('/api/patients/'.$patient->id, [
            'phone' => '+22990000002',
        ])
        ->assertStatus(200);

    $today = now()->format('Y-m-d');
    $response = $this->actingAs($this->user, 'sanctum')
        ->getJson('/api/audit-logs?subject_type=Patient&event=updated&from='.$today.'&to='.$today);

    $response->assertStatus(200);
    $items = $response->json('activity_logs');
    expect($items)->not->toBeEmpty();
    foreach ($items as $item) {
        expect($item['subject']['type'])->toBe(Patient::class);
        expect($item['event'])->toBe('updated');
    }
});

test('audit-logs endpoint rejects invalid subject_type with 422', function () {
    $this->actingAs($this->user, 'sanctum')
        ->getJson('/api/audit-logs?subject_type=UnknownModel')
        ->assertStatus(422);
});
