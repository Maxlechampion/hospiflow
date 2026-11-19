<?php

namespace App\Http\Requests\Consultation;

use App\Models\Consultation;
use Illuminate\Foundation\Http\FormRequest;

class UpdateConsultationRequest extends FormRequest
{
    public function authorize(): bool
    {
        $consultation = Consultation::find($this->route('consultationId'));

        return $consultation !== null
            && $this->user()->can('update', $consultation);
    }

    public function rules(): array
    {
        return [
            'chief_complaint' => ['sometimes', 'required', 'string', 'max:1000'],
            'examination' => ['sometimes', 'nullable', 'string'],
            'diagnosis' => ['sometimes', 'nullable', 'string', 'max:1000'],
            'treatment' => ['sometimes', 'nullable', 'string'],
            'follow_up_date' => ['sometimes', 'nullable', 'date'],
        ];
    }
}
