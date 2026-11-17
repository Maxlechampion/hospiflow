<?php

use App\Models\Invoice;
use App\Models\Patient;

beforeEach(function () {
    [$this->user, $this->facility] = authUser(['billing.view', 'billing.manage']);
    $this->patient = Patient::factory()->create(['facility_id' => $this->facility->id]);
});

test('full invoice lifecycle: draft → issued → paid', function () {
    // 1. Créer une facture (draft)
    $createResp = $this->actingAs($this->user, 'sanctum')
        ->postJson('/api/invoices', [
            'patient_id' => $this->patient->id,
            'items' => [
                ['label' => 'Consultation', 'quantity' => 1, 'unit_price' => 5000],
                ['label' => 'Médicament', 'quantity' => 2, 'unit_price' => 1500],
            ],
        ]);

    $createResp->assertStatus(201);
    $invoiceId = $createResp->json('invoice.id');
    expect($createResp->json('invoice.status'))->toBe('draft');
    expect($createResp->json('invoice.total_amount'))->toBe(8000);
    expect($createResp->json('invoice.number'))->toMatch('/^FAC-\d{5}$/');

    // 2. Émettre la facture
    $issueResp = $this->actingAs($this->user, 'sanctum')
        ->patchJson('/api/invoices/'.$invoiceId, ['status' => 'issued']);

    $issueResp->assertStatus(200);
    expect($issueResp->json('invoice.status'))->toBe('issued');

    // 3. Payer partiellement (5000 sur 8000)
    $payResp = $this->actingAs($this->user, 'sanctum')
        ->postJson('/api/invoices/'.$invoiceId.'/payments', [
            'amount' => 5000,
            'method' => 'cash',
        ]);

    $payResp->assertStatus(200);
    expect($payResp->json('invoice.paid_amount'))->toBe(5000);
    expect($payResp->json('invoice.remaining_amount'))->toBe(3000);
    expect($payResp->json('invoice.status'))->toBe('issued');

    // 4. Payer le reste (3000)
    $payResp2 = $this->actingAs($this->user, 'sanctum')
        ->postJson('/api/invoices/'.$invoiceId.'/payments', [
            'amount' => 3000,
            'method' => 'mobile_money',
        ]);

    $payResp2->assertStatus(200);
    expect($payResp2->json('invoice.status'))->toBe('paid');
    expect($payResp2->json('invoice.remaining_amount'))->toBe(0);
});

test('cannot pay more than remaining amount', function () {
    $invoice = Invoice::factory()->issued()->create([
        'facility_id' => $this->facility->id,
        'patient_id' => $this->patient->id,
        'total_amount' => 5000,
    ]);

    $response = $this->actingAs($this->user, 'sanctum')
        ->postJson('/api/invoices/'.$invoice->id.'/payments', [
            'amount' => 10000,
            'method' => 'cash',
        ]);

    $response->assertStatus(422);
    expect($response->json('error.message'))->toContain('reste à payer');
});
