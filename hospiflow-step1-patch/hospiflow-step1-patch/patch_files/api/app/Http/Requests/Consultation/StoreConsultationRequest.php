<?php

namespace App\Http\Requests\Consultation;

use App\Models\Consultation;
use Illuminate\Foundation\Http\FormRequest;

class StoreConsultationRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('create', Consultation::class);
    }

    public function rules(): array
    {
        return [
            'patient_id' => ['required', 'integer', 'exists:patients,id'],
            'appointment_id' => ['nullable', 'integer', 'exists:appointments,id'],
            'chief_complaint' => ['required', 'string', 'max:1000'],
            'examination' => ['nullable', 'string'],
            'diagnosis' => ['nullable', 'string', 'max:1000'],
            'treatment' => ['nullable', 'string'],
            'follow_up_date' => ['nullable', 'date'],
        ];
    }

    public function messages(): array
    {
        return [
            'chief_complaint.required' => 'Le motif de consultation est obligatoire.',
            'patient_id.exists' => 'Patient inconnu.',
            'appointment_id.exists' => 'Rendez-vous inconnu.',
        ];
    }
}
