<?php

namespace App\Http\Requests\Admission;

use Illuminate\Foundation\Http\FormRequest;

class DischargeAdmissionRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('admissions.manage') ?? false;
    }

    public function rules(): array
    {
        return [
            'notes' => ['nullable', 'string', 'max:2000'],
            'discharged_at' => ['nullable', 'date'],
            'bed_status' => ['nullable', 'string', 'in:available,maintenance'],
            'create_invoice' => ['nullable', 'boolean'],
            'daily_rate' => ['nullable', 'integer', 'min:1', 'max:100000000'],
            'invoice_due_date' => ['nullable', 'date'],
        ];
    }
}
