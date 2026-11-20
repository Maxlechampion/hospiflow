<?php

use App\Models\Facility;
use App\Models\Invoice;
use App\Models\Patient;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Spatie\Permission\Models\Permission;

uses(RefreshDatabase::class);

test('enforces billing.view and billing.manage permissions on invoice endpoints', function () {
    $facility = Facility::factory()->create();
    $patient = Patient::factory()->create(['facility_id' => $facility->id]);

    foreach (['billing.view', 'billing.manage'] as $perm) {
        Permission::firstOrCreate(['name' => $perm, 'guard_name' => 'web']);
    }

    $noPermUser = User::factory()->create(['current_facility_id' => $facility->id]);
    $noPermUser->facilities()->attach($facility->id);

    $viewerUser = User::factory()->create(['current_facility_id' => $facility->id]);
    $viewerUser->facilities()->attach($facility->id);
    $viewerUser->givePermissionTo('billing.view');

    $invoice = Invoice::create([
        'facility_id' => $facility->id,
        'patient_id' => $patient->id,
        'created_by' => $viewerUser->id,
        'number' => 'FAC-80001',
        'status' => 'draft',
        'total_amount' => 5000,
    ]);

    // Sans permission : refusé (403)
    $this->actingAs($noPermUser, 'sanctum')
        ->getJson('/api/invoices')
        ->assertStatus(403);

    // Avec billing.view uniquement : lecture autorisée (200), mutations refusées (403)
    $this->actingAs($viewerUser, 'sanctum')
        ->getJson('/api/invoices')
        ->assertStatus(200);

    $this->actingAs($viewerUser, 'sanctum')
        ->getJson('/api/invoices/'.$invoice->id)
        ->assertStatus(200);

    $this->actingAs($viewerUser, 'sanctum')
        ->postJson('/api/invoices', [
            'patient_id' => $patient->id,
            'items' => [['label' => 'Acte', 'quantity' => 1, 'unit_price' => 2000]],
        ])
        ->assertStatus(403);

    $this->actingAs($viewerUser, 'sanctum')
        ->patchJson('/api/invoices/'.$invoice->id, ['status' => 'issued'])
        ->assertStatus(403);

    $this->actingAs($viewerUser, 'sanctum')
        ->postJson('/api/invoices/'.$invoice->id.'/payments', [
            'amount' => 1000,
            'method' => 'cash',
        ])
        ->assertStatus(403);
});
