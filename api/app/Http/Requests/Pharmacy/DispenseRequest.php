<?php

namespace App\Http\Requests\Pharmacy;

use App\Models\DrugLot;
use Illuminate\Foundation\Http\FormRequest;

class DispenseRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('create', DrugLot::class);
    }

    public function rules(): array
    {
        return [
            'patient_id' => ['required', 'integer', 'exists:patients,id'],
            'consultation_id' => ['nullable', 'integer', 'exists:consultations,id'],
            'drug_id' => ['required', 'integer', 'exists:drugs,id'],
            'quantity' => ['required', 'integer', 'min:1', 'max:10000'],
            'notes' => ['nullable', 'string', 'max:500'],
        ];
    }

    public function messages(): array
    {
        return [
            'quantity.required' => 'La quantité dispensée est obligatoire.',
            'patient_id.exists' => 'Patient inconnu.',
            'drug_id.exists' => 'Médicament inconnu.',
        ];
    }
}
