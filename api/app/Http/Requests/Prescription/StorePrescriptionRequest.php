<?php

namespace App\Http\Requests\Prescription;

use App\Models\Prescription;
use Illuminate\Foundation\Http\FormRequest;

class StorePrescriptionRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('create', Prescription::class);
    }

    public function rules(): array
    {
        return [
            'patient_id' => ['required', 'integer', 'exists:patients,id'],
            'consultation_id' => ['nullable', 'integer', 'exists:consultations,id'],
            'status' => ['nullable', 'string', 'in:'.implode(',', Prescription::STATUSES)],
            'notes' => ['nullable', 'string', 'max:1000'],
            'prescribed_at' => ['nullable', 'date'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.drug_id' => ['required', 'integer', 'exists:drugs,id'],
            'items.*.dosage' => ['nullable', 'string', 'max:100'],
            'items.*.frequency' => ['nullable', 'string', 'max:100'],
            'items.*.duration' => ['nullable', 'string', 'max:100'],
            'items.*.quantity' => ['nullable', 'integer', 'min:1', 'max:10000'],
            'items.*.instructions' => ['nullable', 'string', 'max:500'],
            'items.*.notes' => ['nullable', 'string', 'max:500'],
        ];
    }

    public function messages(): array
    {
        return [
            'patient_id.exists' => 'Patient inconnu.',
            'consultation_id.exists' => 'Consultation inconnue.',
            'items.required' => 'La prescription doit contenir au moins un médicament.',
            'items.min' => 'La prescription doit contenir au moins un médicament.',
            'items.*.drug_id.exists' => 'Médicament inconnu.',
        ];
    }
}
