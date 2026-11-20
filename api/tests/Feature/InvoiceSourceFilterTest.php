<?php

use App\Models\Admission;
use App\Models\Facility;
use App\Models\Invoice;
use App\Models\InvoiceItem;
use App\Models\Patient;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Spatie\Permission\Models\Permission;

uses(RefreshDatabase::class);

test('filters invoices by source (admission vs manual/other)', function () {
    $facility = Facility::factory()->create();
    $user = User::factory()->create(['current_facility_id' => $facility->id]);
    $user->facilities()->attach($facility->id);
    Permission::firstOrCreate(['name' => 'invoices.view', 'guard_name' => 'web']);
    $user->givePermissionTo(['invoices.view']);
    $patient = Patient::factory()->create(['facility_id' => $facility->id]);

    $admission = Admission::create([
        'facility_id' => $facility->id,
        'patient_id' => $patient->id,
        'admitted_by' => $user->id,
        'status' => 'discharged',
        'admitted_at' => now()->subDay(),
        'discharged_at' => now(),
    ]);

    $stayInvoice = Invoice::create([
        'facility_id' => $facility->id,
        'patient_id' => $patient->id,
        'created_by' => $user->id,
        'number' => 'FAC-90001',
        'status' => 'draft',
        'total_amount' => 15000,
    ]);
    InvoiceItem::create([
        'invoice_id' => $stayInvoice->id,
        'admission_id' => $admission->id,
        'label' => 'Séjour hospitalier (1 j)',
        'quantity' => 1,
        'unit_price' => 15000,
        'amount' => 15000,
    ]);

    $otherInvoice = Invoice::create([
        'facility_id' => $facility->id,
        'patient_id' => $patient->id,
        'created_by' => $user->id,
        'number' => 'FAC-90002',
        'status' => 'draft',
        'total_amount' => 5000,
    ]);
    InvoiceItem::create([
        'invoice_id' => $otherInvoice->id,
        'label' => 'Acte divers',
        'quantity' => 1,
        'unit_price' => 5000,
        'amount' => 5000,
    ]);

    $this->actingAs($user, 'sanctum')->getJson('/api/invoices?source=admission')
        ->assertStatus(200)
        ->assertJsonCount(1, 'invoices')
        ->assertJsonPath('invoices.0.number', 'FAC-90001');

    $this->actingAs($user, 'sanctum')->getJson('/api/invoices?source=invalid')
        ->assertStatus(422);
});
