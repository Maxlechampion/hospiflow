<?php

namespace App\Http\Requests\Prescription;

use App\Models\Drug;
use App\Models\Prescription;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

class AddPrescriptionItemRequest extends FormRequest
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
            'drug_id' => ['required', 'integer', 'exists:drugs,id'],
            'dosage' => ['nullable', 'string', 'max:100'],
            'frequency' => ['nullable', 'string', 'max:100'],
            'duration' => ['nullable', 'string', 'max:100'],
            'quantity' => ['nullable', 'integer', 'min:1', 'max:10000'],
            'instructions' => ['nullable', 'string', 'max:500'],
            'notes' => ['nullable', 'string', 'max:500'],
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator) {
            $drugId = $this->input('drug_id');
            if ($drugId !== null) {
                $isActive = Drug::where('id', $drugId)->where('is_active', true)->exists();
                if (! $isActive) {
                    $validator->errors()->add('drug_id', 'Ce médicament est inconnu ou inactif.');
                }
            }
        });
    }

    public function messages(): array
    {
        return [
            'drug_id.exists' => 'Médicament inconnu.',
        ];
    }
}
