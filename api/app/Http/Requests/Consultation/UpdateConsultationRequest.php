<?php

namespace App\Http\Requests\Consultation;

use App\Models\Consultation;
use Illuminate\Foundation\Http\FormRequest;

class UpdateConsultationRequest extends FormRequest
{
    public function authorize(): bool
    {
        $consultation = $this->route('consultation');
        if ($consultation instanceof Consultation) {
            return $this->user()?->can('update', $consultation) ?? false;
        }

        return $this->user()?->can('update', Consultation::class) ?? false;
    }

    public function rules(): array
    {
        return [
            'chief_complaint' => ['nullable', 'string', 'max:1000'],
            'symptoms' => ['nullable', 'string', 'max:2000'],
            'diagnosis' => ['nullable', 'string', 'max:2000'],
            'notes' => ['nullable', 'string', 'max:4000'],
            'status' => ['nullable', 'string', 'in:draft,in_progress,completed,cancelled'],
        ];
    }
}
