<?php

use App\Models\Appointment;
use App\Models\DrugLot;
use App\Models\Facility;
use App\Models\Invoice;
use App\Models\LabRequest;
use App\Models\Patient;
use App\Models\User;
use Spatie\Permission\Models\Permission;

beforeEach(function () {
    // Créer un user avec facility courante
    $this->facility = Facility::factory()->create();
    $this->otherFacility = Facility::factory()->create();

    $this->user = User::factory()->create([
        'current_facility_id' => $this->facility->id,
    ]);
    $this->user->facilities()->attach($this->facility->id);
});

// Helper : donne une permission à un user
function givePerm(User $user, string $perm): void
{
    Permission::firstOrCreate(['name' => $perm]);
    $user->givePermissionTo($perm);
}

// ---------------------------------------------------------------------------
// PatientPolicy
// ---------------------------------------------------------------------------
test('PatientPolicy: user without permission cannot view patients', function () {
    expect($this->user->can('viewAny', Patient::class))->toBeFalse();
});

test('PatientPolicy: user with patients.view can view patients', function () {
    givePerm($this->user, 'patients.view');
    expect($this->user->fresh()->can('viewAny', Patient::class))->toBeTrue();
});

test('PatientPolicy: user cannot update patient from other facility', function () {
    givePerm($this->user, 'patients.manage');

    $otherPatient = Patient::factory()->create([
        'facility_id' => $this->otherFacility->id,
    ]);

    expect($this->user->fresh()->can('update', $otherPatient))->toBeFalse();
});

test('PatientPolicy: user can update patient from same facility', function () {
    givePerm($this->user, 'patients.manage');

    $patient = Patient::factory()->create([
        'facility_id' => $this->facility->id,
    ]);

    expect($this->user->fresh()->can('update', $patient))->toBeTrue();
});

// ---------------------------------------------------------------------------
// AppointmentPolicy
// ---------------------------------------------------------------------------
test('AppointmentPolicy: user without appointments.manage cannot create', function () {
    expect($this->user->can('create', Appointment::class))->toBeFalse();
});

test('AppointmentPolicy: user with appointments.manage can create', function () {
    givePerm($this->user, 'appointments.manage');
    expect($this->user->fresh()->can('create', Appointment::class))->toBeTrue();
});

// ---------------------------------------------------------------------------
// InvoicePolicy
// ---------------------------------------------------------------------------
test('InvoicePolicy: cannot update paid invoice', function () {
    givePerm($this->user, 'billing.manage');

    $invoice = Invoice::factory()->paid()->create([
        'facility_id' => $this->facility->id,
    ]);

    expect($this->user->fresh()->can('update', $invoice))->toBeFalse();
});

test('InvoicePolicy: can update draft invoice', function () {
    givePerm($this->user, 'billing.manage');

    $invoice = Invoice::factory()->create([
        'facility_id' => $this->facility->id,
        'status' => 'draft',
    ]);

    expect($this->user->fresh()->can('update', $invoice))->toBeTrue();
});

test('InvoicePolicy: cannot cancel invoice with payments', function () {
    givePerm($this->user, 'billing.manage');

    $invoice = Invoice::factory()->issued()->create([
        'facility_id' => $this->facility->id,
    ]);
    $invoice->payments()->create([
        'amount' => 5000,
        'method' => 'cash',
        'received_by' => $this->user->id,
        'paid_at' => now(),
    ]);

    expect($this->user->fresh()->can('cancel', $invoice))->toBeFalse();
});

// ---------------------------------------------------------------------------
// LabRequestPolicy
// ---------------------------------------------------------------------------
test('LabRequestPolicy: cannot update completed lab request', function () {
    givePerm($this->user, 'lab.requests.manage');

    $labRequest = LabRequest::factory()->create([
        'facility_id' => $this->facility->id,
        'status' => 'completed',
    ]);

    expect($this->user->fresh()->can('update', $labRequest))->toBeFalse();
});

// ---------------------------------------------------------------------------
// DrugLotPolicy
// ---------------------------------------------------------------------------
test('DrugLotPolicy: cannot dispense from empty lot', function () {
    givePerm($this->user, 'pharmacy.manage');

    $lot = DrugLot::factory()->create([
        'facility_id' => $this->facility->id,
        'quantity' => 0,
    ]);

    expect($this->user->fresh()->can('dispense', $lot))->toBeFalse();
});
