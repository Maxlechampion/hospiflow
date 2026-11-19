<?php

namespace App\Http\Requests\LabRequest;

use App\Models\LabRequest;
use Illuminate\Foundation\Http\FormRequest;

class StoreLabResultRequest extends FormRequest
{
    public function authorize(): bool
    {
        $labRequest = LabRequest::find($this->route('labRequestId'));

        return $labRequest !== null
            && $this->user()->can('storeResult', $labRequest);
    }

    public function rules(): array
    {
        return [
            'values' => ['required', 'string', 'max:4000'],
            'conclusion' => ['nullable', 'string', 'max:1000'],
        ];
    }

    public function messages(): array
    {
        return [
            'values.required' => 'Les valeurs des analyses sont obligatoires.',
        ];
    }
}
