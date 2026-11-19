<?php

namespace App\Http\Requests\Consultation;

use App\Models\Consultation;
use Illuminate\Foundation\Http\FormRequest;

class StoreConsultationRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('create', Consultation::class) ?? false;
    }

    public function rules(): array
    {
        return [
            'patient_id' => ['required', 'integer', 'exists:patients,id'],
            'appointment_id' => ['nullable', 'integer', 'exists:appointments,id'],
            'chief_complaint' => ['nullable', 'string', 'max:1000'],
            'symptoms' => ['nullable', 'string', 'max:2000'],
            'diagnosis' => ['nullable', 'string', 'max:2000'],
            'notes' => ['nullable', 'string', 'max:4000'],
            'status' => ['nullable', 'string', 'in:draft,in_progress,completed,cancelled'],
        ];
    }
}
