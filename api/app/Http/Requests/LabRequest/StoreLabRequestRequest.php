<?php

namespace App\Http\Requests\LabRequest;

use App\Models\LabRequest;
use Illuminate\Foundation\Http\FormRequest;

class StoreLabRequestRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('create', LabRequest::class) ?? false;
    }

    public function rules(): array
    {
        return [
            'patient_id' => ['required', 'integer', 'exists:patients,id'],
            'lab_panel_id' => ['nullable', 'integer', 'exists:lab_panels,id'],
            'consultation_id' => ['nullable', 'integer', 'exists:consultations,id'],
            'panel' => ['nullable', 'string', 'max:255'],
            'priority' => ['nullable', 'string', 'in:routine,urgent,stat'],
            'notes' => ['nullable', 'string', 'max:2000'],
            'create_invoice' => ['nullable', 'boolean'],
            'invoice_due_date' => ['nullable', 'date'],
        ];
    }
}
