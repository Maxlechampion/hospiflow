<?php

use App\Models\Facility;
use App\Models\Invoice;
use App\Models\InvoiceItem;
use App\Models\LabPanel;
use App\Models\Patient;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Spatie\Permission\Models\Permission;

uses(RefreshDatabase::class);

test('creates draft invoice and invoice item when lab request uses priced panel with create_invoice', function () {
    $facility = Facility::factory()->create();
    $user = User::factory()->create(['current_facility_id' => $facility->id]);
    $user->facilities()->attach($facility->id);
    Permission::firstOrCreate(['name' => 'lab.requests.manage', 'guard_name' => 'web']);
    $user->givePermissionTo(['lab.requests.manage']);
    $patient = Patient::factory()->create(['facility_id' => $facility->id]);

    $panel = LabPanel::create([
        'facility_id' => $facility->id,
        'code' => 'NFS',
        'name' => 'Numération Formule Sanguine',
        'price' => 4500,
        'is_active' => true,
    ]);

    $resp = $this->actingAs($user, 'sanctum')->postJson('/api/lab-requests', [
        'patient_id' => $patient->id,
        'lab_panel_id' => $panel->id,
        'create_invoice' => true,
    ])->assertStatus(201)
        ->assertJsonPath('invoice.status', 'draft')
        ->assertJsonPath('invoice.total_amount', 4500);

    $invoiceId = $resp->json('invoice.id');
    $labRequestId = $resp->json('lab_request.id');

    expect(Invoice::find($invoiceId))->not->toBeNull();
    expect(InvoiceItem::where('invoice_id', $invoiceId)->where('lab_request_id', $labRequestId)->where('amount', 4500)->exists())->toBeTrue();
});

test('rejects create_invoice when panel has zero price or no panel is selected', function () {
    $facility = Facility::factory()->create();
    $user = User::factory()->create(['current_facility_id' => $facility->id]);
    $user->facilities()->attach($facility->id);
    Permission::firstOrCreate(['name' => 'lab.requests.manage', 'guard_name' => 'web']);
    $user->givePermissionTo(['lab.requests.manage']);
    $patient = Patient::factory()->create(['facility_id' => $facility->id]);

    $freePanel = LabPanel::create([
        'facility_id' => $facility->id,
        'code' => 'GRAT',
        'name' => 'Panel gratuit',
        'price' => 0,
        'is_active' => true,
    ]);

    $this->actingAs($user, 'sanctum')->postJson('/api/lab-requests', [
        'patient_id' => $patient->id,
        'panel' => 'Analyse libre',
        'create_invoice' => true,
    ])->assertStatus(422);

    $this->actingAs($user, 'sanctum')->postJson('/api/lab-requests', [
        'patient_id' => $patient->id,
        'lab_panel_id' => $freePanel->id,
        'create_invoice' => true,
    ])->assertStatus(422);
});
