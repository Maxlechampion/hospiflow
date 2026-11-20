<?php

use App\Models\Facility;
use App\Models\Invoice;
use App\Models\Patient;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Spatie\Permission\Models\Permission;

uses(RefreshDatabase::class);

test('enforces invoice status transitions and blocks cancellation after payment', function () {
    $facility = Facility::factory()->create();
    $otherFacility = Facility::factory()->create();
    $user = User::factory()->create(['current_facility_id' => $facility->id]);
    $user->facilities()->attach([$facility->id, $otherFacility->id]);

    foreach (['billing.view', 'billing.manage'] as $perm) {
        Permission::firstOrCreate(['name' => $perm, 'guard_name' => 'web']);
    }
    $user->givePermissionTo(['billing.view', 'billing.manage']);

    $patient = Patient::factory()->create(['facility_id' => $facility->id]);
    $foreignPatient = Patient::factory()->create(['facility_id' => $otherFacility->id]);

    $draftInvoice = Invoice::create([
        'facility_id' => $facility->id,
        'patient_id' => $patient->id,
        'created_by' => $user->id,
        'number' => 'FAC-70001',
        'status' => 'draft',
        'total_amount' => 10000,
    ]);

    $foreignInvoice = Invoice::create([
        'facility_id' => $otherFacility->id,
        'patient_id' => $foreignPatient->id,
        'created_by' => $user->id,
        'number' => 'FAC-70002',
        'status' => 'draft',
        'total_amount' => 5000,
    ]);

    // Isolation multi-établissement sur PATCH
    $this->actingAs($user, 'sanctum')
        ->patchJson('/api/invoices/'.$foreignInvoice->id, ['status' => 'issued'])
        ->assertStatus(404);

    // Brouillon -> Émise
    $this->actingAs($user, 'sanctum')
        ->patchJson('/api/invoices/'.$draftInvoice->id, ['status' => 'issued'])
        ->assertStatus(200)
        ->assertJsonPath('invoice.status', 'issued');

    // Encaissement partiel (4000 sur 10000)
    $this->actingAs($user, 'sanctum')
        ->postJson('/api/invoices/'.$draftInvoice->id.'/payments', [
            'amount' => 4000,
            'method' => 'cash',
        ])
        ->assertStatus(200)
        ->assertJsonPath('invoice.paid_amount', 4000)
        ->assertJsonPath('invoice.remaining_amount', 6000);

    // Impossible d'annuler une facture ayant déjà un encaissement
    $this->actingAs($user, 'sanctum')
        ->patchJson('/api/invoices/'.$draftInvoice->id, ['status' => 'cancelled'])
        ->assertStatus(422);

    // Solde complet -> statut paid
    $this->actingAs($user, 'sanctum')
        ->postJson('/api/invoices/'.$draftInvoice->id.'/payments', [
            'amount' => 6000,
            'method' => 'mobile_money',
        ])
        ->assertStatus(200)
        ->assertJsonPath('invoice.status', 'paid')
        ->assertJsonPath('invoice.remaining_amount', 0);

    // Impossible de modifier une facture payée
    $this->actingAs($user, 'sanctum')
        ->patchJson('/api/invoices/'.$draftInvoice->id, ['status' => 'cancelled'])
        ->assertStatus(422);
});
