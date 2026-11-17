<?php

namespace App\Http\Requests\Invoice;

use App\Models\Invoice;
use Illuminate\Foundation\Http\FormRequest;

class StoreInvoiceRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('create', Invoice::class);
    }

    public function rules(): array
    {
        return [
            'patient_id' => ['required', 'integer', 'exists:patients,id'],
            'consultation_id' => ['nullable', 'integer', 'exists:consultations,id'],
            'due_date' => ['nullable', 'date', 'after:today'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.label' => ['required', 'string', 'max:300'],
            'items.*.quantity' => ['required', 'integer', 'min:1', 'max:10000'],
            'items.*.unit_price' => ['required', 'integer', 'min:0', 'max:100000000'],
        ];
    }

    public function messages(): array
    {
        return [
            'patient_id.exists' => 'Patient inconnu.',
            'consultation_id.exists' => 'Consultation inconnue.',
            'items.required' => 'La facture doit contenir au moins une ligne.',
            'due_date.after' => "L'échéance doit être future.",
        ];
    }
}
