<?php

use App\Models\Admission;
use App\Models\Bed;
use App\Models\Facility;
use App\Models\Invoice;
use App\Models\InvoiceItem;
use App\Models\Patient;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Spatie\Permission\Models\Permission;

uses(RefreshDatabase::class);

test('creates draft stay invoice on discharge with daily_rate and links invoice item to admission', function () {
    $facility = Facility::factory()->create();
    $user = User::factory()->create(['current_facility_id' => $facility->id]);
    $user->facilities()->attach($facility->id);
    Permission::firstOrCreate(['name' => 'admissions.manage', 'guard_name' => 'web']);
    $user->givePermissionTo(['admissions.manage']);
    $patient = Patient::factory()->create(['facility_id' => $facility->id]);
    $bed = Bed::create(['facility_id' => $facility->id, 'ward' => 'Hospitalisation', 'code' => 'HOSP-01', 'status' => 'occupied']);

    $admission = Admission::create([
        'facility_id' => $facility->id,
        'patient_id' => $patient->id,
        'bed_id' => $bed->id,
        'admitted_by' => $user->id,
        'status' => 'admitted',
        'admitted_at' => now()->subHours(70),
    ]);

    $resp = $this->actingAs($user, 'sanctum')->postJson('/api/admissions/'.$admission->id.'/discharge', [
        'create_invoice' => true,
        'daily_rate' => 10000,
    ])->assertStatus(200)
        ->assertJsonPath('invoice.status', 'draft')
        ->assertJsonPath('invoice.total_amount', 30000);

    $invoiceId = $resp->json('invoice.id');
    expect(Invoice::find($invoiceId))->not->toBeNull();
    expect(InvoiceItem::where('invoice_id', $invoiceId)->where('admission_id', $admission->id)->where('quantity', 3)->where('amount', 30000)->exists())->toBeTrue();
});

test('rejects create_invoice on discharge when daily_rate is missing or zero', function () {
    $facility = Facility::factory()->create();
    $user = User::factory()->create(['current_facility_id' => $facility->id]);
    $user->facilities()->attach($facility->id);
    Permission::firstOrCreate(['name' => 'admissions.manage', 'guard_name' => 'web']);
    $user->givePermissionTo(['admissions.manage']);
    $patient = Patient::factory()->create(['facility_id' => $facility->id]);

    $admission = Admission::create([
        'facility_id' => $facility->id,
        'patient_id' => $patient->id,
        'admitted_by' => $user->id,
        'status' => 'admitted',
        'admitted_at' => now()->subDay(),
    ]);

    $this->actingAs($user, 'sanctum')->postJson('/api/admissions/'.$admission->id.'/discharge', [
        'create_invoice' => true,
    ])->assertStatus(422);
});
