<?php

namespace App\Http\Requests\Prescription;

use App\Models\Prescription;
use Illuminate\Foundation\Http\FormRequest;

class AddPrescriptionItemRequest extends FormRequest
{
    public function authorize(): bool
    {
        $prescription = $this->route('prescription');
        if ($prescription instanceof Prescription) {
            return $this->user()->can('update', $prescription);
        }

        return $this->user()->can('create', Prescription::class);
    }

    public function rules(): array
    {
        return [
            'drug_id' => ['required', 'integer', 'exists:drugs,id'],
            'dosage' => ['required', 'string', 'max:120'],
            'frequency' => ['nullable', 'string', 'max:120'],
            'duration' => ['nullable', 'string', 'max:120'],
            'quantity' => ['required', 'integer', 'min:1', 'max:10000'],
            'instructions' => ['nullable', 'string', 'max:500'],
        ];
    }
}
