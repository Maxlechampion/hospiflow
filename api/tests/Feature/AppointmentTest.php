<?php

use App\Models\Appointment;
use App\Models\Patient;
use App\Models\User;
use Illuminate\Support\Carbon;

beforeEach(function () {
    [$this->user, $this->facility] = authUser(['patients.view', 'appointments.manage']);
    $this->patient = Patient::factory()->create(['facility_id' => $this->facility->id]);
    $this->practitioner = User::factory()->create(['current_facility_id' => $this->facility->id]);
    $this->practitioner->facilities()->attach($this->facility->id);
});

test('store creates an appointment', function () {
    $response = $this->actingAs($this->user, 'sanctum')
        ->postJson('/api/appointments', [
            'patient_id' => $this->patient->id,
            'practitioner_id' => $this->practitioner->id,
            'scheduled_at' => Carbon::now()->addDays(3)->format('Y-m-d H:i:s'),
            'duration_minutes' => 30,
            'reason' => 'Consultation de suivi',
        ]);

    $response->assertStatus(201)
        ->assertJsonPath('appointment.status', 'scheduled')
        ->assertJsonPath('appointment.duration_minutes', 30);
});

test('store rejects appointment in the past', function () {
    $response = $this->actingAs($this->user, 'sanctum')
        ->postJson('/api/appointments', [
            'patient_id' => $this->patient->id,
            'practitioner_id' => $this->practitioner->id,
            'scheduled_at' => Carbon::now()->subDay()->format('Y-m-d H:i:s'),
        ]);

    $response->assertStatus(422);
});

test('store rejects conflicting appointment', function () {
    $start = Carbon::now()->addDays(3)->setTime(10, 0, 0);

    Appointment::factory()->create([
        'facility_id' => $this->facility->id,
        'practitioner_id' => $this->practitioner->id,
        'patient_id' => $this->patient->id,
        'scheduled_at' => $start,
        'duration_minutes' => 30,
        'status' => 'scheduled',
    ]);

    $response = $this->actingAs($this->user, 'sanctum')
        ->postJson('/api/appointments', [
            'patient_id' => $this->patient->id,
            'practitioner_id' => $this->practitioner->id,
            'scheduled_at' => $start->copy()->addMinutes(15)->format('Y-m-d H:i:s'),
            'duration_minutes' => 30,
        ]);

    $response->assertStatus(422);
    expect($response->json('error.message'))->toContain('Conflit');
});
