<?php

namespace App\Http\Requests\Prescription;

use App\Models\Prescription;
use Illuminate\Foundation\Http\FormRequest;

class UpdatePrescriptionRequest extends FormRequest
{
    public function authorize(): bool
    {
        $prescription = Prescription::find($this->route('prescriptionId'));

        return $prescription !== null
            && $this->user()->can('update', $prescription);
    }

    public function rules(): array
    {
        return [
            'status' => ['sometimes', 'string', 'in:'.implode(',', Prescription::STATUSES)],
            'notes' => ['sometimes', 'nullable', 'string', 'max:1000'],
            'prescribed_at' => ['sometimes', 'nullable', 'date'],
        ];
    }
}
