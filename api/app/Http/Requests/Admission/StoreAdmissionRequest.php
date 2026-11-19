<?php

namespace App\Http\Requests\Admission;

use App\Models\Admission;
use Illuminate\Foundation\Http\FormRequest;

class StoreAdmissionRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('create', Admission::class) ?? false;
    }

    public function rules(): array
    {
        return [
            'patient_id' => ['required', 'integer', 'exists:patients,id'],
            'bed_id' => ['nullable', 'integer', 'exists:beds,id'],
            'consultation_id' => ['nullable', 'integer', 'exists:consultations,id'],
            'reason' => ['nullable', 'string', 'max:1000'],
            'notes' => ['nullable', 'string', 'max:2000'],
            'admitted_at' => ['nullable', 'date'],
        ];
    }
}
