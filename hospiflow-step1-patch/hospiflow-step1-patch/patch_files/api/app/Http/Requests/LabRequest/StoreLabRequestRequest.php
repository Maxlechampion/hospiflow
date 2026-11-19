<?php

namespace App\Http\Requests\LabRequest;

use App\Models\LabRequest;
use Illuminate\Foundation\Http\FormRequest;

class StoreLabRequestRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('create', LabRequest::class);
    }

    public function rules(): array
    {
        return [
            'patient_id' => ['required', 'integer', 'exists:patients,id'],
            'consultation_id' => ['nullable', 'integer', 'exists:consultations,id'],
            'panel' => ['required', 'string', 'max:200'],
            'priority' => ['nullable', 'string', 'in:routine,urgent'],
            'notes' => ['nullable', 'string', 'max:500'],
        ];
    }

    public function messages(): array
    {
        return [
            'panel.required' => "Le type d'analyse est obligatoire.",
            'patient_id.exists' => 'Patient inconnu.',
            'consultation_id.exists' => 'Consultation inconnue.',
            'priority.in' => 'Priorité invalide.',
        ];
    }
}
